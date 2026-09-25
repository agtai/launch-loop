import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=path.join(root,'tmp','mvp-validation',new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(folder,{recursive:true});
const checks=[['install','npm',['ci']],['build','npm',['run','build']],['tests','npm',['test']],['candidate',process.execPath,['--test','skill-preparation/linkedin-text/tests/contracts.test.mjs']],['linkedin-config',process.execPath,['server/linkedin-preflight.mjs']]];
const results=[];
for(const [name,command,args]of checks){
  const startedAt=new Date().toISOString();let output='';
  const code=await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,shell:command==='npm'&&process.platform==='win32',windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b.toString('utf8'));child.stderr.on('data',b=>output+=b.toString('utf8'));child.once('error',reject);child.once('close',resolve);});
  writeFileSync(path.join(folder,`${name}.log`),output);
  const externalDependency = name === 'linkedin-config' && code === 1;
  results.push({name,code,status:externalDependency?'dependency_missing':code===0?'passed':'failed',startedAt,finishedAt:new Date().toISOString(),evidence:`${name}.log`});
  writeFileSync(path.join(folder,'results.json'),JSON.stringify({scope:'Local regression only. Model and platform tests use explicit substitutes. Real browser/model/image/OAuth/publishing evidence is recorded separately.',results},null,2));
  console.log(`${name}: ${externalDependency?'DEPENDENCY MISSING (OAuth not verified)':code===0?'PASS':'FAIL'} (${path.relative(root,path.join(folder,`${name}.log`))})`);
  if(code!==0){console.error(output.slice(-5000));process.exitCode=1;break;}
}
console.log(`Evidence: ${path.relative(root,folder)}`);
