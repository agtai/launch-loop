import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, unlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { startServer } from '../server/index.mjs';
import { capacity, maxContentItems, maxContentVersions } from '../server/content-validation.mjs';

// All data below is explicitly synthetic; no provider, platform, or production data is used.
const modules = ['research', 'creation', 'review', 'publishing', 'feedback'].map(id => ({ id, owner: '', status: '待试跑', input: '', steps: [], output: '', acceptance: '', tools: '', notes: '', resultUrl: '', revision: 0, updatedAt: null }));
const blankTemporary = () => ({ initialDocuments: [], reviewFindings: '', prompt: '' });
const document = (text = 'SYNTHETIC FINAL BODY', kind = 'linkedin_article') => ({ id: kind, kind, title: 'Synthetic fixture', blocks: [{ id: 'p1', type: 'paragraph', text }], postingNote: '' });
const content = (text = 'SYNTHETIC FINAL BODY') => ({
  name: 'Synthetic storage fixture', projectId: null, platform: 'linkedin', language: 'en',
  brief: { materials: [{ id: 'material', label: 'Synthetic input', type: 'text', text: 'This is test-only supplied material.' }], purpose: 'Exercise storage', audience: 'Test runner', platforms: [], languages: [], formats: [], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] },
  documents: [document(text)], sources: [], assetIds: [], rule: null, executions: [],
});
async function fixture(t, { legacy = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'launch-content-test-'));
  const dataDir = path.join(root, 'data'), seedDir = path.join(root, 'seed'), distDir = path.join(root, 'dist');
  await Promise.all([mkdir(seedDir), mkdir(distDir), mkdir(dataDir)]);
  await Promise.all([writeFile(path.join(seedDir, 'modules.json'), JSON.stringify(modules)), writeFile(path.join(seedDir, 'tasks.json'), JSON.stringify([{ id: 'synthetic-task' }])), writeFile(path.join(distDir, 'index.html'), '<h1>Synthetic test</h1>')]);
  if (legacy) {
    const db = new DatabaseSync(path.join(dataDir, 'workbench.sqlite'));
    db.exec('CREATE TABLE records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(kind,id));');
    const insert = db.prepare('INSERT INTO records VALUES (?,?,?,?)');
    const saved = { ...modules[0], owner: 'Synthetic legacy owner', notes: 'Preserve legacy research', revision: 7 };
    insert.run('modules', saved.id, JSON.stringify(saved), saved.revision);
    db.close();
  }
  let app = await startServer({ port: 0, dataDir, seedDir, distDir });
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  const f = {
    root, dataDir, get url() { return app.url; },
    async restart() { await app.close(); app = await startServer({ port: 0, dataDir, seedDir, distDir }); },
    async api(route, body, method = 'POST', headers = {}) { return fetch(app.url + route, body === undefined ? { headers } : { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); },
    async ok(route, body, method) { const response = await f.api(route, body, method); const text = await response.text(); assert.ok(response.ok, `${route}: ${response.status} ${text}`); return JSON.parse(text); },
    async tmp(value = content()) { return (await f.ok('/api/content/tmp', { content: value })).item; },
    async confirm(draft) { return f.ok(`/api/content/tmp/${draft.id}/confirm`, { revision: draft.revision, confirmed: true }); },
    async upload(draft, bytes = Buffer.from('SYNTHETIC ASSET BYTES'), fileName = 'fixture.txt') { return f.ok(`/api/content/tmp/${draft.id}/assets`, { revision: draft.revision, fileName, mimeType: 'text/plain', dataBase64: bytes.toString('base64'), source: { kind: 'upload', url: null }, caption: 'Synthetic fixture bytes' }); },
  };
  return f;
}

test('explicit content migration preserves existing records and survives restart', async t => {
  const f = await fixture(t, { legacy: true });
  const old = (await f.ok('/api/modules')).items[0];
  assert.equal(old.owner, 'Synthetic legacy owner'); assert.equal(old.revision, 7);
  assert.equal((await f.ok('/api/content')).items.length, 0);
  const saved = await f.confirm(await f.tmp());
  await f.restart();
  assert.deepEqual((await f.ok('/api/modules')).items[0], old);
  assert.deepEqual((await f.ok(`/api/content/${saved.item.id}`)).item, saved.item);
  const db = new DatabaseSync(path.join(f.dataDir, 'workbench.sqlite'));
  assert.equal(db.prepare('SELECT schema_version FROM content_meta').get().schema_version, 1); db.close();
});

