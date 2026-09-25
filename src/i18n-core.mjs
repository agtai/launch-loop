import app from './locales/app.en.json' with { type: 'json' };
import workspaces from './locales/workspaces.en.json' with { type: 'json' };
import catalog from './locales/catalog.en.json' with { type: 'json' };
import messages from './locales/messages.en.json' with { type: 'json' };

export const languageStorageKey = 'launch-loop.ui-language';
export const englishMessages = Object.freeze({ ...catalog, ...messages, ...app, ...workspaces });
export const normalizeLocale = value => value === 'en' ? 'en' : 'zh';
const tokenPattern = /\{([a-zA-Z][\w]*)\}/g;
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const interpolate = (value, params) => value.replace(tokenPattern, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
const templates = Object.entries(englishMessages).flatMap(([source, target]) => {
  const tokens = [...source.matchAll(tokenPattern)];
  if (!tokens.length) return [];
  let expression = '^', cursor = 0;
  for (const token of tokens) { expression += escapeRegex(source.slice(cursor, token.index)) + '([\\s\\S]*?)'; cursor = token.index + token[0].length; }
  expression += escapeRegex(source.slice(cursor)) + '$';
  return [{ source, regex: new RegExp(expression), keys: tokens.map(token => token[1]), target, specificity: source.length - tokens.reduce((length, token) => length + token[0].length, 0) }];
}).sort((a, b) => b.specificity - a.specificity);

/** Display translation only. Never pass editable user content through this function. */
export function translateText(source, locale = 'zh', params = {}) {
  if (typeof source !== 'string') return '';
  if (locale !== 'en') return interpolate(source, params);
  if (Object.hasOwn(englishMessages, source)) return interpolate(englishMessages[source], params);
  // Persisted server errors contain concrete filenames/counts, not UI-language state.
  // Match complete controlled templates rather than replacing fragments inside text.
  for (const template of templates) {
    const match = template.regex.exec(source);
    if (match) {
      const captured = Object.fromEntries(template.keys.map((key, index) => [key, match[index + 1]]));
      if (template.source === '生成规则状态 {value1}：{value2}') captured.value2 = captured.value2.split('；').map(issue => translateText(issue, locale)).join('; ');
      if (['文本阶段包含重复引用：{value1}。', '文本阶段引用了不存在的{value1}。', '文本阶段缺少{value1}。'].includes(template.source)) captured.value1 = translateText(captured.value1, locale);
      if (['{value1}网络中断或超时。', '{value1}被 LinkedIn 拒绝（HTTP {value2}）。', '{value1}返回了无法验证的数据。'].includes(template.source)) captured.value1 = translateText(captured.value1, locale);
      if (template.source === 'LinkedIn 提交结果无法确认（HTTP {value1}{value2}）。请先核对，禁止自动重发。') {
        const details = /^LinkedIn 提交结果无法确认（HTTP (\d{3})([^）]*)）/.exec(source);
        if (details) { captured.value1 = details[1]; captured.value2 = translateText(details[2], locale); }
      }
      return interpolate(template.target, { ...captured, ...params });
    }
  }
  return interpolate(source, params);
}

/** Used only on bundled catalog data; records, sources and drafts remain untouched. */
export function translateBuiltin(value, locale = 'zh') {
  if (locale !== 'en') return value;
  if (typeof value === 'string') return translateText(value, locale);
  if (Array.isArray(value)) return value.map(entry => translateBuiltin(entry, locale));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, translateBuiltin(entry, locale)]));
  return value;
}

export function formatDate(value, locale = 'zh') {
  if (value === null || value === undefined || value === '') return translateText('未知', locale);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'}).format(date);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date);
}
