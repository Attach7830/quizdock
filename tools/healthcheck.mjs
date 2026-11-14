// Read-only live probe. Never logs users, asks for a sign-in code, or writes application data.
import {RELEASE} from '../src/release.js';
import {pathToFileURL} from 'node:url';
export async function checkHealth(base,expected=RELEASE,request=fetch){
 const url=new URL(base);if(url.protocol!=='https:')throw new Error('Health checks require HTTPS.');
 // Cloudflare serves HTML at canonical extensionless routes; .html is a normal 307 redirect.
 const results=[];
 for(const [path,type] of [['/api/health','json'],['/','html'],['/play','html'],['/data','html'],['/platform.css','css'],['/js/app.js','javascript']]){
  const response=await request(new URL(path,url),{headers:{'cache-control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
  const mime=response.headers.get('content-type')||'';if(!mime.includes(type))throw new Error(`${path}: unexpected response type`);
  if(type==='json'){const data=await response.json();if(data.app!=='QuizDock'||data.ok!==true||data.release!==expected)throw new Error(`Expected release ${expected} and ready storage bindings.`);}
  else{const body=await response.text();if(!body.trim())throw new Error(`${path}: empty response`);}
  results.push({path,ok:true});
 }
 return {ok:true,release:expected,checks:results.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const base=process.env.QUIZDOCK_URL||'https://quizdock.iwesterbeck.workers.dev';
 try{console.log(JSON.stringify(await checkHealth(base),null,2));}catch(error){console.error(`QuizDock health check failed: ${error.message}`);process.exitCode=1;}
}
