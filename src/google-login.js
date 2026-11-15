import {ensure,uid,hash,teacherEmails,constantEqual} from './library-domain.js';
const NONCE_COOKIE = '__Host-quizdock-google';
const nonceCookie = value => `${NONCE_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${value?600:0}`;
function response(data, cookies = []) {
 const headers = new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 for (const value of cookies) headers.append('set-cookie',value);
 return new Response(JSON.stringify(data),{headers});
}
export async function startGoogleLogin(service, payload, ip) {
 ensure(service.config.GOOGLE_CLIENT_ID, 'Student Google sign-in is not configured yet. Please ask your teacher.', 503);
 await service.rate('google-start:'+await hash(ip),200);
 const classCode = String(payload.classCode || '').trim().toUpperCase();
 if (classCode) await service.byCode(classCode);
 const challenge = uid(), nonce = uid()+uid();
 await service.store.put('google-login:'+challenge,{nonce,classCode,expiresAt:Date.now()+600000});
 return response({clientId:service.config.GOOGLE_CLIENT_ID,challenge,nonce},[nonceCookie(nonce)]);
}
export async function finishGoogleLogin(service, payload, identity, ip) {
 await service.rate('google-verify:'+await hash(ip),100,600000);
 ensure(identity, 'Google credential could not be verified.',401);
 ensure(typeof payload.challenge === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(payload.challenge), 'Google sign-in expired. Please try again.',401);
 const key = 'google-login:'+payload.challenge, attempt = await service.store.get(key), now = Date.now();
 ensure(attempt?.expiresAt > now && constantEqual(attempt.nonce,identity.nonce) && constantEqual(attempt.nonce,payload.browserNonce), 'Google sign-in expired or belongs to another browser. Please try again.',401);
 ensure(!teacherEmails(service.config).includes(identity.email), 'Choose Teacher sign-in for this account.',403);
 const userId = await hash(identity.email), prior = await service.profile(userId);
 ensure(!prior?.disabled, 'This account has been disabled.',403);
 ensure(!prior?.googleSubject || prior.googleSubject === identity.subject, 'This email is linked to a different Google account. Ask your teacher for help.',403);
 // Verified Servite Workspace students can create their account before joining
 // a class. Class access still requires its code and normal enrollment checks.
 const servite=identity.email.endsWith('@servitehs.org')&&identity.workspaceDomain==='servitehs.org';
 const eligible = servite&&!attempt.classCode?{userId,joinClass:null}:await service.eligibleStudent(identity.email,attempt.classCode);
 if (eligible.joinClass) {
  const old = await service.enrollment(userId,eligible.joinClass);
  await service.enroll(eligible.joinClass,userId,identity.email,old?.name || identity.name);
 }
 // Preserve the email-based account ID, grades, wallet and cosmetic inventory.
 const profile = {...(prior || {id:userId,email:identity.email,points:0,owned:['mint'],skin:'mint',createdAt:now}),name:identity.name,googleSubject:identity.subject};
 await service.store.put('account:'+userId,profile);
 const session = uid()+uid();
 await service.store.put('session:'+await hash(session),{email:identity.email,owner:userId,kind:'student',issuedAt:now,expiresAt:now+7*86400000});
 await service.store.delete(key);
 return response({ok:true},[`__Host-quizdock-library=${session}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800`,nonceCookie('')]);
}
