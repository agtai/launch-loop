import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createContentStore } from '../server/content-store.mjs';
import { createGenerationService } from '../server/generation-service.mjs';

const documents = (text = 'SYNTHETIC initial fact.') => [{ id: 'post', kind: 'linkedin_post', title: '', blocks: [{ id: 'p1', type: 'paragraph', text }, { id: 'p2', type: 'paragraph', text: 'SYNTHETIC untouched second paragraph.' }], postingNote: '' }];
const request = () => ({ requestId: randomUUID(), name: 'SYNTHETIC generation', brief: { materials: [{ id: 'material', label: 'Synthetic facts', type: 'text', text: 'SYNTHETIC supplied fact.' }], purpose: 'Test actual source reading', audience: 'Test runner', platforms: ['linkedin'], languages: ['en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] }, uploads: [], options: { styles: ['plain'], depths: ['brief'] } });
const goodRunner = async ({ stage, payload }) => {
  if (stage === 'generation') return { documents: documents() };
  if (stage === 'review') return { summary: 'Reviewed the actual supplied phrase.', findings: [{ id: 'f1', documentId: 'post', blockId: 'p1', quote: 'initial fact', issue: 'Test issue requiring change', suggestion: 'Use revised fact' }], unresolved: ['Synthetic evidence limitation'] };
  if (stage === 'revision') return { documents: documents('SYNTHETIC revised fact.'), resolvedFindingIds: ['f1'], unresolved: [] };
  return { replacement: 'replacement', unresolved: [] };
};
function setup(t, runner = goodRunner) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'launch-generation-'));
  const db = new DatabaseSync(path.join(dataDir, 'content.sqlite'));
  const content = createContentStore(db, dataDir, { snapshot() {}, checkBackupSize() {} });
  let service = createGenerationService({ content, dataDir, testOnlyRunner: runner });
  t.after(async () => { await service.close(); db.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { dataDir, content, db, get service() { return service; }, async restart() { await service.close(); service = createGenerationService({ content, dataDir, testOnlyRunner: runner }); } };
}
async function finish(service, id) {
  for (let n = 0; n < 500; n++) { const value = service.get(id); if (['completed', 'failed', 'cancelled', 'interrupted'].includes(value.status)) return value; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw Error('Synthetic job did not finish');
}
test('three real stages per language, exact body audit, actual UTF-8 materials, hashes and no formal payload', async t => {
  const calls = [], f = setup(t, async args => { calls.push(args); return goodRunner(args); });
  const raw = request(); raw.brief.languages = ['zh', 'en'];
  raw.uploads = [{ id: 'source-file', fileName: 'synthetic.md', mimeType: 'text/plain', source: { kind: 'upload', url: null }, caption: '', dataBase64: Buffer.from('SYNTHETIC ACTUAL FILE CONTENT').toString('base64') }];
  raw.brief.materials = [{ id: 'material', label: 'Actual upload', type: 'asset', assetId: 'source-file' }];
  const job = await finish(f.service, f.service.create(raw).id);
  assert.equal(job.status, 'completed', job.error); assert.equal(calls.length, 6);
  assert.deepEqual(calls.map(call => call.stage), ['generation', 'review', 'revision', 'generation', 'review', 'revision']);
  assert.match(calls[0].prompt, /SYNTHETIC ACTUAL FILE CONTENT/);
  assert.deepEqual(calls[1].payload.initialDocuments, documents());
  assert.equal(calls[0].payload.inputHash.length, 64);
  for (const variant of job.variants) {
    const tmp = f.content.readTmp(variant.tmpId);
    assert.equal(tmp.content.executions.filter(item => item.stage === 'review').length, 1);
    assert.match(tmp.content.documents[0].blocks[0].text, /revised fact/);
    assert.deepEqual(tmp.temporary.initialDocuments, documents());
    assert.ok(variant.unresolved.includes('Synthetic evidence limitation'));
    assert.equal(variant.assetStatus, 'unconnected');
  }
  assert.deepEqual(f.content.list(), []); assert.deepEqual(f.content.exportAll().items, []);
  assert.equal(readFileSync(path.join(f.dataDir, 'content.sqlite')).includes(Buffer.from('SYNTHETIC')), false);
});
test('request idempotency survives restart; changed request, pending rules and unknown options are refused', async t => {
  let calls = 0; const f = setup(t, async args => { calls++; return goodRunner(args); }); const raw = request();
  const initial = f.service.create(raw); assert.equal(f.service.create(raw).id, initial.id);
  assert.throws(() => f.service.create({ ...raw, name: 'Changed' }), /requestId/);
  await finish(f.service, initial.id); await f.restart(); assert.equal(f.service.create(raw).id, initial.id); assert.equal(calls, 3);
  const pending = request(); pending.brief.platforms = ['x']; assert.throws(() => f.service.create(pending), /pending/);
  const empty = request(); empty.brief.languages = []; assert.throws(() => f.service.create(empty), /needs_configuration/);
  const unknown = request(); unknown.options.styles = ['free-text']; assert.throws(() => f.service.create(unknown), /invalid/);
});
test('unsupported files, URLs and invalid UTF-8 fail without model calls', async t => {
  let calls = 0; const f = setup(t, async args => { calls++; return goodRunner(args); });
  for (const variant of ['url', 'pdf', 'binary']) {
    const raw = request();
    if (variant === 'url') raw.brief.materials = [{ id: 'source', label: 'Unread URL', type: 'url', url: 'http://127.0.0.1/private' }];
    else {
      raw.uploads = [{ id: 'source-file', fileName: variant === 'pdf' ? 'source.pdf' : 'source.txt', mimeType: variant === 'pdf' ? 'application/pdf' : 'text/plain', dataBase64: Buffer.from([255, 254, 111]).toString('base64'), source: { kind: 'upload', url: null }, caption: '' }];
      raw.brief.materials = [{ id: 'source', label: 'Uploaded file', type: 'asset', assetId: 'source-file' }];
    }
    const job = await finish(f.service, f.service.create(raw).id); assert.equal(job.status, 'failed');
  }
  assert.equal(calls, 0);
});
test('review must quote actual initial body; unresolved findings cannot disappear silently', async t => {
  const f = setup(t, async args => { const result = await goodRunner(args); if (args.stage === 'review') result.findings[0].quote = 'not in draft'; return result; });
  const failed = await finish(f.service, f.service.create(request()).id); assert.equal(failed.status, 'failed'); assert.match(failed.error, /实际初稿/);
  const g = setup(t, async args => { const result = await goodRunner(args); if (args.stage === 'revision') result.resolvedFindingIds = []; return result; });
  const result = await finish(g.service, g.service.create(request()).id); assert.ok(result.variants[0].unresolved.includes('Test issue requiring change'));
});
test('modification splices exact selection, preserves all other content, and accept checks source again', async t => {
  const f = setup(t); const job = await finish(f.service, f.service.create(request()).id); const source = f.content.readTmp(job.variants[0].tmpId);
  const block = source.content.documents[0].blocks[0]; const text = 'revised'; const start = block.text.indexOf(text);
  const raw = { requestId: randomUUID(), tmpId: source.id, revision: source.revision, selection: { documentId: 'post', blockId: 'p1', start, end: start + text.length, text }, instruction: 'Synthetic edit' };
  const result = await finish(f.service, f.service.modify(raw).id); assert.equal(result.status, 'completed', result.error);
  const proposal = f.service.accept(result.id, { sourceRevision: source.revision });
  assert.equal(proposal.content.documents[0].blocks[0].text, 'SYNTHETIC replacement fact.');
  assert.deepEqual(proposal.content.documents[0].blocks[1], source.content.documents[0].blocks[1]);
  assert.deepEqual(f.content.readTmp(source.id), source);
  assert.notEqual(proposal.id, result.variants[0].tmpId);
  assert.equal(f.service.accept(result.id, { sourceRevision: source.revision }).id, proposal.id);
  assert.match(proposal.temporary.reviewFindings, /局部修改后未再次自动审核/);
  f.content.updateTmp(source.id, { revision: source.revision, content: source.content, temporary: source.temporary });
  assert.throws(() => f.service.accept(result.id, { sourceRevision: source.revision }), /源稿/);
  assert.throws(() => f.service.modify({ ...raw, requestId: randomUUID(), selection: { ...raw.selection, text: 'stale' } }), /源稿/);
});
test('uploaded actual PNG bytes reach each call and modification retains original rules and read materials', async t => {
  const calls = [], f = setup(t, async args => { calls.push(args); return goodRunner(args); });
  const raw = request(); raw.options.terminology = { required: ['SYNTHETIC'], forbidden: ['invented'] };
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWp0AAAAASUVORK5CYII=', 'base64');
  raw.uploads = [{ id: 'image', fileName: 'synthetic.png', mimeType: 'image/png', dataBase64: image.toString('base64'), source: { kind: 'upload', url: null }, caption: 'One-pixel synthetic image' }];
  const job = await finish(f.service, f.service.create(raw).id); assert.equal(job.status, 'completed', job.error);
  for (const call of calls) { assert.equal(call.images.length, 1); assert.deepEqual(readFileSync(call.images[0]), image); }
  assert.equal(job.variants[0].assetStatus, 'uploaded');
  const source = f.content.readTmp(job.variants[0].tmpId), selected = source.content.documents[0].blocks[0].text;
  const modified = await finish(f.service, f.service.modify({ requestId: randomUUID(), tmpId: source.id, revision: source.revision, selection: { documentId: 'post', blockId: 'p1', start: 0, end: selected.length, text: selected }, instruction: 'Synthetic modification' }).id);
  assert.equal(modified.status, 'completed', modified.error);
  assert.deepEqual(calls[3].payload.terminology, raw.options.terminology);
  assert.equal(calls[3].payload.rules, calls[0].payload.rules);
  assert.match(calls[3].prompt, /SYNTHETIC supplied fact/); assert.deepEqual(readFileSync(calls[3].images[0]), image);
});
test('late fixture output cannot overwrite a cancellation or concurrent manual edit', async t => {
  let release, entered; const started = new Promise(resolve => entered = resolve);
  const f = setup(t, async args => { if (args.stage === 'generation') { entered(); await new Promise(resolve => release = resolve); } return goodRunner(args); });
  const created = f.service.create(request()); await started;
  f.service.cancel(created.id); release(); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(f.service.get(created.id).status, 'cancelled'); assert.deepEqual(f.content.readTmp(created.variants[0].tmpId).content.documents, []);
  let releaseEdit, enteredEdit; const enteredPromise = new Promise(resolve => enteredEdit = resolve);
  const g = setup(t, async args => { if (args.stage === 'generation') { enteredEdit(); await new Promise(resolve => releaseEdit = resolve); } return goodRunner(args); });
  const pending = g.service.create(request()); await enteredPromise;
  const tmp = g.content.readTmp(pending.variants[0].tmpId);
  g.content.updateTmp(tmp.id, { revision: tmp.revision, content: { ...tmp.content, documents: documents('MANUAL EDIT') }, temporary: tmp.temporary });
  releaseEdit(); const failed = await finish(g.service, pending.id); assert.equal(failed.status, 'failed'); assert.equal(g.content.readTmp(tmp.id).content.documents[0].blocks[0].text, 'MANUAL EDIT');
});
test('startup marks unfinished persisted jobs interrupted without invoking a model', async t => {
  const f = setup(t); const job = await finish(f.service, f.service.create(request()).id);
  const filename = path.join(f.dataDir, 'tmp', 'generation', job.id, 'job.json');
  const saved = JSON.parse(readFileSync(filename)); saved.job.status = 'running'; saved.job.stage = 'reviewing'; saved.job.variants[0].status = 'running';
  await f.service.close(); writeFileSync(filename, JSON.stringify(saved)); await f.restart();
  assert.equal(f.service.get(job.id).status, 'interrupted'); assert.equal(f.service.get(job.id).variants[0].status, 'interrupted');
});