test('tmp text, initial draft, review, prompt, and binary never leak into DB or backups', async t => {
  const f = await fixture(t);
  let draft = await f.tmp(content('UNCONFIRMED_CURRENT_SENTINEL'));
  const uploaded = await f.upload(draft, Buffer.from('UNCONFIRMED_BINARY_SENTINEL')); draft = uploaded.item;
  const temporary = { initialDocuments: [document('UNCONFIRMED_INITIAL_SENTINEL')], reviewFindings: 'UNCONFIRMED_REVIEW_SENTINEL', prompt: 'UNCONFIRMED_PROMPT_SENTINEL' };
  draft = (await f.ok(`/api/content/tmp/${draft.id}`, { revision: draft.revision, content: draft.content, temporary }, 'PUT')).item;
  const task = (await f.ok('/api/tasks')).items[0];
  await f.ok('/api/tasks', { ...task, notes: 'Synthetic snapshot trigger' }, 'PUT');
  assert.deepEqual((await f.ok('/api/content')).items, []);
  const backup = await f.ok('/api/backup'); assert.deepEqual(backup.content.items, []);
  for (const filename of (await readdir(f.dataDir)).filter(name => name.startsWith('workbench.sqlite'))) {
    assert.equal((await readFile(path.join(f.dataDir, filename))).includes(Buffer.from('UNCONFIRMED_')), false, filename);
  }
  for (const filename of await readdir(path.join(f.dataDir, 'backups'))) assert.doesNotMatch(await readFile(path.join(f.dataDir, 'backups', filename), 'utf8'), /UNCONFIRMED_/);
  await f.restart();
  assert.deepEqual((await f.ok(`/api/content/tmp/${draft.id}`)).item, draft);
  const saved = await f.confirm(draft);
  assert.equal(saved.version.assets[0].id, uploaded.asset.id);
  assert.equal(saved.version.content.documents[0].blocks[0].text, 'UNCONFIRMED_CURRENT_SENTINEL');
  const formalBackup = JSON.stringify(await f.ok('/api/backup'));
  assert.doesNotMatch(formalBackup, /UNCONFIRMED_(INITIAL|REVIEW|PROMPT)_SENTINEL/);
  assert.equal(Object.hasOwn(saved.version, 'temporary'), false);
  const downloaded = await f.api(`/api/content/${saved.item.id}/versions/${saved.version.id}/assets/${uploaded.asset.id}`);
  assert.match(downloaded.headers.get('content-disposition'), /^attachment;/);
  assert.equal(await downloaded.text(), 'UNCONFIRMED_BINARY_SENTINEL');
  assert.equal((await f.ok(`/api/content/tmp/${draft.id}`)).item.confirmed.versionId, saved.version.id);
});

test('parallel tmp writes and confirmations conflict; new revision preserves old immutable version', async t => {
  const f = await fixture(t);
  const draft = await f.tmp();
  const writes = await Promise.all(['Synthetic A', 'Synthetic B'].map(text => f.api(`/api/content/tmp/${draft.id}`, { revision: draft.revision, content: content(text), temporary: blankTemporary() }, 'PUT')));
  assert.deepEqual(writes.map(response => response.status).sort(), [200, 409]);
  const latest = (await f.ok(`/api/content/tmp/${draft.id}`)).item;
  const confirmations = await Promise.all([1, 2].map(() => f.api(`/api/content/tmp/${draft.id}/confirm`, { revision: latest.revision, confirmed: true })));
  assert.deepEqual(confirmations.map(response => response.status).sort(), [200, 409]);
  const saved = await confirmations.find(response => response.status === 200).json();
  const revisionA = (await f.ok(`/api/content/${saved.item.id}/revise`, { revision: saved.item.revision })).item;
  const revisionB = (await f.ok(`/api/content/${saved.item.id}/revise`, { revision: saved.item.revision })).item;
  const edited = (await f.ok(`/api/content/tmp/${revisionA.id}`, { revision: revisionA.revision, content: content('SYNTHETIC REVISION TWO'), temporary: blankTemporary() }, 'PUT')).item;
  const second = await f.confirm(edited);
  assert.equal(second.item.versions.length, 2);
  assert.deepEqual(second.item.versions[0], saved.version);
  assert.equal((await f.api(`/api/content/tmp/${revisionB.id}/confirm`, { revision: revisionB.revision, confirmed: true })).status, 409);
  assert.deepEqual((await f.ok(`/api/content/${saved.item.id}/versions/${saved.version.id}`)).version, saved.version);
  assert.equal((await f.api(`/api/content/${saved.item.id}/versions/${saved.version.id}`, {}, 'PUT')).status, 405);
});

