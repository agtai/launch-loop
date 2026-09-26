import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createContentStore } from '../server/content-store.mjs';
import { createXImageService } from '../server/x-image-service.mjs';
import { buildImageBrief, checkImage } from '../server/image-runner.mjs';
import { inspectXImage } from '../server/x-images.mjs';
import { ContentError } from '../server/content-validation.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=', 'base64');
const info = inspectXImage(png, 'image/png');
const env = { LAUNCH_LOOP_IMAGE_PROVIDER: 'codex-cache' };
const draft = () => ({ name: 'Synthetic X images', projectId: null, platform: 'x', language: 'en', brief: { materials: [{ id: 's', type: 'text', label: 'Synthetic', text: 'SOURCE_SENTINEL' }], purpose: 'Explain', audience: 'Test runner', platforms: ['x'], languages: ['en'], formats: ['short_post', 'thread'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [{ id: 'post', kind: 'post', title: '', postingNote: '', blocks: [{ id: 'p1', type: 'x_post', text: 'BODY_SENTINEL', assetIds: [] }] }, { id: 'thread', kind: 'thread', title: '', postingNote: '', blocks: [1, 2].map(n => ({ id: `t${n}`, type: 'x_post', text: `THREAD ${n}`, assetIds: [] })) }], sources: [], assetIds: [], rule: null, executions: [] });
const completed = request => ({ status: 'ready', bytes: png, ...info, bodyHash: request.bodyHash, visualCheck: { status: 'passed', checkedAt: new Date().toISOString(), observed: 'A synthetic test pixel.', findings: [], imageHash: info.sha256, bodyHash: request.bodyHash, method: 'codex-image-input' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup(t, options = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-x-images-')), db = new DatabaseSync(path.join(dataDir, 'test.db'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  const service = createXImageService({ content, dataDir, env, testOnlyGenerate: async request => completed(request), testOnlyCheck: async request => completed(request), testOnlyProbe: async () => ({ available: true, status: 'ready', reason: 'SYNTHETIC probe' }), ...options });
  t.after(async () => { await service.close(); db.close(); assert.ok(dataDir.startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(dataDir, { recursive: true, force: true }); });
  return { service, content, dataDir, db, tmp: content.createTmp({ content: draft() }) };
}
const request = (tmp, overrides = {}) => ({ requestId: 'request-1', tmpId: tmp.id, revision: tmp.revision, documentId: 'post', ...overrides });

test('X background images attach checked bytes only to selected object and keep all text temporary', async t => {
  let calls = 0;
  const { service, content, tmp, db } = setup(t, { testOnlyGenerate: async r => { calls++; assert.equal(r.context.platform, 'x'); assert.equal(r.documents.length, 1); assert.equal(r.documents[0].id, 'post'); return completed(r); } });
  const job = service.create(request(tmp)); assert.equal(service.create(request(tmp)).id, job.id);
  const done = await service.wait(job.id), updated = content.readTmp(tmp.id);
  assert.equal(done.status, 'ready'); assert.equal(calls, 1); assert.equal(updated.confirmed, null);
  assert.deepEqual(updated.content.documents[1], tmp.content.documents[1]);
  assert.equal(updated.content.documents[0].blocks[0].text, 'BODY_SENTINEL');
  assert.equal(updated.content.documents[0].blocks[0].image.visualMethod, 'codex-image-input');
  assert.equal(updated.content.documents[0].blocks[0].image.status, 'generated');
  assert.equal(updated.assets[0].source.kind, 'generated');
  assert.equal(db.prepare('SELECT count(*) AS n FROM content_versions').get().n, 0);
  assert.throws(() => service.create(request(tmp, { documentId: 'thread' })), /编号/);
});

test('X image check reuses actual selected upload and never generates or changes another object', async t => {
  const { service, content, tmp } = setup(t, { testOnlyGenerate: async () => { throw Error('No generation permitted'); } });
  const uploaded = content.upload(tmp.id, { revision: tmp.revision, fileName: 'synthetic.png', mimeType: 'image/png', dataBase64: png.toString('base64'), source: { kind: 'upload', url: null }, caption: '' });
  const next = structuredClone(uploaded.item.content); next.documents[1].blocks[0].assetIds = [uploaded.asset.id];
  const selected = content.updateTmp(tmp.id, { revision: uploaded.item.revision, content: next, temporary: tmp.temporary });
  const done = await service.wait(service.create(request(selected, { documentId: 'thread', mode: 'check' })).id);
  assert.equal(done.status, 'ready'); const updated = content.readTmp(tmp.id);
  assert.equal(updated.assets.length, 1); assert.equal(updated.assets[0].source.kind, 'upload');
  assert.equal(updated.content.documents[1].blocks[0].image.status, 'uploaded');
  assert.deepEqual(updated.content.documents[0], tmp.content.documents[0]);
});

test('X failed visual check, unknown output and wrong byte hash cannot attach an image', async t => {
  for (const problem of ['failed', 'unknown', 'wrong_hash']) {
    const { service, content, tmp } = setup(t, { testOnlyGenerate: async r => {
      const result = completed(r);
      if (problem === 'failed') result.visualCheck.findings = ['Unsupported chart'];
      if (problem === 'unknown') delete result.visualCheck;
      if (problem === 'wrong_hash') result.visualCheck.imageHash = 'a'.repeat(64);
      return result;
    } });
    assert.equal((await service.wait(service.create(request(tmp)).id)).status, 'failed');
    assert.deepEqual(content.readTmp(tmp.id).content, tmp.content); assert.equal(content.readTmp(tmp.id).assets.length, 0);
  }
});

test('X image text edits, explicit no-image edits and revision changes reject late results', async t => {
  const gate = deferred(), started = deferred();
  const { service, content, tmp } = setup(t, { testOnlyGenerate: async r => { started.resolve(); await gate.promise; return completed(r); } });
  const job = service.create(request(tmp)); await started.promise;
  const next = structuredClone(tmp.content); next.documents[0].blocks[0].text += ' Changed';
  content.updateTmp(tmp.id, { revision: tmp.revision, content: next, temporary: tmp.temporary });
  gate.resolve(); const done = await service.wait(job.id);
  assert.equal(done.status, 'failed'); assert.match(done.error, /迟到/); assert.equal(content.readTmp(tmp.id).assets.length, 0);
  assert.equal(content.readTmp(tmp.id).content.documents[0].blocks[0].text, 'BODY_SENTINEL Changed');
});

test('X image cancellation stops attaching late bytes and duplicate concurrent jobs are rejected', async t => {
  const gate = deferred(), started = deferred();
  const { service, content, tmp } = setup(t, { testOnlyGenerate: async r => { started.resolve(); await gate.promise; return completed(r); } });
  const job = service.create(request(tmp)); await started.promise;
  assert.throws(() => service.create(request(tmp, { requestId: 'second', documentId: 'thread' })), error => error.status === 409);
  assert.equal(service.cancel(job.id).status, 'cancelled'); gate.resolve();
  assert.equal((await service.wait(job.id)).status, 'cancelled'); assert.equal(content.readTmp(tmp.id).assets.length, 0);
});

test('X image restart marks durable unfinished jobs interrupted and never resumes them', async t => {
  const { service, content, tmp, dataDir } = setup(t);
  const job = service.create(request(tmp)); await service.wait(job.id); await service.close();
  const filename = path.join(dataDir, 'tmp', 'x-images', job.id, 'job.json'); const stored = JSON.parse(readFileSync(filename)); stored.status = 'running'; stored.stage = 'generating'; writeFileSync(filename, JSON.stringify(stored));
  let calls = 0;
  const restarted = createXImageService({ content, dataDir, env, testOnlyGenerate: async () => { calls++; throw Error('Must not run'); } });
  assert.equal(restarted.get(job.id).status, 'interrupted'); assert.equal(calls, 0); await restarted.close();
});

test('X capability checks are explicit, coalesced and blocked when provider is disabled', async t => {
  const gate = deferred(); let calls = 0;
  const { service } = setup(t, { testOnlyProbe: async () => { calls++; await gate.promise; return { available: true, status: 'ready' }; } });
  assert.equal(calls, 0); assert.equal(service.capabilities().status, 'unknown');
  const first = service.refreshCapability(), second = service.refreshCapability(); assert.equal(calls, 1); assert.equal(service.capabilities().checking, true);
  gate.resolve(); await Promise.all([first, second]); assert.equal(service.capabilities().available, true);
  const disabled = setup(t, { env: {}, testOnlyProbe: async () => { throw Error('No real probe'); } });
  await assert.rejects(disabled.service.refreshCapability(), error => error.status === 409);
  assert.throws(() => disabled.service.create(request(disabled.tmp)), error => error.status === 503);
});

test('X retry inherits only same document/revision failed visual findings, across intervening network failures', async t => {
  let calls = 0;
  const { service, content, tmp } = setup(t, { testOnlyGenerate: async r => {
    calls++;
    if (calls === 1) { const dir = path.join(r.directory, 'visual-check'); mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, 'visual-check.json'), JSON.stringify({ status: 'failed', bodyHash: r.bodyHash, findings: ['Arrow points to the wrong option.'] })); throw new ContentError(502, '配图视觉检查未通过。'); }
    if (calls === 2) throw new ContentError(502, 'Network interrupted');
    assert.deepEqual(r.context.priorVisualFindings, ['Arrow points to the wrong option.']); return completed(r);
  } });
  for (let i = 1; i <= 3; i++) await service.wait(service.create(request(content.readTmp(tmp.id), { requestId: `retry-${i}` })).id);
  assert.equal(service.list({ tmpId: tmp.id })[0].status, 'ready');
});

test('X shared runner brief is platform-specific and actual visual check receives an immutable image', async t => {
  const { tmp, dataDir } = setup(t);
  const documents = [tmp.content.documents[0]], context = { platform: 'x', language: 'en', purpose: 'Explain', audience: 'Readers' };
  const brief = buildImageBrief({ documents, context }); assert.match(brief, /supplied X content object/); assert.doesNotMatch(brief, /LinkedIn/);
  const file = path.join(dataDir, 'test.png'); writeFileSync(file, png);
  const { createHash } = await import('node:crypto'); const bodyHash = createHash('sha256').update(JSON.stringify(documents)).digest('hex');
  const result = await checkImage({ directory: path.join(dataDir, 'vision'), documents, bodyHash, file, context, generated: true, vision: async request => { assert.equal(request.images.length, 1); assert.notEqual(request.images[0], file); assert.match(request.prompt, /mobile readability/); return { passed: true, observed: 'Synthetic pixel.', findings: [] }; } });
  assert.equal(result.visualCheck.method, 'codex-image-input'); assert.equal(result.status, 'ready');
});
