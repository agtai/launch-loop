import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createContentStore} from '../server/content-store.mjs';
import {createGenerationService} from '../server/generation-service.mjs';
import {textV2Fixture} from './fixtures/text-v2-fixture.mjs';
async function done(service,id) {for(let i=0;i<300;i++){const job=service.get(id);if(!['queued','running','cancelling'].includes(job.status))return job;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Fixture timed out');}
async function setup(t, {runner, materialText} = {}) {
  const dir=mkdtempSync(path.join(tmpdir(),'mvp-edit-')),db=new DatabaseSync(path.join(dir,'test.sqlite'));
  const content=createContentStore(db,dir,{snapshot(){},checkBackupSize(){}});
  const calls=[];
  const defaultRunner=args=>args.stage==='modification'?{replacement:'The workshop checklist remains a planned pilot.',unresolved:[],changesSharedFacts:true,impactReason:'Synthetic factual-impact flag.',changedClaimIds:['claim1']}:textV2Fixture(args);
  const service=createGenerationService({content,dataDir:dir,imageProvider:'',testOnlyRunner:args=>{calls.push(structuredClone({stage:args.stage,payload:args.payload}));return (runner??defaultRunner)(args);}});
  t.after(async()=>{await service.close();db.close();assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep));rmSync(dir,{recursive:true,force:true});});
  const input={requestId:randomUUID(),name:'SYNTHETIC editing',brief:{materials:[{id:'facts',label:'SYNTHETIC',type:'text',text:'The workshop checklist is a planned pilot. Production use has not been tested.'}],purpose:'Explain the plan',audience:'Workshop leads',platforms:['linkedin'],languages:['zh','en'],formats:['short_post'],authorIdentity:[],styleTerms:[],lengthDepth:[],references:[]},uploads:[],options:{}};
  if(materialText)input.brief.materials[0].text=materialText;
  const generation=await done(service,service.create(input).id);assert.equal(generation.status,'completed',generation.error);
  const source=content.readTmp(generation.variants.find(v=>v.language==='en').tmpId), sibling=content.readTmp(generation.variants.find(v=>v.language==='zh').tmpId);
  const selection={documentId:'feed',blockId:'paragraph1',start:0,end:44,text:source.content.documents[0].blocks[0].text.slice(0,44)};
  const modify=()=>service.modify({requestId:randomUUID(),tmpId:source.id,revision:source.revision,selection,instruction:'SYNTHETIC wording request'});
  return {service,content,source,sibling,generation,modify,input,calls};
}
test('v2 rejection persists, acceptance is idempotent, cross-language impact preserves the other draft',async t=>{
  const f=await setup(t);const rejected=await done(f.service,f.modify().id);f.service.reject(rejected.id);
  assert.throws(()=>f.service.accept(rejected.id,{sourceRevision:f.source.revision}),/拒绝/);assert.deepEqual(f.content.readTmp(f.source.id),f.source);
  const proposed=await done(f.service,f.modify().id);assert.equal(proposed.status,'completed',proposed.error);
  const accepted=f.service.accept(proposed.id,{sourceRevision:f.source.revision});assert.equal(f.service.accept(proposed.id,{sourceRevision:f.source.revision}).id,accepted.id);
  assert.deepEqual(f.content.readTmp(f.sibling.id),f.sibling);assert.deepEqual(f.service.get(f.generation.id).languageImpact.affectedLanguages,['zh']);
  assert.deepEqual(f.content.list(),[]);
});
test('undo is a proposal, preserves later unrelated edits, and cannot target a moved identical substring',async t=>{
  const f=await setup(t),proposed=await done(f.service,f.modify().id);let accepted=f.service.accept(proposed.id,{sourceRevision:f.source.revision});
  accepted.content.documents[0].blocks.push({id:'later',type:'paragraph',text:'SYNTHETIC later manual note.'});
  accepted=f.content.updateTmp(accepted.id,{revision:accepted.revision,content:accepted.content,temporary:accepted.temporary});
  const reverse=f.service.undo(proposed.id,{requestId:randomUUID(),tmpId:accepted.id,revision:accepted.revision});
  assert.equal(f.content.readTmp(accepted.id).content.documents[0].blocks[0].text,accepted.content.documents[0].blocks[0].text);
  const undone=f.service.accept(reverse.id,{sourceRevision:accepted.revision});
  assert.equal(undone.content.documents[0].blocks[0].text,f.source.content.documents[0].blocks[0].text);
  assert.equal(undone.content.documents[0].blocks[1].text,'SYNTHETIC later manual note.');
  const second=await done(f.service,f.modify().id);let moved=f.service.accept(second.id,{sourceRevision:f.source.revision});
  moved.content.documents[0].blocks[0].text='Changed original span. '+second.change.replacement;
  moved=f.content.updateTmp(moved.id,{revision:moved.revision,content:moved.content,temporary:moved.temporary});
  assert.throws(()=>f.service.undo(second.id,{requestId:randomUUID(),tmpId:moved.id,revision:moved.revision}),/安全撤回/);
});

