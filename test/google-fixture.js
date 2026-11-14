// Test-only RSA issuer. Never imported by production source.
const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
export const googleClientId = 'quizdock-test.apps.googleusercontent.com';
export const googleJwk = {...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'quizdock-test-key',alg:'RS256',use:'sig'};
const base64 = value => Buffer.from(value).toString('base64url');
export async function googleToken(nonce, overrides = {}, header = {}) {
 const now = Math.floor(Date.now()/1000);
 const payload = {iss:'https://accounts.google.com',aud:googleClientId,sub:'google-subject-1',iat:now,exp:now+3600,email:'new.student@example.com',email_verified:true,name:'Google Student',nonce,...overrides};
 const signing = base64(JSON.stringify({alg:'RS256',kid:googleJwk.kid,...header}))+'.'+base64(JSON.stringify(payload));
 const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(signing));
 return signing+'.'+base64(signature);
}
