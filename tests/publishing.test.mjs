import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createContentStore } from '../server/content-store.mjs';
import { createPublishingStore } from '../server/publishing-store.mjs';
import { createLinkedInService } from '../server/linkedin-service.mjs';
import { plainTextCommentary } from '../server/linkedin-api.mjs';
import { documentsHash } from '../server/content-validation.mjs';

// Synthetic credentials and payloads only. fetch is always injected, never LinkedIn.
const env = { LINKEDIN_CLIENT_ID: 'SYNTHETIC_CLIENT', LINKEDIN_CLIENT_SECRET: 'SECRET_SENTINEL', LINKEDIN_REDIRECT_URI: 'https://callback.example.test/api/linkedin/callback', LINKEDIN_API_VERSION: '202609' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=', 'base64');
const payload = (text = 'SYNTHETIC_BODY_SENTINEL') => ({ name: 'Synthetic publishing fixture', projectId: null, platform: 'linkedin', language: 'en', brief: { materials: [{ id: 'material', label: 'Synthetic material', type: 'text', text: 'Synthetic source.' }], purpose: 'Test publishing protection', audience: 'Test runner', platforms: [], languages: [], formats: [], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [{ id: 'post', kind: 'linkedin_post', title: 'Synthetic title', blocks: [{ id: 'p1', type: 'paragraph', text }], postingNote: 'NOT_PUBLIC_SENTINEL' }], sources: [], assetIds: [], rule: null, executions: [] });
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const confirmation = preview => ({ previewId: preview.id, confirmationToken: preview.confirmationToken, confirmed: true });
const error = status => caught => caught.status === status;
async function fixture(t, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'launch-publishing-test-'));
  let db, content, store, service, capacityLimit = Infinity;
  let mode = 'published', account = 'synthetic-member', scope = 'openid profile w_member_social', time = Date.now(), gate = null, imageGate = null, imageHost = 'www.linkedin.com';
  const calls = [], snapshots = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.redirect, 'error');
    if (url.endsWith('/accessToken')) return json({ access_token: 'TOKEN_SENTINEL', expires_in: 3600, ...(scope === null ? {} : { scope }) });
    if (url.endsWith('/userinfo')) return json({ sub: account, name: 'Synthetic Member' });
    if (url.includes('/rest/images?')) {
      assert.equal(store.list()[0].status, 'submitting', 'persist before first network mutation');
      if (imageGate) await imageGate;
      return json({ value: { image: 'urn:li:image:SYNTHETIC_IMAGE', uploadUrl: `https://${imageHost}/dms-uploads/synthetic` } });
    }
    if (url.includes('/dms-uploads/')) return new Response(null, { status: mode === 'upload_failure' ? 403 : 201 });
    if (url === 'https://api.linkedin.com/rest/posts') {
      assert.equal(store.list()[0].status, 'submitting', 'persist before post');
      if (gate) await gate;
      if (mode === 'timeout') throw new Error('TOKEN_SENTINEL RAW_REMOTE_BODY');
      if (mode === 'failed') return json({ message: 'TOKEN_SENTINEL RAW_REMOTE_BODY' }, 422);
      if (mode === 'denied') return json({ message: 'TOKEN_SENTINEL RAW_REMOTE_BODY' }, 403);
      if (mode === 'revoked') return json({ message: 'TOKEN_SENTINEL RAW_REMOTE_BODY' }, 401);
      if (mode === 'server_failure') return json({}, 503);
      if (mode === 'missing_id') return json({}, 201);
      if (mode === 'known_unknown') return json({}, 202, { 'x-restli-id': 'urn:li:share:123456789' });
      return json({}, 201, { 'x-restli-id': 'urn:li:share:123456789' });
    }
    if (url.includes('/rest/posts/')) return mode === 'revoked' ? json({ message: 'TOKEN_SENTINEL RAW_REMOTE_BODY' }, 401) : json({ id: 'urn:li:share:123456789', author: `urn:li:person:${account}`, lifecycleState: 'PUBLISHED' });
    throw new Error(`Unexpected test request: ${url}`);
  };
  function open() {
    db = new DatabaseSync(path.join(dir, 'test.sqlite'));
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const checkBackupSize = () => { if (store && Buffer.byteLength(JSON.stringify({ content: content.exportAll(), publishing: store.exportAll() })) > capacityLimit) { const e = new Error('Synthetic capacity'); e.status = 413; throw e; } };
    content = createContentStore(db, dir, { snapshot: name => snapshots.push(name), checkBackupSize });
    store = createPublishingStore(db, { snapshot: name => snapshots.push(name), checkBackupSize, content });
    service = createLinkedInService({ store, content, env: options.env ?? env, fetchImpl, clock: () => time, timeoutMs: 1000 });
  }
  open();
  t.after(async () => { await service.close(); db.close(); assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(dir, { recursive: true, force: true }); });
  const f = {
    get db() { return db; }, get store() { return store; }, get content() { return content; }, get service() { return service; }, dir, calls, snapshots,
    set mode(value) { mode = value; }, set scopes(value) { scope = value; }, set account(value) { account = value; }, set gate(value) { gate = value; }, set imageGate(value) { imageGate = value; }, set imageHost(value) { imageHost = value; }, set capacity(value) { capacityLimit = value; }, advance(ms) { time += ms; },
    async connect() { const url = new URL(service.startAuth().authorizationUrl); return service.callback(new URLSearchParams({ state: url.searchParams.get('state'), code: 'SYNTHETIC_CODE' })); },
    save(value = payload(), withImage = false) {
      let draft = content.createTmp({ content: value });
      if (withImage) draft = content.upload(draft.id, { revision: draft.revision, fileName: 'test.png', mimeType: 'image/png', dataBase64: png.toString('base64'), source: { kind: 'upload', url: null }, caption: 'Synthetic image' }).item;
      return content.confirm(draft.id, { revision: draft.revision, confirmed: true });
    },
    preview(saved) { return service.preview({ itemId: saved.item.id, versionId: saved.version.id, accountId: account }); },
    async settle() { for (let i = 0; i < 100 && store.list().some(record => record.status === 'submitting'); i++) await new Promise(resolve => setTimeout(resolve, 5)); return store.list()[0]; },
    async restart() { await service.close(); db.close(); store = null; open(); },
    restore(raw, contentRaw) { store.assertCanRestore(); const p = store.validateBackup(raw), c = content.validateBackup(contentRaw); db.exec('BEGIN IMMEDIATE'); try { content.restore(c); store.restore(p); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
  return f;
}

test('unconfigured and HTTPS redirect requirements do not claim a usable connection or leak secrets', async t => {
  const f = await fixture(t, { env: {} });
  assert.equal(f.service.connection().status, 'unconfigured');
  assert.throws(() => f.service.startAuth(), error(409));
  assert.equal(f.calls.length, 0);
  const bad = createLinkedInService({ store: f.store, content: f.content, env: { ...env, LINKEDIN_REDIRECT_URI: 'http://127.0.0.1:4318/api/linkedin/callback' }, fetchImpl: () => { throw new Error('must not connect'); } });
  assert.equal(bad.connection().canPublish, false); assert.match(bad.connection().config.missing.join(), /HTTPS/);
  assert.doesNotMatch(JSON.stringify(bad.connection()), /SECRET_SENTINEL/); await bad.close();
});

test('OAuth state is random, expires, is single use, and only actual returned scope enables publishing', async t => {
  const f = await fixture(t);
  const start = new URL(f.service.startAuth().authorizationUrl), state = start.searchParams.get('state');
  assert.equal(start.origin, 'https://www.linkedin.com'); assert.equal(start.searchParams.get('scope'), 'openid profile w_member_social');
  assert.equal(start.searchParams.get('redirect_uri'), env.LINKEDIN_REDIRECT_URI);
  await assert.rejects(f.service.callback(new URLSearchParams({ state: '中'.repeat(state.length), code: 'fake' })), error(401));
  assert.equal(f.calls.length, 0);
  const connection = await f.service.callback(new URLSearchParams({ state, code: 'SYNTHETIC_CODE' }));
  assert.equal(connection.status, 'connected'); assert.equal(connection.canPublish, true);
  assert.equal(connection.account.urn, 'urn:li:person:synthetic-member');
  assert.equal(Date.parse(connection.expiresAt) > Date.now(), true);
  const tokenRequest = new URLSearchParams(f.calls[0].body);
  assert.equal(tokenRequest.get('redirect_uri'), start.searchParams.get('redirect_uri'));
  assert.equal(tokenRequest.get('client_secret'), 'SECRET_SENTINEL');
  await assert.rejects(f.service.callback(new URLSearchParams({ state, code: 'SYNTHETIC_CODE' })), error(401));
  assert.doesNotMatch(JSON.stringify(connection), /TOKEN_SENTINEL|SECRET_SENTINEL/);
  f.scopes = null; assert.equal((await f.connect()).status, 'missing_permissions');
  f.scopes = 'openid profile'; assert.equal((await f.connect()).canPublish, false);
  f.scopes = 'openid profile w_member_social'; await f.connect(); f.advance(3600001);
  assert.equal(f.service.connection().status, 'expired');
  const expiring = new URL(f.service.startAuth().authorizationUrl); f.advance(600001);
  await assert.rejects(f.service.callback(new URLSearchParams({ state: expiring.searchParams.get('state'), code: 'synthetic' })), error(401));
});

test('equal JavaScript lengths with unequal UTF-8 bytes yield OAuth 401 without consuming valid state', async t => {
  const f = await fixture(t);
  const state = new URL(f.service.startAuth().authorizationUrl).searchParams.get('state');
  const invalid = ['中'.repeat(state.length), '😀'.repeat(Math.floor(state.length / 2)) + 'a', 'a'.repeat(state.length - 1) + '\ud800'];
  for (const candidate of invalid) {
    assert.equal(candidate.length, state.length);
    assert.notEqual(Buffer.byteLength(candidate), Buffer.byteLength(state));
    await assert.rejects(f.service.callback(new URLSearchParams({ state: candidate, code: 'SYNTHETIC_CODE' })), error(401));
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await f.service.callback(new URLSearchParams({ state, code: 'SYNTHETIC_CODE' }))).canPublish, true);
});

test('preview uses saved version title and blocks, real asset hash, and rejects unsupported or ambiguous objects', async t => {
  const f = await fixture(t); await f.connect();
  const saved = f.save(payload(), true), preview = f.preview(saved);
  assert.equal(preview.body, 'Synthetic title\n\nSYNTHETIC_BODY_SENTINEL');
  assert.equal(preview.versionNumber, saved.version.number);
  assert.doesNotMatch(JSON.stringify(preview), /NOT_PUBLIC_SENTINEL/);
  assert.equal(preview.assets[0].sha256, saved.version.assets[0].sha256);
  assert.equal(preview.assets[0].url, `/api/content/${saved.item.id}/versions/${saved.version.id}/assets/${saved.version.assets[0].id}`);
  assert.throws(() => f.service.preview({ itemId: saved.item.id, versionId: saved.version.id, accountId: 'different' }), error(409));
  const tmp = f.content.createTmp({ content: payload() });
  assert.throws(() => f.service.preview({ itemId: tmp.id, versionId: tmp.id, accountId: 'synthetic-member' }), error(404));
  const pulse = payload(); pulse.documents[0].kind = 'linkedin_article';
  assert.throws(() => f.preview(f.save(pulse)), /Pulse/);
  const multi = payload(); multi.documents.push({ ...multi.documents[0], id: 'other' });
  assert.throws(() => f.preview(f.save(multi)), /多个动态/);
  assert.throws(() => f.preview(f.save(payload('x'.repeat(3000)))), /3000/);
});

test('confirmation requires token and true; concurrent repeated clicks send only once after durable submitting', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); const preview = f.preview(saved);
  assert.throws(() => f.service.execute({ ...confirmation(preview), confirmed: false }), error(400));
  assert.throws(() => f.service.execute({ ...confirmation(preview), confirmationToken: 'x'.repeat(43) }), error(409));
  assert.throws(() => f.service.execute({ ...confirmation(preview), body: 'injected' }), error(400));
  let release; f.gate = new Promise(resolve => { release = resolve; });
  const records = await Promise.all(Array.from({ length: 8 }, () => f.service.execute(confirmation(preview))));
  assert.equal(new Set(records.map(record => record.id)).size, 1); assert.equal(records[0].status, 'submitting');
  assert.throws(() => f.store.assertCanRestore(), error(409));
  assert.throws(() => f.service.execute(confirmation(f.preview(saved))), error(409));
  release(); const final = await f.settle();
  assert.equal(final.status, 'published'); assert.equal(final.platformId, 'urn:li:share:123456789');
  assert.equal(final.url, 'https://www.linkedin.com/feed/update/urn:li:share:123456789/');
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
  const request = f.calls.find(call => call.url.endsWith('/rest/posts'));
  assert.equal(JSON.parse(request.body).commentary, plainTextCommentary(preview.body)); assert.equal(request.headers['LinkedIn-Version'], '202609');
  assert.equal(request.headers['X-Restli-Protocol-Version'], '2.0.0');
  assert.equal(f.service.execute(confirmation(preview)).id, final.id);
});

