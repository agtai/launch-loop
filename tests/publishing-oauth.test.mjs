import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinkedInService } from '../server/linkedin-service.mjs';
import { oauthFailureHtml, workbenchOrigin, workbenchReturnUrl } from '../server/linkedin-oauth.mjs';

const env = { LINKEDIN_CLIENT_ID: 'SYNTHETIC_CLIENT', LINKEDIN_CLIENT_SECRET: 'SECRET_SENTINEL', LINKEDIN_REDIRECT_URI: 'https://callback.example.test/api/linkedin/callback' };
function fixture(t, options = {}) {
  const calls = []; let clock = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.redirect, 'error');
    if (url.endsWith('/accessToken')) {
      await options.gate;
      if (options.tokenStatus) return Response.json({ error: 'REMOTE_SECRET_SENTINEL', error_description: '<script>RAW_CODE_SENTINEL</script>' }, { status: options.tokenStatus });
      return Response.json({ access_token: options.token ?? 'TOKEN_SENTINEL', expires_in: 3600, scope: options.scopes ?? 'openid profile w_member_social' });
    }
    if (url.endsWith('/userinfo')) {
      if (options.profileStatus) return Response.json({ error: 'REMOTE_SECRET_SENTINEL' }, { status: options.profileStatus });
      return Response.json({ sub: 'synthetic-member', name: 'Synthetic Member' });
    }
    throw new Error('No other remote operation is authorized by this fixture.');
  };
  const service = createLinkedInService({ store: { assertCanRestore() {} }, content: {}, env, fetchImpl, clock: () => clock });
  t.after(() => service.close());
  return { service, calls, advance(ms) { clock += ms; }, start(options = {}) { return new URL(service.startAuth({ returnOrigin: 'http://127.0.0.1:4318', ...options }).authorizationUrl).searchParams.get('state'); } };
}

test('OAuth return URLs allow only exact loopback origins and a fixed publishing path', () => {
  for (const origin of ['http://127.0.0.1:1', 'http://127.0.0.1:65535', 'http://localhost:4318']) {
    assert.equal(workbenchOrigin(origin), origin);
    assert.equal(workbenchReturnUrl(origin, true), `${origin}/#publishing?linkedin=connected`);
  }
  const invalid = ['https://evil.example.test', '//evil.example.test', 'http://localhost.evil.test:4318', 'http://localhost:4318@evil.example.test', 'http://evil.example.test@localhost:4318', 'http://2130706433:4318', 'http://127.0.0.2:4318', 'http://127.1:4318', 'http://%6cocalhost:4318', 'http://localhost:0', 'http://localhost:65536', 'http://localhost:04318', 'http://localhost:4318/', 'http://localhost:4318/?returnUrl=https://evil.example.test', 'http://localhost:4318/#evil', 'http://localhost:4318\r\nLocation: https://evil.example.test', null];
  for (const origin of invalid) assert.throws(() => workbenchReturnUrl(origin, true), error => error.status === 400);
  assert.throws(() => oauthFailureHtml({ status: 401, returnOrigin: 'https://evil.example.test' }));
});

test('browser callback binds state to the initiating origin and never returns credentials', async t => {
  const f = fixture(t);
  const state = f.start({ returnOrigin: 'http://localhost:4567', locale: 'en' });
  const input = new URLSearchParams({ state, code: 'CODE_SENTINEL', returnUrl: 'https://evil.example.test', locale: 'zh' });
  const result = await f.service.browserCallback(input);
  assert.equal(result.ok, true); assert.equal(result.status, 303); assert.equal(result.returnOrigin, 'http://localhost:4567'); assert.equal(result.locale, 'en');
  assert.equal(result.connection.account.id, 'synthetic-member');
  assert.doesNotMatch(JSON.stringify(result), /TOKEN_SENTINEL|SECRET_SENTINEL|CODE_SENTINEL|evil\.example/);
  const replay = await f.service.browserCallback(input);
  assert.deepEqual(replay, { ok: false, status: 401, returnOrigin: null, locale: 'zh' });
  assert.equal(f.calls.length, 2);
});

