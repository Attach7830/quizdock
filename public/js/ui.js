import {skinById} from './catalog.js';
import {characterMarkup} from './characters.js';
import {keyboardHelpButton} from './shortcuts.js';
export {keyboardHelpButton} from './shortcuts.js';
export const $=s=>document.querySelector(s);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(action,data={},group='academy'){
 const res=await fetch(`/api/${group}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)}).catch(e=>{throw new Error(navigator.onLine?'The server did not respond. Your work has not been discarded.':'You are offline. Reconnect to save and continue.');});
 const body=await res.json().catch(()=>({error:'Unexpected server response.'}));if(!res.ok){const e=new Error(body.error||'Request failed.');e.status=res.status;throw e;}return body;
}
export async function post(path,data,{keepalive=false,signal}={}){const r=await fetch(path,{keepalive,signal,method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const b=await r.json();if(!r.ok){const error=new Error(b.error||'Request failed.');error.status=r.status;throw error;}return b;}
let timer;export function notice(message,error=false){const el=$('#notice');if(!el)return;el.textContent=message;el.hidden=false;el.classList.toggle('error',error);clearTimeout(timer);timer=setTimeout(()=>{el.hidden=true;},error?12000:5000);}
export function dateLabel(ms,timezone='America/Los_Angeles'){return new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(ms);}
export const timeLabel=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export function download(name,content,type='text/csv;charset=utf-8'){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export function csv(rows){return '\uFEFF'+rows.map(r=>r.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function topbar(user,active='arcade'){return `<header class="topbar"><a class="wordmark" href="/"> <span class="brand-tile" aria-hidden="true">Q</span> QuizDock<span class="beta">CLASSROOM</span></a><nav aria-label="Main navigation">${!user?'<a href="/about.html">About</a>':''}<a ${active==='arcade'?'aria-current="page"':''} data-hub-view="arcade" href="/">Arcade</a><a ${active==='assignments'?'aria-current="page"':''} data-hub-view="assignments" href="/?view=assignments">Assignments</a>${user?`<a ${active==='expeditions'?'aria-current="page"':''} data-hub-view="expeditions" href="/?view=expeditions">Class island</a>`:''}${user?.role==='teacher'?'<a href="/library.html">My lists</a><a href="/reports.html">Game reports</a>':''}${user?`<a href="/data.html">Data & privacy</a><span class="nav-name">${esc(user.name)}</span><button class="subtle" data-act="logout">Sign out</button>`:''}${keyboardHelpButton()}</nav></header>`;}
export function empty(title,detail){return `<div class="empty"><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;}
export function option(value,label,selected){return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;}
export function mountDialog(title,content){const d=$('#dialog');d.innerHTML=`<form method="dialog" class="dialog-top"><h2>${esc(title)}</h2><button class="icon-btn" aria-label="Close dialog">×</button></form><div class="dialog-body">${content}</div>`;d.showModal();return d;}
export function avatar(skin,size=''){return `<span class="avatar character-avatar ${esc(size)}" data-character="${esc(skin?.id||'mint')}" data-equipment="${esc(Object.values(skin?.equipment||{}).join(','))}" aria-hidden="true">${characterMarkup(skin)}</span>`;}
export function setupViewport(){const run=()=>{const v=window.visualViewport;if(!v||Math.abs(v.scale-1)<.01){const h=v?.height||innerHeight;document.documentElement.style.setProperty('--viewport-height',h+'px');document.documentElement.classList.toggle('short-window',h<480);}};window.addEventListener('resize',run);window.visualViewport?.addEventListener('resize',run);window.addEventListener('focus',run);window.addEventListener('pageshow',run);document.addEventListener('visibilitychange',run);run();}

export function playerLabel(player,suffix=''){return `<span class="player-label">${avatar(skinById(player.skin,player.equipment),'mini')}<span class="player-label-text">${esc(player.name)}${esc(suffix)}</span></span>`;}
