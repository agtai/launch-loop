import { randomUUID } from 'node:crypto';
import * as v from './content-validation.mjs';
import { xPostUrl } from './x-api.mjs';

const digest = value => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) v.bad('X 发布校验值无效。'); return value; };
const xid = value => { if (typeof value !== 'string' || !/^[0-9]{1,19}$/.test(value)) v.bad('X 平台 ID 无效。'); return value; };
const identity = ['id', 'itemId', 'versionId', 'documentId', 'accountId', 'accountName', 'language', 'kind', 'planHash', 'contentHash', 'createdAt'];
const stepIdentity = ['blockId', 'index', 'contentHash', 'textHash', 'assetId', 'assetHash', 'metadataHash'];
const stepFields = [...stepIdentity, 'status', 'phase', 'platformId', 'platformTextHash', 'replyTo', 'url', 'mediaId', 'mediaKey', 'mediaExpiresAt', 'error'];
const recordFields = [...identity, 'updatedAt', 'revision', 'status', 'active', 'cancelRequested', 'steps', 'attempts', 'padding'];
const publicRecord = entry => { const { attempts, padding, ...record } = entry; return structuredClone(record); };
function aggregate(entry) {
  if (entry.steps.every(step => step.status === 'published')) return 'published';
  if (entry.steps.some(step => step.status === 'unknown')) return 'unknown';
  if (entry.active) return 'running';
  if (entry.steps.some(step => step.status === 'published')) return 'partial';
  return entry.cancelRequested ? 'cancelled' : 'failed';
}
// Reserve room for results BEFORE any remote write; backup capacity cannot be
// exhausted by a concurrent formal-content save after the remote post succeeds.
function envelope(entry) {
  const result = { ...entry, status: aggregate(entry), padding: '' };
  const capacity = 8192 + entry.steps.length * 2048;
  const size = Buffer.byteLength(JSON.stringify(result));
  if (size > capacity) v.bad('X 发布记录超过预留容量。', 413);
  result.padding = ' '.repeat(capacity - size);
  return result;
}
function validateStep(step, index) {
  v.fields(step, stepFields);
  v.id(step.blockId); if (step.index !== index) v.bad('X 发布步骤顺序无效。');
  for (const key of ['contentHash', 'textHash', 'metadataHash']) digest(step[key]);
  if (step.assetId !== null) v.id(step.assetId);
  if (step.assetHash !== null) digest(step.assetHash);
  if ((step.assetId === null) !== (step.assetHash === null) || (index > 0 && step.assetId !== null)) v.bad('X 图片关联无效。');
  v.choice(step.status, ['pending', 'uploading', 'submitting', 'published', 'failed', 'unknown']);
  v.choice(step.phase, ['pending', 'media', 'post', 'done']);
  for (const key of ['platformId', 'mediaId', 'replyTo']) if (step[key] !== null) xid(step[key]);
  if (step.platformTextHash !== null) digest(step.platformTextHash);
  if (step.mediaKey !== null && (typeof step.mediaKey !== 'string' || !/^[0-9_]{1,50}$/.test(step.mediaKey))) v.bad('X 媒体键无效。');
  if (step.mediaExpiresAt !== null) v.timestamp(step.mediaExpiresAt);
  if (step.url !== null && (!step.platformId || step.url !== xPostUrl(step.platformId))) v.bad('X 发布链接与平台 ID 不一致。');
  if (step.error !== null) v.string(step.error, 180);
  if (step.status === 'published' && (!step.platformId || !step.platformTextHash || !step.url || step.phase !== 'done')) v.bad('X 已发布步骤缺少平台证据。');
  if (['pending', 'uploading', 'submitting', 'failed'].includes(step.status) && step.platformId !== null) v.bad('X 未确认步骤包含冲突的平台结果。');
  if (step.mediaId !== null && (!step.assetId || !step.mediaExpiresAt)) v.bad('X 媒体缺少绑定或有效期。');
  return step;
}
function validateEntry(raw) {
  v.fields(raw, recordFields);
  for (const key of ['id', 'itemId', 'versionId', 'documentId']) v.id(raw[key]);
  xid(raw.accountId); v.string(raw.accountName, 120, true); v.choice(raw.language, ['zh', 'en']); v.choice(raw.kind, ['post', 'thread']);
  digest(raw.planHash); digest(raw.contentHash); v.timestamp(raw.createdAt); v.timestamp(raw.updatedAt); v.integer(raw.revision, 1);
  if (typeof raw.active !== 'boolean' || typeof raw.cancelRequested !== 'boolean') v.bad('X 发布状态无效。');
  const steps = v.unique(v.list(raw.steps, (step) => validateStep(step, raw.steps.indexOf(step)), 25), step => step.blockId);
  if (steps.length < (raw.kind === 'thread' ? 2 : 1) || (raw.kind === 'post' && steps.length !== 1)) v.bad('X 内容形式与发布步骤数量不一致。');
  let gap = false;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (gap && step.status !== 'pending') v.bad('X 串帖成功前缀或中断位置无效。');
    if (step.status !== 'pending' && step.replyTo !== (i ? steps[i - 1].platformId : null)) v.bad('X 串帖回复关系无效。');
    if (step.status !== 'published') gap = true;
  }
  v.unique(v.list(raw.attempts, attempt => {
    v.fields(attempt, ['previewId', 'confirmationHash']); v.id(attempt.previewId); digest(attempt.confirmationHash); return attempt;
  }, 25), entry => entry.previewId);
  if (!raw.attempts.length || raw.status !== aggregate(raw)) v.bad('X 发布汇总状态无效。');
  const result = envelope(raw);
  if (raw.padding !== result.padding) v.bad('X 发布备份容量字段无效。');
  return result;
}
function recovered(raw) {
  return envelope({ ...raw, active: false, steps: raw.steps.map(step => step.status === 'submitting'
    ? { ...step, status: 'unknown', error: '服务或备份中断时 X 提交未完成，结果未知；禁止自动重发。' }
    : step.status === 'uploading' ? { ...step, status: 'failed', error: '图片准备中断；尚未提交帖子，需新预览确认后继续。' } : step) });
}
function merge(existing, incoming) {
  if (!existing) return recovered(incoming);
  if (identity.some(key => existing[key] !== incoming[key]) || existing.steps.length !== incoming.steps.length) v.bad('X 备份不能改写发布身份或版本指针。');
  const rank = { pending: 0, failed: 1, uploading: 1, submitting: 2, unknown: 2, published: 3 };
  const steps = existing.steps.map((old, i) => {
    const next = incoming.steps[i];
    if (stepIdentity.some(key => old[key] !== next[key])) v.bad('X 备份不能改写发布文字、图片或步骤顺序。');
    if (old.platformId && next.platformId && (old.platformId !== next.platformId || (old.platformTextHash && next.platformTextHash && old.platformTextHash !== next.platformTextHash))) v.bad('X 备份包含冲突的平台结果。');
    return rank[next.status] > rank[old.status] || (rank[next.status] === rank[old.status] && !old.platformId && next.platformId) ? next : old;
  });
  const attempts = new Map(existing.attempts.map(item => [item.previewId, item]));
  for (const attempt of incoming.attempts) {
    if (attempts.has(attempt.previewId) && attempts.get(attempt.previewId).confirmationHash !== attempt.confirmationHash) v.bad('X 发布确认记录冲突。');
    attempts.set(attempt.previewId, attempt);
  }
  return validateEntry(recovered({ ...existing, steps, attempts: [...attempts.values()], revision: v.increment(Math.max(existing.revision, incoming.revision)), cancelRequested: existing.cancelRequested || incoming.cancelRequested, updatedAt: existing.updatedAt > incoming.updatedAt ? existing.updatedAt : incoming.updatedAt }));
}

