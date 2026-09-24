// No model or network. Exercises exact stdin, completion events and owned descendants.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [output, mode, marker] = process.argv.slice(2);
if (mode === 'descendant') {
  writeFileSync(marker + '.ready', String(process.pid));
  setInterval(() => appendFileSync(marker, 'x'), 40);
} else if (mode === 'hang') {
  spawn(process.execPath, [fileURLToPath(import.meta.url), output, 'descendant', marker + '.child'], { shell: false, windowsHide: true, stdio: 'ignore' });
  writeFileSync(marker + '.ready', String(process.pid));
  setInterval(() => appendFileSync(marker, 'x'), 40);
} else {
  const actual = readFileSync(0, 'utf8');
  if (mode === 'warning') {
    console.log(JSON.stringify({ type: 'error', message: 'Reconnecting... 2/5 (synthetic retry)' }));
    console.log(JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'Falling back from WebSockets to HTTPS transport. Synthetic warning.' } }));
  }
  if (mode === 'invalid') writeFileSync(output, 'not JSON');
  else writeFileSync(output, JSON.stringify({ actual }));
  console.log(JSON.stringify({ type: 'item.completed', item: { type: mode === 'tool' ? 'command_execution' : 'agent_message', text: 'synthetic result' } }));
  if (mode !== 'missing-event') console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } }));
}
