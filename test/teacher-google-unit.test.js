import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStorage} from './memory-runtime.js';
import {hash, ensure} from '../src/library-domain.js';
import {verifyGoogleCredential} from '../src/google-auth.js';
import {startTeacherGoogleLogin, finishTeacherGoogleLogin, readTeacherGoogleAttempt, teacherGoogleConfigured, TEACHER_GOOGLE_COOKIE} from '../src/teacher-google-login.js';
import {googleClientId, googleJwk, googleToken} from './google-fixture.js';
const config = {TEACHER_EMAILS:'teacher@gmail.com, teacher@school.edu', GOOGLE_CLIENT_ID:googleClientId};
function service(overrides={}) {
 return {store:new MemoryStorage(), config:{...config,...overrides}, async rate(key,max) {
  const count=await this.store.get('rate:'+key)||0;ensure(count<max,'Too many requests.',429);await this.store.put('rate:'+key,count+1);
 }};
}
async function attempt(s) {
 const response=await startTeacherGoogleLogin(s,'school-ip');const p=await response.json();
 return {...p,browserNonce:p.nonce,response};
}
async function identity(a,claims={}) {
 return verifyGoogleCredential(await googleToken(a.nonce,{email:'teacher@gmail.com',name:'Google Name',...claims}),googleClientId,{jwks:[googleJwk]});
}
const sessions=s=>s.store.list({prefix:'session:'});
test('teacher Google configuration is independent of Resend but requires a teacher allowlist',()=>{
 assert.equal(teacherGoogleConfigured(config),true);assert.equal(teacherGoogleConfigured({GOOGLE_CLIENT_ID:googleClientId}),false);assert.equal(teacherGoogleConfigured({...config,GOOGLE_CLIENT_ID:'  '}),false);
});
test('teacher challenge uses its own secure HttpOnly cookie and expires after ten minutes',async()=>{
 const s=service(),before=Date.now(),a=await attempt(s);assert.ok(a.response.headers.getSetCookie().some(c=>c.startsWith(TEACHER_GOOGLE_COOKIE+'=')&&c.includes('Secure; HttpOnly; SameSite=Strict; Max-Age=600')));
 const stored=await s.store.get('google-teacher-login:'+a.challenge);assert.ok(stored.expiresAt>=before+600000&&stored.expiresAt<=Date.now()+600000);assert.equal((await s.store.list({prefix:'google-login:'})).size,0);
});
test('approved Gmail teacher gets a teacher session without any email-provider settings',async()=>{
 const s=service(),a=await attempt(s),i=await identity(a),r=await finishTeacherGoogleLogin(s,a,i);
 assert.deepEqual(await r.json(),{ok:true});const [session]=[...(await sessions(s)).values()];assert.equal(session.kind,'teacher');assert.equal(session.authProvider,'google');assert.equal(session.owner,await hash('teacher@gmail.com'));assert.ok(session.issuedAt);assert.ok(r.headers.getSetCookie().some(c=>c.startsWith('__Host-quizdock-library=')&&c.includes('Secure; HttpOnly; SameSite=Lax')));
});
test('approved Google Workspace teacher can use their existing school email',async()=>{
 const s=service(),a=await attempt(s),i=await identity(a,{email:'teacher@school.edu',hd:'school.edu'});assert.equal(i.authoritativeEmail,true);assert.equal((await finishTeacherGoogleLogin(s,a,i)).status,200);
});
test('Google sign-in preserves account name, ID, wallet, saved list and class',async()=>{
 const s=service(),owner=await hash('teacher@gmail.com');const prior={id:owner,email:'teacher@gmail.com',name:'Señor T.W.',points:97,owned:['mint','coral'],skin:'coral',createdAt:123};
 await s.store.put({['account:'+owner]:prior,['list:'+owner+':existing']:{title:'Spanish review'},['class:existing']:{ownerId:owner}});
 const a=await attempt(s);await finishTeacherGoogleLogin(s,a,await identity(a));const after=await s.store.get('account:'+owner);
 assert.deepEqual(after,{...prior,googleSubject:'google-subject-1'});assert.deepEqual(await s.store.get('list:'+owner+':existing'),{title:'Spanish review'});assert.equal((await s.store.get('class:existing')).ownerId,owner);
});
test('a signed Google account outside the allowlist cannot become a teacher',async()=>{
 const s=service(),a=await attempt(s);await assert.rejects(()=>finishTeacherGoogleLogin(s,{...a,email:'teacher@gmail.com',role:'teacher'},identity),/credential/);
 await assert.rejects(()=>identity(a,{email:'student@gmail.com'}).then(i=>finishTeacherGoogleLogin(s,a,i)),e=>e.status===403);assert.equal((await sessions(s)).size,0);assert.equal((await s.store.list({prefix:'account:'})).size,0);
});
test('allowlist is checked at callback, including removal while Google popup was open',async()=>{
 const s=service(),a=await attempt(s),i=await identity(a);s.config.TEACHER_EMAILS='other@gmail.com';await assert.rejects(()=>finishTeacherGoogleLogin(s,a,i),/not an authorized teacher/);assert.equal((await sessions(s)).size,0);
});
test('teacher verification refuses student challenge namespaces and forged browser nonce values',async()=>{
 const s=service(),a=await attempt(s),i=await identity(a);await s.store.put('google-login:student-challenge',{nonce:a.nonce,expiresAt:Date.now()+5000});
 for(const p of [{...a,challenge:'student-challenge'},{...a,browserNonce:''},{...a,browserNonce:'other-browser'}])await assert.rejects(()=>finishTeacherGoogleLogin(s,p,i),e=>e.status===401);
 assert.equal((await sessions(s)).size,0);
});
test('nonce signed by Google must match the stored browser challenge',async()=>{
 const s=service(),a=await attempt(s),i=await identity({...a,nonce:'wrong-signed-nonce'});await assert.rejects(()=>finishTeacherGoogleLogin(s,a,i),e=>e.status===401);assert.equal((await sessions(s)).size,0);
});
test('expired challenges are refused and successful challenges cannot be replayed',async()=>{
 const s=service(),a=await attempt(s),key='google-teacher-login:'+a.challenge;const row=await s.store.get(key);await s.store.put(key,{...row,expiresAt:0});await assert.rejects(()=>readTeacherGoogleAttempt(s,a),e=>e.status===401);
 const b=await attempt(s),i=await identity(b);await finishTeacherGoogleLogin(s,b,i);await assert.rejects(()=>finishTeacherGoogleLogin(s,b,i),e=>e.status===401);assert.equal((await sessions(s)).size,1);
});
test('disabled accounts and mismatched immutable Google subjects fail closed',async()=>{
 for(const prior of [{disabled:true},{googleSubject:'another-subject'}]){const s=service(),a=await attempt(s);await s.store.put('account:'+await hash('teacher@gmail.com'),prior);await assert.rejects(()=>identity(a).then(i=>finishTeacherGoogleLogin(s,a,i)),e=>e.status===403);assert.equal((await sessions(s)).size,0);}
});
test('one Google subject cannot silently acquire another allowed teacher workspace',async()=>{
 const s=service(),a=await attempt(s);await finishTeacherGoogleLogin(s,a,await identity(a));const b=await attempt(s);await assert.rejects(()=>identity(b,{email:'teacher@school.edu',hd:'school.edu'}).then(i=>finishTeacherGoogleLogin(s,b,i)),/another teacher email/);assert.equal((await sessions(s)).size,1);
});
test('verified third-party Google emails require mailbox verification instead of silent matching',async()=>{
 const s=service(),a=await attempt(s),i=await identity(a,{email:'teacher@school.edu'});assert.equal(i.authoritativeEmail,false);await assert.rejects(()=>finishTeacherGoogleLogin(s,a,i),/email-code sign-in/);assert.equal((await sessions(s)).size,0);
});
test('teacher token verification rejects wrong issuer, audience, expiry, and unverified email',async()=>{
 const s=service(),a=await attempt(s);
 for(const overrides of [{iss:'https://evil.test'},{aud:'another-app'},{email_verified:false},{exp:0},{iat:Date.now()/1000+500},{azp:'another-app'}])await assert.rejects(()=>identity(a,overrides));
 const good=await googleToken(a.nonce,{email:'teacher@gmail.com'}),pieces=good.split('.');pieces[1]=Buffer.from(JSON.stringify({email:'teacher@gmail.com',email_verified:true})).toString('base64url');await assert.rejects(()=>verifyGoogleCredential(pieces.join('.'),googleClientId,{jwks:[googleJwk]}));
});
test('Google credentials and challenges do not persist in completed teacher sessions',async()=>{
 const s=service(),a=await attempt(s),credential=await googleToken(a.nonce,{email:'teacher@gmail.com'}),i=await verifyGoogleCredential(credential,googleClientId,{jwks:[googleJwk]});await finishTeacherGoogleLogin(s,{...a,credential},i);
 assert.equal(await s.store.get('google-teacher-login:'+a.challenge),undefined);assert.equal(JSON.stringify([...(await s.store.list()).values()]).includes(credential),false);
});
test('teacher Google start is rate limited separately from email sending',async()=>{
 const s=service();await s.store.put('rate:email:'+await hash('teacher@gmail.com'),999);for(let i=0;i<30;i++)await startTeacherGoogleLogin(s,'same-ip');await assert.rejects(()=>startTeacherGoogleLogin(s,'same-ip'),e=>e.status===429);
});
