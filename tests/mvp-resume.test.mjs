import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';
import { fixtureContext, textV2Fixture } from './fixtures/text-v2-fixture.mjs';

// Explicit synthetic models only. No real materials, model calls or publishing.
const request = () => ({ requestId: randomUUID(), name: 'EXPLICIT SYNTHETIC MOTHER RESUME', brief: { ...fixtureContext().brief, materials: [{ id: 'source1', label: 'Explicit synthetic pilot source', type: 'text', text: fixtureContext().actualSources[0].text }], platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'], references: [] }, uploads: [], options: { styles: ['plain'], depths: ['brief'] } });
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'needs_evidence', 'needs_resolution']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function finish(service, id) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const job = service.get(id);
    if (terminal.has(job.status)) return job;
    await sleep(5);
  }
  throw new Error('Explicit synthetic mother-resume job did not finish.');
}
function gate() { let release, enter; return { blocked: new Promise(resolve => { release = resolve; }), entered: new Promise(resolve => { enter = resolve; }), release: () => release(), enter: () => enter() }; }
function setup(t, runner, beforeClose = () => {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-mvp-resume-'));
  const db = new DatabaseSync(path.join(dataDir, 'content.sqlite'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  const configuration = { content, dataDir, testOnlyRunner: runner, imageProvider: '' };
  let service = createGenerationService(configuration);
  t.after(async () => {
    beforeClose(); await service.close(); db.close();
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { content, dataDir, get service() { return service; }, async restart() { await service.close(); service = createGenerationService(configuration); } };
}
function artifacts(fixture, id) {
  const directory = path.join(fixture.dataDir, 'tmp', 'generation', id);
  return readdirSync(directory).filter(name => /^artifact-[a-f0-9]{64}\.json$/.test(name)).map(name => {
    const bytes = readFileSync(path.join(directory, name));
    return { name, bytes, value: JSON.parse(bytes) };
  });
}
function assertTemporaryOnly(fixture, job) {
  assert.deepEqual(fixture.content.list(), []);
  assert.deepEqual(fixture.content.exportAll().items, []);
  for (const variant of job.variants) assert.equal(fixture.content.readTmp(variant.tmpId).confirmed, null);
}
const conflict = error => error.status === 409;

test('one platform recovery reuses original mother artifacts, deduplicates clicks, and audits each language once', { timeout: 10000 }, async t => {
  const held = gate(), calls = []; let platforms = 0;
  const fixture = setup(t, async args => {
    calls.push(args);
    if (args.stage === 'platform') {
      if (++platforms === 1) throw new Error('Explicit synthetic first platform failure.');
      held.enter(); await held.blocked;
    }
    return textV2Fixture(args);
  }, held.release);
  const initial = fixture.service.create(request()), failed = await finish(fixture.service, initial.id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.canResumeMother, true);
  assert.deepEqual(calls.map(call => call.stage), ['mother', 'platform']);
  const original = artifacts(fixture, failed.id).filter(artifact => ['intake', 'mother'].includes(artifact.value.stage));
  assert.equal(original.length, 2);
  for (const variant of failed.variants) assert.deepEqual(fixture.content.readTmp(variant.tmpId).temporary.initialDocuments, []);

  const resumed = fixture.service.resumeMother(failed.id);
  assert.equal(resumed.id, initial.id);
  assert.equal(fixture.service.resumeMother(failed.id).id, initial.id, 'duplicate while queued returns the same job');
  await held.entered;
  assert.equal(fixture.service.get(failed.id).status, 'running');
  assert.equal(fixture.service.resumeMother(failed.id).id, initial.id, 'duplicate while running returns the same job');
  held.release();
  const done = await finish(fixture.service, initial.id);
  assert.equal(done.status, 'completed', done.error);
  assert.equal(done.id, initial.id); assert.equal(done.canResumeMother, false);
  assert.equal(fixture.service.list().length, 1);
  assert.deepEqual(calls.map(call => call.stage), ['mother', 'platform', 'platform', 'localization', 'review', 'review', 'revision', 'revision']);
  assert.equal(calls.filter(call => call.stage === 'mother').length, 1);
  for (const call of calls.slice(2)) assert.match(path.basename(call.directory), /-resume-1$/);
  for (const language of ['zh', 'en']) {
    assert.equal(calls.filter(call => call.stage === 'review' && call.payload.language === language).length, 1);
    const variant = done.variants.find(variant => variant.language === language), tmp = fixture.content.readTmp(variant.tmpId);
    assert.equal(tmp.content.executions.filter(execution => execution.stage === 'review').length, 1);
    assert.equal(JSON.parse(tmp.temporary.reviewFindings).auditCount, 1);
  }
  const after = artifacts(fixture, initial.id);
  for (const before of original) {
    const matching = after.filter(artifact => artifact.value.stage === before.value.stage);
    assert.equal(matching.length, 1); assert.equal(matching[0].name, before.name);
    assert.deepEqual(matching[0].bytes, before.bytes, 'original intake and mother are reused without changing their evidence');
  }
  const mother = original.find(artifact => artifact.value.stage === 'mother').value;
  assert.deepEqual(after.find(artifact => artifact.value.stage === 'platform').value.parentArtifactHashes, [mother.artifactHash]);
  assert.throws(() => fixture.service.resumeMother(initial.id), conflict);
  assertTemporaryOnly(fixture, done);
});

test('source tmp edits reject recovery before another model call or consuming the recovery allowance', { timeout: 10000 }, async t => {
  const calls = [];
  const fixture = setup(t, args => { calls.push(args.stage); if (args.stage === 'platform') throw new Error('Explicit synthetic platform failure.'); return textV2Fixture(args); });
  const failed = await finish(fixture.service, fixture.service.create(request()).id);
  assert.equal(failed.canResumeMother, true);
  const tmp = fixture.content.readTmp(failed.variants[1].tmpId);
  const changed = { ...tmp.content, name: 'Explicit synthetic user edit before recovery' };
  fixture.content.updateTmp(tmp.id, { revision: tmp.revision, content: changed, temporary: tmp.temporary });
  assert.throws(() => fixture.service.resumeMother(failed.id), conflict);
  assert.deepEqual(calls, ['mother', 'platform']);
  assert.equal(fixture.content.readTmp(tmp.id).content.name, changed.name);
  const persisted = JSON.parse(readFileSync(path.join(fixture.dataDir, 'tmp', 'generation', failed.id, 'job.json')));
  assert.equal(persisted.resumeCount ?? 0, 0);
  assertTemporaryOnly(fixture, failed);
});

test('a second platform failure exhausts the single recovery attempt, including after restart', { timeout: 10000 }, async t => {
  const calls = [];
  const fixture = setup(t, args => { calls.push(args.stage); if (args.stage === 'platform') throw new Error('Explicit synthetic recurring platform failure.'); return textV2Fixture(args); });
  const first = await finish(fixture.service, fixture.service.create(request()).id);
  assert.equal(first.canResumeMother, true);
  assert.equal(fixture.service.resumeMother(first.id).id, first.id);
  const second = await finish(fixture.service, first.id);
  assert.equal(second.status, 'failed'); assert.equal(second.canResumeMother, false);
  assert.throws(() => fixture.service.resumeMother(first.id), conflict);
  await fixture.restart();
  assert.equal(fixture.service.get(first.id).canResumeMother, false);
  assert.throws(() => fixture.service.resumeMother(first.id), conflict);
  assert.deepEqual(calls, ['mother', 'platform', 'platform']);
  assertTemporaryOnly(fixture, second);
});

test('a persisted first platform failure can recover after service restart without rerunning the mother', { timeout: 10000 }, async t => {
  const calls = []; let platforms = 0;
  const fixture = setup(t, args => {
    calls.push(args);
    if (args.stage === 'platform' && ++platforms === 1) throw new Error('Explicit synthetic pre-restart platform failure.');
    return textV2Fixture(args);
  });
  const raw = request(), failed = await finish(fixture.service, fixture.service.create(raw).id);
  const original = artifacts(fixture, failed.id).filter(artifact => ['intake', 'mother'].includes(artifact.value.stage));
  await fixture.restart();
  assert.equal(fixture.service.get(failed.id).status, 'failed'); assert.equal(fixture.service.get(failed.id).canResumeMother, true);
  assert.equal(fixture.service.create(raw).id, failed.id); assert.equal(calls.length, 2, 'restart and original request do not replay any model call');
  assert.equal(fixture.service.resumeMother(failed.id).id, failed.id);
  const done = await finish(fixture.service, failed.id);
  assert.equal(done.status, 'completed', done.error);
  assert.equal(calls.filter(call => call.stage === 'mother').length, 1);
  for (const language of ['zh', 'en']) assert.equal(calls.filter(call => call.stage === 'review' && call.payload.language === language).length, 1);
  const after = artifacts(fixture, failed.id);
  for (const before of original) assert.deepEqual(after.find(artifact => artifact.name === before.name).bytes, before.bytes);
  assertTemporaryOnly(fixture, done);
});

for (const failedStage of ['mother', 'localization', 'review']) test(`${failedStage} failures cannot use the platform-only recovery route`, { timeout: 10000 }, async t => {
  const calls = [];
  const fixture = setup(t, args => { calls.push(args.stage); if (args.stage === failedStage) throw new Error(`Explicit synthetic ${failedStage} failure.`); return textV2Fixture(args); });
  const failed = await finish(fixture.service, fixture.service.create(request()).id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.canResumeMother, false);
  const count = calls.length;
  assert.throws(() => fixture.service.resumeMother(failed.id), conflict);
  assert.equal(calls.length, count);
  if (failedStage === 'review') for (const variant of failed.variants) assert.equal(fixture.content.readTmp(variant.tmpId).temporary.initialDocuments.length, 1);
  assertTemporaryOnly(fixture, failed);
});
