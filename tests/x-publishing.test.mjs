import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createXPublishingStore } from '../server/x-publishing-store.mjs';
import { createXService } from '../server/x-service.mjs';
import { createXApi } from '../server/x-api.mjs';
import { bindXImage, verifyXImage } from '../server/x-images.mjs';

// Explicit synthetic platform, synthetic formal content, isolated SQLite. No X network.
const env = { X_CLIENT_ID: 'SYNTHETIC_CLIENT', X_CLIENT_SECRET: 'SECRET_SENTINEL', X_REDIRECT_URI: 'https://callback.example.test/api/x/callback' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=', 'base64');
const digest = value => createHash('sha256').update(value).digest('hex');
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const confirm = p => ({ previewId: p.id, confirmationToken: p.confirmationToken, confirmed: true });
const status = n => error => error.status === n;
const payload = (kind = 'thread') => ({ name: 'Synthetic X fixture', projectId: null, platform: 'x', language: 'en', brief: { materials: [{ id: 'source', label: 'Synthetic', type: 'text', text: 'Synthetic fixture' }], purpose: 'Validate safe publication', audience: 'Test runner', platforms: ['x'], languages: ['en'], formats: kind === 'thread' ? ['thread'] : ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [{ id: 'document', kind, title: '', postingNote: 'NOT_POSTED_SENTINEL', blocks: Array.from({ length: kind === 'thread' ? 3 : 1 }, (_, i) => ({ id: `step${i + 1}`, type: 'x_post', text: `SYNTHETIC_BODY_SENTINEL step ${i + 1}`, assetIds: [] })) }], sources: [], assetIds: [], rule: null, executions: [] });

async function fixture(t, options = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'launch-x-publishing-'));
  let db, content, store, service, time = Date.now(), account = '111', scopes = 'tweet.read tweet.write users.read media.write', limit = Infinity;
  const state = { calls: [], posts: [], remote: new Map(), failAt: 0, failStatus: 422, mode: 'ok', gate: null, imageMode: 'ready', mediaGate: null, checks: 0 };
  const fetchImpl = async (url, init) => {
    state.calls.push({ url, ...init }); assert.equal(init.redirect, 'error');
    if (url.endsWith('/oauth2/token')) return json({ access_token: 'TOKEN_SENTINEL', token_type: 'bearer', expires_in: 7200, ...(scopes === null ? {} : { scope: scopes }) });
    if (url.endsWith('/users/me')) return json({ data: { id: account, name: 'Synthetic User', username: 'synthetic' } });
    if (url.endsWith('/media/upload') && init.method === 'POST') {
      assert.equal(store.list()[0].steps[0].status, 'uploading');
      if (state.mediaGate) await state.mediaGate;
      return state.imageMode === 'rejected' ? json({}, 403) : json({ data: { id: '900', media_key: '3_900', expires_after_secs: 86400, ...(state.imageMode === 'pending' ? { processing_info: { state: 'pending', check_after_secs: 0 } } : state.imageMode === 'failed' ? { processing_info: { state: 'failed' } } : {}) } });
    }
    if (url.includes('/media/upload?')) { state.checks++; return json({ data: { id: '900', processing_info: { state: 'succeeded' } } }); }
    if (url.endsWith('/media/metadata')) {
      assert.equal(store.list()[0].steps[0].mediaId, '900');
      return json({ data: { id: '900' } });
    }
    if (url.endsWith('/tweets')) {
      const body = JSON.parse(init.body), record = store.list()[0];
      assert.ok(record.steps.some(step => step.status === 'submitting' && step.textHash === digest(body.text)), 'submitting persisted before each request');
      assert.throws(() => store.assertCanRestore(), status(409));
      state.posts.push(body); const number = state.posts.length;
      if (state.gate) await state.gate;
      if (number === state.failAt) {
        if (state.mode === 'timeout') throw new Error('TOKEN_SENTINEL RAW_REMOTE_BODY');
        if (state.mode === 'missing_id') return json({ data: { text: body.text } }, 201);
        if (state.mode === 'known_unknown') { const id = `${100 + number}`; state.remote.set(id, { id, author_id: account, text: body.text, referenced_tweets: body.reply ? [{ type: 'replied_to', id: body.reply.in_reply_to_tweet_id }] : [] }); return json({ data: { id, text: body.text } }, 202); }
        return json({ detail: 'RAW_REMOTE_BODY TOKEN_SENTINEL' }, state.failStatus);
      }
      const id = `${100 + number}`;
      state.remote.set(id, { id, author_id: account, text: body.text, referenced_tweets: body.reply ? [{ type: 'replied_to', id: body.reply.in_reply_to_tweet_id }] : [], ...(body.media ? { attachments: { media_keys: ['3_900'] } } : {}) });
      return json({ data: { id, text: body.text } }, 201);
    }
    if (url.includes('/tweets/')) { const id = new URL(url).pathname.split('/').at(-1); return json({ data: state.remote.get(id) }); }
    throw new Error(`Unexpected fake URL ${url}`);
  };
  function open() {
    db = new DatabaseSync(path.join(dir, 'test.sqlite')); db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const checkBackupSize = () => { if (store && Buffer.byteLength(JSON.stringify({ content: content.exportAll(), xPublishing: store.exportAll() })) > limit) { const e = new Error('Capacity fixture'); e.status = 413; throw e; } };
    content = createContentStore(db, dir, { snapshot: () => {}, checkBackupSize }); store = createXPublishingStore(db, { checkBackupSize });
    service = createXService({ store, content, env: options.env ?? env, fetchImpl, clock: () => time, wait: async () => {}, timeoutMs: 1000 });
  }
  open();
  t.after(async () => { await service.close(); db.close(); assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(dir, { recursive: true, force: true }); });
  return {
    state, get store() { return store; }, get service() { return service; }, get content() { return content; }, get db() { return db; },
    set account(value) { account = value; }, set scopes(value) { scopes = value; }, set capacity(value) { limit = value; }, advance(ms) { time += ms; },
    async connect() { const url = new URL(service.startAuth().authorizationUrl); return service.callback(new URLSearchParams({ state: url.searchParams.get('state'), code: 'CODE_SENTINEL' })); },
    save(value = payload(), image = false) {
      let draft = content.createTmp({ content: value });
      if (image) {
        draft = content.upload(draft.id, { revision: draft.revision, fileName: 'synthetic.png', mimeType: 'image/png', dataBase64: png.toString('base64'), source: { kind: 'generated', url: null }, caption: 'Synthetic image' }).item;
        const asset = draft.assets[0];
        let doc = bindXImage(draft.content.documents[0], { language: value.language, asset, bytes: png, altText: 'Synthetic pixel' });
        doc = verifyXImage(doc, { language: value.language, assets: draft.assets, assetHash: asset.sha256, textHash: doc.blocks[0].image.textHash, altText: 'Synthetic pixel', generated: true });
        draft = content.updateTmp(draft.id, { revision: draft.revision, content: { ...draft.content, documents: [doc] }, temporary: draft.temporary });
      }
      return content.confirm(draft.id, { revision: draft.revision, confirmed: true });
    },
    preview(saved, resumeRecordId) { return service.preview({ itemId: saved.item.id, versionId: saved.version.id, documentId: saved.version.content.documents[0].id, accountId: account, ...(resumeRecordId ? { resumeRecordId } : {}) }); },
    async settle() { for (let i = 0; i < 200 && store.list().some(record => record.active); i++) await new Promise(resolve => setTimeout(resolve, 2)); assert.equal(store.list().some(record => record.active), false); return store.list()[0]; },
    async restart() { await service.close(); db.close(); store = null; open(); },
    restore(raw) { store.assertCanRestore(); const valid = store.validateBackup(raw); db.exec('BEGIN IMMEDIATE'); try { store.restore(valid); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } },
  };
}

