import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectLinkedInConfiguration } from './linkedin-service.mjs';

const names = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI', 'LINKEDIN_API_VERSION', 'LINKEDIN_SCOPES'];

/** Reads current-process configuration only. Never exchanges codes or sends a write request. */
export async function linkedInPreflight({ env = process.env, checkCallback = false, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const config = inspectLinkedInConfiguration(env);
  const report = {
    configured: config.configured,
    fields: names.map(name => ({ name, present: typeof env[name] === 'string' && env[name].trim().length > 0, valid: !config.missing.some(value => value.startsWith(name)), defaulted: !env[name] && ['LINKEDIN_API_VERSION', 'LINKEDIN_SCOPES'].includes(name) })),
    missing: config.missing,
    applicationRegistration: 'operator_verification_required',
    productPermissions: 'operator_verification_required',
    oauth: 'not_attempted', publishing: 'not_attempted',
    callback: { status: checkCallback ? 'configuration_required' : 'not_checked', checks: [] },
  };
  if (!checkCallback || !config.redirectUri) return report;
  const callbackUrl = new URL(config.redirectUri);
  const checks = [{ pathname: '/api/linkedin/callback', callback: true }, ...['/', '/api/backup', '/api/content'].map(pathname => ({ pathname, callback: false }))];
  for (const check of checks) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // No cookies, authorization, query string, redirects or response body reads.
      const response = await fetchImpl(new URL(check.pathname, callbackUrl.origin).href, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal, headers: { Accept: check.callback ? 'text/html' : '*/*' } });
      try { await response.body?.cancel(); } catch { /* Response payloads are not diagnostics. */ }
      const valid = check.callback
        ? response.status === 401 && response.headers.get('x-launch-loop-callback') === '1' && response.headers.get('cache-control') === 'no-store' && response.headers.get('referrer-policy') === 'no-referrer' && response.headers.get('content-type')?.startsWith('text/html') === true && !response.headers.get('location')
        : [403, 404, 405].includes(response.status);
      report.callback.checks.push({ path: check.pathname, status: response.status, passed: valid });
    } catch {
      // Errors may embed the URL or proxy credentials. Never include raw errors.
      report.callback.checks.push({ path: check.pathname, status: null, passed: false });
    } finally { clearTimeout(timer); }
  }
  report.callback.status = report.callback.checks.every(check => check.passed) ? 'read_only_checks_passed' : 'failed';
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check-callback') || args.length > 1) {
    process.stderr.write('Usage: node server/linkedin-preflight.mjs [--check-callback]\n'); process.exitCode = 2;
  } else {
    const report = await linkedInPreflight({ checkCallback: args.includes('--check-callback') });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.configured && (!args.length || report.callback.status === 'read_only_checks_passed') ? 0 : 1;
  }
}