test('plain-text LinkedIn commentary preserves visible symbols, Unicode and line breaks instead of interpreting markup', async t => {
  const f = await fixture(t); await f.connect();
  const body = '中文😀 first\nsecond\n\n@[Name](urn:li:person:123) #topic |{}<> \\ * _ ~';
  const draft = payload(body); draft.documents[0].title = '';
  const saved = f.save(draft), preview = f.preview(saved);
  assert.equal(preview.body, body);
  f.service.execute(confirmation(preview)); assert.equal((await f.settle()).status, 'published');
  const commentary = JSON.parse(f.calls.find(call => call.url.endsWith('/rest/posts')).body).commentary;
  assert.equal(commentary, '中文😀 first\nsecond\n\n' + String.raw`\@\[Name\]\(urn:li:person:123\) \#topic \|\{\}\<\> \\ \* \_ \~`);
  assert.equal(commentary.split('\n').length, body.split('\n').length);
  assert.equal(commentary.replace(/\\([|{}@\[\]()<>#\\*_~])/g, '$1'), preview.body);
  assert.equal(f.preview(saved).contentHash, preview.contentHash);
});

test('published preview binds generated images to the same saved document and rejects stale bindings before any upload', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(payload(), true);
  const version = f.content.version(saved.item.id, saved.version.id);
  version.assets[0].imageBinding = { documentsHash: documentsHash(version.content.documents), width: 1, height: 1, checkedAt: new Date().toISOString() };
  f.db.prepare('UPDATE content_versions SET payload=? WHERE id=?').run(JSON.stringify(version), version.id);
  const preview = f.preview(saved);
  assert.equal(preview.assets[0].imageBinding.documentsHash, documentsHash(version.content.documents));
  version.assets[0].imageBinding.documentsHash = '0'.repeat(64);
  f.db.prepare('UPDATE content_versions SET payload=? WHERE id=?').run(JSON.stringify(version), version.id);
  assert.throws(() => f.preview(saved), caught => caught.status === 409 && /配图/.test(caught.message));
  assert.throws(() => f.service.execute(confirmation(preview)), error(409));
  assert.equal(f.store.list().length, 0); assert.equal(f.calls.filter(call => call.url.includes('/rest/')).length, 0);
});

test('account/session change, expiry, restore epoch and corrupted version/asset bytes invalidate preview', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(payload(), true);
  let preview = f.preview(saved); f.service.disconnect(); await f.connect();
  assert.throws(() => f.service.execute(confirmation(preview)), error(409));
  preview = f.preview(saved); f.restore(undefined, undefined);
  assert.throws(() => f.service.execute(confirmation(preview)), error(409));
  preview = f.preview(saved); f.advance(600001);
  assert.throws(() => f.service.execute(confirmation(preview)), error(409));
  preview = f.preview(saved);
  const version = f.content.version(saved.item.id, saved.version.id); version.content.documents[0].blocks[0].text = 'CORRUPTION';
  f.db.prepare('UPDATE content_versions SET payload=? WHERE id=?').run(JSON.stringify(version), version.id);
  assert.throws(() => f.service.execute(confirmation(preview)), error(409));
  f.db.prepare('UPDATE content_assets SET bytes=? WHERE version_id=?').run(Buffer.from('corrupted'), version.id);
  assert.throws(() => f.preview(saved));
  assert.equal(f.calls.filter(call => call.url.includes('/rest/')).length, 0);
});

test('single image upload is owned by account and completed before post, without image GET scope assumptions', async t => {
  const f = await fixture(t); await f.connect(); const preview = f.preview(f.save(payload(), true));
  f.service.execute(confirmation(preview)); assert.equal((await f.settle()).status, 'published');
  const writes = f.calls.filter(call => call.url.includes('/rest/') || call.url.includes('/dms-uploads/'));
  assert.equal(writes.length, 3);
  assert.equal(JSON.parse(writes[0].body).initializeUploadRequest.owner, 'urn:li:person:synthetic-member');
  assert.equal(writes[1].method, 'PUT'); assert.deepEqual(writes[1].body, png);
  assert.equal(JSON.parse(writes[2].body).content.media.id, 'urn:li:image:SYNTHETIC_IMAGE');
});

test('upload refusal, credential-exfiltration upload URL and disconnect during upload do not submit a post', async t => {
  for (const variant of ['upload_failure', 'host', 'disconnect']) await t.test(variant, async t => {
    const f = await fixture(t); await f.connect(); const preview = f.preview(f.save(payload(), true));
    if (variant === 'upload_failure') f.mode = variant;
    if (variant === 'host') f.imageHost = 'evil.example.test';
    let release; if (variant === 'disconnect') f.imageGate = new Promise(resolve => { release = resolve; });
    f.service.execute(confirmation(preview));
    if (release) { f.service.disconnect(); release(); }
    assert.equal((await f.settle()).status, 'failed');
    assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 0);
    if (variant === 'disconnect') assert.equal(f.calls.filter(call => call.method === 'PUT').length, 0);
    assert.equal(f.calls.filter(call => call.url.includes('evil.example.test')).length, 0);
  });
});

test('uncertain post results never automatically retry and a new preview cannot bypass the guard', async t => {
  for (const variant of ['timeout', 'server_failure', 'missing_id']) await t.test(variant, async t => {
    const f = await fixture(t); await f.connect(); const saved = f.save(), preview = f.preview(saved); f.mode = variant;
    f.service.execute(confirmation(preview)); const record = await f.settle();
    assert.equal(record.status, 'unknown'); assert.equal(record.url, null);
    assert.equal(f.service.execute(confirmation(preview)).id, record.id);
    assert.throws(() => f.service.execute(confirmation(f.preview(saved))), error(409));
    await assert.rejects(f.service.reconcile(record.id), error(409));
    assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
    assert.doesNotMatch(JSON.stringify(f.store.exportAll()), /TOKEN_SENTINEL|RAW_REMOTE_BODY/);
  });
});

test('definitive failure needs a fresh separately confirmed preview; same confirmation never retries', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), preview = f.preview(saved); f.mode = 'failed';
  f.service.execute(confirmation(preview)); const record = await f.settle(); assert.equal(record.status, 'failed');
  f.mode = 'published'; assert.equal(f.service.execute(confirmation(preview)).status, 'failed');
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
  f.service.execute(confirmation(f.preview(saved))); await f.settle();
  assert.equal(f.store.list().some(item => item.status === 'published'), true);
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 2);
});

