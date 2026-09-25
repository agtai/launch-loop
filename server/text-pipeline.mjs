import { randomUUID } from 'node:crypto';
import * as v from './content-validation.mjs';
import { canonical, sha256, RULE_SET_VERSION, CANDIDATE_VERSION } from '../rules/text/v2/catalog.mjs';

const copy = value => structuredClone(value);
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const text = (maxLength = 4000) => ({ type: 'string', maxLength });
const enumeration = values => ({ type: 'string', enum: values });
const array = (items, maxItems = 50) => ({ type: 'array', items, maxItems });
const strings = (maxItems = 40) => array(text(), maxItems);
const documentSchema = object({ id: text(120), kind: enumeration(['linkedin_post']), title: text(1000), blocks: array(object({ id: text(120), type: enumeration(['paragraph', 'heading', 'list', 'quote']), text: text(8000) }), 30), postingNote: text() });
const documentsSchema = array(documentSchema, 1);
const bindingSchema = object({ documentId: text(120), blockId: text(120), field: enumeration(['title', 'text']), claimIds: strings(24) });
const bindingsSchema = array(bindingSchema, 40);
const locationSchema = object({ documentId: text(120), blockId: text(120), field: enumeration(['title', 'text']), quote: text(2000), occurrence: { type: 'integer', minimum: 0, maximum: 100 } });
const locationsSchema = array(locationSchema, 8);
const imageSchema = object({ purpose: text(1200), composition: text(1500), elements: strings(12), prohibitedImplications: strings(12), textLanguage: enumeration(['zh', 'en', 'none']), text: text(1000), altText: text(1200), claimIds: strings(24), uploadedSourceIds: strings(8) });
const editorialDimensions = ['purpose', 'hierarchy', 'coherence', 'voice'];
const editorialSchema = array(object({ dimension: enumeration(editorialDimensions), status: enumeration(['adequate', 'needs_revision', 'not_assessable']), locations: locationsSchema, rationale: text(1200) }), 4);
const findingsSchema = array(object({ id: text(120), category: enumeration(['fidelity', 'evidence', 'terminology', 'purpose', 'hierarchy', 'coherence', 'voice', 'platform', 'residual', 'image']), severity: enumeration(['blocking', 'important', 'optional']), locations: locationsSchema, issue: text(2000), suggestion: text(2000), basis: object({ sourceIds: strings(), claimIds: strings(24), termIds: strings(18), ruleIds: strings() }), affectedVariants: strings(10) }), 30);

export const TEXT_PIPELINE_SCHEMAS = Object.freeze({
  mother: object({
    status: enumeration(['ready', 'needs_evidence', 'needs_resolution']), sourceLanguage: enumeration(['zh', 'en', 'und']), reason: text(1000), spine: text(1000),
    editorialPlan: object({ readerTakeaway: text(1000), relevance: text(1000), mainClaim: text(1000), support: text(1200), omissions: text(1000), organization: text(1000), authorVoice: text(1000) }),
    constraintLedger: array(object({ requirement: text(1000), scope: text(400), resolution: text(1000), status: enumeration(['satisfied', 'merged', 'needs_resolution', 'needs_evidence']) }), 20),
    claimLedger: array(object({ id: text(120), proposition: text(1000), attribution: text(400), scope: text(600), conditions: text(600), negation: text(400), modality: text(400), completionState: text(400), status: enumeration(['supported', 'attributed_claim', 'historical', 'planned', 'disputed', 'missing']), evidenceRefs: array(object({ sourceId: text(120), quote: text(1200), locator: text(600) }), 5) }), 24),
    termLedger: array(object({ conceptId: text(120), source: text(300), zh: text(300), en: text(300), preserveSpelling: { type: 'boolean' }, forbiddenAliases: strings(10), explanationOnFirstUse: text(600), reason: text(600) }), 18),
    blocks: array(object({ id: text(120), text: text(2000), claimIds: strings(24) }), 12), unresolved: strings(),
  }),
  platform: object({ documents: documentsSchema, claimBindings: bindingsSchema, decisions: strings(12), imageBrief: imageSchema, unresolved: strings() }),
  localization: object({ documents: documentsSchema, claimBindings: bindingsSchema, localizationNotes: strings(12), unresolved: strings() }),
  review: object({ summary: text(), readerTakeaway: text(1500), editorialAssessment: editorialSchema, findings: findingsSchema, unresolved: strings() }),
  revision: object({ documents: documentsSchema, claimBindings: bindingsSchema, resolvedFindingIds: strings(60), findingResolutions: array(object({ findingId: text(120), disposition: enumeration(['addressed', 'retained_with_reason', 'needs_user_input']), locations: locationsSchema, reason: text(1800) }), 60), imageBrief: imageSchema, changes: strings(20), unresolved: strings() }),
});

export const TEXT_STAGE_BUDGETS = Object.freeze({ mother: 300_000, platform: 240_000, localization: 180_000, review: 300_000, revision: 240_000 });

/** Counters use exactly the title/body join used by the publishing adapter. */
export function countTextDocuments(documents) {
  return documents.map(document => {
    const body = [document.title, ...document.blocks.map(block => block.text)].filter(value => value.trim()).join('\n\n');
    return { documentId: document.id, codePointLength: [...body].length, utf16Length: body.length, withinLocalLimit: body.length <= 3000, textHash: sha256(body) };
  });
}

function validateSchema(value, schema, at = 'output') {
  const fail = () => v.bad(`文本阶段结构无效：${at}。`, 502);
  if (schema.type === 'object') {
    if (!v.isObject(value) || schema.required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !Object.hasOwn(schema.properties, key))) fail();
    for (const [key, child] of Object.entries(schema.properties)) validateSchema(value[key], child, `${at}.${key}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > schema.maxItems) fail();
    value.forEach((item, index) => validateSchema(item, schema.items, `${at}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.includes('\0') || value.length > (schema.maxLength ?? Infinity) || (schema.enum && !schema.enum.includes(value))) fail();
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || value < schema.minimum || value > schema.maximum) fail();
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail();
  return copy(value);
}

