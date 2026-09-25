import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIntegratedTextRules } from '../server/text-rules-v2.mjs';
import { runTextPipeline, TEXT_STAGE_BUDGETS, countTextDocuments, locateTextQuote } from '../server/text-pipeline.mjs';
import { fixtureContext, textV2Fixture, syntheticTextDocuments } from './fixtures/text-v2-fixture.mjs';
import { sha256 } from '../rules/text/v2/catalog.mjs';

const rules = (languages = ['zh', 'en']) => resolveIntegratedTextRules({ platforms: ['linkedin'], languages, formats: ['short_post'] }).variants;
async function execute({ languages, change, context, checkpoint } = {}) {
  const calls = [], events = [];
  const result = await runTextPipeline({ variants: rules(languages), context: fixtureContext(context),
    call: async request => { calls.push(request); const value = await textV2Fixture(request); return change ? (await change(request, value)) ?? value : value; },
    checkpoint: async event => { events.push(event); await checkpoint?.(event); },
  });
  return { result, calls, events };
}
const finding = (request, overrides = {}) => ({
  id: 'finding1', category: 'voice', severity: 'optional', locations: [{ documentId: 'feed', blockId: 'paragraph1', field: 'text', quote: request.payload.initialDocuments[0].blocks[0].text, occurrence: 0 }],
  issue: 'Synthetic language-specific editorial issue.', suggestion: 'Review the synthetic wording.', basis: { sourceIds: ['source1'], claimIds: ['claim1'], termIds: [], ruleIds: ['base.core.v2'] }, affectedVariants: [request.variantId], ...overrides,
});

test('one shared mother/platform, source-language byte-preserving passthrough, all drafts freeze before exactly one review each', async () => {
  const { result, calls, events } = await execute();
  assert.equal(result.status, 'awaiting_confirmation');
  assert.equal(result.sourceLanguage, 'en');
  assert.deepEqual(calls.map(call => `${call.stage}:${call.variantId}`), ['mother:linkedin:zh', 'platform:linkedin:zh', 'localization:linkedin:zh', 'review:linkedin:zh', 'review:linkedin:en', 'revision:linkedin:zh', 'revision:linkedin:en']);
  const frozen = events.find(event => event.type === 'drafts_frozen');
  assert(frozen && frozen.drafts.length === 2);
  assert(events.indexOf(frozen) < events.findIndex(event => event.type === 'stage' && event.stage === 'review'));
  assert.deepEqual(frozen.drafts.find(draft => draft.variantId === 'linkedin:en').documents, syntheticTextDocuments('en'));
  assert.equal(frozen.drafts.find(draft => draft.variantId === 'linkedin:en').localizationStatus, 'skipped_same_language');
  assert.equal(frozen.drafts.find(draft => draft.variantId === 'linkedin:zh').localizationStatus, 'localized');
  assert.equal(new Set(frozen.drafts.map(draft => draft.motherHash)).size, 1);
  for (const final of result.variants) { assert.equal(final.auditCount, 1); assert.equal(final.changeStatus, 'unchanged'); assert.equal(final.review.auditCount, 1); }
  assert.equal(events.filter(event => event.type === 'review').length, 2);
  assert.equal(events.filter(event => event.type === 'revision').length, 2);
  assert(calls.every(call => call.timeoutMs === TEXT_STAGE_BUDGETS[call.stage] && call.timeoutMs <= 300000));
  const firstRevision = calls.find(call => call.stage === 'revision');
  assert.equal(firstRevision.payload.allReviews.length, 2);
});

test('single source-language request skips translation without fabricating a localization invocation', async () => {
  const { calls, result } = await execute({ languages: ['en'] });
  assert.deepEqual(calls.map(call => call.stage), ['mother', 'platform', 'review', 'revision']);
  assert.equal(result.variants.length, 1);
});

