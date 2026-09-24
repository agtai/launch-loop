import { bad, fields } from './content-validation.mjs';

export async function servePublishing(req, res, pathname, service, { readBody, json }) {
  const emptyBody = async () => fields(await readBody(req, 16 * 1024), []);
  if (pathname === '/api/linkedin/connection') {
    if (req.method === 'GET') return json(res, 200, { connection: service.connection() });
    if (req.method === 'DELETE') { await emptyBody(); return json(res, 200, { connection: service.disconnect() }); }
  } else if (pathname === '/api/linkedin/connection/start') {
    if (req.method === 'POST') { await emptyBody(); return json(res, 200, service.startAuth()); }
  } else if (pathname === '/api/linkedin/callback') {
    if (req.method === 'GET') {
      const connection = await service.callback(new URL(req.url, 'http://localhost').searchParams);
      return json(res, 200, { connection, message: 'LinkedIn 连接流程已完成。请返回本机工作台刷新账号状态；这一步没有发帖。' });
    }
  } else if (pathname === '/api/publishing/previews') {
    if (req.method === 'POST') return json(res, 201, { preview: service.preview(await readBody(req, 16 * 1024)) });
  } else if (pathname === '/api/publishing/execute') {
    if (req.method === 'POST') return json(res, 202, { record: service.execute(await readBody(req, 16 * 1024)) });
  } else if (pathname === '/api/publishing/records') {
    if (req.method === 'GET') return json(res, 200, { items: service.list() });
  } else {
    const match = /^\/api\/publishing\/records\/([-a-zA-Z0-9_]{1,120})(\/reconcile)?$/.exec(pathname);
    if (!match) bad('找不到这个发布接口。', 404);
    if (!match[2] && req.method === 'GET') return json(res, 200, { record: service.get(match[1]) });
    if (match[2] && req.method === 'POST') { await emptyBody(); return json(res, 200, { record: await service.reconcile(match[1]) }); }
  }
  bad('此发布接口不支持该请求方式。', 405);
}
