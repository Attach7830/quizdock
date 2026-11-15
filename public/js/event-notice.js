import {eventByKind} from './event-catalog.js';
import {esc} from './ui.js';
const healthKinds=new Set(['aegis-bloom','repair-drone','root-renewal']);
const coins=new Set(['coin-comet','vault-echo','compass-cache']);
const cash=new Set(['overdrive','cargo-airship','golden-blueprint']);
const distance=new Set(['slipstream','rainbow-gates','cloud-trampoline']);
const energy=new Set(['aurora-bridge','crystal-orbit']);
const actual=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function eventPresentation(event){
 const item=eventByKind(event?.kind);if(!item)return null;
 const amount=actual(event.amount),health=actual(event.health),fish=actual(event.fish),parts=[];
 if(healthKinds.has(item.kind)&&health!==null)parts.push(health?`${health} health restored`:'Health already full');
 if(amount>0)parts.push(cash.has(item.kind)?`$${amount} earned`:`${amount} ${coins.has(item.kind)?'coins gained':distance.has(item.kind)?'distance gained':energy.has(item.kind)?'energy gained':'bonus points'}`);
 if(fish>0)parts.push(`${fish} bonus fish caught`);
 return {title:item.name+'!',outcome:parts.join(' · ')||'Reward received',kind:item.kind};
}
// Compatibility for already loaded clients. The active UI uses a one-shot flash.
export function eventNotice(event,host=false){
 const model=eventPresentation(event);if(!model)return '';
 return `<div class="arcade-event-notice" data-event-id="${esc(event.id)}" role="status"><strong><em>${esc(model.title)}</em></strong><p>${esc(model.outcome)}</p>${host?`<small>${esc(event.playerName)}</small>`:''}</div>`;
}
