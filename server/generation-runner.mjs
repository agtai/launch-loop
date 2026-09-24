import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { windowsHostScript } from './generation-windows-host.mjs';
import { bad } from './content-validation.mjs';

export function findCodex() {
  if (process.platform !== 'win32') return null;
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.resolve(dir.replace(/^"|"$/g, ''), 'codex.exe');
    try { if (statSync(candidate).isFile()) return candidate; } catch { /* Continue PATH search. */ }
  }
  return null;
}

export function codexArguments({ directory, schemaPath, outputPath, images = [] }) {
  const disabled = ['shell_tool', 'shell_snapshot', 'unified_exec', 'code_mode', 'code_mode_host', 'apps', 'plugins', 'hooks', 'browser_use', 'browser_use_external', 'computer_use', 'image_generation', 'multi_agent', 'multi_agent_v2', 'memories', 'skill_search', 'workspace_dependencies', 'view_image', 'sleep_tool', 'goals', 'tool_suggest', 'in_app_browser', 'in_app_local_automation', 'skill_mcp_dependency_install'];
  // Both the successful preflight and the first UI run spent ~2 minutes retrying
  // WebSockets before HTTP fallback. Use the documented custom-provider transport
  // setting; the built-in "openai" provider ID is reserved. Authentication and
  // its default endpoint remain entirely CLI-owned; no key or URL is supplied.
  // https://learn.chatgpt.com/docs/auth#alternative-model-providers
  const transport = ['-c', 'model_provider="launch-loop-openai-http"', '-c', 'model_providers.launch-loop-openai-http={name="OpenAI",requires_openai_auth=true,supports_websockets=false,wire_api="responses"}'];
  return ['--no-daemon', '-a', 'never', 'exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check', '-C', directory, '-s', 'read-only', '-m', 'gpt-6-astra', ...transport, '-c', 'model_reasoning_effort="xhigh"', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"', '-c', 'history.persistence="none"', '-c', 'forced_login_method="chatgpt"', '-c', 'otel.log_user_prompt=false', '-c', `log_dir=${JSON.stringify(directory)}`, '-c', `sqlite_home=${JSON.stringify(directory)}`, '--enable', 'skip_host_skill_discovery', ...disabled.flatMap(name => ['--disable', name]), '--json', '--color', 'never', '--output-schema', schemaPath, '-o', outputPath, ...images.flatMap(file => ['--image', file]), '-'];
}

/** Test-only command injection exercises the real containment host without a model. */
export async function runCodex({ directory, prompt, schema, images = [], signal, timeoutMs = 300_000, testOnlyCommand }) {
  if (signal?.aborted) bad('生成已取消。', 409);
  const executable = testOnlyCommand?.executable ?? findCodex();
  if (!executable || process.platform !== 'win32') bad('本机没有可用的 Windows Codex CLI 受控执行入口。', 503);
  const promptPath = path.join(directory, 'prompt.txt'), schemaPath = path.join(directory, 'schema.json');
  const outputPath = path.join(directory, 'output.json'), eventsPath = path.join(directory, 'events.jsonl'), stderrPath = path.join(directory, 'stderr.txt');
  const hostPath = path.join(directory, 'supervisor.ps1'), configPath = path.join(directory, 'supervisor.json');
  writeFileSync(promptPath, prompt, { flag: 'wx', mode: 0o600 });
  writeFileSync(schemaPath, JSON.stringify(schema), { flag: 'wx', mode: 0o600 });
  writeFileSync(hostPath, windowsHostScript, { flag: 'wx', mode: 0o600 });
  const args = testOnlyCommand ? testOnlyCommand.args({ outputPath, eventsPath, promptPath, directory }) : codexArguments({ directory, schemaPath, outputPath, images });
  writeFileSync(configPath, JSON.stringify({ executable, args, cwd: directory, promptPath, eventsPath, stderrPath, timeoutMs }), { flag: 'wx', mode: 0o600 });
  const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  let timeout = false, hostFailure = '';
  const code = await new Promise((resolve, reject) => {
    const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', hostPath, '-ConfigPath', configPath], { shell: false, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let killTimer;
    const cancel = () => { child.stdin.end(); killTimer ??= setTimeout(() => child.kill(), 5000); };
    const timer = setTimeout(() => { timeout = true; cancel(); }, timeoutMs + 5000);
    signal?.addEventListener('abort', cancel, { once: true });
    child.stdin.on('error', () => {});
    child.stderr.on('data', bytes => { if (hostFailure.length < 16000) hostFailure += bytes.toString('utf8'); });
    const cleanup = () => { clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', cancel); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', value => { cleanup(); resolve(value); });
    if (signal?.aborted) cancel();
  });
  if (hostFailure) writeFileSync(path.join(directory, 'supervisor-error.txt'), hostFailure, { mode: 0o600 });
  timeout ||= code === 124;
  writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ code, timeout, cancelled: !!signal?.aborted, finishedAt: new Date().toISOString() }), { mode: 0o600 });
  if (signal?.aborted) bad('生成已取消，受控模型进程已终止。', 409);
  if (timeout) {
    const diagnostic = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf8') : '';
    if (/request timed out|stream disconnected|error sending request/i.test(diagnostic)) bad('Codex 连接出现网络超时，且在本次执行时限内未完成；已终止调用，正文未生成成功。', 504);
    bad('Codex 执行超时，已终止本次调用。', 504);
  }
  if (code !== 0) bad(`Codex 执行失败（退出码 ${code ?? 'unknown'}）。详细输出保留在本任务 tmp。`, 502);
  if (!existsSync(outputPath) || !existsSync(eventsPath) || statSync(outputPath).size > 1024 * 1024 || statSync(eventsPath).size > 8 * 1024 * 1024) bad('Codex 未返回有效的实际输出。', 502);
  let result, events;
  try { result = JSON.parse(readFileSync(outputPath, 'utf8')); events = readFileSync(eventsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
  catch { bad('Codex 返回的正文或完成事件不是有效 JSON。', 502); }
  if (!events.some(event => event.type === 'turn.completed') || events.some(event => event.type === 'turn.failed')) bad('Codex 没有真实完成事件，不能作为生成成功。', 502);
  // Codex emits non-fatal transport/feature warnings as item.type="error".
  // A successful completed turn plus valid output may follow those warnings.
  if (events.some(event => /^item\./.test(event.type) && event.item?.type && !['agent_message', 'reasoning', 'error'].includes(event.item.type))) bad('Codex 意外执行了工具，本次输出拒绝使用；详情只保留在 tmp。', 502);
  return result;
}
