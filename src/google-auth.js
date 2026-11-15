import {ensure,LibraryError,cleanEmail} from './library-domain.js';
const KEYS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cached = null, pending = null, lastKeyRefresh = 0;
function bytes(value) {
 ensure(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value), 'Invalid Google credential.', 401);
 try { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)); }
 catch { throw new LibraryError('Invalid Google credential.', 401); }
}
function part(value) {
 try { return JSON.parse(new TextDecoder().decode(bytes(value))); }
 catch { throw new LibraryError('Invalid Google credential.', 401); }
}
async function keys(request, now) {
 if (cached?.expiresAt > now) return cached.keys;
 if (!pending) pending = (async () => {
  let response;
  try { response = await request(KEYS_URL, {signal:AbortSignal.timeout(8000)}); }
  catch { throw new LibraryError('Google sign-in is temporarily unavailable. Please retry.', 503); }
  ensure(response.ok, 'Google sign-in is temporarily unavailable. Please retry.', 503);
  const body = await response.json();
  ensure(Array.isArray(body.keys) && body.keys.length > 0, 'Google signing keys are unavailable.', 503);
  const age = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]) || 300;
  cached = {keys:body.keys, expiresAt:now + Math.min(3600, age) * 1000}; return cached.keys;
 })().finally(() => { pending = null; });
 return pending;
}
export async function verifyGoogleCredential(credential, clientId, {request = fetch, now = Date.now(), jwks = null} = {}) {
 clientId = String(clientId || '').trim();
 ensure(clientId, 'Google sign-in is not configured yet. Contact the site administrator.', 503);
 ensure(typeof credential === 'string' && credential.length <= 12000, 'Invalid Google credential.', 401);
 const pieces = credential.split('.'); ensure(pieces.length === 3, 'Invalid Google credential.', 401);
 const header = part(pieces[0]), claims = part(pieces[1]);
 ensure(header.alg === 'RS256' && typeof header.kid === 'string', 'Invalid Google signing key.', 401);
 let available = jwks || await keys(request, now);
 if (!jwks && !available.some(k => k.kid === header.kid) && now - lastKeyRefresh > 60000) {
  lastKeyRefresh = now; cached = null; available = await keys(request, now);
 }
 const jwk = available.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
 ensure(jwk, 'Google signing key changed. Retry sign-in shortly.', 401);
 let valid = false;
 try {
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
  valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(pieces[2]), new TextEncoder().encode(pieces.slice(0,2).join('.')));
 } catch { /* Invalid keys/signatures never create a session. */ }
 ensure(valid, 'Google credential could not be verified.', 401);
 const seconds = now / 1000;
 ensure(['accounts.google.com','https://accounts.google.com'].includes(claims.iss) && claims.aud === clientId && (!claims.azp || claims.azp === clientId), 'Google credential is for a different application.', 401);
 ensure(Number.isFinite(claims.exp) && claims.exp > seconds && Number.isFinite(claims.iat) && claims.iat <= seconds + 60 && claims.iat >= seconds - 7200 && claims.exp > claims.iat, 'Google sign-in expired. Please try again.', 401);
 ensure(claims.email_verified === true && typeof claims.sub === 'string' && claims.sub.length > 0 && claims.sub.length <= 255 && typeof claims.nonce === 'string', 'Use a verified Google email account.', 401);
 const name = String(claims.name || '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0,70);
 return {email:cleanEmail(claims.email),name:name || cleanEmail(claims.email).split('@')[0],subject:claims.sub,nonce:claims.nonce,authoritativeEmail:cleanEmail(claims.email).endsWith('@gmail.com') || (typeof claims.hd === 'string' && !!claims.hd.trim())};
}
