import { bad } from './content-validation.mjs';

const maxContentBody = 8 * 1024 * 1024;

export async function serveContent(req, res, pathname, store, { readBody, json }) {
  const parts = pathname.split('/').slice(3);
  const method = req.method;
  const body = () => readBody(req, maxContentBody);
  const download = ({ asset, bytes }) => {
    res.writeHead(200, { 'Content-Type': asset.mimeType, 'Content-Length': bytes.length, 'Content-Disposition': `attachment; filename="asset"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`, 'Cache-Control': 'no-store' });
    res.end(bytes);
  };
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    if (method === 'GET') return json(res, 200, { items: store.list() });
  } else if (parts[0] === 'tmp') {
    if (parts.length === 1) {
      if (method === 'GET') return json(res, 200, { items: store.listTmp() });
      if (method === 'POST') return json(res, 201, { item: store.createTmp(await body()) });
    } else if (parts.length === 2) {
      if (method === 'GET') return json(res, 200, { item: store.readTmp(parts[1]) });
      if (method === 'PUT') return json(res, 200, { item: store.updateTmp(parts[1], await body()) });
    } else if (parts.length === 3 && ['assets', 'fork', 'confirm'].includes(parts[2])) {
      if (method === 'POST') {
        const raw = await body();
        if (parts[2] === 'assets') return json(res, 201, store.upload(parts[1], raw));
        if (parts[2] === 'fork') return json(res, 201, { item: store.fork(parts[1], raw) });
        return json(res, 200, store.confirm(parts[1], raw));
      }
    } else if (parts.length === 4 && parts[2] === 'assets') {
      if (method === 'GET') return download(store.getTmpAsset(parts[1], parts[3]));
    } else bad('找不到这个内容接口。', 404);
  } else if (parts.length === 1) {
    if (method === 'GET') return json(res, 200, { item: store.item(parts[0]) });
  } else if (parts.length === 2 && parts[1] === 'revise') {
    if (method === 'POST') return json(res, 201, { item: store.revise(parts[0], await body()) });
  } else if (parts.length === 3 && parts[1] === 'versions') {
    if (method === 'GET') return json(res, 200, { version: store.version(parts[0], parts[2]) });
  } else if (parts.length === 5 && parts[1] === 'versions' && parts[3] === 'assets') {
    if (method === 'GET') return download(store.getAsset(parts[0], parts[2], parts[4]));
  } else bad('找不到这个内容接口。', 404);
  bad('此内容接口不支持该请求方式。', 405);
}