const wholeBlockSelection=tmp=>{
  const document=tmp.content.documents[0],block=document.blocks[0];
  return {documentId:document.id,blockId:block.id,start:0,end:block.text.length,text:block.text};
};

test('explicit synchronization produces a separate selected-span proposal and accepting it preserves both original language drafts',async t=>{
  const f=await setup(t,{runner:args=>args.stage==='modification'?{
    replacement:args.payload.instruction.includes('synchronization proposal')?'车间交接清单':'The workshop checklist remains a planned pilot.',
    unresolved:[],changesSharedFacts:true,impactReason:'Explicit synthetic shared-fact impact.',changedClaimIds:['claim1'],
  }:textV2Fixture(args)});
  const proposed=await done(f.service,f.modify().id);assert.equal(proposed.status,'completed',proposed.error);
  const selectedText='车间清单',selection={documentId:'feed',blockId:'paragraph1',start:0,end:selectedText.length,text:selectedText};
  const raw={requestId:randomUUID(),tmpId:f.sibling.id,revision:f.sibling.revision,selection,modificationId:proposed.id};
  assert.throws(()=>f.service.synchronize(raw),/已接受/);
  const acceptedSource=f.service.accept(proposed.id,{sourceRevision:f.source.revision});
  const before=structuredClone(f.content.readTmp(f.sibling.id));
  const sync=await done(f.service,f.service.synchronize(raw).id);assert.equal(sync.status,'completed',sync.error);
  assert.equal(sync.disposition,'pending');assert.deepEqual(sync.source,{tmpId:before.id,revision:before.revision});
  assert.notEqual(sync.variants[0].tmpId,before.id);assert.notEqual(sync.variants[0].tmpId,acceptedSource.id);
  assert.deepEqual(f.content.readTmp(before.id),before);
  assert.deepEqual(f.content.readTmp(acceptedSource.id),acceptedSource);
  const candidate=f.content.readTmp(sync.variants[0].tmpId);
  assert.equal(candidate.content.language,'zh');
  assert.equal(candidate.content.documents[0].blocks[0].text,'车间交接清单'+before.content.documents[0].blocks[0].text.slice(selectedText.length));
  const synchronizationCall=f.calls.filter(call=>call.stage==='modification').at(-1);
  assert.match(synchronizationCall.payload.instruction,/Other-language before:/);
  assert(synchronizationCall.payload.instruction.includes(proposed.change.text));
  assert(synchronizationCall.payload.instruction.includes(proposed.change.replacement));
  assert.deepEqual(synchronizationCall.payload.selection,selection);
  const acceptedTarget=f.service.accept(sync.id,{sourceRevision:before.revision});
  assert.notEqual(acceptedTarget.id,candidate.id);assert.notEqual(acceptedTarget.id,before.id);
  assert.deepEqual(acceptedTarget.content.documents,candidate.content.documents);
  assert.deepEqual(f.content.readTmp(before.id),before);assert.deepEqual(f.content.readTmp(f.source.id),f.source);
  assert.deepEqual(f.content.readTmp(acceptedSource.id),acceptedSource);
  assert.equal(f.calls.filter(call=>call.stage==='modification').length,2);
  assert.equal(f.calls.filter(call=>call.stage==='review').length,2);
  assert.deepEqual(f.content.list(),[]);
});

test('synchronization enforces the target revision before invoking a model and requires separate acceptance afterwards',async t=>{
  const f=await setup(t),proposed=await done(f.service,f.modify().id);
  f.service.accept(proposed.id,{sourceRevision:f.source.revision});
  const source=f.content.readTmp(f.sibling.id),selection=wholeBlockSelection(source);
  const edited=f.content.updateTmp(source.id,{revision:source.revision,content:{...source.content,name:'SYNTHETIC later user label'},temporary:source.temporary});
  const callsBefore=f.calls.length;
  assert.throws(()=>f.service.synchronize({requestId:randomUUID(),tmpId:source.id,revision:source.revision,selection,modificationId:proposed.id}),/源稿已修改/);
  assert.equal(f.calls.length,callsBefore);
  const sync=await done(f.service,f.service.synchronize({requestId:randomUUID(),tmpId:edited.id,revision:edited.revision,selection,modificationId:proposed.id}).id);
  assert.equal(sync.status,'completed',sync.error);assert.equal(sync.disposition,'pending');
  assert.deepEqual(f.content.readTmp(edited.id),edited);
  const later=f.content.updateTmp(edited.id,{revision:edited.revision,content:edited.content,temporary:edited.temporary});
  assert.throws(()=>f.service.accept(sync.id,{sourceRevision:edited.revision}),/源稿已修改/);
  assert.deepEqual(f.content.readTmp(later.id),later);
});

