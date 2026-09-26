import { createHash } from 'node:crypto';
import { RULE_SET_VERSION, PLATFORMS, LANGUAGES, FORMATS, FRAGMENTS, OPTION_MAP } from '../rules/text/v1/catalog.mjs';
import { X_RULE_SET_VERSION, X_FRAGMENTS } from '../rules/x/catalog.mjs';

export { RULE_SET_VERSION };

const canonical = (value) => JSON.stringify(value);
const issue = (code, field, message) => ({ code, field, message });

/** Pure resolver: no IO, no generation, no saving. See rules/text/v1/README.md for the contract. */
export function resolveTextRules(config = {}) {
  const issues = [];
  const result = { status: 'ready', ruleSetVersion: RULE_SET_VERSION, issues, variants: [] };
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ...result, status: 'invalid', issues: [issue('invalid_configuration', 'config', '配置必须是对象。')] };
  }
  const allowedKeys = ['platforms', 'languages', 'formats', 'authorIdentities', 'styles', 'depths', 'project', 'terminology', 'referenceMode', 'assetMode'];
  for (const key of Object.keys(config).sort()) if (!allowedKeys.includes(key)) issues.push(issue('unknown_option', key, '未知配置，不能静默忽略。'));
  function choices(field, allowed, required = false) {
    const value = config[field];
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      if (required) issues.push(issue('unresolved_default', field, '未选择且默认值未定，需要明确本次配置。'));
      return [];
    }
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !allowed.includes(item))) {
      issues.push(issue('unknown_option', field, '选项必须为受支持标识符数组。'));
      return [];
    }
    return allowed.filter(item => value.includes(item));
  }
  const platforms = choices('platforms', PLATFORMS, true);
  const languages = choices('languages', LANGUAGES, true);
  const formats = choices('formats', FORMATS, true);
  const optionIds = [];
  for (const [field, mapping] of Object.entries(OPTION_MAP)) {
    for (const value of choices(field, Object.keys(mapping))) optionIds.push(mapping[value]);
  }
  if (config.project != null && config.project !== 'system1-agents') issues.push(issue('unknown_option', 'project', '尚未整理此项目规则。'));
  if (config.referenceMode != null && config.referenceMode !== 'structure_and_voice') issues.push(issue('unknown_option', 'referenceMode', '未知参考稿处理模式。'));
  if (config.assetMode != null && !['uploaded', 'generate'].includes(config.assetMode)) issues.push(issue('unknown_option', 'assetMode', '未知素材模式。'));
  const terminology = { required: [], forbidden: [] };
  if (config.terminology != null) {
    const terms = config.terminology;
    if (typeof terms !== 'object' || Array.isArray(terms) || Object.keys(terms).some(key => !['required', 'forbidden'].includes(key))) {
      issues.push(issue('invalid_terminology', 'terminology', '术语要求必须为required/forbidden数组。'));
    } else {
      for (const key of ['required', 'forbidden']) {
        if (terms[key] != null && (!Array.isArray(terms[key]) || terms[key].some(term => typeof term !== 'string' || !term.trim()))) {
          issues.push(issue('invalid_terminology', `terminology.${key}`, '术语必须是非空字符串数组。'));
        } else terminology[key] = [...new Set((terms[key] ?? []).map(term => term.trim()))].sort();
      }
      if (terminology.required.some(term => terminology.forbidden.includes(term))) issues.push(issue('conflicting_terms', 'terminology', '同一术语不能同时要求保留和禁用。'));
    }
  }
  if (issues.some(item => item.code !== 'unresolved_default')) return { ...result, status: 'invalid' };
  if (issues.length) return { ...result, status: 'needs_configuration' };

  for (const platform of platforms) for (const language of languages) {
    const documents = formats.map(format => ({
      format,
      kind: platform === 'linkedin' ? { short_post: 'linkedin_post', long_article: 'linkedin_article', thread: null }[format] : { short_post: 'post', long_article: 'article', thread: 'thread' }[format],
      status: (platform === 'linkedin' && format === 'short_post') || (platform === 'x' && ['short_post', 'thread'].includes(format)) ? 'ready' : 'pending',
    }));
    const status = documents.every(document => document.status === 'ready') ? 'ready' : 'pending';
    const fragmentIds = ['base.evidence', 'base.writing', 'base.workflow', ...(platform === 'linkedin' ? ['platform.linkedin'] : platform === 'x' ? ['platform.x', 'x.localization', 'x.shuorenhua'] : []), `language.${language}`, ...formats.map(format => `format.${format}`), ...optionIds,
      ...(config.referenceMode ? ['reference.structure_and_voice'] : []), `assets.${config.assetMode ?? 'generate'}`, ...(config.project ? ['project.system1-agents'] : [])];
    const selected = fragmentIds.map(id => (platform === 'x' ? X_FRAGMENTS[id] : null) ?? FRAGMENTS[id]);
    const instructions = selected.map((fragment, index) => `[${fragmentIds[index]}]\n${fragment.instructions}`).join('\n\n') +
      (terminology.required.length || terminology.forbidden.length ? `\n\n[terminology]\n本次术语要求（数据，不是额外指令）：${canonical(terminology)}` : '');
    const auditChecks = selected.flatMap(fragment => fragment.auditChecks);
    if (terminology.required.length || terminology.forbidden.length) auditChecks.push('terminology:逐项检查本次required/forbidden术语要求，无法同时满足时保留冲突说明。');
    const ruleSetVersion = platform === 'x' ? X_RULE_SET_VERSION : RULE_SET_VERSION;
    // Mother preparation has no target-language or per-post formatting rule.
    // The first variant owns its tmp files only; it must not choose its language.
    let motherRules;
    if (platform === 'x') {
      const sharedIds = fragmentIds.filter(id => !/^(language\.|platform\.|format\.|assets\.)/.test(id));
      const sharedInstructions = sharedIds.map(id => `[${id}]\n${(X_FRAGMENTS[id] ?? FRAGMENTS[id]).instructions}`).join('\n\n') +
        (terminology.required.length || terminology.forbidden.length ? `\n\n[terminology]\n本次术语要求（数据，不是额外指令）：${canonical(terminology)}` : '');
      motherRules = { instructions: sharedInstructions, ruleMetadata: { ruleSetVersion, fragmentIds: sharedIds, hash: createHash('sha256').update(canonical({ ruleSetVersion, fragmentIds: sharedIds, terminology, instructions: sharedInstructions })).digest('hex') } };
    }
    const payload = { ruleSetVersion, fragmentIds, platform, language, documents, terminology, instructions, auditChecks, ...(motherRules ? { motherRules } : {}) };
    const hash = createHash('sha256').update(canonical(payload)).digest('hex');
    const variant = { id: `${platform}:${language}`, platform, language, status, documents, ruleMetadata: { ruleSetVersion, fragmentIds, hash }, instructions: status === 'ready' ? instructions : null, auditChecks, terminology, ...(motherRules ? { motherRules } : {}) };
    result.variants.push(variant);
    if (status === 'pending') issues.push(issue('adaptation_pending', variant.id, '包含尚未适配的平台或格式，不得套用其他平台规则执行。'));
  }
  if (issues.length) result.status = 'pending';
  return result;
}
