import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';
import { hash, documentsHash } from '../server/content-validation.mjs';
import { fixtureContext, textV2Fixture } from './fixtures/text-v2-fixture.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWp0AAAAASUVORK5CYII=', 'base64');
const request = () => ({ requestId: randomUUID(), name: 'EXPLICIT SYNTHETIC MVP', brief: { ...fixtureContext().brief, materials: [{ id: 'source1', label: 'Explicit synthetic pilot source', type: 'text', text: fixtureContext().actualSources[0].text }], platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'], references: [] }, uploads: [], options: { styles: ['plain'], depths: ['brief'] } });
function setup(t, overrides = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-mvp-generation-'));
  const db = new DatabaseSync(path.join(dataDir, 'content.sqlite'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  const configuration = { content, dataDir, testOnlyRunner: textV2Fixture, imageProvider: '', ...overrides };
  let service = createGenerationService(configuration);
  t.after(async () => { await service.close(); db.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { content, dataDir, db, get service() { return service; }, async restart() { await service.close(); service = createGenerationService(configuration); } };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function finish(service, id) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const job = service.get(id);
    if (['completed', 'failed', 'cancelled', 'interrupted', 'needs_evidence', 'needs_resolution'].includes(job.status)) return job;
    await sleep(5);
  }
  throw new Error('Explicit synthetic v2 job did not finish.');
}
function gate() { let release, entered; return { blocked: new Promise(resolve => release = resolve), entered: new Promise(resolve => entered = resolve), release: () => release(), enter: () => entered() }; }
const imageResult = request => {
  const file = path.join(request.directory, 'synthetic-one-pixel.png'); writeFileSync(file, png);
  return { status: 'ready', bytes: png, file, mimeType: 'image/png', width: 1, height: 1, sha256: hash(png), bodyHash: request.bodyHash, visualCheck: { status: 'passed', checkedAt: new Date().toISOString(), source: 'explicit synthetic fixture; no model verification' } };
};

test('default service uses v2, persists the shared lineage and frozen barrier, and keeps all unconfirmed data outside formal storage', async t => {
  const calls = []; let fixture;
  fixture = setup(t, { testOnlyRunner: async args => {
    calls.push(args);
    if (args.stage === 'review') {
      const saved = fixture.content.listTmp();
      assert.equal(saved.length, 2);
      for (const item of saved) assert(fixture.content.readTmp(item.id).temporary.initialDocuments.length === 1);
    }
    if (args.stage === 'revision') assert.equal(calls.filter(call => call.stage === 'review').length, 2);
    return textV2Fixture(args);
  } });
  const raw = request();
  raw.uploads = [{ id: 'actual-source', fileName: 'synthetic-source.md', mimeType: 'text/plain', dataBase64: Buffer.from(fixtureContext().actualSources[0].text).toString('base64'), source: { kind: 'upload', url: null }, caption: '' }];
  raw.brief.materials = [{ id: 'source1', label: 'Actual synthetic file', type: 'asset', assetId: 'actual-source' }];
  const created = fixture.service.create(raw), done = await finish(fixture.service, created.id);
  assert.equal(done.status, 'completed', done.error);
  assert.deepEqual(calls.map(call => call.stage), ['mother', 'platform', 'localization', 'review', 'review', 'revision', 'revision']);
  for (const variant of done.variants) {
    const tmp = fixture.content.readTmp(variant.tmpId);
    assert.equal(tmp.content.rule.ruleSetVersion, 'text-v2.0.0');
    assert.equal(tmp.content.executions.filter(run => run.stage === 'review').length, 1);
    assert.equal(tmp.temporary.initialDocuments.length, 1);
    assert.equal(JSON.parse(tmp.temporary.reviewFindings).auditCount, 1);
    assert.equal(variant.assetStatus, 'unconnected'); assert.equal(tmp.confirmed, null);
  }
  const directory = path.join(fixture.dataDir, 'tmp', 'generation', done.id);
  const saved = JSON.parse(readFileSync(path.join(directory, 'job.json')));
  assert.equal(saved.pipelineResult.sourceLanguage, 'en');
  assert.equal(saved.pipelineResult.claimLedger[0].evidenceRefs[0].sourceId, 'source1');
  assert(saved.pipelineResult.editorialPlan.readerTakeaway);
  const artifacts = readdirSync(directory).filter(name => name.startsWith('artifact-')).map(name => JSON.parse(readFileSync(path.join(directory, name))));
  assert.equal(artifacts.filter(artifact => artifact.stage === 'mother').length, 1);
  assert.equal(artifacts.filter(artifact => artifact.stage === 'platform').length, 1);
  assert.equal(artifacts.filter(artifact => artifact.stage === 'review').length, 2);
  assert.deepEqual(fixture.content.list(), []); assert.deepEqual(fixture.content.exportAll().items, []);
  assert(!readFileSync(path.join(fixture.dataDir, 'content.sqlite')).includes(Buffer.from('workshop checklist')));
});

test('v2 idempotency and exact rule snapshots survive restart without model re-execution', async t => {
  let calls = 0;
  const fixture = setup(t, { testOnlyRunner: args => { calls++; return textV2Fixture(args); } });
  const raw = request(), created = fixture.service.create(raw);
  assert.equal(fixture.service.create(raw).id, created.id);
  const done = await finish(fixture.service, created.id); assert.equal(done.status, 'completed', done.error);
  const before = done.variants.map(variant => fixture.content.readTmp(variant.tmpId));
  await fixture.restart();
  assert.equal(fixture.service.create(raw).id, created.id); assert.equal(calls, 7);
  assert.deepEqual(done.variants.map(variant => fixture.content.readTmp(variant.tmpId)), before);
  assert.throws(() => fixture.service.create({ ...raw, name: 'changed' }), /requestId/);
});

for (const status of ['needs_evidence', 'needs_resolution']) test(`service exposes ${status} as terminal without fake drafts or review`, async t => {
  const calls = [];
  const fixture = setup(t, { testOnlyRunner: async args => {
    calls.push(args.stage); const value = await textV2Fixture(args);
    if (args.stage === 'mother') { value.status = status; value.blocks = []; value.unresolved = ['Explicit synthetic blocked condition.']; }
    return value;
  } });
  const done = await finish(fixture.service, fixture.service.create(request()).id);
  assert.equal(done.status, status, done.error); assert.deepEqual(calls, ['mother']);
  for (const variant of done.variants) { const tmp = fixture.content.readTmp(variant.tmpId); assert.deepEqual(tmp.content.documents, []); assert.deepEqual(tmp.content.executions, []); }
  await fixture.restart(); assert.equal(fixture.service.get(done.id).status, status);
});

test('v2 cancellation rejects delayed mother results and leaves the initial tmp untouched', async t => {
  const held = gate(), calls = [];
  const fixture = setup(t, { testOnlyRunner: async args => { calls.push(args.stage); if (args.stage === 'mother') { held.enter(); await held.blocked; } return textV2Fixture(args); } });
  const created = fixture.service.create(request()); await held.entered;
  fixture.service.cancel(created.id); held.release();
  const done = await finish(fixture.service, created.id); assert.equal(done.status, 'cancelled'); assert.deepEqual(calls, ['mother']);
  for (const variant of done.variants) assert.deepEqual(fixture.content.readTmp(variant.tmpId).content.documents, []);
  assert(!readdirSync(path.join(fixture.dataDir, 'tmp', 'generation', created.id)).some(name => name === 'linkedin-zh-platform'));
});

test('editing a frozen variant during review prevents late revision from replacing user text', async t => {
  const held = gate();
  const fixture = setup(t, { testOnlyRunner: async args => { if (args.stage === 'review') { held.enter(); await held.blocked; } return textV2Fixture(args); } });
  const created = fixture.service.create(request()); await held.entered;
  const tmp = fixture.content.readTmp(created.variants[0].tmpId), changed = structuredClone(tmp.content);
  changed.documents[0].blocks[0].text = 'Explicit synthetic manual change.';
  fixture.content.updateTmp(tmp.id, { revision: tmp.revision, content: changed, temporary: tmp.temporary }); held.release();
  const done = await finish(fixture.service, created.id);
  assert.equal(done.status, 'failed'); assert.match(done.error, /源稿已修改/);
  assert.equal(fixture.content.readTmp(tmp.id).content.documents[0].blocks[0].text, 'Explicit synthetic manual change.');
});

test('editing either requested variant during the shared mother stops before more paid stages', async t => {
  const held = gate(), calls = [];
  const fixture = setup(t, { testOnlyRunner: async args => { calls.push(args.stage); if (args.stage === 'mother') { held.enter(); await held.blocked; } return textV2Fixture(args); } });
  const created = fixture.service.create(request()); await held.entered;
  const tmp = fixture.content.readTmp(created.variants[1].tmpId);
  fixture.content.updateTmp(tmp.id, { revision: tmp.revision, content: { ...tmp.content, name: 'Synthetic user-edited second variant' }, temporary: tmp.temporary });
  held.release(); const done = await finish(fixture.service, created.id);
  assert.equal(done.status, 'failed'); assert.deepEqual(calls, ['mother']);
  assert.equal(fixture.content.readTmp(tmp.id).content.name, 'Synthetic user-edited second variant');
});

test('restart interrupts persisted in-flight v2 work and does not replay a completed audit', async t => {
  let calls = 0; const fixture = setup(t, { testOnlyRunner: args => { calls++; return textV2Fixture(args); } });
  const done = await finish(fixture.service, fixture.service.create(request()).id); assert.equal(done.status, 'completed', done.error);
  const file = path.join(fixture.dataDir, 'tmp', 'generation', done.id, 'job.json');
  const saved = JSON.parse(readFileSync(file));
  saved.job.status = 'running'; saved.job.stage = 'revising'; saved.job.variants[1].status = 'running'; saved.job.variants[1].stage = 'revising';
  await fixture.service.close(); writeFileSync(file, JSON.stringify(saved)); await fixture.restart();
  assert.equal(fixture.service.get(done.id).status, 'interrupted'); assert.equal(calls, 7);
  for (const variant of done.variants) assert.equal(fixture.content.readTmp(variant.tmpId).content.executions.filter(run => run.stage === 'review').length, 1);
});

test('explicit synthetic image bytes attach once per variant with body hashes and never enter formal content', async t => {
  let imageCalls = 0;
  const fixture = setup(t, { testOnlyImageRunner: async args => { imageCalls++; assert.equal(args.documents.length, 2); assert.equal(args.context.imageBrief.length, 2); return imageResult(args); } });
  const done = await finish(fixture.service, fixture.service.create(request()).id); assert.equal(done.status, 'completed', done.error); assert.equal(imageCalls, 1);
  for (const variant of done.variants) {
    assert.equal(variant.assetStatus, 'ready', variant.assetError);
    const tmp = fixture.content.readTmp(variant.tmpId), asset = tmp.assets.find(asset => asset.source.kind === 'generated');
    assert(asset); assert.equal(asset.imageBinding.documentsHash, documentsHash(tmp.content.documents));
    assert.equal(asset.sha256, hash(png)); assert.deepEqual(fixture.content.getTmpAsset(tmp.id, asset.id).bytes, png);
  }
  assert.deepEqual(fixture.content.list(), []);
});

for (const defect of ['throws', 'body_hash', 'visual_check', 'bytes_hash']) test(`image ${defect} failure preserves both completed text drafts and reports failure`, async t => {
  const fixture = setup(t, { testOnlyImageRunner: async args => {
    if (defect === 'throws') throw new Error('explicit synthetic image failure');
    const result = imageResult(args);
    if (defect === 'body_hash') result.bodyHash = hash('stale body');
    if (defect === 'visual_check') result.visualCheck.status = 'failed';
    if (defect === 'bytes_hash') result.sha256 = hash('wrong image');
    return result;
  } });
  const done = await finish(fixture.service, fixture.service.create(request()).id); assert.equal(done.status, 'completed', done.error);
  for (const variant of done.variants) {
    assert.equal(variant.assetStatus, 'failed'); assert(variant.assetError);
    const tmp = fixture.content.readTmp(variant.tmpId); assert.equal(tmp.content.documents.length, 1); assert.equal(tmp.assets.filter(asset => asset.source.kind === 'generated').length, 0);
    assert.equal(tmp.content.executions.filter(run => run.stage === 'review').length, 1);
  }
});

test('manual edits during image generation prevent attaching a late image to the changed text', async t => {
  const held = gate();
  const fixture = setup(t, { testOnlyImageRunner: async args => { held.enter(); await held.blocked; return imageResult(args); } });
  const created = fixture.service.create(request()); await held.entered;
  const tmp = fixture.content.readTmp(created.variants[0].tmpId), changed = structuredClone(tmp.content); changed.documents[0].blocks[0].text = 'Edited while the image fixture was running.';
  fixture.content.updateTmp(tmp.id, { revision: tmp.revision, content: changed, temporary: tmp.temporary }); held.release();
  const done = await finish(fixture.service, created.id); assert.equal(done.status, 'completed', done.error);
  assert.equal(done.variants[0].assetStatus, 'failed'); assert.equal(fixture.content.readTmp(tmp.id).assets.length, 0);
  assert.equal(fixture.content.readTmp(tmp.id).content.documents[0].blocks[0].text, changed.documents[0].blocks[0].text);
});