async function twoBatches(t){
  const sourceText=marker=>`The workshop checklist is a planned pilot. Production use has not been tested. This explicit synthetic source belongs to ${marker}.`;
  const runner=async args=>{
    if(args.stage==='modification')return {replacement:'Synthetic wording change without an evidence change.',unresolved:[],changesSharedFacts:true,impactReason:'Explicit synthetic impact only.',changedClaimIds:['claim1']};
    const value=await textV2Fixture(args);
    if(args.stage==='mother'){
      const source=args.payload.actualSources.find(source=>typeof source.text==='string');
      const marker=/BATCH_[AB]/.exec(source.text)[0];
      value.claimLedger[0].proposition=source.text;
      value.termLedger[0].reason=`Explicit synthetic term ledger ${marker}`;
      value.editorialPlan.mainClaim=`Explicit synthetic editorial plan ${marker}`;
    }
    return value;
  };
  const f=await setup(t,{runner,materialText:sourceText('BATCH_A')});
  const input=structuredClone(f.input);input.requestId=randomUUID();input.name='SYNTHETIC second independent batch';input.brief.materials[0].text=sourceText('BATCH_B');
  const generation=await done(f.service,f.service.create(input).id);assert.equal(generation.status,'completed',generation.error);
  const source=f.content.readTmp(generation.variants.find(variant=>variant.language==='en').tmpId),sibling=f.content.readTmp(generation.variants.find(variant=>variant.language==='zh').tmpId);
  assert.equal(source.content.rule.hash,f.source.content.rule.hash);assert.equal(sibling.content.rule.hash,f.sibling.content.rule.hash);
  return {f,second:{generation,source,sibling},sourceText};
}

test('same-rule generation batches and their accepted descendants only use their own evidence and editorial ledgers',async t=>{
  const {f,second,sourceText}=await twoBatches(t);
  const modify=source=>f.service.modify({requestId:randomUUID(),tmpId:source.id,revision:source.revision,selection:wholeBlockSelection(source),instruction:'SYNTHETIC wording update from the current source ledger'});
  // B is modified first so a rule-hash-only lookup would incorrectly choose A.
  const b=await done(f.service,modify(second.source).id);assert.equal(b.status,'completed',b.error);
  const acceptedB=f.service.accept(b.id,{sourceRevision:second.source.revision});
  const descendant=await done(f.service,modify(acceptedB).id);assert.equal(descendant.status,'completed',descendant.error);
  const a=await done(f.service,modify(f.source).id);assert.equal(a.status,'completed',a.error);
  const modifications=f.calls.filter(call=>call.stage==='modification');assert.equal(modifications.length,3);
  for(const [index,marker]of ['BATCH_B','BATCH_B','BATCH_A'].entries()){
    const payload=modifications[index].payload;
    assert.equal(payload.claimLedger[0].proposition,sourceText(marker));
    assert.equal(payload.termLedger[0].reason,`Explicit synthetic term ledger ${marker}`);
    assert.equal(payload.editorialPlan.mainClaim,`Explicit synthetic editorial plan ${marker}`);
    assert(payload.actualSources.some(source=>source.text===sourceText(marker)));
    assert(!JSON.stringify([payload.claimLedger,payload.termLedger,payload.editorialPlan,payload.actualSources]).includes(marker==='BATCH_A'?'BATCH_B':'BATCH_A'));
  }
  assert.equal(f.service.get(second.generation.id).languageImpact.modificationId,b.id);
  assert.equal(f.service.get(f.generation.id).languageImpact,undefined);
  assert.deepEqual(f.content.readTmp(f.sibling.id),f.sibling);assert.deepEqual(f.content.readTmp(second.sibling.id),second.sibling);
});

test('synchronization rejects an unrelated generation batch even when both language rule hashes match',async t=>{
  const {f,second}=await twoBatches(t),proposed=await done(f.service,f.modify().id);
  assert.equal(proposed.status,'completed',proposed.error);f.service.accept(proposed.id,{sourceRevision:f.source.revision});
  const count=f.calls.length;
  assert.throws(()=>f.service.synchronize({requestId:randomUUID(),tmpId:second.sibling.id,revision:second.sibling.revision,selection:wholeBlockSelection(second.sibling),modificationId:proposed.id}),/同批|来源|批次/);
  assert.equal(f.calls.length,count);
  assert.deepEqual(f.content.readTmp(second.sibling.id),second.sibling);
});
