import parseTweet from './x-text-vendor.mjs';

export const X_TEXT_VERSION = 'twitter-text-3.1.0/config-v3';
export const X_MAX_WEIGHT = 280;
export const X_MAX_THREAD_POSTS = 25; // Workbench limit, not a claimed platform maximum.

/** Count the exact submitted string; parseTweet uses NFC internally but never changes stored text. */
export function countXText(text) {
  if (typeof text !== 'string') throw new TypeError('X post text must be a string.');
  const result = parseTweet(text);
  return { ...result, maxWeightedLength: X_MAX_WEIGHT, maxLength: X_MAX_WEIGHT, remaining: X_MAX_WEIGHT - result.weightedLength, version: X_TEXT_VERSION };
}

/** Deterministic format/count checks. Never trims, truncates, reorders or splits a post. */
export function validateXDocument(document, { allowEmpty = false, checkLength = true } = {}) {
  const issues = [];
  if (!document || !['post', 'thread'].includes(document.kind)) return ['X 仅支持普通帖子或串帖。'];
  if (document.title !== '') issues.push('X 文稿标题必须为空；实际发布文字全部写入逐帖正文。');
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];
  if (allowEmpty && blocks.length === 0) return issues;
  if (document.kind === 'post' && blocks.length !== 1) issues.push('X 普通帖子必须恰有一条帖子。');
  if (document.kind === 'thread' && (blocks.length < 2 || blocks.length > X_MAX_THREAD_POSTS)) issues.push(`X 串帖须有 2–${X_MAX_THREAD_POSTS} 条帖子（工作台范围）。`);
  const ids = new Set();
  blocks.forEach((block, index) => {
    const label = `第 ${index + 1} 条`;
    if (!block || block.type !== 'x_post' || typeof block.text !== 'string') { issues.push(`${label}缺少明确的 X 帖子正文。`); return; }
    if (typeof block.id !== 'string' || !/^[-a-zA-Z0-9_]{1,120}$/.test(block.id) || ids.has(block.id)) issues.push(`${label}帖子 ID 无效或重复。`);
    ids.add(block.id);
    if (!block.text.trim()) issues.push(`${label}正文为空。`);
    if (checkLength) {
      const count = countXText(block.text);
      if (!count.valid) issues.push(count.weightedLength > X_MAX_WEIGHT ? `${label}超过 X 加权字数上限：${count.weightedLength}/${X_MAX_WEIGHT}；请修订，系统不会截断或自动拆帖。` : `${label}含 X 不接受的字符或为空。`);
    }
    if (block.assetIds != null && (!Array.isArray(block.assetIds) || block.assetIds.length > 1 || block.assetIds.some(id => typeof id !== 'string'))) issues.push(`${label}首版最多关联一张图片。`);
  });
  return issues;
}

export function xTextChecks(documents) {
  return documents.map(document => ({ documentId: document.id, issues: validateXDocument(document), posts: document.blocks.map((block, index) => ({ blockId: block.id, order: index + 1, ...countXText(block.text) })) }));
}
