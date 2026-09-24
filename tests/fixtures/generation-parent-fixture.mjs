import path from 'node:path';
import { runCodex } from '../../server/generation-runner.mjs';
import { fileURLToPath } from 'node:url';
const [directory, marker] = process.argv.slice(2);
await runCodex({ directory, prompt: 'Synthetic crash test', schema: {}, timeoutMs: 20000,
  testOnlyCommand: { executable: process.execPath, args: ({ outputPath }) => [path.join(path.dirname(fileURLToPath(import.meta.url)), 'generation-fake-cli.mjs'), outputPath, 'hang', marker] } });
