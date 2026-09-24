import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../server/index.mjs';

test('HTTP publishing routes preserve CSRF, durable dedupe, backup merge and callback boundaries', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'launch-publishing-http-'));
  const dataDir = path.join(root, 'data'), seedDir = path.join(root, 'seed'), distDir = path.join(root, 'dist');
  await Promise.all([mkdir(dataDir), mkdir(seedDir), mkdir(distDir)]);
  const modules = ['research', 'creation', 'review', 'publishing', 'feedback'].map(id => ({ id, owner: '', status: '待试跑', input: '', steps: [], output: '', acceptance: '', tools: '', notes: '', resultUrl: '', revision: 0, updatedAt: null }));
  await Promise.all([writeFile(path.join(seedDir, 'modules.json'), JSON.stringify(modules)), writeFile(path.join(seedDir, 'tasks.json'), JSON.stringify([{ id: 'synthetic' }])), writeFile(path.join(distDir, 'index.html'), '<h1>Synthetic</h1>')]);
  let postCount = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const linkedInOptions = {
    env: { LINKEDIN_CLIENT_ID: 'SYNTHETIC', LINKEDIN_CLIENT_SECRET: 'SECRET_SENTINEL', LINKEDIN_REDIRECT_URI: 'https://callback.example.test/api/linkedin/callback' },
    fetchImpl: async (url, init) => {
      if (url.endsWith('/accessToken')) return Response.json({ access_token: 'TOKEN_SENTINEL', expires_in: 3600, scope: 'openid profile w_member_social' });
      if (url.endsWith('/userinfo')) return Response.json({ sub: 'synthetic-member', name: 'Synthetic Member' });
      if (url.endsWith('/rest/posts')) { postCount++; assert.equal(JSON.parse(init.body).author, 'urn:li:person:synthetic-member'); await gate; return Response.json({}, { status: 201, headers: { 'x-restli-id': 'urn:li:share:987654' } }); }
      throw new Error('Unexpected synthetic fetch');
    },
  };
  let app = await startServer({ port: 0, dataDir, seedDir, distDir, linkedInOptions });
  t.after(async () => { release(); await app.close(); assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  const request = (route, body, method = body === undefined ? 'GET' : 'POST', headers = {}) => fetch(app.url + route, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ok = async (route, body, method) => { const res = await request(route, body, method); const value = await res.json(); assert.ok(res.ok, `${route}: ${res.status} ${JSON.stringify(value)}`); return value; };
  assert.equal((await ok('/api/linkedin/connection')).connection.status, 'disconnected');
  assert.equal((await request('/api/linkedin/connection/start', {}, 'POST', { Origin: 'https://evil.example.test' })).status, 403);
  assert.equal((await request('/api/linkedin/callback', {}, 'POST', { Origin: 'https://evil.example.test' })).status, 403);
  assert.equal((await request('/api/linkedin/callback?state=bad&code=bad', undefined, 'GET', { Origin: 'https://www.linkedin.com', 'Sec-Fetch-Site': 'cross-site' })).status, 401);
  const auth = new URL((await ok('/api/linkedin/connection/start', {})).authorizationUrl);
  const callback = await request(`/api/linkedin/callback?state=${auth.searchParams.get('state')}&code=SYNTHETIC`, undefined, 'GET', { Origin: 'https://www.linkedin.com', 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(callback.status, 200); assert.equal((await callback.json()).connection.canPublish, true);
  const draft = { name: 'Synthetic HTTP', projectId: null, platform: 'linkedin', language: 'en', brief: { materials: [{ id: 'material', label: 'Synthetic input', type: 'text', text: 'Synthetic material.' }], purpose: 'Test HTTP', audience: 'Test runner', platforms: [], languages: [], formats: [], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, documents: [{ id: 'post', kind: 'linkedin_post', title: 'Synthetic title', blocks: [{ id: 'p', type: 'paragraph', text: 'SYNTHETIC_BODY' }], postingNote: '' }], sources: [], assetIds: [], rule: null, executions: [] };
  const tmp = (await ok('/api/content/tmp', { content: draft })).item;
  const saved = await ok(`/api/content/tmp/${tmp.id}/confirm`, { revision: tmp.revision, confirmed: true });
  const before = await ok('/api/backup');
  const previewRequest = { itemId: saved.item.id, versionId: saved.version.id, accountId: 'synthetic-member' };
  const preview = (await ok('/api/publishing/previews', previewRequest)).preview;
  const confirm = { previewId: preview.id, confirmationToken: preview.confirmationToken, confirmed: true };
  const attempts = await Promise.all([1, 2, 3].map(() => ok('/api/publishing/execute', confirm)));
  assert.equal(new Set(attempts.map(result => result.record.id)).size, 1);
  assert.equal((await request('/api/restore', before)).status, 409);
  if (process.platform === 'win32') await assert.rejects(startServer({ port: 0, dataDir, seedDir, distDir, linkedInOptions }), /已有工作台服务/);
  release();
  let record;
  for (let i = 0; i < 100; i++) { record = (await ok(`/api/publishing/records/${attempts[0].record.id}`)).record; if (record.status !== 'submitting') break; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.equal(record.status, 'published'); assert.equal(postCount, 1);
  const after = await ok('/api/backup');
  assert.doesNotMatch(JSON.stringify(after.publishing), /SYNTHETIC_BODY|TOKEN_SENTINEL|SECRET_SENTINEL/);
  const badBackup = structuredClone(after); badBackup.publishing.records[0].secret = 'secret';
  assert.equal((await request('/api/restore', badBackup)).status, 400);
  const previewsBeforeRestore = (await ok('/api/publishing/previews', previewRequest)).preview;
  await ok('/api/restore', before);
  assert.equal((await ok(`/api/publishing/records/${record.id}`)).record.status, 'published');
  assert.equal((await request('/api/publishing/execute', { previewId: previewsBeforeRestore.id, confirmationToken: previewsBeforeRestore.confirmationToken, confirmed: true })).status, 409);
  assert.equal((await readdir(path.join(dataDir, 'backups'))).some(name => name.startsWith('pre-restore-')), true);
  const old = structuredClone(before); delete old.content; delete old.publishing;
  await ok('/api/restore', old); assert.equal((await ok('/api/publishing/records')).items[0].status, 'published');
  await app.close(); app = await startServer({ port: 0, dataDir, seedDir, distDir, linkedInOptions });
  assert.equal((await ok('/api/linkedin/connection')).connection.status, 'disconnected');
  assert.equal((await ok('/api/publishing/execute', confirm)).record.id, record.id);
  assert.equal(postCount, 1);
});