function unique(values, field) {
  if (new Set(values).size !== values.length) v.bad(`文本阶段包含重复引用：${field}。`, 502);
  return values;
}
function refs(values, allowed, field) {
  unique(values, field);
  if (values.some(value => !allowed.includes(value))) v.bad(`文本阶段引用了不存在的${field}。`, 502);
}
function nonempty(value, field) { if (!value.trim()) v.bad(`文本阶段缺少${field}。`, 502); }
function sourceText(source) {
  if (typeof source.text === 'string') return source.text;
  if (Array.isArray(source.documents)) return source.documents.flatMap(document => [document.title, ...document.blocks.map(block => block.text)]).join('\n\n');
  return '';
}
function targetText(documents, location) {
  const document = documents.find(item => item.id === location.documentId);
  if (!document) v.bad('文本引用对应的文稿不存在。', 502);
  if (location.field === 'title') {
    if (location.blockId !== '') v.bad('标题引用不得假装正文段落。', 502);
    return document.title;
  }
  const block = document.blocks.find(item => item.id === location.blockId);
  if (!block) v.bad('文本引用对应的段落不存在。', 502);
  return block.text;
}

/** Models select an occurrence; the server calculates UTF-16 offsets exactly. */
export function locateTextQuote(documents, location) {
  const body = targetText(documents, location);
  nonempty(location.quote, '真实引文');
  let start = -1, from = 0;
  for (let index = 0; index <= location.occurrence; index++) {
    start = body.indexOf(location.quote, from);
    if (start < 0) v.bad('审核或修订引文不在绑定的实际正文中。', 502);
    from = start + Math.max(1, location.quote.length);
  }
  const end = start + location.quote.length;
  const splits = offset => offset > 0 && offset < body.length && /[\uD800-\uDBFF]/.test(body[offset - 1]) && /[\uDC00-\uDFFF]/.test(body[offset]);
  if (splits(start) || splits(end)) v.bad('文本引文不能拆开 Unicode 字符。', 502);
  return { ...location, start, end };
}

function validatedDocuments(raw, variant) {
  const documents = v.documents(raw);
  if (documents.length !== variant.documents.length || documents.some((document, index) => document.kind !== variant.documents[index].kind || !document.blocks.some(block => block.text.trim()))) v.bad('模型没有返回所选格式的完整实际正文。', 502);
  return documents;
}
function validatedBindings(bindings, documents, claimIds) {
  unique(bindings.map(binding => `${binding.documentId}:${binding.field}:${binding.blockId}`), '段落主张');
  for (const binding of bindings) { targetText(documents, binding); refs(binding.claimIds, claimIds, '主张'); }
  const expected = documents.flatMap(document => [
    ...(document.title.trim() ? [`${document.id}:title:`] : []),
    ...document.blocks.filter(block => block.text.trim()).map(block => `${document.id}:text:${block.id}`),
  ]);
  if (expected.some(key => !bindings.some(binding => key === `${binding.documentId}:${binding.field}:${binding.blockId}`))) v.bad('文本段落缺少主张对齐记录。', 502);
  return bindings;
}
function validateImage(brief, claimIds, sources) {
  refs(brief.claimIds, claimIds, '配图主张');
  refs(brief.uploadedSourceIds, sources.filter(source => source.kind === 'image').map(source => source.id), '上传图片');
  return brief;
}
function warningsFor(documents) {
  return countTextDocuments(documents).filter(count => !count.withinLocalLimit).map(count => `LinkedIn 动态正文超过 3000 限制（含标题：${count.codePointLength} 个 Unicode 字符，${count.utf16Length} 个 UTF-16 单位），需缩短后再发布。`);
}

function ruleSnapshot(variant) {
  return { variantId: variant.id, ruleMetadata: variant.ruleMetadata, sharedRuleMetadata: variant.sharedRuleMetadata, ruleManifest: variant.ruleManifest, instructions: variant.instructions, stageInstructions: variant.stageInstructions, auditChecks: variant.auditChecks, terminology: variant.terminology, options: variant.options, sharedOptions: variant.sharedOptions };
}
function resumeArtifact(raw, stage, runId, inputHash, status, variantId = null) {
  if (!v.isObject(raw)) v.bad('母稿恢复缺少原始工件。', 409);
  const required = ['runId', 'stage', 'ruleSetVersion', 'candidateVersion', 'inputHash', 'parentArtifactHashes', 'variantId', 'createdAt', 'status', 'payload', 'artifactHash'];
  if (required.some(key => !Object.hasOwn(raw, key)) || Object.keys(raw).some(key => !required.includes(key))) v.bad('母稿恢复工件字段不完整或已变化。', 409);
  const { artifactHash, ...envelope } = raw;
  if (typeof artifactHash !== 'string' || sha256(JSON.stringify(envelope)) !== artifactHash) v.bad('母稿恢复工件 hash 不匹配。', 409);
  if (raw.runId !== runId || raw.stage !== stage || raw.ruleSetVersion !== RULE_SET_VERSION || raw.candidateVersion !== CANDIDATE_VERSION || raw.inputHash !== inputHash || raw.variantId !== variantId || raw.status !== status || !v.isObject(raw.payload) || !Array.isArray(raw.parentArtifactHashes)) v.bad('母稿恢复不属于本任务、输入或规则版本。', 409);
  v.timestamp(raw.createdAt);
  return copy(raw);
}

/** Narrow same-run continuation only. The service permits the one explicit
 * platform retry; this is not a cross-job cache or a general stage-resume API. */
