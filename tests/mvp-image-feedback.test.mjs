import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';

// Explicit local image-check evidence only; no real image, text or platform calls.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWp0AAAAASUVORK5CYII=', 'base64');
const contentInput = () => ({ name: 'EXPLICIT SYNTHETIC image feedback', projectId: null, platform: 'linkedin', language: 'en', brief: { materials: [{ id: 'facts', label: 'Synthetic source', type: 'text', text: 'SYNTHETIC planned checklist pilot.' }], purpose: 'Explain a planned pilot', audience: 'Test operators', platforms: ['linkedin'], languages: ['en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [{ id: 'feed', kind: 'linkedin_post', title: '', blocks: [{ id: 'p1', type: 'paragraph', text: 'SYNTHETIC checklist pilot; production use has not been tested.' }], postingNote: '' }], sources: [], assetIds: [], rule: null, executions: [] });
const upload = () => ({ id: 'selected-fixture', fileName: 'synthetic.png', mimeType: 'image/png', dataBase64: png.toString('base64'), source: { kind: 'upload', url: null }, caption: 'Explicit synthetic test fixture.' });
const imageRequest = (tmp, mode = 'generate') => ({ requestId: randomUUID(), tmpId: tmp.id, revision: tmp.revision, mode });
function setup(t) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-mvp-image-feedback-'));
  const db = new DatabaseSync(path.join(dataDir, 'content.sqlite'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  const calls = [], evidence = []; let transportFailure = false;
  const configuration = { content, dataDir, imageProvider: '', testOnlyRunner: () => { throw new Error('Text calls are outside this synthetic test.'); }, testOnlyImageRunner: args => {
    calls.push(args);
    if (transportFailure) { transportFailure = false; throw Object.assign(new Error('Explicit synthetic transport timeout; no image or visual findings.'), { status: 504 }); }
    const findings = [`SYNTHETIC check ${calls.length}: arrows must not imply unsupported responsibility.`, `SYNTHETIC check ${calls.length}: six and five objects must not imply conflicting counts.`];
    const directory = path.join(args.directory, 'visual-check'); mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'visual-check.json');
    const bytes = Buffer.from(JSON.stringify({ status: 'failed', findings, source: 'EXPLICIT SYNTHETIC FIXTURE; not real visual verification' }, null, 2));
    writeFileSync(file, bytes); evidence.push({ file, bytes, findings });
    throw new Error('Explicit synthetic strict visual check rejected the image.');
  } };
  let service = createGenerationService(configuration);
  t.after(async () => {
    await service.close(); db.close();
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { content, dataDir, calls, evidence, failNextTransport() { transportFailure = true; }, get service() { return service; }, async restart() { await service.close(); service = createGenerationService(configuration); } };
}
async function failImage(fixture, tmp, mode = 'generate') {
  const initial = fixture.service.image(imageRequest(tmp, mode));
  for (let attempt = 0; attempt < 500; attempt++) {
    const job = fixture.service.get(initial.id);
    if (['completed', 'failed', 'cancelled', 'interrupted'].includes(job.status)) {
      assert.equal(job.status, 'failed'); assert.equal(job.variants[0].assetStatus, 'failed'); return job;
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Synthetic image-feedback task did not finish.');
}
const persistedJob = (fixture, job) => JSON.parse(readFileSync(path.join(fixture.dataDir, 'tmp', 'generation', job.id, 'job.json')));
function assertTemporaryOnlyAndEvidencePreserved(fixture) {
  for (const item of fixture.evidence) assert.deepEqual(readFileSync(item.file), item.bytes, 'previous visual diagnostics remain byte-for-byte unchanged');
  assert.deepEqual(fixture.content.list(), []); assert.deepEqual(fixture.content.exportAll().items, []);
  for (const tmp of fixture.content.listTmp()) assert.equal(fixture.content.readTmp(tmp.id).confirmed, null);
}

test('regeneration inherits only the latest failed visual findings for the same tmp and revision, including after restart', async t => {
  const fixture = setup(t), source = fixture.content.createTmp({ content: contentInput(), uploads: [] });
  const first = await failImage(fixture, source);
  assert.deepEqual(fixture.calls[0].context.priorVisualFindings, []);
  const second = await failImage(fixture, source);
  assert.deepEqual(fixture.calls[1].context.priorVisualFindings, fixture.evidence[0].findings);
  assert.equal(persistedJob(fixture, second).previousImageJobId, first.id);
  const other = fixture.content.createTmp({ content: contentInput(), uploads: [] });
  const unrelated = await failImage(fixture, other);
  assert.equal(other.revision, source.revision);
  assert.deepEqual(fixture.calls[2].context.priorVisualFindings, [], 'a different tmp cannot inherit the previous draft diagnostics');
  assert.equal(persistedJob(fixture, unrelated).previousImageJobId, null);
  await fixture.restart();
  const retried = await failImage(fixture, source), saved = persistedJob(fixture, retried);
  assert.deepEqual(fixture.calls[3].context.priorVisualFindings, fixture.evidence[1].findings);
  assert.deepEqual(saved.priorVisualFindings, fixture.evidence[1].findings);
  assert.equal(saved.previousImageJobId, second.id, 'the newer unrelated failure and older same-draft failure are excluded');
  assert.deepEqual(fixture.content.readTmp(source.id), source);
  assert.deepEqual(fixture.content.readTmp(other.id), other);
  assert.equal(fixture.calls.length, 4); assertTemporaryOnlyAndEvidencePreserved(fixture);
});

test('a later transport timeout does not erase the latest actual visual findings for unchanged text', async t => {
  const fixture = setup(t), source = fixture.content.createTmp({ content: contentInput(), uploads: [] });
  const visualFailure = await failImage(fixture, source);
  fixture.failNextTransport();
  await failImage(fixture, source);
  await fixture.restart();
  const retry = await failImage(fixture, source);
  assert.deepEqual(fixture.calls[2].context.priorVisualFindings, fixture.evidence[0].findings);
  assert.equal(persistedJob(fixture, retry).previousImageJobId, visualFailure.id);
  assert.deepEqual(fixture.content.readTmp(source.id), source);
  assertTemporaryOnlyAndEvidencePreserved(fixture);
});

test('editing the source revision prevents inheriting visual findings from the previous text', async t => {
  const fixture = setup(t), source = fixture.content.createTmp({ content: contentInput(), uploads: [] });
  await failImage(fixture, source);
  const changed = structuredClone(source.content); changed.documents[0].blocks[0].text = 'SYNTHETIC revised pilot with a different visual scope.';
  const updated = fixture.content.updateTmp(source.id, { revision: source.revision, content: changed, temporary: source.temporary });
  assert.notEqual(updated.revision, source.revision);
  const retried = await failImage(fixture, updated), saved = persistedJob(fixture, retried);
  assert.deepEqual(fixture.calls[1].context.priorVisualFindings, []);
  assert.deepEqual(saved.priorVisualFindings, []); assert.equal(saved.previousImageJobId, null);
  assert.deepEqual(fixture.content.readTmp(source.id), updated);
  assert.equal(fixture.calls.length, 2); assertTemporaryOnlyAndEvidencePreserved(fixture);
});

test('check mode inspects the selected image without inheriting same-revision generation feedback', async t => {
  const fixture = setup(t), source = fixture.content.createTmp({ content: contentInput(), uploads: [upload()] });
  await failImage(fixture, source);
  const checked = await failImage(fixture, source, 'check'), saved = persistedJob(fixture, checked);
  assert.equal(path.basename(fixture.calls[1].directory), 'check');
  assert.deepEqual(readFileSync(fixture.calls[1].file), png);
  assert.deepEqual(fixture.calls[1].context.priorVisualFindings, []);
  assert.deepEqual(saved.priorVisualFindings, []); assert.equal(saved.previousImageJobId, null);
  assert.equal(saved.imageMode, 'check');
  assert.deepEqual(fixture.content.readTmp(source.id), source);
  assert.equal(fixture.calls.length, 2); assertTemporaryOnlyAndEvidencePreserved(fixture);
});
