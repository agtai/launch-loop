import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';
import { hash } from '../server/content-validation.mjs';
import { fixtureContext, textV2Fixture } from './fixtures/text-v2-fixture.mjs';

// Explicit synthetic models and isolated data only; no real model or platform calls.
const request = () => ({ requestId: randomUUID(), name: 'EXPLICIT SYNTHETIC REVIEW RESUME', brief: { ...fixtureContext().brief, materials: [{ id: 'source1', label: 'Explicit synthetic pilot source', type: 'text', text: fixtureContext().actualSources[0].text }], platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'], references: [] }, uploads: [], options: { styles: ['plain'], depths: ['brief'] } });
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'needs_evidence', 'needs_resolution']);
const conflict = error => error.status === 409;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function finish(service, id) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const job = service.get(id);
    if (terminal.has(job.status)) return job;
    await sleep(5);
  }
  throw new Error('Explicit synthetic review-resume job did not finish.');
}
function gate() { let release, enter; return { blocked: new Promise(resolve => { release = resolve; }), entered: new Promise(resolve => { enter = resolve; }), release: () => release(), enter: () => enter() }; }
function setup(t, runner, beforeClose = () => {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-mvp-review-resume-'));
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
const jobDirectory = (fixture, id) => path.join(fixture.dataDir, 'tmp', 'generation', id);
const persistedJob = (fixture, id) => JSON.parse(readFileSync(path.join(jobDirectory(fixture, id), 'job.json')));
function artifacts(fixture, id) {
  const directory = jobDirectory(fixture, id);
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

for (const failedLanguage of ['zh', 'en']) test(`${failedLanguage === 'zh' ? 'first' : 'second'} review failure resumes only missing work without replacing frozen drafts or repeating a successful audit`, { timeout: 10000 }, async t => {
  const held = gate(), calls = []; let failedOnce = false, resuming = false;
  const fixture = setup(t, async args => {
    calls.push(args);
    if (args.stage === 'review' && args.payload.language === failedLanguage) {
      if (!failedOnce) { failedOnce = true; throw new Error('Explicit synthetic review timeout.'); }
      if (resuming) { held.enter(); await held.blocked; }
    }
    return textV2Fixture(args);
  }, held.release);
  const initial = fixture.service.create(request()), failed = await finish(fixture.service, initial.id);
  assert.equal(failed.status, 'failed'); assert.equal(failed.canResumeReview, true);
  const original = artifacts(fixture, initial.id), before = failed.variants.map(variant => fixture.content.readTmp(variant.tmpId));
  assert.equal(original.filter(artifact => artifact.value.stage === 'review').length, failedLanguage === 'zh' ? 0 : 1);
  for (const tmp of before) assert.equal(tmp.temporary.initialDocuments.length, 1);
  const frozenDrafts = persistedJob(fixture, initial.id).frozenDrafts;
  const frozenHash = calls.find(call => call.stage === 'review').payload.frozenHash;
  const beforeCount = calls.length;
  if (failedLanguage === 'en') {
    await fixture.restart();
    assert.equal(fixture.service.get(initial.id).canResumeReview, true);
    assert.equal(calls.length, beforeCount, 'restart does not replay the successful first audit');
  }

  resuming = true;
  assert.equal(fixture.service.resumeReview(initial.id).id, initial.id);
  assert.equal(fixture.service.resumeReview(initial.id).id, initial.id, 'repeated queued click returns the same job');
  await held.entered;
  assert.equal(fixture.service.resumeReview(initial.id).id, initial.id, 'repeated running click returns the same job');
  for (const previous of before) {
    const current = fixture.content.readTmp(previous.id);
    assert.equal(current.revision, previous.revision, 'drafts_reused and cached review must not rewrite tmp');
    assert.deepEqual(current.content.documents, previous.content.documents);
    assert.deepEqual(current.temporary, previous.temporary);
    assert.deepEqual(current.content.executions, previous.content.executions);
    if (previous.content.executions.some(execution => execution.stage === 'review')) {
      const variant = fixture.service.get(initial.id).variants.find(variant => variant.tmpId === previous.id);
      assert.equal(variant.stage, 'reviewed', 'a reused successful audit stays reviewed while the remaining audit is blocked');
      assert.equal(current.content.executions.filter(execution => execution.stage === 'review').length, 1, 'reusing a successful audit does not duplicate its execution');
    }
  }
  held.release();
  const done = await finish(fixture.service, initial.id);
  assert.equal(done.status, 'completed', done.error); assert.equal(done.id, initial.id);
  assert.equal(done.resumedReview, true); assert.equal(done.canResumeReview, false);
  assert.equal(fixture.service.list().length, 1);
  for (const stage of ['mother', 'platform', 'localization']) assert.equal(calls.filter(call => call.stage === stage).length, 1, stage);
  for (const call of calls.slice(beforeCount)) assert.match(path.basename(call.directory), /-review-resume-1$/);
  for (const language of ['zh', 'en']) {
    const reviews = calls.filter(call => call.stage === 'review' && call.payload.language === language);
    assert.equal(reviews.length, language === failedLanguage ? 2 : 1, 'a completed review is never sent to the model again');
    for (const review of reviews) assert.equal(review.payload.frozenHash, frozenHash);
    const variant = done.variants.find(variant => variant.language === language), tmp = fixture.content.readTmp(variant.tmpId);
    assert.equal(tmp.content.executions.filter(execution => execution.stage === 'generation').length, 1);
    assert.equal(tmp.content.executions.filter(execution => execution.stage === 'review').length, 1);
    assert.equal(tmp.content.executions.filter(execution => execution.stage === 'revision').length, 1);
    assert.equal(JSON.parse(tmp.temporary.reviewFindings).auditCount, 1);
    const oldReview = before.find(previous => previous.id === tmp.id).content.executions.find(execution => execution.stage === 'review');
    if (oldReview) assert.deepEqual(tmp.content.executions.find(execution => execution.stage === 'review'), oldReview);
  }
  const after = artifacts(fixture, initial.id);
  for (const artifact of original) {
    const matching = after.find(candidate => candidate.name === artifact.name);
    assert.ok(matching, `original ${artifact.value.stage} artifact remains`);
    assert.deepEqual(matching.bytes, artifact.bytes, 'original hash, timing and payload remain byte-for-byte unchanged');
  }
  for (const stage of ['intake', 'mother', 'platform']) assert.equal(after.filter(artifact => artifact.value.stage === stage).length, 1);
  assert.equal(after.filter(artifact => artifact.value.stage === 'draft').length, 2);
  assert.equal(after.filter(artifact => artifact.value.stage === 'review').length, 2);
  assert.equal(after.filter(artifact => artifact.value.stage === 'revision').length, 2);
  assert.deepEqual(persistedJob(fixture, initial.id).frozenDrafts, frozenDrafts);
  assert.equal(persistedJob(fixture, initial.id).reviewResumeCount, 1);
  assert.throws(() => fixture.service.resumeReview(initial.id), conflict);
  assertTemporaryOnly(fixture, done);
});

for (const change of ['body_edit', 'revision_only', 'same_revision_body_tamper']) test(`review recovery rejects ${change} before a new model call`, { timeout: 10000 }, async t => {
  const calls = [];
  const fixture = setup(t, args => { calls.push(args.stage); if (args.stage === 'review') throw new Error('Explicit synthetic review failure.'); return textV2Fixture(args); });
  const failed = await finish(fixture.service, fixture.service.create(request()).id), tmp = fixture.content.readTmp(failed.variants[1].tmpId);
  const changed = structuredClone(tmp.content);
  if (change === 'revision_only') changed.name = 'Explicit synthetic renamed draft';
  else changed.documents[0].blocks[0].text = 'Explicit synthetic user text after the frozen barrier.';
  if (change === 'same_revision_body_tamper') {
    const file = path.join(fixture.dataDir, 'tmp', 'content', tmp.id, 'draft.json');
    const raw = JSON.parse(readFileSync(file)); raw.content = changed; writeFileSync(file, JSON.stringify(raw));
  } else fixture.content.updateTmp(tmp.id, { revision: tmp.revision, content: changed, temporary: tmp.temporary });
  const count = calls.length;
  assert.throws(() => fixture.service.resumeReview(failed.id), conflict);
  assert.equal(calls.length, count);
  assert.deepEqual(fixture.content.readTmp(tmp.id).content, changed);
  assert.equal(persistedJob(fixture, failed.id).reviewResumeCount ?? 0, 0);
  assertTemporaryOnly(fixture, failed);
});

test('a second review failure exhausts the single review recovery and restart cannot unlock it', { timeout: 10000 }, async t => {
  const calls = [];
  const fixture = setup(t, args => { calls.push(args.stage); if (args.stage === 'review') throw new Error('Explicit synthetic repeated review failure.'); return textV2Fixture(args); });
  const first = await finish(fixture.service, fixture.service.create(request()).id);
  assert.equal(first.canResumeReview, true);
  fixture.service.resumeReview(first.id);
  const second = await finish(fixture.service, first.id);
  assert.equal(second.status, 'failed'); assert.equal(second.canResumeReview, false);
  assert.throws(() => fixture.service.resumeReview(first.id), conflict);
  await fixture.restart();
  assert.equal(fixture.service.get(first.id).canResumeReview, false);
  assert.throws(() => fixture.service.resumeReview(first.id), conflict);
  assert.deepEqual(calls, ['mother', 'platform', 'localization', 'review', 'review']);
  assert.equal(persistedJob(fixture, first.id).reviewResumeCount, 1);
  assertTemporaryOnly(fixture, second);
});

test('any persisted revision artifact blocks review recovery before further model calls', { timeout: 10000 }, async t => {
  const calls = [];
  const fixture = setup(t, args => { calls.push(args.stage); if (args.stage === 'review') throw new Error('Explicit synthetic review failure.'); return textV2Fixture(args); });
  const failed = await finish(fixture.service, fixture.service.create(request()).id);
  const original = artifacts(fixture, failed.id).find(artifact => artifact.value.stage === 'draft').value;
  const { artifactHash: _previousHash, ...envelope } = original;
  // Deliberate persisted revision marker: even an unexpected/partial revision
  // must stop this recovery route, never be ignored or replayed as an audit.
  envelope.stage = 'revision';
  const revision = { ...envelope, artifactHash: hash(JSON.stringify(envelope)) };
  writeFileSync(path.join(jobDirectory(fixture, failed.id), `artifact-${hash(JSON.stringify(revision))}.json`), JSON.stringify(revision));
  const count = calls.length;
  assert.throws(() => fixture.service.resumeReview(failed.id), conflict);
  assert.equal(calls.length, count); assert.equal(persistedJob(fixture, failed.id).reviewResumeCount ?? 0, 0);
  assertTemporaryOnly(fixture, failed);
});

test('one platform recovery and one later review recovery have independent budgets and output directories', { timeout: 10000 }, async t => {
  const calls = []; let platforms = 0, reviews = 0;
  const fixture = setup(t, args => {
    calls.push(args);
    if (args.stage === 'platform' && ++platforms === 1) throw new Error('Explicit synthetic first platform failure.');
    if (args.stage === 'review' && ++reviews === 1) throw new Error('Explicit synthetic first review failure.');
    return textV2Fixture(args);
  });
  const first = await finish(fixture.service, fixture.service.create(request()).id);
  fixture.service.resumeMother(first.id);
  const second = await finish(fixture.service, first.id);
  assert.equal(second.status, 'failed'); assert.equal(second.canResumeReview, true);
  const count = calls.length;
  fixture.service.resumeReview(first.id);
  const done = await finish(fixture.service, first.id);
  assert.equal(done.status, 'completed', done.error);
  assert.equal(calls.filter(call => call.stage === 'mother').length, 1);
  assert.equal(calls.filter(call => call.stage === 'platform').length, 2);
  assert.equal(calls.filter(call => call.stage === 'localization').length, 1);
  for (const call of calls.slice(count)) assert.match(path.basename(call.directory), /-review-resume-1$/);
  const persisted = persistedJob(fixture, first.id);
  assert.equal(persisted.resumeCount, 1); assert.equal(persisted.reviewResumeCount, 1);
  for (const variant of done.variants) assert.equal(fixture.content.readTmp(variant.tmpId).content.executions.filter(execution => execution.stage === 'review').length, 1);
  assert.throws(() => fixture.service.resumeMother(first.id), conflict);
  assert.throws(() => fixture.service.resumeReview(first.id), conflict);
  assertTemporaryOnly(fixture, done);
});
