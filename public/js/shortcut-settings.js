export const SHORTCUT_DEFAULTS = Object.freeze({guide:'?',home:'g h',assignments:'g a',lists:'g l',reports:'g r',data:'g d',check:'Ctrl+Enter',next:'Enter',flip:'Space',known:'ArrowRight',again:'ArrowLeft',previous:'p',reverse:'r',shuffle:'Shift+r'});
const aliases={space:'Space',spacebar:'Space',enter:'Enter',return:'Enter',arrowleft:'ArrowLeft',left:'ArrowLeft',arrowright:'ArrowRight',right:'ArrowRight',arrowup:'ArrowUp',up:'ArrowUp',arrowdown:'ArrowDown',down:'ArrowDown',escape:'Escape',esc:'Escape',tab:'Tab',backspace:'Backspace',delete:'Delete',home:'Home',end:'End'};
export function normalizeShortcut(value){
 const text=String(value||'').trim();if(!text)return '';
 if(text.length>40)throw new Error('Use a single key, a modifier combination, or two letters such as G A.');
 const sequence=text.split(/\s+/);if(sequence.length===2&&sequence.every(k=>/^[a-z0-9]$/i.test(k)))return sequence.map(k=>k.toLowerCase()).join(' ');
 if(sequence.length!==1)throw new Error('A two-key sequence must contain two letters or numbers.');
 const parts=text.split('+'),raw=parts.pop(),modifiers=new Set(parts.map(p=>p.toLowerCase()));
 if([...modifiers].some(m=>!['ctrl','alt','shift'].includes(m))||modifiers.size!==parts.length)throw new Error('Use Ctrl, Alt, or Shift once per combination.');
 const key=aliases[raw.toLowerCase()]||(/^[a-z0-9?]$/i.test(raw)?raw.toLowerCase():null);
 if(!key||['Escape','Tab','Backspace','Delete','Home','End'].includes(key))throw new Error('That key is reserved for normal navigation.');
 const combo=[...['ctrl','alt','shift'].filter(m=>modifiers.has(m)).map(m=>m[0].toUpperCase()+m.slice(1)),key].join('+');
 if(/^(Ctrl\+(?:Shift\+)?[alnprtw]|Alt\+(?:ArrowLeft|ArrowRight|ArrowUp|ArrowDown)|Ctrl\+Space)$/i.test(combo))throw new Error('That combination is reserved by the browser or accent entry.');
 return combo;
}
export function validateShortcutSettings(raw={}){
 const result={},seen=new Map();for(const id of Object.keys(SHORTCUT_DEFAULTS)){
  const key=normalizeShortcut(raw[id]??SHORTCUT_DEFAULTS[id]);
  if(key&&seen.has(key))throw new Error(`Two actions use ${key}. Choose a different shortcut or clear one.`);
  if(key)seen.set(key,id);result[id]=key;
 }
 const single=new Set(Object.values(result).filter(k=>k&&!k.includes(' ')));
 for(const key of Object.values(result))if(key.includes(' ')&&single.has(key.split(' ')[0]))throw new Error('A sequence starts with a key already used by another action.');
 return result;
}
export function loadShortcutSettings(storage){try{const source=storage??globalThis.localStorage;return validateShortcutSettings(JSON.parse(source.getItem('qd-shortcut-bindings')||'{}'));}catch{return {...SHORTCUT_DEFAULTS};}}
export const shortcutLabel=value=>value?value.split(' ').map(k=>k.length===1?k.toUpperCase():k).join(' then '):'Off';
export function eventShortcut(event){const key=event.key===' '?'Space':event.key.length===1?event.key.toLowerCase():event.key;return [...(event.ctrlKey?['Ctrl']:[]),...(event.altKey?['Alt']:[]),...(event.shiftKey&&key!=='?'?['Shift']:[]),key].join('+');}
