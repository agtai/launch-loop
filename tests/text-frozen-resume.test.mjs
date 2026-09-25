import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIntegratedTextRules } from '../server/text-rules-v2.mjs';
import { runTextPipeline, TEXT_PIPELINE_SCHEMAS } from '../server/text-pipeline.mjs';
import { canonical, sha256 } from '../rules/text/v2/catalog.mjs';
import { fixtureContext, textV2Fixture } from './fixtures/text-v2-fixture.mjs';

const rehash = artifact => { const { artifactHash: _hash, ...envelope } = artifact; artifact.artifactHash = sha256(JSON.stringify(envelope)); };
async function interruptedReview(successfulReviews = 0) {
  const context = fixtureContext({ inputHash: undefined });
  const variants = resolveIntegratedTextRules({ platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'] }).variants;
  const events = [], calls = []; let successes = 0;
  await assert.rejects(runTextPipeline({ context, variants, checkpoint: async event => events.push(event), call: async request => {
    calls.push({ stage: request.stage, variantId: request.variantId });
    if (request.stage === 'review' && successes++ === successfulReviews) throw new Error('Explicit synthetic review timeout');
    const output = await textV2Fixture(request);
    // A real positioned finding exercises persisted namespacing and offsets.
    if (request.stage === 'review') output.findings.push({ id: 'kept', category: 'voice', severity: 'optional', locations: [{ documentId: 'feed', blockId: 'paragraph1', field: 'text', quote: request.payload.initialDocuments[0].blocks[0].text, occurrence: 0 }], issue: 'Explicit synthetic issue.', suggestion: 'Keep for author choice.', basis: { sourceIds: ['source1'], claimIds: ['claim1'], termIds: ['term1'], ruleIds: ['base.core.v2'] }, affectedVariants: [request.variantId] });
    return output;
  } }), /synthetic review timeout/);
  const artifacts = events.filter(event => event.type === 'artifact').map(event => event.artifact);
  context.inputHash = artifacts[0].inputHash;
  return { context, variants, calls, frozenDrafts: events.find(event => event.type === 'drafts_frozen').drafts, resumeFrozen: {
    intakeArtifact: artifacts.find(item => item.stage === 'intake'), motherArtifact: artifacts.find(item => item.stage === 'mother'), platformArtifact: artifacts.find(item => item.stage === 'platform'), draftArtifacts: artifacts.filter(item => item.stage === 'draft'), reviewArtifacts: artifacts.filter(item => item.stage === 'review'),
  } };
}

for (const successfulReviews of [0, 1]) test(`frozen continuation with ${successfulReviews} accepted reviews only invokes missing audits and preserves frozen artifacts byte-for-byte`, async () => {
  const previous = await interruptedReview(successfulReviews), calls = [], events = [], original = structuredClone(previous.resumeFrozen);
  const result = await runTextPipeline({ ...previous, checkpoint: async event => events.push(event), call: async request => { calls.push(request); return textV2Fixture(request); } });
  assert.deepEqual(calls.map(request => `${request.stage}:${request.variantId}`), [...(successfulReviews ? [] : ['review:linkedin:zh']), 'review:linkedin:en', 'revision:linkedin:zh', 'revision:linkedin:en']);
  assert.equal(result.status, 'awaiting_confirmation');
  assert(!events.some(event => event.type === 'drafts_frozen'));
  assert.deepEqual(events.find(event => event.type === 'drafts_reused').drafts, previous.frozenDrafts);
  assert.equal(events.filter(event => event.type === 'review').length, 2 - successfulReviews);
  const expectedArtifacts = [original.intakeArtifact, original.motherArtifact, original.platformArtifact, ...original.draftArtifacts, ...original.reviewArtifacts];
  assert.deepEqual(events.filter(event => event.reused && event.type === 'artifact').map(event => event.artifact), expectedArtifacts);
  assert.deepEqual(result.artifacts.slice(0, expectedArtifacts.length), expectedArtifacts);
  assert.deepEqual(previous.resumeFrozen, original);
  assert(result.variants.every(variant => variant.auditCount === 1 && variant.review.auditCount === 1));
  assert.equal(result.artifacts.filter(item => item.stage === 'review').length, 2);
  if (successfulReviews) {
    const saved = original.reviewArtifacts[0];
    assert.deepEqual(result.variants.find(item => item.variantId === saved.variantId).review, saved.payload);
    assert.equal(result.variants[0].findingResolutions[0].findingId, 'zh-kept');
  }
  for (const request of calls.filter(call => call.stage === 'review')) {
    assert.equal(request.timeoutMs, 300000);
    assert.equal(request.payload.frozenDrafts.length, 1);
    assert.notEqual(request.payload.frozenDrafts[0].variantId, request.variantId);
    assert.deepEqual(request.payload.initialDocuments, previous.frozenDrafts.find(item => item.variantId === request.variantId).documents);
    assert.deepEqual(request.payload.claimLedger, original.motherArtifact.payload.claimLedger);
    assert.deepEqual(request.payload.termLedger, original.motherArtifact.payload.termLedger);
    assert.equal(request.payload.rules, previous.variants.find(item => item.id === request.variantId).stageInstructions.review);
    assert.deepEqual(request.schema, TEXT_PIPELINE_SCHEMAS.review);
    assert.deepEqual(Object.keys(request.payload.sourceManifest[0]).sort(), ['id', 'label', 'role', 'type']);
  }
  const firstRevision = calls.find(request => request.stage === 'revision');
  assert.equal(firstRevision.payload.allReviews.length, 2);
});

test('frozen continuation rejects incomplete/foreign/tampered drafts, changed inputs and a revision artifact before any new audit', async () => {
  const original = await interruptedReview();
  const mutations = [
    args => { args.context.runId = 'foreign-job'; },
    args => { args.context.actualSources[0].text += ' Changed original input.'; },
    args => { args.variants[0].sharedRuleMetadata.hash = '0'.repeat(64); },
    args => { args.resumeFrozen.draftArtifacts.pop(); },
    args => { args.resumeFrozen.draftArtifacts[1] = structuredClone(args.resumeFrozen.draftArtifacts[0]); },
    args => { args.resumeFrozen.platformArtifact.artifactHash = '0'.repeat(64); },
    args => { args.resumeFrozen.draftArtifacts[0].payload.documents[0].blocks[0].text += ' tampered'; },
    args => { args.resumeFrozen.draftArtifacts[0].parentArtifactHashes.reverse(); rehash(args.resumeFrozen.draftArtifacts[0]); },
    args => { args.resumeFrozen.draftArtifacts[1].payload.documents[0].blocks[0].text += ' Rehashed but no longer passthrough.'; rehash(args.resumeFrozen.draftArtifacts[1]); },
    args => { args.resumeFrozen.draftArtifacts[0].payload.claimBindings[0].claimIds = []; rehash(args.resumeFrozen.draftArtifacts[0]); },
    args => { args.resumeFrozen.draftArtifacts[0].payload.localizationStatus = 'skipped_same_language'; rehash(args.resumeFrozen.draftArtifacts[0]); },
    args => { args.resumeFrozen.revisionArtifacts = []; },
    args => { args.resumeFrozen.reviewArtifacts = [{ ...structuredClone(args.resumeFrozen.draftArtifacts[0]), stage: 'revision' }]; },
    args => { args.resumeMother = { intakeArtifact: args.resumeFrozen.intakeArtifact, motherArtifact: args.resumeFrozen.motherArtifact }; },
  ];
  for (const mutate of mutations) {
    const args = structuredClone(original); mutate(args); const calls = [];
    await assert.rejects(runTextPipeline({ ...args, call: async request => { calls.push(request); return textV2Fixture(request); } }), /恢复/);
    assert.equal(calls.length, 0);
  }
});

test('accepted audits are revalidated against the exact frozen set, rule hash, count, references and UTF-16 offsets', async () => {
  const original = await interruptedReview(1);
  const mutations = [
    saved => { saved.payload.reviewedDraftHash = '0'.repeat(64); },
    saved => { saved.payload.frozenHash = '0'.repeat(64); },
    saved => { saved.payload.ruleHash = '0'.repeat(64); },
    saved => { saved.payload.auditCount = 2; },
    saved => { saved.payload.passNumber = 2; },
    saved => { saved.payload.editorialAssessment[0].locations[0].start = 1; },
    saved => { saved.payload.findings[0].quote = 'Incorrect alias quote'; },
    saved => { saved.payload.findings[0].locations[0].quote = 'Fabricated quote'; },
    saved => { saved.payload.findings[0].basis.claimIds = ['invented']; },
    saved => { saved.payload.findings[0].id = 'en-kept'; },
    saved => { saved.parentArtifactHashes = []; },
  ];
  for (const mutate of mutations) {
    const args = structuredClone(original), saved = args.resumeFrozen.reviewArtifacts[0], calls = [];
    mutate(saved); rehash(saved);
    await assert.rejects(runTextPipeline({ ...args, call: async request => { calls.push(request); return textV2Fixture(request); } }), /恢复|引文|主张/);
    assert.equal(calls.length, 0);
  }
  const duplicate = structuredClone(original);
  duplicate.resumeFrozen.reviewArtifacts.push(structuredClone(duplicate.resumeFrozen.reviewArtifacts[0]));
  await assert.rejects(runTextPipeline({ ...duplicate, call: textV2Fixture }), /重复/);
});

test('frozen continuation failure or cancellation never repeats an accepted audit or enters revision', async () => {
  const args = await interruptedReview(1), calls = [], events = [];
  await assert.rejects(runTextPipeline({ ...args, checkpoint: async event => events.push(event), call: async request => { calls.push(request.stage); throw new Error('Explicit second review failure'); } }), /second review failure/);
  assert.deepEqual(calls, ['review']);
  assert(!events.some(event => ['review', 'revision', 'drafts_frozen'].includes(event.type)));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runTextPipeline({ ...args, context: { ...args.context, signal: controller.signal }, call: async () => assert.fail('cancelled continuation called model') }), /取消/);
});
