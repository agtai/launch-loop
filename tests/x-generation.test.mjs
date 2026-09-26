import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';
import { hash } from '../server/content-validation.mjs';
import { fixtureContext, textV2Fixture } from './fixtures/text-v2-fixture.mjs';

const documents = (language = 'en') => [
  { id: 'post', kind: 'post', title: '', postingNote: '', blocks: [{ id: 'single', type: 'x_post', text: language === 'en' ? 'SYNTHETIC tool helps inspect local drafts. Publishing still needs approval.' : '合成工具帮助查看本地草稿，发布仍需批准。' }] },
  { id: 'thread', kind: 'thread', title: '', postingNote: '', blocks: (language === 'en' ? ['SYNTHETIC thread: inspect a draft before saving.', 'Approval is still required before publication.'] : ['合成串帖：先查看本地草稿。', '再决定是否保存。', '发布仍需另行批准。']).map((text, index) => ({ id: `thread-${index + 1}`, type: 'x_post', text })) },
];
const request = () => ({ requestId: randomUUID(), name: 'SYNTHETIC X bilingual', brief: { materials: [{ id: 'source', label: 'Synthetic facts', type: 'text', text: 'SYNTHETIC tool helps inspect local drafts. Publishing needs separate approval.' }], purpose: 'Explain local drafts', audience: 'Synthetic operators', platforms: ['x'], languages: ['zh', 'en'], formats: ['short_post', 'thread'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, uploads: [], options: { styles: ['plain'] } });
const mother = () => ({ sourceLanguage: 'en', reason: 'Supplied source is English.', spine: 'Inspect local drafts before approval.', editorialPlan: 'Explain drafting and separate publication approval.', text: 'SYNTHETIC tool helps inspect local drafts. Publishing needs separate approval.', claimLedger: [{ id: 'claim1', proposition: 'Draft inspection is local.', attribution: 'Synthetic source', qualifications: 'No publication approval is implied.', status: 'supported', sourceIds: ['source'] }], termLedger: [{ id: 'term1', source: 'draft', zh: '草稿', en: 'draft', reason: 'Stable concept' }], unresolved: ['Synthetic unknown kept in all languages'] });
const runner = async ({ stage, payload }) => {
  if (stage === 'mother') return mother();
  if (stage === 'adaptation') return { documents: documents(), unresolved: [] };
  if (stage === 'localization') return { documents: documents(payload.language), unresolved: [] };
  if (stage === 'review') return { summary: 'One synthetic review covers ordinary post and complete thread; evidence and qualification remain.', findings: [], unresolved: [] };
  if (stage === 'revision') return { documents: structuredClone(payload.initialDocuments), resolvedFindingIds: [], unresolved: [] };
  if (stage === 'modification') return { replacement: '替换文字', unresolved: [] };
  throw Error(`Unexpected synthetic stage ${stage}`);
};
function setup(t, suppliedRunner = runner, options = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-x-generation-'));
  const db = new DatabaseSync(path.join(dataDir, 'content.sqlite'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  let service = createGenerationService({ content, dataDir, testOnlyRunner: suppliedRunner, ...options });
  t.after(async () => { await service.close(); db.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { dataDir, content, get service() { return service; }, async restart() { await service.close(); service = createGenerationService({ content, dataDir, testOnlyRunner: suppliedRunner, ...options }); } };
}
async function finish(service, id) {
  for (let n = 0; n < 500; n++) { const value = service.get(id); if (['completed', 'failed', 'cancelled', 'interrupted'].includes(value.status)) return value; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw Error('Synthetic X generation did not finish');
}

test('X bilingual dual-format pipeline shares mother/platform, freezes languages, audits once each and remains tmp', async t => {
  const calls = [], f = setup(t, async args => { calls.push(args); return runner(args); });
  const raw = request(), created = f.service.create(raw);
  assert.equal(f.service.create(raw).id, created.id);
  const job = await finish(f.service, created.id);
  assert.equal(job.status, 'completed', job.error);
  assert.deepEqual(calls.map(call => call.stage), ['mother', 'adaptation', 'localization', 'review', 'review', 'revision', 'revision']);
  assert.equal(job.variants.length, 2);
  assert.equal(calls[2].payload.platformDraftHash, calls[3].payload.platformDraftHash);
  assert.equal(calls[3].payload.motherHash, calls[4].payload.motherHash);
  assert.equal(calls[3].payload.frozenVariants.length, 2); assert.equal(calls[5].payload.allReviews.length, 2);
  assert.equal(calls[3].payload.deterministicChecks.length, 2);
  for (const variant of job.variants) {
    const tmp = f.content.readTmp(variant.tmpId);
    assert.deepEqual(tmp.content.documents.map(document => document.kind), ['post', 'thread']);
    assert.deepEqual(tmp.temporary.initialDocuments, documents(variant.language));
    assert.equal(tmp.content.executions.filter(execution => execution.stage === 'review').length, 1);
    assert.equal(JSON.parse(tmp.temporary.reviewFindings).auditCount, 1);
    assert.equal(tmp.content.documents[0].blocks[0].image.status, 'dependency_blocked');
    assert.equal(tmp.content.documents[1].blocks[0].image.status, 'dependency_blocked');
    assert.ok(!tmp.content.documents[1].blocks[1].image);
    assert.ok(variant.unresolved.includes('Synthetic unknown kept in all languages'));
  }
  assert.deepEqual(f.content.list(), []); assert.deepEqual(f.content.exportAll().items, []);
  assert.equal(readFileSync(path.join(f.dataDir, 'content.sqlite')).includes(Buffer.from('SYNTHETIC tool')), false);
  await f.restart(); assert.equal(f.service.create(raw).id, created.id); assert.equal(calls.length, 7);
});

test('X same-language source is copied, not regenerated or silently normalized', async t => {
  const f = setup(t, async args => {
    if (args.stage === 'adaptation') { const docs = documents(); docs[0].blocks[0].text += ' cafe\u0301'; return { documents: docs, unresolved: [] }; }
    return runner(args);
  });
  const raw = request(); raw.brief.languages = ['en'];
  const job = await finish(f.service, f.service.create(raw).id);
  assert.equal(job.status, 'completed', job.error);
  const tmp = f.content.readTmp(job.variants[0].tmpId);
  assert.ok(tmp.temporary.initialDocuments[0].blocks[0].text.endsWith('cafe\u0301'));
  assert.equal(JSON.parse(tmp.temporary.prompt).translationStatus, 'skipped_same_language');
});

test('X mother and source-language adaptation exclude target-language instructions and Chinese form language', async t => {
  const calls = [], f = setup(t, async args => { calls.push(args); return runner(args); });
  const raw = request(); raw.brief.languages = ['zh']; raw.brief.purpose = '解释本地草稿'; raw.brief.audience = '中文使用者';
  const job = await finish(f.service, f.service.create(raw).id);
  assert.equal(job.status, 'completed', job.error);
  const preparation = calls.find(call => call.stage === 'mother').payload;
  assert.deepEqual(preparation.requestedTargetLanguages, ['zh']);
  assert.equal(preparation.brief.purpose, raw.brief.purpose);
  assert.equal(preparation.brief.languages, undefined); assert.equal(preparation.language, undefined);
  assert.equal(preparation.requestedRules, undefined);
  assert.doesNotMatch(preparation.rules, /\[language\.|\[platform\.|\[format\.|正文使用中文|Write the body in natural English/);
  assert.match(preparation.task, /English source with Chinese purpose\/audience remains an English mother/);
  const adaptation = calls.find(call => call.stage === 'adaptation').payload;
  assert.equal(adaptation.language, 'en'); assert.equal(adaptation.mother.sourceLanguage, 'en');
  assert.equal(adaptation.requestedRules, undefined);
  assert.match(adaptation.rules, /\[language.en\]/); assert.doesNotMatch(adaptation.rules, /\[language.zh\]|正文使用中文/);
  assert.equal(calls.find(call => call.stage === 'localization').payload.language, 'zh');
});

test('X final-text hook runs once after all final packages and does not wait for image work or run for local edits', async t => {
  const calls = [], capabilities = { status: 'unknown', message: 'SYNTHETIC image backend' };
  let imageCalls = 0, releaseImages, readySnapshots;
  const imageWork = new Promise(resolve => { releaseImages = resolve; });
  const f = setup(t, async args => { calls.push(args); return runner(args); }, {
    xImageCapabilities: () => capabilities,
    onXReady: tmpIds => {
      imageCalls++;
      readySnapshots = tmpIds.map(id => f.content.readTmp(id));
      return imageWork;
    },
  });
  const raw = request(), created = f.service.create(raw);
  assert.ok(created.variants.every(variant => variant.assetStatus === 'pending'));
  const job = await finish(f.service, created.id);
  assert.equal(job.status, 'completed', job.error); assert.equal(imageCalls, 1);
  assert.equal(readySnapshots.length, 2);
  for (const tmp of readySnapshots) {
    assert.equal(tmp.content.executions.filter(execution => execution.stage === 'revision').length, 1);
    assert.equal(tmp.content.documents.length, 2); assert.equal(tmp.confirmed, null);
  }
  assert.ok(job.variants.every(variant => variant.assetStatus === 'pending' && !variant.unresolved.some(message => message.includes('自动配图后端未连接'))));
  assert.deepEqual(f.service.capabilities().image.x, capabilities);
  assert.equal(f.service.capabilities().image.status, 'unconnected');
  assert.match(f.service.capabilities().image.message, /自动配图后端未连接/);
  assert.doesNotMatch(calls[0].prompt, /automatic image generation is unconnected/);
  const tmp = f.content.readTmp(job.variants[0].tmpId), text = tmp.content.documents[0].blocks[0].text;
  const modified = await finish(f.service, f.service.modify({ requestId: randomUUID(), tmpId: tmp.id, revision: tmp.revision, selection: { documentId: 'post', blockId: 'single', start: 0, end: 2, text: text.slice(0, 2) }, instruction: 'Only this phrase.' }).id);
  assert.equal(modified.status, 'completed', modified.error); assert.equal(imageCalls, 1);
  releaseImages(); await f.restart(); f.service.create(raw); assert.equal(imageCalls, 1);
  assert.deepEqual(f.content.list(), []);
});

test('X image callback failure preserves completed text while text failure never starts images', async t => {
  for (const asynchronous of [false, true]) {
    const f = setup(t, runner, { onXReady: () => { if (asynchronous) return Promise.reject(Error('SYNTHETIC startup failure')); throw Error('SYNTHETIC startup failure'); } });
    const job = await finish(f.service, f.service.create(request()).id);
    assert.equal(job.status, 'completed', job.error);
    for (const variant of job.variants) {
      assert.equal(variant.status, 'completed'); assert.ok(variant.unresolved.some(message => message.includes('后台配图任务启动失败')));
      assert.equal(f.content.readTmp(variant.tmpId).content.documents.length, 2);
    }
  }
  let imageCalls = 0, revisions = 0;
  const f = setup(t, async args => {
    if (args.stage === 'revision' && ++revisions === 2) throw Error('SYNTHETIC second final text failure');
    return runner(args);
  }, { onXReady: () => { imageCalls++; } });
  const job = await finish(f.service, f.service.create(request()).id);
  assert.equal(job.status, 'failed'); assert.equal(imageCalls, 0);
  assert.equal(job.variants[0].status, 'completed'); assert.equal(job.variants[1].status, 'failed');
});

test('X rejects invented source refs and revisions that silently replace or reorder post IDs', async t => {
  for (const mode of ['source', 'ids', 'order']) {
    const f = setup(t, async args => {
      const result = await runner(args);
      if (mode === 'source' && args.stage === 'mother') result.claimLedger[0].sourceIds = ['invented-source'];
      if (mode === 'ids' && args.stage === 'revision') result.documents[1].blocks[0].id = 'new-id';
      if (mode === 'order' && args.stage === 'revision') result.documents[1].blocks.reverse();
      return result;
    });
    const job = await finish(f.service, f.service.create(request()).id);
    assert.equal(job.status, 'failed'); assert.match(job.error, mode === 'source' ? /实际已读来源/ : /ID/);
    assert.deepEqual(f.content.list(), []);
  }
});

test('X review uses exact text and unresolved overlength final text is kept without truncation', async t => {
  const f = setup(t, async args => {
    const result = await runner(args);
    if (args.stage === 'review') result.findings = [{ id: 'f1', documentId: 'post', blockId: 'single', quote: 'NONEXISTENT', issue: 'Synthetic issue', suggestion: 'Keep evidence' }];
    return result;
  });
  const bad = await finish(f.service, f.service.create(request()).id); assert.equal(bad.status, 'failed'); assert.match(bad.error, /实际初稿/);
  const g = setup(t, async args => { const result = await runner(args); if (args.stage === 'revision') result.documents[0].blocks[0].text = '中'.repeat(141); return result; });
  const job = await finish(g.service, g.service.create(request()).id); assert.equal(job.status, 'completed', job.error);
  const tmp = g.content.readTmp(job.variants[0].tmpId);
  assert.equal(tmp.content.documents[0].blocks[0].text, '中'.repeat(141));
  assert.ok(job.variants[0].unresolved.some(message => message.includes('282/280')));
});

test('X local edit preserves other posts, document and language; marks affected image for update', async t => {
  const calls = [], f = setup(t, async args => { calls.push(args); return runner(args); }); const job = await finish(f.service, f.service.create(request()).id);
  const source = f.content.readTmp(job.variants[0].tmpId), other = f.content.readTmp(job.variants[1].tmpId);
  const text = source.content.documents[0].blocks[0].text, selected = text.slice(0, 2);
  const changed = await finish(f.service, f.service.modify({ requestId: randomUUID(), tmpId: source.id, revision: source.revision, selection: { documentId: 'post', blockId: 'single', start: 0, end: 2, text: selected }, instruction: 'Change only this selected phrase.' }).id);
  assert.equal(changed.status, 'completed', changed.error);
  const proposal = f.service.accept(changed.id, { sourceRevision: source.revision });
  assert.equal(proposal.content.documents[0].blocks[0].text, '替换文字' + text.slice(2));
  assert.equal(proposal.content.documents[0].blocks[0].image.status, 'needs_update');
  assert.deepEqual(proposal.content.documents[1], source.content.documents[1]);
  assert.deepEqual(f.content.readTmp(other.id), other); assert.deepEqual(f.content.readTmp(source.id), source);
  const modification = calls.find(call => call.stage === 'modification');
  assert.equal(modification.payload.originalSharedContext.generationJobId, job.id);
  assert.deepEqual(modification.payload.originalSharedContext.mother.claimLedger, mother().claimLedger);
  assert.deepEqual(modification.payload.originalSharedContext.mother.termLedger, mother().termLedger);
});

test('X local modification selects the originating mother even when two jobs share a rule hash', async t => {
  const calls = [], f = setup(t, async args => {
    calls.push(args); const result = await runner(args);
    if (args.stage === 'mother') result.text = args.payload.actualSources[0].text;
    return result;
  });
  const a = request(), b = request(); b.brief.materials[0].text = 'SYNTHETIC second independent source; publishing still needs approval.';
  await finish(f.service, f.service.create(a).id);
  const second = await finish(f.service, f.service.create(b).id), tmp = f.content.readTmp(second.variants[0].tmpId);
  const text = tmp.content.documents[0].blocks[0].text;
  const changed = await finish(f.service, f.service.modify({ requestId: randomUUID(), tmpId: tmp.id, revision: tmp.revision, selection: { documentId: 'post', blockId: 'single', start: 0, end: 2, text: text.slice(0, 2) }, instruction: 'Only this phrase.' }).id);
  assert.equal(changed.status, 'completed', changed.error);
  const shared = calls.find(call => call.stage === 'modification').payload.originalSharedContext;
  assert.equal(shared.generationJobId, second.id); assert.equal(shared.mother.text, b.brief.materials[0].text);
});

test('X cancelled mother never accepts a late output or creates formal content', async t => {
  let release, began, imageCalls = 0;
  const entered = new Promise(resolve => { began = resolve; });
  const f = setup(t, async args => { if (args.stage === 'mother') { began(); await new Promise(resolve => { release = resolve; }); } return runner(args); }, { onXReady: () => { imageCalls++; } });
  const created = f.service.create(request()); await entered; f.service.cancel(created.id); release();
  const job = await finish(f.service, created.id); assert.equal(job.status, 'cancelled');
  for (const variant of job.variants) assert.deepEqual(f.content.readTmp(variant.tmpId).content.documents, []);
  assert.deepEqual(f.content.list(), []); assert.equal(imageCalls, 0);
});

const mixedRequest = () => {
  const raw = request();
  raw.brief.platforms = ['linkedin', 'x']; raw.brief.formats = ['short_post'];
  raw.brief.materials[0].text = fixtureContext().actualSources[0].text;
  return raw;
};
async function mixedRunner(args) {
  if (args.payload.platform !== 'x') return textV2Fixture(args);
  const result = await runner(args);
  if (result.documents) result.documents = result.documents.filter(document => document.kind === 'post');
  return result;
}

test('main integration keeps LinkedIn candidate rules/images and X rules/images in separate paths', async t => {
  const calls = [], ready = [], imageInputs = [];
  const f = setup(t, async args => { calls.push(args); return mixedRunner(args); }, {
    imageProvider: '', onXReady: (ids, texts) => { ready.push({ ids, texts }); },
    xImageCapabilities: () => ({ available: false, status: 'unknown' }),
    testOnlyImageRunner: async input => {
      imageInputs.push(input);
      const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWp0AAAAASUVORK5CYII=', 'base64');
      return { status: 'ready', bytes, mimeType: 'image/png', width: 1, height: 1, sha256: hash(bytes), bodyHash: input.bodyHash, visualCheck: { status: 'passed', checkedAt: new Date().toISOString() } };
    },
  });
  const job = await finish(f.service, f.service.create(mixedRequest()).id);
  assert.equal(job.status, 'completed', job.error); assert.equal(job.variants.length, 4);
  assert.equal(ready.length, 1); assert.equal(ready[0].ids.length, 2);
  assert.equal(imageInputs.length, 1); assert.ok(imageInputs[0].documents.every(document => document.kind === 'linkedin_post'));
  const capability = f.service.capabilities();
  assert.equal(capability.image.status, 'available'); assert.match(capability.image.message, /仅测试图片替身/);
  assert.equal(capability.image.x.status, 'unknown');
  for (const variant of job.variants) {
    const tmp = f.content.readTmp(variant.tmpId), isX = variant.platform === 'x';
    assert.equal(tmp.content.rule.ruleSetVersion, isX ? 'x-text-v1.0.0' : 'text-v2.0.0');
    assert.equal(tmp.content.documents[0].kind, isX ? 'post' : 'linkedin_post');
    assert.equal(tmp.content.executions.filter(run => run.stage === 'review').length, 1);
    assert.equal(variant.assetStatus, isX ? 'pending' : 'ready');
    assert.equal(ready[0].ids.includes(tmp.id), isX);
    if (isX) assert.equal(ready[0].texts.find(item => item.tmpId === tmp.id).revision, tmp.revision);
  }
  assert.equal(calls.filter(call => call.stage === 'mother' && call.payload.platform === 'x').length, 1);
  assert.equal(calls.filter(call => call.stage === 'mother' && call.payload.platform !== 'x').length, 1);
  assert.deepEqual(f.content.list(), []);
});

for (const failingStage of ['platform', 'review']) test(`mixed batch can resume LinkedIn ${failingStage} without rerunning or modifying X`, async t => {
  let failed = false, imageCalls = 0, xCalls = 0;
  const f = setup(t, async args => {
    if (args.payload.platform === 'x') xCalls++;
    else if (args.stage === failingStage && !failed) { failed = true; throw Error('EXPLICIT SYNTHETIC LinkedIn stage failure'); }
    return mixedRunner(args);
  }, { imageProvider: '', onXReady: () => { imageCalls++; } });
  const initial = await finish(f.service, f.service.create(mixedRequest()).id);
  assert.equal(initial.status, 'failed');
  assert.equal(initial[failingStage === 'platform' ? 'canResumeMother' : 'canResumeReview'], true);
  const xVariants = initial.variants.filter(variant => variant.platform === 'x');
  assert.ok(xVariants.every(variant => variant.status === 'completed'));
  const firstX = f.content.readTmp(xVariants[0].tmpId), content = structuredClone(firstX.content);
  content.documents[0].blocks[0].text += ' User edit while LinkedIn is paused.';
  f.content.updateTmp(firstX.id, { revision: firstX.revision, content, temporary: firstX.temporary });
  const snapshots = xVariants.map(variant => f.content.readTmp(variant.tmpId)), callsBefore = xCalls;
  const resumed = failingStage === 'platform' ? f.service.resumeMother(initial.id) : f.service.resumeReview(initial.id);
  const final = await finish(f.service, resumed.id);
  assert.equal(final.status, 'completed', final.error); assert.equal(xCalls, callsBefore); assert.equal(imageCalls, 1);
  assert.deepEqual(xVariants.map(variant => f.content.readTmp(variant.tmpId)), snapshots);
  for (const variant of final.variants.filter(variant => variant.platform === 'linkedin')) assert.equal(f.content.readTmp(variant.tmpId).content.executions.filter(run => run.stage === 'review').length, 1);
});

test('X modifications preserve main proposal accept/reject/undo and same-platform synchronization', async t => {
  const f = setup(t, async args => args.stage === 'modification' ? { replacement: '新措辞', unresolved: [], changesSharedFacts: true, impactReason: 'Explicit synthetic qualification change.', changedClaimIds: ['claim1'] } : mixedRunner(args));
  const job = await finish(f.service, f.service.create(mixedRequest()).id);
  assert.equal(job.status, 'completed', job.error);
  const source = f.content.readTmp(job.variants.find(variant => variant.platform === 'x' && variant.language === 'zh').tmpId);
  const selectionFor = tmp => ({ documentId: tmp.content.documents[0].id, blockId: tmp.content.documents[0].blocks[0].id, start: 0, end: 2, text: tmp.content.documents[0].blocks[0].text.slice(0, 2) });
  const proposal = await finish(f.service, f.service.modify({ requestId: randomUUID(), tmpId: source.id, revision: source.revision, selection: selectionFor(source), instruction: 'Only this selection.' }).id);
  assert.equal(proposal.status, 'completed', proposal.error); assert.equal(proposal.disposition, 'pending'); assert.equal(proposal.change.replacement, '新措辞');
  const accepted = f.service.accept(proposal.id, { sourceRevision: source.revision });
  assert.equal(f.service.get(proposal.id).disposition, 'accepted');
  assert.equal(f.service.get(job.id).languageImpact.sourcePlatform, 'x');
  assert.deepEqual(f.service.get(job.id).languageImpact.affectedLanguages, ['en']);
  assert.deepEqual(f.content.readTmp(source.id), source);
  const linkedIn = f.content.readTmp(job.variants.find(variant => variant.platform === 'linkedin' && variant.language === 'en').tmpId);
  assert.throws(() => f.service.synchronize({ requestId: randomUUID(), tmpId: linkedIn.id, revision: linkedIn.revision, selection: selectionFor(linkedIn), modificationId: proposal.id }), /同批的另一种语言/);
  const otherX = f.content.readTmp(job.variants.find(variant => variant.platform === 'x' && variant.language === 'en').tmpId);
  const synchronized = await finish(f.service, f.service.synchronize({ requestId: randomUUID(), tmpId: otherX.id, revision: otherX.revision, selection: selectionFor(otherX), modificationId: proposal.id }).id);
  assert.equal(synchronized.status, 'completed', synchronized.error);
  f.service.reject(synchronized.id); assert.equal(f.service.get(synchronized.id).disposition, 'rejected');
  assert.deepEqual(f.content.readTmp(otherX.id), otherX);
  const undo = f.service.undo(proposal.id, { requestId: randomUUID(), tmpId: accepted.id, revision: accepted.revision });
  assert.equal(undo.disposition, 'pending');
  const reverted = f.service.accept(undo.id, { sourceRevision: accepted.revision });
  assert.equal(reverted.content.documents[0].blocks[0].text, source.content.documents[0].blocks[0].text);
  assert.equal(f.service.get(proposal.id).disposition, 'undone');
});
