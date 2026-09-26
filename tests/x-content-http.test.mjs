import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {startServer} from '../server/index.mjs';

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=';
const draft=()=>({name:'SYNTHETIC X storage',projectId:null,platform:'x',language:'en',brief:{materials:[{id:'s',type:'text',label:'Synthetic',text:'Synthetic source'}],purpose:'Test storage',audience:'Test runner',platforms:['x'],languages:['en'],formats:['short_post','thread'],authorIdentity:[],styleTerms:[],lengthDepth:[],references:[]},documents:[{id:'post',kind:'post',title:'',postingNote:'',blocks:[{id:'p1',type:'x_post',text:'SYNTHETIC POST',assetIds:[]}]},{id:'thread',kind:'thread',title:'',postingNote:'',blocks:[1,2,3].map(n=>({id:'t'+n,type:'x_post',text:'SYNTHETIC THREAD '+n,assetIds:[]}))}],sources:[],assetIds:[],rule:null,executions:[]});
async function setup(t){
  const dataDir=mkdtempSync(path.join(tmpdir(),'launch-x-content-'));
  const app=await startServer({port:0,dataDir,xOptions:{env:{}},generationOptions:{testOnlyRunner:async()=>{throw Error('No model permitted');}}});
  t.after(async()=>{await app.close();assert.ok(dataDir.startsWith(path.resolve(tmpdir())+path.sep));rmSync(dataDir,{recursive:true,force:true});});
  const api=async(route,body,method=body===undefined?'GET':'POST')=>{const response=await fetch(app.url+route,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});return{status:response.status,...await response.json()};};
  return{api};
}
test('X HTTP dual-format stable IDs, saved versions and backup restore retain each post',async t=>{
  const {api}=await setup(t);let tmp=(await api('/api/content/tmp',{content:draft()})).item;
  assert.equal((await api('/api/content')).items.length,0);
  const first=await api('/api/content/tmp/'+tmp.id+'/confirm',{revision:tmp.revision,confirmed:true});assert.equal(first.status,200);assert.equal(first.version.content.documents.length,2);
  tmp=(await api('/api/content/'+first.item.id+'/revise',{revision:first.item.revision})).item;
  const next=structuredClone(tmp.content);next.documents[1].blocks[1].text+=' EDIT';
  tmp=(await api('/api/content/tmp/'+tmp.id,{revision:tmp.revision,content:next,temporary:tmp.temporary},'PUT')).item;
  const second=await api('/api/content/tmp/'+tmp.id+'/confirm',{revision:tmp.revision,confirmed:true});
  assert.equal(second.item.versions.length,2);assert.equal(second.version.content.documents[1].blocks[1].id,'t2');assert.equal(second.item.versions[0].content.documents[1].blocks[1].text,'SYNTHETIC THREAD 2');
  const backup=await api('/api/backup');delete backup.status;
  assert.equal((await api('/api/restore',backup)).status,200);
  assert.equal((await api('/api/content/'+first.item.id)).item.versions.length,2);
});
test('X image binding/verification is revision checked; edits invalidate exact association',async t=>{
  const {api}=await setup(t);let tmp=(await api('/api/content/tmp',{content:draft()})).item;
  const uploaded=await api('/api/content/tmp/'+tmp.id+'/assets',{revision:tmp.revision,fileName:'synthetic.png',mimeType:'image/png',dataBase64:png,source:{kind:'upload',url:null},caption:'Synthetic pixel'});tmp=uploaded.item;
  const bindRoute='/api/x-images/tmp/'+tmp.id+'/bind',verifyRoute='/api/x-images/tmp/'+tmp.id+'/verify';
  tmp=(await api(bindRoute,{revision:tmp.revision,documentId:'thread',assetId:uploaded.asset.id})).item;
  const stale=tmp.revision;
  tmp=(await api(verifyRoute,{revision:tmp.revision,documentId:'thread',confirmed:true,altText:'Synthetic pixel',generated:false})).item;
  assert.equal(tmp.content.documents[1].blocks[0].image.visualVerification,'passed');
  assert.equal((await api(verifyRoute,{revision:stale,documentId:'thread',confirmed:true,altText:'Synthetic pixel',generated:false})).status,409);
  const changed=structuredClone(tmp.content);changed.documents[1].blocks[2].text+=' CHANGED';
  tmp=(await api('/api/content/tmp/'+tmp.id,{revision:tmp.revision,content:changed,temporary:tmp.temporary},'PUT')).item;
  assert.equal(tmp.content.documents[1].blocks[0].image.status,'needs_update');assert.equal(tmp.content.documents[1].blocks[0].image.visualVerification,'not_run');
  assert.equal((await api(verifyRoute,{revision:tmp.revision,documentId:'thread',confirmed:true,altText:'Synthetic pixel',generated:false})).status,400);
  const otherBefore=structuredClone(tmp.content.documents[0]);
  const prepared=await api('/api/x-images/tmp/'+tmp.id+'/prepare',{revision:tmp.revision,documentId:'thread'});assert.equal(prepared.status,200);
  assert.equal(prepared.item.content.documents[1].blocks[0].image.status,'uploaded');
  assert.deepEqual(prepared.item.content.documents[0],otherBefore);
  tmp=prepared.item;
  const threadBefore=structuredClone(tmp.content.documents[1]);
  const noImage=await api('/api/x-images/tmp/'+tmp.id+'/prepare',{revision:tmp.revision,documentId:'post'});
  assert.equal(noImage.status,200);assert.deepEqual(noImage.item.content.documents[0].blocks[0].assetIds,[]);
  assert.equal(noImage.item.content.documents[0].blocks[0].image.status,'dependency_blocked');
  assert.deepEqual(noImage.item.content.documents[1],threadBefore);
});
test('X storage rejects cross-tmp images, misplaced images and empty individual posts',async t=>{
  const {api}=await setup(t);const content=draft();content.documents[1].blocks[1].assetIds=['foreign'];
  assert.equal((await api('/api/content/tmp',{content})).status,400);
  content.documents[1].blocks[1].assetIds=[];content.documents[1].blocks[1].text='';
  const tmp=(await api('/api/content/tmp',{content})).item;
  assert.equal((await api('/api/content/tmp/'+tmp.id+'/confirm',{revision:tmp.revision,confirmed:true})).status,400);
  const response=await api('/api/x-images/tmp/'+tmp.id+'/prepare',{revision:tmp.revision,extra:'bad'});assert.equal(response.status,400);
});
test('X uploaded image AI disclosure survives unbinding, rebinding and saved backup',async t=>{
  const {api}=await setup(t);let tmp=(await api('/api/content/tmp',{content:draft()})).item;
  const uploaded=await api('/api/content/tmp/'+tmp.id+'/assets',{revision:tmp.revision,fileName:'synthetic-ai.png',mimeType:'image/png',dataBase64:png,source:{kind:'upload',url:null},caption:'Synthetic pixel'});tmp=uploaded.item;
  const route='/api/x-images/tmp/'+tmp.id;
  tmp=(await api(route+'/bind',{revision:tmp.revision,documentId:'thread',assetId:uploaded.asset.id})).item;
  tmp=(await api(route+'/verify',{revision:tmp.revision,documentId:'thread',confirmed:true,altText:'Synthetic pixel',generated:true})).item;
  assert.equal(tmp.assets[0].madeWithAi,true);
  const unbound=structuredClone(tmp.content);unbound.documents[1].blocks[0].assetIds=[];delete unbound.documents[1].blocks[0].image;
  tmp=(await api('/api/content/tmp/'+tmp.id,{revision:tmp.revision,content:unbound,temporary:tmp.temporary},'PUT')).item;
  tmp=(await api(route+'/bind',{revision:tmp.revision,documentId:'thread',assetId:uploaded.asset.id})).item;
  assert.equal(tmp.content.documents[1].blocks[0].image.generated,true);
  const saved=await api('/api/content/tmp/'+tmp.id+'/confirm',{revision:tmp.revision,confirmed:true});assert.equal(saved.status,200);
  const backup=await api('/api/backup');delete backup.status;
  const restoration=await api('/api/restore',backup);assert.equal(restoration.status,200,JSON.stringify(restoration));
  const restored=await api('/api/content/'+saved.item.id);
  assert.equal(restored.item.versions[0].assets[0].madeWithAi,true);
});
