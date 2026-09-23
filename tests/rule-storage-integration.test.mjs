import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../server/index.mjs';
import { resolveTextRules } from '../server/rule-resolver.mjs';

test('resolved bilingual variants keep rule identity in tmp and can be confirmed independently', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'launch-loop-rule-storage-'));
  const app = await startServer({ port: 0, dataDir: root });
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  const request = async (route, body) => {
    const response = await fetch(app.url + route, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const result = await response.json();
    assert.ok(response.ok, JSON.stringify(result));
    return result;
  };
  const resolved = resolveTextRules({
    platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'],
    styles: ['plain', 'professional'], depths: ['brief', 'detailed'],
  });
  assert.equal(resolved.status, 'ready');
  assert.equal(resolved.variants.length, 2, 'other multi-select options must not multiply variants');
  const drafts = [];
  for (const variant of resolved.variants) {
    const { item } = await request('/api/content/tmp', { content: {
      name: `Synthetic integration fixture ${variant.language}`, projectId: null,
      platform: variant.platform, language: variant.language,
      brief: {
        materials: [{ id: 'fixture', label: 'Synthetic test material', type: 'text', text: 'This is synthetic test material, not product copy.' }],
        purpose: 'Validate storage contract', audience: 'Automated test',
        platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'],
        authorIdentity: [], styleTerms: ['plain', 'professional'], lengthDepth: ['brief', 'detailed'], references: [],
      },
      documents: variant.documents.map((document, index) => ({
        id: `document-${index}`, kind: document.kind, title: '', postingNote: '',
        blocks: [{ id: 'body', type: 'paragraph', text: `Synthetic ${variant.language} body for contract testing.` }],
      })),
      sources: [], assetIds: [], rule: variant.ruleMetadata, executions: [],
    } });
    assert.deepEqual(item.content.rule, variant.ruleMetadata);
    drafts.push(item);
  }
  assert.deepEqual((await request('/api/content')).items, []);
  const confirmed = await request(`/api/content/tmp/${drafts[0].id}/confirm`, { revision: drafts[0].revision, confirmed: true });
  assert.equal(confirmed.version.content.language, 'zh');
  assert.deepEqual(confirmed.version.content.rule, resolved.variants[0].ruleMetadata);
  const formal = (await request('/api/content')).items;
  assert.equal(formal.length, 1);
  assert.equal(formal[0].language, 'zh');
  assert.equal((await request(`/api/content/tmp/${drafts[1].id}`)).item.confirmed, null);
  const backup = await request('/api/backup');
  assert.ok(!JSON.stringify(backup).includes('Synthetic en body'));
  assert.ok(!Object.hasOwn(confirmed.item, 'approvedVersionId'), 'saving must not create publishing approval');
});