function validateMotherResume(resume, { runId, inputHash, context, inputs, sourceManifest, variants }) {
  if (!v.isObject(resume) || Object.keys(resume).length !== 2 || !Object.hasOwn(resume, 'intakeArtifact') || !Object.hasOwn(resume, 'motherArtifact') || !context.runId) v.bad('母稿恢复仅接受本任务的 intake 与 mother 工件。', 409);
  const intake = resumeArtifact(resume.intakeArtifact, 'intake', runId, inputHash, 'completed');
  const mother = resumeArtifact(resume.motherArtifact, 'mother', runId, inputHash, 'ready');
  if (intake.parentArtifactHashes.length || canonical(mother.parentArtifactHashes) !== canonical([intake.artifactHash])) v.bad('母稿恢复的父工件链不匹配。', 409);
  // The first expression is the generation service's readMaterials digest. The
  // second is this pure module's default when no service digest was supplied.
  // Both bind the complete source snapshots and original brief, not just quoted
  // excerpts or unverified source-supplied sha256 strings.
  const originalInputHashes = [
    sha256(canonical({ snapshots: context.actualSources ?? [], brief: context.brief })),
    sha256(canonical({ sources: inputs, brief: context.brief, options: context.options ?? {} })),
  ];
  if (!originalInputHashes.includes(inputHash)) v.bad('母稿恢复的实际来源或原始输入已变化。', 409);
  const manifestIdentity = manifest => {
    if (!Array.isArray(manifest) || manifest.some(source => !v.isObject(source) || !source.readAt)) v.bad('母稿恢复缺少原始来源清单。', 409);
    return manifest.map(source => { const { readAt, ...identity } = source; v.timestamp(readAt); return identity; });
  };
  if (canonical(manifestIdentity(intake.payload.sourceManifest)) !== canonical(manifestIdentity(sourceManifest))) v.bad('母稿恢复的来源 ID、角色、hash 或读取范围不匹配。', 409);
  if (canonical(intake.payload.ruleSnapshots) !== canonical(variants.map(ruleSnapshot)) || canonical(intake.payload.requestedVariants) !== canonical(variants.map(variant => variant.id))) v.bad('母稿恢复的完整规则快照或目标稿件已变化。', 409);
  const timing = mother.payload.timing;
  if (!v.isObject(timing) || Object.keys(timing).length !== 2 || !timing.startedAt || !timing.finishedAt) v.bad('母稿恢复缺少原始完成时间。', 409);
  v.timestamp(timing.startedAt); v.timestamp(timing.finishedAt);
  if (timing.startedAt < intake.createdAt || timing.finishedAt < timing.startedAt || timing.finishedAt > mother.createdAt) v.bad('母稿恢复的执行时间不一致。', 409);
  const { timing: _timing, ...output } = mother.payload;
  return { intake, mother, output: validateSchema(output, TEXT_PIPELINE_SCHEMAS.mother), timing: copy(timing) };
}

function savedTiming(artifact, earliest) {
  const timing = artifact.payload.timing;
  if (!v.isObject(timing) || Object.keys(timing).length !== 2) v.bad('冻结稿恢复缺少原始执行时间。', 409);
  v.timestamp(timing.startedAt); v.timestamp(timing.finishedAt);
  if (timing.startedAt < earliest || timing.finishedAt < timing.startedAt || timing.finishedAt > artifact.createdAt) v.bad('冻结稿恢复的执行时间不一致。', 409);
  return copy(timing);
}

function validateFrozenResume(raw, state) {
  const fields = ['intakeArtifact', 'motherArtifact', 'platformArtifact', 'draftArtifacts', 'reviewArtifacts'];
  if (!v.isObject(raw) || Object.keys(raw).length !== fields.length || fields.some(key => !Object.hasOwn(raw, key)) || !Array.isArray(raw.draftArtifacts) || !Array.isArray(raw.reviewArtifacts)) v.bad('冻结稿恢复仅接受原始完整冻结工件与已成功审核，不接受修订工件。', 409);
  const resumed = validateMotherResume({ intakeArtifact: raw.intakeArtifact, motherArtifact: raw.motherArtifact }, state);
  const { runId, inputHash, variants } = state;
  const platform = resumeArtifact(raw.platformArtifact, 'platform', runId, inputHash, 'completed');
  if (canonical(platform.parentArtifactHashes) !== canonical([resumed.mother.artifactHash]) || platform.payload.sourceLanguage !== resumed.output.sourceLanguage) v.bad('冻结稿恢复的平台来源链或源语言不一致。', 409);
  const { sourceLanguage: _language, timing: _timing, ...platformOutput } = platform.payload;
  validateSchema(platformOutput, TEXT_PIPELINE_SCHEMAS.platform);
  const platformTiming = savedTiming(platform, resumed.mother.createdAt);
  if (raw.draftArtifacts.length !== variants.length || raw.reviewArtifacts.length > variants.length) v.bad('冻结稿恢复缺少完整稿件或包含多次审核。', 409);
  const draftIds = raw.draftArtifacts.map(item => item?.variantId), reviewIds = raw.reviewArtifacts.map(item => item?.variantId);
  for (const ids of [draftIds, reviewIds]) if (new Set(ids).size !== ids.length || ids.some(id => !variants.some(variant => variant.id === id))) v.bad('冻结稿恢复含重复或未知稿件。', 409);
  const draftArtifacts = variants.map(variant => {
    const draft = resumeArtifact(raw.draftArtifacts.find(item => item.variantId === variant.id), 'draft', runId, inputHash, 'completed', variant.id);
    if (canonical(draft.parentArtifactHashes) !== canonical([resumed.mother.artifactHash, platform.artifactHash]) || draft.createdAt < platform.createdAt) v.bad('冻结稿恢复的父工件链不一致。', 409);
    const { localizationStatus, timing: _draftTiming, ...output } = draft.payload;
    validateSchema(output, TEXT_PIPELINE_SCHEMAS.localization); savedTiming(draft, resumed.mother.createdAt);
    const sameLanguage = variant.language === resumed.output.sourceLanguage;
    if (localizationStatus !== (sameLanguage ? 'skipped_same_language' : 'localized')) v.bad('冻结稿恢复的本地化状态不一致。', 409);
    if (sameLanguage && (canonical(output.documents) !== canonical(platformOutput.documents) || canonical(output.claimBindings) !== canonical(platformOutput.claimBindings) || output.localizationNotes.length || canonical(draft.payload.timing) !== canonical(platformTiming))) v.bad('冻结稿恢复的同语稿未逐字透传。', 409);
    return draft;
  });
  const reviewArtifacts = raw.reviewArtifacts.map(item => {
    const review = resumeArtifact(item, 'review', runId, inputHash, 'completed', item.variantId);
    const draft = draftArtifacts.find(candidate => candidate.variantId === item.variantId);
    if (canonical(review.parentArtifactHashes) !== canonical([draft.artifactHash, resumed.mother.artifactHash, ...draftArtifacts.filter(candidate => candidate !== draft).map(candidate => candidate.artifactHash)]) || draftArtifacts.some(candidate => review.createdAt < candidate.createdAt)) v.bad('冻结稿恢复的审核父链或时间不一致。', 409);
    return review;
  });
  return { resumed, platform, platformOutput, platformTiming, draftArtifacts, reviewArtifacts };
}

