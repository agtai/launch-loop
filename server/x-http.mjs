import { bad, fields } from './content-validation.mjs';
import { xOauthFailureHtml, xReturnUrl, oauthLocale, workbenchOrigin } from './x-oauth.mjs';

export async function serveX(req, res, pathname, service, { readBody, json }) {
  const empty = async () => fields(await readBody(req, 16 * 1024), []);
  if (pathname === '/api/x/connection') {
    if (req.method === 'GET') return json(res, 200, { connection: service.connection() });
    if (req.method === 'DELETE') { await empty(); return json(res, 200, { connection: service.disconnect() }); }
  } else if (pathname === '/api/x/start' || pathname === '/api/x/connection/start') {
    if (req.method === 'POST') {
      const body = await readBody(req, 16 * 1024); fields(body, [], ['locale']);
      return json(res, 200, service.startAuth({ returnOrigin: workbenchOrigin(`http://${req.headers.host}`), locale: oauthLocale(body.locale) }));
    }
  } else if (pathname === '/api/x/callback') {
    if (req.method === 'GET') {
      const result = await service.browserCallback(new URL(req.url, 'http://localhost').searchParams);
      const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
      if (result.ok) { res.writeHead(303, { ...headers, Location: xReturnUrl(result.returnOrigin, true) }); return res.end(); }
      const returnOrigin = result.returnOrigin ?? workbenchOrigin(`http://${req.headers.host}`);
      res.writeHead(result.status, { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" });
      return res.end(xOauthFailureHtml({ ...result, returnOrigin }));
    }
  } else if (pathname === '/api/x/previews') {
    if (req.method === 'POST') return json(res, 201, { preview: await service.preview(await readBody(req, 16 * 1024)) });
  } else if (pathname === '/api/x/execute') {
    if (req.method === 'POST') return json(res, 202, { record: service.execute(await readBody(req, 16 * 1024)) });
  } else if (pathname === '/api/x/records') {
    if (req.method === 'GET') return json(res, 200, { items: service.list() });
  } else {
    const match = /^\/api\/x\/records\/([-a-zA-Z0-9_]{1,120})(\/(cancel|reconcile))?$/.exec(pathname);
    if (!match) bad('找不到 X 发布接口。', 404);
    if (!match[2] && req.method === 'GET') return json(res, 200, { record: service.get(match[1]) });
    if (match[2] && req.method === 'POST') { await empty(); return json(res, 200, { record: await service[match[3]](match[1]) }); }
  }
  bad('X 发布接口不支持该请求方式。', 405);
}
