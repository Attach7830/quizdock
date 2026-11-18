import {itemById} from './item-catalog.js';
import {extraItemParts} from './extra-item-art.js';

// Original vector accessories use the same geometry on SVG portraits and canvas.
export function avatarItemParts(equipment,layer){
 const parts=[],path=(d,fill,stroke='#eaf7ff',width=1.5,opacity=1)=>parts.push({d,fill,stroke,width,opacity});
 const circle=(x,y,r,fill,stroke='#eaf7ff',width=1.5)=>path(`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 -${2*r} 0`,fill,stroke,width);
 const star=(x,y,r,color)=>path(`M${x} ${y-r}l${r*.3} ${r*.7} ${r*.7} ${r*.3}-${r*.7} ${r*.3}-${r*.3} ${r*.7}-${r*.3}-${r*.7}-${r*.7}-${r*.3} ${r*.7}-${r*.3}Z`,color,null,0);
 const duck=(x,y,scale=1)=>{path(`M${x-12*scale} ${y}q${7*scale} ${9*scale} ${22*scale} 0q${5*scale}-${8*scale}-${4*scale}-${11*scale}q-${8*scale}-${2*scale}-${10*scale} ${5*scale}Z`,'#ffdf78','#fff4bf',1);circle(x+5*scale,y-12*scale,7*scale,'#ffe899','#fff4bf',1);path(`M${x+10*scale} ${y-13*scale}l${7*scale} ${2*scale}-${7*scale} ${3*scale}Z`,'#ff9e62',null,0);circle(x+7*scale,y-14*scale,1.2*scale,'#23334e',null,0);};
 const items=Object.values(equipment||{});
 if(layer==='back')items.sort((a,b)=>Number(itemById(a)?.slot!=='aura')-Number(itemById(b)?.slot!=='aura'));
 for(const id of items){
  const item=itemById(id);if(!item||(['back','aura'].includes(item.slot)?'back':'front')!==layer)continue;
  parts.push(...extraItemParts(id));
  if(id==='paper-boat')path('M-31 -59L0 -80L31 -59L20 -51L-20 -51Z','#f8e8c6','#856c69',1.5);
  if(id==='banana-hat'){path('M-29 -66Q2 -49 23 -78Q30 -62 10 -53Q-11 -45 -29 -66Z','#ffe278','#fff5bf',2);path('M-28 -66L-33 -71M23 -78L27 -82','none','#715640',3);}
  if(id==='traffic-cone'){path('M-29 -53L-8 -82L13 -53Z','#ff9c62','#ffedd4',2);path('M-17 -69L0 -69L6 -60L-23 -60Z','#fff5dc',null,0);path('M-35 -52L20 -52L23 -46L-37 -46Z','#ef795d','#ffedd4',1.5);}
  if(id==='billion-party-hat'){path('M-26 -51L0 -83L27 -51Z','#cfa3ff','#fff0b5',2);path('M-14 -66L17 -57M-6 -76L8 -73','none','#ffe58e',4);circle(0,-81,4,'#fff1b4');for(const [x,y,c]of [[-38,-66,'#82f4da'],[36,-72,'#ffb0d1'],[-32,-80,'#ffe59c'],[42,-48,'#adbdff']])star(x,y,4,c);}
  if(id==='safety-goggles'){path('M-28 -34L28 -34','none','#ffe3b0',5);path('M-21 -40L-3 -40L-3 -25L-21 -25ZM3 -40L21 -40L21 -25L3 -25Z','#b6eefa','#fff4ca',2);path('M-3 -32L3 -32','none','#f4dfa3',3);}
  if(id==='tiny-mustache')path('M0 -19Q-7 -29 -13 -21Q-21 -14 -25 -23Q-26 -10 -14 -11Q-5 -10 0 -17Q5 -10 14 -11Q26 -10 25 -23Q21 -14 13 -21Q7 -29 0 -19Z','#55394e','#ffe0ba',1);
  if(id==='star-shades'){path('M-27 -33L27 -33','none','#ffe798',3);star(-12,-32,12,'#ffde88');star(12,-32,12,'#ffde88');circle(-12,-32,4,'#553c7c',null,0);circle(12,-32,4,'#553c7c',null,0);}
  if(id==='laser-eyes'){path('M-20 -33L-44 -40M20 -33L47 -44','none','#f58fe2',6,.6);path('M-20 -33L-44 -40M20 -33L47 -44','none','#fff0f6',2);path('M-20 -37L-3 -37L-3 -29L-20 -29ZM3 -37L20 -37L20 -29L3 -29Z','#fa80b4','#ffe7ef',2);}
  if(id==='rubber-duck')duck(40,13,1);
  if(id==='pizza-shield'){path('M26 -3L60 -13L47 37Z','#ffd481','#fff1c2',2);path('M26 -3L60 -13','none','#bf7a42',6);circle(43,2,4,'#e27975',null,0);circle(47,17,4,'#e27975',null,0);circle(36,10,3,'#e27975',null,0);}
  if(id==='magic-pencil'){path('M33 38L48 -49L56 -47L42 39L36 47Z','#f8d27d','#fff0b3',2);path('M48 -49L50 -61L58 -59L56 -47Z','#f6a8bc','#ffe3df',1.5);path('M33 38L42 39L36 47Z','#caa07e','#ffe5c0',1);star(49,-65,5,'#c6b2ff');}
  if(id==='giant-spoon'){path('M39 42L39 -28','none','#cfdaec',7);path('M39 42L39 -28','none','#f9ffff',2);path('M27 -45Q23 -70 39 -73Q55 -70 51 -45Q47 -29 39 -29Q31 -29 27 -45Z','#c6d7e8','#f6ffff',2);path('M32 -47Q29 -62 38 -65','none','#f4fbff',2);}
  if(id==='million-stick'){path('M38 43L43 4L39 -29L47 -71M40 -16L30 -34M44 -47L55 -56','none','#9b7555',7);path('M38 43L43 4L39 -29L47 -71','none','#e6bd86',2);path('M43 -58Q32 -74 30 -58Q35 -50 43 -58Z','#a6e7a6','#d7ffce',1);}
  if(id==='patchwork-cape'){path('M-25 -20L-42 43L-16 36L0 47L20 37L42 43L25 -20Z','#ad84d4','#eac6ff',2);path('M-17 0L0 -13L18 0L0 19Z','#f4cc85','#fff0bc',1.5);path('M-30 15L-18 19M22 26L34 30','none','#f4e5ff',2);}
  if(id==='cardboard-wings'){path('M-24 -17L-62 -41L-56 -4L-31 19ZM24 -17L62 -41L56 -4L31 19Z','#cba472','#f5d4a0',2);path('M-28 -9L-53 -29M28 -9L53 -29','none','#8f734e',3);path('M-47 -16L-39 -20L-34 -11L-42 -7ZM47 -16L39 -20L34 -11L42 -7Z','#f9e4bb',null,0);}
  if(id==='portable-throne'){path('M-45 40L-45 -46L-31 -54L0 -70L31 -54L45 -46L45 40L32 40L32 12L-32 12L-32 40Z','#bf8c50','#ffe3a5',3);path('M-34 -43L0 -58L34 -43L29 22L-29 22Z','#8c4f85','#edc6e0',2);star(0,-50,8,'#ffe99d');}
  if(id==='duck-council'){duck(-45,-8,.7);duck(46,-13,.7);duck(-35,29,.6);duck(40,35,.6);duck(-28,-61,.5);}
  if(id==='sparkle-cloud')for(const [x,y,r]of [[-46,-41,8],[46,-53,7],[-46,20,6],[48,28,9],[0,-78,4]])star(x,y,r,'#f1d1ff');
  if(id==='orbiting-homework')for(const [x,y]of [[-48,-38],[42,-50],[-47,15],[42,23]]){path(`M${x-9} ${y-11}h17v22h-17Z`,'#f4e6cb','#d6c3aa',1);path(`M${x-5} ${y-5}h9M${x-5} ${y}h9M${x-5} ${y+5}h7`,'none','#a992a7',1);}
  if(id==='galactic-potatoes')for(const [x,y,r]of [[-46,-34,10],[45,-47,11],[-43,24,9],[44,27,10]]){circle(x,y,r,'#d7b37d','#f2dcaa',1.5);circle(x-3,y-2,1.3,'#96784e',null,0);circle(x+3,y+4,1.2,'#96784e',null,0);star(x+10,y-12,3,'#c2c1ff');}
 }
 return parts;
}
