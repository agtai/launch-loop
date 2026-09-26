import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTextRules } from '../server/rule-resolver.mjs';

const base = { platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'] };

test('text rules: deterministic, canonical selection order and no input mutation', () => {
  const config = { ...base, styles: ['concise', 'plain'], project: 'system1-agents' };
  const before = JSON.stringify(config);
  const first = resolveTextRules(config);
  assert.deepEqual(first, resolveTextRules(config));
  assert.deepEqual(first, resolveTextRules({ ...config, languages: ['en', 'zh', 'zh'], styles: ['plain', 'concise'] }));
  assert.equal(JSON.stringify(config), before);
  assert.match(first.variants[0].ruleMetadata.hash, /^[a-f0-9]{64}$/);
  first.variants[0].auditChecks.push('external mutation');
  assert.ok(!resolveTextRules(config).variants[0].auditChecks.includes('external mutation'));
});

test('text rules: platform × language only; pending adaptations do not silently fall back', () => {
  const resolved = resolveTextRules({ ...base, platforms: ['linkedin', 'x', 'xiaohongshu', 'zhihu', 'bilibili'] });
  assert.equal(resolved.variants.length, 10);
  assert.equal(resolved.status, 'pending');
  assert.equal(resolved.variants.filter(item => item.status === 'ready').length, 4);
  for (const variant of resolved.variants.filter(item => !['linkedin', 'x'].includes(item.platform))) {
    assert.equal(variant.instructions, null);
    assert.ok(!variant.ruleMetadata.fragmentIds.includes('platform.linkedin'));
    assert.equal(variant.status, 'pending');
    assert.equal(variant.documents[0].kind, 'post');
  }
});

test('text rules: unresolved empty defaults are not a successful zero-draft job', () => {
  for (const config of [{}, { ...base, platforms: [] }, { ...base, languages: [] }, { ...base, formats: [] }]) {
    const result = resolveTextRules(config);
    assert.equal(result.status, 'needs_configuration');
    assert.ok(result.issues.some(item => item.code === 'unresolved_default'));
    assert.equal(result.variants.length, 0);
  }
});

test('text rules: malformed and unknown options fail explicitly', () => {
  for (const config of [null, [], 'linkedin', { ...base, platforms: ['unknown'] }, { ...base, languages: ['fr'] }, { ...base, formats: ['video'] }, { ...base, styles: ['__proto__'] }, { ...base, extra: true }]) {
    assert.equal(resolveTextRules(config).status, 'invalid');
  }
});

test('text rules: multiple formats merge documents, retaining post/Pulse objects', () => {
  const resolved = resolveTextRules({ ...base, formats: ['long_article', 'short_post'], styles: ['plain', 'professional'], depths: ['brief', 'detailed'] });
  assert.equal(resolved.variants.length, 2);
  assert.equal(resolved.status, 'pending');
  for (const variant of resolved.variants) {
    assert.deepEqual(variant.documents.map(document => document.kind), ['linkedin_post', 'linkedin_article']);
    assert.deepEqual(variant.documents.map(document => document.status), ['ready', 'pending']);
    assert.equal(variant.instructions, null);
    assert.ok(variant.ruleMetadata.fragmentIds.includes('depth.brief'));
    assert.ok(variant.ruleMetadata.fragmentIds.includes('depth.detailed'));
  }
  const thread = resolveTextRules({ ...base, formats: ['thread'] });
  assert.equal(thread.status, 'pending');
  assert.equal(thread.variants[0].documents[0].kind, null);
});

test('text rules: optional CTA is not a required configuration', () => {
  const resolved = resolveTextRules(base);
  assert.equal(resolved.status, 'ready');
  assert.equal(resolved.variants.length, 2);
  assert.ok(resolved.variants.every(variant => variant.instructions.includes('不强制添加')));
  assert.ok(resolved.variants.every(variant => variant.ruleMetadata.fragmentIds.includes('assets.generate')));
});

test('text rules: project terms and one audit pass are present; custom terms alter hash', () => {
  const plain = resolveTextRules({ ...base, project: 'system1-agents' });
  const configured = resolveTextRules({ ...base, project: 'system1-agents', terminology: { required: ['System 1 agent'], forbidden: ['AI magic'] } });
  for (const variant of configured.variants) {
    assert.match(variant.instructions, /System 1 decision model/);
    assert.match(variant.instructions, /生成初稿→一次内部审核→根据发现修订最终稿/);
    assert.ok(variant.auditChecks.some(check => check.startsWith('project.terms:')));
    assert.ok(variant.auditChecks.some(check => check.startsWith('terminology:')));
  }
  assert.notEqual(plain.variants[0].ruleMetadata.hash, configured.variants[0].ruleMetadata.hash);
  assert.equal(resolveTextRules({ ...base, terminology: { required: ['LLM'], forbidden: ['LLM'] } }).status, 'invalid');
  assert.equal(resolveTextRules({ ...base, terminology: { required: 'LLM' } }).status, 'invalid');
  assert.equal(resolveTextRules({ ...base, terminology: { required: [' '] } }).status, 'invalid');
});
