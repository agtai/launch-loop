import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server/index.mjs';
import { createXService } from '../server/x-service.mjs';
import { xConfiguration, xReturnUrl } from '../server/x-oauth.mjs';

const env = { X_CLIENT_ID: 'SYNTHETIC', X_REDIRECT_URI: 'https://callback.example.test/api/x/callback' };

test('X OAuth callback is host-bound, CSRF-safe, credential-free and backup routes retain both platforms', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'launch-x-http-'));
  const dataDir = path.join(root, 'data'), seedDir = path.join(root, 'seed'), distDir = path.join(root, 'dist');
  await Promise.all([mkdir(dataDir), mkdir(seedDir), mkdir(distDir)]);
  const modules = ['research', 'creation', 'review', 'publishing', 'feedback'].map(id => ({ id, owner: '', status: '待试跑', input: '', steps: [], output: '', acceptance: '', tools: '', notes: '', resultUrl: '', revision: 0, updatedAt: null }));
  await Promise.all([writeFile(path.join(seedDir, 'modules.json'), JSON.stringify(modules)), writeFile(path.join(seedDir, 'tasks.json'), '[{"id":"synthetic"}]'), writeFile(path.join(distDir, 'index.html'), '<h1>Synthetic</h1>')]);
  let calls = 0, posts = 0, release; const gate = new Promise(resolve => { release = resolve; });
  const xOptions = { env, fetchImpl: async (url, init) => {
    calls++;
    if (url.endsWith('/oauth2/token')) return Response.json({ access_token: 'TOKEN_SENTINEL', token_type: 'bearer', expires_in: 7200, scope: 'tweet.read tweet.write users.read media.write' });
    if (url.endsWith('/users/me')) return Response.json({ data: { id: '111', name: 'Synthetic', username: 'synthetic' } });
    if (url.endsWith('/tweets')) { posts++; await gate; return Response.json({ data: { id: '123', text: JSON.parse(init.body).text } }, { status: 201 }); }
    throw new Error('Unexpected synthetic request');
  } };
  let app = await startServer({ port: 0, dataDir, seedDir, distDir, linkedInOptions: { env: {} }, xOptions });
  t.after(async () => { release(); await app.close(); assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  const req = (route, body, method = body === undefined ? 'GET' : 'POST', headers = {}) => fetch(app.url + route, { method, redirect: 'manual', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ok = async (route, body, method) => { const r = await req(route, body, method); const value = await r.json(); assert.ok(r.ok, JSON.stringify(value)); return value; };
  assert.equal((await ok('/api/x/connection')).connection.status, 'disconnected');
  assert.equal((await req('/api/x/start', {}, 'POST', { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await req('/api/x/callback', {}, 'POST', { Origin: 'https://x.com' })).status, 403);
  assert.equal((await req('/api/x/start', { returnOrigin: 'https://evil.test' })).status, 400);
  const bad = await req('/api/x/callback?state=RAW_SENTINEL&code=CODE_SENTINEL&returnUrl=https://evil.test', undefined, 'GET', { Origin: 'https://x.com', 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(bad.status, 401); assert.equal(bad.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await bad.text(), /RAW_SENTINEL|CODE_SENTINEL|evil.test/); assert.equal(calls, 0);
  const start = new URL((await ok('/api/x/start', { locale: 'en' })).authorizationUrl);
  const route = `/api/x/callback?state=${start.searchParams.get('state')}&code=CODE_SENTINEL&returnUrl=https://evil.test`;
  const callback = await req(route, undefined, 'GET', { Origin: 'https://x.com', 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(callback.status, 303); assert.equal(callback.headers.get('location'), `${app.url}/#publishing?x=connected`); assert.equal(await callback.text(), '');
  assert.equal((await req(route)).status, 401); assert.equal(calls, 2); assert.equal((await ok('/api/x/connection')).connection.canPublish, true);
  const value = { name: 'Synthetic HTTP X', projectId: null, platform: 'x', language: 'en', brief: { materials: [{ id: 'material', type: 'text', label: 'Synthetic', text: 'Synthetic material' }], purpose: 'Test', audience: 'Test', platforms: ['x'], languages: ['en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [{ id: 'post', kind: 'post', title: '', postingNote: '', blocks: [{ id: 'p', type: 'x_post', text: 'SYNTHETIC_X_BODY', assetIds: [] }] }], sources: [], assetIds: [], rule: null, executions: [] };
  const draft = (await ok('/api/content/tmp', { content: value })).item, saved = await ok(`/api/content/tmp/${draft.id}/confirm`, { revision: draft.revision, confirmed: true });
  const before = await ok('/api/backup'); assert.equal(before.app, 'content-workbench-local'); assert.equal(before.version, 1); assert.deepEqual(before.publishing.records, []); assert.deepEqual(before.xPublishing.records, []);
  const p = (await ok('/api/x/previews', { itemId: saved.item.id, versionId: saved.version.id, documentId: 'post', accountId: '111' })).preview;
  const confirmation = { previewId: p.id, confirmationToken: p.confirmationToken, confirmed: true };
  const [a, b] = await Promise.all([ok('/api/x/execute', confirmation), ok('/api/x/execute', confirmation)]); assert.equal(a.record.id, b.record.id); assert.equal(posts, 1);
  assert.equal((await req('/api/restore', before)).status, 409); release();
  let record; for (let i = 0; i < 100; i++) { record = (await ok(`/api/x/records/${a.record.id}`)).record; if (!record.active) break; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.equal(record.status, 'published'); const after = await ok('/api/backup'); assert.doesNotMatch(JSON.stringify(after.xPublishing), /SYNTHETIC_X_BODY|TOKEN_SENTINEL/);
  await ok('/api/restore', before); assert.equal((await ok(`/api/x/records/${record.id}`)).record.status, 'published');
  const legacy = structuredClone(before); delete legacy.xPublishing; delete legacy.publishing; delete legacy.content;
  await ok('/api/restore', legacy); assert.equal((await ok('/api/x/records')).items.length, 1);
  const corrupt = structuredClone(after); corrupt.xPublishing.records[0].credential = 'BAD'; assert.equal((await req('/api/restore', corrupt)).status, 400);
  await app.close(); app = await startServer({ port: 0, dataDir, seedDir, distDir, linkedInOptions: { env: {} }, xOptions });
  assert.equal((await ok('/api/x/connection')).connection.status, 'disconnected'); assert.equal((await ok('/api/x/execute', confirmation)).record.id, record.id); assert.equal(posts, 1);
});

test('X OAuth state expiry, callback replay and disconnect reject delayed grants', async t => {
  let now = 0, release, calls = 0; const gate = new Promise(resolve => { release = resolve; });
  const service = createXService({ store: { assertCanRestore() {} }, content: {}, env, clock: () => now, fetchImpl: async url => {
    calls++; if (url.endsWith('/oauth2/token')) { await gate; return Response.json({ access_token: 'TOKEN_SENTINEL', token_type: 'bearer', expires_in: 7200, scope: 'tweet.read tweet.write users.read media.write' }); }
    return Response.json({ data: { id: '111', name: 'Synthetic', username: 'synthetic' } });
  } });
  t.after(() => service.close());
  const start = () => new URL(service.startAuth({ returnOrigin: 'http://localhost:4567', locale: 'en' }).authorizationUrl).searchParams.get('state');
  const expired = start(); now += 600001; assert.equal((await service.browserCallback({ state: expired, code: 'SYNTHETIC' })).status, 401); assert.equal(calls, 0);
  const state = start(), first = service.browserCallback({ state, code: 'SYNTHETIC' });
  assert.equal((await service.browserCallback({ state, code: 'SYNTHETIC' })).status, 401); service.disconnect(); release();
  assert.equal((await first).status, 409); assert.equal(service.connection().status, 'disconnected');
});

test('X callback configuration and return origins never accept untrusted remote URLs', () => {
  for (const uri of ['http://127.0.0.1:4318/api/x/callback', 'https://example.test/api/x/callback?secret=x', 'https://user:secret@example.test/api/x/callback', 'https://example.test/api/linkedin/callback', ' https://example.test/api/x/callback', 'https://example.test/api/x/callback\t', 'https:\\\\example.test\\api\\x\\callback', 'https://example.test/api/x/call\nback']) assert.equal(xConfiguration({ ...env, X_REDIRECT_URI: uri }).public.configured, false, JSON.stringify(uri));
  assert.equal(xConfiguration({ ...env, X_CLIENT_SECRET: '   ' }).public.configured, false);
  assert.equal(xConfiguration({ ...env, X_REDIRECT_URI: '\u0001https://example.test/api/x/callback' }).public.configured, false);
  assert.equal(xConfiguration({ ...env, X_CLIENT_SECRET: '' }).public.configured, true, 'Public clients do not require a secret');
  for (const origin of ['https://evil.test', 'http://localhost.evil.test:4318', 'http://localhost:4318/', 'http://2130706433:4318', 'http://localhost:04318']) assert.throws(() => xReturnUrl(origin));
});
