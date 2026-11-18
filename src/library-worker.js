import legacy from './worker.js';
import {DATA_ACTIONS} from './data-tools.js';
import {RELEASE} from './release.js';
import {gameSettings} from './academy-model.js';
export {QuizRoom} from './worker.js';
export {TeacherLibrary} from './library-service.js';
const libraryActions=new Set(['google-start','google-signin','status','login-request','login-verify','logout','lists','get','save','duplicate','delete','snapshot','rounds','round','delete-round']);
const academyActions=new Set(['google-start','google-signin','class-invite','status','login-request','login-verify','home','expedition-home','expedition-aquarium','expedition-hub','expedition-preset','expedition-hangar','practice-activity','join-class','create-class','class-detail','roster-add','roster-remove','class-close-enrollment','class-rotate-code','share-list','create-assignment','assignment-report','practice-open','practice-status','practice-answer','practice-next','practice-tick','practice-submit','solo-open','solo-save','solo-answer','study-rewards','study-rewards-settings','study-rewards-claim','practice-letter','buy-skin','equip-skin','buy-item','equip-item','remove-item','raffle-preview','raffle-draw','raffle-history']);
const failure=(error,status)=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const token=request=>(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-quizdock-library='))?.slice('__Host-quizdock-library='.length)||'';
async function payload(request,limit=150000){if(Number(request.headers.get('content-length')||0)>limit)throw new Error('Request exceeds 150 KB.');const s=await request.text();if(new TextEncoder().encode(s).length>limit)throw new Error('Request exceeds 150 KB.');const d=JSON.parse(s);if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('JSON object required.');return d;}
function call(env,request,action,data){return env.TEACHER_LIBRARY.get(env.TEACHER_LIBRARY.idFromName('teachers')).fetch('https://library.internal/',{method:'POST',body:JSON.stringify({action,payload:data,token:token(request),ip:request.headers.get('CF-Connecting-IP')||'local'})});}
function check(request,url){if(request.headers.get('origin')!==url.origin)return failure('Open QuizDock directly to send this request.',403);if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return failure('JSON required.',415);return null;}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname==='/api/health'&&request.method==='GET')return Response.json({ok:!!env.TEACHER_LIBRARY&&!!env.ROOMS,app:'QuizDock',release:RELEASE},{headers:{'cache-control':'no-store'}});
 const match=url.pathname.match(/^\/api\/(library|academy|data)\/([a-z-]+)$/);
 if(match){if(request.method!=='POST')return failure('POST required.',405);const bad=check(request,url);if(bad)return bad;
  if(!(match[1]==='library'?libraryActions:match[1]==='data'?new Set(DATA_ACTIONS):academyActions).has(match[2]))return failure('Unknown endpoint.',404);
  if(!env.TEACHER_LIBRARY)return failure('Account storage is not configured.',503);
  try{const data=await payload(request,match[1]==='data'&&match[2].startsWith('restore')?5_003_000:150000);
   if(match[1]==='academy'&&match[2]==='google-signin')data.browserNonce=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-quizdock-google='))?.slice('__Host-quizdock-google='.length)||'';
   if(match[1]==='library'&&match[2]==='google-signin')data.browserNonce=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-quizdock-google-teacher='))?.slice('__Host-quizdock-google-teacher='.length)||'';
   return await call(env,request,(match[1]==='library'?'':match[1]+':')+match[2],data);}catch{return failure('Invalid request or temporary storage error.',400);}
 }
 if(url.pathname==='/api/solo'&&request.method==='POST'){
  const bad=check(request,url);if(bad)return bad;
  try{const data=await payload(request),auth=await call(env,request,'solo-game-source',data);if(!auth.ok)return auth;const source=await auth.json();const headers=new Headers(request.headers);headers.delete('content-length');headers.set('content-type','application/json');const created=await legacy.fetch(new Request(url.origin+'/api/create',{method:'POST',headers,body:JSON.stringify({title:source.title,mode:data.mode,questions:source.questions,settings:{kind:'time',minutes:10,engagement:true}})}),{...env,__SOLO_CONTEXT:source.solo},ctx);if(!created.ok)return created;const {pin}=await created.json(),stub=env.ROOMS.get(env.ROOMS.idFromName(pin)),joined=await stub.fetch('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity:source.identity})});if(!joined.ok)return joined;return Response.json({pin,...await joined.json()},{headers:{'cache-control':'no-store'}});}catch(e){return failure(e.message||'Could not create a solo game.',400);}
 }
 if(url.pathname==='/api/create'&&request.method==='POST'){
  const bad=check(request,url);if(bad)return bad;if(!env.TEACHER_LIBRARY)return failure('Teacher library storage is not configured.',503);
  try{const data=await payload(request),auth=await call(env,request,'authorize-class-game',{classId:data.classId||null});if(!auth.ok)return auth;
   const {owner,classId}=await auth.json();let source=null,questions=data.questions,title=data.title;
   if(data.savedListId){const r=await call(env,request,'snapshot',{id:data.savedListId,revision:data.listRevision});if(!r.ok)return r;const s=await r.json();questions=s.questions;title=title||s.title;source={id:s.listId,revision:s.listRevision,title:s.title};}
   const settings=gameSettings(data.settings),headers=new Headers(request.headers);headers.delete('content-length');headers.set('content-type','application/json');
   return legacy.fetch(new Request(request.url,{method:'POST',headers,body:JSON.stringify({title,mode:data.mode,questions,settings})}),{...env,__REPORT_CONTEXT:{owner,source,classId}},ctx);
  }catch(e){return failure(e.message||'Game setup failed.',400);}
 }
 const join=url.pathname.match(/^\/api\/room\/(\d{6})\/join$/);
 if(join&&request.method==='POST'){
  const bad=check(request,url);if(bad)return bad;
  try{const data=await payload(request),stub=env.ROOMS.get(env.ROOMS.idFromName(join[1])),access=await stub.fetch('https://room.internal/access');if(!access.ok)return access;
   const {classId}=await access.json();const auth=await call(env,request,'authorize-join',{classId});if(!auth.ok)return auth;const {identity}=await auth.json();
   return stub.fetch('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({name:data.name,identity})});
  }catch{return failure('Unable to join. Sign in and confirm your class membership.',400);}
 }
 return legacy.fetch(request,env,ctx);
}};
