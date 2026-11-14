import {eventByKind} from './event-catalog.js';
import {esc} from './ui.js';
export function eventNotice(event, host = false) {
 const item = eventByKind(event?.kind);
 if (!item) return '';
 return `<div class="arcade-event-notice" data-event-id="${esc(event.id)}" role="status"><span class="eyebrow">Latest arcade event${host?` · ${esc(event.playerName)}`:''}</span><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p></div>`;
}
