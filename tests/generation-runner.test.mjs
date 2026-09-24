import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { runCodex, codexArguments } from '../server/generation-runner.mjs';
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function folder(t) { const directory = mkdtempSync(path.join(tmpdir(), 'generation-supervisor-')); t.after(() => rmSync(directory, { recursive: true, force: true })); return directory; }
const command = (mode, marker) => ({ executable: process.execPath, args: ({ outputPath }) => [path.join(fixtures, 'generation-fake-cli.mjs'), outputPath, mode, marker ?? ''] });
async function ready(file) { for (let i = 0; i < 300; i++) { if (existsSync(file)) return; await wait(50); } throw Error('Synthetic child did not start'); }
test('CLI arguments are fixed and disable tools; prompt stays off argv', () => {
  const args = codexArguments({ directory: 'C:\\test space', schemaPath: 'schema', outputPath: 'output', images: ['image.png'] });
  assert.equal(args.at(-1), '-'); assert.ok(args.includes('--ignore-user-config')); assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('shell_tool')); assert.ok(args.includes('plugins')); assert.ok(args.includes('web_search="disabled"'));
  assert.ok(args.includes('forced_login_method="chatgpt"'));
  assert.ok(args.includes('model_provider="launch-loop-openai-http"'));
  const provider = args.find(arg => arg.startsWith('model_providers.'));
  assert.match(provider, /requires_openai_auth=true/); assert.match(provider, /supports_websockets=false/);
  assert.doesNotMatch(provider, /base_url|env_key|token/);
  assert.deepEqual(args.slice(-3), ['--image', 'image.png', '-']);
});
test('Windows Job Object host preserves literal stdin and validates completion output', { skip: process.platform !== 'win32' }, async t => {
  const prompt = 'SYNTHETIC 中文 $() `not a shell` "quotes"\nsecond line';
  const result = await runCodex({ directory: folder(t), prompt, schema: {}, testOnlyCommand: command('success'), timeoutMs: 10000 });
  assert.equal(result.actual, prompt);
  assert.equal((await runCodex({ directory: folder(t), prompt, schema: {}, testOnlyCommand: command('warning'), timeoutMs: 10000 })).actual, prompt);
  for (const mode of ['missing-event', 'invalid', 'tool']) await assert.rejects(runCodex({ directory: folder(t), prompt, schema: {}, testOnlyCommand: command(mode), timeoutMs: 10000 }));
});
test('Windows containment preserves process-scoped proxy environment without serializing it into supervisor configuration', { skip: process.platform !== 'win32' }, async t => {
  const expected = { HTTP_PROXY: 'http://127.0.0.1:34891', HTTPS_PROXY: 'http://127.0.0.1:34891', NO_PROXY: 'localhost,127.0.0.1,::1' };
  const previous = Object.fromEntries(Object.keys(expected).map(name => [name, process.env[name]]));
  Object.assign(process.env, expected);
  try {
    const directory = folder(t);
    const result = await runCodex({
      directory, prompt: 'SYNTHETIC environment inheritance test; no network or model.', schema: {}, timeoutMs: 10000,
      testOnlyCommand: {
        executable: process.execPath,
        args: ({ outputPath }) => ['--input-type=module', '-e', 'import {writeFileSync} from "node:fs"; const values = Object.fromEntries(["HTTP_PROXY","HTTPS_PROXY","NO_PROXY"].map(name => [name, process.env[name]])); writeFileSync(process.argv[1], JSON.stringify(values)); console.log(JSON.stringify({type:"turn.completed"}));', outputPath],
      },
    });
    assert.deepEqual(result, expected);
    assert.deepEqual(Object.fromEntries(Object.keys(expected).map(name => [name, process.env[name]])), expected);
    const configuration = readFileSync(path.join(directory, 'supervisor.json'), 'utf8');
    assert.equal(Object.hasOwn(JSON.parse(configuration), 'env'), false);
    assert.ok(!configuration.includes(expected.HTTPS_PROXY));
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
test('cancellation and timeout terminate the owned CLI and its child process', { skip: process.platform !== 'win32' }, async t => {
  for (const mode of ['cancel', 'timeout']) {
    const directory = folder(t), marker = path.join(directory, 'heartbeat'), controller = new AbortController();
    const promise = runCodex({ directory, prompt: 'SYNTHETIC', schema: {}, signal: controller.signal, testOnlyCommand: command('hang', marker), timeoutMs: mode === 'timeout' ? 1600 : 10000 });
    const rejected = assert.rejects(promise, mode === 'timeout' ? /超时/ : /取消/);
    await ready(marker + '.child.ready'); if (mode === 'cancel') controller.abort();
    await rejected; const sizes = [marker, marker + '.child'].map(file => existsSync(file) ? statSync(file).size : 0);
    await wait(250); assert.deepEqual([marker, marker + '.child'].map(file => existsSync(file) ? statSync(file).size : 0), sizes);
  }
});
test('unexpected service process death closes the pipe and kills exactly its job descendants', { skip: process.platform !== 'win32' }, async t => {
  const directory = folder(t), marker = path.join(directory, 'heartbeat');
  const child = spawn(process.execPath, [path.join(fixtures, 'generation-parent-fixture.mjs'), directory, marker], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stderr.on('data', data => output += data); t.after(() => { if (child.exitCode === null) child.kill(); });
  await ready(marker + '.child.ready'); const exited = once(child, 'close'); child.kill(); await exited;
  await wait(1000); const sizes = [marker, marker + '.child'].map(file => existsSync(file) ? statSync(file).size : 0);
  await wait(350); assert.deepEqual([marker, marker + '.child'].map(file => existsSync(file) ? statSync(file).size : 0), sizes, output);
});
