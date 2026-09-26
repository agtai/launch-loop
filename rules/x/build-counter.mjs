import { build } from 'rolldown';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(path.join(root, 'node_modules/twitter-text/package.json'), 'utf8'));
if (pkg.version !== '3.1.0') throw Error('Counter rebuild requires twitter-text exactly 3.1.0.');
const licenses = [
  ['twitter-text', 'LICENSE'], ['twemoji-parser', 'LICENSE.md'], ['punycode', 'LICENSE-MIT.txt'],
  ['@babel/runtime', 'LICENSE'], ['core-js', 'LICENSE'],
].map(([name, file]) => `${name}\n${readFileSync(path.join(root, 'node_modules', name, file), 'utf8')}`).join('\n\n');
writeFileSync(path.join(root, 'rules/x/COUNTER-LICENSES.txt'), licenses);
await build({
  input: path.join(root, 'rules/x/counter-entry.mjs'),
  platform: 'browser',
  output: { file: path.join(root, 'server/x-text-vendor.mjs'), format: 'es', minify: false,
    banner: '/* Generated distribution of twitter-text 3.1.0 parseTweet and dependencies.\n * Bundled for Launch Loop (2026-09-24); counting algorithm unchanged.\n * Copyright Twitter, Inc.; Apache-2.0. Dependency notices: rules/x/COUNTER-LICENSES.txt.\n * Rebuild: node rules/x/build-counter.mjs (after npm ci). */' },
});
