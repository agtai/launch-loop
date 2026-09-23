import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

let startServer;
try { ({ startServer } = await import('../server/index.mjs')); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

const moduleIds = ['research', 'creation', 'review', 'publishing', 'feedback'];
const moduleSeeds = moduleIds.map(id => ({id,owner:'',status:'待试跑',input:'输入',steps:['核查资料'],output:'交付物',acceptance:'有来源',tools:'人工',notes:'',resultUrl:'',revision:0,updatedAt:null}));
async function fixture(t,taskSeeds=[{id:'brand-01',title:'明确品牌'},{id:'startup-01',title:'访谈'}]) {
  assert.equal(typeof startServer, 'function', 'server must export a runnable local server');
  const root = await mkdtemp(path.join(tmpdir(),'workbench-test-'));
  const dataDir=path.join(root,'data'), seedDir=path.join(root,'seed'), distDir=path.join(root,'dist');
  await mkdir(seedDir); await mkdir(distDir);
  await writeFile(path.join(seedDir,'modules.json'),JSON.stringify(moduleSeeds));
  await writeFile(path.join(seedDir,'tasks.json'),JSON.stringify(taskSeeds));
  await writeFile(path.join(distDir,'index.html'),'<h1>LOCAL WORKBENCH</h1>');
  await writeFile(path.join(root,'private.txt'),'PRIVATE FILE');
  let server=await startServer({port:0,dataDir,seedDir,distDir});
  t.after(async()=>{await server.close();await rm(root,{recursive:true,force:true});});
  return {root,dataDir,get url(){return server.url;},async restart(){await server.close();server=await startServer({port:0,dataDir,seedDir,distDir});},async api(route,body,method='PUT',headers={}){return fetch(server.url+route,body===undefined?{headers}:{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}};
}

test('module and task edits persist across a server restart',async t=>{
  const f=await fixture(t);
  assert.deepEqual(await (await f.api('/api/health')).json(),{app:'content-workbench-local',version:1});
  const modules=(await (await f.api('/api/modules')).json()).items;
  assert.equal(modules.length,5);
  const saved=await f.api('/api/modules',{...modules[0],owner:'林',notes:'已核查'});
  assert.equal(saved.status,200);
  assert.equal((await saved.json()).item.revision,1);
  const tasks=(await (await f.api('/api/tasks')).json()).items;
  assert.equal(tasks[0].status,'待开始');
  assert.equal((await f.api('/api/tasks',{...tasks[0],owner:'陈',status:'进行中',notes:'安排访谈'})).status,200);
  await f.restart();
  const nextModules=(await (await f.api('/api/modules')).json()).items;
  const nextTasks=(await (await f.api('/api/tasks')).json()).items;
  assert.equal(nextModules[0].owner,'林');assert.equal(nextModules[0].notes,'已核查');
  assert.equal(nextTasks[0].owner,'陈');assert.equal(nextTasks[0].status,'进行中');
  const daily=(await readdir(path.join(f.dataDir,'backups'))).filter(n=>n.startsWith('daily-'));
  assert.equal(daily.length,1);
  const snapshot=JSON.parse(await readFile(path.join(f.dataDir,'backups',daily[0]),'utf8'));
  assert.equal(snapshot.modules[0].owner,'');
});

test('two writes with the same revision cannot silently overwrite each other',async t=>{
  const f=await fixture(t);const item=(await (await f.api('/api/modules')).json()).items[0];
  const responses=await Promise.all(['甲','乙'].map(owner=>f.api('/api/modules',{...item,owner})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const current=(await (await f.api('/api/modules')).json()).items[0];
  assert.equal(current.revision,1);assert.ok(['甲','乙'].includes(current.owner));
});

test('invalid restore changes nothing and valid restore keeps a pre-restore snapshot',async t=>{
  const f=await fixture(t);const original=await (await f.api('/api/backup')).json();
  const changed={...original.modules[0],owner:'恢复前负责人'};
  await f.api('/api/modules',changed);
  const before=await (await f.api('/api/backup')).json();
  const invalid=structuredClone(original);invalid.tasks[1].id='not-known';
  assert.equal((await f.api('/api/restore',invalid,'POST')).status,400);
  const unchanged=await (await f.api('/api/backup')).json();
  assert.deepEqual(unchanged.modules,before.modules);assert.deepEqual(unchanged.tasks,before.tasks);
  const restored=await f.api('/api/restore',original,'POST');assert.equal(restored.status,200);
  const after=await (await f.api('/api/backup')).json();
  assert.equal(after.modules[0].owner,'');assert.equal(after.modules[0].revision,2);
  assert.equal(after.tasks[0].revision,1);
  const snapshots=(await readdir(path.join(f.dataDir,'backups'))).filter(n=>n.startsWith('pre-restore-'));
  assert.equal(snapshots.length,1);
  const snapshot=JSON.parse(await readFile(path.join(f.dataDir,'backups',snapshots[0]),'utf8'));
  assert.equal(snapshot.modules[0].owner,'恢复前负责人');
  assert.equal((await f.api('/api/modules',changed)).status,409);
});

test('a valid exported backup above 2 MiB restores every Chinese task note',async t=>{
  const f=await fixture(t,Array.from({length:44},(_,index)=>({id:`task-${index}`})));
  const tasks=(await (await f.api('/api/tasks')).json()).items;
  const notes='复'.repeat(20000);
  for(const task of tasks)assert.equal((await f.api('/api/tasks',{...task,notes})).status,200);
  const backup=await (await f.api('/api/backup')).json();
  assert.ok(Buffer.byteLength(JSON.stringify(backup),'utf8')>2*1024*1024);
  assert.equal((await f.api('/api/tasks',{...backup.tasks[0],notes:'已清空'})).status,200);
  const restored=await f.api('/api/restore',backup,'POST');
  assert.equal(restored.status,200,await restored.text());
  const reloaded=(await (await f.api('/api/tasks')).json()).items;
  assert.equal(reloaded.length,44);
  for(const task of reloaded)assert.equal(task.notes,notes);
  assert.equal(reloaded[0].revision,3);
  assert.equal((await f.api('/api/restore',{...backup,exportedAt:'x'.repeat(16*1024*1024)},'POST')).status,413);
});

test('rejects unknown IDs, unsafe URLs, invalid fields, and incomplete backups',async t=>{
  const f=await fixture(t);const item=(await (await f.api('/api/modules')).json()).items[0];
  for(const patch of [{id:'unknown'},{resultUrl:'javascript:alert(1)'},{steps:'bad'},{revision:-1},{owner:1},{extra:'unrecognized'},{updatedAt:'not-a-date'}]) {
    assert.equal((await f.api('/api/modules',{...item,...patch})).status,400,JSON.stringify(patch));
  }
  const backup=await (await f.api('/api/backup')).json();backup.modules.pop();
  assert.equal((await f.api('/api/restore',backup,'POST')).status,400);
  const task=(await (await f.api('/api/tasks')).json()).items[0];
  assert.equal((await f.api('/api/tasks',{...task,id:'unknown'})).status,400);
});

test('rejects cross-origin or cross-site requests and non-JSON mutations',async t=>{
  const f=await fixture(t);const item=(await (await f.api('/api/modules')).json()).items[0];
  assert.equal((await f.api('/api/modules',item,'PUT',{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.api('/api/modules',item,'PUT',{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await f.api('/api/modules',item,'PUT',{'Content-Type':'text/plain'})).status,415);
  assert.equal((await f.api('/api/modules',item,'PUT',{Origin:f.url})).status,200);
  const spoofedHost=await new Promise((resolve,reject)=>{http.get(f.url+'/api/modules',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
  assert.equal(spoofedHost,403);
  assert.equal((await fetch(f.url+'/api/modules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,notes:'x'.repeat(2*1024*1024)})})).status,413);
});

test('static serving does not reveal sibling files and sends local-only CSP',async t=>{
  const f=await fixture(t);const page=await fetch(f.url+'/projects/brand');
  assert.equal(page.status,200);assert.match(await page.text(),/LOCAL WORKBENCH/);
  assert.match(page.headers.get('content-security-policy'),/default-src 'self'/);
  const status=await new Promise((resolve,reject)=>{http.get(f.url+'/%2e%2e%2fprivate.txt',r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
  assert.equal(status,403);
  const absent=await fetch(f.url+'/absent.js');assert.equal(absent.status,404);
});