test('X official OAuth uses random S256 PKCE, actual returned scopes, single-use state and memory-only secrets', async t => {
  const f = await fixture(t), start = new URL(f.service.startAuth().authorizationUrl), state = start.searchParams.get('state');
  assert.equal(start.origin, 'https://x.com'); assert.equal(start.searchParams.get('code_challenge_method'), 'S256');
  await assert.rejects(f.service.callback({ state: '中'.repeat(state.length), code: 'fake' }), status(401));
  const connection = await f.service.callback({ state, code: 'CODE_SENTINEL' });
  assert.equal(connection.canPublish, true); assert.equal(connection.account.id, '111');
  const body = new URLSearchParams(f.state.calls[0].body), verifier = body.get('code_verifier');
  assert.equal(createHash('sha256').update(verifier).digest('base64url'), start.searchParams.get('code_challenge'));
  assert.ok(f.state.calls[0].headers.Authorization.startsWith('Basic '));
  assert.doesNotMatch(JSON.stringify(connection), /TOKEN_SENTINEL|SECRET_SENTINEL|CODE_SENTINEL/);
  await assert.rejects(f.service.callback({ state, code: 'CODE_SENTINEL' }), status(401));
  f.scopes = null; await f.connect(); assert.equal(f.service.connection().status, 'missing_permissions');
  f.scopes = 'tweet.read tweet.write users.read media.write<script>'; await f.connect(); assert.equal(f.service.connection().canPublish, false); assert.deepEqual(f.service.connection().scopes, []);
});

