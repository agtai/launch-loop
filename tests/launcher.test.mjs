import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function run(script,args=[]){return new Promise((resolve,reject)=>{const proc=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';proc.stdout.on('data',chunk=>output+=chunk);proc.stderr.on('data',chunk=>output+=chunk);proc.on('error',reject);proc.on('exit',code=>{proc.stdout.destroy();proc.stderr.destroy();resolve({code,output});});});}
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}

async function launcherFixture(t){
  const present=await access(path.join(project,'Start-Workbench.ps1')).then(()=>true,()=>false);
  assert.equal(present,true,'a runnable Windows launcher must exist');
  const root=await mkdtemp(path.join(tmpdir(),'workbench-launcher-'));
  for(const folder of ['server','data-seed','dist','runtime'])await mkdir(path.join(root,folder));
  for(const name of ['Start-Workbench.ps1','Stop-Workbench.ps1'])await cp(path.join(project,name),path.join(root,name));
  await cp(path.join(project,'server'),path.join(root,'server'),{recursive:true});
  await cp(path.join(project,'rules'),path.join(root,'rules'),{recursive:true});
  await cp(process.execPath,path.join(root,'runtime','node.exe'));
  const modules=['research','creation','review','publishing','feedback'].map(id=>({id,owner:'',status:'待试跑',input:'输入',steps:[],output:'成果',acceptance:'验收',tools:'',notes:'',resultUrl:'',revision:0,updatedAt:null}));
  await writeFile(path.join(root,'data-seed','modules.json'),JSON.stringify(modules));
  await writeFile(path.join(root,'data-seed','tasks.json'),'[]');
  await writeFile(path.join(root,'dist','index.html'),'<h1>Local</h1>');
  const port=await freePort();const start=path.join(root,'Start-Workbench.ps1'),stop=path.join(root,'Stop-Workbench.ps1');
  t.after(async()=>{await run(stop);await rm(root,{recursive:true,force:true});});
  return {root,port,start,stop,recordPath:path.join(root,'data','server-process.json')};
}

test('Windows launcher reuses its process, persists edits, and stop refuses an unrelated PID',{skip:process.platform!=='win32',timeout:60000},async t=>{
  const {port,start,stop,recordPath}=await launcherFixture(t);
  let result=await run(start,['-Port',String(port),'-NoBrowser']);assert.equal(result.code,0,result.output);
  const first=JSON.parse((await readFile(recordPath,'utf8')).replace(/^\uFEFF/,''));
  result=await run(start,['-Port',String(port),'-NoBrowser']);assert.equal(result.code,0,result.output);
  const second=JSON.parse((await readFile(recordPath,'utf8')).replace(/^\uFEFF/,''));
  assert.equal(first.pid,second.pid);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status,200);
  const module=(await (await fetch(`http://127.0.0.1:${port}/api/modules`)).json()).items[0];
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/modules`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...module,owner:'重启后保留'})})).status,200);
  await writeFile(recordPath,JSON.stringify({...first,pid:process.pid}));
  result=await run(stop);assert.notEqual(result.code,0,'must refuse unrelated PID');
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status,200);
  await writeFile(recordPath,JSON.stringify(first));
  result=await run(stop);assert.equal(result.code,0,result.output);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));
  result=await run(start,['-Port',String(port),'-NoBrowser']);assert.equal(result.code,0,result.output);
  const reloaded=(await (await fetch(`http://127.0.0.1:${port}/api/modules`)).json()).items[0];
  assert.equal(reloaded.owner,'重启后保留');
  result=await run(stop);assert.equal(result.code,0,result.output);
  const unrelated=net.createServer();await new Promise(r=>unrelated.listen(port,'127.0.0.1',r));
  try {result=await run(start,['-Port',String(port),'-NoBrowser']);assert.notEqual(result.code,0,'occupied port must not start a replacement server');assert.equal(unrelated.listening,true);}finally{await new Promise(r=>unrelated.close(r));}
});

test('Windows launcher replaces moved-folder and reused-PID records without stopping foreign processes',{skip:process.platform!=='win32',timeout:60000},async t=>{
  const {root,port,start,stop,recordPath}=await launcherFixture(t);
  await mkdir(path.join(root,'data'));
  const currentScript=path.join(root,'server','index.mjs');
  const foreign={pid:process.pid,port,executable:process.execPath,startedAtTicks:'0',script:currentScript};
  for(const script of [path.join(root,'old-folder','server','index.mjs'),currentScript]){
    await writeFile(recordPath,JSON.stringify({...foreign,script}));
    let result=await run(start,['-Port',String(port),'-NoBrowser']);
    assert.equal(result.code,0,result.output);
    const fresh=JSON.parse((await readFile(recordPath,'utf8')).replace(/^\uFEFF/,''));
    assert.notEqual(fresh.pid,process.pid);
    assert.equal(fresh.script,currentScript);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status,200);
    result=await run(stop);assert.equal(result.code,0,result.output);
  }
  await writeFile(recordPath,JSON.stringify(foreign));
  const unrelated=net.createServer();await new Promise(r=>unrelated.listen(port,'127.0.0.1',r));
  try{
    const result=await run(start,['-Port',String(port),'-NoBrowser']);
    assert.notEqual(result.code,0,'stale records must not bypass an occupied port');
    assert.equal(unrelated.listening,true);
    assert.equal(JSON.parse(await readFile(recordPath,'utf8')).pid,process.pid);
  }finally{await new Promise(r=>unrelated.close(r));}
});
