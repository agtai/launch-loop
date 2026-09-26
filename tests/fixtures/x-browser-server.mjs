// Explicitly synthetic, network-free browser acceptance fixture. Never real X.
import {startServer} from '../../server/index.mjs';
import {createHash} from 'node:crypto';
import {ContentError} from '../../server/content-validation.mjs';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const remote=new Map();let attempts=0,failed=false;
const fetchImpl=async(url,init={})=>{
  if(url.endsWith('/oauth2/token'))return json({access_token:'SYNTHETIC_TOKEN',token_type:'bearer',expires_in:7200,scope:'tweet.read tweet.write users.read media.write'});
  if(url.endsWith('/users/me'))return json({data:{id:'555',name:'SYNTHETIC · 浏览器测试账号',username:'synthetic_only'}});
  if(url.endsWith('/tweets')){
    attempts++;const body=JSON.parse(init.body);
    if(attempts===2&&!failed){failed=true;return json({},422);}
    const id=String(5000+attempts);remote.set(id,{id,author_id:'555',text:body.text,referenced_tweets:body.reply?[{type:'replied_to',id:body.reply.in_reply_to_tweet_id}]:[]});
    return json({data:{id,text:body.text}},201);
  }
  if(url.includes('/tweets/'))return json({data:remote.get(new URL(url).pathname.split('/').at(-1))});
  throw Error('Synthetic fixture rejects all other remote calls');
};
const docs=language=>[
  {id:'post',kind:'post',title:'',postingNote:'',blocks:[{id:'single',type:'x_post',text:language==='en'?'SYNTHETIC: Draft locally, check every post, then save. Publishing requires another confirmation.':'合成验收：本机写稿、逐条检查，再确认保存。发布需要另一次确认。'}]},
  {id:'thread',kind:'thread',title:'',postingNote:'',blocks:(language==='en'?['SYNTHETIC 1/3: Inspect this local draft.','SYNTHETIC 2/3: Saving creates an immutable version.','SYNTHETIC 3/3: Confirm the selected thread separately before publishing.']:['合成验收 1/3：先查看本机草稿。','合成验收 2/3：确认保存后保留不可变版本。','合成验收 3/3：选择串帖并另行确认，才会发布。']).map((text,index)=>({id:'thread-'+index,type:'x_post',text}))}
];
const runner=async({stage,payload})=>{
  if(stage==='mother')return{sourceLanguage:'en',reason:'Synthetic English input',spine:'Drafts need confirmation.',editorialPlan:'Describe separate draft/save/publish actions.',text:'SYNTHETIC local drafting requires confirmation.',claimLedger:[{id:'c1',proposition:'Drafts require confirmation.',attribution:'Synthetic supplied source',qualifications:'Test only',status:'supported',sourceIds:['brief-materials']}],termLedger:[],unresolved:[]};
  if(stage==='adaptation')return{documents:docs('en'),unresolved:[]};
  if(stage==='localization')return{documents:docs(payload.language),unresolved:[]};
  if(stage==='review')return{summary:'SYNTHETIC single review of complete content pack.',findings:[],unresolved:[]};
  if(stage==='revision')return{documents:payload.initialDocuments,resolvedFindingIds:[],unresolved:[]};
  if(stage==='modification')return{replacement:'SYNTHETIC revised selection',unresolved:[]};
  throw Error('Unexpected synthetic stage');
};
const syntheticImage=async({documents,bodyHash,signal,onProgress})=>{
  await new Promise(resolve=>setTimeout(resolve,6000));
  if(signal?.aborted)throw new ContentError(409,'Synthetic image cancelled');
  onProgress?.({stage:'checking'});
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=','base64');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(JSON.stringify(documents).includes('FAIL_IMAGE'))throw new ContentError(502,'SYNTHETIC image failure: text retained');
  return {status:'ready',bytes,mimeType:'image/png',width:1,height:1,sha256,bodyHash,visualCheck:{status:'passed',method:'codex-image-input',bodyHash,imageHash:sha256,observed:'SYNTHETIC pixel, only for testing image association.',findings:[]},source:{provider:'test-fixture'}};
};
const app=await startServer({port:Number(process.env.PORT),dataDir:process.env.DATA_DIR,generationOptions:{testOnlyRunner:runner},xImageOptions:{env:{LAUNCH_LOOP_IMAGE_PROVIDER:'codex-cache'},testOnlyGenerate:syntheticImage,testOnlyCheck:syntheticImage,testOnlyProbe:async()=>({available:true,status:'ready',reason:'SYNTHETIC image backend for browser tests only'})},xOptions:{env:{X_CLIENT_ID:'SYNTHETIC',X_REDIRECT_URI:'https://example.test/api/x/callback'},fetchImpl}});
const start=await(await fetch(app.url+'/api/x/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
const state=new URL(start.authorizationUrl).searchParams.get('state');
await fetch(app.url+'/api/x/callback?state='+state+'&code=SYNTHETIC',{redirect:'manual'});
console.log('Synthetic browser fixture: '+app.url);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
