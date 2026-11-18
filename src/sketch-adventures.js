import {celebrate} from './expeditions/shared.js';
const FORMATS=['classic','duo','relay','constraint','story','compound'];
const COLORS=['#18344d','#e55f78','#3b9fc7','#48a889','#d4a146','#9471c6','#ffffff'];
export function setupSketchAdventure(room,pool){
 if(!room.expedition)return;const s=room.sketch,w=room.expedition.sketch,requested=w.nextFormat||room.settings.sketchFormat||'auto';w.nextFormat=null;
 let format=requested==='auto'?FORMATS[(s.turn-1)%FORMATS.length]:requested;
 if(!FORMATS.includes(format))format='classic';if(['duo','compound','relay'].includes(format)&&pool.length<3)format='classic';if(format==='compound'&&s.word.trim().split(/\s+/u).length<2)format='duo';
 s.format=format;s.activeArtists=[s.artistId];s.assignments={};s.panel=0;s.gestures={};s.relayAt=s.startedAt+20000;s.constraint=format==='constraint'?['triangles','palette','continuous'][Math.floor((s.turn-1)/6)%3]:null;
 if(['duo','compound'].includes(format)){const first=pool.findIndex(p=>p.id===s.artistId),other=pool[(first+1)%pool.length];s.activeArtists.push(other.id);s.artists.push(other.id);if(format==='compound'){const words=s.word.trim().split(/\s+/u),at=Math.ceil(words.length/2);s.assignments[s.artistId]=words.slice(0,at).join(' ');s.assignments[other.id]=words.slice(at).join(' ');}else{s.assignments[s.artistId]='outline';s.assignments[other.id]='color';}}
}
export const sketchArtist=(s,id)=>s.activeArtists?s.activeArtists.includes(id):s.artistId===id;
export function advanceSketchAdventure(room,pool,now){
 const s=room.sketch;if(!room.expedition||!s?.format||s.phase!=='drawing')return false;let changed=false;
 if(['duo','compound'].includes(s.format)){s.partnerOffline=s.partnerOffline||{};for(const id of s.activeArtists){if(pool.some(p=>p.id===id))delete s.partnerOffline[id];else if(s.partnerOffline[id]===undefined){s.partnerOffline[id]=now;changed=true;}}if(Object.values(s.partnerOffline).some(at=>now-at>=8000)){const live=pool.find(p=>s.activeArtists.includes(p.id));if(live){s.originalFormat=s.format;s.format='classic';s.activeArtists=[live.id];s.artistId=live.id;s.assignments={};s.partnerOffline={};s.offlineAt=null;changed=true;}}}
 if(s.format==='story'){const panel=Math.min(2,Math.floor((now-s.startedAt)/20000));if(panel!==s.panel){s.panel=panel;changed=true;}}
 if(s.format==='relay'&&now>=s.relayAt){s.relayAt+=20000;const next=pool.find(p=>!s.artists.includes(p.id));if(next&&s.artists.length<pool.length-1){s.artistId=next.id;s.activeArtists=[next.id];s.artists.push(next.id);s.offlineAt=null;changed=true;}}
 return changed;
}
export function sketchAdventureView(room,p,host,reveal){
 const s=room.sketch;if(!room.expedition||!s?.format)return {};
 const id=p?.id,isArtist=sketchArtist(s,id),assignment=s.assignments[id],palette=s.constraint==='palette'?COLORS.slice(0,3):s.format==='duo'?(assignment==='outline'?[COLORS[0],COLORS[6]]:COLORS.slice(1,6)):COLORS;
 return {canvasPart:s.format==='story'?s.panel:s.format==='compound'&&isArtist?s.activeArtists.indexOf(id):null,format:s.format,activeArtists:s.activeArtists,assignment:assignment||null,panel:s.panel,constraint:s.constraint,palette:isArtist?palette:COLORS,instruction:s.format==='story'?['Beginning: draw who or what.','Action: draw what happens.','Ending: draw the result.'][s.panel]:s.format==='compound'?'Draw your half of the phrase in your half of the canvas.':s.format==='duo'?'One artist outlines; the partner adds color.':s.format==='relay'?'Pass the same drawing along every 20 seconds.':s.constraint==='triangles'?'Draw using triangles only. Drag to make a triangle.':s.constraint==='continuous'?'One continuous stroke. Hold your pointer down to keep drawing.':s.constraint==='palette'?'Only three colors this round.':'Draw clues without writing the answer.',word:isArtist&&s.format==='compound'&&!host&&!reveal?assignment:undefined,gallery:reveal?(room.sketchGallery||[]).map(g=>({id:g.id,word:g.word,format:g.format,strokes:g.strokes})):undefined};
}
export function checkSketchAdventureStroke(room,p,msg){
 const s=room.sketch;if(!room.expedition||!s?.format)return;
 const view=sketchAdventureView(room,p,false,false);if(!view.palette.includes(msg.color))throw new Error('Use your assigned drawing palette.');
 if(s.constraint==='triangles'&&(msg.points.length!==4||msg.points[0][0]!==msg.points[3][0]||msg.points[0][1]!==msg.points[3][1]))throw new Error('This round uses closed triangles.');
 if(s.constraint==='continuous'){if(typeof msg.gesture!=='string'||!/^[a-zA-Z0-9_-]{6,80}$/.test(msg.gesture))throw new Error('Use one continuous pointer stroke.');const prior=s.gestures[p.id];if(prior&&(prior.id!==msg.gesture||prior.last[0]!==msg.points[0][0]||prior.last[1]!==msg.points[0][1]))throw new Error('Continue from the end of your continuous stroke, or clear the canvas to try again.');}
 const part=s.format==='story'?s.panel:s.format==='compound'?s.activeArtists.indexOf(p.id):null,segments=s.format==='story'?3:2;
 if(part!==null&&msg.points.some(([x])=>x<Math.ceil(1000*part/segments)||x>Math.floor(1000*(part+1)/segments)))throw new Error('Draw inside your highlighted panel.');
}
export function archiveSketchAdventure(room){
 const s=room.sketch;if(!room.expedition||!s||s.archived)return;s.archived=true;
 if(!s.strokes.length)return;room.sketchGallery=room.sketchGallery||[];
 room.sketchGallery.push({id:s.id,word:s.word,format:s.originalFormat||s.format||'classic',artistIds:[...s.artists],artistAccounts:s.artists.map(id=>room.players[id]?.accountId).filter(Boolean),strokes:s.strokes.slice(0,120).map(stroke=>({color:stroke.color,size:stroke.size,points:stroke.points.filter((_,i)=>i%2===0||i===stroke.points.length-1)}))});
 if(room.sketchGallery.length>8)room.sketchGallery.shift();room.expedition.sketch.panels++;for(const id of s.artists){const p=room.players[id];if(p?.expedition){p.expedition.stats.support++;p.expedition.stats.discoveries++;}}
 if(room.expedition.sketch.panels%3===0)celebrate(room,'mural','Your class mural comes alive!',`${room.expedition.sketch.panels} drawings join the gallery.`);
}
