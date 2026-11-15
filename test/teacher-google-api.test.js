// Full gateway/account-service tests. Google supplies a test-only RSA signature;
// no external Google account or email sender is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherLibrary} from '../src/library-service.js';
import gateway from '../src/library-worker.js';
import {context, namespace, internal} from './memory-runtime.js';
import {googleClientId, googleJwk, googleToken} from './google-fixture.js';
import {hash,uid} from '../src/library-domain.js';
const cookie=(r,name)=>r.headers.getSetCookie().find(v=>v.startsWith(name+'='))?.split(';')[0]||'';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>String(url)==='https://www.googleapis.com/oauth2/v3/certs'?Response.json({keys:[googleJwk]},{headers:{'cache-control':'max-age=3600'}}):originalFetch(url,options);
function fixture(){
 const config={TEACHER_EMAILS:'teacher@gmail.com',GOOGLE_CLIENT_ID:googleClientId};
 const ctx=context(),library=new TeacherLibrary(ctx,config),env={TEACHER_LIBRARY:namespace(library)};
 const web=(action,p={},cookies='',origin='https://q.test',method='POST')=>gateway.fetch(new Request('https://q.test/api/library/'+action,{method,headers:{origin,'content-type':'application/json',cookie:cookies},...(method==='GET'?{}:{body:JSON.stringify(p)})}),env);
 return {ctx,library,config,web};
}
async function start(f){const response=await f.web('google-start');assert.equal(response.status,200);return {response,...await response.json()};}
async function login(f){const a=await start(f);return f.web('google-signin',{challenge:a.challenge,credential:await googleToken(a.nonce,{email:'teacher@gmail.com'})},cookie(a.response,'__Host-quizdock-google-teacher'));}
test('teacher Google API issues a teacher session which opens the existing library and account home',async()=>{
 const f=fixture(),owner=await hash('teacher@gmail.com');await f.ctx.storage.put('index:'+owner+':example',{id:'example',title:'Existing list'});
 const result=await login(f);assert.equal(result.status,200);const session=cookie(result,'__Host-quizdock-library');assert.ok(session);
 const lists=await f.web('lists',{},session);assert.equal(lists.status,200);assert.equal((await lists.json()).lists[0].title,'Existing list');
 const status=await(await f.web('status',{},session)).json();assert.equal(status.user.role,'teacher');assert.equal(status.configured,false);assert.equal(status.googleConfigured,true);
 const token=session.split('=')[1],home=await f.library.fetch(internal('academy:home',{},token));assert.equal(home.status,200);assert.equal((await home.json()).user.id,owner);
});
test('teacher Google gateway overrides forged browser nonce and ignores untrusted identity fields',async()=>{
 const f=fixture(),a=await start(f),payload={challenge:a.challenge,credential:await googleToken(a.nonce,{email:'teacher@gmail.com'}),browserNonce:a.nonce,identity:{email:'teacher@gmail.com',authoritativeEmail:true}};
 assert.equal((await f.web('google-signin',payload)).status,401);
 assert.equal((await f.web('google-signin',payload,cookie(a.response,'__Host-quizdock-google-teacher'), 'https://evil.test')).status,403);
 assert.equal((await f.web('google-signin',{...payload,credential:await googleToken(a.nonce,{email:'student@gmail.com'})},cookie(a.response,'__Host-quizdock-google-teacher'))).status,403);
 assert.equal((await f.ctx.storage.list({prefix:'session:'})).size,0);
});
test('teacher Google requests require same origin and POST, not navigation or cross-site form submissions',async()=>{
 const f=fixture();assert.equal((await f.web('google-start',{},'','https://evil.test')).status,403);assert.equal((await f.web('google-start',{},'','https://q.test','GET')).status,405);
});
test('teacher verification limits invalid attempts before any Google signature verification',async()=>{
 const f=fixture(),a=await start(f),cookies=cookie(a.response,'__Host-quizdock-google-teacher');
 for(let i=0;i<60;i++)assert.equal((await f.web('google-signin',{challenge:a.challenge,credential:'invalid'},cookies)).status,401);
 assert.equal((await f.web('google-signin',{challenge:a.challenge,credential:await googleToken(a.nonce,{email:'teacher@gmail.com'})},cookies)).status,429);
 assert.equal((await f.ctx.storage.list({prefix:'session:'})).size,0);
});
test('concurrent reuse of a teacher Google challenge only creates one session',async()=>{
 const f=fixture(),a=await start(f),p={challenge:a.challenge,credential:await googleToken(a.nonce,{email:'teacher@gmail.com'})},cookies=cookie(a.response,'__Host-quizdock-google-teacher');
 const results=await Promise.all([f.web('google-signin',p,cookies),f.web('google-signin',p,cookies)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);assert.equal((await f.ctx.storage.list({prefix:'session:'})).size,1);
});
test('removing a Google-authenticated teacher from the allowlist revokes library access',async()=>{
 const f=fixture(),r=await login(f),session=cookie(r,'__Host-quizdock-library');f.config.TEACHER_EMAILS='another@gmail.com';assert.equal((await f.web('lists',{},session)).status,401);
});
test('teacher email OTP fallback still works after adding Google sign-in',async()=>{
 const f=fixture();f.config.RESEND_API_KEY='test-email-key';f.config.EMAIL_FROM='login@example.com';const old=globalThis.fetch;let code;
 globalThis.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails'){code=JSON.parse(options.body).text.match(/\b\d{6}\b/)[0];return Response.json({id:'test-email'});}return old(url,options);};
 try {const r=await f.web('login-request',{email:'teacher@gmail.com'});assert.equal(r.status,200);const {challenge}=await r.json();const verified=await f.web('login-verify',{email:'teacher@gmail.com',challenge,code});assert.equal(verified.status,200);assert.ok(cookie(verified,'__Host-quizdock-library'));}finally{globalThis.fetch=old;}
});
test('teacher challenge cleanup preserves account data and student Google challenges',async()=>{
 const f=fixture();await f.ctx.storage.put({'google-teacher-login:expired':{expiresAt:0},'google-login:student-active':{expiresAt:Date.now()+600000},'account:keep':{name:'Keep me'}});
 await f.library.alarm();assert.equal(await f.ctx.storage.get('google-teacher-login:expired'),undefined);assert.ok(await f.ctx.storage.get('google-login:student-active'));assert.deepEqual(await f.ctx.storage.get('account:keep'),{name:'Keep me'});
});