test('reconcile reads only known platform ID with approved read scope and never POSTs', async t => {
  const f = await fixture(t); await f.connect(); f.mode = 'known_unknown';
  f.service.execute(confirmation(f.preview(f.save()))); const record = await f.settle();
  assert.equal(record.status, 'unknown'); assert.equal(record.platformId, 'urn:li:share:123456789');
  await assert.rejects(f.service.reconcile(record.id), error(403));
  f.scopes = 'openid profile w_member_social r_member_social'; await f.connect();
  assert.equal((await f.service.reconcile(record.id)).status, 'published');
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
  assert.equal(f.calls.some(call => call.url.includes('urn%3Ali%3Ashare%3A123456789')), true);
});

test('actual API permission refusal disables publishing until OAuth reconnects', async t => {
  for (const [variant, status] of [['denied', 'missing_permissions'], ['revoked', 'expired']]) await t.test(variant, async t => {
    const f = await fixture(t); await f.connect(); f.mode = variant;
    f.service.execute(confirmation(f.preview(f.save()))); assert.equal((await f.settle()).status, 'failed');
    assert.equal(f.service.connection().status, status); assert.equal(f.service.connection().canPublish, false);
    await f.connect(); assert.equal(f.service.connection().canPublish, true);
  });
});

test('restart converts interrupted submitting to unknown and retains confirmation and content dedupe', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), preview = f.preview(saved);
  const { hash } = await import('../server/content-validation.mjs');
  f.store.begin({ itemId: preview.itemId, versionId: preview.versionId, accountId: preview.accountId, accountName: preview.accountName, language: preview.language, contentHash: preview.contentHash, previewId: preview.id, confirmationHash: hash(preview.confirmationToken) }, () => {});
  await f.restart(); assert.equal(f.service.connection().status, 'disconnected');
  assert.equal(f.store.list()[0].status, 'unknown'); assert.equal(f.service.execute(confirmation(preview)).status, 'unknown');
  await f.connect(); assert.throws(() => f.service.execute(confirmation(f.preview(saved))), error(409));
  assert.equal(f.calls.filter(call => call.url.includes('/rest/')).length, 0);
});

