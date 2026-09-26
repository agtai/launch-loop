import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createContentStore } from './content-store.mjs';
import { ContentError } from './content-validation.mjs';
import { serveContent } from './content-http.mjs';
import { createGenerationService } from './generation-service.mjs';
import { serveGeneration } from './generation-http.mjs';
import { createPublishingStore } from './publishing-store.mjs';
import { createLinkedInService } from './linkedin-service.mjs';
import { servePublishing } from './publishing-http.mjs';
import { acquireDataLease } from './runtime-lease.mjs';
import { createXPublishingStore } from './x-publishing-store.mjs';
import { createXService } from './x-service.mjs';
import { serveX } from './x-http.mjs';
import { serveXImages } from './x-image-http.mjs';
import { createXImageService } from './x-image-service.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleIds = ['research','creation','review','publishing','feedback'];
const moduleFields = ['id','owner','status','input','steps','output','acceptance','tools','notes','resultUrl','revision','updatedAt'];
const taskFields = ['id','owner','status','notes','resultUrl','revision','updatedAt'];
const maxBody = 2 * 1024 * 1024;
const maxRestoreBody = 16 * 1024 * 1024;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.webp':'image/webp','.jpg':'image/jpeg'};
class RequestError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail = (message,status=400) => { throw new RequestError(status,message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateItem(value, kind, ids) {
  if (!object(value)) fail('提交的数据必须是对象。');
  const fields=kind==='modules'?moduleFields:taskFields;
  if (Object.keys(value).length!==fields.length || fields.some(key=>!Object.hasOwn(value,key)) || Object.keys(value).some(key=>!fields.includes(key))) fail('字段不完整或包含无法识别的字段，请刷新后重试。');
  if (typeof value.id!=='string' || !ids.includes(value.id)) fail('找不到该模块或任务。');
  if (!Number.isSafeInteger(value.revision) || value.revision<0 || value.revision>=Number.MAX_SAFE_INTEGER) fail('数据版本无效，请刷新后重试。');
  if (value.updatedAt!==null && (typeof value.updatedAt!=='string' || value.updatedAt.length>40 || !Number.isFinite(Date.parse(value.updatedAt)))) fail('更新时间无效。');
  const statuses=kind==='modules'?['待补充','待试跑','进行中','已跑通']:['待开始','进行中','待验收','已完成'];
  if (!statuses.includes(value.status)) fail('请选择有效的状态。');
  const limits={owner:120,notes:20000,resultUrl:2048,input:20000,output:20000,acceptance:20000,tools:4000};
  for(const [key,max] of Object.entries(limits)) if(fields.includes(key) && (typeof value[key]!=='string'||value[key].length>max)) fail(`${key} 字段类型不正确或过长（最多 ${max} 字）。`);
  if(kind==='modules' && (!Array.isArray(value.steps)||value.steps.length>50||value.steps.some(s=>typeof s!=='string'||s.length>4000))) fail('操作步骤最多 50 条，每条最多 4000 字。');
  if(value.resultUrl){let url;try{url=new URL(value.resultUrl);}catch{fail('成果链接必须是完整的 http 或 https 地址。');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('成果链接仅支持不含账号密码的 http 或 https 地址。');}
  return Object.fromEntries(fields.map(key=>[key,value[key]]));
}

function readSeed(seedDir,name){const raw=JSON.parse(readFileSync(path.join(seedDir,`${name}.json`),'utf8'));const list=Array.isArray(raw)?raw:raw.items;if(!Array.isArray(list))throw new Error(`${name}.json 必须包含数组。`);return list;}

function createStore(dataDir,seedDir){
  mkdirSync(dataDir,{recursive:true});
  const backupsDir=path.join(dataDir,'backups');
  const modules=readSeed(seedDir,'modules');
  if(modules.length!==moduleIds.length||new Set(modules.map(m=>m.id)).size!==moduleIds.length)throw new Error('模块种子数据不完整。');
  const seeds=modules.map(m=>validateItem(m,'modules',moduleIds));
  const taskIds=readSeed(seedDir,'tasks').map(t=>t.id);
  if(taskIds.length>1000||new Set(taskIds).size!==taskIds.length||taskIds.some(id=>typeof id!=='string'||!id||id.length>120||!/^[-a-zA-Z0-9_]+$/.test(id)))throw new Error('任务种子数据包含无效或重复 ID。');
  const ids={modules:moduleIds,tasks:taskIds};
  const db=new DatabaseSync(path.join(dataDir,'workbench.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(kind,id));');
  const insert=db.prepare('INSERT OR IGNORE INTO records (kind,id,payload,revision) VALUES (?,?,?,?)');
  for(const item of seeds)insert.run('modules',item.id,JSON.stringify(item),item.revision);
  for(const id of taskIds){const item={id,owner:'',status:'待开始',notes:'',resultUrl:'',revision:0,updatedAt:null};insert.run('tasks',id,JSON.stringify(item),0);}
  const select=db.prepare('SELECT payload FROM records WHERE kind=? AND id=?');
  const get=(kind,id)=>JSON.parse(select.get(kind,id).payload);
  const list=kind=>ids[kind].map(id=>get(kind,id));
  let content,publishing,xPublishing;
  const exportAll=()=>{
    const backup={app:'content-workbench-local',version:1,exportedAt:new Date().toISOString(),modules:list('modules'),tasks:list('tasks'),content:content.exportAll(),publishing:publishing.exportAll(),xPublishing:xPublishing.exportAll()};
    if(Buffer.byteLength(JSON.stringify(backup),'utf8')>maxRestoreBody)fail('完整备份超过 16 MiB，操作已拒绝；请减少本次新增内容或素材后重试。',413);
    return backup;
  };
  function backup(){
    db.exec('BEGIN');
    try{const value=exportAll();db.exec('COMMIT');return value;}
    catch(error){db.exec('ROLLBACK');throw error;}
  }
  function snapshot(type){
    mkdirSync(backupsDir,{recursive:true});
    const date=new Date().toISOString();
    const filename=type==='daily'?`daily-${date.slice(0,10)}.json`:`pre-restore-${date.replaceAll(':','-')}-${randomUUID()}.json`;
    const destination=path.join(backupsDir,filename);
    if(type==='daily'&&existsSync(destination))return;
    writeFileSync(destination,JSON.stringify(exportAll()),{encoding:'utf8',flag:'wx'});
    const own=type==='daily'?/^daily-\d{4}-\d{2}-\d{2}\.json$/:/^pre-restore-\d{4}-\d{2}-\d{2}T[\d.-]+Z-[a-f0-9-]{36}\.json$/;
    const files=readdirSync(backupsDir).filter(name=>own.test(name)).sort().reverse();
    for(const name of files.slice(type==='daily'?30:20))unlinkSync(path.join(backupsDir,name));
  }
  content=createContentStore(db,dataDir,{snapshot,checkBackupSize:()=>exportAll()});
  publishing=createPublishingStore(db,{snapshot,checkBackupSize:()=>exportAll(),content});
  xPublishing=createXPublishingStore(db,{snapshot,checkBackupSize:()=>exportAll()});
  const update=db.prepare('UPDATE records SET payload=?,revision=? WHERE kind=? AND id=? AND revision=?');
  function save(kind,raw){
    const item=validateItem(raw,kind,ids[kind]);
    db.exec('BEGIN IMMEDIATE');
    try{
      if(get(kind,item.id).revision!==item.revision)fail('这条记录已在其他页面更新。请重新载入最新内容后再保存。',409);
      snapshot('daily');
      if(item.revision>=Number.MAX_SAFE_INTEGER-1)fail('记录版本达到安全整数上限，未保存。');
      const next={...item,revision:item.revision+1,updatedAt:new Date().toISOString()};
      const result=update.run(JSON.stringify(next),next.revision,kind,item.id,item.revision);
      if(result.changes!==1)fail('这条记录已被更新，请重新载入后再保存。',409);
      exportAll();
      db.exec('COMMIT');
      return next;
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function restore(raw){
    if(!object(raw)||raw.app!=='content-workbench-local'||raw.version!==1||typeof raw.exportedAt!=='string'||!Number.isFinite(Date.parse(raw.exportedAt)))fail('这不是兼容的本地工作台备份（版本 1）。');
    if(Object.keys(raw).some(key=>!['app','version','exportedAt','modules','tasks','content','publishing','xPublishing'].includes(key)))fail('备份包含无法识别的字段。');
    const validated={};
    for(const kind of ['modules','tasks']){
      if(!Array.isArray(raw[kind])||raw[kind].length!==ids[kind].length)fail('备份记录数量与当前工作台不符，未更改现有数据。');
      validated[kind]=raw[kind].map(item=>validateItem(item,kind,ids[kind]));
      if(new Set(validated[kind].map(item=>item.id)).size!==ids[kind].length)fail('备份有重复或缺失记录，未更改现有数据。');
    }
    const validatedContent=content.validateBackup(raw.content);
    publishing.assertCanRestore();
    const validatedPublishing=publishing.validateBackup(raw.publishing);
    xPublishing.assertCanRestore();
    const validatedXPublishing=xPublishing.validateBackup(raw.xPublishing);
    db.exec('BEGIN IMMEDIATE');
    try{
      content.validateBackup(raw.content);
      publishing.assertCanRestore();
      publishing.validateBackup(raw.publishing);
      xPublishing.assertCanRestore();
      xPublishing.validateBackup(raw.xPublishing);
      snapshot('daily');snapshot('pre-restore');
      const now=new Date().toISOString();
      for(const kind of ['modules','tasks'])for(const item of validated[kind]){
        const previous=get(kind,item.id);if(previous.revision>=Number.MAX_SAFE_INTEGER-1)fail('记录版本达到安全整数上限，未恢复。');const next={...item,revision:previous.revision+1,updatedAt:now};
        update.run(JSON.stringify(next),next.revision,kind,item.id,previous.revision);
      }
      content.restore(validatedContent);
      publishing.restore(validatedPublishing);
      xPublishing.restore(validatedXPublishing);
      exportAll();
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return {ok:true,modules:list('modules'),tasks:list('tasks'),content:{items:content.list()},publishing:{items:publishing.list()}};
  }
  return {list,save,restore,backup,content,publishing,xPublishing,close:()=>db.close()};
}

async function readBody(req,limit=maxBody){
  if((req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')fail('请使用 JSON 格式提交数据。',415);
  const sizeMessage=`提交内容超过 ${limit/(1024*1024)} MiB，请缩小后重试。`;
  if(Number(req.headers['content-length'])>limit)fail(sizeMessage,413);
  const chunks=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>limit)fail(sizeMessage,413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('JSON 数据无法解析，请检查备份文件。');}
}
function json(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));}

export async function startServer({port=4318,dataDir=process.env.DATA_DIR||path.join(projectDir,'data'),seedDir=path.join(projectDir,'data-seed'),distDir=path.join(projectDir,'dist'),generationOptions={},linkedInOptions={},xOptions={},xImageOptions={}}={}){
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('端口号无效。');
  const releaseLease=await acquireDataLease(path.resolve(dataDir));
  let store;
  try{store=createStore(path.resolve(dataDir),path.resolve(seedDir));}
  catch(error){await releaseLease();throw error;}
  let generation,linkedin,x,xImages,imageScheduleEpoch=0,stoppingImages=false;
  const imageSchedules=new Set();
  function scheduleXImages(tmpIds,finalTexts=[]){
    const epoch=imageScheduleEpoch;
    const revisions=new Map(finalTexts.map(({tmpId,revision})=>[tmpId,revision]));
    const tasks=tmpIds.map(async tmpId=>{
      let current=store.content.readTmp(tmpId),expectedRevision=revisions.get(tmpId);
      if(current.stale||current.confirmed||current.revision!==expectedRevision)return;
      const documentIds=current.content.documents.map(doc=>doc.id);
      for(const documentId of documentIds){
        if(stoppingImages||imageScheduleEpoch!==epoch)return;
        current=store.content.readTmp(tmpId);
        if(current.stale||current.confirmed||current.revision!==expectedRevision)return;
        const doc=current.content.documents.find(item=>item.id===documentId);
        const job=xImages.create({requestId:randomUUID(),tmpId,revision:current.revision,documentId,mode:doc.blocks[0]?.assetIds?.length?'check':'generate'});
        const result=await xImages.wait(job.id);
        if(result.status!=='ready')return;
        expectedRevision=result.resultRevision;
      }
    });
    const completion=Promise.allSettled(tasks);
    imageSchedules.add(completion);void completion.finally(()=>imageSchedules.delete(completion));
  }
  try{
    xImages=createXImageService({content:store.content,dataDir:path.resolve(dataDir),...xImageOptions});
    const imagesEnabled=(xImageOptions.env??process.env).LAUNCH_LOOP_IMAGE_PROVIDER==='codex-cache';
    generation=await createGenerationService({content:store.content,dataDir:path.resolve(dataDir),...(imagesEnabled?{onXReady:scheduleXImages,xImageCapabilities:()=>xImages.capabilities()}:{}),...generationOptions});
    linkedin=await createLinkedInService({store:store.publishing,content:store.content,dataDir:path.resolve(dataDir),...linkedInOptions});
    x=await createXService({store:store.xPublishing,content:store.content,...xOptions});
  }catch(error){stoppingImages=true;await generation?.close();await xImages?.close();await linkedin?.close();await x?.close();await Promise.allSettled([...imageSchedules]);store.close();await releaseLease();throw error;}
  const publicDir=path.resolve(distDir);
  let actualPort=port,closing=null;
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try{
      const allowedHosts=[`127.0.0.1:${actualPort}`,`localhost:${actualPort}`];
      if(!allowedHosts.includes(req.headers.host))fail('仅允许本机访问工作台。',403);
      if(!req.url?.startsWith('/'))fail('请求地址无效。');
      const pathname=req.url.split('?')[0];
      if(pathname==='/api'||pathname.startsWith('/api/')){
        const oauthCallback=req.method==='GET'&&['/api/linkedin/callback','/api/x/callback'].includes(pathname);
        if(!oauthCallback&&(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)))fail('已拒绝来自其他网站的请求，请从本地工作台页面操作。',403);
        if(req.method==='GET'&&pathname==='/api/health')return json(res,200,{app:'content-workbench-local',version:1});
        if(req.method==='GET'&&pathname==='/api/backup')return json(res,200,store.backup(),{'Content-Disposition':`attachment; filename="workbench-backup-${new Date().toISOString().slice(0,10)}.json"`});
        if(pathname==='/api/content'||pathname.startsWith('/api/content/'))return await serveContent(req,res,pathname,store.content,{readBody,json});
        if(pathname==='/api/generation'||pathname.startsWith('/api/generation/'))return await serveGeneration(req,res,pathname,generation,{readBody,json});
        if(pathname.startsWith('/api/linkedin/')||pathname.startsWith('/api/publishing/'))return await servePublishing(req,res,pathname,linkedin,{readBody,json});
        if(pathname.startsWith('/api/x/'))return await serveX(req,res,pathname,x,{readBody,json});
        if(pathname.startsWith('/api/x-images/'))return await serveXImages(req,res,pathname,store.content,{readBody,json,imageService:xImages});
        for(const kind of ['modules','tasks'])if(pathname===`/api/${kind}`){
          if(req.method==='GET')return json(res,200,{items:store.list(kind)});
          if(req.method==='PUT')return json(res,200,{item:store.save(kind,await readBody(req))});
          fail('此操作不支持该请求方式。',405);
        }
        if(pathname==='/api/restore'){
          if(req.method!=='POST')fail('恢复备份请使用 POST。',405);
          const restored=store.restore(await readBody(req,maxRestoreBody));
          imageScheduleEpoch++;
          await Promise.all([generation.interruptAll(),xImages.interruptAll()]);
          await Promise.allSettled([...imageSchedules]);
          return json(res,200,restored);
        }
        fail('找不到这个接口。',404);
      }
      if(!['GET','HEAD'].includes(req.method))fail('静态页面仅支持读取。',405);
      let decoded;try{decoded=decodeURIComponent(pathname);}catch{fail('页面地址无法解析。');}
      if(decoded.includes('\0')||decoded.includes('\\')||decoded.split('/').some(part=>part==='..'||part.startsWith('.')))fail('无法访问该路径。',403);
      let filename=path.resolve(publicDir,`.${decoded}`);
      if(filename!==publicDir&&!filename.startsWith(publicDir+path.sep))fail('无法访问该路径。',403);
      if(!existsSync(filename)||!statSync(filename).isFile()){
        if(path.extname(filename))fail('找不到这个文件。',404);
        filename=path.join(publicDir,'index.html');
      }
      if(!existsSync(filename))fail('缺少已构建的界面文件，请使用完整的工作台文件夹。',503);
      const actual=realpathSync(filename),root=realpathSync(publicDir);
      if(!actual.startsWith(root+path.sep))fail('无法访问该路径。',403);
      res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:readFileSync(filename));
    }catch(error){const expected=error instanceof RequestError||error instanceof ContentError;if(!res.headersSent)json(res,expected?error.status:500,{error:expected?error.message:'本地数据操作失败，请查看 data/server-error.log 并重试。'});else res.end();if(!expected)console.error(error);}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve();});});}catch(error){stoppingImages=true;await Promise.all([generation.close(),xImages.close(),linkedin.close(),x.close()]);await Promise.allSettled([...imageSchedules]);store.close();await releaseLease();throw error;}
  actualPort=server.address().port;
  return {url:`http://127.0.0.1:${actualPort}`,port:actualPort,close(){
    if(!closing)closing=(async()=>{
      const stopped=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      stoppingImages=true;imageScheduleEpoch++;
      await Promise.all([generation.close(),xImages.close(),linkedin.close(),x.close()]);
      await Promise.allSettled([...imageSchedules]);
      await stopped;
      store.close();
      await releaseLease();
    })();
    return closing;
  }};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const app=await startServer({port:Number(process.env.PORT||4318)});
    console.log(`本地内容工作台已启动：${app.url}`);
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
  }catch(error){console.error(error.code==='EADDRINUSE'?'4318 端口已被其他程序使用，请关闭冲突程序后重试。':`启动失败：${error.message}`);process.exitCode=1;}
}