test('X unconfigured app, rejected HTTP callback and public-client token request are explicit', async t => {
  const f = await fixture(t, { env: {} }); assert.equal(f.service.connection().status, 'unconfigured'); assert.throws(() => f.service.startAuth(), status(409)); assert.equal(f.state.calls.length, 0);
  const publicClient = await fixture(t, { env: { ...env, X_CLIENT_SECRET: '' } }); await publicClient.connect();
  assert.equal(new URLSearchParams(publicClient.state.calls[0].body).get('client_id'), env.X_CLIENT_ID); assert.equal(publicClient.state.calls[0].headers.Authorization, undefined);
});

test('X preview requires a formal version and chooses exactly one content object without posting notes', async t => {
  const f = await fixture(t); await f.connect(); const value = payload('post'); value.documents.push({ ...payload().documents[0], id: 'thread' });
  const draft = f.content.createTmp({ content: value }); await assert.rejects(f.service.preview({ itemId: draft.id, versionId: draft.id, documentId: 'document', accountId: '111' }), status(404));
  const saved = f.save(value), p = await f.preview(saved); assert.equal(p.steps.length, 1); assert.equal(p.kind, 'post'); assert.doesNotMatch(JSON.stringify(p), /NOT_POSTED_SENTINEL/); assert.equal(f.state.posts.length, 0);
});

test('X thread publishes in exact order, persists each reply and does not repeat duplicate clicks', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), p = await f.preview(saved);
  const first = f.service.execute(confirm(p)), second = f.service.execute(confirm(p)); assert.equal(first.id, second.id);
  const result = await f.settle(); assert.equal(result.status, 'published'); assert.equal(f.state.posts.length, 3);
  assert.equal(f.state.posts[0].reply, undefined); assert.equal(f.state.posts[1].reply.in_reply_to_tweet_id, result.steps[0].platformId); assert.equal(f.state.posts[2].reply.in_reply_to_tweet_id, result.steps[1].platformId);
  assert.deepEqual(f.state.posts.map(p => p.text), saved.version.content.documents[0].blocks.map(b => b.text));
  assert.doesNotMatch(JSON.stringify(f.store.exportAll()), /SYNTHETIC_BODY_SENTINEL|TOKEN_SENTINEL|SECRET_SENTINEL|NOT_POSTED_SENTINEL/);
  assert.equal(f.service.execute(confirm(p)).id, result.id); assert.equal(f.state.posts.length, 3);
});

