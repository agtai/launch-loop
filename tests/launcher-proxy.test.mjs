import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proxyNames = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'];
function isolatedEnvironment(extra = {}) {
  return { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !proxyNames.includes(name.toUpperCase()))), ...extra };
}
function run(script, args = [], env = isolatedEnvironment()) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], { env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', bytes => output += bytes); child.stderr.on('data', bytes => output += bytes);
    child.once('error', reject); child.once('exit', code => { child.stdout.destroy(); child.stderr.destroy(); resolve({ code, output }); });
  });
}
async function folder(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-proxy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function freePort() {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
test('optional system proxy validates manual settings and preserves explicit environment', { skip: process.platform !== 'win32' }, async t => {
  const root = await folder(t), script = path.join(root, 'cases.ps1'), casesPath = path.join(root, 'cases.json');
  const enabled = { ProxyEnable: 1, ProxyServer: '127.0.0.1:7890', AutoConfigURL: '' };
  const cases = [
    { name: 'off', use: false, settings: enabled },
    { name: 'manual', use: true, settings: enabled, env: { NO_PROXY: '.internal,localhost' } },
    { name: 'mapping', use: true, settings: { ...enabled, ProxyServer: 'http=127.0.0.1:7890;https=https://proxy.example:8443' } },
    { name: 'ipv6', use: true, settings: { ...enabled, ProxyServer: '[::1]:7890' } },
    ...['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'].map(name => ({ name, use: true, env: { [name]: 'http://existing.invalid:1234' }, settings: null })),
    { name: 'disabled', use: true, settings: { ...enabled, ProxyEnable: 0 } },
    { name: 'pac', use: true, settings: { ...enabled, AutoConfigURL: 'https://example.invalid/proxy.pac' } },
    ...['', 'user:synthetic-secret@127.0.0.1:7890', 'http://127.0.0.1:7890/path', 'http://127.0.0.1:7890?query=x', 'http://127.0.0.1:7890#fragment', 'http://127.0.0.1:0', 'http://127.0.0.1:99999', 'socks5://127.0.0.1:7890', 'proxy invalid:80', '127.0.0.1:7890\r\nmalformed', 'https=127.0.0.1:7890', 'http=127.0.0.1:7890;http=127.0.0.1:7891;https=127.0.0.1:7890'].map((ProxyServer, index) => ({ name: `invalid-${index}`, use: true, settings: { ...enabled, ProxyServer } })),
  ];
  await writeFile(casesPath, JSON.stringify(cases));
  await writeFile(script, '\uFEFF' + String.raw`param($Helper,$CasesPath)
. $Helper
$cases = Get-Content -LiteralPath $CasesPath -Raw -Encoding UTF8 | ConvertFrom-Json
function Get-WorkbenchManualSystemProxy { $script:readCount++; if (-not $script:case.settings) { throw 'Unexpected settings read' }; return $script:case.settings }
$results = @()
foreach ($script:case in $cases) {
  foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  if ($case.env) { foreach ($entry in $case.env.PSObject.Properties) { [Environment]::SetEnvironmentVariable($entry.Name, $entry.Value, 'Process') } }
  $script:readCount = 0
  try { $value = Get-WorkbenchProxyOverrides -UseSystemProxy:([bool]$case.use); $results += @{name=$case.name;ok=$true;mode=$value.Mode;values=$value.Values;reads=$readCount} }
  catch { $results += @{name=$case.name;ok=$false;error=$_.Exception.Message;reads=$readCount} }
}
ConvertTo-Json -InputObject $results -Depth 8 -Compress
`);
  const result = await run(script, [path.join(project, 'server/Launcher.Proxy.ps1'), casesPath]);
  assert.equal(result.code, 0, result.output);
  const rows = JSON.parse(result.output), byName = Object.fromEntries(rows.map(row => [row.name, row]));
  assert.deepEqual(byName.off.values, {}); assert.equal(byName.off.reads, 0);
  assert.deepEqual(byName.manual.values, { HTTP_PROXY: 'http://127.0.0.1:7890', HTTPS_PROXY: 'http://127.0.0.1:7890', NO_PROXY: '.internal,localhost,127.0.0.1,::1' });
  assert.equal(byName.manual.reads, 1); assert.equal(byName.mapping.values.HTTPS_PROXY, 'https://proxy.example:8443');
  assert.equal(new URL(byName.ipv6.values.HTTP_PROXY).hostname, '[::1]');
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) { assert.equal(byName[name].mode, 'existing'); assert.equal(byName[name].reads, 0); assert.deepEqual(Object.keys(byName[name].values), ['NO_PROXY']); }
  for (const row of rows.filter(row => /^(disabled|pac|invalid-)/.test(row.name))) assert.equal(row.ok, false, row.name);
  assert.ok(!result.output.includes('synthetic-secret'), 'errors must not echo the supplied proxy credentials');
});

test('proxy environment scope restores its caller after success and failure; Node flag requires advertised support', { skip: process.platform !== 'win32' }, async t => {
  const root = await folder(t), script = path.join(root, 'scope.ps1');
  await writeFile(script, '\uFEFF' + String.raw`param($Helper,$NodePath)
. $Helper
$before = @{HTTP_PROXY=$env:HTTP_PROXY;HTTPS_PROXY=$env:HTTPS_PROXY;NO_PROXY=$env:NO_PROXY}
$overrides = @{HTTP_PROXY='http://127.0.0.1:4567';HTTPS_PROXY='http://127.0.0.1:4567';NO_PROXY='localhost,127.0.0.1,::1'}
$childText = Invoke-WithWorkbenchEnvironment $overrides { & $NodePath -e 'console.log(JSON.stringify({http:process.env.HTTP_PROXY,https:process.env.HTTPS_PROXY,bypass:process.env.NO_PROXY}))' }
$successAfter = @{HTTP_PROXY=$env:HTTP_PROXY;HTTPS_PROXY=$env:HTTPS_PROXY;NO_PROXY=$env:NO_PROXY}
try { Invoke-WithWorkbenchEnvironment $overrides { throw 'Synthetic launch failure' } } catch { $failed = $_.Exception.Message -eq 'Synthetic launch failure' }
$failureAfter = @{HTTP_PROXY=$env:HTTP_PROXY;HTTPS_PROXY=$env:HTTPS_PROXY;NO_PROXY=$env:NO_PROXY}
@{before=$before;successAfter=$successAfter;failureAfter=$failureAfter;failed=$failed;child=($childText|ConvertFrom-Json);supported=(Get-WorkbenchNodeProxyFlag '  --use-env-proxy  enable proxy');unsupported=(Get-WorkbenchNodeProxyFlag '  --use-env-proxy-other nope');actual=(Get-WorkbenchNodeProxyFlag ((& $NodePath --help)|Out-String))} | ConvertTo-Json -Depth 8 -Compress
`);
  const result = await run(script, [path.join(project, 'server/Launcher.Proxy.ps1'), process.execPath], isolatedEnvironment({ HTTP_PROXY: 'http://prior.invalid:8080', NO_PROXY: 'prior.invalid' }));
  assert.equal(result.code, 0, result.output); const value = JSON.parse(result.output);
  assert.equal(value.failed, true); assert.deepEqual(value.successAfter, value.before); assert.deepEqual(value.failureAfter, value.before);
  assert.deepEqual(value.child, { http: 'http://127.0.0.1:4567', https: 'http://127.0.0.1:4567', bypass: 'localhost,127.0.0.1,::1' });
  assert.equal(value.supported, '--use-env-proxy'); assert.equal(value.unsupported, null);
});

test('launcher opt-in carries explicit proxy and supported Node flag to an isolated local service', { skip: process.platform !== 'win32', timeout: 60000 }, async t => {
  const root = await folder(t), port = await freePort();
  for (const name of ['server', 'data-seed', 'dist', 'runtime']) await mkdir(path.join(root, name));
  for (const name of ['Start-Workbench.ps1', 'Stop-Workbench.ps1']) await cp(path.join(project, name), path.join(root, name));
  for (const name of ['Launcher.Common.ps1', 'Launcher.Proxy.ps1']) await cp(path.join(project, 'server', name), path.join(root, 'server', name));
  await cp(process.execPath, path.join(root, 'runtime', 'node.exe'));
  await writeFile(path.join(root, 'data-seed', 'modules.json'), '[]'); await writeFile(path.join(root, 'data-seed', 'tasks.json'), '[]');
  await writeFile(path.join(root, 'dist', 'index.html'), '<h1>Synthetic local service</h1>');
  await writeFile(path.join(root, 'server', 'index.mjs'), `import http from 'node:http';import{writeFileSync}from'node:fs';import path from'node:path';writeFileSync(path.join(process.env.DATA_DIR,'proxy-observation.json'),JSON.stringify({http:process.env.HTTP_PROXY,https:process.env.HTTPS_PROXY,bypass:process.env.NO_PROXY,args:process.execArgv}));http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({app:'content-workbench-local',version:1}));}).listen(Number(process.env.PORT),'127.0.0.1');`);
  const start = path.join(root, 'Start-Workbench.ps1'), stop = path.join(root, 'Stop-Workbench.ps1');
  // This cleanup is registered after folder cleanup, so explicitly stop before removal.
  try {
    const result = await run(start, ['-Port', String(port), '-NoBrowser', '-UseSystemProxy'], isolatedEnvironment({ HTTP_PROXY: 'http://existing.invalid:1234', HTTPS_PROXY: 'http://existing.invalid:1234', NO_PROXY: '.internal' }));
    assert.equal(result.code, 0, result.output);
    const observation = JSON.parse(await readFile(path.join(root, 'data', 'proxy-observation.json'), 'utf8'));
    assert.equal(observation.http, 'http://existing.invalid:1234'); assert.equal(observation.https, observation.http);
    assert.equal(observation.bypass, '.internal,localhost,127.0.0.1,::1');
    const help = await new Promise(resolve => { const child = spawn(process.execPath, ['--help']); let out = ''; child.stdout.on('data', x => out += x); child.once('close', () => resolve(out)); });
    assert.equal(observation.args.includes('--use-env-proxy'), /^\s*--use-env-proxy(?:\s|$)/m.test(help));
    const reused = await run(start, ['-Port', String(port), '-NoBrowser', '-UseSystemProxy']);
    assert.equal(reused.code, 0, reused.output); assert.match(reused.output, /Stop-Workbench\.ps1/);
  } finally { const stopped = await run(stop); assert.equal(stopped.code, 0, stopped.output); }
});