/** Explicit additive schema, same DB/restore transaction as content and LinkedIn. */
export function createXPublishingStore(db, { snapshot = () => {}, checkBackupSize = () => {} } = {}) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS x_publishing_meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1),schema_version INTEGER NOT NULL);
      INSERT OR IGNORE INTO x_publishing_meta VALUES(1,1);
      CREATE TABLE IF NOT EXISTS x_publishing_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL);`);
    if (db.prepare('SELECT schema_version FROM x_publishing_meta WHERE singleton=1').get().schema_version !== 1) throw new Error('未知的 X 发布数据库版本。');
    for (const row of db.prepare('SELECT payload FROM x_publishing_records').all()) {
      const old = JSON.parse(row.payload);
      if (old.active) db.prepare('UPDATE x_publishing_records SET payload=? WHERE id=?').run(JSON.stringify(validateEntry(recovered({ ...old, revision: v.increment(old.revision), updatedAt: new Date().toISOString() }))), old.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const entries = () => db.prepare('SELECT payload FROM x_publishing_records ORDER BY id').all().map(row => JSON.parse(row.payload));
  const find = id => { v.id(id); const row = db.prepare('SELECT payload FROM x_publishing_records WHERE id=?').get(id); if (!row) v.bad('找不到 X 发布记录。', 404); return JSON.parse(row.payload); };
  const save = entry => { const value = validateEntry(envelope(entry)); db.prepare('INSERT INTO x_publishing_records VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(value.id, JSON.stringify(value)); return publicRecord(value); };
  const transaction = operation => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); checkBackupSize(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const get = id => publicRecord(find(id));
  const list = () => entries().map(publicRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const epoch = () => db.prepare('SELECT restore_epoch FROM content_meta WHERE singleton=1').get().restore_epoch;
  function byPreview(previewId, confirmationHash) {
    v.id(previewId); digest(confirmationHash);
    for (const entry of entries()) for (const attempt of entry.attempts) if (attempt.previewId === previewId) {
      if (attempt.confirmationHash !== confirmationHash) v.bad('X 发布确认凭证不匹配。', 403);
      return publicRecord(entry);
    }
    return null;
  }
  function begin(input, validate) {
    return transaction(() => {
      const prior = byPreview(input.previewId, input.confirmationHash);
      if (prior) return { record: prior, created: false };
      validate();
      const attempt = { previewId: input.previewId, confirmationHash: input.confirmationHash };
      if (input.resumeRecordId) {
        const old = find(input.resumeRecordId);
        if (old.revision !== input.expectedRevision || old.active || old.status === 'published' || old.steps.some(step => ['unknown', 'submitting'].includes(step.status)) || old.planHash !== input.planHash) v.bad('X 续发记录已变化或含未知结果，请重新核对。', 409);
        snapshot('daily');
        return { created: true, record: save({ ...old, active: true, cancelRequested: false, attempts: [...old.attempts, attempt], revision: v.increment(old.revision), updatedAt: new Date().toISOString(), steps: old.steps.map(step => step.status === 'published' ? step : { ...step, status: 'pending', phase: 'pending', error: null, replyTo: null }) }) };
      }
      const all = entries();
      if (all.length >= 10000) v.bad('X 发布记录达到容量上限。', 413);
      // Prevent changed metadata/order or a concurrent media upload from hiding
      // an already reserved/published step. Continue the immutable original plan.
      for (const old of all) if (old.accountId === input.accountId && (old.contentHash === input.contentHash || old.steps.some(step => (old.active || ['published', 'submitting', 'unknown'].includes(step.status)) && input.steps.some(candidate => step.textHash === candidate.textHash && step.assetHash === candidate.assetHash)))) v.bad('该 X 内容已有发布记录；请查看记录并明确确认续发，不可新建重复提交。', 409);
      snapshot('daily');
      const time = new Date().toISOString();
      const { previewId, confirmationHash, resumeRecordId, expectedRevision, ...metadata } = input;
      const entry = { ...metadata, id: randomUUID(), createdAt: time, updatedAt: time, revision: 1, active: true, cancelRequested: false, attempts: [attempt], steps: input.steps.map((step, index) => ({ ...step, index, status: 'pending', phase: 'pending', platformId: null, platformTextHash: null, replyTo: null, url: null, mediaId: null, mediaKey: null, mediaExpiresAt: null, error: null })) };
      return { record: save(entry), created: true };
    });
  }
  function change(id, update) { return transaction(() => { const old = find(id); return save({ ...update(old), revision: v.increment(old.revision), updatedAt: new Date().toISOString() }); }); }
  const setStep = (id, index, patch) => change(id, old => {
    if (!Number.isInteger(index) || !old.steps[index]) v.bad('X 发布步骤不存在。');
    if (old.steps[index].status === 'published') return old;
    return { ...old, steps: old.steps.map((step, i) => i === index ? { ...step, ...patch } : step) };
  });
  const stop = id => change(id, old => recovered(old));
  const cancel = id => change(id, old => ({ ...old, cancelRequested: true }));
  const assertCanRestore = () => { if (entries().some(entry => entry.active)) v.bad('正在执行 X 发布，请等待当前请求结果后再恢复备份。', 409); };
  const exportAll = () => ({ schemaVersion: 1, records: entries() });
  function validateBackup(raw) {
    if (raw === undefined) return null;
    v.fields(raw, ['schemaVersion', 'records']); if (raw.schemaVersion !== 1) v.bad('未知的 X 发布备份版本。');
    const incoming = v.unique(v.list(raw.records, validateEntry, 10000), item => item.id);
    const all = new Map(entries().map(item => [item.id, item]));
    for (const item of incoming) all.set(item.id, merge(all.get(item.id), item));
    if (all.size > 10000) v.bad('恢复后 X 发布记录超过上限。', 413);
    v.unique([...all.values()].flatMap(item => item.attempts), attempt => attempt.previewId);
    return incoming;
  }
  function restore(validated) {
    assertCanRestore(); if (validated === null) return;
    for (const entry of validated) {
      const row = db.prepare('SELECT payload FROM x_publishing_records WHERE id=?').get(entry.id);
      save(merge(row ? JSON.parse(row.payload) : null, entry));
    }
  }
  return { get, list, epoch, byPreview, begin, setStep, stop, cancel, assertCanRestore, exportAll, validateBackup, restore };
}
