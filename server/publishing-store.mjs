import { randomUUID } from 'node:crypto';
import * as v from './content-validation.mjs';

const fields = ['id', 'itemId', 'versionId', 'accountId', 'accountName', 'language', 'contentHash', 'status', 'platformId', 'url', 'createdAt', 'updatedAt', 'error'];
const identity = ['id', 'itemId', 'versionId', 'accountId', 'accountName', 'language', 'contentHash', 'createdAt', 'previewId', 'confirmationHash'];
const digest = value => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) v.bad('发布内容校验值无效。'); return value; };
export const postId = value => { if (typeof value !== 'string' || !/^urn:li:(?:share|ugcPost):[0-9]{1,40}$/.test(value)) v.bad('LinkedIn 未返回有效帖子 ID。'); return value; };
export const postUrl = value => `https://www.linkedin.com/feed/update/${postId(value)}/`;
const publicRecord = entry => Object.fromEntries(fields.map(key => [key, entry[key]]));
const guardKey = entry => v.hash(JSON.stringify([entry.accountId, entry.contentHash]));
// A fixed-size backup envelope reserves space BEFORE network I/O for a remote ID,
// URL and bounded error. A later content save cannot consume this reserved space.
const envelopeBytes = 4096;
function envelope(entry) {
  const result = { ...publicRecord(entry), previewId: entry.previewId, confirmationHash: entry.confirmationHash, padding: '' };
  const length = Buffer.byteLength(JSON.stringify(result));
  if (length > envelopeBytes) v.bad('发布记录超过容量限制。', 413);
  result.padding = ' '.repeat(envelopeBytes - length);
  return result;
}
function validateEntry(raw) {
  v.fields(raw, [...fields, 'previewId', 'confirmationHash', 'padding']);
  for (const key of ['id', 'itemId', 'versionId', 'accountId', 'previewId']) v.id(raw[key]);
  v.string(raw.accountName, 120, true); v.choice(raw.language, ['zh', 'en']);
  digest(raw.contentHash); digest(raw.confirmationHash);
  v.choice(raw.status, ['submitting', 'published', 'failed', 'unknown']);
  v.timestamp(raw.createdAt); v.timestamp(raw.updatedAt);
  if (raw.error !== null) v.string(raw.error, 180);
  if (raw.platformId !== null) postId(raw.platformId);
  if (raw.url !== null && (raw.platformId === null || raw.url !== postUrl(raw.platformId))) v.bad('发布链接与真实平台 ID 不一致。');
  if (raw.status === 'published' && (!raw.platformId || !raw.url)) v.bad('已发布记录缺少真实平台 ID。');
  if (raw.status === 'failed' && raw.platformId !== null) v.bad('失败记录不能丢弃已知平台结果。');
  const result = envelope(raw);
  if (raw.padding !== result.padding) v.bad('发布备份容量保留字段无效。');
  return result;
}
function merge(existing, incoming) {
  if (!existing) return incoming;
  if (identity.some(key => existing[key] !== incoming[key])) v.bad('备份试图改写已有发布记录的身份或版本指针。');
  if (existing.platformId && incoming.platformId && existing.platformId !== incoming.platformId) v.bad('同一发布记录包含冲突的平台 ID。');
  const rank = { failed: 0, submitting: 1, unknown: 1, published: 2 };
  if (rank[incoming.status] > rank[existing.status]) return incoming;
  if (rank[incoming.status] === rank[existing.status] && !existing.platformId && incoming.platformId) return incoming;
  return existing;
}

