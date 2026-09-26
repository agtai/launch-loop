import * as v from './content-validation.mjs';
import { prepareXImages, bindXImage, verifyXImage } from './x-images.mjs';

export async function serveXImages(req, res, pathname, content, { readBody, json, imageService }) {
  if (pathname === '/api/x-images/capabilities') {
    if (req.method !== 'GET') v.bad('配图接口不支持该请求方式。', 405);
    return json(res, 200, { capability: imageService?.capabilities() ?? { available: false, status: 'disabled', checking: false, canRefresh: false, reason: 'X 后台配图服务尚未接入。' } });
  }
  if (pathname === '/api/x-images/capabilities/refresh') {
    if (req.method !== 'POST') v.bad('配图操作需要 POST。', 405);
    v.fields(await readBody(req), []);
    if (!imageService?.capabilities().canRefresh) v.bad('后台配图尚未启用 Codex 官方缓存适配。', 409);
    void imageService.refreshCapability().catch(() => {});
    return json(res, 202, { capability: imageService.capabilities() });
  }
  if (pathname === '/api/x-images/jobs' || /^\/api\/x-images\/jobs\//.test(pathname)) {
    if (!imageService) v.bad('X 后台配图服务尚未接入。', 503);
    if (pathname === '/api/x-images/jobs') {
      if (req.method === 'POST') return json(res, 202, { job: imageService.create(await readBody(req)) });
      if (req.method === 'GET') {
        const tmpId = new URL(req.url, 'http://localhost').searchParams.get('tmpId'); if (tmpId) v.id(tmpId);
        return json(res, 200, { items: imageService.list(tmpId ? { tmpId } : {}) });
      }
    }
    const jobMatch = /^\/api\/x-images\/jobs\/([-\w]+)(\/cancel)?$/.exec(pathname);
    if (jobMatch && !jobMatch[2] && req.method === 'GET') return json(res, 200, { job: imageService.get(jobMatch[1]) });
    if (jobMatch && jobMatch[2] && req.method === 'POST') { v.fields(await readBody(req), []); return json(res, 200, { job: imageService.cancel(jobMatch[1]) }); }
    v.bad('配图接口不支持该请求方式。', 405);
  }
  const match = /^\/api\/x-images\/tmp\/([-\w]+)\/(prepare|bind|verify)$/.exec(pathname);
  if (!match) v.bad('找不到配图接口。', 404);
  if (req.method !== 'POST') v.bad('配图操作需要 POST。', 405);
  const input = await readBody(req);
  v.fields(input, ['revision', 'documentId'], match[2] === 'bind' ? ['assetId'] : match[2] === 'verify' ? ['confirmed', 'altText', 'generated'] : []);
  v.id(input.documentId);
  const tmp = content.readTmp(match[1]);
  if (tmp.content.platform !== 'x') v.bad('此配图入口仅支持 X。');
  if (tmp.revision !== v.integer(input.revision) || tmp.stale || tmp.confirmed) v.bad('稿件已更改，请重新载入后处理配图。', 409);
  const generatedAssetHashes = tmp.content.documents.flatMap(doc => doc.blocks.filter(block => block.image?.generated && block.image.assetHash).map(block => block.image.assetHash));
  let documents;
  if (match[2] === 'bind') {
    v.id(input.documentId); v.id(input.assetId);
    const document = tmp.content.documents.find(doc => doc.id === input.documentId);
    if (!document) v.bad('找不到所选内容对象。', 404);
    const { asset, bytes } = content.getTmpAsset(tmp.id, input.assetId);
    const bound = bindXImage(document, { language: tmp.content.language, asset, bytes, generated: generatedAssetHashes.includes(asset.sha256) });
    documents = tmp.content.documents.map(doc => doc.id === document.id ? bound : doc);
  } else if (match[2] === 'verify') {
    v.id(input.documentId);
    if (input.confirmed !== true) v.bad('请先实际检查配图。');
    const doc = tmp.content.documents.find(d => d.id === input.documentId);
    if (!doc?.blocks[0]?.image) v.bad('请先关联图片。');
    const checked = verifyXImage(doc, {language: tmp.content.language, assets: tmp.assets, assetHash: doc.blocks[0].image.assetHash, textHash: doc.blocks[0].image.textHash, altText: input.altText, generated: input.generated, getAssetBytes: id => content.getTmpAsset(tmp.id, id).bytes});
    documents = tmp.content.documents.map(d => d.id === doc.id ? checked : d);
  } else {
    const doc = tmp.content.documents.find(d => d.id === input.documentId);
    if (!doc) v.bad('找不到所选内容对象。', 404);
    const fresh = {...doc, blocks: doc.blocks.map(block => { const {image, ...rest} = block; return rest; })};
    // Refresh only this object and retain its explicit selection, including no image.
    const selected = new Set(doc.blocks.flatMap(block => block.assetIds || []));
    const [prepared] = await prepareXImages([fresh], { language: tmp.content.language, assets: tmp.assets.filter(a => selected.has(a.id)), getAssetBytes: id => content.getTmpAsset(tmp.id, id).bytes, backend: null, generatedAssetHashes });
    documents = tmp.content.documents.map(d => d.id === doc.id ? prepared : d);
  }
  const item = content.updateTmp(tmp.id, { revision: tmp.revision, content: { ...tmp.content, documents }, temporary: tmp.temporary });
  return json(res, 200, { item });
}
