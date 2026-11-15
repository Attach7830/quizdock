import {FISH_SPECIES} from './gameplay-catalog.js';
const cache=new Map();
function parts(id){
 if(cache.has(id))return cache.get(id);const f=FISH_SPECIES.find(x=>x.id===id);if(!f)return [];
 const body=f.shape===2?'M27 39L60 10L96 39L60 66Z':f.shape===3?'M23 37Q44 6 87 25L105 38L86 49Q43 70 23 37Z':'M25 38C25 6 104 6 104 38S25 70 25 38Z';
 const p=[{d:'M30 38L7 16L10 58Z',fill:f.color,opacity:.7},{d:body,fill:f.color,stroke:'#efffff'},{d:'M48 18L60 4L74 18M48 57L60 71L75 56',fill:f.color,stroke:'#efffff'},{d:'M82 31a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',fill:'#102840'},{d:'M86.5 30a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',fill:'#ffffff'}];
 if(f.rare)p.push({d:'M113 9L116 17L124 20L116 23L113 31L110 23L102 20L110 17Z',fill:'#ffe6a2'});
 if(f.shape===1)p.push({d:'M99 35L123 32L101 40Z',fill:f.color,stroke:'#efffff'});
 if(f.shape===3)p.push({d:'M28 28L15 9L42 20M33 49L18 68L49 57',fill:f.color,stroke:'#efffff'});
 cache.set(id,p);return p;
}
export function fishMarkup(id){const p=parts(id);return p.length?`<svg class="fish-art" viewBox="0 0 130 78" aria-hidden="true">${p.map(p=>`<path d="${p.d}" fill="${p.fill}"${p.stroke?` stroke="${p.stroke}" stroke-width="2" stroke-linejoin="round"`:''} opacity="${p.opacity??1}"/>`).join('')}</svg>`:'<span class="unknown-fish" aria-hidden="true">?</span>';}
const paths=new WeakMap();
export function drawFish(ctx,x,y,scale,id,tilt=0){const p=parts(id);if(!paths.has(p))paths.set(p,p.map(p=>new Path2D(p.d)));ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(scale,scale);ctx.translate(-65,-39);p.forEach((part,i)=>{ctx.globalAlpha=part.opacity??1;ctx.fillStyle=part.fill;ctx.fill(paths.get(p)[i]);if(part.stroke){ctx.strokeStyle=part.stroke;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke(paths.get(p)[i]);}});ctx.restore();}
