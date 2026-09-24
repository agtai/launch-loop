import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { acquireDataLease } from '../server/runtime-lease.mjs';

test('Windows data lease survives competing opens and releases after owner crash', { skip: process.platform !== 'win32' }, async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'launch-loop-lease-'));
  const code = 'const {acquireDataLease}=await import(process.argv[1]); await acquireDataLease(process.argv[2]); process.stdout.write("ready");';
  const child = spawn(process.execPath, ['--input-type=module', '-e', code, new URL('../server/runtime-lease.mjs', import.meta.url).href, directory], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { const ended = once(child, 'close'); child.kill(); await ended; }
    rmSync(directory, { recursive: true, force: true });
  });
  const ready = await Promise.race([once(child.stdout, 'data').then(([data]) => String(data)), once(child, 'close').then(([exit]) => { throw Error('Lease fixture exited: ' + exit); })]);
  assert.equal(ready, 'ready');
  await assert.rejects(acquireDataLease(directory), /已有工作台服务/);
  const ended = once(child, 'close'); child.kill(); await ended;
  const release = await acquireDataLease(directory);
  await release();
  const secondRelease = await acquireDataLease(directory);
  await secondRelease();
});
