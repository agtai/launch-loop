import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {englishMessages, translateText as tr, translateBuiltin, normalizeLocale, formatDate} from '../src/i18n-core.mjs';
const chinese = /[\u3400-\u9fff]/u;
const json = name => JSON.parse(readFileSync(new URL('../'+name, import.meta.url),'utf8'));

test('all bundled task, resource and seed descriptions have English text without changing canonical data', () => {
  for (const file of ['src/tasks.json','src/resources.json','data-seed/modules.json']) {
    const original=json(file),before=JSON.stringify(original),shown=translateBuiltin(original,'en');
    function check(raw, translated, location) {
      if (typeof raw==='string') {
        if(chinese.test(raw)) { assert.notEqual(translated,raw,location); assert.equal(chinese.test(translated),false,location); }
        else assert.equal(translated,raw,location);
      } else if(Array.isArray(raw)) { assert.equal(raw.length,translated.length); raw.forEach((value,index)=>check(value,translated[index],location+'.'+index)); }
      else if(raw&&typeof raw==='object') { assert.deepEqual(Object.keys(raw),Object.keys(translated)); for(const key of Object.keys(raw))check(raw[key],translated[key],location+'.'+key); }
      else assert.equal(translated,raw);
    }
    check(original,shown,file);assert.equal(JSON.stringify(original),before);
    assert.equal(translateBuiltin(original,'zh'),original);
  }
});

test('translation placeholders preserve counts and filenames, and nested service reasons translate', () => {
  const tokens=value=>[...value.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map(match=>match[1]).sort();
  for(const [source,target]of Object.entries(englishMessages))assert.deepEqual(tokens(target),tokens(source),source);
  assert.equal(tr('资料 项目说明.md 不是有效 UTF-8 文本。','en'),'The material 项目说明.md is not valid UTF-8 text.');
  assert.equal(tr('读取授权账号被 LinkedIn 拒绝（HTTP 403）。','en'),'Read authorized account was refused by LinkedIn (HTTP 403).');
  assert.equal(tr('生成规则状态 pending：包含尚未适配的平台或格式，不得套用其他平台规则执行。','en'),'Generation rules are pending: This selection includes an unsupported platform or format. Rules from another platform must not be substituted.');
  assert.equal(tr('用户原文：不要改变这个句子','en'),'用户原文：不要改变这个句子');
  assert.equal(tr('LinkedIn 提交结果无法确认（HTTP 503，无有效平台 ID）。请先核对，禁止自动重发。','en'),'The LinkedIn submission result cannot be confirmed (HTTP 503, no valid platform ID). Check it first. Automatic resubmission is prohibited.');
  assert.equal(tr('LinkedIn 提交结果无法确认（HTTP 502，已保留平台 ID）。请先核对，禁止自动重发。','en'),'The LinkedIn submission result cannot be confirmed (HTTP 502, platform ID retained). Check it first. Automatic resubmission is prohibited.');
  assert.equal(tr('资料 {value1} 不是有效 UTF-8 文本。','en',{value1:'$&中文.md'}),'The material $&中文.md is not valid UTF-8 text.');
});

test('UI source has no untranslated visible Chinese literals and each translation key exists', () => {
  for(const file of ['src/App.tsx','src/ContentWorkspace.tsx','src/PublishingWorkspace.tsx','src/XDocuments.tsx','src/XImageTasks.tsx','src/XPublishingWorkspace.tsx']){
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node){
      if(ts.isJsxText(node)) {
        const languageName=node.text.trim()==='中文'&&ts.isJsxElement(node.parent)&&node.parent.openingElement.attributes.properties.some(attribute=>ts.isJsxAttribute(attribute)&&attribute.name.getText(tree)==='lang'&&attribute.initializer&&ts.isStringLiteral(attribute.initializer)&&attribute.initializer.text==='zh-CN');
        if(!languageName)assert.equal(chinese.test(node.text),false,`${file}: ${node.text.trim()}`);
      }
      if(ts.isJsxAttribute(node)&&['aria-label','placeholder','title','alt'].includes(node.name.getText(tree))&&node.initializer&&ts.isStringLiteral(node.initializer))assert.equal(chinese.test(node.initializer.text),false,`${file}: ${node.initializer.text}`);
      if(ts.isCallExpression(node)&&['t','tr'].includes(node.expression.getText(tree))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])&&chinese.test(node.arguments[0].text))assert.ok(Object.hasOwn(englishMessages,node.arguments[0].text),`${file}: ${node.arguments[0].text}`);
      ts.forEachChild(node,visit);
    }visit(tree);
  }
});

test('language preferences are limited to Chinese and English and dates use the chosen locale', () => {
  assert.equal(normalizeLocale('en'),'en');assert.equal(normalizeLocale('zh'),'zh');assert.equal(normalizeLocale('invalid'),'zh');assert.equal(normalizeLocale(null),'zh');
  assert.notEqual(formatDate('2026-09-24T10:20:30Z','en'),formatDate('2026-09-24T10:20:30Z','zh'));
  assert.equal(formatDate(null,'en'),'Unknown');assert.equal(formatDate(null,'zh'),'未知');
  assert.equal(formatDate('2026-09-24','en'),'24/09/2026');
});