test('reconciliation HTTP 401 expires the session while preserving the unknown record and dedupe', async t => {
  const f = await fixture(t); f.scopes = 'openid profile w_member_social r_member_social'; await f.connect();
  const saved = f.save(); f.mode = 'known_unknown';
  f.service.execute(confirmation(f.preview(saved))); const record = await f.settle();
  assert.equal(record.status, 'unknown');
  f.mode = 'revoked'; await assert.rejects(f.service.reconcile(record.id), error(502));
  assert.equal(f.service.connection().status, 'expired'); assert.equal(f.service.connection().canPublish, false);
  assert.equal(f.store.get(record.id).status, 'unknown');
  assert.throws(() => f.preview(saved), error(409));
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
});

test('backup is strict, contains no content or credentials, and old/new restore cannot erase facts or guards', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), before = f.store.exportAll();
  f.service.execute(confirmation(f.preview(saved))); const record = await f.settle();
  const backup = f.store.exportAll(), serialized = JSON.stringify(backup);
  assert.doesNotMatch(serialized, /SYNTHETIC_BODY_SENTINEL|NOT_PUBLIC_SENTINEL|TOKEN_SENTINEL|SECRET_SENTINEL|authorizationUrl|access_token/);
  assert.equal(Buffer.byteLength(JSON.stringify(backup.records[0])), 4096);
  assert.throws(() => f.store.validateBackup({ ...backup, token: 'secret' }));
  const corrupt = structuredClone(backup); corrupt.records[0].platformId = 'urn:li:share:999';
  assert.throws(() => f.store.validateBackup(corrupt));
  f.restore(undefined, undefined); assert.equal(f.store.get(record.id).status, 'published');
  f.restore(before, { schemaVersion: 1, items: [] }); assert.equal(f.store.get(record.id).status, 'published');
  assert.equal(f.content.list().length, 0);
  const restoredSameBody = f.save();
  assert.throws(() => f.service.execute(confirmation(f.preview(restoredSameBody))), error(409));
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
});

