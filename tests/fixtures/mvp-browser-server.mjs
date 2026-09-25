// Deliberate browser-acceptance harness. Copied only into tmp/mvp-synthetic;
// all model and LinkedIn calls are substitutes, never production endpoints.
import {startServer} from './workbench-original.mjs';
import {textV2Fixture} from '../tests/fixtures/text-v2-fixture.mjs';
import {hash,ContentError} from './content-validation.mjs';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ZkAAAAASUVORK5CYII=','base64');
const pause=(signal,ms=600)=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('Synthetic cancellation'));},{once:true});});
const failedReviewInputs=new Set();
const app=await startServer({port:Number(process.env.PORT||4349),generationOptions:{
  testOnlyRunner:async args=>{const data=JSON.stringify(args.payload);await pause(args.signal,data.includes('SYNTHETIC_SLOW')?10000:600);if(data.includes('SYNTHETIC_TIMEOUT'))throw new ContentError(504,'SYNTHETIC: controlled timeout fixture; no real model call.');if(args.stage==='review'&&data.includes('SYNTHETIC_REVIEW_RESUME_FAIL')&&!failedReviewInputs.has(args.payload.inputHash)){failedReviewInputs.add(args.payload.inputHash);throw new ContentError(504,'SYNTHETIC: first review failure; frozen drafts retained.');}if(args.stage==='modification')return {replacement:'A synthetic candidate, still a planned pilot.',unresolved:[],changesSharedFacts:true,impactReason:'Synthetic cross-language warning fixture.',changedClaimIds:['claim1']};return textV2Fixture(args);},
  testOnlyImageRunner:async args=>{await pause(args.signal);if(JSON.stringify(args.context).includes('SYNTHETIC_IMAGE_FAIL'))throw Error('SYNTHETIC: image failure fixture; text is retained.');return {status:'ready',bytes:image,file:'SYNTHETIC-one-pixel.png',mimeType:'image/png',width:1,height:1,sha256:hash(image),bodyHash:args.bodyHash,visualCheck:{status:'passed',checkedAt:new Date().toISOString(),observed:'SYNTHETIC fixture only; not real visual inspection.'}};},
},linkedInOptions:{env:{LINKEDIN_CLIENT_ID:'SYNTHETIC_CLIENT',LINKEDIN_CLIENT_SECRET:'SYNTHETIC_NOT_A_SECRET',LINKEDIN_REDIRECT_URI:'https://callback.example.test/api/linkedin/callback'},fetchImpl:async(url,init)=>{
  const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
  if(url.endsWith('/accessToken'))return json({access_token:'SYNTHETIC_TOKEN',expires_in:String(init.body).includes('SYNTHETIC_EXPIRED')?1:3600,scope:'openid profile w_member_social'});
  if(url.endsWith('/userinfo'))return json({sub:'synthetic-member',name:'SYNTHETIC TEST ACCOUNT'});
  if(url.includes('/rest/images?'))return json({value:{image:'urn:li:image:SYNTHETIC_IMAGE',uploadUrl:'https://www.linkedin.com/dms-uploads/synthetic'}});
  if(url.includes('/dms-uploads/'))return new Response(null,{status:201});
  if(url==='https://api.linkedin.com/rest/posts')return String(init.body).replaceAll('\\','').includes('SYNTHETIC_UNKNOWN')?json({},503):json({},201,{'x-restli-id':'urn:li:share:900000000000001'});
  throw Error('Unexpected synthetic request; external networking is disabled.');
}}});
console.log(`SYNTHETIC BROWSER ACCEPTANCE ONLY: ${app.url}`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
