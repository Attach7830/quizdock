import {ensure, uid, hash, cleanEmail, teacherEmails, constantEqual} from './library-domain.js';

// Separate challenge and cookie namespace: a student login cannot be promoted by
// changing a role field or replaying its nonce against the teacher endpoint.
export const TEACHER_GOOGLE_COOKIE = '__Host-quizdock-google-teacher';
const nonceCookie = value => `${TEACHER_GOOGLE_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${value ? 600 : 0}`;
const sessionCookie = value => `__Host-quizdock-library=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800`;
const challengeKey = value => 'google-teacher-login:' + value;
function response(data, cookies = []) {
  const headers = new Headers({'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff'});
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(data), {headers});
}
export function teacherGoogleConfigured(config) {
  return !!(String(config.GOOGLE_CLIENT_ID || '').trim() && teacherEmails(config).length);
}
export async function startTeacherGoogleLogin(service, ip) {
  ensure(teacherGoogleConfigured(service.config), 'Teacher Google sign-in needs GOOGLE_CLIENT_ID and an authorized TEACHER_EMAILS entry. Email-code sign-in is still available.', 503);
  await service.rate('teacher-google-start:' + await hash(ip), 30);
  const challenge = uid(), nonce = uid() + uid();
  await service.store.put(challengeKey(challenge), {nonce, expiresAt:Date.now() + 600000});
  return response({clientId:String(service.config.GOOGLE_CLIENT_ID).trim(), challenge, nonce}, [nonceCookie(nonce)]);
}
export async function readTeacherGoogleAttempt(service, payload) {
  ensure(teacherGoogleConfigured(service.config), 'Teacher Google sign-in is not configured.', 503);
  ensure(typeof payload.challenge === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(payload.challenge), 'Google sign-in expired. Please try again.', 401);
  const attempt = await service.store.get(challengeKey(payload.challenge));
  ensure(attempt?.expiresAt > Date.now() && constantEqual(attempt.nonce, payload.browserNonce), 'Google sign-in expired or belongs to another browser. Please try again.', 401);
  return attempt;
}
export async function finishTeacherGoogleLogin(service, payload, identity) {
  // Called inside the existing account-storage transaction, with an identity
  // produced ONLY by server-side Google signature/issuer/audience verification.
  const attempt = await readTeacherGoogleAttempt(service, payload);
  ensure(identity && constantEqual(attempt.nonce, identity.nonce), 'Google credential does not match this sign-in. Please try again.', 401);
  const email = cleanEmail(identity.email);
  ensure(teacherEmails(service.config).includes(email), 'This Google email is not an authorized teacher. Choose your approved teacher account or use email-code sign-in.', 403);
  // Google does not vouch for ongoing ownership of a third-party email address.
  // A Google-hosted Gmail/Workspace address can safely match the allowlist;
  // other Google accounts must use the existing mailbox verification method.
  ensure(identity.authoritativeEmail === true, 'Use email-code sign-in for this address. Teacher Google sign-in requires an approved Gmail or Google Workspace account.', 403);
  ensure(typeof identity.subject === 'string' && identity.subject.length > 0 && identity.subject.length <= 255, 'Invalid Google account.', 401);
  const owner = await hash(email), now = Date.now();
  const prior = await service.store.get('account:' + owner);
  ensure(!prior?.disabled, 'This account has been disabled.', 403);
  ensure(!prior?.googleSubject || prior.googleSubject === identity.subject, 'This teacher email is linked to a different Google account. Use email-code sign-in and contact the site administrator.', 403);
  const subjectKey = 'teacher-google-subject:' + await hash(identity.subject);
  const linkedOwner = await service.store.get(subjectKey);
  ensure(!linkedOwner || linkedOwner === owner, 'This Google account is linked to another teacher email. Use email-code sign-in and contact the site administrator.', 403);
  // The same normalized email keeps the same owner ID, saved lists, classes,
  // reports and balances. Do not replace a teacher's existing display name.
  const profile = {...(prior || {id:owner, email, name:identity.name || email.split('@')[0], points:0, owned:['mint'], skin:'mint', createdAt:now}), googleSubject:identity.subject};
  const token = uid() + uid();
  await service.store.put({
    ['account:' + owner]:profile,
    [subjectKey]:owner,
    ['session:' + await hash(token)]:{email, owner, kind:'teacher', authProvider:'google', issuedAt:now, expiresAt:now + 7 * 86400000}
  });
  await service.store.delete(challengeKey(payload.challenge));
  return response({ok:true}, [sessionCookie(token), nonceCookie('')]);
}
