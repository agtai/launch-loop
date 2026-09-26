import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareXImages, bindXImage, inspectXImage, reconcileXImages, validateXImageBinding, verifyXImage, assertXImagePublishable, xImageDocumentHash } from '../server/x-images.mjs';

// A synthetic one-pixel PNG tests byte plumbing only; never a visual acceptance asset.
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const hash = value => createHash('sha256').update(value).digest('hex');
const asset = { id: 'image-1', fileName: 'synthetic.png', mimeType: 'image/png', byteLength: bytes.length, sha256: hash(bytes), source: { kind: 'upload', url: null }, caption: '' };
const doc = kind => ({ id: `doc-${kind}`, kind, title: '', postingNote: '', blocks: [{ id: 'one', type: 'x_post', text: '试点尚未完成。', assetIds: [] }, ...(kind === 'thread' ? [{ id: 'two', type: 'x_post', text: 'The pilot is planned.', assetIds: [] }] : [])] });
const bound = (kind = 'post') => bindXImage(doc(kind), { language: 'zh', asset, bytes });
const verified = (document, generated = false) => verifyXImage(document, { language: 'zh', assets: [asset], getAssetBytes: () => bytes, assetHash: document.blocks[0].image.assetHash, textHash: document.blocks[0].image.textHash, altText: '合成测试像素，不是产品截图。', generated });

test('X images: default generation intent is dependency_blocked with real text/brief hashes', async () => {
  const documents = [doc('post'), doc('thread')];
  const prepared = await prepareXImages(documents, { language: 'en' });
  assert.equal(documents[0].blocks[0].image, undefined);
  for (const document of prepared) {
    const image = document.blocks[0].image;
    assert.equal(image.intent, 'generate'); assert.equal(image.status, 'dependency_blocked');
    assert.equal(image.visualVerification, 'not_run'); assert.equal(image.assetHash, null);
    assert.equal(image.textHash, hash(document.blocks[0].text)); assert.equal(image.briefHash, hash(image.brief));
    assert.match(image.brief, /手机信息流/); assert.match(image.brief, /试点尚未完成/);
  }
  assert.equal(prepared[1].blocks[1].image, undefined);
});

test('X images: actual upload binds first post and dimensions without claiming generated or viewed', async () => {
  const result = await prepareXImages([doc('post'), doc('thread')], { language: 'zh', assets: [asset], getAssetBytes: () => bytes });
  for (const document of result) {
    assert.deepEqual(document.blocks[0].assetIds, [asset.id]);
    const image = document.blocks[0].image;
    assert.equal(image.status, 'uploaded'); assert.equal(image.generated, false); assert.equal(image.width, 1); assert.equal(image.height, 1);
    assert.equal(image.visualVerification, 'not_run'); assert.equal(image.documentHash, xImageDocumentHash(document));
  }
});

test('X images: unread metadata cannot become uploaded or visually checked', async () => {
  const [document] = await prepareXImages([doc('post')], { language: 'zh', assets: [asset] });
  assert.equal(document.blocks[0].image.status, 'dependency_blocked');
  assert.equal(document.blocks[0].image.errorCode, 'source_image_unread');
  assert.equal(document.blocks[0].image.assetId, null);
});

test('X images: upload bytes must match metadata and supported file structure', () => {
  assert.equal(inspectXImage(bytes, 'image/png').width, 1);
  assert.throws(() => bindXImage(doc('post'), { language: 'zh', asset: { ...asset, sha256: 'a'.repeat(64) }, bytes }));
  assert.throws(() => inspectXImage(bytes, 'image/jpeg'));
  assert.throws(() => inspectXImage(bytes.subarray(0, 30), 'image/png'));
  assert.throws(() => inspectXImage(Buffer.alloc(4 * 1024 * 1024 + 1), 'image/png'));
  assert.throws(() => inspectXImage(Buffer.from([255, 216, 255, 255, 255, 217]), 'image/jpeg'), error => error.status === 400);
});

test('X images: user verification is bound to actual byte/text hashes and requires an observed description', () => {
  const document = bound();
  assert.throws(() => assertXImagePublishable(document, [asset]));
  assert.throws(() => verifyXImage(document, { language: 'zh', assets: [asset], assetHash: 'a'.repeat(64), textHash: document.blocks[0].image.textHash, altText: 'wrong', generated: false }));
  const checked = verified(document);
  assert.equal(document.blocks[0].image.visualVerification, 'not_run');
  assert.equal(checked.blocks[0].image.visualVerification, 'passed');
  assert.equal(assertXImagePublishable(checked, [asset]), true);
});

