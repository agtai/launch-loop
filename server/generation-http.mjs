import { bad, fields } from './content-validation.mjs';

export async function serveGeneration(req, res, pathname, service, { readBody, json }) {
  const parts = pathname.split('/').slice(3), method = req.method;
  const body = () => readBody(req, 8 * 1024 * 1024);
  if (parts.length === 1 && parts[0] === 'capabilities' && method === 'GET') return json(res, 200, service.capabilities());
  if (parts.length === 1 && parts[0] === 'modifications' && method === 'POST') return json(res, 202, { job: service.modify(await body()) });
  if (parts[0] === 'jobs') {
    if (parts.length === 1) {
      if (method === 'GET') return json(res, 200, { items: service.list() });
      if (method === 'POST') return json(res, 202, { job: service.create(await body()) });
    }
    if (parts.length === 2 && method === 'GET') return json(res, 200, { job: service.get(parts[1]) });
    if (parts.length === 3 && method === 'POST') {
      if (parts[2] === 'cancel') { fields(await body(), []); return json(res, 200, { job: service.cancel(parts[1]) }); }
      if (parts[2] === 'accept') return json(res, 200, { item: service.accept(parts[1], await body()) });
    }
  }
  bad('找不到该生成接口或不支持此请求方式。', 404);
}