test('browser callback expiry and cancellation do not exchange a code or erase an unrelated valid attempt', async t => {
  const f = fixture(t); const state = f.start({ locale: 'en' });
  for (const params of [new URLSearchParams({ state: 'INVALID', code: 'CODE_SENTINEL' }), new URLSearchParams(`state=${state}&state=${state}&code=CODE_SENTINEL`)]) {
    const result = await f.service.browserCallback(params); assert.equal(result.status, 401); assert.equal(result.returnOrigin, null);
  }
  const cancelled = await f.service.browserCallback(new URLSearchParams({ state, error: 'UNTRUSTED_REMOTE_ERROR', error_description: 'RAW_CODE_SENTINEL' }));
  assert.equal(cancelled.status, 400); assert.equal(cancelled.locale, 'en'); assert.equal(cancelled.returnOrigin, 'http://127.0.0.1:4318');
  assert.doesNotMatch(JSON.stringify(cancelled), /UNTRUSTED|RAW_CODE/);
  const expiring = f.start(); f.advance(600001);
  assert.equal((await f.service.browserCallback(new URLSearchParams({ state: expiring, code: 'CODE_SENTINEL' }))).status, 401);
  assert.equal(f.calls.length, 0); assert.equal(f.service.connection().status, 'disconnected');
});

test('OAuth token or userinfo failure returns safe browser failure without establishing a connection', async t => {
  for (const options of [{ tokenStatus: 401 }, { tokenStatus: 500 }, { profileStatus: 401 }, { token: 'invalid\r\nTOKEN_SENTINEL' }]) await t.test(JSON.stringify(options), async t => {
    const f = fixture(t, options), state = f.start({ locale: 'en' });
    const result = await f.service.browserCallback(new URLSearchParams({ state, code: 'CODE_SENTINEL' }));
    assert.equal(result.status, 502); assert.equal(result.ok, false); assert.equal(result.locale, 'en');
    assert.equal(f.service.connection().status, 'disconnected');
    const html = oauthFailureHtml(result);
    assert.match(html, /LinkedIn connection incomplete/); assert.match(html, /LinkedIn 连接未完成/);
    assert.doesNotMatch(html + JSON.stringify(result), /TOKEN_SENTINEL|SECRET_SENTINEL|CODE_SENTINEL|REMOTE_SECRET|<script/i);
    assert.equal((await f.service.browserCallback(new URLSearchParams({ state, code: 'CODE_SENTINEL' }))).status, 401);
  });
});

test('concurrent repeated callbacks exchange once and disconnect prevents an in-flight grant from reconnecting', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const f = fixture(t, { gate }), state = f.start();
  const input = new URLSearchParams({ state, code: 'CODE_SENTINEL' });
  const first = f.service.browserCallback(input);
  assert.equal((await f.service.browserCallback(input)).status, 401);
  f.service.disconnect(); release();
  assert.equal((await first).status, 409); assert.equal(f.service.connection().status, 'disconnected');
  assert.equal(f.calls.filter(call => call.url.endsWith('/accessToken')).length, 1);
});

test('only validated returned OAuth scopes enable publishing, including documented URL encoding', async t => {
  for (const scopes of ['openid%20profile%20w_member_social', 'openid+profile+w_member_social', 'openid profile w_member_social']) await t.test(scopes, async t => {
    const f = fixture(t, { scopes }), state = f.start();
    const result = await f.service.browserCallback(new URLSearchParams({ state, code: 'CODE_SENTINEL' }));
    assert.equal(result.connection.canPublish, true); assert.deepEqual(result.connection.scopes, ['openid', 'profile', 'w_member_social']);
  });
  for (const scopes of ['', 'openid profile', 'openid%20profile%20w_member_social%ZZ', 'openid%20profile%20w_member_social%0A', 'openid profile w_member_social<script>']) await t.test(scopes || 'empty', async t => {
    const f = fixture(t, { scopes }), state = f.start();
    const result = await f.service.browserCallback(new URLSearchParams({ state, code: 'CODE_SENTINEL' }));
    assert.equal(result.connection.canPublish, false); assert.equal(result.connection.status, 'missing_permissions');
    assert.doesNotMatch(JSON.stringify(result.connection.scopes), /%|<script|\\n/);
  });
});
