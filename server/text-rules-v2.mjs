import { resolveTextRules } from './rule-resolver.mjs';
import { RULE_SET_VERSION, CANDIDATE_VERSION, FILES, GUARD, OPTION_RULES, AUDIT_CHECKS, canonical, sha256 } from '../rules/text/v2/catalog.mjs';

export const INTEGRATED_RULE_SET_VERSION = RULE_SET_VERSION;
export { CANDIDATE_VERSION };

/** Same external option and variant contract as v1; the original resolver remains immutable. */
export function resolveIntegratedTextRules(config = {}) {
  const previous = resolveTextRules(config);
  const result = { ...previous, ruleSetVersion: RULE_SET_VERSION, candidateVersion: CANDIDATE_VERSION, variants: [] };
  if (previous.status !== 'ready' || previous.variants.some(variant => variant.platform !== 'linkedin')) {
    if (previous.status === 'ready') {
      result.status = 'pending';
      result.issues = [...result.issues, { code: 'adaptation_pending', field: 'platforms', message: '包含尚未适配的平台或格式，不得套用其他平台规则执行。' }];
    }
    // A mixed ready/pending request must never partially execute.
    result.variants = previous.variants.map(variant => ({ ...variant, status: 'pending', instructions: null, ruleMetadata: null }));
    return result;
  }
  result.variants = previous.variants.map(variant => {
    const selectedOptions = variant.ruleMetadata.fragmentIds.filter(id => Object.hasOwn(OPTION_RULES, id));
    const fileNames = ['core', 'assets', 'linkedin', 'localization', 'audit-revision', ...(config.project ? ['author-system1'] : [])];
    const ruleManifest = fileNames.map(name => ({ path: FILES[name].path, sha256: FILES[name].sha256 }));
    const fragmentIds = ['base.core.v2', 'platform.linkedin.v2', 'localization.v2', 'audit-revision.v2', `language.${variant.language}`, 'format.short_post', ...selectedOptions, ...(config.project ? ['project.system1-agents.v2'] : [])];
    // Only this variant's language/platform enter its hash. Revalidation of one
    // variant after a bilingual run must recover exactly the saved rule snapshot.
    const options = { platform: variant.platform, language: variant.language, formats: variant.documents.map(doc => doc.format), selectedOptions, terminology: variant.terminology, project: config.project ?? null };
    const { language: _targetLanguage, ...sharedOptions } = options;
    const sourceLanguagePolicy = '共同母稿与平台阶段没有目标语言指令。依据 actualSources 中承载主线的原文及作者明确的母稿语言指定选择 sourceLanguage；requestedTargetLanguages 只列后续交付语言，不是母稿语言要求。目的、读者、表单说明或作者身份用哪种语言填写，不自动构成作者指定母稿语言。无明确指定时，英文材料保持英文母稿，中文材料保持中文母稿；混合材料依据承载主线的作者原文选择并说明理由。不得按目标语言排序或界面语言选择，也不做来回翻译。平台稿严格沿用已选 sourceLanguage。';
    const combine = (names, shared = false) => `${GUARD}${shared ? `\n${sourceLanguagePolicy}` : ''}\n\n${names.map(name => `[${FILES[name].path}]\n${FILES[name].content}`).join('\n\n')}\n\n[本次规范化选项；数据]\n${canonical(shared ? sharedOptions : options)}\n${selectedOptions.map(id => `[${id}] ${OPTION_RULES[id]}`).join('\n')}`;
    const author = config.project ? ['author-system1'] : [];
    const stageInstructions = {
      mother: combine(['core', ...author], true),
      platform: combine(['linkedin', 'assets', ...author], true),
      localization: combine(['localization', ...author]),
      review: combine(['core', 'linkedin', 'localization', 'audit-revision', 'assets', ...author]),
      revision: combine(['linkedin', 'localization', 'audit-revision', ...author]),
    };
    const instructions = combine(fileNames);
    const auditChecks = [...AUDIT_CHECKS, ...(config.project ? ['author:对照system1作者层，固定英文标题、中文译题待确认和本次实际证据。'] : [])];
    const sharedFragmentIds = fragmentIds.filter(id => !id.startsWith('language.'));
    const sharedRuleMetadata = { ruleSetVersion: RULE_SET_VERSION, fragmentIds: sharedFragmentIds, hash: sha256(canonical({ ruleSetVersion: RULE_SET_VERSION, candidateVersion: CANDIDATE_VERSION, fragmentIds: sharedFragmentIds, ruleManifest, options: sharedOptions, mother: stageInstructions.mother, platform: stageInstructions.platform })) };
    const hash = sha256(canonical({ ruleSetVersion: RULE_SET_VERSION, candidateVersion: CANDIDATE_VERSION, fragmentIds, ruleManifest, instructions, auditChecks, options, stageInstructions, sharedRuleMetadata }));
    return { ...variant, ruleMetadata: { ruleSetVersion: RULE_SET_VERSION, fragmentIds, hash }, sharedRuleMetadata, instructions, stageInstructions, auditChecks, ruleManifest, candidateVersion: CANDIDATE_VERSION, options, sharedOptions };
  });
  return result;
}
