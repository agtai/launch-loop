import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { startServer } from '../server/index.mjs';
import { inspectXImage } from '../server/x-images.mjs';

// HTTP integration with explicit synthetic text, image and account adapters.
// Only loopback HTTP is used. No model, image tool, OAuth or remote post is called.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=', 'base64');
const info = inspectXImage(png, 'image/png');
const documents = () => [
  { id: 'post', kind: 'post', title: '', postingNote: '', blocks: [{ id: 'single', type: 'x_post', text: 'SYNTHETIC drafts need confirmation before publication.' }] },
  { id: 'thread', kind: 'thread', title: '', postingNote: '', blocks: ['Inspect the synthetic draft.', 'Confirm the draft before publication.'].map((text, index) => ({ id: `step-${index}`, type: 'x_post', text })) },
];
const request = () => ({ requestId: randomUUID(), name: 'SYNTHETIC X image integration', brief: { materials: [{ id: 'source', type: 'text', label: 'Synthetic source', text: 'SYNTHETIC drafts require confirmation before publication.' }], purpose: 'Explain draft confirmation', audience: 'Synthetic testers', platforms: ['x'], languages: ['en'], formats: ['short_post', 'thread'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, uploads: [], options: {} });
const runner = async ({ stage, payload }) => {
  if (stage === 'mother') return { sourceLanguage: 'en', reason: 'Synthetic source is English.', spine: 'Inspect before confirming.', editorialPlan: 'Explain separate confirmation.', text: 'SYNTHETIC drafts require confirmation.', claimLedger: [{ id: 'claim', proposition: 'Confirmation is needed.', attribution: 'Synthetic source', qualifications: 'Publication is separate.', status: 'supported', sourceIds: ['source'] }], termLedger: [{ id: 'draft', source: 'draft', zh: '草稿', en: 'draft', reason: 'Shared concept.' }], unresolved: [] };
  if (stage === 'adaptation') return { documents: documents(), unresolved: [] };
  if (stage === 'localization') return { documents: documents().map(doc => ({ ...doc, blocks: doc.blocks.map((block, index) => ({ ...block, text: `合成草稿需要先确认，再发布。第${index + 1}条。` })) })), unresolved: [] };
  if (stage === 'review') return { summary: 'One synthetic review of both objects.', findings: [], unresolved: [] };
  if (stage === 'revision') return { documents: structuredClone(payload.initialDocuments), resolvedFindingIds: [], unresolved: [] };
  throw new Error('Unexpected synthetic text stage: ' + stage);
};
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const completed = input => ({ status: 'ready', bytes: png, ...info, bodyHash: input.bodyHash, visualCheck: { status: 'passed', checkedAt: new Date().toISOString(), observed: 'A synthetic test pixel.', findings: [], imageHash: info.sha256, bodyHash: input.bodyHash, method: 'codex-image-input' } });
async function until(read, predicate) {
  for (let index = 0; index < 500; index++) { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('Synthetic integration did not reach the expected state');
}
async function setup(t, { failure = false, textRunner = runner, allowCheck = false } = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-x-image-integration-'));
  const gates = [deferred(), deferred()], calls = [], forbidden = async () => { assert.fail('No real platform or model call is permitted'); };
  const imageRunner = async input => {
      const index = calls.length; calls.push(input);
      assert.ok(index < gates.length, 'Only the two requested objects may schedule images');
      assert.equal(input.context.platform, 'x'); assert.equal(input.documents.length, 1);
      const abort = () => gates[index].resolve();
      input.signal.addEventListener('abort', abort, { once: true });
      try { await gates[index].promise; return failure ? { status: 'unknown' } : completed(input); }
      finally { input.signal.removeEventListener('abort', abort); }
  };
  const app = await startServer({ port: 0, dataDir,
    generationOptions: { testOnlyRunner: textRunner },
    linkedInOptions: { env: {}, fetchImpl: forbidden }, xOptions: { env: {}, fetchImpl: forbidden },
    xImageOptions: { env: { LAUNCH_LOOP_IMAGE_PROVIDER: 'codex-cache' }, testOnlyProbe: forbidden, testOnlyCheck: allowCheck ? imageRunner : forbidden, testOnlyGenerate: imageRunner },
  });
  t.after(async () => { for (const gate of gates) gate.resolve(); await app.close(); assert.ok(dataDir.startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(dataDir, { recursive: true, force: true }); });
  const api = async (route, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(app.url + route, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const value = await response.json(); assert.ok(response.ok, `${route}: ${JSON.stringify(value)}`); return value;
  };
  const start = async () => {
    const { job: created } = await api('/api/generation/jobs', request());
    const { job } = await until(() => api('/api/generation/jobs/' + created.id), value => ['completed', 'failed'].includes(value.job.status));
    assert.equal(job.status, 'completed', job.error);
    await until(() => api('/api/x-images/jobs'), value => value.items.length === 1 && value.items[0].status === 'running');
    return job.variants[0].tmpId;
  };
  const assertTemporary = async tmpId => {
    const { item } = await api('/api/content/tmp/' + tmpId), backup = await api('/api/backup');
    assert.equal(item.confirmed, null); assert.deepEqual(backup.content.items, []);
    assert.deepEqual(backup.publishing.records, []); assert.deepEqual(backup.xPublishing.records, []);
    return item;
  };
  return { api, calls, gates, start, assertTemporary };
}

test('X default text completion schedules both content images serially with current revisions and no formal save', async t => {
  const f = await setup(t), tmpId = await f.start();
  const first = (await f.api('/api/x-images/jobs')).items[0];
  const initial = (await f.api('/api/content/tmp/' + tmpId)).item;
  assert.equal(f.calls.length, 1); assert.equal(first.documentId, 'post'); assert.equal(first.sourceRevision, initial.revision);
  f.gates[0].resolve();
  const halfway = await until(() => f.api('/api/x-images/jobs'), value => value.items.length === 2 && value.items.some(job => job.documentId === 'thread' && job.status === 'running'));
  const post = halfway.items.find(job => job.documentId === 'post'), thread = halfway.items.find(job => job.documentId === 'thread');
  assert.equal(post.status, 'ready'); assert.equal(thread.sourceRevision, post.resultRevision); assert.ok(post.resultRevision > first.sourceRevision);
  const interim = (await f.api('/api/content/tmp/' + tmpId)).item;
  assert.equal(interim.content.documents[0].blocks[0].image.visualVerification, 'passed');
  assert.equal(interim.content.documents[1].blocks[0].assetIds?.length ?? 0, 0);
  f.gates[1].resolve();
  const done = await until(() => f.api('/api/x-images/jobs'), value => value.items.length === 2 && value.items.every(job => job.status === 'ready'));
  const final = await f.assertTemporary(tmpId);
  assert.equal(final.revision, done.items.find(job => job.documentId === 'thread').resultRevision);
  assert.equal(f.calls.length, 2); assert.deepEqual(f.calls.map(call => call.documents[0].id), ['post', 'thread']);
  assert.deepEqual(final.content.documents.map(doc => doc.blocks.map(block => block.text)), documents().map(doc => doc.blocks.map(block => block.text)));
  assert.ok(final.content.documents.every(doc => doc.blocks[0].image.visualVerification === 'passed' && doc.blocks[0].image.generated));
});

test('X automatic images keep the final-text revision and preserve edits made while another language is finishing', async t => {
  const englishRevision = deferred();
  const f = await setup(t, { allowCheck: true, textRunner: async input => {
    if (input.stage === 'revision' && input.payload.language === 'en') await englishRevision.promise;
    return runner(input);
  } });
  try {
    const input = request(); input.brief.languages = ['zh', 'en'];
    input.uploads = [{ id: 'image', fileName: 'synthetic.png', mimeType: 'image/png', dataBase64: png.toString('base64'), source: { kind: 'upload', url: null }, caption: 'Synthetic test pixel' }];
    const { job } = await f.api('/api/generation/jobs', input);
    const pending = await until(() => f.api('/api/generation/jobs/' + job.id), value => value.job.variants.some(variant => variant.language === 'zh' && variant.status === 'completed') && value.job.variants.some(variant => variant.language === 'en' && variant.stage === 'revising'));
    const chineseId = pending.job.variants.find(variant => variant.language === 'zh').tmpId;
    const englishId = pending.job.variants.find(variant => variant.language === 'en').tmpId;
    const { item: chinese } = await f.api('/api/content/tmp/' + chineseId);
    assert.equal(chinese.content.documents[0].blocks[0].assetIds.length, 1);
    const edited = structuredClone(chinese.content);
    edited.documents[0].blocks[0].assetIds = []; delete edited.documents[0].blocks[0].image;
    const { item: savedEdit } = await f.api('/api/content/tmp/' + chineseId, { revision: chinese.revision, content: edited, temporary: chinese.temporary }, 'PUT');
    assert.equal(f.calls.length, 0, 'Images wait for the other language before automatic scheduling');
    for (const gate of f.gates) gate.resolve(); englishRevision.resolve();
    const finalText = await until(() => f.api('/api/generation/jobs/' + job.id), value => ['completed', 'failed'].includes(value.job.status));
    assert.equal(finalText.job.status, 'completed', finalText.job.error);
    const jobs = (await f.api('/api/x-images/jobs')).items;
    assert.equal(jobs.some(image => image.tmpId === chineseId), false, 'A user-edited revision must not inherit automatic image authorization');
    await until(() => f.api('/api/x-images/jobs'), value => value.items.length === 2 && value.items.every(image => image.status === 'ready'));
    const chineseFinal = await f.assertTemporary(chineseId), englishFinal = await f.assertTemporary(englishId);
    assert.equal(chineseFinal.revision, savedEdit.revision); assert.deepEqual(chineseFinal.content, savedEdit.content);
    assert.equal(chineseFinal.content.documents[0].blocks[0].assetIds.length, 0);
    assert.ok(englishFinal.content.documents.every(doc => doc.blocks[0].image.visualVerification === 'passed'));
    assert.equal(f.calls.length, 2); assert.ok(f.calls.every(call => call.context.language === 'en'));
  } finally { englishRevision.resolve(); }
});

for (const stop of ['failed', 'cancelled', 'restored']) test(`X ${stop} first image prevents later object scheduling and discards late bytes`, async t => {
  const f = await setup(t, { failure: stop === 'failed' });
  const before = await f.api('/api/backup'), tmpId = await f.start();
  const first = (await f.api('/api/x-images/jobs')).items[0];
  if (stop === 'failed') f.gates[0].resolve();
  else if (stop === 'cancelled') await f.api('/api/x-images/jobs/' + first.id + '/cancel', {});
  else await f.api('/api/restore', before);
  const expected = stop === 'restored' ? 'interrupted' : stop;
  await until(() => f.api('/api/x-images/jobs'), value => value.items[0]?.status === expected);
  const final = await f.assertTemporary(tmpId), jobs = (await f.api('/api/x-images/jobs')).items;
  assert.equal(jobs.length, 1); assert.equal(f.calls.length, 1); assert.equal(jobs[0].status, expected);
  assert.equal(final.assets.length, 0); assert.ok(final.content.documents.every(doc => !doc.blocks[0].assetIds?.length));
  if (stop === 'restored') assert.equal(final.stale, true);
});
