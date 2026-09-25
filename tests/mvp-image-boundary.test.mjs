import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';
import { ContentError, documentsHash, hash } from '../server/content-validation.mjs';

// Explicit local fixtures only. The user's approved official Codex cache
// exception belongs to real integration; no official cache/model is used here.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWp0AAAAASUVORK5CYII=', 'base64');
const document = () => ({ id: 'feed', kind: 'linkedin_post', title: '', blocks: [{ id: 'p1', type: 'paragraph', text: 'SYNTHETIC checklist pilot; production use has not been tested.' }], postingNote: '' });
const contentInput = () => ({ name: 'SYNTHETIC image boundary', projectId: null, platform: 'linkedin', language: 'en', brief: { materials: [{ id: 'facts', label: 'SYNTHETIC', type: 'text', text: 'SYNTHETIC planned checklist pilot.' }], purpose: 'Explain a planned pilot', audience: 'Test operators', platforms: ['linkedin'], languages: ['en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [document()], sources: [], assetIds: [], rule: null, executions: [] });
const upload = () => ({ id: 'selected-fixture', fileName: 'synthetic.png', mimeType: 'image/png', dataBase64: png.toString('base64'), source: { kind: 'upload', url: null }, caption: 'Explicit test fixture, not actual generation.' });
const syntheticImage = args => {
  const file = path.join(args.directory, 'synthetic-output.png'); writeFileSync(file, png);
  return { status: 'ready', bytes: png, file, mimeType: 'image/png', width: 1, height: 1, sha256: hash(png), bodyHash: args.bodyHash, visualCheck: { status: 'passed', checkedAt: '2026-09-24T00:00:00.000Z', source: 'EXPLICIT SYNTHETIC FIXTURE; not visual verification' } };
};
function setup(t, runner = syntheticImage) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-mvp-image-boundary-'));
  const db = new DatabaseSync(path.join(dataDir, 'content.sqlite'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  const config = { content, dataDir, imageProvider: '', testOnlyImageRunner: runner, testOnlyRunner: () => { throw new Error('Text generation is outside this boundary test.'); } };
  let service = createGenerationService(config);
  t.after(async () => {
    await service.close(); db.close();
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { content, dataDir, db, get service() { return service; }, async restart() { await service.close(); service = createGenerationService(config); } };
}
async function finish(service, id) {
  for (let i = 0; i < 500; i++) {
    const job = service.get(id);
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(job.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Synthetic image job did not finish.');
}
const imageRequest = (tmp, mode = 'generate') => ({ requestId: randomUUID(), tmpId: tmp.id, revision: tmp.revision, mode });
test('a controlled image failure retains its actionable reason in the job, variant and asset without changing the draft', async t => {
  const reason = '后台配图连接中断，本次已停止；请检查网络后再试。';
  const f = setup(t, () => { throw new ContentError(502, reason); });
  const initial = f.content.createTmp({ content: contentInput(), uploads: [] });
  const job = await finish(f.service, f.service.image(imageRequest(initial)).id);
  assert.equal(job.status, 'failed'); assert.equal(job.error, reason);
  assert.equal(job.variants[0].error, reason); assert.equal(job.variants[0].assetError, reason);
  assert.deepEqual(f.content.readTmp(initial.id), initial); assert.deepEqual(f.content.list(), []);
});
function gate() { let enter, release; return { entered: new Promise(resolve => enter = resolve), blocked: new Promise(resolve => release = resolve), enter: () => enter(), release: () => release() }; }

test('check mode without exactly one selected image never enqueues or falls back to generation', async t => {
  let calls = 0; const f = setup(t, args => { calls++; return syntheticImage(args); });
  const empty = f.content.createTmp({ content: contentInput(), uploads: [] });
  assert.throws(() => f.service.image(imageRequest(empty, 'check')), /先选用一张/);
  let deselected = f.content.createTmp({ content: contentInput(), uploads: [upload()] });
  deselected = f.content.updateTmp(deselected.id, { revision: deselected.revision, content: { ...deselected.content, assetIds: [] }, temporary: deselected.temporary });
  assert.throws(() => f.service.image(imageRequest(deselected, 'check')), /先选用一张/);
  assert.equal(calls, 0); assert.deepEqual(f.service.list(), []);
  assert.deepEqual(f.content.readTmp(empty.id), empty); assert.deepEqual(f.content.readTmp(deselected.id), deselected);
});

test('check mode passes the selected bytes for inspection and binds the existing asset without generating a replacement', async t => {
  let calls = 0;
  const f = setup(t, args => { calls++; assert.equal(args.timeoutMs, 180000); assert.deepEqual(readFileSync(args.file), png); return syntheticImage(args); });
  const initial = f.content.createTmp({ content: contentInput(), uploads: [upload()] });
  const done = await finish(f.service, f.service.image(imageRequest(initial, 'check')).id);
  assert.equal(done.status, 'completed', done.error); assert.equal(calls, 1);
  const checked = f.content.readTmp(initial.id);
  assert.equal(checked.assets.length, 1); assert.equal(checked.assets[0].id, initial.assets[0].id);
  assert.equal(checked.assets[0].source.kind, 'upload'); assert.equal(checked.assets[0].imageBinding.documentsHash, documentsHash(checked.content.documents));
  assert.deepEqual(checked.content.documents, initial.content.documents); assert.deepEqual(f.content.list(), []);
});

test('generated image binding and bytes survive an independent backup restore; tampered body is rejected before mutation', async t => {
  const source = setup(t), destination = setup(t);
  const initial = source.content.createTmp({ content: contentInput(), uploads: [] });
  const done = await finish(source.service, source.service.image(imageRequest(initial)).id);
  assert.equal(done.status, 'completed', done.error);
  const generated = source.content.readTmp(initial.id);
  const saved = source.content.confirm(generated.id, { revision: generated.revision, confirmed: true }); // Synthetic user confirmation only.
  const backup = source.content.exportAll();
  const prepared = destination.content.validateBackup(backup);
  destination.db.exec('BEGIN IMMEDIATE');
  try { destination.content.restore(prepared); destination.db.exec('COMMIT'); } catch (cause) { destination.db.exec('ROLLBACK'); throw cause; }
  const restored = destination.content.version(saved.item.id, saved.version.id), asset = restored.assets[0];
  assert.equal(asset.source.kind, 'generated'); assert.deepEqual(asset.imageBinding, generated.assets[0].imageBinding);
  assert.equal(asset.imageBinding.documentsHash, documentsHash(restored.content.documents));
  assert.deepEqual(destination.content.getAsset(saved.item.id, saved.version.id, asset.id).bytes, png);
  const before = destination.content.exportAll(), tampered = structuredClone(backup);
  tampered.items[0].versions[0].content.documents[0].blocks[0].text = 'SYNTHETIC altered body after image checking.';
  assert.throws(() => destination.content.validateBackup(tampered), /配图与对应正文版本不一致/);
  assert.deepEqual(destination.content.exportAll(), before);
  const revision = destination.content.revise(saved.item.id, { revision: destination.content.item(saved.item.id).revision });
  const changed = destination.content.updateTmp(revision.id, { revision: revision.revision, content: { ...revision.content, documents: tampered.items[0].versions[0].content.documents }, temporary: revision.temporary });
  assert.throws(() => destination.content.confirm(changed.id, { revision: changed.revision, confirmed: true }), /配图需要更新/);
  assert.deepEqual(destination.content.exportAll(), before);
});

test('cancelled standalone image task rejects a late successful adapter result without attaching bytes', async t => {
  const held = gate(); let signal;
  const f = setup(t, async args => { signal = args.signal; held.enter(); await held.blocked; return syntheticImage(args); });
  const initial = f.content.createTmp({ content: contentInput(), uploads: [] });
  const created = f.service.image(imageRequest(initial)); await held.entered;
  try { f.service.cancel(created.id); assert.equal(signal.aborted, true); } finally { held.release(); }
  const done = await finish(f.service, created.id);
  assert.equal(done.status, 'cancelled'); assert.equal(done.variants[0].assetStatus, 'cancelled');
  assert.deepEqual(f.content.readTmp(initial.id), initial); assert.deepEqual(f.content.list(), []);
});

test('shutdown and restart do not attach or replay a late image; persisted in-flight image jobs become interrupted', async t => {
  const held = gate(); let calls = 0;
  const f = setup(t, async args => { calls++; held.enter(); await held.blocked; return syntheticImage(args); });
  const initial = f.content.createTmp({ content: contentInput(), uploads: [] });
  const created = f.service.image(imageRequest(initial)); await held.entered;
  const jobFile = path.join(f.dataDir, 'tmp/generation', created.id, 'job.json');
  const inFlight = readFileSync(jobFile); // Crash-recovery fixture, captured before interruption.
  const closing = f.service.close(); held.release(); await closing;
  assert.equal(f.service.get(created.id).status, 'interrupted'); assert.equal(f.service.get(created.id).variants[0].assetStatus, 'interrupted'); assert.deepEqual(f.content.readTmp(initial.id), initial);
  writeFileSync(jobFile, inFlight);
  await f.restart();
  const recovered = f.service.get(created.id);
  assert.equal(recovered.status, 'interrupted'); assert.equal(recovered.variants[0].status, 'interrupted');
  assert.equal(recovered.variants[0].assetStatus, 'interrupted');
  assert.equal(calls, 1); assert.deepEqual(f.content.readTmp(initial.id), initial);
  assert.deepEqual(f.content.list(), []);
});
