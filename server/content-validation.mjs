import { createHash } from 'node:crypto';

export class ContentError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const bad = (message, status = 400) => { throw new ContentError(status, message); };
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const platforms = ['linkedin', 'x', 'xiaohongshu', 'zhihu', 'bilibili'];
export const languages = ['zh', 'en'];
export const kinds = ['linkedin_article', 'linkedin_post', 'article', 'post', 'thread'];
export const formats = ['short_post', 'long_article', 'thread'];
export const maxAssetBytes = 4 * 1024 * 1024;
export const maxContentItems = 10000;
export const maxContentVersions = 10000;
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function fields(value, required, optional = []) {
  if (!isObject(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) bad('内容字段不完整或包含无法识别的字段。');
  return value;
}
export function string(value, max = 20000, nonempty = false) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim()) || value.includes('\0')) bad('内容文字为空、类型无效或超过长度限制。');
  return value;
}
export function id(value) { if (typeof value !== 'string' || !/^[-a-zA-Z0-9_]{1,120}$/.test(value)) bad('内容 ID 无效。'); return value; }
export function integer(value, min = 0) { if (!Number.isSafeInteger(value) || value < min || value >= Number.MAX_SAFE_INTEGER) bad('内容版本或数值无效。'); return value; }
export function increment(value) { return integer(integer(value) + 1); }
export function capacity(itemCount, versionCount) {
  integer(itemCount); integer(versionCount);
  if (itemCount > maxContentItems || versionCount > maxContentVersions) bad('正式作品或版本数量达到可恢复备份的上限。');
}
export function timestamp(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) bad('内容时间必须是有效 UTC ISO 时间。'); return value; }
export function choice(value, options) { if (!options.includes(value)) bad('内容选项无效。'); return value; }
export function list(value, check, max = 100) { if (!Array.isArray(value) || value.length > max) bad('内容列表无效或过长。'); return value.map(check); }
export function unique(values, key = value => value) { if (new Set(values.map(key)).size !== values.length) bad('内容列表包含重复 ID 或选项。'); return values; }
export function url(value) {
  string(value, 2048, true);
  if (/[\s\\\u0000-\u001f\u007f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) bad('来源链接包含非法字符。');
  let parsed; try { parsed = new URL(value); } catch { bad('来源链接必须是完整 HTTP(S) 地址。'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !/^https?:\/\//i.test(value) || !parsed.hostname || parsed.username || parsed.password) bad('来源链接只支持不含凭据的 HTTP(S) 地址。');
  return value;
}
export function documents(value) {
  return unique(list(value, document => {
    fields(document, ['id', 'kind', 'title', 'blocks', 'postingNote']);
    const blocks = unique(list(document.blocks, block => {
      fields(block, ['id', 'type', 'text']);
      return { id: id(block.id), type: choice(block.type, ['paragraph', 'heading', 'list', 'quote']), text: string(block.text, 40000) };
    }, 500), block => block.id);
    return { id: id(document.id), kind: choice(document.kind, kinds), title: string(document.title, 1000), blocks, postingNote: string(document.postingNote, 4000) };
  }, 20), document => document.id);
}
function source(value) {
  const extras = { text: ['text'], url: ['url'], asset: ['assetId'], saved_version: ['itemId', 'versionId'] };
  if (!isObject(value) || !Object.hasOwn(extras, value.type)) bad('资料来源类型无效。');
  fields(value, ['id', 'label', 'type', ...extras[value.type]]);
  const result = { id: id(value.id), label: string(value.label, 500, true), type: value.type };
  if (value.type === 'text') result.text = string(value.text, 200000, true);
  if (value.type === 'url') result.url = url(value.url);
  if (value.type === 'asset') result.assetId = id(value.assetId);
  if (value.type === 'saved_version') { result.itemId = id(value.itemId); result.versionId = id(value.versionId); }
  return result;
}
const sources = value => unique(list(value, source), entry => entry.id);
const options = (value, allowed) => unique(list(value, entry => choice(entry, allowed)));
const textOptions = value => unique(list(value, entry => string(entry, 2000, true), 20));

export function content(value, formal = false) {
  fields(value, ['name', 'projectId', 'platform', 'language', 'brief', 'documents', 'sources', 'assetIds', 'rule', 'executions']);
  fields(value.brief, ['materials', 'purpose', 'audience', 'platforms', 'languages', 'formats', 'authorIdentity', 'styleTerms', 'lengthDepth', 'references']);
  const b = value.brief;
  const brief = { materials: sources(b.materials), purpose: string(b.purpose, 4000, true), audience: string(b.audience, 4000, true), platforms: options(b.platforms, platforms), languages: options(b.languages, languages), formats: options(b.formats, formats), authorIdentity: textOptions(b.authorIdentity), styleTerms: textOptions(b.styleTerms), lengthDepth: textOptions(b.lengthDepth), references: sources(b.references) };
  if (!brief.materials.length) bad('至少提供一份有效资料。');
  const platform = value.platform === null ? null : choice(value.platform, platforms);
  const language = value.language === null ? null : choice(value.language, languages);
  if (formal && (!platform || !language)) bad('默认平台和语言尚未确定，请先明确该稿件的平台与语言。');
  if ((platform && brief.platforms.length && !brief.platforms.includes(platform)) || (language && brief.languages.length && !brief.languages.includes(language))) bad('稿件平台或语言不在已选配置中。');
  const docs = documents(value.documents);
  if (platform && docs.some(doc => platform === 'linkedin' ? !['linkedin_article', 'linkedin_post'].includes(doc.kind) : doc.kind.startsWith('linkedin_'))) bad('文稿形式与平台不匹配，LinkedIn 长文与动态必须分别建模。');
  if (formal && (!docs.length || docs.some(doc => !doc.blocks.some(block => block.text.trim())))) bad('确认保存需要实际文稿正文。');
  let rule = null;
  if (value.rule !== null) {
    fields(value.rule, ['ruleSetVersion', 'fragmentIds', 'hash']);
    if (!/^[a-f0-9]{64}$/.test(value.rule.hash)) bad('规则 hash 必须是 SHA-256。');
    rule = { ruleSetVersion: string(value.rule.ruleSetVersion, 120, true), fragmentIds: unique(list(value.rule.fragmentIds, entry => string(entry, 160, true))), hash: value.rule.hash };
    if (!rule.fragmentIds.length) bad('规则元数据缺少片段。');
  }
  const executions = list(value.executions, execution => {
    fields(execution, ['provider', 'model', 'runId', 'stage', 'status', 'startedAt', 'finishedAt']);
    const result = { provider: id(execution.provider), model: string(execution.model, 120, true), runId: id(execution.runId), stage: choice(execution.stage, ['generation', 'review', 'revision', 'asset_generation']), status: choice(execution.status, ['started', 'succeeded', 'failed']), startedAt: timestamp(execution.startedAt), finishedAt: execution.finishedAt === null ? null : timestamp(execution.finishedAt) };
    if (!/^[\w./:-]+$/.test(result.model) || (result.status === 'started') !== (result.finishedAt === null) || (result.finishedAt && result.finishedAt < result.startedAt)) bad('执行元数据的模型或时间状态无效。');
    return result;
  }, 50);
  unique(executions, entry => `${entry.stage}:${entry.runId}`);
  if (executions.filter(entry => entry.stage === 'review').length > 1) bad('同一暂存稿只记录一轮自动审核；再次执行请新建暂存。');
  return { name: string(value.name, 500), projectId: value.projectId === null ? null : id(value.projectId), platform, language, brief, documents: docs, sources: sources(value.sources), assetIds: unique(list(value.assetIds, id, 30)), rule, executions };
}
export function temporary(value) { fields(value, ['initialDocuments', 'reviewFindings', 'prompt']); return { initialDocuments: documents(value.initialDocuments), reviewFindings: string(value.reviewFindings, 200000), prompt: string(value.prompt, 200000) }; }
export function base(value) { if (value === null) return null; fields(value, ['itemId', 'revision', 'versionId']); return { itemId: id(value.itemId), revision: integer(value.revision), versionId: id(value.versionId) }; }
export function assetMetadata(value) {
  fields(value, ['id', 'fileName', 'mimeType', 'byteLength', 'sha256', 'source', 'caption']);
  const fileName = string(value.fileName, 200, true);
  if (/[<>:"/\\|?*\u0000-\u001f\u007f]/.test(fileName) || fileName === '.' || fileName === '..' || /[. ]$/.test(fileName) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(fileName)) bad('素材文件名必须是安全的单个文件名。');
  const mimeType = choice(value.mimeType, ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/octet-stream']);
  const byteLength = integer(value.byteLength, 1);
  if (byteLength > maxAssetBytes) bad('单个素材超过 4 MiB。', 413);
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) bad('素材校验值无效。');
  fields(value.source, ['kind', 'url']);
  return { id: id(value.id), fileName, mimeType, byteLength, sha256: value.sha256, source: { kind: choice(value.source.kind, ['upload', 'generated']), url: value.source.url === null ? null : url(value.source.url) }, caption: string(value.caption, 4000) };
}
export function bytes(value) {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(maxAssetBytes / 3) * 4 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) bad('素材 Base64 无效或超过 4 MiB。');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length < 1 || decoded.length > maxAssetBytes || decoded.toString('base64') !== value) bad('素材 Base64 无效或超过 4 MiB。');
  return decoded;
}
export function allSources(draft) { return [...draft.brief.materials, ...draft.brief.references, ...draft.sources]; }
