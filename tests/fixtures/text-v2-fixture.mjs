// Explicit synthetic runner: no model, network, files, user material or publication.
import { hash } from '../../server/content-validation.mjs';

const copy = value => structuredClone(value);
export function fixtureContext(overrides = {}) {
  const source = 'The workshop checklist is a planned pilot. Production use has not been tested.';
  return {
    runId: 'synthetic-pipeline',
    brief: { purpose: 'Explain a planned workshop checklist pilot.', audience: 'Workshop shift leads', authorIdentity: [], styleTerms: [], lengthDepth: [] },
    options: {}, actualSources: [{ id: 'source1', role: 'material', type: 'text', text: source, sha256: hash(source) }],
    inputHash: hash(source), ...overrides,
  };
}
export const syntheticTextDocuments = language => [{
  id: 'feed', kind: 'linkedin_post', title: '', postingNote: '',
  blocks: [{ id: 'paragraph1', type: 'paragraph', text: language === 'zh' ? '车间清单试点仍在计划中，生产环境使用尚未测试。' : 'The workshop checklist is a planned pilot. Production use has not been tested.' }],
}];
const bindings = documents => documents.flatMap(document => [
  ...(document.title ? [{ documentId: document.id, blockId: '', field: 'title', claimIds: ['claim1'] }] : []),
  ...document.blocks.map(block => ({ documentId: document.id, blockId: block.id, field: 'text', claimIds: ['claim1'] })),
]);
const location = documents => ({ documentId: documents[0].id, blockId: documents[0].blocks[0].id, field: 'text', quote: documents[0].blocks[0].text, occurrence: 0 });
const imageBrief = () => ({ purpose: 'Explain a planned checklist pilot.', composition: 'Concept diagram of a checklist awaiting an operator decision.', elements: ['Blank checklist', 'Operator decision'], prohibitedImplications: ['No production validation', 'No claimed results'], textLanguage: 'none', text: '', altText: 'Concept diagram of the planned checklist pilot.', claimIds: ['claim1'], uploadedSourceIds: [] });

/** Matches both runTextPipeline.call and createGenerationService.testOnlyRunner. */
export async function textV2Fixture({ stage, payload }) {
  if (stage === 'mother') {
    const source = payload.actualSources.find(source => typeof source.text === 'string');
    const quote = source?.text?.slice(0, 1000) || '';
    return {
      status: 'ready', sourceLanguage: 'en', reason: 'This explicit synthetic test uses English source material.', spine: 'Describe the pilot without suggesting production validation.',
      editorialPlan: { readerTakeaway: 'The checklist is planned.', relevance: 'Shift leads can distinguish a pilot from production use.', mainClaim: 'A pilot is planned.', support: 'The supplied synthetic note.', omissions: 'No result metrics.', organization: 'Plan followed by untested boundary.', authorVoice: 'Neutral and factual.' },
      constraintLedger: [{ requirement: 'Preserve planned state', scope: 'All selected variants', resolution: 'State the pilot is planned and production is untested.', status: 'satisfied' }],
      claimLedger: [{ id: 'claim1', proposition: 'The workshop checklist is a planned pilot; production use is untested.', attribution: 'Synthetic source', scope: 'Workshop checklist pilot', conditions: 'Before production use', negation: 'Production use has not been tested', modality: 'planned', completionState: 'not tested', status: 'planned', evidenceRefs: [{ sourceId: source?.id ?? 'source1', quote, locator: 'Supplied synthetic source, first paragraph' }] }],
      termLedger: [{ conceptId: 'term1', source: 'pilot', zh: '试点', en: 'pilot', preserveSpelling: false, forbiddenAliases: [], explanationOnFirstUse: '', reason: 'Stable concept across languages.' }],
      blocks: [{ id: 'mother1', text: 'The workshop checklist is a planned pilot. Production use has not been tested.', claimIds: ['claim1'] }], unresolved: [],
    };
  }
  if (stage === 'platform') {
    const documents = syntheticTextDocuments(payload.sourceLanguage);
    return { documents, claimBindings: bindings(documents), decisions: ['Keep the planned-state qualification.'], imageBrief: imageBrief(), unresolved: [] };
  }
  if (stage === 'localization') {
    const documents = syntheticTextDocuments(payload.targetLanguage);
    return { documents, claimBindings: bindings(documents), localizationNotes: ['Translated the same planned-state claim.'], unresolved: [] };
  }
  if (stage === 'review') return {
    summary: 'Explicit synthetic review fixture; not a model quality judgment.', readerTakeaway: 'This synthetic post describes a planned pilot and its untested boundary.',
    editorialAssessment: ['purpose', 'hierarchy', 'coherence', 'voice'].map(dimension => ({ dimension, status: 'adequate', locations: [location(payload.initialDocuments)], rationale: 'The explicit synthetic post presents the plan alongside its production boundary.' })), findings: [], unresolved: [],
  };
  if (stage === 'revision') return {
    documents: copy(payload.initialDocuments), claimBindings: copy(payload.initialClaimBindings), resolvedFindingIds: [],
    findingResolutions: payload.relevantFindings.map(finding => ({ findingId: finding.id, disposition: 'retained_with_reason', locations: [], reason: 'Explicit test fixture leaves this finding for user review.' })),
    imageBrief: copy(payload.imageBrief), changes: [], unresolved: [],
  };
  if (stage === 'modification') return { replacement: 'Explicit synthetic replacement.', unresolved: [] };
  throw new Error(`Unsupported synthetic stage: ${stage}`);
}
