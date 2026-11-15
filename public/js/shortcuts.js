export const keyboardHelpButton = () => '<button type="button" class="keyboard-help-button" data-keyboard-help aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)"><kbd aria-hidden="true">?</kbd><span>Keys</span></button>';

const navigation = [
 ['h', '/', 'Arcade'],
 ['a', '/?view=assignments', 'Assignments'],
 ['l', '/library.html', 'My lists'],
 ['r', '/reports.html', 'Game reports'],
 ['d', '/data.html', 'Data & privacy']
];
const editable = target => !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
const interactive = target => editable(target) || !!target?.closest?.('button,a,summary,[role="button"],[role="tab"],[role="slider"]');

function installShortcuts() {
 let enabled = true, prefixAt = 0, previousFocus = null;
 try { enabled = localStorage.getItem('qd-keyboard-shortcuts') !== 'off'; } catch {}
 const navLink = href => {
  // In a game, use its existing Leave flow so its confirmation stays intact.
  const leave = href === '/' && document.querySelector('.game-shell .game-top [data-act="leave"]');
  return leave || [...document.querySelectorAll('header nav a[href]'),...document.querySelectorAll('header>a[href]')].find(a => a.getAttribute('href') === href);
 };
 const nextButton = () => document.querySelector('[data-act="practice-next"],[data-act="solo-typed-next"]');
 const available = el => el && !el.disabled && !el.closest('[hidden],[inert]') && el.getClientRects().length > 0;

 function showGuide() {
  if (document.querySelector('dialog[open]')) return;
  prefixAt = 0;
  previousFocus = document.activeElement;
  let dialog = document.getElementById('keyboard-guide');
  if (!dialog) {
   dialog = document.createElement('dialog'); dialog.id = 'keyboard-guide';
   dialog.setAttribute('aria-labelledby','keyboard-guide-title');
   dialog.addEventListener('close', () => {
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    else document.querySelector('[data-keyboard-help]')?.focus({preventScroll:true});
   });
   document.body.append(dialog);
  }
  const row = (keys, text) => `<div><dt>${keys.map(k=>`<kbd>${k}</kbd>`).join(' <span aria-hidden="true">then</span> ')}</dt><dd>${text}</dd></div>`;
  dialog.innerHTML = `<div class="keyboard-guide-head"><h2 id="keyboard-guide-title">Keyboard shortcuts</h2><button type="button" data-close-guide aria-label="Close keyboard shortcuts" autofocus>×</button></div>
   <p>Use these anywhere outside a text field. Press the navigation keys one after the other.</p>
   <dl>${navigation.filter(([,href])=>available(navLink(href))).map(([key,,name])=>row(['G',key.toUpperCase()],`Go to ${name}`)).join('')}
   ${row(['Enter'],'Check a typed answer. After feedback, load the next graded or solo practice card.')}
   ${row(['Space'],'Flip a solo flashcard.')}${row(['?'],'Open this guide.')}${row(['Esc'],'Close a dialog.')}</dl>
   <p><strong>While typing:</strong> Tab and Shift + Tab move between controls. Alt + ↑ inserts the suggested accent.</p>
   <label class="keyboard-guide-setting"><input type="checkbox" id="keyboard-shortcuts-enabled" ${enabled?'checked':''}> Enable QuizDock shortcuts</label>
   <p class="keyboard-guide-note">Shortcuts pause while you type or use a dialog. They never submit an entire assignment, choose a game answer, or buy anything. This setting saves on this device.</p>`;
  dialog.querySelector('[data-close-guide]').onclick = () => dialog.close();
  dialog.querySelector('#keyboard-shortcuts-enabled').onchange = event => {
   enabled = event.target.checked; prefixAt = 0;
   try { localStorage.setItem('qd-keyboard-shortcuts', enabled ? 'on' : 'off'); } catch {}
  };
  dialog.showModal();
 }

 document.addEventListener('click', event => {
  if (event.target.closest?.('[data-keyboard-help]')) showGuide();
 });
 document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) { prefixAt = 0; return; }
  if (document.querySelector('dialog[open]')) { prefixAt = 0; return; }
  const next = nextButton();
  // A held Enter must not turn a second restored draft into another attempt.
  if (event.repeat) {
   if (enabled && event.key === 'Enter' && (available(next) || event.target.matches?.('#typed-answer,#solo-answer'))) event.preventDefault();
   prefixAt = 0; return;
  }
  if (!enabled || editable(event.target)) { prefixAt = 0; return; }
  if (event.key === '?') { event.preventDefault(); prefixAt = 0; showGuide(); return; }
  if (event.key === 'Enter' && !event.shiftKey && !interactive(event.target) && available(next)) {
   event.preventDefault(); prefixAt = 0; next.click(); return;
  }
  if (event.key === ' ' && !event.shiftKey && !interactive(event.target)) {
   const flip = document.querySelector('[data-act="solo-flip"]');
   if (available(flip)) { event.preventDefault(); prefixAt = 0; flip.click(); return; }
  }
  const key = event.key.toLowerCase(), prefixed = prefixAt && Date.now() - prefixAt < 1200;
  prefixAt = 0;
  if (prefixed) {
   const destination = navigation.find(([letter])=>letter === key), link = destination && navLink(destination[1]);
   if (available(link)) { event.preventDefault(); link.click(); return; }
  }
  if (key === 'g' && !event.shiftKey) { event.preventDefault(); prefixAt = Date.now(); }
 });
 window.addEventListener('blur',()=>{prefixAt=0;});
 document.addEventListener('focusin',event=>{if(editable(event.target))prefixAt=0;});
}
if (typeof document !== 'undefined') installShortcuts();
