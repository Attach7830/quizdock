import {FISH_BY_ID} from './fish-catalog.js';
const cache=new Map();
const BODIES=[
 'M18 40Q35 16 57 32Q80 55 108 28L115 35Q89 68 54 46Q32 30 18 46Z',
 'M23 39L67 10L107 38L67 66ZM27 38Q12 41 7 64L12 68Q17 47 32 43',
 'M36 38a28 27 0 1 0 56 0a28 27 0 1 0 -56 0',
 'M87 14Q55 4 58 29L50 46Q47 64 67 67Q85 67 77 52Q65 46 62 57Q73 56 68 62Q53 60 61 48L78 33L94 30L102 20Z',
 'M24 37L51 27L64 9L72 28L98 31L111 39L92 50L68 52L49 66L53 50L26 44L8 59L15 38L8 17Z',
 'M23 38Q52 18 92 31L124 33L98 38L108 46L61 52L23 43L8 61L13 40L8 19Z',
 'M31 38Q28 14 64 15Q93 15 101 39L87 55Q37 69 31 38ZM60 17Q57 1 90 7L96 16',
 'M34 38Q30 7 64 6Q98 8 100 38Q99 70 64 70Q33 68 34 38Z',
 'M22 41Q23 16 68 22L102 30L109 42L95 53L37 56Z',
 'M40 37Q68 14 94 29L104 40L92 51Q67 64 40 44L10 67L16 40L8 10Z',
 'M46 37Q35 7 68 6Q97 9 92 38L86 48L74 53L58 49Z',
 'M25 38C25 8 103 8 105 38S25 68 25 38Z'
];
function illustrate(f){
 const c=f.color,a=f.accent,p=[],add=(d,fill=c,stroke='#eefbff',opacity=1)=>p.push({d,fill,stroke,opacity});
 if(![3,4,5,9,10].includes(f.shape))add('M32 38L9 19L13 57Z',a);
 if([0,5,8,11].includes(f.shape))add('M47 25L64 9L77 28M47 51L67 66L78 49',a);
 if(f.shape===2)add('M37 20L28 12L32 29M55 12L55 3L63 11M83 16L92 8L88 28M37 56L29 65L46 60M71 64L75 73L81 60',a);
 if(f.shape===9)add('M42 29Q40 9 77 8L96 28M42 48Q47 74 85 67L97 49',a);
 if(f.shape===10)add('M47 37Q17 68 32 72Q50 74 55 48M59 44Q48 78 64 70L67 48M75 44Q84 73 94 68Q101 60 84 43M86 39Q108 59 118 50L96 33',a);
 add(BODIES[f.shape]);
 const marks=[
  'M45 30L49 46M56 26L61 48M69 27L74 48',
  'M46 36a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M61 43a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M69 30a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  'M39 37Q57 24 77 38Q65 51 44 42Z',
  'M44 39L54 30L63 40L72 31L79 41L68 49L59 40L50 48Z',
  'M45 34L55 34M51 42L62 42M65 32L76 32M68 45L78 45',
  'M43 38Q51 23 59 38T75 38M49 43Q58 31 68 44',
  'M44 36L53 29L58 37L53 45ZM64 38L72 29L78 38L72 46Z',
  'M44 34L76 42L47 45L70 29Z'
 ];
 if(f.shape!==3)add(marks[f.pattern],a,undefined,.78);
 if(f.shape===3)add('M58 31L43 28L49 43L58 38M63 45L70 47','none',a);
 if(f.shape===1)add('M48 35L68 16L82 37L68 58Z',a,undefined,.55);
 if(f.shape===8)add('M95 43Q119 40 124 51M92 48Q109 54 111 63','none',a);
 if(f.shape===6)add('M92 13a5 5 0 1 0 10 0a5 5 0 1 0 -10 0','#f6eea8',undefined);
 const eye=f.shape===3?[82,20]:f.shape===10?[78,28]:f.shape===0?[100,35]:[87,33];
 add(`M${eye[0]} ${eye[1]}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`,'#102840',undefined);
 add(`M${eye[0]+4} ${eye[1]-1}a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0`,'#fff',undefined);
 if(f.variant===1)add('M48 50L57 39L65 51Z',a);
 if(f.variant===2)add('M39 25L47 16L56 26Z',a);
 if(f.variant===3)add('M70 23L77 12L82 27Z',a);
 if(f.variant===4)add('M46 51L49 62L61 52Z',a);
 if(f.rare)add('M114 8L117 16L125 19L117 22L114 30L111 22L103 19L111 16Z',f.rarity==='mythic'?'#ffd0f0':'#ffe6a2',undefined);
 if(['legendary','mythic'].includes(f.rarity))add('M50 14L53 4L63 12L73 3L77 17Z','#ffdc8c');
 if(f.rarity==='mythic'){
  add('M15 37Q3 7 60 3M25 64Q96 81 122 42','none','#ffa6d8',.85);
  add('M14 8L17 14L23 17L17 20L14 26L11 20L5 17L11 14ZM103 59L106 64L112 67L106 70L103 75L100 70L94 67L100 64Z','#b9f6ff',undefined);
 }
 return p;
}