test('reversing target variants leaves shared-stage model instructions and source-language semantics unchanged', async () => {
  const captured = [];
  for (const variants of [rules(), rules().reverse()]) {
    const calls = [];
    const result = await runTextPipeline({ variants, context: fixtureContext({ brief: { ...fixtureContext().brief, purpose: '解释已计划的车间清单试点。', audience: '车间负责人。' } }), call: async request => {
      calls.push(request); return textV2Fixture(request);
    } });
    assert.equal(result.sourceLanguage, 'en');
    const snapshot = result.artifacts.find(item => item.stage === 'intake').payload.ruleSnapshots;
    assert.equal(snapshot.length, 2);
    for (const saved of snapshot) {
      assert(saved.instructions && saved.stageInstructions.mother && saved.stageInstructions.platform);
      assert(saved.ruleMetadata.fragmentIds.includes(`language.${saved.options.language}`));
    }
    for (const stage of ['mother', 'platform']) {
      const payload = calls.find(call => call.stage === stage).payload;
      assert.deepEqual(payload.requestedTargetLanguages, ['en', 'zh']);
      assert(!Object.hasOwn(payload.options, 'language'));
      assert(!Object.hasOwn(payload, 'requestedVariants'));
      assert(!payload.ruleMetadata.fragmentIds.some(id => id.startsWith('language.')));
      assert.doesNotMatch(payload.rules, /"language":"(?:zh|en)"/);
    }
    captured.push(calls.filter(call => ['mother', 'platform'].includes(call.stage)).map(({ stage, payload }) => ({
      stage, task: payload.task, brief: payload.brief, options: payload.options, actualSources: payload.actualSources,
      requestedTargetLanguages: payload.requestedTargetLanguages, rules: payload.rules, ruleMetadata: payload.ruleMetadata,
      sourceLanguage: payload.sourceLanguage, sourceLanguageReason: payload.sourceLanguageReason, motherBlocks: payload.motherBlocks,
      spine: payload.spine, editorialPlan: payload.editorialPlan, claimLedger: payload.claimLedger, termLedger: payload.termLedger,
    })));
  }
  assert.deepEqual(captured[0], captured[1]);
});

test('explicit mother-language instructions remain available without a hardcoded source-character classifier or new input field', async () => {
  const { result, calls } = await execute({ languages: ['en'], context: { brief: { ...fixtureContext().brief, purpose: 'Explain the plan. Explicit author instruction: write the shared mother draft in Chinese, then localize to English.' } }, change: (request, value) => {
    if (request.stage === 'mother') { value.sourceLanguage = 'zh'; value.reason = 'The explicit author instruction requests a Chinese mother despite the English source.'; }
  } });
  assert.equal(result.sourceLanguage, 'zh');
  assert.match(calls[0].payload.brief.purpose, /write the shared mother draft in Chinese/);
  assert.deepEqual(calls.filter(call => call.stage === 'localization').map(call => call.variantId), ['linkedin:en']);
});

test('a Chinese mother is selected by content, not the target ordering, and Chinese is passed through untouched', async () => {
  const { calls, events } = await execute({ change: (request, value) => { if (request.stage === 'mother') { value.sourceLanguage = 'zh'; value.reason = 'Synthetic Chinese source selection.'; } } });
  assert.deepEqual(calls.filter(call => call.stage === 'localization').map(call => call.variantId), ['linkedin:en']);
  const draft = events.find(event => event.type === 'drafts_frozen').drafts.find(draft => draft.variantId === 'linkedin:zh');
  assert.deepEqual(draft.documents, syntheticTextDocuments('zh')); assert.equal(draft.localizationStatus, 'skipped_same_language');
});

test('all evidence, ledgers and parent hashes survive in immutable artifact copies', async () => {
  const { result } = await execute({ checkpoint: event => { if (event.type === 'artifact') event.artifact.payload = 'callback mutation'; } });
  const mother = result.artifacts.find(artifact => artifact.stage === 'mother');
  assert.equal(mother.payload.claimLedger[0].evidenceRefs[0].sourceId, 'source1');
  assert(mother.payload.editorialPlan.readerTakeaway);
  for (const artifact of result.artifacts) {
    const { artifactHash, ...envelope } = artifact;
    assert.equal(sha256(JSON.stringify(envelope)), artifactHash);
    assert(artifact.parentArtifactHashes.every(parent => result.artifacts.some(candidate => candidate.artifactHash === parent)));
  }
  for (const final of result.artifacts.filter(artifact => artifact.stage === 'revision')) assert.equal(final.parentArtifactHashes.length, 3);
});