test('only platform and language define variants, optional selections stay empty, and documents combine formats', async t => {
  const f = await fixture(t);
  const undecided = { ...content(), platform: null, language: null, documents: [] };
  const empty = await f.tmp(undecided);
  assert.equal(empty.content.platform, null); assert.deepEqual(empty.content.brief.platforms, []);
  assert.equal((await f.api(`/api/content/tmp/${empty.id}/confirm`, { revision: 0, confirmed: true })).status, 400);
  const mixedFormats = content(); mixedFormats.documents.push(document('Synthetic feed post', 'linkedin_post')); mixedFormats.brief.formats = ['long_article', 'short_post'];
  const saved = await f.confirm(await f.tmp(mixedFormats));
  assert.equal(saved.version.content.documents.length, 2); assert.equal((await f.ok('/api/content')).items.length, 1);
  for (const patch of [{ materials: [] }, { purpose: '' }, { audience: '' }]) {
    const value = content(); value.brief = { ...value.brief, ...patch };
    assert.equal((await f.api('/api/content/tmp', { content: value })).status, 400);
  }
  const next = (await f.ok(`/api/content/${saved.item.id}/revise`, { revision: saved.item.revision })).item;
  const changed = { ...next.content, language: 'zh' };
  const edited = (await f.ok(`/api/content/tmp/${next.id}`, { revision: next.revision, content: changed, temporary: blankTemporary() }, 'PUT')).item;
  assert.equal((await f.api(`/api/content/tmp/${edited.id}/confirm`, { revision: edited.revision, confirmed: true })).status, 400);
});

test('file-only required material can be created atomically with its first upload', async t => {
  const f = await fixture(t);
  const value = content();
  value.brief.materials = [{ id: 'only-material', label: 'Synthetic input file', type: 'asset', assetId: 'request-file' }];
  const upload = { id: 'request-file', fileName: 'material.txt', mimeType: 'text/plain', dataBase64: Buffer.from('SYNTHETIC FILE-ONLY MATERIAL').toString('base64'), source: { kind: 'upload', url: null }, caption: '' };
  const draft = (await f.ok('/api/content/tmp', { content: value, uploads: [upload] })).item;
  assert.notEqual(draft.assets[0].id, 'request-file');
  assert.equal(draft.content.brief.materials[0].assetId, draft.assets[0].id);
  assert.deepEqual(draft.content.assetIds, [draft.assets[0].id]);
  assert.deepEqual((await f.ok('/api/content')).items, []);
  assert.equal((await f.confirm(draft)).version.assets[0].id, draft.assets[0].id);
  const before = (await f.ok('/api/content/tmp')).items.length;
  assert.equal((await f.api('/api/content/tmp', { content: value, uploads: [{ ...upload, dataBase64: 'invalid' }] })).status, 400);
  assert.equal((await f.ok('/api/content/tmp')).items.length, before);
});

