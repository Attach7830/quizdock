import {SHORTCUT_DEFAULTS,loadShortcutSettings,validateShortcutSettings,eventShortcut,shortcutLabel} from './shortcut-settings.js';
let bindings=loadShortcutSettings();
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const keyboardHelpButton=()=>'<button type="button" class="keyboard-help-button" data-keyboard-help aria-label="Keyboard shortcuts" title="Keyboard shortcuts"><kbd aria-hidden="true">?</kbd><span>Keys</span></button>';
export const shortcutHint=id=>`<kbd class="shortcut-hint" data-shortcut-hint="${id}" aria-hidden="true">${esc(shortcutLabel(bindings[id]))}</kbd>`;
const editable=target=>!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
const available=el=>el&&!el.disabled&&!el.closest('[hidden],[inert]')&&el.getClientRects().length>0;
const navigation=[['home','/','Arcade'],['assignments','/?view=assignments','Assignments'],['lists','/library.html','My lists'],['reports','/reports.html','Game reports'],['data','/data.html','Data & privacy']];
const actions=[...navigation.map(([id,,label])=>[id,'Go to '+label]),['check','Check a typed answer'],['next','Next prompt / next game question'],['flip','Flip flashcard'],['known','Flashcard: I know this'],['again','Flashcard: practice again'],['previous','Previous flashcard'],['reverse','Reverse flashcards'],['shuffle','Reshuffle flashcards'],['guide','Open shortcut guide']];
function installShortcuts(){
 let enabled=true,prefix='',prefixAt=0,previousFocus=null;
 try{enabled=localStorage.getItem('qd-keyboard-shortcuts')!=='off';}catch{}
 const navLink=href=>href==='/'&&document.querySelector('.game-shell .game-top [data-act="leave"]')||[...document.querySelectorAll('header nav a[href],header>a[href]')].find(a=>a.getAttribute('href')===href);
 const nextButton=()=>document.querySelector('[data-act="crossword-next"],[data-act="practice-next"],[data-act="solo-typed-next"],[data-act="next"]');
 const targetFor=id=>id==='next'?nextButton():document.querySelector({flip:'[data-act="solo-flip"]',known:'[data-act="solo-mark"][data-mark="known"]',again:'[data-act="solo-mark"][data-mark="again"]',previous:'[data-act="solo-prev"]',reverse:'[data-act="solo-reverse"]',shuffle:'[data-act="solo-shuffle"]'}[id]||':not(*)');
 function updateHints(){for(const el of document.querySelectorAll('[data-shortcut-hint]'))el.textContent=shortcutLabel(bindings[el.dataset.shortcutHint]);}
 function showGuide(){
  if(document.querySelector('dialog[open]'))return;
  prefix='';previousFocus=document.activeElement;
  let dialog=document.getElementById('keyboard-guide');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='keyboard-guide';dialog.setAttribute('aria-labelledby','keyboard-guide-title');document.body.append(dialog);dialog.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});else document.querySelector('[data-keyboard-help]')?.focus({preventScroll:true});});}
  dialog.innerHTML=`<div class="keyboard-guide-head"><h2 id="keyboard-guide-title">Keyboard shortcuts</h2><button type="button" data-close-guide aria-label="Close keyboard shortcuts" autofocus>×</button></div><p>Customize your keys for assignments, independent practice, flashcards, and navigation. Changes save in this browser.</p><form id="shortcut-settings"><div class="shortcut-settings-grid">${actions.filter(([id])=>{const destination=navigation.find(([action])=>action===id);return !destination||available(navLink(destination[1]));}).map(([id,label])=>`<label for="shortcut-${id}">${esc(label)}<input id="shortcut-${id}" data-shortcut-id="${id}" value="${esc(bindings[id])}" maxlength="40" autocomplete="off" spellcheck="false" aria-describedby="shortcut-format"></label>`).join('')}</div><p id="shortcut-format">Enter a key (Space, Enter, P), a combination (Ctrl+Enter), or a sequence (G A). Clear a field to turn off that action.</p><p class="shortcut-settings-error" role="alert" hidden></p><div class="row"><button class="btn primary" type="submit">Save hotkeys</button><button class="btn ghost" type="button" data-restore-shortcuts>Restore defaults</button></div><p class="shortcut-settings-saved" role="status"></p></form><label class="keyboard-guide-setting"><input type="checkbox" id="keyboard-shortcuts-enabled" ${enabled?'checked':''}> Enable QuizDock shortcuts</label><p><strong>While typing:</strong> Enter checks the current answer. A custom “Check” shortcut with Ctrl or Alt also works in the answer field. Single letters always stay ordinary text while typing. Alt + ↑ inserts the suggested accent. Other shortcuts pause while typing.</p><p class="keyboard-guide-note">Tab and Shift + Tab move between controls. Esc closes a dialog. Shortcuts never submit an entire assignment or choose a game answer. Flashcard confidence keys apply only in flip-card mode. Leaving a game still asks for confirmation.</p>`;
  const error=dialog.querySelector('.shortcut-settings-error'),saved=dialog.querySelector('.shortcut-settings-saved');
  dialog.querySelector('[data-close-guide]').onclick=()=>dialog.close();
  dialog.querySelector('#keyboard-shortcuts-enabled').onchange=e=>{enabled=e.target.checked;prefix='';try{localStorage.setItem('qd-keyboard-shortcuts',enabled?'on':'off');}catch{saved.textContent='Browser storage is unavailable. This setting lasts until the page reloads.';}};
  dialog.querySelector('#shortcut-settings').onsubmit=e=>{e.preventDefault();e.stopImmediatePropagation();try{bindings=validateShortcutSettings({...bindings,...Object.fromEntries([...dialog.querySelectorAll('[data-shortcut-id]')].map(el=>[el.dataset.shortcutId,el.value]))});error.hidden=true;try{localStorage.setItem('qd-shortcut-bindings',JSON.stringify(bindings));saved.textContent='Hotkeys saved.';}catch{saved.textContent='Browser storage is unavailable. Hotkeys apply until the page reloads.';}updateHints();}catch(err){error.textContent=err.message;error.hidden=false;saved.textContent='';}};
  dialog.querySelector('[data-restore-shortcuts]').onclick=()=>{bindings={...SHORTCUT_DEFAULTS};enabled=true;dialog.querySelector('#keyboard-shortcuts-enabled').checked=true;for(const el of dialog.querySelectorAll('[data-shortcut-id]'))el.value=bindings[el.dataset.shortcutId];error.hidden=true;try{localStorage.removeItem('qd-shortcut-bindings');localStorage.removeItem('qd-keyboard-shortcuts');saved.textContent='Default hotkeys restored.';}catch{saved.textContent='Defaults restored for this page.';}updateHints();};
  dialog.showModal();
 }
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-keyboard-help]'))showGuide();});
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.metaKey||document.querySelector('dialog[open]')){prefix='';return;}
  const combo=eventShortcut(event),isEntry=event.target.matches?.('#typed-answer,#solo-answer,#live-word-answer,#sketch-guess-input,[data-crossword-input],[data-crossword-3d-input]');
  if(event.repeat){if(enabled&&(combo===bindings.next||event.key==='Enter'&&isEntry))event.preventDefault();prefix='';return;}
  if(!enabled){prefix='';return;}
  if(combo===bindings.check){const form=document.querySelector('#crossword-grid-form,#crossword-answer-form,#answer-form,#solo-answer-form,#live-word-form,.sketch-guess-form:not([hidden])');if(form&&(!editable(event.target)||isEntry&&(event.ctrlKey||event.altKey||event.key==='Enter'))){event.preventDefault();form.requestSubmit();prefix='';return;}}
  if(editable(event.target)){prefix='';return;}
  let match=Object.keys(bindings).find(id=>bindings[id]===combo),prefixed=prefix&&Date.now()-prefixAt<1200;
  if(prefixed)match=Object.keys(bindings).find(id=>bindings[id]===prefix+' '+combo)||match;
  prefix='';
  if(!match&&Object.values(bindings).some(key=>key.startsWith(combo+' '))){event.preventDefault();prefix=combo;prefixAt=Date.now();return;}
  if(match==='guide'){event.preventDefault();showGuide();return;}
  const destination=navigation.find(([id])=>id===match);
  if(destination){const link=navLink(destination[1]);if(available(link)){event.preventDefault();link.click();}return;}
  const button=targetFor(match);
  // Let a focused button's native Enter/Space activate it exactly once.
  if((event.key==='Enter'||event.key===' ')&&event.target.closest?.('button,a,summary,[role="button"]'))return;
  if(available(button)){event.preventDefault();button.click();}
 });
 window.addEventListener('blur',()=>{prefix='';});
 document.addEventListener('focusin',event=>{if(editable(event.target))prefix='';});
}
if(typeof document!=='undefined')installShortcuts();
