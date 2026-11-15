import {eventPresentation} from './event-notice.js';
import {esc} from './ui.js';
export const EVENT_FLASH_MS=3200;
const roundKey=room=>room?`${room.pin}:${room.roundNumber}:${room.startedAt}:${room.mode}`:'';
export function createEventFlash({doc=document,view=window,duration=EVENT_FLASH_MS}={}){
 const el=doc.createElement('div');el.className='event-flash';el.hidden=true;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');doc.body.append(el);
 const media=view.matchMedia('(prefers-reduced-motion:reduce)');let roomKey=null,lastId=null,timer=null,disposed=false,lastShown=-Infinity;
 function motion(){let enabled=true;try{enabled=view.localStorage.getItem('qd-motion')!=='off';}catch{}el.dataset.motion=enabled&&!media.matches?'on':'off';}
 function hide(clear=false){if(timer!==null)view.clearTimeout(timer);timer=null;el.hidden=true;if(clear){el.replaceChildren();delete el.dataset.eventId;delete el.dataset.kind;}}
 function update(room,{host=false,phase='result'}={}){
  if(disposed)return;
  const key=roundKey(room),event=host?room?.lastArcadeEvent:room?.me?.lastEvent;
  // The first/reconnected snapshot establishes a baseline, never a replay.
  if(key!==roomKey){roomKey=key;lastId=event?.id||null;hide(true);return;}
  if(!event?.id){lastId=null;hide(true);return;}
  const eligible=['playing','finished'].includes(room?.status)&&(host||phase==='result')&&!doc.hidden;
  if(!eligible)hide();
  if(event.id===lastId)return;
  lastId=event.id;const model=eventPresentation(event);if(!model){hide(true);return;}if(!eligible)return;
  hide();motion();const now=view.performance?.now()??Date.now();if(now-lastShown<1200)el.dataset.motion='off';lastShown=now;el.dataset.eventId=event.id;el.dataset.kind=model.kind;
  el.innerHTML=`<div class="event-flash-aura" aria-hidden="true"></div><div class="event-flash-card"><button type="button" class="event-flash-dismiss" aria-label="Dismiss event">×</button><span class="event-flash-kicker">Special event${host?` · ${esc(event.playerName)}`:''}</span><strong class="event-flash-title"><em>${esc(model.title)}</em></strong><p class="event-flash-outcome">${esc(model.outcome)}</p></div>`;
  el.hidden=false;timer=view.setTimeout(()=>hide(),duration);
 }
 const visibility=()=>{if(doc.hidden)hide();};
 const keydown=e=>{if(e.key==='Escape'&&!el.hidden)hide();};
 const settings=e=>{if(e.target.closest('[data-scene=motion]'))motion();};
 doc.addEventListener('click',settings);
 const click=e=>{if(e.target.closest('.event-flash-dismiss'))hide();};
 el.addEventListener('click',click);doc.addEventListener('keydown',keydown);doc.addEventListener('visibilitychange',visibility);media.addEventListener('change',motion);
 return {el,update,hide,dispose(){disposed=true;hide(true);el.remove();doc.removeEventListener('click',settings);doc.removeEventListener('keydown',keydown);doc.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motion);}};
}
