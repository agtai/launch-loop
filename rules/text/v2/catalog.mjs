import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const RULE_SET_VERSION = 'text-v2.0.0';
export const CANDIDATE_VERSION = 'linkedin-text-candidate.0.2.1';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item;
});
const names = ['core', 'assets', 'linkedin', 'localization', 'audit-revision', 'author-system1'];
export const FILES = Object.freeze(Object.fromEntries(names.map(name => {
  const content = readFileSync(new URL(`./${name}.md`, import.meta.url), 'utf8');
  return [name, Object.freeze({ path: `rules/text/v2/${name}.md`, sha256: sha256(content), content })];
})));

export const GUARD = '生产规则 text-v2.0.0，来源 linkedin-text-candidate.0.2.1。仅执行当前 payload.task 阶段；历史候选状态不是本次执行状态。所有文字工件仅 tmp；不调用工具、不抓取 URL、不正式保存、不上传或发布。素材生成由独立适配器执行，本调用只写 brief。母稿、平台稿不单独审核；先冻结所有语言初稿，每份恰好一次审核，集齐后修订，不再审。只用本次实际已读资料作事实证据；规则里的产品例子及过去日期不能代替本次证据。';
export const OPTION_RULES = Object.freeze({
  'author.product_author': '产品作者视角；第一人称经历、归属和承诺必须有来源。',
  'author.team': '团队视角；团队经历、归属和承诺必须有来源。',
  'author.third_party': '第三方介绍视角；明确归属，不冒充产品作者。',
  'style.professional': '专业准确；解释必要术语，不堆宣传形容词。',
  'style.plain': '表达易懂；不删条件、否定、责任主体和作者判断。',
  'style.concise': '删完整重复和无内容包装，把篇幅给理解必需的关系，不追求最短。',
  'depth.brief': '简明且自足的主线和必要边界。',
  'depth.standard': '给理解主张必需的上下文、机制和依据。',
  'depth.detailed': '在普通动态容量内说明机制；与简短合选时主线加必要解释，不增稿。',
  'reference.structure_and_voice': '参考稿用于结构、判断与作者声音，旧事实与当前产品资料分别核查。',
  'assets.uploaded': '结合已上传实际图片；不可读时明确 unread，不凭文件名编造可见内容。',
  'assets.generate': '保留生成配图意图，本调用只交 brief_only_not_generated，不冒充图片完成。',
});
export const AUDIT_CHECKS = Object.freeze([
  'purpose:对照读者、目的和editorialPlan，判断实际正文完成了什么解释。',
  'hierarchy:有依据的主张、机制、例子、判断和边界能否相连，篇幅是否给了必要信息。',
  'evidence:数字、条件、否定、责任主体、情态和完成状态逐项对照来源与claimLedger。',
  'localization:对照另一语言冻结稿及termLedger，不扩大事实、不换作者判断。',
  'voice:以实际位置证明声音、指代或表达问题，不强迫故事、CTA或禁词替换。',
  'linkedin:普通feed、纯文本、自足、有效链接、占位符和确定性字符计数。',
  'image:核对实际上传图或尚未生成的brief；brief不能证明视觉验收。',
]);
