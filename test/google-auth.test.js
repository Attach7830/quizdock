import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyGoogleCredential} from '../src/google-auth.js';
import {TeacherLibrary} from '../src/library-service.js';
import {AcademyService} from '../src/academy-domain.js';
import gateway from '../src/library-worker.js';
import {hash,uid} from '../src/library-domain.js';
import {context,namespace,internal} from './memory-runtime.js';
import {googleClientId,googleJwk,googleToken} from './google-fixture.js';
const config={TEACHER_EMAILS:'teacher@example.com',EMAIL_FROM:'teacher@example.com',RESEND_API_KEY:'test',GOOGLE_CLIENT_ID:googleClientId};
const cookie = (response,name) => response.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]||'';
async function fixture(domain='') {
 const ctx=context(),library=new TeacherLibrary(ctx,config),token=uid(),owner=await hash('teacher@example.com');
 await ctx.storage.put('session:'+await hash(token),{email:'teacher@example.com',owner,issuedAt:Date.now(),expiresAt:Date.now()+60000});
 const call=(action,p={},auth=token)=>library.fetch(internal(action.startsWith('academy:')?action:'academy:'+action,p,auth));
 const klass=(await(await call('create-class',{name:'Invite class',emailDomain:domain})).json()).class;
 const env={TEACHER_LIBRARY:namespace(library)};
 const web=(action,p={},cookies='')=>gateway.fetch(new Request('https://q.test/api/academy/'+action,{method:'POST',headers:{origin:'https://q.test','content-type':'application/json',cookie:cookies},body:JSON.stringify(p)}),env);
 return {ctx,library,call,klass,web,owner};
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>String(url)==='https://www.googleapis.com/oauth2/v3/certs'?Response.json({keys:[googleJwk]},{headers:{'cache-control':'max-age=3600'}}):originalFetch(url,init);
async function login(f,email='new.student@example.com',code=f.klass.code,overrides={}) {
 const start=await f.web('google-start',{classCode:code});assert.equal(start.status,200);const body=await start.json();
 return {response:await f.web('google-signin',{challenge:body.challenge,credential:await googleToken(body.nonce,{email,...overrides})},cookie(start,'__Host-quizdock-google')),body};
}
test('Google RS256 signature and verified profile are validated',async()=>{
 const token=await googleToken('nonce');const profile=await verifyGoogleCredential(token,googleClientId,{jwks:[googleJwk]});
 assert.equal(profile.email,'new.student@example.com');assert.equal(profile.name,'Google Student');
 for(const overrides of [{aud:'other-client'},{azp:'other-client'},{iss:'https://evil.test'},{email_verified:false},{exp:0},{iat:Date.now()/1000+600},{sub:''}])
  await assert.rejects(verifyGoogleCredential(await googleToken('nonce',overrides),googleClientId,{jwks:[googleJwk]}));
 await assert.rejects(verifyGoogleCredential(await googleToken('nonce',{}, {alg:'none'}),googleClientId,{jwks:[googleJwk]}));
 const pieces=token.split('.');pieces[1]=Buffer.from(JSON.stringify({email:'forged@example.com'})).toString('base64url');
 await assert.rejects(verifyGoogleCredential(pieces.join('.'),googleClientId,{jwks:[googleJwk]}),/verified/);
});
test('class link enrolls a new Google student and collects the Google name without typed names',async()=>{
 const f=await fixture();const preview=await f.web('class-invite',{code:f.klass.code});assert.deepEqual(await preview.json(),{name:'Invite class'});
 const {response}=await login(f);assert.equal(response.status,200);
 const id=await hash('new.student@example.com'),account=await f.ctx.storage.get('account:'+id),member=await f.ctx.storage.get(`member:${f.klass.id}:${id}`);
 assert.equal(account.name,'Google Student');assert.equal(member.name,'Google Student');assert.equal(member.active,true);assert.equal(account.points,0);
 assert.match(cookie(response,'__Host-quizdock-library'),/__Host-quizdock-library=/);
});
test('Google login preserves existing student IDs, grades, currency, marks and teacher roster names',async()=>{
 const f=await fixture(),email='existing@example.com',id=await hash(email),svc=new AcademyService(f.ctx.storage,config);
 await svc.enroll(f.klass.id,id,email,'Teacher Roster Name');
 const profile={id,email,name:'Old Profile',points:123,owned:['mint','coral'],skin:'coral',createdAt:1};
 await f.ctx.storage.put({['account:'+id]:profile,['practice:assignment:'+id]:{answered:10,correct:8},['solo:'+id+':saved']:{known:['card'],again:[]}});
 const {response}=await login(f,email,'');assert.equal(response.status,200);
 const after=await f.ctx.storage.get('account:'+id);assert.equal(after.id,id);assert.equal(after.name,'Google Student');assert.equal(after.points,123);assert.deepEqual(after.owned,profile.owned);
 assert.equal((await f.ctx.storage.get(`member:${f.klass.id}:${id}`)).name,'Teacher Roster Name');
 assert.deepEqual(await f.ctx.storage.get('practice:assignment:'+id),{answered:10,correct:8});assert.deepEqual(await f.ctx.storage.get('solo:'+id+':saved'),{known:['card'],again:[]});
});
test('Google credential cannot be replayed or submitted from another browser or with a forged nonce field',async()=>{
 const f=await fixture(),start=await f.web('google-start',{classCode:f.klass.code}),body=await start.json(),data={challenge:body.challenge,credential:await googleToken(body.nonce),browserNonce:body.nonce};
 assert.equal((await f.web('google-signin',data)).status,401);
 assert.equal((await f.web('google-signin',data,'__Host-quizdock-google=other-browser')).status,401);
 assert.equal((await f.web('google-signin',{...data,credential:await googleToken('wrong')},cookie(start,'__Host-quizdock-google'))).status,401);
 const cookies=cookie(start,'__Host-quizdock-google');assert.equal((await f.web('google-signin',data,cookies)).status,200);assert.equal((await f.web('google-signin',data,cookies)).status,401);
});
test('Google invitation is rechecked at sign-in after code rotation, closure or expiry',async()=>{
 for(const action of ['class-rotate-code','class-close-enrollment','expire']) {
  const f=await fixture(),start=await f.web('google-start',{classCode:f.klass.code}),body=await start.json();
  if(action==='expire'){const key='google-login:'+body.challenge,item=await f.ctx.storage.get(key);item.expiresAt=0;await f.ctx.storage.put(key,item);}else await f.call(action,{classId:f.klass.id});
  const response=await f.web('google-signin',{challenge:body.challenge,credential:await googleToken(body.nonce)},cookie(start,'__Host-quizdock-google'));
  assert.equal(response.status,action==='expire'?401:403);assert.equal(await f.ctx.storage.get('account:'+await hash('new.student@example.com')),undefined);
 }
});
test('Google enrollment respects school domain, revoked enrollment, disabled accounts, and teacher allowlist',async()=>{
 const domain=await fixture('school.edu');assert.equal((await login(domain)).response.status,403);
 const f=await fixture(),id=await hash('new.student@example.com'),svc=new AcademyService(f.ctx.storage,config);await svc.enroll(f.klass.id,id,'new.student@example.com','Roster');await f.call('roster-remove',{classId:f.klass.id,userId:id});
 assert.equal((await login(f)).response.status,403);
 assert.equal((await login(await fixture(),'teacher@example.com')).response.status,403);
 const disabled=await fixture();await disabled.ctx.storage.put('account:'+id,{id,disabled:true});assert.equal((await login(disabled)).response.status,403);
});
test('a reassigned Google email cannot open an account bound to another Google subject',async()=>{
 const f=await fixture();assert.equal((await login(f)).response.status,200);
 assert.equal((await login(f,'new.student@example.com',f.klass.code,{sub:'another-google-user'})).response.status,403);
});
test('missing Google configuration returns a controlled setup error and creates no records',async()=>{
 const ctx=context(),library=new TeacherLibrary(ctx,{});const r=await library.fetch(internal('academy:google-start',{}));assert.equal(r.status,503);assert.equal((await ctx.storage.list({prefix:'google-login:'})).size,0);
});
test('Google challenge cleanup does not delete unrelated account or grade records',async()=>{
 const f=await fixture();await f.ctx.storage.put({'google-login:expired':{expiresAt:0},'account:keep':{id:'keep'},'practice:keep':{correct:3}});await f.library.alarm();
 assert.equal(await f.ctx.storage.get('google-login:expired'),undefined);assert.deepEqual(await f.ctx.storage.get('practice:keep'),{correct:3});
});
test('student OTP endpoints defer to Google when it is configured; teacher email sign-in remains available',async()=>{
 const f=await fixture();assert.equal((await f.call('login-request',{email:'new@example.com',classCode:f.klass.code})).status,400);
 assert.equal((await f.call('login-verify',{email:'new@example.com',code:'000000'})).status,400);
 const status=await f.library.fetch(internal('status',{},''));assert.equal((await status.json()).configured,true);
});