function prismatic(f){
 const colors=['#77f4ff','#ff8edd','#bd9bff','#a0ffd9'],i=f.id.length%4,shape=f.legacy?[11,5,1,0][f.shape]:f.shape;
 const p=[
  {d:'M28 29Q4 2 5 22Q5 43 30 48Q3 68 14 74Q34 73 42 50Z',fill:colors[(i+1)%4],stroke:'#eaffff',opacity:.7},
  {d:'M32 36Q8 16 14 12Q27 8 49 31M35 46Q11 59 17 68Q30 71 51 49',fill:colors[(i+2)%4],stroke:'#fff0ff',opacity:.8},
  ...illustrate({...f,legacy:false,shape,color:colors[i],accent:colors[(i+1)%4],pattern:f.legacy?7:(f.pattern+3)%8,variant:f.legacy?f.shape:(f.variant+2)%5}),
  {d:'M45 27L56 9L67 25L75 7L84 29L69 22L58 31Z',fill:'#e9ffff',stroke:colors[(i+2)%4],opacity:.85},
  {d:'M15 39Q10 9 64 3Q112 0 123 31M17 53Q49 78 96 68Q118 63 124 46',fill:'none',stroke:'#ffdf94',opacity:.85},
  {d:'M22 3L25 9L31 12L25 15L22 22L19 15L13 12L19 9ZM108 55L111 61L117 64L111 67L108 74L105 67L99 64L105 61Z',fill:'#fff6ce'},
  {d:'M42 36L51 30L58 36L51 42ZM64 42L70 35L76 42L70 49Z',fill:'#eaffff',opacity:.8}
 ];const x=42+f.artSeed%23,y=28+Math.floor(f.artSeed/23)%13;p.push({d:`M${x} ${y}l3 -4l3 4l-3 4Z`,fill:'#f8ffff',opacity:.9});return p;
}
export function fishParts(id,{shiny=false}={}){
 const key=shiny?id+':shiny':id;if(cache.has(key))return cache.get(key);const f=FISH_BY_ID.get(id);if(!f)return [];if(shiny){const p=prismatic(f);cache.set(key,p);return p;}if(!f.legacy){const p=illustrate(f);cache.set(id,p);return p;}
 const body=f.shape===2?'M27 39L60 10L96 39L60 66Z':f.shape===3?'M23 37Q44 6 87 25L105 38L86 49Q43 70 23 37Z':'M25 38C25 6 104 6 104 38S25 70 25 38Z';
 const p=[{d:'M30 38L7 16L10 58Z',fill:f.color,opacity:.7},{d:body,fill:f.color,stroke:'#efffff'},{d:'M48 18L60 4L74 18M48 57L60 71L75 56',fill:f.color,stroke:'#efffff'},{d:'M82 31a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',fill:'#102840'},{d:'M86.5 30a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',fill:'#ffffff'}];
 if(f.rare)p.push({d:'M113 9L116 17L124 20L116 23L113 31L110 23L102 20L110 17Z',fill:'#ffe6a2'});
 if(f.shape===1)p.push({d:'M99 35L123 32L101 40Z',fill:f.color,stroke:'#efffff'});
 if(f.shape===3)p.push({d:'M28 28L15 9L42 20M33 49L18 68L49 57',fill:f.color,stroke:'#efffff'});
 cache.set(id,p);return p;
}
export function fishMarkup(id,options={}){const p=fishParts(id,options);return p.length?`<svg class="fish-art${options.shiny?' shiny-fish':''}" viewBox="0 0 130 78" aria-hidden="true">${p.map(p=>`<path d="${p.d}" fill="${p.fill}"${p.stroke?` stroke="${p.stroke}" stroke-width="2" stroke-linejoin="round"`:''} opacity="${p.opacity??1}"/>`).join('')}</svg>`:'<span class="unknown-fish" aria-hidden="true">?</span>';}
const paths=new WeakMap();
export function drawFish(ctx,x,y,scale,id,tilt=0,options={}){const p=fishParts(id,options);if(!paths.has(p))paths.set(p,p.map(p=>new Path2D(p.d)));ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(scale,scale);ctx.translate(-65,-39);p.forEach((part,i)=>{ctx.globalAlpha=part.opacity??1;ctx.fillStyle=part.fill;ctx.fill(paths.get(p)[i]);if(part.stroke){ctx.strokeStyle=part.stroke;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke(paths.get(p)[i]);}});ctx.restore();}
