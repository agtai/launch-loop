import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, lstatSync, realpathSync, readdirSync, openSync, closeSync, fsyncSync } from 'node:fs';
import * as v from './content-validation.mjs';

const now = () => new Date().toISOString();
const emptyTemporary = () => ({ initialDocuments: [], reviewFindings: '', prompt: '' });
const revisionAfter = (localCounter, excludedRevision) => {
  const next = v.increment(localCounter);
  return next === excludedRevision ? v.increment(next) : next;
};

/** Content uses separate tables; unconfirmed payloads and bytes never touch SQLite/WAL. */
export function createContentStore(db, dataDir, { snapshot, checkBackupSize }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS content_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), schema_version INTEGER NOT NULL, restore_epoch INTEGER NOT NULL, revision_counter INTEGER NOT NULL);
      INSERT OR IGNORE INTO content_meta VALUES (1,1,0,0);`);
    if (db.prepare('SELECT schema_version FROM content_meta WHERE singleton=1').get().schema_version !== 1) throw new Error('无法打开未知版本的内容数据库。');
    db.exec(`CREATE TABLE IF NOT EXISTS content_items (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS content_versions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, number INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(item_id,number));
      CREATE TABLE IF NOT EXISTS content_assets (version_id TEXT NOT NULL, asset_id TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(version_id,asset_id));
      CREATE TABLE IF NOT EXISTS content_confirmations (tmp_id TEXT PRIMARY KEY, tmp_revision INTEGER NOT NULL, item_id TEXT NOT NULL, version_id TEXT NOT NULL, confirmed_at TEXT NOT NULL);`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }

  const root = realpathSync(dataDir);
  // Never traverse an existing symlink/junction inside the managed temporary root.
  function directory(parts) {
    let current = root;
    for (const part of parts) {
      current = path.join(current, part);
      if (!existsSync(current)) mkdirSync(current);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(current) !== current) v.bad('暂存目录包含不安全的文件系统链接。', 403);
    }
    return current;
  }
  function tmpPath(tmpId, assetId) {
    const parts = ['tmp', 'content'];
    if (tmpId !== undefined) parts.push(v.id(tmpId));
    const dir = directory(parts);
    const file = path.join(dir, assetId === undefined ? 'draft.json' : `${v.id(assetId)}.bin`);
    if (existsSync(file)) {
      const stat = lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1 || realpathSync(file) !== file) v.bad('暂存文件包含不安全的文件系统链接。', 403);
    }
    return file;
  }
  function atomicWrite(filename, data) {
    const staging = path.join(path.dirname(filename), `write-${randomUUID()}.partial`);
    let descriptor;
    try {
      descriptor = openSync(staging, 'wx', 0o600);
      writeFileSync(descriptor, data);
      fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined;
      renameSync(staging, filename);
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (existsSync(staging)) unlinkSync(staging);
    }
  }
  function withLock(tmpId, callback) {
    tmpPath(tmpId);
    // SQLite owns the cross-process lock and releases it on process death.
    // This transaction stores no tmp payload, prompt, review, or asset bytes.
    try { db.exec('BEGIN IMMEDIATE'); } catch (error) { if (error.errcode === 5) v.bad('暂存正在另一个请求中修改，请稍后重试。', 409); throw error; }
    try { const result = callback(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const epoch = () => db.prepare('SELECT restore_epoch FROM content_meta WHERE singleton=1').get().restore_epoch;
  const nextRevision = excludedRevision => {
    const next = revisionAfter(db.prepare('SELECT revision_counter FROM content_meta WHERE singleton=1').get().revision_counter, excludedRevision);
    db.prepare('UPDATE content_meta SET revision_counter=? WHERE singleton=1').run(next);
    return next;
  };
  const header = itemId => {
    v.id(itemId);
    const row = db.prepare('SELECT payload FROM content_items WHERE id=?').get(itemId);
    if (!row) v.bad('找不到该正式作品。', 404);
    return JSON.parse(row.payload);
  };
  const version = (itemId, versionId) => {
    v.id(itemId); v.id(versionId);
    const row = db.prepare('SELECT payload FROM content_versions WHERE item_id=? AND id=?').get(itemId, versionId);
    if (!row) v.bad('找不到该正式版本。', 404);
    return JSON.parse(row.payload);
  };
  function item(itemId) {
    return { ...header(itemId), versions: db.prepare('SELECT payload FROM content_versions WHERE item_id=? ORDER BY number').all(itemId).map(row => JSON.parse(row.payload)) };
  }
  function list() {
    return db.prepare('SELECT payload FROM content_items ORDER BY id').all().map(row => {
      const h = JSON.parse(row.payload), current = version(h.id, h.currentVersionId);
      return { id: h.id, name: current.content.name, platform: current.content.platform, language: current.content.language, revision: h.revision, updatedAt: h.updatedAt, currentVersionId: h.currentVersionId, versionNumber: current.number };
    });
  }
  function ensureBase(raw) {
    const base = v.base(raw);
    if (base) {
      const current = header(base.itemId);
      if (current.revision !== base.revision || current.currentVersionId !== base.versionId) v.bad('正式作品已更新，请重新载入最新版本后新建暂存。', 409);
    }
    return base;
  }
  function validateReferences(content, assets, hasVersion = (itemId, versionId) => !!db.prepare('SELECT id FROM content_versions WHERE item_id=? AND id=?').get(itemId, versionId)) {
    const available = new Set(assets.map(asset => asset.id));
    if (content.assetIds.some(assetId => !available.has(assetId))) v.bad('素材不属于该暂存或版本，不能跨暂存引用。');
    for (const source of v.allSources(content)) {
      if (source.type === 'asset' && !content.assetIds.includes(source.assetId)) v.bad('资料引用的素材必须已上传并选入当前稿件。');
      if (source.type === 'saved_version' && !hasVersion(source.itemId, source.versionId)) v.bad('资料引用的正式作品版本不存在。');
    }
  }
  function readTmp(tmpId) {
    const filename = tmpPath(tmpId);
    if (!existsSync(filename)) v.bad('找不到该暂存稿。', 404);
    let raw;
    try { raw = JSON.parse(readFileSync(filename, 'utf8')); } catch (error) { if (error instanceof SyntaxError) v.bad('暂存记录 JSON 损坏，请保留原文件并从已确认版本新建暂存。'); throw error; }
    v.fields(raw, ['id', 'revision', 'createdAt', 'updatedAt', 'restoreEpoch', 'base', 'content', 'temporary', 'assets', 'confirmed']);
    if (raw.id !== tmpId || raw.confirmed !== null) v.bad('暂存记录标识无效。');
    const draft = { id: v.id(raw.id), revision: v.integer(raw.revision), createdAt: v.timestamp(raw.createdAt), updatedAt: v.timestamp(raw.updatedAt), restoreEpoch: v.integer(raw.restoreEpoch), base: v.base(raw.base), content: v.content(raw.content), temporary: v.temporary(raw.temporary), assets: v.unique(v.list(raw.assets, v.assetMetadata, 30), asset => asset.id), confirmed: null };
    const receipt = db.prepare('SELECT item_id,version_id,confirmed_at FROM content_confirmations WHERE tmp_id=?').get(tmpId);
    if (receipt) draft.confirmed = { itemId: receipt.item_id, versionId: receipt.version_id, at: receipt.confirmed_at };
    return { ...draft, stale: draft.restoreEpoch !== epoch() };
  }
  function writable(tmpId, revision) {
    const draft = readTmp(tmpId);
    if (draft.revision !== v.integer(revision)) v.bad('暂存稿已在其他页面修改，请重新载入。', 409);
    if (draft.stale) v.bad('恢复后旧暂存仅供查看；请明确 fork 为新暂存再继续。', 409);
    if (draft.confirmed) v.bad('该暂存已经确认保存，请新建修订暂存。', 409);
    return draft;
  }
  function writeTmp(draft) {
    const { stale, ...persisted } = draft;
    persisted.confirmed = null;
    atomicWrite(tmpPath(draft.id), JSON.stringify(persisted));
  }
  function tmpBytes(tmpId, asset) {
    const filename = tmpPath(tmpId, asset.id);
    if (!existsSync(filename) || lstatSync(filename).size !== asset.byteLength) v.bad('暂存素材文件缺失或长度不符。');
    const bytes = readFileSync(filename);
    if (v.hash(bytes) !== asset.sha256) v.bad('暂存素材校验失败，未确认保存。');
    return bytes;
  }
  function newTmp(content, base, temporary = emptyTemporary(), assets = [], assetBytes = new Map()) {
    const validated = v.content(content);
    validateReferences(validated, assets);
    const at = now();
    const draft = { id: randomUUID(), revision: 0, createdAt: at, updatedAt: at, restoreEpoch: epoch(), base: ensureBase(base), content: validated, temporary: v.temporary(temporary), assets, confirmed: null };
    // Payload and assets stay under tmp even if the final write fails; no automatic deletion.
    for (const asset of assets) atomicWrite(tmpPath(draft.id, asset.id), assetBytes.get(asset.id));
    writeTmp(draft);
    return { ...draft, stale: false };
  }
  function createTmp(raw) {
    v.fields(raw, ['content'], ['base', 'uploads']);
    const content = v.content(raw.content);
    const uploads = v.unique(v.list(raw.uploads ?? [], source => {
      v.fields(source, ['id', 'fileName', 'mimeType', 'dataBase64', 'source', 'caption']);
      const bytes = v.bytes(source.dataBase64);
      const asset = v.assetMetadata({ id: randomUUID(), fileName: source.fileName, mimeType: source.mimeType, byteLength: bytes.length, sha256: v.hash(bytes), source: source.source, caption: source.caption });
      return { inputId: v.id(source.id), asset, bytes };
    }, 30), entry => entry.inputId);
    const ids = new Map(uploads.map(entry => [entry.inputId, entry.asset.id]));
    const replaceSource = source => source.type === 'asset' ? { ...source, assetId: ids.get(source.assetId) ?? source.assetId } : source;
    content.brief.materials = content.brief.materials.map(replaceSource);
    content.brief.references = content.brief.references.map(replaceSource);
    content.sources = content.sources.map(replaceSource);
    content.assetIds = [...new Set([...content.assetIds.map(assetId => ids.get(assetId) ?? assetId), ...uploads.map(entry => entry.asset.id)])];
    return newTmp(content, raw.base ?? null, emptyTemporary(), uploads.map(entry => entry.asset), new Map(uploads.map(entry => [entry.asset.id, entry.bytes])));
  }
  function listTmp() {
    return readdirSync(directory(['tmp', 'content']), { withFileTypes: true }).filter(entry => entry.isDirectory() && /^[-a-zA-Z0-9_]{1,120}$/.test(entry.name)).filter(entry => existsSync(tmpPath(entry.name))).map(entry => readTmp(entry.name));
  }
  function updateTmp(tmpId, raw) {
    v.fields(raw, ['revision', 'content', 'temporary']);
    return withLock(tmpId, () => {
      const draft = writable(tmpId, raw.revision), content = v.content(raw.content);
      validateReferences(content, draft.assets);
      const next = { ...draft, revision: v.increment(draft.revision), updatedAt: now(), content, temporary: v.temporary(raw.temporary) };
      writeTmp(next);
      return next;
    });
  }
  function upload(tmpId, raw) {
    v.fields(raw, ['revision', 'fileName', 'mimeType', 'dataBase64', 'source', 'caption']);
    const bytes = v.bytes(raw.dataBase64);
    const asset = v.assetMetadata({ id: randomUUID(), fileName: raw.fileName, mimeType: raw.mimeType, byteLength: bytes.length, sha256: v.hash(bytes), source: raw.source, caption: raw.caption });
    return withLock(tmpId, () => {
      const draft = writable(tmpId, raw.revision);
      if (draft.assets.length >= 30) v.bad('单份暂存最多 30 个素材。');
      const next = { ...draft, revision: v.increment(draft.revision), updatedAt: now(), assets: [...draft.assets, asset], content: { ...draft.content, assetIds: [...draft.content.assetIds, asset.id] } };
      atomicWrite(tmpPath(tmpId, asset.id), bytes);
      writeTmp(next);
      return { item: next, asset };
    });
  }
  // Internal adapter boundary: accepted image bytes and their checked document
  // version are committed to the same tmp revision. Browser uploads cannot claim
  // that an image has passed the automatic content check.
  function attachImage(tmpId, raw) {
    v.fields(raw, ['revision', 'fileName', 'mimeType', 'dataBase64', 'source', 'caption', 'imageBinding']);
    const bytes = v.bytes(raw.dataBase64);
    const asset = v.assetMetadata({ id: randomUUID(), fileName: raw.fileName, mimeType: raw.mimeType, byteLength: bytes.length, sha256: v.hash(bytes), source: raw.source, caption: raw.caption, imageBinding: raw.imageBinding });
    return withLock(tmpId, () => {
      const draft = writable(tmpId, raw.revision);
      if (asset.imageBinding.documentsHash !== v.documentsHash(draft.content.documents)) v.bad('正文已改变，迟到配图不能覆盖当前稿件。', 409);
      if (draft.assets.length >= 30) v.bad('单份暂存最多 30 个素材。');
      const replaced = new Set(draft.assets.filter(item => item.mimeType.startsWith('image/') && !v.allSources(draft.content).some(source => source.type === 'asset' && source.assetId === item.id)).map(item => item.id));
      const next = { ...draft, revision: v.increment(draft.revision), updatedAt: now(), assets: [...draft.assets, asset], content: { ...draft.content, assetIds: [...draft.content.assetIds.filter(id => !replaced.has(id)), asset.id] } };
      atomicWrite(tmpPath(tmpId, asset.id), bytes); writeTmp(next);
      return { item: next, asset };
    });
  }
  function bindImage(tmpId, { revision, assetId, imageBinding }) {
    return withLock(tmpId, () => {
      const draft = writable(tmpId, revision), asset = draft.assets.find(asset => asset.id === assetId && draft.content.assetIds.includes(asset.id));
      if (!asset || imageBinding.documentsHash !== v.documentsHash(draft.content.documents)) v.bad('正文已改变，迟到配图不能覆盖当前稿件。', 409);
      const bound = v.assetMetadata({ ...asset, imageBinding });
      const next = { ...draft, revision: v.increment(draft.revision), updatedAt: now(), assets: draft.assets.map(item => item.id === assetId ? bound : item) };
      writeTmp(next); return { item: next, asset: bound };
    });
  }
  function getTmpAsset(tmpId, assetId) {
    v.id(assetId);
    const asset = readTmp(tmpId).assets.find(entry => entry.id === assetId);
    if (!asset) v.bad('找不到该暂存的素材。', 404);
    return { asset, bytes: tmpBytes(tmpId, asset) };
  }
  function getAsset(itemId, versionId, assetId) {
    v.id(assetId);
    const asset = version(itemId, versionId).assets.find(entry => entry.id === assetId);
    if (!asset) v.bad('找不到该版本的素材。', 404);
    const row = db.prepare('SELECT bytes FROM content_assets WHERE version_id=? AND asset_id=?').get(versionId, assetId);
    if (!row) throw new Error('已确认素材数据缺失。');
    const bytes = Buffer.from(row.bytes);
    if (bytes.length !== asset.byteLength || v.hash(bytes) !== asset.sha256) throw new Error('已确认素材校验失败。');
    return { asset, bytes };
  }
  function fork(tmpId, raw) {
    v.fields(raw, ['revision', 'base']);
    return withLock(tmpId, () => {
      const draft = readTmp(tmpId);
      if (draft.revision !== v.integer(raw.revision)) v.bad('暂存稿已改变，请重新载入。', 409);
      const assets = draft.assets, bytes = new Map(assets.map(asset => [asset.id, tmpBytes(tmpId, asset)]));
      return newTmp(draft.content, raw.base, draft.temporary, assets, bytes);
    });
  }
  function revise(itemId, raw) {
    v.fields(raw, ['revision']);
    const saved = header(itemId);
    if (saved.revision !== v.integer(raw.revision)) v.bad('正式作品已更新，请重新载入。', 409);
    const current = version(itemId, saved.currentVersionId);
    return newTmp(current.content, { itemId, revision: saved.revision, versionId: current.id }, emptyTemporary(), current.assets, new Map(current.assets.map(asset => [asset.id, getAsset(itemId, current.id, asset.id).bytes])));
  }
  function insertVersion(itemId, version, assets) {
    db.prepare('INSERT INTO content_versions (id,item_id,number,payload) VALUES (?,?,?,?)').run(version.id, itemId, version.number, JSON.stringify(version));
    const insertAsset = db.prepare('INSERT INTO content_assets (version_id,asset_id,bytes) VALUES (?,?,?)');
    for (const asset of version.assets) insertAsset.run(version.id, asset.id, assets.get(asset.id));
  }
  function saveHeader(h) { db.prepare('INSERT INTO content_items(id,revision,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload').run(h.id, h.revision, JSON.stringify(h)); }
  function confirm(tmpId, raw) {
    v.fields(raw, ['revision', 'confirmed']);
    if (raw.confirmed !== true) v.bad('必须由用户明确确认保存。');
    return withLock(tmpId, () => {
      const draft = writable(tmpId, raw.revision), content = v.content(draft.content, true);
      validateReferences(content, draft.assets);
      const assets = draft.assets.filter(asset => content.assetIds.includes(asset.id));
      if (assets.some(asset => asset.imageBinding && asset.imageBinding.documentsHash !== v.documentsHash(content.documents))) v.bad('正文已修改，配图需要更新或重新选择后才能确认保存。', 409);
      const binary = new Map(assets.map(asset => [asset.id, tmpBytes(tmpId, asset)]));
      {
        // Recheck under the DB write lock for a second server sharing this data directory.
        writable(tmpId, raw.revision);
        ensureBase(draft.base);
        const previous = draft.base ? header(draft.base.itemId) : null;
        if (previous) {
          const original = version(previous.id, previous.currentVersionId).content;
          if (original.platform !== content.platform || original.language !== content.language) v.bad('正式作品的平台与语言不能改成另一变体；请新建作品。');
        }
        snapshot('daily');
        const at = now(), itemId = previous?.id ?? randomUUID();
        const number = previous ? version(itemId, previous.currentVersionId).number + 1 : 1;
        v.capacity(db.prepare('SELECT count(*) AS n FROM content_items').get().n + (previous ? 0 : 1), number);
        const savedVersion = { id: randomUUID(), number, createdAt: at, content, assets };
        const h = { id: itemId, revision: nextRevision(), createdAt: previous?.createdAt ?? at, updatedAt: at, currentVersionId: savedVersion.id };
        insertVersion(itemId, savedVersion, binary);
        saveHeader(h);
        db.prepare('INSERT INTO content_confirmations (tmp_id,tmp_revision,item_id,version_id,confirmed_at) VALUES (?,?,?,?,?)').run(tmpId, draft.revision, itemId, savedVersion.id, at);
        checkBackupSize();
        return { item: item(itemId), version: savedVersion };
      }
    });
  }
  function exportAll() {
    return { schemaVersion: 1, items: list().map(summary => {
      const saved = item(summary.id);
      return { ...saved, versions: saved.versions.map(version => ({ ...version, assets: version.assets.map(asset => ({ ...asset, dataBase64: getAsset(saved.id, version.id, asset.id).bytes.toString('base64') })) })) };
    }) };
  }
  function validateBackup(raw) {
    const meta = db.prepare('SELECT restore_epoch,revision_counter FROM content_meta WHERE singleton=1').get();
    v.increment(meta.restore_epoch);
    if (raw === undefined) {
      v.integer(meta.revision_counter + db.prepare('SELECT count(*) AS n FROM content_items').get().n);
      return undefined;
    }
    v.fields(raw, ['schemaVersion', 'items']);
    if (raw.schemaVersion !== 1) v.bad('内容备份 schema 版本不兼容。');
    const globalVersions = new Set();
    const items = v.unique(v.list(raw.items, source => {
      v.fields(source, ['id', 'revision', 'createdAt', 'updatedAt', 'currentVersionId', 'versions']);
      const itemId = v.id(source.id);
      const versions = v.unique(v.list(source.versions, sourceVersion => {
        v.fields(sourceVersion, ['id', 'number', 'createdAt', 'content', 'assets']);
        const versionId = v.id(sourceVersion.id);
        if (globalVersions.has(versionId)) v.bad('内容备份含重复版本 ID。');
        globalVersions.add(versionId);
        const content = v.content(sourceVersion.content, true);
        const binary = new Map();
        const assets = v.unique(v.list(sourceVersion.assets, sourceAsset => {
          v.fields(sourceAsset, ['id', 'fileName', 'mimeType', 'byteLength', 'sha256', 'source', 'caption', 'dataBase64'], ['imageBinding']);
          const { dataBase64, ...metadata } = sourceAsset;
          const asset = v.assetMetadata(metadata), bytes = v.bytes(dataBase64);
          if (bytes.length !== asset.byteLength || v.hash(bytes) !== asset.sha256) v.bad('内容备份的素材校验失败。');
          binary.set(asset.id, bytes);
          return asset;
        }, 30), asset => asset.id);
        if (assets.length !== content.assetIds.length || assets.some(asset => !content.assetIds.includes(asset.id))) v.bad('内容备份素材与稿件选择不一致。');
        if (assets.some(asset => asset.imageBinding && asset.imageBinding.documentsHash !== v.documentsHash(content.documents))) v.bad('备份配图与对应正文版本不一致，恢复已拒绝。');
        const version = { id: versionId, number: v.integer(sourceVersion.number, 1), createdAt: v.timestamp(sourceVersion.createdAt), content, assets };
        const existing = db.prepare('SELECT item_id,payload FROM content_versions WHERE id=?').get(versionId);
        if (existing && (existing.item_id !== itemId || JSON.stringify(JSON.parse(existing.payload)) !== JSON.stringify(version))) v.bad('同一正式版本 ID 的内容不同，拒绝改写不可变历史。');
        return { version, binary };
      }, v.maxContentVersions), entry => entry.version.number).sort((a, b) => a.version.number - b.version.number);
      const currentVersionId = v.id(source.currentVersionId);
      if (!versions.length || versions.some((entry, index) => entry.version.number !== index + 1) || versions.at(-1).version.id !== currentVersionId) v.bad('内容备份版本历史不完整。');
      const first = versions[0].version.content;
      if (versions.some(entry => entry.version.content.platform !== first.platform || entry.version.content.language !== first.language)) v.bad('同一作品包含不同平台或语言。');
      return { header: { id: itemId, revision: v.integer(source.revision), createdAt: v.timestamp(source.createdAt), updatedAt: v.timestamp(source.updatedAt), currentVersionId }, versions };
    }, v.maxContentItems), entry => entry.header.id);
    const known = new Set(items.flatMap(entry => entry.versions.map(({ version }) => `${entry.header.id}:${version.id}`)));
    // Backup revision values are untrusted concurrency tokens, not sequence positions.
    // Allocate only from this machine's counter, skipping a coincident imported token.
    let restoredCounter = meta.revision_counter;
    for (const entry of items) restoredCounter = revisionAfter(restoredCounter, entry.header.revision);
    for (const entry of items) for (const { version } of entry.versions) validateReferences(version.content, version.assets, (itemId, versionId) => known.has(`${itemId}:${versionId}`));
    return items;
  }
  /** Called inside the enclosing module/task restore transaction only. */
  function restore(validated) {
    if (validated !== undefined) {
      db.exec('DELETE FROM content_assets; DELETE FROM content_versions; DELETE FROM content_items;');
      for (const entry of validated) {
        for (const { version, binary } of entry.versions) insertVersion(entry.header.id, version, binary);
        saveHeader({ ...entry.header, revision: nextRevision(entry.header.revision), updatedAt: now() });
      }
    } else {
      for (const summary of list()) saveHeader({ ...header(summary.id), revision: nextRevision(), updatedAt: now() });
    }
    db.prepare('UPDATE content_meta SET restore_epoch=? WHERE singleton=1').run(v.increment(epoch()));
  }
  return { list, item, version, createTmp, listTmp, readTmp, updateTmp, upload, attachImage, bindImage, getTmpAsset, getAsset, fork, revise, confirm, exportAll, validateBackup, restore };
}
