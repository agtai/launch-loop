import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countXText, validateXDocument, X_TEXT_VERSION } from '../server/x-text.mjs';
import { resolveTextRules } from '../server/rule-resolver.mjs';

// This reads only the simple quoted-scalar subset in the fixed upstream test corpus.
// Fixture file is data, never executed; its SHA and Apache-2.0 source are documented.
const yaml = readFileSync(new URL('../rules/x/official-counter-fixtures.yml', import.meta.url), 'utf8');
const corpus = yaml.slice(yaml.indexOf('  WeightedTweetsWithDiscountedEmojiCounterTest:'));
const decode = value => JSON.parse(value.replace(/\\U([0-9a-fA-F]{8})/g, (_, point) => String.fromCodePoint(parseInt(point, 16))));
const fixtures = [...corpus.matchAll(/    - description: ("[^\n]*")\r?\n      text: ("[^\n]*")\r?\n      expected:\r?\n((?:        [^\n]*\r?\n?)+)/g)].map(match => ({
  description: decode(match[1]), text: decode(match[2]), expected: Object.fromEntries([...match[3].matchAll(/        (\w+): (true|false|\d+)/g)].map(([, key, value]) => [key, JSON.parse(value)])),
}));
test('fixed official twitter-text v3 emoji-discounted and directional corpus', () => {
  assert.ok(fixtures.length >= 24, `Expected the whole official section, found ${fixtures.length}`);
  for (const fixture of fixtures) {
    const actual = countXText(fixture.text);
    for (const [key, value] of Object.entries(fixture.expected)) assert.equal(actual[key], value, `${fixture.description}: ${key}`);
  }
});

test('counts exact post text: CJK, boundary, combining marks, emoji, URL, numbering and tags', () => {
  assert.equal(X_TEXT_VERSION, 'twitter-text-3.1.0/config-v3');
  for (const [text, weightedLength, valid] of [
    ['a'.repeat(280), 280, true], ['a'.repeat(281), 281, false],
    ['中'.repeat(140), 280, true], ['中'.repeat(141), 282, false],
    ['cafe\u0301', 4, true], ['👨‍👩‍👧‍👦', 2, true], ['👍🏽', 2, true],
    ['https://example.com/a/very/long/path?foo=1', 23, true],
    ['1/3 #中文 👋\nhttps://example.com', 36, true], ['', 0, false], ['abc\ufffe', 5, false],
  ]) {
    const result = countXText(text);
    assert.equal(result.weightedLength, weightedLength, text); assert.equal(result.valid, valid, text);
    assert.equal(result.remaining, 280 - weightedLength);
  }
});

const doc = (kind = 'post', texts = ['One clear idea.']) => ({ id: kind, kind, title: '', postingNote: 'Internal note, never counted.', blocks: texts.map((text, index) => ({ id: `p${index + 1}`, type: 'x_post', text })) });
test('ordinary post and ordered thread have distinct structures; no hidden title or implicit split', () => {
  assert.deepEqual(validateXDocument(doc()), []);
  assert.deepEqual(validateXDocument(doc('thread', ['Opening', 'Support', 'Conclusion'])), []);
  assert.match(validateXDocument(doc('post', ['a', 'b'])).join(), /恰有一条/);
  assert.match(validateXDocument(doc('thread')).join(), /2–25/);
  assert.match(validateXDocument({ ...doc(), title: 'Hidden text' }).join(), /标题/);
  const long = doc('post', ['中'.repeat(141)]), before = structuredClone(long);
  assert.match(validateXDocument(long).join(), /282\/280/); assert.deepEqual(long, before);
  assert.deepEqual(validateXDocument(long, { checkLength: false }), []);
});

test('X format choices remain two platform-language packages with two typed documents and complete fixed rules', () => {
  const options = { platforms: ['x'], languages: ['zh', 'en'], formats: ['short_post', 'thread'], styles: ['plain'], assetMode: 'generate' };
  const resolved = resolveTextRules(options);
  assert.equal(resolved.status, 'ready'); assert.equal(resolved.variants.length, 2);
  for (const variant of resolved.variants) {
    assert.deepEqual(variant.documents.map(document => document.kind), ['post', 'thread']);
    assert.equal(variant.ruleMetadata.ruleSetVersion, 'x-text-v1.0.0');
    assert.match(variant.instructions, /共同母稿/); assert.match(variant.instructions, /shuorenhua/);
    assert.match(variant.instructions, /280/); assert.doesNotMatch(variant.instructions, /尚待完成，不执行生成/);
    assert.ok(variant.auditChecks.some(check => check.startsWith('x.thread:')));
    assert.doesNotMatch(variant.motherRules.instructions, /\[language\.|\[platform\.|\[format\./);
  }
  assert.deepEqual(resolved.variants[0].motherRules, resolved.variants[1].motherRules);
  assert.deepEqual(resolveTextRules({ ...options, languages: ['en'], formats: ['short_post'] }).variants[0].motherRules, resolved.variants[0].motherRules);
  assert.deepEqual(resolveTextRules({ ...options, formats: ['thread', 'short_post', 'thread'] }), resolved);
  assert.equal(resolveTextRules({ ...options, formats: ['long_article'] }).status, 'pending');
  const linked = resolveTextRules({ platforms: ['linkedin'], languages: ['en'], formats: ['short_post'] });
  assert.equal(linked.variants[0].ruleMetadata.ruleSetVersion, 'text-v1.0.0'); assert.doesNotMatch(linked.variants[0].instructions, /platform.x/);
});
