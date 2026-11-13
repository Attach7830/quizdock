import legacy from './worker.js';
export {QuizRoom} from './worker.js';
export {TeacherLibrary} from './library-service.js';
const actions=new Set(['status','login-request','login-verify','logout','lists','get','save','duplicate','delete','snapshot','rounds','round','delete-round']);
const failure=(error,status)=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const token=request=>(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-quizdock-library='))?.slice('__Host-quizdock-library='.length)||'';
async function payload(request){if(Number(request.headers.get('content-length')||0)>150000)throw new Error('Request exceeds 150 KB.');const s=await request.text();if(new TextEncoder().encode(s).length>150000)throw new Error('Request exceeds 150 KB.');const d=JSON.parse(s);if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('JSON object required.');return d;}
function call(env,request,action,data){return env.TEACHER_LIBRARY.get(env.TEACHER_LIBRARY.idFromName('teachers')).fetch('https://library.internal/',{method:'POST',body:JSON.stringify({action,payload:data,token:token(request),ip:request.headers.get('CF-Connecting-IP')||'local'})});}
function check(request,url){if(request.headers.get('origin')!==url.origin)return failure('Open QuizDock directly to send this request.',403);if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return failure('JSON required.',415);return null;}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),match=url.pathname.match(/^\/api\/library\/([a-z-]+)$/);
    if(match){
      if(request.method!=='POST')return failure('POST required.',405);
      const invalid=check(request,url);if(invalid)return invalid;
      if(!actions.has(match[1]))return failure('Unknown library endpoint.',404);
      if(!env.TEACHER_LIBRARY)return failure('Teacher library storage is not configured.',503);
      try{return await call(env,request,match[1],await payload(request));}catch{return failure('Invalid request or temporary storage error.',400);}
    }
    if(url.pathname==='/api/create'&&request.method==='POST'){
      const invalid=check(request,url);if(invalid)return invalid;
      if(!env.TEACHER_LIBRARY)return failure('Teacher library storage is not configured.',503);
      try{
        const data=await payload(request),auth=await call(env,request,'authorize-game',{});if(!auth.ok)return auth;
        const {owner}=await auth.json();let source=null,questions=data.questions,title=data.title;
        if(data.savedListId){
          const response=await call(env,request,'snapshot',{id:data.savedListId,revision:data.listRevision});if(!response.ok)return response;
          const snapshot=await response.json();questions=snapshot.questions;title=title||snapshot.title;source={id:snapshot.listId,revision:snapshot.listRevision,title:snapshot.title};
        }
        // Only server-supplied environment metadata may associate reports with a teacher.
        const headers=new Headers(request.headers);headers.delete('content-length');headers.set('content-type','application/json');
        return legacy.fetch(new Request(request.url,{method:'POST',headers,body:JSON.stringify({title,mode:data.mode,questions})}),{...env,__REPORT_CONTEXT:{owner,source}},ctx);
      }catch{return failure('The game could not read its questions or teacher account.',400);}
    }
    return legacy.fetch(request,env,ctx);
  }
};