test('X second-post rejection retains prefix and requires verified fresh confirmation for continuation', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.state.failAt = 2;
  const p = await f.preview(saved); f.service.execute(confirm(p)); const partial = await f.settle();
  assert.equal(partial.status, 'partial'); assert.deepEqual(partial.steps.map(s => s.status), ['published', 'failed', 'pending']); assert.equal(f.state.posts.length, 2);
  assert.equal(f.service.execute(confirm(p)).id, partial.id); assert.equal(f.state.posts.length, 2);
  const redundant = await f.preview(saved); assert.throws(() => f.service.execute(confirm(redundant)), status(409));
  const continuation = await f.preview(saved, partial.id); assert.equal(continuation.steps[0].alreadyPublished, true); assert.ok(f.state.calls.some(c => c.url.includes('/tweets/101?')));
  f.service.execute(confirm(continuation)); const done = await f.settle(); assert.equal(done.status, 'published'); assert.equal(f.state.posts.length, 4);
  assert.equal(f.state.posts[2].reply.in_reply_to_tweet_id, '101'); assert.equal(f.state.posts[3].reply.in_reply_to_tweet_id, '103');
});

for (const mode of ['timeout', 'missing_id', 'server_error']) test(`X ${mode} is unknown and never retried or resumed`, async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.state.failAt = 2; f.state.mode = mode; f.state.failStatus = 503;
  const p = await f.preview(saved); f.service.execute(confirm(p)); const result = await f.settle();
  assert.equal(result.status, 'unknown'); assert.equal(result.steps[0].status, 'published'); assert.equal(result.steps[1].status, 'unknown'); assert.equal(result.steps[2].status, 'pending');
  await assert.rejects(f.preview(saved, result.id), status(409)); f.service.execute(confirm(p)); assert.equal(f.state.posts.length, 2);
  await f.restart(); await f.connect(); await assert.rejects(f.preview(saved, result.id), status(409)); assert.equal(f.state.posts.length, 2);
});

test('X known uncertain ID can be verified without sending any replacement post', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.state.failAt = 2; f.state.mode = 'known_unknown';
  f.service.execute(confirm(await f.preview(saved))); const result = await f.settle(); assert.equal(result.status, 'unknown');
  const checked = await f.service.reconcile(result.id); assert.equal(checked.status, 'partial'); assert.equal(checked.steps[1].status, 'published'); assert.equal(f.state.posts.length, 2);
});

test('X cancel during an in-flight request retains its success and stops all later steps', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); let release; f.state.gate = new Promise(r => { release = r; });
  const record = f.service.execute(confirm(await f.preview(saved))); assert.equal(f.state.posts.length, 1);
  f.service.cancel(record.id); assert.equal(f.store.get(record.id).active, true); release();
  const result = await f.settle(); assert.equal(result.steps[0].status, 'published'); assert.equal(result.status, 'partial'); assert.equal(f.state.posts.length, 1); assert.equal(result.cancelRequested, true);
});

test('X disconnect stops later steps while keeping a late successful response', async t => {
  const f = await fixture(t); await f.connect(); let release; f.state.gate = new Promise(r => { release = r; });
  f.service.execute(confirm(await f.preview(f.save()))); f.service.disconnect(); release();
  const result = await f.settle(); assert.equal(result.status, 'partial'); assert.equal(f.state.posts.length, 1); assert.equal(f.service.connection().canPublish, false);
});

test('X media upload, processing, metadata and made_with_ai precede only the first post', async t => {
  const f = await fixture(t); await f.connect(); f.state.imageMode = 'pending';
  const saved = f.save(payload(), true), p = await f.preview(saved); assert.equal(p.steps[0].assets[0].generated, true);
  f.service.execute(confirm(p)); const done = await f.settle(); assert.equal(done.status, 'published'); assert.equal(f.state.checks, 1);
  assert.deepEqual(f.state.posts[0].media, { media_ids: ['900'] }); assert.equal(f.state.posts[0].made_with_ai, true); assert.equal(f.state.posts[1].media, undefined);
  const metadata = JSON.parse(f.state.calls.find(c => c.url.endsWith('/media/metadata')).body); assert.deepEqual(metadata, { id: '900', metadata: { alt_text: { text: 'Synthetic pixel' } } });
});