test('X images: text, reply order, selected asset and language changes all invalidate prior verification', () => {
  const document = verified(bound('thread'));
  for (const mutate of [d => { d.blocks[0].text += '!'; }, d => { d.blocks[1].text += '!'; }, d => { d.blocks.reverse(); }, d => { d.blocks[0].assetIds = []; }]) {
    const changed = structuredClone(document); mutate(changed);
    const output = reconcileXImages(changed, 'zh', [asset]);
    const image = output.blocks.find(block => block.image).image;
    assert.equal(image.status, 'needs_update'); assert.equal(image.visualVerification, 'not_run');
    assert.equal(image.briefHash, document.blocks[0].image.briefHash);
  }
  assert.equal(reconcileXImages(document, 'en', [asset]).blocks[0].image.status, 'needs_update');
  assert.equal(reconcileXImages(document, 'zh', [{ ...asset, sha256: 'a'.repeat(64) }]).blocks[0].image.status, 'needs_update');
  assert.equal(reconcileXImages(document, 'zh', [asset]).blocks[0].image.visualVerification, 'passed');
});

test('X images: blocked image intent permits text-only plan and replies cannot carry images', async () => {
  const [document] = await prepareXImages([doc('thread')], { language: 'zh' });
  assert.equal(assertXImagePublishable(document, []), true);
  document.blocks[1].assetIds = [asset.id];
  assert.throws(() => assertXImagePublishable(document, [asset]));
});

test('X images: shared-backend contract persists actual generated bytes to caller tmp only', async () => {
  let calls = 0, saved = 0;
  const generatedAsset = { ...asset, source: { kind: 'generated', url: null } };
  const backend = { async generate(request) { calls++; assert.equal(request.platform, 'x'); assert.equal(request.language, 'en'); assert.equal(hash(request.brief), request.briefHash); return { bytes, mimeType: 'image/png', altText: 'Synthetic test pixel.' }; } };
  const [document] = await prepareXImages([doc('post')], { language: 'en', backend, persistGenerated: async request => { saved++; assert.equal(request.source.kind, 'generated'); assert.deepEqual(request.bytes, bytes); return generatedAsset; } });
  assert.equal(calls, 1); assert.equal(saved, 1);
  assert.equal(document.blocks[0].image.status, 'generated'); assert.equal(document.blocks[0].image.generated, true);
  assert.equal(document.blocks[0].image.visualVerification, 'not_run');
  await prepareXImages([doc('post')], { language: 'en', backend });
  assert.equal(calls, 1, 'must not call backend without tmp persistence');
});

test('X images: backend failure does not expose provider error data or report success', async () => {
  const [document] = await prepareXImages([doc('post')], { language: 'en', backend: { generate() { throw new Error('SENSITIVE provider response'); } }, persistGenerated: async () => asset });
  assert.equal(document.blocks[0].image.status, 'failed');
  assert.equal(document.blocks[0].image.errorCode, 'image_generation_failed');
  assert.equal(JSON.stringify(document).includes('SENSITIVE'), false);
});

test('X images: cancellation cannot persist a late backend result', async () => {
  const controller = new AbortController(); let saved = false;
  await assert.rejects(prepareXImages([doc('post')], { language: 'en', signal: controller.signal, backend: { async generate() { controller.abort(); return { bytes, mimeType: 'image/png' }; } }, persistGenerated: async () => { saved = true; return asset; } }));
  assert.equal(saved, false);
});

test('X images: uploaded AI provenance survives user verification and cannot be downgraded', () => {
  const generatedAsset = { ...asset, source: { kind: 'generated', url: null } };
  const document = bindXImage(doc('post'), { language: 'zh', asset: generatedAsset, bytes });
  assert.equal(document.blocks[0].image.status, 'uploaded'); assert.equal(document.blocks[0].image.generated, true);
  assert.throws(() => verified(document, false));
  assert.equal(verified(document, true).blocks[0].image.generated, true);
});

test('X images: strict binding validation rejects forged ready metadata and unknown fields', () => {
  const image = bound().blocks[0].image;
  assert.throws(() => validateXImageBinding({ ...image, brief: 'tampered' }));
  assert.throws(() => validateXImageBinding({ ...image, secret: 'no' }));
  assert.throws(() => validateXImageBinding({ ...image, width: null }));
});

test('X images: a user-declared AI source survives rebinding and explicit brief refresh', async () => {
  const declared = verified(bound(), true);
  declared.blocks[0].text += ' Updated.';
  const stale = reconcileXImages(declared, 'zh', [asset]);
  assert.equal(bindXImage(stale, { language: 'zh', asset, bytes }).blocks[0].image.generated, true);
  const fresh = structuredClone(stale); delete fresh.blocks[0].image;
  const [prepared] = await prepareXImages([fresh], { language: 'zh', assets: [asset], getAssetBytes: () => bytes, generatedAssetHashes: [asset.sha256] });
  assert.equal(prepared.blocks[0].image.generated, true);
  assert.throws(() => verified(prepared, false));
});

test('X images: persisted AI declaration survives removing all image bindings without relabeling an upload as generated', () => {
  const declaredAsset = { ...asset, madeWithAi: true };
  const freshDocument = doc('post');
  const rebound = bindXImage(freshDocument, { language: 'zh', asset: declaredAsset, bytes });
  assert.equal(rebound.blocks[0].image.generated, true);
  assert.equal(rebound.blocks[0].image.status, 'uploaded');
  assert.equal(declaredAsset.source.kind, 'upload');
  const forged = bound();
  assert.equal(reconcileXImages(forged, 'zh', [declaredAsset]).blocks[0].image.status, 'needs_update');
});
