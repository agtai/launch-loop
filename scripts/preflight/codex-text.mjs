// Optional connectivity probe. All generated text and logs stay under tmp/.
// Requires an existing Codex CLI login; never reads authentication files.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { finished } from 'node:stream/promises';

const outputDir = resolve('tmp/preflight/runs', new Date().toISOString().replaceAll(':', '-'));
await mkdir(outputDir, { recursive: true });
const prompt = 'This is a minimal text-generation connectivity test. Do not use any tools, read files, write files, browse, or delegate. Generate a short original one-sentence Chinese and one-sentence English introduction for a local writing workbench. State only that drafts can be revised and require author confirmation before saving. Do not claim publishing or automation is implemented. Output exactly a JSON object with keys zh and en.';
const args = ['--no-daemon', '-a', 'never', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '-C', outputDir, '-s', 'read-only', '-m', 'gpt-6-astra', '-c', 'model_reasoning_effort="high"', '-c', 'project_doc_max_bytes=0', '--json', '-o', resolve(outputDir, 'codex-text.txt'), prompt];
const stdout = createWriteStream(resolve(outputDir, 'codex-events.jsonl'));
const stderr = createWriteStream(resolve(outputDir, 'codex-stderr.txt'));
const startedAt = new Date().toISOString();
const child = spawn('codex', args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(stdout);
child.stderr.pipe(stderr);
let timedOut = false;
let spawnError = null;
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120_000);
child.on('error', error => {
  clearTimeout(timer);
  spawnError = error.message;
});
child.on('close', async (code, signal) => {
  clearTimeout(timer);
  stdout.end(); stderr.end();
  await Promise.all([finished(stdout), finished(stderr)]);
  let outputValid = false;
  let completed = false;
  try {
    const body = JSON.parse(await readFile(resolve(outputDir, 'codex-text.txt'), 'utf8'));
    outputValid = typeof body.zh === 'string' && body.zh.length > 0 && typeof body.en === 'string' && body.en.length > 0;
    const events = (await readFile(resolve(outputDir, 'codex-events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    completed = events.some(event => event.type === 'turn.completed');
  } catch { /* Missing or invalid output is a failed probe, even with exit code 0. */ }
  const result = { startedAt, endedAt: new Date().toISOString(), code, signal, timedOut, error: spawnError, outputValid, completed };
  await writeFile(resolve(outputDir, 'codex-command-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, outputDirectory: outputDir }));
  process.exitCode = code === 0 && !timedOut && outputValid && completed ? 0 : 1;
});