for (const mode of ['failed', 'rejected']) test(`X media ${mode} never submits a post`, async t => {
  const f = await fixture(t); await f.connect(); f.state.imageMode = mode;
  f.service.execute(confirm(await f.preview(f.save(payload('post'), true)))); const result = await f.settle(); assert.equal(result.status, 'failed'); assert.equal(f.state.posts.length, 0);
});

test('X account change, expiry and restore epoch invalidate old preview', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), p = await f.preview(saved);
  f.advance(11 * 60 * 1000); assert.throws(() => f.service.execute(confirm(p)), status(409));
  const q = await f.preview(saved); f.db.prepare('UPDATE content_meta SET restore_epoch=restore_epoch+1').run(); assert.throws(() => f.service.execute(confirm(q)), status(409));
  const r = await f.preview(saved); f.account = '222'; await f.connect(); assert.throws(() => f.service.execute(confirm(r)), status(409)); assert.equal(f.state.posts.length, 0);
});

for (const code of [401, 402, 403, 429]) test(`X HTTP ${code} is a bounded explicit failure with no automatic retry`, async t => {
  const f = await fixture(t); await f.connect(); f.state.failAt = 1; f.state.failStatus = code;
  f.service.execute(confirm(await f.preview(f.save(payload('post'))))); const result = await f.settle(); assert.equal(result.status, 'failed'); assert.equal(f.state.posts.length, 1); assert.match(result.steps[0].error, new RegExp(`${code}`));
  if (code === 401) assert.equal(f.service.connection().status, 'expired'); if (code === 403) assert.equal(f.service.connection().status, 'missing_permissions');
  assert.doesNotMatch(JSON.stringify(f.store.exportAll()), /TOKEN_SENTINEL|RAW_REMOTE_BODY/);
});

test('X old backup merge preserves new successes and duplicate confirmation across restarts', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.state.failAt = 2;
  const p = await f.preview(saved); f.service.execute(confirm(p)); let record = await f.settle(); const older = f.store.exportAll();
  f.service.execute(confirm(await f.preview(saved, record.id))); record = await f.settle(); assert.equal(record.status, 'published');
  f.restore(older); assert.equal(f.store.get(record.id).status, 'published'); assert.equal(f.store.get(record.id).steps[1].platformId, record.steps[1].platformId);
  f.restore(undefined); assert.equal(f.store.get(record.id).status, 'published');
  await f.restart(); assert.equal(f.service.execute(confirm(p)).id, record.id); assert.equal(f.state.posts.length, 4);
});

test('X restore interrupted submission is unknown and never creates a remote request', async t => {
  const f = await fixture(t); await f.connect(); f.state.failAt = 1; f.state.failStatus = 422;
  f.service.execute(confirm(await f.preview(f.save()))); const failed = await f.settle(), raw = f.store.exportAll();
  const entry = raw.records[0]; entry.active = true; entry.status = 'running'; entry.steps[0].status = 'submitting'; entry.steps[0].phase = 'post';
  entry.padding = ''; entry.padding = ' '.repeat(8192 + entry.steps.length * 2048 - Buffer.byteLength(JSON.stringify(entry)));
  f.restore(raw); assert.equal(f.store.get(failed.id).status, 'unknown'); assert.equal(f.state.posts.length, 1);
  await f.restart(); assert.equal(f.store.get(failed.id).status, 'unknown');
});

