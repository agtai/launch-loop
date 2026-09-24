import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer } from '../server/index.mjs';

const document = (language, text) => ({ id: 'post', kind: 'linkedin_post', title: `${language} synthetic title`, postingNote: '', blocks: [{ id: 'opening', type: 'paragraph', text }, { id: 'fixed', type: 'paragraph', text: 'Unselected paragraph must remain byte-for-byte unchanged.' }] });
const requestBody = () => ({
  requestId: randomUUID(), name: 'Synthetic integration fixture',
  brief: { materials: [{ id: 'material', label: 'Uploaded synthetic source', type: 'asset', assetId: 'file' }], purpose: 'Test integration without a model', audience: 'Automated test', platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'], authorIdentity: [], styleTerms: [], lengthDepth: [], references: [] },
  uploads: [{ id: 'file', fileName: 'material.md', mimeType: 'text/plain', dataBase64: Buffer.from('Synthetic source bytes: exact uploaded material.').toString('base64'), source: { kind: 'upload', url: null }, caption: '' }], options: { styles: ['plain'], depths: ['brief'] },
});
function fakeRunner(calls) {
  return async ({ stage, payload }) => {
    calls.push(stage);
    if (stage === 'modification') return { replacement: 'replacement from test fixture', unresolved: ['Synthetic unresolved editing note'] };
    assert.ok(payload.actualSources.some(source => source.text?.includes('exact uploaded material')), 'runner must receive actual file text');
    if (stage === 'generation') return { documents: [document(payload.language, `Synthetic ${payload.language} draft opening`)] };
    if (stage === 'review') return { summary: 'Examined the uploaded source against this specific synthetic draft.', findings: [{ id: 'wording', documentId: 'post', blockId: 'opening', quote: 'draft', issue: 'Synthetic wording issue', suggestion: 'Use final' }], unresolved: [] };
    return { documents: [document(payload.language, `Synthetic ${payload.language} final opening`)], resolvedFindingIds: ['wording'], unresolved: [] };
  };
}
async function fixture(t, runner) {
  const root = await mkdtemp(path.join(tmpdir(), 'launch-loop-stage2-integration-'));
  const app = await startServer({ port: 0, dataDir: root, generationOptions: { testOnlyRunner: runner }, linkedInOptions: { env: {} } });
  t.after(async () => { await app.close(); assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(root, { recursive: true, force: true }); });
  async function api(route, body, method = 'POST', expected = 200) {
    const response = await fetch(app.url + route, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
  }
  async function done(id) {
    for (let count = 0; count < 300; count++) {
      const { job } = await api(`/api/generation/jobs/${id}`);
      if (!['queued', 'running', 'cancelling'].includes(job.status)) return job;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Test job did not finish');
  }
  return { app, api, done };
}

test('HTTP bilingual generation reuses rules and tmp, confirms independently and retains formal versions without publishing', async t => {
  const calls = [], f = await fixture(t, fakeRunner(calls)), input = requestBody();
  const created = await f.api('/api/generation/jobs', input, 'POST', 202);
  assert.equal((await f.api('/api/generation/jobs', input, 'POST', 202)).job.id, created.job.id);
  const job = await f.done(created.job.id); assert.equal(job.status, 'completed');
  assert.deepEqual(calls, ['generation', 'review', 'revision', 'generation', 'review', 'revision']);
  const temps = await Promise.all(job.variants.map(async variant => (await f.api(`/api/content/tmp/${variant.tmpId}`)).item));
  assert.deepEqual((await f.api('/api/content')).items, []);
  const before = JSON.stringify(await f.api('/api/backup'));
  assert.ok(!before.includes('final opening') && !before.includes('Synthetic wording issue'));
  for (const tmp of temps) {
    assert.equal(tmp.content.executions.filter(entry => entry.stage === 'review').length, 1);
    assert.ok(tmp.content.executions.every(entry => entry.runId.startsWith(job.id)));
    assert.equal(tmp.content.rule.ruleSetVersion, 'text-v1.0.0');
  }
  const saved = await f.api(`/api/content/tmp/${temps[0].id}/confirm`, { revision: temps[0].revision, confirmed: true });
  const { item: revision } = await f.api(`/api/content/${saved.item.id}/revise`, { revision: saved.item.revision }, 'POST', 201);
  revision.content.documents[0].blocks[0].text += ' Manual synthetic edit.';
  const updated = await f.api(`/api/content/tmp/${revision.id}`, { revision: revision.revision, content: revision.content, temporary: revision.temporary }, 'PUT');
  const second = await f.api(`/api/content/tmp/${revision.id}/confirm`, { revision: updated.item.revision, confirmed: true });
  assert.equal(second.item.versions.length, 2);
  assert.equal(second.item.versions[0].content.documents[0].blocks[0].text, 'Synthetic zh final opening');
  assert.ok(!JSON.stringify(await f.api('/api/backup')).includes('Synthetic en final opening'));
  assert.deepEqual((await f.api('/api/publishing/records')).items, []);
  assert.equal((await f.api('/api/linkedin/connection')).connection.canPublish, false);
});

test('HTTP partial edit requires acceptance, preserves unselected text and detects source changes during execution', async t => {
  const calls = []; let held = false, release;
  const runner = fakeRunner(calls);
  const f = await fixture(t, async input => {
    if (input.stage === 'modification' && held) await new Promise(resolve => { release = resolve; });
    return runner(input);
  });
  const { job: created } = await f.api('/api/generation/jobs', requestBody(), 'POST', 202);
  const job = await f.done(created.id), original = (await f.api(`/api/content/tmp/${job.variants[0].tmpId}`)).item;
  const start = original.content.documents[0].blocks[0].text.indexOf('final');
  const modification = { requestId: randomUUID(), tmpId: original.id, revision: original.revision, selection: { documentId: 'post', blockId: 'opening', start, end: start + 5, text: 'final' }, instruction: 'Synthetic partial editing test' };
  const { job: modifying } = await f.api('/api/generation/modifications', modification, 'POST', 202);
  assert.equal((await f.done(modifying.id)).status, 'completed');
  const accepted = await f.api(`/api/generation/jobs/${modifying.id}/accept`, { sourceRevision: original.revision });
  assert.notEqual(accepted.item.id, original.id);
  assert.equal((await f.api(`/api/generation/jobs/${modifying.id}/accept`, { sourceRevision: original.revision })).item.id, accepted.item.id);
  assert.deepEqual(accepted.item.content.documents[0].blocks[1], original.content.documents[0].blocks[1]);
  assert.equal(accepted.item.content.documents[0].blocks[0].text, 'Synthetic zh replacement from test fixture opening');
  assert.equal((await f.api(`/api/content/tmp/${original.id}`)).item.content.documents[0].blocks[0].text, 'Synthetic zh final opening');
  held = true;
  const { job: late } = await f.api('/api/generation/modifications', { ...modification, requestId: randomUUID() }, 'POST', 202);
  for (let count = 0; !release && count < 100; count++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(release);
  original.content.documents[0].blocks[0].text += ' Newer human edit.';
  await f.api(`/api/content/tmp/${original.id}`, { revision: original.revision, content: original.content, temporary: original.temporary }, 'PUT');
  release();
  assert.equal((await f.done(late.id)).status, 'failed');
  assert.ok((await f.api(`/api/content/tmp/${original.id}`)).item.content.documents[0].blocks[0].text.endsWith('Newer human edit.'));
});

test('successful HTTP restore interrupts active generation and expires its tmp without including it in backups', async t => {
  let entered = false;
  const f = await fixture(t, async ({ signal }) => {
    entered = true;
    await new Promise((resolve, reject) => { if (signal.aborted) reject(new Error('cancelled')); else signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }); });
  });
  const backup = await f.api('/api/backup');
  const { job } = await f.api('/api/generation/jobs', requestBody(), 'POST', 202);
  for (let count = 0; !entered && count < 100; count++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(entered);
  await f.api('/api/restore', backup);
  assert.equal((await f.done(job.id)).status, 'interrupted');
  assert.equal((await f.api(`/api/content/tmp/${job.variants[0].tmpId}`)).item.stale, true);
  assert.deepEqual((await f.api('/api/content')).items, []);
  const response = await fetch(f.app.url + '/api/generation/capabilities', { headers: { Origin: 'https://example.org' } });
  assert.equal(response.status, 403);
});