test('model receives actual sources once, compact brief metadata, and cannot mutate frozen inputs through callbacks', async () => {
  const source = fixtureContext().actualSources[0];
  const { calls, result } = await execute({ context: { brief: { ...fixtureContext().brief, materials: [{ text: source.text.repeat(10) }] } }, change: (request, value) => {
    if (request.stage === 'review') request.payload.initialDocuments[0].blocks[0].text = 'malicious callback mutation';
  } });
  assert(!Object.hasOwn(calls[0].payload.brief, 'materials'));
  assert.deepEqual(result.variants.find(final => final.variantId === 'linkedin:en').documents, syntheticTextDocuments('en'));
});

test('missing readable material blocks all downstream calls and preserves requested variants without fake drafts', async () => {
  const { result, calls } = await execute({ context: { actualSources: [{ id: 'link1', role: 'material', type: 'url', url: 'https://example.invalid/source' }] } });
  assert.equal(result.status, 'needs_evidence'); assert.equal(calls.length, 0);
  assert.equal(result.variants.length, 2);
  assert(result.variants.every(variant => variant.auditCount === 0 && variant.documents.length === 0 && variant.downstream === 'not_run_blocked'));
});

for (const status of ['needs_evidence', 'needs_resolution']) test(`semantic ${status} is explicit and never proceeds to drafting or audit`, async () => {
  const { result, calls } = await execute({ change: (request, value) => { if (request.stage === 'mother') { value.status = status; value.blocks = []; value.unresolved = ['Synthetic core requirement cannot be satisfied.']; } } });
  assert.equal(result.status, status); assert.deepEqual(calls.map(call => call.stage), ['mother']);
  assert(result.variants.every(variant => variant.auditCount === 0 && variant.documents.length === 0));
});

test('fabricated source quotation fails before platform writing and is not silently repaired', async () => {
  const stages = [];
  await assert.rejects(execute({ change: (request, value) => { stages.push(request.stage); if (request.stage === 'mother') value.claimLedger[0].evidenceRefs[0].quote = 'Invented source quotation.'; } }), /事实账本引用/);
  assert.deepEqual(stages, ['mother']);
});

test('unresolved contradictory constraints cannot be disguised as a ready mother', async () => {
  await assert.rejects(execute({ change: (request, value) => { if (request.stage === 'mother') value.constraintLedger[0].status = 'needs_resolution'; } }), /核心缺口或互斥/);
});

test('localization cannot omit or invent claim IDs, and every nonempty block must carry a binding', async () => {
  for (const mutation of [value => { value.claimBindings[0].claimIds = []; }, value => { value.claimBindings[0].claimIds = ['invented']; }, value => { value.claimBindings = []; }]) {
    await assert.rejects(execute({ change: (request, value) => { if (request.stage === 'localization') mutation(value); } }), /主张|段落/);
  }
});

test('review rejects nonexistent quotes/occurrences and never starts revision after a failed second audit', async () => {
  for (const invalid of [{ quote: 'Invented quote', occurrence: 0 }, { quote: syntheticTextDocuments('en')[0].blocks[0].text, occurrence: 1 }]) {
    const calls = [], events = [];
    await assert.rejects(runTextPipeline({ variants: rules(), context: fixtureContext(), checkpoint: async event => events.push(event), call: async request => {
      calls.push(request.stage);
      const value = await textV2Fixture(request);
      if (request.stage === 'review' && request.variantId === 'linkedin:en') value.findings = [finding(request, { locations: [{ documentId: 'feed', blockId: 'paragraph1', field: 'text', ...invalid }] })];
      return value;
    } }), /引文不在/);
    assert.equal(calls.filter(stage => stage === 'review').length, 2); assert(!calls.includes('revision'));
    assert.equal(events.filter(event => event.type === 'review').length, 1);
  }
});

test('quote offsets are exact UTF-16 positions, including repeated quotations and titles', () => {
  const docs = [{ ...syntheticTextDocuments('en')[0], title: 'A 😀 title', blocks: [{ id: 'paragraph1', type: 'paragraph', text: '😀 same / same' }] }];
  const result = locateTextQuote(docs, { documentId: 'feed', blockId: 'paragraph1', field: 'text', quote: 'same', occurrence: 1 });
  assert.equal(result.start, 10); assert.equal(result.end, 14);
  assert.equal(locateTextQuote(docs, { documentId: 'feed', blockId: '', field: 'title', quote: '😀', occurrence: 0 }).end, 4);
  assert.throws(() => locateTextQuote(docs, { documentId: 'feed', blockId: 'paragraph1', field: 'text', quote: '\uD83D', occurrence: 0 }), /Unicode/);
});