function validatedReview(raw, { variant, variants, draft, motherHash, frozenHash, sourceIds, claimIds, termIds }) {
  const review = validateSchema(raw, TEXT_PIPELINE_SCHEMAS.review);
  nonempty(review.summary, '审核总结'); nonempty(review.readerTakeaway, '实际读者收获');
  if (canonical(review.editorialAssessment.map(item => item.dimension).sort()) !== canonical([...editorialDimensions].sort())) v.bad('一次审核缺少完整编辑判断。', 502);
  for (const assessment of review.editorialAssessment) {
    nonempty(assessment.rationale, '编辑判断依据');
    if (assessment.status !== 'not_assessable' && !assessment.locations.length) v.bad('编辑判断缺少实际正文位置。', 502);
    assessment.locations = assessment.locations.map(location => locateTextQuote(draft.documents, location));
  }
  unique(review.findings.map(finding => v.id(finding.id)), '审核发现');
  if (review.editorialAssessment.some(item => item.status === 'needs_revision') && !review.findings.length) v.bad('编辑判断要求修订，但没有可定位的审核发现。', 502);
  for (const finding of review.findings) {
    if (!finding.locations.length) v.bad('审核发现缺少实际正文位置。', 502);
    finding.locations = finding.locations.map(location => locateTextQuote(draft.documents, location));
    Object.assign(finding, { documentId: finding.locations[0].documentId, blockId: finding.locations[0].blockId, quote: finding.locations[0].quote, variantId: variant.id });
    nonempty(finding.issue, '审核问题'); nonempty(finding.suggestion, '修改建议');
    refs(finding.basis.sourceIds, sourceIds, '审核来源'); refs(finding.basis.claimIds, claimIds, '审核主张'); refs(finding.basis.termIds, termIds, '审核术语'); refs(finding.basis.ruleIds, variant.ruleMetadata.fragmentIds, '审核规则');
    refs(finding.affectedVariants, variants.map(item => item.id), '受影响稿件');
    if (!finding.affectedVariants.includes(variant.id)) v.bad('审核发现必须包含当前受影响稿件。', 502);
    finding.id = `${variant.language}-${finding.id}`;
  }
  review.unresolved = [...new Set([...draft.unresolved, ...review.unresolved])];
  return Object.assign(review, { reviewedDraftHash: draft.artifactHash, motherHash, ruleHash: variant.ruleMetadata.hash, frozenHash, auditCount: 1, passNumber: 1 });
}

// Revalidate the persisted derived fields rather than trusting their presence.
function savedReview(raw, state) {
  const project = (value, schema) => {
    if (schema.type === 'object' && v.isObject(value)) return Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, project(value[key], child)]));
    if (schema.type === 'array' && Array.isArray(value)) return value.map(item => project(item, schema.items));
    return value;
  };
  const projected = project(raw, TEXT_PIPELINE_SCHEMAS.review);
  if (Array.isArray(projected?.findings)) for (const finding of projected.findings) {
    const prefix = `${state.variant.language}-`;
    if (typeof finding.id !== 'string' || !finding.id.startsWith(prefix)) v.bad('冻结稿恢复的审核发现 ID 不一致。', 409);
    finding.id = finding.id.slice(prefix.length);
  }
  const expected = validatedReview(projected, state);
  if (canonical(raw) !== canonical(expected)) v.bad('冻结稿恢复的审核引用、hash 或次数不一致。', 409);
  return copy(raw);
}