test('X backup corruption and insufficient result capacity reject before remote write', async t => {
  const f = await fixture(t); await f.connect(); const p = await f.preview(f.save()); f.capacity = 1;
  assert.throws(() => f.service.execute(confirm(p)), status(413)); assert.equal(f.state.posts.length, 0); assert.equal(f.store.list().length, 0);
  f.capacity = Infinity; f.service.execute(confirm(p)); await f.settle(); const backup = f.store.exportAll(); backup.records[0].steps[0].platformId = '999';
  assert.throws(() => f.restore(backup));
});

test('X resume refuses a changed remote author or reply chain', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.state.failAt = 2;
  f.service.execute(confirm(await f.preview(saved))); const record = await f.settle(); f.state.remote.get('101').author_id = '222';
  await assert.rejects(f.preview(saved, record.id), status(409)); assert.equal(f.state.posts.length, 2);
});

test('X metadata-only changes cannot repeat a successfully published prefix as a new plan', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(payload(), true); f.state.failAt = 2;
  f.service.execute(confirm(await f.preview(saved))); const record = await f.settle(); assert.equal(record.status, 'partial');
  let draft = f.content.revise(saved.item.id, { revision: f.content.item(saved.item.id).revision });
  draft.content.documents[0].blocks[0].image.altText = 'Another accurate description of the same synthetic pixel';
  draft = f.content.updateTmp(draft.id, { revision: draft.revision, content: draft.content, temporary: draft.temporary });
  const next = f.content.confirm(draft.id, { revision: draft.revision, confirmed: true });
  const p = await f.preview(next); assert.throws(() => f.service.execute(confirm(p)), status(409)); assert.equal(f.state.posts.length, 2);
  const original = await f.preview(saved, record.id); f.service.execute(confirm(original)); assert.equal((await f.settle()).status, 'published');
});

test('X saving changed text or order invalidates old preview while explicit old-version preview remains available', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(), oldPreview = await f.preview(saved);
  let draft = f.content.revise(saved.item.id, { revision: f.content.item(saved.item.id).revision });
  draft.content.documents[0].blocks.reverse(); draft.content.documents[0].blocks[0].text = 'Edited synthetic final text';
  draft = f.content.updateTmp(draft.id, { revision: draft.revision, content: draft.content, temporary: draft.temporary });
  f.content.confirm(draft.id, { revision: draft.revision, confirmed: true });
  assert.throws(() => f.service.execute(confirm(oldPreview)), status(409)); assert.equal(f.state.posts.length, 0);
  const freshOld = await f.preview(saved); f.service.execute(confirm(freshOld)); assert.equal((await f.settle()).status, 'published');
});

test('X startup converts durable in-flight submission to unknown even without callback completion', async t => {
  const f = await fixture(t); await f.connect(); f.state.failAt = 1;
  f.service.execute(confirm(await f.preview(f.save()))); const old = await f.settle();
  const raw = JSON.parse(f.db.prepare('SELECT payload FROM x_publishing_records WHERE id=?').get(old.id).payload);
  raw.active = true; raw.status = 'running'; raw.steps[0].status = 'submitting'; raw.steps[0].phase = 'post';
  raw.padding = ''; raw.padding = ' '.repeat(8192 + raw.steps.length * 2048 - Buffer.byteLength(JSON.stringify(raw)));
  f.db.prepare('UPDATE x_publishing_records SET payload=? WHERE id=?').run(JSON.stringify(raw), old.id);
  await f.restart(); assert.equal(f.store.get(old.id).status, 'unknown'); assert.equal(f.store.get(old.id).steps[0].status, 'unknown'); assert.equal(f.state.posts.length, 1);
});

test('X cancellation during image upload records media but does not write metadata or a post', async t => {
  const f = await fixture(t); await f.connect(); let release; f.state.mediaGate = new Promise(r => { release = r; });
  const record = f.service.execute(confirm(await f.preview(f.save(payload('post'), true))));
  f.service.cancel(record.id); release(); const stopped = await f.settle(); assert.equal(stopped.status, 'cancelled'); assert.equal(stopped.steps[0].mediaId, '900'); assert.equal(f.state.posts.length, 0);
  assert.equal(f.state.calls.some(c => c.url.endsWith('/media/metadata')), false);
});