test('finding IDs are namespaced across audits; affected variants receive shared findings only', async () => {
  const { result, calls } = await execute({ change: (request, value) => {
    if (request.stage === 'review') value.findings = [finding(request, request.variantId === 'linkedin:zh' ? { affectedVariants: ['linkedin:zh', 'linkedin:en'], category: 'fidelity' } : {})];
  } });
  assert.deepEqual(calls.filter(call => call.stage === 'revision').map(call => call.payload.relevantFindings.map(item => item.id)), [['zh-finding1'], ['zh-finding1', 'en-finding1']]);
  assert(result.variants.every(final => final.unresolved.includes('Synthetic language-specific editorial issue.')));
  assert(result.variants.every(final => final.resolvedFindingIds.length === 0));
});

test('revision cannot claim nonexistent or undisposed findings or claim an unchanged issue was fixed', async () => {
  for (const mutate of [
    value => { value.resolvedFindingIds = ['invented']; },
    value => { value.findingResolutions = []; },
    value => { value.resolvedFindingIds = [value.findingResolutions[0].findingId]; value.findingResolutions[0].disposition = 'addressed'; },
  ]) await assert.rejects(execute({ languages: ['en'], change: (request, value) => {
    if (request.stage === 'review') value.findings = [finding(request)];
    if (request.stage === 'revision') mutate(value);
  } }), /修订发现|处置|正文未改变/);
});

test('successful resolution changes actual content, uses final text locations and retains the original review', async () => {
  const { result } = await execute({ languages: ['en'], change: (request, value) => {
    if (request.stage === 'review') value.findings = [finding(request)];
    if (request.stage === 'revision') {
      value.documents[0].blocks[0].text = 'The workshop checklist pilot is planned; production use remains untested.';
      value.resolvedFindingIds = ['en-finding1'];
      value.findingResolutions[0] = { findingId: 'en-finding1', disposition: 'addressed', locations: [{ documentId: 'feed', blockId: 'paragraph1', field: 'text', quote: value.documents[0].blocks[0].text, occurrence: 0 }], reason: 'Synthetic wording changed, retaining the qualification.' };
      value.changes = ['Edited the one paragraph.'];
    }
  } });
  const final = result.variants[0]; assert.equal(final.changeStatus, 'changed'); assert.equal(final.review.findings.length, 1);
  assert.notEqual(final.review.findings[0].quote, final.documents[0].blocks[0].text);
  assert.equal(final.findingResolutions[0].locations[0].start, 0);
});

test('counting matches publication title/block join, excludes postingNote, preserves emoji and flags rather than truncates', () => {
  const docs = [{ ...syntheticTextDocuments('en')[0], title: 'Title😀', postingNote: 'internal note'.repeat(500), blocks: [{ id: 'paragraph1', type: 'paragraph', text: 'x'.repeat(2992) }] }];
  const [count] = countTextDocuments(docs);
  assert.equal(count.utf16Length, 3001); assert.equal(count.codePointLength, 3000); assert.equal(count.withinLocalLimit, false);
  assert.equal(docs[0].blocks[0].text.length, 2992);
});

test('a failed call or checkpoint stops without retrying or manufacturing an audit', async () => {
  for (const failingStage of ['platform', 'review', 'revision']) {
    const called = [];
    await assert.rejects(execute({ change: request => { called.push(request.stage); if (request.stage === failingStage) throw new Error('synthetic failure'); } }), /synthetic failure/);
    assert.equal(called.filter(stage => stage === failingStage).length, 1);
    assert.equal(called.at(-1), failingStage);
  }
  const called = [];
  await assert.rejects(execute({ change: request => { called.push(request.stage); }, checkpoint: event => { if (event.type === 'drafts_frozen') throw new Error('disk failure'); } }), /disk failure/);
  assert(!called.includes('review'));
});

test('cancelled runs reject delayed output and never checkpoint it as a completed artifact', async () => {
  const controller = new AbortController(), events = [], calls = [];
  await assert.rejects(runTextPipeline({ variants: rules(), context: fixtureContext({ signal: controller.signal }), checkpoint: async event => events.push(event), call: async request => {
    calls.push(request.stage); const value = await textV2Fixture(request); controller.abort(); return value;
  } }), /取消/);
  assert.deepEqual(calls, ['mother']);
  assert(!events.some(event => event.type === 'artifact' && event.stage === 'mother'));
});
