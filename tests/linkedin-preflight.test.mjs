import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedInPreflight } from '../server/linkedin-preflight.mjs';
import { inspectLinkedInConfiguration } from '../server/linkedin-service.mjs';

const env = { LINKEDIN_CLIENT_ID: 'SYNTHETIC_CLIENT', LINKEDIN_CLIENT_SECRET: 'SECRET_SENTINEL', LINKEDIN_REDIRECT_URI: 'https://callback.example.test/api/linkedin/callback' };
const callbackHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Launch-Loop-Callback': '1' };

test('preflight missing configuration is actionable without revealing values or attempting OAuth', async () => {
  const fetchImpl = () => { throw new Error('Unexpected external call'); };
  const missing = await linkedInPreflight({ env: {}, checkCallback: true, fetchImpl });
  assert.equal(missing.configured, false);
  assert.deepEqual(missing.missing, ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI（HTTPS，路径 /api/linkedin/callback）']);
  assert.equal(missing.callback.status, 'configuration_required');
  assert.equal(missing.oauth, 'not_attempted');
  assert.ok(missing.fields.filter(field => field.defaulted).every(field => field.valid));
  const configured = await linkedInPreflight({ env, fetchImpl });
  assert.equal(configured.configured, true);
  assert.equal(configured.callback.status, 'not_checked');
  assert.equal(configured.applicationRegistration, 'operator_verification_required');
  assert.doesNotMatch(JSON.stringify(configured), /SECRET_SENTINEL|SYNTHETIC_CLIENT|callback\.example/);
});

test('preflight uses only unauthenticated GET with no query, no redirects and discards all response bodies', async () => {
  const calls = [], cancelled = [];
  const report = await linkedInPreflight({ env, checkCallback: true, fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    const callback = new URL(url).pathname === '/api/linkedin/callback';
    return { status: callback ? 401 : 404, headers: new Headers(callback ? callbackHeaders : {}), body: { cancel: async () => cancelled.push(url) }, text() { throw new Error('Must not read response body'); } };
  } });
  assert.equal(report.callback.status, 'read_only_checks_passed');
  assert.deepEqual(calls.map(call => new URL(call.url).pathname), ['/api/linkedin/callback', '/', '/api/backup', '/api/content']);
  for (const call of calls) {
    assert.equal(call.method, 'GET'); assert.equal(call.redirect, 'manual'); assert.equal(call.credentials, 'omit');
    assert.equal(new URL(call.url).search, ''); assert.deepEqual(Object.keys(call.headers), ['Accept']);
  }
  assert.equal(cancelled.length, 4);
  assert.equal(report.oauth, 'not_attempted'); assert.equal(report.publishing, 'not_attempted');
});

test('preflight rejects exposed pages, redirects and unverified callbacks without leaking raw errors', async () => {
  for (const mode of ['exposed', 'redirect', 'generic401', 'network']) {
    const report = await linkedInPreflight({ env, checkCallback: true, fetchImpl: async (url) => {
      if (mode === 'network') throw new Error('SECRET_SENTINEL proxy credentials');
      const callback = new URL(url).pathname === '/api/linkedin/callback';
      if (mode === 'redirect' && callback) return new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example.test' } });
      return new Response(null, { status: callback ? 401 : mode === 'exposed' ? 200 : 404, headers: callback && mode !== 'generic401' ? callbackHeaders : {} });
    } });
    assert.equal(report.callback.status, 'failed', mode);
    assert.doesNotMatch(JSON.stringify(report), /SECRET_SENTINEL|credentials|elsewhere/);
  }
});

test('configuration rejects blank secrets and ambiguous redirects and redacts invalid API versions', () => {
  for (const redirectUri of [' https://callback.example.test/api/linkedin/callback', 'https://callback.example.test/api/linkedin/callback\n', 'https://user:SECRET_SENTINEL@callback.example.test/api/linkedin/callback', 'https://callback.example.test/api/linkedin/callback?token=SECRET_SENTINEL']) {
    const config = inspectLinkedInConfiguration({ ...env, LINKEDIN_REDIRECT_URI: redirectUri });
    assert.equal(config.configured, false); assert.equal(config.redirectUri, null);
    assert.doesNotMatch(JSON.stringify(config), /SECRET_SENTINEL/);
  }
  assert.ok(inspectLinkedInConfiguration({ ...env, LINKEDIN_CLIENT_SECRET: '  ' }).missing.includes('LINKEDIN_CLIENT_SECRET'));
  const config = inspectLinkedInConfiguration({ ...env, LINKEDIN_API_VERSION: 'SECRET_SENTINEL' });
  assert.equal(config.configured, false); assert.equal(config.apiVersion, '');
  assert.doesNotMatch(JSON.stringify(config), /SECRET_SENTINEL/);
});