/** Called after the content migration; all operations use the same SQLite DB. */
export function createPublishingStore(db, { snapshot = () => {}, checkBackupSize = () => {} } = {}) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS publishing_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema_version INTEGER NOT NULL);
      INSERT OR IGNORE INTO publishing_meta VALUES (1,1);`);
    if (db.prepare('SELECT schema_version FROM publishing_meta WHERE singleton=1').get().schema_version !== 1) throw new Error('无法打开未知版本的发布数据库。');
    db.exec(`CREATE TABLE IF NOT EXISTS publishing_records (id TEXT PRIMARY KEY, preview_id TEXT NOT NULL UNIQUE, guard_key TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS publishing_guard ON publishing_records(guard_key,status);`);
    // No requests survive a process restart. An interrupted request may have reached LinkedIn.
    for (const row of db.prepare("SELECT payload FROM publishing_records WHERE status='submitting'").all()) {
      const entry = envelope({ ...JSON.parse(row.payload), status: 'unknown', updatedAt: new Date().toISOString(), error: '服务重启时上次提交尚未完成；结果未知，禁止自动重发，请先在 LinkedIn 核对。' });
      db.prepare('UPDATE publishing_records SET status=?,payload=? WHERE id=?').run(entry.status, JSON.stringify(entry), entry.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const entries = () => db.prepare('SELECT payload FROM publishing_records ORDER BY id').all().map(row => JSON.parse(row.payload));
  const find = id => { v.id(id); const row = db.prepare('SELECT payload FROM publishing_records WHERE id=?').get(id); if (!row) v.bad('找不到发布记录。', 404); return JSON.parse(row.payload); };
  const get = id => publicRecord(find(id));
  const list = () => entries().map(publicRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const epoch = () => db.prepare('SELECT restore_epoch FROM content_meta WHERE singleton=1').get().restore_epoch;
  const save = entry => db.prepare('INSERT INTO publishing_records VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload').run(entry.id, entry.previewId, guardKey(entry), entry.status, JSON.stringify(envelope(entry)));
  const transaction = operation => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); checkBackupSize(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  function byPreview(previewId, confirmationHash) {
    v.id(previewId); digest(confirmationHash);
    const row = db.prepare('SELECT payload FROM publishing_records WHERE preview_id=?').get(previewId);
    if (!row) return null;
    const entry = JSON.parse(row.payload);
    if (entry.confirmationHash !== confirmationHash) v.bad('发布确认凭证不匹配。', 403);
    return publicRecord(entry);
  }
  function begin(input, validate) {
    return transaction(() => {
      const previous = byPreview(input.previewId, input.confirmationHash);
      if (previous) return { record: previous, created: false };
      validate(); // Re-check account, immutable version bytes and restore epoch inside the lock.
      const prior = db.prepare("SELECT payload FROM publishing_records WHERE guard_key=? AND status IN ('submitting','published','unknown') LIMIT 1").get(guardKey(input));
      if (prior) v.bad('该账号的相同正文与图片已有提交或未知结果；请查看发布记录并先核对，不能重复发帖。', 409);
      if (entries().length >= 10000) v.bad('发布记录达到容量上限。', 413);
      snapshot('daily');
      const time = new Date().toISOString();
      const entry = validateEntry(envelope({ ...input, id: randomUUID(), status: 'submitting', platformId: null, url: null, createdAt: time, updatedAt: time, error: null }));
      save(entry);
      return { record: publicRecord(entry), created: true };
    });
  }
  function finish(id, patch) {
    return transaction(() => {
      const entry = find(id);
      if (entry.status === 'published') return publicRecord(entry);
      const next = validateEntry(envelope({ ...entry, ...patch, updatedAt: new Date().toISOString() }));
      save(next); return publicRecord(next);
    });
  }
  const assertCanRestore = () => { if (db.prepare("SELECT id FROM publishing_records WHERE status='submitting' LIMIT 1").get()) v.bad('正在提交 LinkedIn 发布，请等待结果后再恢复备份。', 409); };
  const exportAll = () => ({ schemaVersion: 1, records: entries() });
  function validateBackup(raw) {
    if (raw === undefined) return null;
    v.fields(raw, ['schemaVersion', 'records']);
    if (raw.schemaVersion !== 1) v.bad('未知的发布备份版本。');
    const incoming = v.unique(v.list(raw.records, validateEntry, 10000), entry => entry.id);
    v.unique(incoming, entry => entry.previewId);
    const current = new Map(entries().map(entry => [entry.id, entry]));
    const previews = new Map(entries().map(entry => [entry.previewId, entry.id]));
    for (const entry of incoming) {
      if (previews.has(entry.previewId) && previews.get(entry.previewId) !== entry.id) v.bad('发布确认记录冲突。');
      merge(current.get(entry.id), entry);
      current.set(entry.id, entry);
    }
    if (current.size > 10000) v.bad('合并后发布记录超过上限。', 413);
    return incoming;
  }
  // The owner supplies the transaction and pre-restore snapshot. Never erase facts.
  function restore(validated) {
    assertCanRestore();
    if (validated === null) return;
    for (let entry of validated) {
      if (entry.status === 'submitting') entry = envelope({ ...entry, status: 'unknown', error: '备份中仍在提交的记录结果未知；恢复不会重发，请先在 LinkedIn 核对。' });
      const row = db.prepare('SELECT payload FROM publishing_records WHERE id=?').get(entry.id);
      save(merge(row ? JSON.parse(row.payload) : null, entry));
    }
  }
  return { list, get, epoch, byPreview, begin, finish, exportAll, validateBackup, restore, assertCanRestore };
}
