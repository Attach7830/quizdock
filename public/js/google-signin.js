import {api} from './ui.js';
let loading = null, activeGeneration = null;
const generations = new WeakMap();
function loadGoogle() {
 if (window.google?.accounts?.id) return Promise.resolve();
 if (!loading) loading = new Promise((resolve, reject) => {
  const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
  const timer = setTimeout(() => { script.remove(); loading = null; reject(new Error('Google sign-in did not load. Check your connection and retry.')); }, 12000);
  script.onload = () => { clearTimeout(timer); resolve(); };
  script.onerror = () => { clearTimeout(timer); script.remove(); loading = null; reject(new Error('Google sign-in could not load. Check your connection and retry.')); };
  document.head.append(script);
 });
 return loading;
}
export async function mountGoogleSignIn(container, {classCode = '', group = 'academy', onSuccess, onError = () => {}}) {
 if (!container) return;
 if (!['academy','library'].includes(group)) throw new Error('Invalid Google sign-in screen.');
 const generation = {}; generations.set(container, generation); activeGeneration = generation;
 // The Google SDK has one current configuration. A removed or older role panel
 // must not replace the callback/nonce for the currently visible sign-in button.
 const current = () => container.isConnected && generations.get(container) === generation && activeGeneration === generation;
 const fail = error => {
  if (!current()) return;
  container.replaceChildren(); const message = document.createElement('p'); message.className = 'form-note'; message.setAttribute('role','status'); message.textContent = error.message;
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn ghost'; retry.textContent = 'Retry Google sign-in';
  retry.onclick = () => mountGoogleSignIn(container,{classCode,group,onSuccess,onError}); container.append(message,retry); onError(error);
 };
 container.textContent = 'Loading Google sign-in…';
 try {
  const config = await api('google-start',group === 'academy' ? {classCode} : {},group);
  if (!current()) return;
  await loadGoogle(); if (!current()) return;
  window.google.accounts.id.initialize({client_id:config.clientId, nonce:config.nonce, auto_select:false,
   callback:async result => {
    if (!current() || generation.busy) return;
    generation.busy = true; container.textContent = 'Verifying your Google account…';
    try { const signedIn=await api('google-signin',{challenge:config.challenge,credential:result.credential},group); if (current()) await onSuccess(signedIn); }
    catch (error) { fail(error); } finally { generation.busy = false; }
   }
  });
  container.replaceChildren(); window.google.accounts.id.renderButton(container,{type:'standard',theme:'filled_blue',size:'large',text:'signin_with',shape:'rectangular',width:Math.min(320,Math.max(200,container.clientWidth))});
 } catch (error) { fail(error); }
}
