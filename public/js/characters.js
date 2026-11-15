// Original character designs, shared by the shop portraits and live game canvas.
// Geometry is declarative so an equipped character has the same silhouette in both.
const geometry=new Map(),paths=new WeakMap();
const color=(value,fallback)=>/^#[a-f0-9]{6}$/i.test(value||'')?value:fallback;
export function characterParts(skin={}){
 skin=skin||{};
 const key=[skin.id,skin.primary,skin.secondary,skin.accent].join(':');if(geometry.has(key))return geometry.get(key);
 const p=color(skin.primary,'#69e3cb'),s=color(skin.secondary,'#1d6172'),a=color(skin.accent,'#e6fff7'),id=skin.id||'mint',parts=[];
 const path=(d,fill,stroke=null,width=2,opacity=1)=>parts.push({d,fill,stroke,width,opacity});
 const circle=(x,y,r,fill,stroke=null,width=2,opacity=1)=>path(`M${x-r} ${y}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 -${r*2} 0`,fill,stroke,width,opacity);
 path('M-34 47a34 6 0 1 0 68 0a34 6 0 1 0 -68 0','#07152c',null,0,.35);
 if(['nebula','frostblade','stormwing','sunforge','kitsune'].includes(id))circle(0,-12,51,a,null,0,.08);
 if(['orchid','midnight','nebula','forest'].includes(id))path('M-21 -13L-39 37L-22 33L-12 46L0 38L18 45L39 36L22 -13Z',s,a,1.5);
 if(id==='stormwing'){
  path('M-20 -15L-59 -39L-48 -8L-61 5L-28 13L-18 2Z',s,a);path('M20 -15L59 -39L48 -8L61 5L28 13L18 2Z',s,a);
  path('M-29 -8L-49 -24M29 -8L49 -24','none',a,3);
 }
 if(id==='kitsune'){
  path('M-19 30Q-64 41 -48 3Q-34 10 -31 19Q-42 -17 -52 -27Q-13 -14 -14 26Z',s,a,2);
  path('M-48 3Q-56 20 -47 28L-35 29Z',a);
 }
 path('M-25 -6L-36 2L-33 23L-22 20Z',s,a,1.5);path('M25 -6L36 2L33 23L22 20Z',s,a,1.5);
 path('M-20 26L-22 43L-6 43L-3 26Z',s,a,1.5);path('M20 26L22 43L6 43L3 26Z',s,a,1.5);
 path('M-23 -13Q0 -22 23 -13L27 24Q22 36 0 37Q-22 36 -27 24Z',p,a,2);
 path('M13 -14L24 -10L27 24L15 29Z',s,null,0,.7);
 path('M-21 22L21 22L21 28L-21 28Z',s);path('M-5 20L5 20L5 30L-5 30Z',a);
 path('M-10 -5L0 -10L10 -5L7 10L0 15L-7 10Z',s,a,1.5);
 if(['frostblade','sunforge','ember'].includes(id)){
  path('M-24 -17L-38 -11L-34 2L-19 -1L-13 -12Z',p,a,2);path('M24 -17L38 -11L34 2L19 -1L13 -12Z',p,a,2);
 }
 path('M-25 -23L-25 -37Q-24 -54 0 -54Q24 -54 25 -37L25 -23Q21 -12 0 -12Q-21 -12 -25 -23Z',p,a,2);
 path('M12 -50Q24 -46 25 -35L25 -23L15 -16Z',s,null,0,.7);
 path('M-19 -37Q-19 -43 -12 -43L12 -43Q19 -43 19 -37L19 -27Q19 -21 12 -21L-12 -21Q-19 -21 -19 -27Z','#102840',a,1.5);
 if(['frostblade','sunforge'].includes(id)){path('M-14 -34L-3 -31L-14 -28Z',a);path('M14 -34L3 -31L14 -28Z',a);}
 else{circle(-8,-32,3,a);circle(8,-32,3,a);}
 path('M-7 -17L7 -17','none',a,2);
 if(id==='mint'){path('M-17 -13L17 -13L14 -5L-15 -6L-27 4L-30 -4Z',a);path('M-16 -53L-21 -64','none',s,3);circle(-22,-65,4,a);}
 if(id==='coral'){path('M-37 -47L-27 -66L0 -57L28 -66L38 -47L23 -44L-24 -44Z',s,a,2);path('M-7 -54L0 -61L7 -54L0 -47Z',a);path('M-14 2L-14 16M14 2L14 16','none',a,3);}
 if(id==='solar'){path('M-17 -54L0 -62L17 -54L12 -44L-12 -44Z',s,a);path('M-32 -28L-38 -23L-32 -17M32 -28L38 -23L32 -17','none',a,4);}
 if(id==='orchid'){path('M-25 -47L-26 -67L-12 -57L0 -74L12 -57L26 -67L25 -47Z',a,s,2);circle(0,-56,4,p);}
 if(id==='arctic'){path('M-29 -19L-33 -42L-23 -58L0 -65L23 -58L33 -42L29 -19L21 -23L25 -40L16 -51L0 -56L-16 -51L-25 -40L-21 -23Z',a,s,1.5);path('M-6 -4L6 8M6 -4L-6 8M0 -7L0 11','none',a,2);}
 if(id==='ember'){path('M-20 -45Q-42 -45 -35 -68L-25 -60L-18 -52Z',a,s,2);path('M20 -45Q42 -45 35 -68L25 -60L18 -52Z',a,s,2);path('M-7 6L-2 -7L3 2L8 -3L8 11L0 17L-8 12Z',a);}
 if(id==='forest'){path('M-19 -49L-35 -67L-38 -50L-24 -40M19 -49L35 -67L38 -50L24 -40',s,a,2);path('M0 -52Q-11 -65 0 -73Q13 -66 0 -52Z',a);path('M-2 14L-8 4L1 -4L8 4Z',a);}
 if(id==='midnight'){path('M-29 -20L-33 -40L-19 -61L0 -69L21 -60L33 -40L29 -20L21 -27L23 -38L13 -48L-13 -48L-23 -38L-21 -27Z',s,a,2);path('M-4 1L0 -6L4 1L11 4L4 7L0 14L-4 7L-11 4Z',a);}
 if(id==='nebula'){
  path('M-33 -45L-8 -78L3 -68L28 -45L40 -40L-35 -38Z',s,a,2);path('M-10 -61L-4 -69L0 -60L8 -57L-2 -53Z',a);
  path('M38 37L38 -47','none',s,7);path('M38 37L38 -47','none',a,2);circle(38,-55,10,p,a,2);circle(36,-58,3,a);
 }
 if(id==='frostblade'){
  path('M-21 -50L0 -69L21 -50L9 -44L0 -51L-9 -44Z',s,a,2);
  path('M-40 -54L-48 -36L-43 16L-35 16L-33 -36Z',a,p,2);path('M-40 -43L-39 12','none','#6fa6d6',2);path('M-51 17L-27 17M-39 18L-39 34','none',s,5);
 }
 if(id==='stormwing'){path('M-18 -49L-30 -64L-10 -56L0 -63L10 -56L30 -64L18 -49Z',s,a,2);path('M-9 1L0 -8L9 1L4 6L0 16L-4 6Z',a);}
 if(id==='sunforge'){
  path('M-20 -49L-24 -67L-8 -58L0 -77L8 -58L24 -67L20 -49Z',a,s,2);
  path('M26 -5L47 -12L58 4L53 25L39 38L23 24L20 7Z',s,a,3);path('M39 -1L47 9L39 25L31 9Z',a);
 }
 if(id==='kitsune'){
  path('M-23 -43L-32 -73L-9 -57Z',p,a,2);path('M23 -43L32 -73L9 -57Z',p,a,2);
  path('M-29 -30L-19 -48L0 -37L19 -48L29 -30L16 -16L0 -13L-16 -16Z',a,s,1.5);path('M-20 -32L-6 -28L-15 -23Z',s);path('M20 -32L6 -28L15 -23Z',s);path('M-4 -20L0 -17L4 -20Z',p);
 }
 if(geometry.size>=64)geometry.delete(geometry.keys().next().value);geometry.set(key,parts);return parts;
}
export function characterMarkup(skin){
 return `<svg class="character-art" viewBox="-66 -84 132 140" aria-hidden="true" focusable="false">${characterParts(skin).map(p=>`<path d="${p.d}" fill="${p.fill}"${p.stroke?` stroke="${p.stroke}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"`:''} opacity="${p.opacity}"/>`).join('')}</svg>`;
}
export function drawCharacter(ctx,x,y,scale,skin,tilt=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(scale,scale);
 const parts=characterParts(skin);if(!paths.has(parts))paths.set(parts,parts.map(p=>new Path2D(p.d)));
 for(const [i,part] of parts.entries()){const path=paths.get(parts)[i];ctx.globalAlpha=part.opacity;ctx.fillStyle=part.fill;if(part.fill!=='none')ctx.fill(path);if(part.stroke){ctx.strokeStyle=part.stroke;ctx.lineWidth=part.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(path);}}
 ctx.restore();
}