test('unknown facts cannot be downgraded by an older failed backup or erased when content is restored away', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.mode = 'failed';
  f.service.execute(confirmation(f.preview(saved))); const failed = await f.settle();
  const olderFailedBackup = f.store.exportAll();
  f.store.finish(failed.id, { status: 'unknown', error: 'Synthetic later uncertainty requires reconciliation.' });
  f.restore(olderFailedBackup, undefined);
  assert.equal(f.store.get(failed.id).status, 'unknown');
  assert.throws(() => f.service.execute(confirmation(f.preview(saved))), error(409));
  f.restore({ schemaVersion: 1, records: [] }, { schemaVersion: 1, items: [] });
  assert.equal(f.store.get(failed.id).status, 'unknown');
  const newItem = f.save();
  assert.throws(() => f.service.execute(confirmation(f.preview(newItem))), error(409));
  assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
});

test('capacity is checked before network submission and fixed envelope reserves completion metadata', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), preview = f.preview(saved);
  f.capacity = 1;
  assert.throws(() => f.service.execute(confirmation(preview)), error(413));
  assert.equal(f.store.list().length, 0); assert.equal(f.calls.filter(call => call.url.includes('/rest/')).length, 0);
  f.capacity = Infinity;
  let release; f.gate = new Promise(resolve => { release = resolve; });
  f.service.execute(confirmation(preview));
  const size = Buffer.byteLength(JSON.stringify({ content: f.content.exportAll(), publishing: f.store.exportAll() })); f.capacity = size;
  release(); assert.equal((await f.settle()).status, 'published');
  assert.equal(Buffer.byteLength(JSON.stringify({ content: f.content.exportAll(), publishing: f.store.exportAll() })), size);
});

test('a transient local completion write failure preserves the real platform ID without a second POST', async t => {
  const f = await fixture(t); await f.connect();
  const finish = f.store.finish; let writes = 0;
  f.store.finish = (...args) => { if (writes++ === 0) throw new Error('Synthetic transient SQLite failure'); return finish(...args); };
  f.service.execute(confirmation(f.preview(f.save())));
  const record = await f.settle();
  assert.equal(record.status, 'published'); assert.equal(record.platformId, 'urn:li:share:123456789');
  assert.equal(writes, 2); assert.equal(f.calls.filter(call => call.url.endsWith('/rest/posts')).length, 1);
});
