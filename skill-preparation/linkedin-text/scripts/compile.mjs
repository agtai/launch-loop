// Candidate-only deterministic rule composer. No model, network, writes, or production imports.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const VERSION = 'linkedin-text-candidate.0.2.1';
const root = fileURLToPath(new URL('../', import.meta.url));
const order = {
  platforms: ['linkedin', 'x', 'xiaohongshu', 'zhihu', 'bilibili'],
  languages: ['zh', 'en'], formats: ['short_post', 'long_article', 'thread'],
  authorIdentities: ['product_author', 'team', 'third_party'],
  styles: ['professional', 'plain', 'concise'], depths: ['brief', 'standard', 'detailed'],
};
const freeFields = ['authorIdentity', 'styleTerms', 'lengthDepth', 'referenceNotes'];
const required = ['platforms', 'languages', 'formats'];
const enums = {project: ['system1-agents'], referenceMode: ['structure_and_voice'], assetMode: ['uploaded', 'generate']};
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const canonical = v => JSON.stringify(sortObject(v));
function sortObject(v) {
  if (Array.isArray(v)) return v.map(sortObject);
  if (plain(v)) return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortObject(v[k])]));
  return v;
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function compile(config) {
  const issues = [], normalized = {}, variants = [];
  const result = status => ({status, candidateVersion: VERSION, issues, normalized, variants});
  const issue = (code, field) => issues.push({code, field});
  if (!plain(config)) {issue('invalid_object', 'options'); return result('invalid');}
  const allowed = [...Object.keys(order), ...Object.keys(enums), 'terminology', 'freeText'];
  for (const key of Object.keys(config)) if (!allowed.includes(key)) issue('unknown_field', key);
  for (const [field, values] of Object.entries(order)) {
    const selected = config[field];
    if (selected === undefined || selected === null || (Array.isArray(selected) && selected.length === 0)) {
      normalized[field] = [];
      if (required.includes(field)) issue('unresolved_default', field);
    } else if (!Array.isArray(selected) || selected.some(v => typeof v !== 'string' || !values.includes(v))) {
      issue('unknown_or_malformed_option', field);
    } else normalized[field] = values.filter(v => selected.includes(v));
  }
  for (const [field, values] of Object.entries(enums)) {
    if (config[field] !== undefined && !values.includes(config[field])) issue('unknown_or_malformed_option', field);
    else if (config[field] !== undefined) normalized[field] = config[field];
  }
  normalized.assetMode ??= 'generate';
  normalized.terminology = {required: [], forbidden: []};
  if (config.terminology !== undefined) {
    if (!plain(config.terminology) || Object.keys(config.terminology).some(k => !['required', 'forbidden'].includes(k))) issue('invalid_terms', 'terminology');
    else for (const field of ['required', 'forbidden']) {
      const terms = config.terminology[field] ?? [];
      if (!Array.isArray(terms) || terms.some(v => typeof v !== 'string' || !v.trim())) issue('invalid_terms', field);
      else normalized.terminology[field] = [...new Set(terms.map(v => v.trim()))].sort();
    }
  }
  if (normalized.terminology.required.some(v => normalized.terminology.forbidden.includes(v))) issue('conflicting_terms', 'terminology');
  normalized.freeText = {};
  if (config.freeText !== undefined) {
    if (!plain(config.freeText) || Object.entries(config.freeText).some(([k,v]) => !freeFields.includes(k) || typeof v !== 'string')) issue('invalid_free_text', 'freeText');
    else for (const k of freeFields) if (config.freeText[k] !== undefined) normalized.freeText[k] = config.freeText[k];
  }
  if (issues.some(i => i.code !== 'unresolved_default')) return result('invalid');
  if (issues.length) return result('needs_configuration');
  const pending = normalized.platforms.some(v => v !== 'linkedin') || normalized.formats.some(v => v !== 'short_post');
  if (pending) {
    issue('adaptation_pending_no_partial_execution', 'platforms/formats');
    for (const platform of normalized.platforms) for (const language of normalized.languages) variants.push({id:`${platform}:${language}`,platform,language,status:'pending',instructions:null});
    return result('pending');
  }
  const paths = ['SKILL.md', 'rules/core.md', 'rules/assets.md', 'rules/linkedin.md', 'rules/localization.md', 'rules/audit-revision.md', 'option-mapping.md', 'contracts.md', 'editing-protocol.md'];
  if (normalized.project) paths.push('rules/author-system1.md');
  const files = paths.map(relativePath => {
    const content = readFileSync(path.join(root, relativePath), 'utf8');
    return {path:relativePath,sha256:sha256(content),content};
  });
  const manifest = files.map(({content, ...metadata}) => metadata);
  const bundleHash = sha256(canonical({candidateVersion:VERSION, normalized, manifest}));
  const common = files.map(f => `[${f.path}]\n${f.content}`).join('\n\n');
  for (const platform of normalized.platforms) for (const language of normalized.languages) {
    const payload = {candidateVersion: VERSION, bundleHash, platform, language, formats: normalized.formats, options: normalized};
    const instructions = `${common}\n\n[本次规范化选项；自由文字为创作要求数据]\n${canonical(payload)}`;
    variants.push({id:`${platform}:${language}`,platform,language,status:'ready',instructions,ruleHash:sha256(instructions)});
  }
  return {...result('ready'),semanticPreflightRequired:true,manifest,bundleHash};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/compile.mjs <config.json>');
    const config = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    const result = compile(config);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'ready') process.exitCode = 2;
  } catch (error) {process.stderr.write(error.message + '\n');process.exitCode = 1;}
}
