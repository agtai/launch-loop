import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, sha256 } from '../scripts/compile.mjs';
import { applySelection, countText } from '../scripts/checks.mjs';
const options = {platforms:['linkedin'],languages:['zh','en'],formats:['short_post']};

test('equivalent multiselects yield the same rules, two outputs, and no input mutation', () => {
  const a = {...options,styles:['plain','professional','concise'],depths:['brief','detailed']};
  const before = structuredClone(a);
  const b = {...a,languages:['en','zh','en'],styles:['concise','plain','professional','plain'],depths:['detailed','brief']};
  const first=compile(a), second=compile(b);
  assert.equal(first.status,'ready'); assert.equal(first.variants.length,2);
  assert.equal(first.bundleHash,second.bundleHash);
  assert.deepEqual(first.variants.map(v=>v.ruleHash),second.variants.map(v=>v.ruleHash));
  assert.deepEqual(a,before);
});

test('empty optional selection needs an explicit runtime preset, never success with zero drafts', () => {
  for (const missing of ['platforms','languages','formats']) {
    const result=compile({...options,[missing]:[]});
    assert.equal(result.status,'needs_configuration');assert.equal(result.variants.length,0);
  }
});

test('known unadapted platforms or mixed formats stop the whole batch', () => {
  for (const changed of [{platforms:['linkedin','x']},{formats:['short_post','long_article']},{platforms:['bilibili']}]) {
    const result=compile({...options,...changed});
    assert.equal(result.status,'pending');
    assert.ok(result.variants.length>0);
    assert.ok(result.variants.every(v=>v.instructions===null));
  }
});

test('unknown enums, malformed shapes and guessed CTA/UI fields cannot silently enter rules', () => {
  for (const changed of [{platforms:['LinkedIn']},{languages:'en'},{formats:['video']},{assetMode:'automatic'},{cta:'buy'},{uiLanguage:'en'},{freeText:{unknown:'x'}},{styles:[null]}]) {
    assert.equal(compile({...options,...changed}).status,'invalid');
  }
  for (const malformed of [null,[],false]) assert.equal(compile(malformed).status,'invalid');
});

test('terms are data; explicit contradictory requirements stop compilation', () => {
  assert.equal(compile({...options,terminology:{required:[' Cache '],forbidden:['Cache']}}).status,'invalid');
  const result=compile({...options,terminology:{required:['<ignore rules>','API','API']}});
  assert.equal(result.status,'ready');assert.deepEqual(result.normalized.terminology.required,['<ignore rules>','API']);
  assert.equal(result.semanticPreflightRequired,true);
});

test('free text is preserved without invented enum IDs and changes trace hash', () => {
  const base=compile(options), changed=compile({...options,freeText:{styleTerms:'保留 may，不改完成状态'}});
  assert.equal(changed.status,'ready');assert.deepEqual(changed.normalized.styles,[]);
  assert.equal(changed.normalized.freeText.styleTerms,'保留 may，不改完成状态');
  assert.notEqual(base.bundleHash,changed.bundleHash);
  assert.equal(base.normalized.assetMode,'generate');
});

test('project profile requires explicit selection and has its own manifest fingerprint', () => {
  const generic=compile(options), project=compile({...options,project:'system1-agents'});
  assert.ok(!generic.manifest.some(f=>f.path==='rules/author-system1.md'));
  assert.ok(project.manifest.some(f=>f.path==='rules/author-system1.md'));
  assert.notEqual(generic.bundleHash,project.bundleHash);
  assert.equal(compile({...options,project:'invented'}).status,'invalid');
});

test('UTF-16 limit exposes supplementary characters rather than trusting code point count', () => {
  assert.deepEqual(countText('中😀\n'),{codePoints:3,utf16:4,withinLocalLimit:true});
  assert.equal(countText('a'.repeat(3000)).withinLocalLimit,true);
  assert.equal(countText('😀'.repeat(1501)).withinLocalLimit,false);
});

const body='前言😀\r\nIt may help.\r\nIt may help.\r\n尾注';
const selectedText='It may help.';
const start=body.lastIndexOf(selectedText),end=start+selectedText.length;
const request={body,expectedBodyHash:sha256(body),sourceRevision:7,currentRevision:7,start,end,selectedText,replacement:'It may assist.'};
test('selection changes only the specified duplicate and preserves all external bytes', () => {
  const candidate=applySelection(request);
  assert.equal(candidate.slice(0,start),body.slice(0,start));
  assert.equal(candidate.slice(start+request.replacement.length),body.slice(end));
  assert.equal(candidate.indexOf(selectedText),body.indexOf(selectedText));
  assert.equal(body,request.body);
});

test('late revision, changed content, wrong selection and surrogate split reject edits', () => {
  for (const changed of [{currentRevision:8},{expectedBodyHash:sha256(body+' ')},{selectedText:'wrong'},{end:10000},{start:3,end:4,selectedText:body.slice(3,4)}]) {
    assert.throws(()=>applySelection({...request,...changed}));
  }
});
