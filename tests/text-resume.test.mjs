import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIntegratedTextRules } from '../server/text-rules-v2.mjs';
import { runTextPipeline } from '../server/text-pipeline.mjs';
import { canonical, sha256 } from '../rules/text/v2/catalog.mjs';
import { fixtureContext, textV2Fixture } from './fixtures/text-v2-fixture.mjs';

const rules = () => resolveIntegratedTextRules({ platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'] }).variants;
const rehash = artifact => { const { artifactHash: _hash, ...envelope } = artifact; artifact.artifactHash = sha256(JSON.stringify(envelope)); };
function resignPair(resume) {
  rehash(resume.intakeArtifact);
  resume.motherArtifact.parentArtifactHashes = [resume.intakeArtifact.artifactHash];
  rehash(resume.motherArtifact);
}
async function interruptedMother(serviceDigest = false) {
  const context = fixtureContext({ inputHash: undefined }), variants = rules(), events = [], stages = [];
  if (serviceDigest) context.inputHash = sha256(canonical({ snapshots: context.actualSources, brief: context.brief }));
  await assert.rejects(runTextPipeline({ context, variants, checkpoint: async event => events.push(event), call: async request => {
    stages.push(request.stage);
    if (request.stage === 'platform') throw new Error('Explicit synthetic platform timeout');
    return textV2Fixture(request);
  } }), /synthetic platform timeout/);
  assert.deepEqual(stages, ['mother', 'platform']);
  const intakeArtifact = events.find(event => event.type === 'artifact' && event.stage === 'intake').artifact;
  const motherArtifact = events.find(event => event.type === 'artifact' && event.stage === 'mother').artifact;
  context.inputHash = intakeArtifact.inputHash;
  return { context, variants, resumeMother: { intakeArtifact, motherArtifact } };
}

for (const serviceDigest of [false, true]) test(`mother continuation preserves original artifacts and timing, skips mother, reviews each frozen draft once (${serviceDigest ? 'service' : 'pure'} digest)`, async () => {
  const args = await interruptedMother(serviceDigest), original = structuredClone(args.resumeMother), calls = [], events = [];
  const result = await runTextPipeline({ ...args, checkpoint: async event => { events.push(structuredClone(event)); if (event.reused) event.artifact.payload = 'callback mutation'; }, call: async request => { calls.push(request); return textV2Fixture(request); } });
  assert.equal(result.status, 'awaiting_confirmation');
  assert.deepEqual(calls.map(call => call.stage), ['platform', 'localization', 'review', 'review', 'revision', 'revision']);
  assert.deepEqual(calls.filter(call => call.stage === 'review').map(call => call.variantId), ['linkedin:zh', 'linkedin:en']);
  assert.deepEqual(events.filter(event => event.reused).map(event => event.artifact), [original.intakeArtifact, original.motherArtifact]);
  assert.deepEqual(result.artifacts.slice(0, 2), [original.intakeArtifact, original.motherArtifact]);
  assert.deepEqual(args.resumeMother, original);
  assert.deepEqual(result.sourceManifest, original.intakeArtifact.payload.sourceManifest);
  assert.deepEqual(result.artifacts.find(item => item.stage === 'platform').parentArtifactHashes, [original.motherArtifact.artifactHash]);
  assert(events.findIndex(event => event.type === 'drafts_frozen') < events.findIndex(event => event.type === 'review'));
  assert.equal(calls[0].timeoutMs, 240000);
  assert.deepEqual(calls[0].payload.claimLedger, original.motherArtifact.payload.claimLedger);
  assert.deepEqual(calls[0].payload.termLedger, original.motherArtifact.payload.termLedger);
  assert.deepEqual(calls[0].payload.constraintLedger, original.motherArtifact.payload.constraintLedger);
  assert.deepEqual(Object.keys(calls[0].payload.sourceManifest[0]).sort(), ['id', 'label', 'role', 'type']);
  assert(!Object.hasOwn(calls[0].payload, 'actualSources'));
  assert(result.variants.every(variant => variant.auditCount === 1 && variant.review.auditCount === 1));
});

test('resume rejects changed actual sources and original brief even when the old inputHash is supplied', async () => {
  const original = await interruptedMother(true);
  const mutations = [
    args => { args.context.actualSources[0].text += ' A fabricated extra fact.'; },
    args => { args.context.actualSources[0].id = 'different-source'; },
    args => { args.context.actualSources[0].role = 'reference'; },
    args => { args.context.actualSources[0].sha256 = '0'.repeat(64); },
    args => { args.context.brief.purpose = 'A different author purpose.'; },
    args => { args.context.runId = 'another-generation-job'; },
  ];
  for (const mutate of mutations) {
    const args = structuredClone(original); mutate(args); const calls = [], events = [];
    await assert.rejects(runTextPipeline({ ...args, call: async request => { calls.push(request); return textV2Fixture(request); }, checkpoint: async event => events.push(event) }), /母稿恢复/);
    assert.equal(calls.length, 0); assert.equal(events.length, 0);
  }
});

test('resume rejects corrupted envelopes, resigned source manifests and changed complete or shared rule snapshots before calling a model', async () => {
  const original = await interruptedMother();
  const mutations = [
    args => { args.resumeMother.motherArtifact.payload.reason += ' tampered'; },
    args => { args.resumeMother.intakeArtifact.artifactHash = '0'.repeat(64); },
    ...['id', 'role', 'sha256', 'readScope'].map(key => args => { args.resumeMother.intakeArtifact.payload.sourceManifest[0][key] = 'tampered'; resignPair(args.resumeMother); }),
    args => { args.variants[0].sharedRuleMetadata.hash = '0'.repeat(64); },
    args => { args.variants[0].stageInstructions.platform += '\nA new rule'; },
    args => { args.variants[0].instructions += '\nA new rule'; },
    args => { args.resumeMother.intakeArtifact.payload.ruleSnapshots[0].stageInstructions.mother += '\nA new rule'; resignPair(args.resumeMother); },
    args => { args.resumeMother.motherArtifact.parentArtifactHashes = ['0'.repeat(64)]; rehash(args.resumeMother.motherArtifact); },
    args => { delete args.resumeMother.motherArtifact.payload.timing; rehash(args.resumeMother.motherArtifact); },
    args => { args.resumeMother.motherArtifact.status = 'needs_evidence'; rehash(args.resumeMother.motherArtifact); },
  ];
  for (const mutate of mutations) {
    const args = structuredClone(original); mutate(args); const calls = [], events = [];
    await assert.rejects(runTextPipeline({ ...args, call: async request => { calls.push(request); return textV2Fixture(request); }, checkpoint: async event => events.push(event) }), /母稿恢复/);
    assert.equal(calls.length, 0); assert.equal(events.length, 0);
  }
});

test('a continuation failure remains bounded and cannot manufacture downstream drafts or audits', async () => {
  const args = await interruptedMother(), calls = [], events = [];
  await assert.rejects(runTextPipeline({ ...args, checkpoint: async event => events.push(event), call: async request => {
    calls.push(request.stage); throw new Error('Explicit synthetic second platform failure');
  } }), /second platform failure/);
  assert.deepEqual(calls, ['platform']);
  assert.deepEqual(events.filter(event => event.type === 'artifact').map(event => event.stage), ['intake', 'mother']);
  assert(!events.some(event => ['drafts_frozen', 'review', 'revision'].includes(event.type)));
});

test('cancelled mother continuation never starts a new call or emits a reused artifact', async () => {
  const args = await interruptedMother(), controller = new AbortController(), calls = [], events = [];
  controller.abort(); args.context.signal = controller.signal;
  await assert.rejects(runTextPipeline({ ...args, call: async request => { calls.push(request); return textV2Fixture(request); }, checkpoint: async event => events.push(event) }), /取消/);
  assert.equal(calls.length, 0); assert.equal(events.length, 0);
});