/** Pure orchestration. The owner of call/checkpoint owns all process, tmp and UI writes. */
export async function runTextPipeline({ variants, context, call, checkpoint = async () => {}, resumeMother, resumeFrozen }) {
  if (!Array.isArray(variants) || !variants.length || variants.length > 2 || variants.some(variant => variant.status !== 'ready' || variant.platform !== 'linkedin' || variant.ruleMetadata?.ruleSetVersion !== RULE_SET_VERSION || !variant.stageInstructions || !variant.sharedRuleMetadata || !variant.sharedOptions)) v.bad('本次文本管线需要完整的 LinkedIn v2 规则。');
  unique(variants.map(variant => variant.id), '稿件');
  if (typeof call !== 'function' || typeof checkpoint !== 'function' || !v.isObject(context)) v.bad('文本管线回调或上下文无效。');
  const runId = context.runId ?? randomUUID(), artifacts = [], drafts = [], reviews = [], finals = [];
  const active = () => { if (context.signal?.aborted) v.bad('文本生成已取消，迟到结果未被采用。', 409); };
  const emit = async event => { active(); await checkpoint(copy(event)); active(); };
  const inputs = (context.actualSources ?? []).map((source, index) => ({ ...copy(source), id: source.id ?? source.assetId ?? `source-${index + 1}` }));
  unique(inputs.map(source => source.id), '来源');
  const readAt = new Date().toISOString();
  let sourceManifest = inputs.map(source => ({ id: source.id, label: source.label ?? source.fileName ?? source.id, role: source.role ?? 'material', type: source.type ?? source.kind ?? 'text', sha256: source.sha256 ?? sha256(sourceText(source)), readAt, readScope: source.kind === 'image' ? 'attached_image' : 'supplied_snapshot_complete', version: source.versionId ?? source.version ?? null, locator: source.url ?? source.fileName ?? source.id }));
  const inputHash = context.inputHash ?? sha256(canonical({ sources: inputs, brief: context.brief, options: context.options ?? {} }));
  const brief = Object.fromEntries(['purpose', 'audience', 'authorIdentity', 'styleTerms', 'lengthDepth'].map(key => [key, copy(context.brief?.[key] ?? (['purpose', 'audience'].includes(key) ? '' : []))]));
  const common = { brief, options: copy(context.options ?? {}), inputHash };
  const requestedTargetLanguages = [...new Set(variants.map(variant => variant.language))].sort();
  async function artifact(stage, payload, parentArtifactHashes = [], variantId = null, status = 'completed') {
    const value = { runId, stage, ruleSetVersion: RULE_SET_VERSION, candidateVersion: CANDIDATE_VERSION, inputHash, parentArtifactHashes, variantId, createdAt: new Date().toISOString(), status, payload: copy(payload) };
    const artifactHash = sha256(JSON.stringify(value));
    const saved = { ...value, artifactHash };
    artifacts.push(saved);
    await emit({ type: 'artifact', stage, variantId, artifact: saved });
    return saved;
  }
  async function invoke(stage, variant, payload) {
    active();
    const startedAt = new Date().toISOString();
    await emit({ type: 'stage', stage, variantId: variant.id, startedAt });
    const sharedStage = stage === 'mother' || stage === 'platform';
    // The callback's variant identifies tmp/process ownership only. Do not pass
    // its target-language configuration into the shared writing-engine payload.
    const sharedConfiguration = sharedStage ? { options: variant.sharedOptions, requestedTargetLanguages } : {};
    const result = await call({ stage, variantId: variant.id, variant: copy(variant), payload: copy({ ...common, ...payload, ...sharedConfiguration, rules: variant.stageInstructions[stage], ruleMetadata: sharedStage ? variant.sharedRuleMetadata : variant.ruleMetadata }), schema: copy(TEXT_PIPELINE_SCHEMAS[stage]), timeoutMs: TEXT_STAGE_BUDGETS[stage] });
    active();
    return { result: validateSchema(result, TEXT_PIPELINE_SCHEMAS[stage]), startedAt, finishedAt: new Date().toISOString() };
  }
  if (resumeMother !== undefined && resumeFrozen !== undefined) v.bad('不能同时恢复母稿和冻结稿。', 409);
  const resumeState = { runId, inputHash, context, inputs, sourceManifest, variants };
  const frozen = resumeFrozen === undefined ? null : validateFrozenResume(resumeFrozen, resumeState);
  const resumed = frozen?.resumed ?? (resumeMother === undefined ? null : validateMotherResume(resumeMother, resumeState));
  let intake;
  if (resumed) {
    intake = resumed.intake; sourceManifest = copy(intake.payload.sourceManifest);
    artifacts.push(intake);
    await emit({ type: 'artifact', stage: 'intake', variantId: null, artifact: intake, reused: true });
  } else intake = await artifact('intake', { sourceManifest, ruleSnapshots: variants.map(ruleSnapshot), requestedVariants: variants.map(variant => variant.id) });
  async function blocked(status, unresolved, parent) {
    const blockedVariants = variants.map(variant => ({ variantId: variant.id, status, documents: [], auditCount: 0, downstream: 'not_run_blocked', unresolved }));
    const image = { intent: variants[0].options?.selectedOptions.includes('assets.uploaded') ? 'uploaded' : 'generate', status: 'not_prepared_blocked' };
    await artifact('blocked', { unresolved, variants: blockedVariants, image }, [parent.artifactHash], null, status);
    await emit({ type: 'blocked', stage: status, status, unresolved, variants: blockedVariants });
    return { status, variants: blockedVariants, sourceManifest, artifacts };
  }
  if (!inputs.some(source => source.role !== 'reference' && (sourceText(source).trim() || source.kind === 'image'))) return blocked('needs_evidence', ['没有可用的实际产品资料；链接或文件名不能代替已读正文。'], intake);
  if (!brief.purpose.trim() || !brief.audience.trim()) v.bad('写作目的和目标读者不能为空。');
  // The service stores the complete source snapshot. Refuse an excessive model
  // prompt explicitly, never silently clip facts or retry an unchanged timeout.
  if (canonical(inputs).length > 110000) v.bad('文本资料超过本轮模型输入预算，请缩小资料范围。', 413);
  const primary = variants[0];
  const motherCall = resumed ? { result: resumed.output, ...resumed.timing } : await invoke('mother', primary, {
    task: 'Prepare one shared mother draft in the actual source language. Choose sourceLanguage from the language of the actual material carrying the argument, unless the author explicitly instructs the mother draft itself to use another language. requestedTargetLanguages are later deliverables ONLY, never evidence of such an instruction; neither target ordering nor the language used to describe purpose/audience or fill the form determines the mother language. English material with an ordinary Chinese purpose/audience description therefore remains an English mother absent an explicit contrary mother-language instruction. Explain this choice using the actual source or exact explicit instruction. Perform semantic intake first: if core evidence is missing return needs_evidence; if explicit requirements are incompatible return needs_resolution, with empty blocks. No content review. When ready, write a concise complete internal argument, not a fact list. Keep only facts necessary to this purpose (normally <=12 claims, <=8 terms, <=6 compact paragraphs). Record a short editorialPlan and exact evidence quotations from actualSources; quotes are evidence, never invented. All missing non-core facts stay unresolved. Do not generate any platform/language variants yet. Each claim needs its source attribution, scope, conditions, negation, modality and completion state. IDs must contain only ASCII letters, digits, hyphen or underscore. Return concise strings, not repeated source summaries.',
    actualSources: inputs, sourceManifest,
  });
  const mother = motherCall.result;
  nonempty(mother.reason, '源语言选择理由');
  unique(mother.claimLedger.map(claim => v.id(claim.id)), '主张');
  unique(mother.termLedger.map(term => v.id(term.conceptId)), '术语');
  for (const claim of mother.claimLedger) {
    nonempty(claim.proposition, '事实主张');
    if (!['missing', 'disputed'].includes(claim.status) && !claim.evidenceRefs.length) v.bad('事实账本的主张缺少来源引用。', 502);
    for (const reference of claim.evidenceRefs) {
      const source = inputs.find(source => source.id === reference.sourceId);
      if (!source || !reference.locator.trim() || (source.kind !== 'image' && (!reference.quote.trim() || !sourceText(source).includes(reference.quote)))) v.bad('事实账本引用不在本次实际来源中。', 502);
    }
  }
  const claimIds = mother.claimLedger.map(claim => claim.id), termIds = mother.termLedger.map(term => term.conceptId);
  unique(mother.blocks.map(block => v.id(block.id)), '母稿段落');
  for (const block of mother.blocks) { nonempty(block.text, '母稿正文'); refs(block.claimIds, claimIds, '母稿主张'); }
  if (mother.status !== 'ready' && (mother.blocks.length || !mother.unresolved.length)) v.bad('受阻母稿不能包含伪造正文，且必须给出具体缺口。', 502);
  if (mother.status === 'ready' && (mother.sourceLanguage === 'und' || !mother.blocks.length || !mother.claimLedger.length || mother.constraintLedger.some(item => ['needs_evidence', 'needs_resolution'].includes(item.status)))) v.bad('母稿仍有核心缺口或互斥要求，不能标为 ready。', 502);
  let motherArtifact;
  if (resumed) {
    motherArtifact = resumed.mother; artifacts.push(motherArtifact);
    await emit({ type: 'artifact', stage: 'mother', variantId: null, artifact: motherArtifact, reused: true });
  } else motherArtifact = await artifact('mother', { ...mother, timing: { startedAt: motherCall.startedAt, finishedAt: motherCall.finishedAt } }, [intake.artifactHash], null, mother.status);
  if (mother.status !== 'ready') return blocked(mother.status, mother.unresolved, motherArtifact);
  nonempty(mother.spine, '共同主线');
  const shared = { sourceLanguage: mother.sourceLanguage, sourceLanguageReason: mother.reason, spine: mother.spine, editorialPlan: mother.editorialPlan, constraintLedger: mother.constraintLedger, claimLedger: mother.claimLedger, termLedger: mother.termLedger, motherHash: motherArtifact.artifactHash, sourceManifest };
  const platformCall = frozen ? { result: copy(frozen.platformOutput), ...frozen.platformTiming } : await invoke('platform', primary, {
    task: 'Adapt this one mother draft into one self-contained LinkedIn feed post IN its existing sourceLanguage. requestedTargetLanguages are later deliverables only; do not translate or choose a language from that list or the language of purpose/audience. Select and explain one useful argument; preserve essential relationships and conditions. Do not review. Return actual production documents/blocks and separate claimBindings for each nonempty title/body block (field=title uses blockId=""). IDs are ASCII letters/digits/hyphen/underscore. Nonempty title is publishable text and counts toward the 3000 UTF-16 limit; omit it only when no title is required. Internal labels never enter title/body. Return a factual image brief only; no image exists yet. Source claim IDs may be selected, never invented. Keep metadata concise: up to three short selection decisions, and a compact image brief without repeating these instructions or the full post.',
    ...shared, sourceManifest: sourceManifest.map(({ id, label, role, type }) => ({ id, label, role, type })), motherBlocks: mother.blocks, sourceUnresolved: mother.unresolved,
  });
  const platform = platformCall.result;
  platform.documents = validatedDocuments(platform.documents, primary);
  validatedBindings(platform.claimBindings, platform.documents, claimIds);
  validateImage(platform.imageBrief, claimIds, inputs);
  let platformArtifact;
  if (frozen) {
    platformArtifact = frozen.platform; artifacts.push(platformArtifact);
    await emit({ type: 'artifact', stage: 'platform', variantId: null, artifact: platformArtifact, reused: true });
  } else platformArtifact = await artifact('platform', { ...platform, sourceLanguage: mother.sourceLanguage, timing: { startedAt: platformCall.startedAt, finishedAt: platformCall.finishedAt } }, [motherArtifact.artifactHash]);
  const platformHash = platformArtifact.artifactHash;
  for (const variant of variants) {
    let initial, localizationStatus, timing;
    const originalDraft = frozen?.draftArtifacts.find(item => item.variantId === variant.id);
    if (originalDraft) {
      const { localizationStatus: originalStatus, timing: originalTiming, ...output } = originalDraft.payload;
      initial = copy(output); localizationStatus = originalStatus; timing = copy(originalTiming);
      initial.documents = validatedDocuments(initial.documents, variant);
      validatedBindings(initial.claimBindings, initial.documents, claimIds);
      if (canonical([...new Set(initial.claimBindings.flatMap(binding => binding.claimIds))].sort()) !== canonical([...new Set(platform.claimBindings.flatMap(binding => binding.claimIds))].sort())) v.bad('冻结稿恢复的主张集合与平台稿不一致。', 409);
    } else if (variant.language === mother.sourceLanguage) {
      initial = { documents: copy(platform.documents), claimBindings: copy(platform.claimBindings), localizationNotes: [], unresolved: [] };
      localizationStatus = 'skipped_same_language';
      timing = { startedAt: platformCall.startedAt, finishedAt: platformCall.finishedAt };
    } else {
      const localizedCall = await invoke('localization', variant, {
        task: 'Localize this platform draft into the target language. This is the same argument, not a new draft from scratch. Preserve claim selection, conditions, negation, modality, attribution and completion state. Use natural target-language wording and the shared termLedger. Return production documents plus claimBindings for all nonempty title/body blocks. Do not review or revise other languages. Never invent claim IDs or evidence.',
        ...shared, targetLanguage: variant.language, platformHash, platformDocuments: platform.documents, platformClaimBindings: platform.claimBindings, sourceUnresolved: [...mother.unresolved, ...platform.unresolved],
      });
      initial = localizedCall.result; localizationStatus = 'localized';
      timing = { startedAt: localizedCall.startedAt, finishedAt: localizedCall.finishedAt };
      initial.documents = validatedDocuments(initial.documents, variant);
      validatedBindings(initial.claimBindings, initial.documents, claimIds);
      const originalIds = [...new Set(platform.claimBindings.flatMap(binding => binding.claimIds))].sort();
      if (canonical([...new Set(initial.claimBindings.flatMap(binding => binding.claimIds))].sort()) !== canonical(originalIds)) v.bad('本地化主张集合与共同平台稿不一致。', 502);
    }
    const unresolved = [...new Set([...mother.unresolved, ...platform.unresolved, ...initial.unresolved, ...warningsFor(initial.documents)])];
    let draftArtifact;
    if (originalDraft) {
      if (canonical(originalDraft.payload) !== canonical({ ...initial, unresolved, localizationStatus, timing })) v.bad('冻结稿恢复的正文或未解决项已变化。', 409);
      draftArtifact = originalDraft; artifacts.push(draftArtifact);
      await emit({ type: 'artifact', stage: 'draft', variantId: variant.id, artifact: draftArtifact, reused: true });
    } else draftArtifact = await artifact('draft', { ...initial, unresolved, localizationStatus, timing }, [motherArtifact.artifactHash, platformHash], variant.id);
    drafts.push({ variantId: variant.id, documents: initial.documents, claimBindings: initial.claimBindings, artifactHash: draftArtifact.artifactHash, motherHash: motherArtifact.artifactHash, platformHash, localizationStatus, unresolved, counts: countTextDocuments(initial.documents), ...timing });
  }
  const frozenHash = sha256(canonical(drafts.map(draft => ({ variantId: draft.variantId, artifactHash: draft.artifactHash }))));
  const reviewState = variant => ({ variant, variants, draft: drafts.find(item => item.variantId === variant.id), motherHash: motherArtifact.artifactHash, frozenHash, sourceIds: inputs.map(source => source.id), claimIds, termIds });
  // Validate every existing successful audit before spending on a missing one.
  for (const saved of frozen?.reviewArtifacts ?? []) {
    const variant = variants.find(item => item.id === saved.variantId);
    const review = savedReview(saved.payload, reviewState(variant));
    reviews.push({ variantId: variant.id, review, artifactHash: saved.artifactHash });
    artifacts.push(saved);
    await emit({ type: 'artifact', stage: 'review', variantId: variant.id, artifact: saved, reused: true });
  }
  await emit({ type: frozen ? 'drafts_reused' : 'drafts_frozen', stage: 'drafts_frozen', drafts, ...(frozen ? { reused: true, frozenHash } : {}) });
  for (const variant of variants) {
    if (reviews.some(item => item.variantId === variant.id)) continue;
    const draft = drafts.find(item => item.variantId === variant.id);
    const reviewCall = await invoke('review', variant, {
      task: 'Perform this variant’s ONLY content review. Read the actual frozen draft as the target reader; give readerTakeaway and exactly four editorialAssessment entries: purpose, hierarchy, coherence, voice. Each adequate/needs_revision assessment cites exact real text locations; not_assessable explains why. Findings need exact quotes and occurrence (0 for first exact occurrence; server computes UTF-16 offsets). field=title uses blockId=""; field=text uses an actual block ID. Findings belong to CURRENT variant only; affectedVariants can include other frozen variants for shared facts/terms. Check all applicable rules once, including facts, editorial reasoning, localization and image brief. No rewriting, second review, fabricated quality score or forced finding count. Use only provided source/claim/term/rule IDs in basis. If no actual issue, findings can be empty; preserve uncertainties. Keep the response concise: one short reader takeaway, one short rationale and the shortest sufficient exact quote for each of the four editorial dimensions. Do not copy whole paragraphs when a short quote locates the evidence; use multiple locations when a relationship requires them. Keep the summary to at most 120 words. Report every actual issue without repeating identical explanations. frozenDrafts contains OTHER variants only; the current frozen draft is supplied exactly once in initialDocuments.',
      ...shared, sourceManifest: sourceManifest.map(({ id, label, role, type }) => ({ id, label, role, type })), variantId: variant.id, language: variant.language, actualSources: inputs, initialDocuments: draft.documents, claimBindings: draft.claimBindings, reviewedDraftHash: draft.artifactHash, frozenHash,
      frozenDrafts: drafts.filter(item => item.variantId !== variant.id).map(item => ({ variantId: item.variantId, documents: item.documents, claimBindings: item.claimBindings, artifactHash: item.artifactHash })), imageBrief: platform.imageBrief, unresolved: draft.unresolved, auditChecks: variant.auditChecks,
    });
    const review = validatedReview(reviewCall.result, reviewState(variant));
    const reviewArtifact = await artifact('review', review, [draft.artifactHash, motherArtifact.artifactHash, ...drafts.filter(item => item.variantId !== variant.id).map(item => item.artifactHash)], variant.id);
    reviews.push({ variantId: variant.id, review, artifactHash: reviewArtifact.artifactHash });
    await emit({ type: 'review', stage: 'review', variantId: variant.id, review, artifactHash: reviewArtifact.artifactHash, startedAt: reviewCall.startedAt, finishedAt: reviewCall.finishedAt });
  }
  // Barrier: no variant is revised until every frozen draft has one valid audit.
  const allFindings = reviews.flatMap(item => item.review.findings);
  unique(allFindings.map(finding => finding.id), '跨语言审核发现');
  for (const variant of variants) {
    const draft = drafts.find(item => item.variantId === variant.id), ownReview = reviews.find(item => item.variantId === variant.id).review;
    const relevantFindings = allFindings.filter(finding => finding.affectedVariants.includes(variant.id));
    const revisionCall = await invoke('revision', variant, {
      task: 'Revise this variant once using the complete collected audit set. Do NOT perform a new review. Resolve shared evidence/term issues consistently with all affected variants; language-specific issues stay local. Keep facts and scope fixed. Return production documents, claimBindings and one findingResolution for every relevant finding ID; addressed IDs exactly match resolvedFindingIds. Resolution locations quote actual final text with occurrence; deletion can have empty locations with a concrete reason. If there is no actionable finding, unchanged documents are valid: do not invent a change. Retained or needs_user_input findings stay unresolved. Update the image brief only where the supported final meaning requires it. No new claims or sources. Return unresolved uncertainties and describe actual changes separately.',
      ...shared, variantId: variant.id, language: variant.language, actualSources: inputs, initialDocuments: draft.documents, initialClaimBindings: draft.claimBindings, reviewedDraftHash: draft.artifactHash,
      allReviews: reviews.map(item => ({ variantId: item.variantId, ...item.review })), relevantFindings, imageBrief: platform.imageBrief,
      frozenDrafts: drafts.map(item => ({ variantId: item.variantId, documents: item.documents, claimBindings: item.claimBindings })),
      earlierRevisions: finals.map(item => ({ variantId: item.variantId, documents: item.documents, claimBindings: item.claimBindings, findingResolutions: item.findingResolutions })),
    });
    const revised = revisionCall.result;
    revised.documents = validatedDocuments(revised.documents, variant);
    validatedBindings(revised.claimBindings, revised.documents, claimIds);
    validateImage(revised.imageBrief, claimIds, inputs);
    const relevantIds = relevantFindings.map(finding => finding.id);
    refs(revised.resolvedFindingIds, relevantIds, '修订发现');
    refs(revised.findingResolutions.map(resolution => resolution.findingId), relevantIds, '发现处置');
    if (revised.findingResolutions.length !== relevantFindings.length) v.bad('修订没有处置每个适用审核发现。', 502);
    if (canonical(revised.findingResolutions.filter(resolution => resolution.disposition === 'addressed').map(resolution => resolution.findingId).sort()) !== canonical([...revised.resolvedFindingIds].sort())) v.bad('已解决发现与实际处置记录不一致。', 502);
    const changeStatus = canonical(revised.documents) === canonical(draft.documents) ? 'unchanged' : 'changed';
    for (const resolution of revised.findingResolutions) {
      nonempty(resolution.reason, '发现处置理由');
      resolution.locations = resolution.locations.map(location => locateTextQuote(revised.documents, location));
      const finding = relevantFindings.find(finding => finding.id === resolution.findingId);
      const imageChanged = finding.category === 'image' && canonical(revised.imageBrief) !== canonical(platform.imageBrief);
      if (resolution.disposition === 'addressed' && changeStatus === 'unchanged' && !imageChanged) v.bad('正文未改变，不能把审核发现标为已修改解决。', 502);
    }
    const unresolved = [...new Set([
      ...mother.unresolved, ...platform.unresolved, ...ownReview.unresolved,
      ...relevantFindings.filter(finding => !revised.resolvedFindingIds.includes(finding.id)).map(finding => finding.issue), ...revised.unresolved, ...warningsFor(revised.documents),
    ])];
    // A draft length warning may be cleared only by this deterministic recheck.
    const cleanUnresolved = unresolved.filter(message => !message.startsWith('LinkedIn 动态正文超过 3000 限制') || warningsFor(revised.documents).includes(message));
    const imageBrief = { ...revised.imageBrief, intent: variant.options.selectedOptions.includes('assets.uploaded') ? 'uploaded' : 'generate', status: variant.options.selectedOptions.includes('assets.uploaded') ? 'uploaded_input_only' : 'brief_only_not_generated', visualVerification: 'not_run', motherHash: motherArtifact.artifactHash, platformHash };
    const finalPayload = { ...revised, unresolved: cleanUnresolved, changeStatus, imageBrief, counts: countTextDocuments(revised.documents), review: ownReview, localizationStatus: draft.localizationStatus, motherHash: motherArtifact.artifactHash, platformHash, initialDraftHash: draft.artifactHash, auditCount: 1 };
    const finalArtifact = await artifact('revision', finalPayload, [draft.artifactHash, ...reviews.map(item => item.artifactHash)], variant.id);
    const final = { variantId: variant.id, ...finalPayload, artifactHash: finalArtifact.artifactHash, startedAt: revisionCall.startedAt, finishedAt: revisionCall.finishedAt };
    finals.push(final);
    await emit({ type: 'revision', stage: 'revision', ...final });
  }
  return { status: 'awaiting_confirmation', variants: finals, sourceManifest, sourceLanguage: mother.sourceLanguage, sourceLanguageReason: mother.reason, editorialPlan: mother.editorialPlan, claimLedger: mother.claimLedger, termLedger: mother.termLedger, artifacts };
}