test('legacy backup preserves new content, invalidates tmp, and explicit fork retains text and binary', async t => {
  const f = await fixture(t);
  const oldBackup = await f.ok('/api/backup'); delete oldBackup.content;
  const saved = await f.confirm((await f.upload(await f.tmp())).item);
  const pending = (await f.ok(`/api/content/${saved.item.id}/revise`, { revision: saved.item.revision })).item;
  assert.equal((await f.api('/api/restore', oldBackup)).status, 200);
  const retained = (await f.ok(`/api/content/${saved.item.id}`)).item;
  assert.deepEqual(retained.versions, saved.item.versions); assert.ok(retained.revision > saved.item.revision);
  const stale = (await f.ok(`/api/content/tmp/${pending.id}`)).item; assert.equal(stale.stale, true);
  assert.equal((await f.api(`/api/content/tmp/${pending.id}/confirm`, { revision: pending.revision, confirmed: true })).status, 409);
  assert.equal((await f.api(`/api/content/tmp/${pending.id}`, { revision: pending.revision, content: pending.content, temporary: pending.temporary }, 'PUT')).status, 409);
  assert.equal((await f.api(`/api/content/tmp/${pending.id}/assets`, { revision: pending.revision, fileName: 'new.txt', mimeType: 'text/plain', dataBase64: 'QQ==', source: { kind: 'upload', url: null }, caption: '' })).status, 409);
  const forked = (await f.ok(`/api/content/tmp/${pending.id}/fork`, { revision: pending.revision, base: { itemId: retained.id, revision: retained.revision, versionId: retained.currentVersionId } })).item;
  assert.equal(forked.stale, false); assert.deepEqual(forked.content, pending.content);
  assert.equal(await (await f.api(`/api/content/tmp/${forked.id}/assets/${forked.assets[0].id}`)).text(), 'SYNTHETIC ASSET BYTES');
  assert.equal((await f.confirm(forked)).item.versions.length, 2);
  const snapshots = (await readdir(path.join(f.dataDir, 'backups'))).filter(name => name.startsWith('pre-restore-'));
  assert.equal(JSON.parse(await readFile(path.join(f.dataDir, 'backups', snapshots[0]), 'utf8')).content.items[0].id, saved.item.id);
});

test('new backup fully restores versions and binaries, removes later items to snapshot, and rejects tampering atomically', async t => {
  const f = await fixture(t);
  const first = await f.confirm((await f.upload(await f.tmp())).item);
  const backup = await f.ok('/api/backup');
  const later = await f.confirm(await f.tmp(content('Synthetic later item')));
  const invalid = structuredClone(backup); invalid.content.items[0].versions[0].assets[0].dataBase64 = Buffer.from('tampered').toString('base64');
  assert.equal((await f.api('/api/restore', invalid)).status, 400);
  assert.equal((await f.ok('/api/content')).items.length, 2);
  const forged = structuredClone(backup); forged.content.items[0].versions[0].content.documents[0].blocks[0].text = 'FORGED SAME VERSION';
  assert.equal((await f.api('/api/restore', forged)).status, 400);
  assert.equal((await f.api('/api/restore', backup)).status, 200);
  assert.equal((await f.ok('/api/content')).items.length, 1);
  assert.equal((await f.api(`/api/content/${later.item.id}`)).status, 404);
  const restored = (await f.ok(`/api/content/${first.item.id}`)).item;
  assert.deepEqual(restored.versions, first.item.versions); assert.ok(restored.revision > later.item.revision);
  assert.equal(await (await f.api(`/api/content/${first.item.id}/versions/${first.version.id}/assets/${first.version.assets[0].id}`)).text(), 'SYNTHETIC ASSET BYTES');
  const snapshots = (await readdir(path.join(f.dataDir, 'backups'))).filter(name => name.startsWith('pre-restore-'));
  assert.equal(snapshots.length, 1);
  assert.equal(JSON.parse(await readFile(path.join(f.dataDir, 'backups', snapshots[0]), 'utf8')).content.items.length, 2);
  // Portability: restore in an independent empty data directory with no source tmp or files.
  const independent = await fixture(t);
  assert.equal((await independent.api('/api/restore', backup)).status, 200);
  assert.equal(await (await independent.api(`/api/content/${first.item.id}/versions/${first.version.id}/assets/${first.version.assets[0].id}`)).text(), 'SYNTHETIC ASSET BYTES');
});

