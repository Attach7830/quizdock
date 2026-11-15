import {mountGoogleSignIn} from './google-signin.js';

// Progressive enhancement shared by the home and legacy My lists login pages.
// Account/teacher permissions are enforced on the server, never by these selectors.
export function installTeacherGoogleSignIn(root, {mount = mountGoogleSignIn, onSuccess = () => location.reload()} = {}) {
  if (!root) return () => {};
  let host = null, target = null;
  function sync() {
    const libraryPanel = root.querySelector('.library-login .login-card');
    const teacherTab = root.querySelector('[data-act="login-kind"][data-kind="teacher"][aria-selected="true"]');
    const panel = libraryPanel || (teacherTab ? root.querySelector('.login-panel') : null);
    if (!panel) { host = null; target = null; return; }
    if (host?.isConnected && panel === target) return;
    target = panel;
    const section = document.createElement('section');
    section.className = 'teacher-google-options';
    section.setAttribute('aria-label', 'Teacher Google sign-in');
    host = document.createElement('div');
    host.className = 'teacher-google-button';
    const help = document.createElement('p');
    help.className = 'teacher-google-help';
    help.textContent = 'Use the same authorized teacher email to keep your saved lists and classes.';
    const divider = document.createElement('p');
    divider.className = 'teacher-google-divider';
    divider.textContent = 'or sign in with an email code';
    section.append(host, help, divider);
    const anchor = panel.querySelector('#login-form, #verify-form, .setup-note');
    if (anchor) panel.insertBefore(section, anchor); else panel.append(section);
    // This remains available even when Resend is not configured. Do not imply
    // that an email-provider error disables Google's independent sign-in path.
    const setup = panel.querySelector('.setup-note > strong');
    if (setup) setup.textContent = 'Email-code sign-in needs setup.';
    void mount(host, {group:'library', onSuccess});
  }
  const observer = new MutationObserver(sync);
  observer.observe(root, {childList:true, subtree:true, attributes:true, attributeFilter:['aria-selected']});
  sync();
  return () => { observer.disconnect(); root.querySelectorAll('.teacher-google-options').forEach(el => el.remove()); };
}
if (typeof document !== 'undefined') {
  installTeacherGoogleSignIn(document.getElementById('app') || document.getElementById('library-root'));
}