for (const change of ['preview_expiry', 'saved_revision']) test(`X ${change} during image upload stops further requests while retaining the media ID`, async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(payload('post'), true);
  let release; f.state.mediaGate = new Promise(resolve => { release = resolve; });
  f.state.imageMode = change === 'preview_expiry' ? 'pending' : 'ready';
  f.service.execute(confirm(await f.preview(saved)));
  try {
    if (change === 'preview_expiry') f.advance(11 * 60 * 1000);
    else {
      let draft = f.content.revise(saved.item.id, { revision: f.content.item(saved.item.id).revision });
      draft.content.name = 'Updated synthetic revision';
      draft = f.content.updateTmp(draft.id, { revision: draft.revision, content: draft.content, temporary: draft.temporary });
      f.content.confirm(draft.id, { revision: draft.revision, confirmed: true });
    }
  } finally { release(); }
  const stopped = await f.settle();
  assert.equal(stopped.status, 'failed'); assert.equal(stopped.steps[0].mediaId, '900');
  assert.equal(f.state.checks, 0); assert.equal(f.state.posts.length, 0);
  assert.equal(f.state.calls.some(call => call.url.endsWith('/media/metadata')), false);
});

test('X competing plan cannot repeat the active first post while its image is uploading', async t => {
  const f = await fixture(t); await f.connect(); const first = f.save(payload(), true);
  const secondValue = payload(); secondValue.documents[0].blocks[1].text = 'Different synthetic remainder'; const second = f.save(secondValue, true);
  let release; f.state.mediaGate = new Promise(r => { release = r; });
  f.service.execute(confirm(await f.preview(first)));
  const competing = await f.preview(second); assert.throws(() => f.service.execute(confirm(competing)), status(409));
  release(); assert.equal((await f.settle()).status, 'published'); assert.equal(f.state.posts.length, 3);
});

test('X changing order cannot hide an already published prefix later in a new plan', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(); f.state.failAt = 2;
  f.service.execute(confirm(await f.preview(saved))); assert.equal((await f.settle()).status, 'partial');
  const value = payload(); value.documents[0].blocks = [{ id: 'new', type: 'x_post', text: 'New synthetic first post', assetIds: [] }, ...value.documents[0].blocks];
  const replacement = f.save(value), p = await f.preview(replacement); assert.throws(() => f.service.execute(confirm(p)), status(409)); assert.equal(f.state.posts.length, 2);
});

test('X transient local result persistence failure retains the returned platform ID', async t => {
  const f = await fixture(t); await f.connect(); const saved = f.save(payload('post')); const setStep = f.store.setStep; let failed = false;
  f.store.setStep = (...args) => { if (args[2].status === 'published' && !failed) { failed = true; throw new Error('Synthetic storage failure'); } return setStep(...args); };
  f.service.execute(confirm(await f.preview(saved))); const result = await f.settle(); assert.equal(result.status, 'published'); assert.equal(result.steps[0].platformId, '101'); assert.equal(f.state.posts.length, 1);
});

test('X API media expiration fails before a post and does not retry upload', async () => {
  let time = Date.now(), calls = 0;
  const api = createXApi({ clock: () => time, wait: async () => { time += 2000; }, fetchImpl: async (_url, init) => {
    calls++; if (init.method === 'POST') return json({ data: { id: '900', expires_after_secs: 1, processing_info: { state: 'pending', check_after_secs: 1 } } });
    return json({ data: { id: '900', processing_info: { state: 'succeeded' } } });
  } });
  await assert.rejects(api.upload({ token: 'SYNTHETIC', asset: { mimeType: 'image/png' }, bytes: png, altText: 'Pixel' }), /失效/); assert.equal(calls, 2); api.close();
});
