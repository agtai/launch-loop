import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createGenerationService } from '../server/generation-service.mjs';
import { serveGeneration } from '../server/generation-http.mjs';

// No model, account, image or network calls: only explicitly injected probes.
function setup(t, probe, imageProvider = 'codex-cache') {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-image-capability-'));
  const service = createGenerationService({ dataDir, content: {}, imageProvider, testOnlyImageProbe: probe, testOnlyRunner() { throw Error('No model calls allowed'); } });
  t.after(async () => { await service.close(); assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(dataDir, { recursive: true, force: true }); });
  return service;
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('a failed startup probe stays stopped until explicit refresh; concurrent requests share one check without creating jobs', async t => {
  let calls = 0; const second = deferred();
  const service = setup(t, () => ++calls === 1 ? { available: false, code: 'probe_timeout' } : second.promise);
  await service.refreshImageCapability();
  assert.equal(calls, 1);
  assert.deepEqual(service.capabilities().image, { status: 'unconnected', message: '配图能力探测暂时超时，可重新检查入口。', checking: false, canRefresh: true });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1);
  const pending = service.refreshImageCapability();
  assert.equal(service.refreshImageCapability(), pending);
  assert.equal(service.capabilities().image.checking, true);
  second.resolve({ available: true }); await pending;
  assert.equal(calls, 2); assert.equal(service.capabilities().image.status, 'available');
  assert.equal(service.capabilities().image.checking, false); assert.deepEqual(service.list(), []);
});

test('shutdown cancels the capability check and refuses its late success', async t => {
  const pending = deferred(); let signal;
  const service = setup(t, args => { signal = args.signal; return pending.promise; });
  await new Promise(resolve => setImmediate(resolve));
  const closing = service.close(); assert.equal(signal.aborted, true);
  pending.resolve({ available: true }); await closing;
  assert.equal(service.capabilities().image.status, 'unconnected');
  assert.equal(service.capabilities().image.canRefresh, false);
  assert.throws(() => service.refreshImageCapability(), error => error.status === 503);
});

test('disabled image provider cannot be activated through the recheck endpoint', async t => {
  let calls = 0; const service = setup(t, () => { calls++; }, '');
  assert.equal(service.capabilities().image.canRefresh, false);
  await assert.rejects(serveGeneration({ method: 'POST' }, {}, '/api/generation/capabilities/image/refresh', service, { readBody: async () => ({}), json() {} }), error => error.status === 409);
  assert.equal(calls, 0);
});

test('recheck HTTP responds with checking immediately; GET cannot start a probe and exceptions are contained', async t => {
  const pending = deferred(); let calls = 0;
  const service = setup(t, () => { calls++; if (calls === 1) return { available: false }; if (calls === 2) return pending.promise; throw Error('private path / account diagnostics'); });
  await service.refreshImageCapability(); let response;
  const context = { readBody: async () => ({}), json(_res, status, body) { response = { status, body }; } };
  await serveGeneration({ method: 'GET' }, {}, '/api/generation/capabilities', service, context);
  assert.equal(calls, 1);
  await serveGeneration({ method: 'POST' }, {}, '/api/generation/capabilities/image/refresh', service, context);
  assert.equal(response.status, 202); assert.equal(response.body.image.checking, true);
  pending.resolve({}); await service.refreshImageCapability();
  assert.equal(service.capabilities().image.status, 'unconnected', 'missing success is not success');
  await service.refreshImageCapability();
  assert.equal(service.capabilities().image.message, '后台 Codex 配图入口检查失败，可重新检查入口。');
  assert.deepEqual(service.list(), []);
});
