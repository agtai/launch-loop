import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveIntegratedTextRules, INTEGRATED_RULE_SET_VERSION } from '../server/text-rules-v2.mjs';
import { resolveTextRules } from '../server/rule-resolver.mjs';
import { sha256 } from '../rules/text/v2/catalog.mjs';

const config = { platforms: ['linkedin'], languages: ['zh', 'en'], formats: ['short_post'] };
test('v2 is an independent version and every selected variant is usable in the existing content schema', () => {
  const result = resolveIntegratedTextRules(config);
  assert.equal(result.status, 'ready'); assert.equal(INTEGRATED_RULE_SET_VERSION, 'text-v2.0.0');
  assert.equal(resolveTextRules(config).ruleSetVersion, 'text-v1.0.0');
  assert.deepEqual(result.variants.map(variant => variant.id), ['linkedin:zh', 'linkedin:en']);
  for (const variant of result.variants) {
    assert.equal(variant.documents[0].kind, 'linkedin_post');
    assert.equal(variant.ruleMetadata.ruleSetVersion, INTEGRATED_RULE_SET_VERSION);
    assert.match(variant.ruleMetadata.hash, /^[0-9a-f]{64}$/);
    assert.match(variant.stageInstructions.mother, /editorialPlan/);
    assert.match(variant.stageInstructions.review, /readerTakeaway/);
    assert(!variant.instructions.includes('Give your agents a Jev-like'));
  }
});
test('variant hashes are stable across language ordering, batch/single revalidation and option ordering', () => {
  const combined = resolveIntegratedTextRules({ ...config, styles: ['concise', 'plain'], terminology: { required: ['Alpha', 'Beta'], forbidden: [] } });
  for (const variant of combined.variants) {
    const single = resolveIntegratedTextRules({ ...config, languages: [variant.language], styles: ['plain', 'concise', 'plain'], terminology: { required: ['Beta', 'Alpha', 'Alpha'] } }).variants[0];
    assert.deepEqual(single, variant);
  }
  assert.equal(resolveIntegratedTextRules({ ...config, languages: ['en', 'zh'] }).variants[0].ruleMetadata.hash, resolveIntegratedTextRules(config).variants[0].ruleMetadata.hash);
});
test('shared mother/platform instructions and metadata never inherit a target-language variant', () => {
  const batch = resolveIntegratedTextRules(config).variants;
  const singleZh = resolveIntegratedTextRules({ ...config, languages: ['zh'] }).variants[0];
  const singleEn = resolveIntegratedTextRules({ ...config, languages: ['en'] }).variants[0];
  for (const variant of [...batch, singleZh, singleEn]) {
    assert.deepEqual(variant.sharedRuleMetadata, batch[0].sharedRuleMetadata);
    assert.deepEqual(variant.sharedOptions, batch[0].sharedOptions);
    assert(!Object.hasOwn(variant.sharedOptions, 'language'));
    assert(!variant.sharedRuleMetadata.fragmentIds.some(id => id.startsWith('language.')));
    for (const stage of ['mother', 'platform']) {
      assert.equal(variant.stageInstructions[stage], batch[0].stageInstructions[stage]);
      assert.doesNotMatch(variant.stageInstructions[stage], /"language":"(?:zh|en)"/);
      assert.match(variant.stageInstructions[stage], /不自动构成作者指定母稿语言/);
    }
    assert(variant.ruleMetadata.fragmentIds.includes(`language.${variant.language}`));
    assert.equal(variant.options.language, variant.language);
  }
});
test('unsupported combinations never expose executable partial variants; conflicts and missing options stay explicit', () => {
  for (const options of [{ platforms: ['linkedin', 'x'] }, { formats: ['short_post', 'long_article'] }]) {
    const result = resolveIntegratedTextRules({ ...config, ...options });
    assert.equal(result.status, 'pending'); assert(result.variants.every(variant => variant.instructions === null && variant.status === 'pending'));
  }
  assert.equal(resolveIntegratedTextRules({ ...config, languages: [] }).status, 'needs_configuration');
  assert.equal(resolveIntegratedTextRules({ ...config, terminology: { required: ['A'], forbidden: ['A'] } }).status, 'invalid');
  assert.equal(resolveIntegratedTextRules({ ...config, accidentalOption: true }).status, 'invalid');
});
test('author rules are opt-in, and every derivation preserves the untouched candidate source fingerprint', () => {
  const normal = resolveIntegratedTextRules(config).variants[0];
  const author = resolveIntegratedTextRules({ ...config, project: 'system1-agents' }).variants[0];
  assert.notEqual(normal.ruleMetadata.hash, author.ruleMetadata.hash);
  assert.match(author.instructions, /Give your agents a Jev-like/);
  const provenance = JSON.parse(readFileSync(new URL('../rules/text/v2/provenance.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  for (const file of provenance.files) assert.equal(sha256(readFileSync(new URL(`../${file.path}`, import.meta.url))), file.sha256);
});