test('failed confirm and restore roll back all official records and leave pending draft usable', async t => {
  const f = await fixture(t);
  const draft = (await f.upload(await f.tmp())).item;
  const db = new DatabaseSync(path.join(f.dataDir, 'workbench.sqlite'));
  try {
  db.exec("CREATE TRIGGER synthetic_asset_failure BEFORE INSERT ON content_assets BEGIN SELECT RAISE(ABORT,'synthetic asset failure'); END;");
  assert.equal((await f.api(`/api/content/tmp/${draft.id}/confirm`, { revision: draft.revision, confirmed: true })).status, 500);
  assert.deepEqual((await f.ok('/api/content')).items, []);
  assert.equal(db.prepare('SELECT count(*) n FROM content_versions').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM content_confirmations').get().n, 0);
  assert.equal((await f.ok(`/api/content/tmp/${draft.id}`)).item.confirmed, null);
  db.exec('DROP TRIGGER synthetic_asset_failure;');
  await f.confirm(draft);
  const backup = await f.ok('/api/backup');
  const pending = await f.tmp();
  db.exec("CREATE TRIGGER synthetic_restore_failure BEFORE UPDATE ON content_meta WHEN NEW.restore_epoch > OLD.restore_epoch BEGIN SELECT RAISE(ABORT,'synthetic restore failure'); END;");
  const changed = structuredClone(backup); changed.modules[0].owner = 'Synthetic restore value';
  assert.equal((await f.api('/api/restore', changed)).status, 500);
  assert.deepEqual((await f.ok('/api/modules')).items, backup.modules);
  assert.deepEqual((await f.ok(`/api/content/${backup.content.items[0].id}`)).item.versions, backup.content.items[0].versions.map(version => ({ ...version, assets: version.assets.map(({ dataBase64, ...asset }) => asset) })));
  assert.equal((await f.ok(`/api/content/tmp/${pending.id}`)).item.stale, false);
  } finally { db.close(); }
});

test('rejects unsafe paths, URLs, cross-origin requests, source mismatches, and content smuggled into execution metadata', async t => {
  const f = await fixture(t);
  for (const url of ['file:///C:/secret.txt', 'javascript:alert(1)', 'https://user:pass@example.com/a', 'https://example.com\\evil', 'https://example.com/%0aheader']) {
    const value = content(); value.brief.materials = [{ id: 'source', label: 'Synthetic URL', type: 'url', url }];
    assert.equal((await f.api('/api/content/tmp', { content: value })).status, 400, url);
  }
  assert.equal((await f.api('/api/content/tmp', { content: content() }, 'POST', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.api('/api/content/tmp', { content: content() }, 'POST', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await f.api('/api/content/tmp/%2e%2e%2fsecret')).status, 400);
  const missingSource = content(); missingSource.sources = [{ id: 'missing', label: 'Missing synthetic version', type: 'saved_version', itemId: 'other', versionId: 'none' }];
  assert.equal((await f.api('/api/content/tmp', { content: missingSource })).status, 400);
  const smuggled = content(); smuggled.executions = [{ provider: 'fixture', model: 'synthetic-model', runId: 'fixture-run', stage: 'generation', status: 'failed', startedAt: '2026-09-23T00:00:00.000Z', finishedAt: '2026-09-23T00:00:01.000Z', prompt: 'MUST NOT ENTER LOG' }];
  assert.equal((await f.api('/api/content/tmp', { content: smuggled })).status, 400);
  const first = await f.upload(await f.tmp()); const second = await f.tmp();
  assert.equal((await f.api(`/api/content/tmp/${second.id}`, { revision: 0, content: { ...second.content, assetIds: [first.asset.id] }, temporary: blankTemporary() }, 'PUT')).status, 400);
  for (const fileName of ['../secret', 'C:\\secret', 'CON.txt', 'folder/file.txt']) {
    assert.equal((await f.api(`/api/content/tmp/${second.id}/assets`, { revision: 0, fileName, mimeType: 'text/plain', dataBase64: 'QQ==', source: { kind: 'upload', url: null }, caption: '' })).status, 400);
  }
  const localPath = { revision: 0, fileName: 'safe.txt', mimeType: 'text/plain', dataBase64: 'QQ==', source: { kind: 'upload', url: null }, caption: '', path: 'C:\\secret' };
  assert.equal((await f.api(`/api/content/tmp/${second.id}/assets`, localPath)).status, 400);
  // A same-volume hard link is available without Windows symlink privileges.
  const assetPath = path.join(f.dataDir, 'tmp', 'content', first.item.id, `${first.asset.id}.bin`);
  const outside = path.join(f.root, 'outside-secret.txt'); await writeFile(outside, 'SYNTHETIC ASSET BYTES');
  await unlink(assetPath); await link(outside, assetPath);
  assert.equal((await f.api(`/api/content/tmp/${first.item.id}/assets/${first.asset.id}`)).status, 403);
  assert.equal((await f.api(`/api/content/tmp/${first.item.id}/confirm`, { revision: first.item.revision, confirmed: true })).status, 403);
});

test('formal backup capacity is enforced for confirmations and legacy edits; compact snapshots remain restorable', async t => {
  const f = await fixture(t);
  const limit = 16 * 1024 * 1024;
  const first = await f.confirm((await f.upload(await f.tmp(), Buffer.alloc(4 * 1024 * 1024, 65))).item);
  await f.confirm((await f.upload(await f.tmp(), Buffer.alloc(4 * 1024 * 1024, 66))).item);
  const before = await f.ok('/api/backup');
  const remaining = limit - Buffer.byteLength(JSON.stringify(before));
  // Leave only ~10 KiB headroom after metadata; a 20K ASCII task note must then fail.
  const thirdSize = Math.floor((remaining - 15000) * 3 / 4);
  const third = await f.upload(await f.tmp(), Buffer.alloc(thirdSize, 67));
  await f.confirm(third.item);
  const near = await f.ok('/api/backup');
  assert.ok(Buffer.byteLength(JSON.stringify(near)) < limit);
  assert.ok(limit - Buffer.byteLength(JSON.stringify(near)) < 20000);
  const task = near.tasks[0];
  assert.equal((await f.api('/api/tasks', { ...task, notes: 'X'.repeat(20000) }, 'PUT')).status, 413);
  assert.deepEqual((await f.ok('/api/tasks')).items[0], task);
  const tooLarge = (await f.upload(await f.tmp(), Buffer.alloc(20000, 68))).item;
  assert.equal((await f.api(`/api/content/tmp/${tooLarge.id}/confirm`, { revision: tooLarge.revision, confirmed: true })).status, 413);
  assert.equal((await f.ok('/api/content')).items.length, 3);
  assert.equal((await f.ok(`/api/content/tmp/${tooLarge.id}`)).item.confirmed, null);
  assert.equal((await f.api('/api/restore', near)).status, 200);
  const snapshots = (await readdir(path.join(f.dataDir, 'backups'))).filter(name => name.startsWith('pre-restore-'));
  const snapshot = await readFile(path.join(f.dataDir, 'backups', snapshots[0]), 'utf8');
  assert.ok(Buffer.byteLength(snapshot) <= limit);
  assert.equal((await f.api('/api/restore', JSON.parse(snapshot))).status, 200);
  assert.equal((await f.ok(`/api/content/${first.item.id}`)).item.versions.length, 1);
});

test('numeric exhaustion and collection boundaries reject changes without poisoning stored state', async t => {
  capacity(maxContentItems, maxContentVersions);
  assert.throws(() => capacity(maxContentItems + 1, 1), /上限/);
  assert.throws(() => capacity(1, maxContentVersions + 1), /上限/);
  const f = await fixture(t);
  const saved = await f.confirm(await f.tmp());
  const pending = await f.tmp();
  const original = await f.ok('/api/backup');
  const invalid = structuredClone(original); invalid.content.items[0].revision = Number.MAX_SAFE_INTEGER;
  assert.equal((await f.api('/api/restore', invalid)).status, 400);
  assert.deepEqual((await f.ok(`/api/content/${saved.item.id}`)).item, saved.item);
  assert.deepEqual((await f.ok('/api/modules')).items, original.modules);
  assert.equal((await f.ok(`/api/content/tmp/${pending.id}`)).item.stale, false);
  const db = new DatabaseSync(path.join(f.dataDir, 'workbench.sqlite'));
  try {
    db.prepare('UPDATE content_meta SET restore_epoch=?').run(Number.MAX_SAFE_INTEGER - 1);
    assert.equal((await f.api('/api/restore', original)).status, 400);
    assert.deepEqual((await f.ok(`/api/content/${saved.item.id}`)).item, saved.item);
    db.prepare('UPDATE content_meta SET restore_epoch=0').run();
    const last = { ...original.modules[0], revision: Number.MAX_SAFE_INTEGER - 1 };
    db.prepare('UPDATE records SET payload=?,revision=? WHERE kind=? AND id=?').run(JSON.stringify(last), last.revision, 'modules', last.id);
    assert.equal((await f.api('/api/modules', { ...last, owner: 'Must not persist' }, 'PUT')).status, 400);
    assert.equal((await f.api('/api/restore', original)).status, 400);
    assert.deepEqual((await f.ok('/api/modules')).items[0], last);
  } finally { db.close(); }
});

test('restoring untrusted near-max revisions cannot exhaust the local sequence or authorize stale writes', async t => {
  const f = await fixture(t);
  const saved = await f.confirm(await f.tmp());
  const original = await f.ok('/api/backup');
  for (const importedRevision of [Number.MAX_SAFE_INTEGER - 2, Number.MAX_SAFE_INTEGER - 1]) {
    const before = (await f.ok(`/api/content/${saved.item.id}`)).item;
    const pending = (await f.ok(`/api/content/${saved.item.id}/revise`, { revision: before.revision })).item;
    const incoming = structuredClone(original); incoming.content.items[0].revision = importedRevision;
    assert.equal((await f.api('/api/restore', incoming)).status, 200);
    const restored = (await f.ok(`/api/content/${saved.item.id}`)).item;
    assert.ok(restored.revision > before.revision && restored.revision < 100);
    assert.notEqual(restored.revision, importedRevision);
    assert.equal((await f.api(`/api/content/${saved.item.id}/revise`, { revision: before.revision })).status, 409);
    assert.equal((await f.api(`/api/content/${saved.item.id}/revise`, { revision: importedRevision })).status, 409);
    assert.equal((await f.api(`/api/content/tmp/${pending.id}/confirm`, { revision: pending.revision, confirmed: true })).status, 409);
    const newDraft = (await f.ok(`/api/content/${restored.id}/revise`, { revision: restored.revision })).item;
    const confirmed = await f.confirm(newDraft);
    assert.equal(confirmed.item.versions.length, 2);
    assert.ok(confirmed.item.revision > restored.revision && confirmed.item.revision < 100);
  }
  // An imported token that happens to equal the next local value is skipped once.
  const current = (await f.ok(`/api/content/${saved.item.id}`)).item;
  const coincident = structuredClone(original); coincident.content.items[0].revision = current.revision + 1;
  assert.equal((await f.api('/api/restore', coincident)).status, 200);
  const restored = (await f.ok(`/api/content/${saved.item.id}`)).item;
  assert.equal(restored.revision, current.revision + 2);
  assert.equal((await f.api(`/api/content/${saved.item.id}/revise`, { revision: coincident.content.items[0].revision })).status, 409);
  const newDraft = (await f.ok(`/api/content/${restored.id}/revise`, { revision: restored.revision })).item;
  assert.equal((await f.confirm(newDraft)).item.revision, restored.revision + 1);
});

test('OS transaction lock releases after an owning process exits without rollback', async t => {
  const f = await fixture(t);
  const draft = await f.tmp();
  const child = spawn(process.execPath, ['-e', "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); db.exec('BEGIN IMMEDIATE'); process.stdout.write('SYNTHETIC_LOCK_ACQUIRED'); process.exit(23);", path.join(f.dataDir, 'workbench.sqlite')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', bytes => { output += bytes; });
  const [exitCode] = await once(child, 'exit');
  assert.equal(exitCode, 23); assert.equal(output, 'SYNTHETIC_LOCK_ACQUIRED');
  await f.restart();
  const edited = (await f.ok(`/api/content/tmp/${draft.id}`, { revision: draft.revision, content: content('Synthetic edit after crash'), temporary: blankTemporary() }, 'PUT')).item;
  assert.equal((await f.confirm(edited)).version.content.documents[0].blocks[0].text, 'Synthetic edit after crash');
  assert.equal((await readdir(path.join(f.dataDir, 'tmp', 'content', draft.id))).includes('write.lock'), false);
});
