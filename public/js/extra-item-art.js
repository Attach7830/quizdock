// Original vector props. These paths are also drawn by the live canvas renderer.
const cache=new Map();
export function extraItemParts(id){
 if(cache.has(id))return cache.get(id);
 const parts=[],ink='#eaf7ff',gold='#ffe39a',mint='#a1edce',pink='#f3afcf',blue='#9bdcf2',purple='#bea6ee',dark='#293850';
 const path=(d,fill,stroke=ink,width=1.4,opacity=1)=>parts.push({d,fill,stroke,width,opacity});
 const line=(d,color=ink,width=2)=>path(d,'none',color,width);
 const rect=(x,y,w,h,fill,stroke=ink)=>path(`M${x} ${y}h${w}v${h}h-${w}Z`,fill,stroke);
 const circle=(x,y,r,fill,stroke=ink,width=1.4)=>path(`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 -${2*r} 0`,fill,stroke,width);
 const oval=(x,y,rx,ry,fill,stroke=ink)=>path(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 -${2*rx} 0`,fill,stroke);
 const star=(x,y,r,color=gold)=>path(`M${x} ${y-r}l${r*.3} ${r*.7} ${r*.7} ${r*.3}-${r*.7} ${r*.3}-${r*.3} ${r*.7}-${r*.3}-${r*.7}-${r*.7}-${r*.3} ${r*.7}-${r*.3}Z`,color,null,0);
 const eye=(x,y)=>{circle(x,y,1.4,dark,null,0);};
 const fish=(x,y,s=1)=>{path(`M${x-5*s} ${y}l-${6*s}-${5*s}v${10*s}Z`,pink);oval(x,y,7*s,4*s,gold);eye(x+3*s,y-1*s);};
 const toast=(x,y,s=1)=>{path(`M${x-8*s} ${y+9*s}v-${11*s}q-${4*s}-${11*s} ${8*s}-${11*s}q${12*s} 0 ${8*s} ${11*s}v${11*s}Z`,'#c48759');rect(x-5*s,y-6*s,10*s,12*s,'#ffe8b5',null);};
 const duck=(x,y,s=1)=>{oval(x,y,9*s,5*s,gold);circle(x+4*s,y-7*s,5*s,gold);path(`M${x+8*s} ${y-8*s}l${5*s} ${2*s}-${5*s} ${2*s}Z`,'#f2a26b',null,0);eye(x+5*s,y-8*s);};
 const cloud=(x,y,s=1)=>{path(`M${x-15*s} ${y+5*s}q-${5*s}-${10*s} ${5*s}-${11*s}q${3*s}-${12*s} ${13*s}-${7*s}q${9*s}-${3*s} ${11*s} ${6*s}q${10*s} ${1*s} ${6*s} ${12*s}Z`,blue);};
 const spoon=(x,y,s=1)=>{line(`M${x} ${y+12*s}v-${18*s}`,'#d8e7ed',3*s);oval(x,y-9*s,4*s,6*s,'#d8e7ed');};
 const jar=(x,y,s=1)=>{path(`M${x-7*s} ${y-9*s}v${5*s}q-${3*s} ${2*s}-${3*s} ${6*s}v${12*s}h${20*s}v-${12*s}q0-${4*s}-${3*s}-${6*s}v-${5*s}Z`,'#629cad99');rect(x-8*s,y-12*s,16*s,4*s,purple);};
 const art={
  'tin-foil-hat':()=>{path('M-29 -53L-19 -68L-9 -61L2 -82L11 -64L20 -71L30 -53Z','#cadce7');line('M-19 -68L-13 -54M2 -82L5 -55M20 -71L17 -54','#7e99b0');},
  'toast-hat':()=>{toast(0,-65,1.15);rect(-4,-72,9,7,gold);},
  'frog-hat':()=>{oval(0,-58,29,10,mint);circle(-16,-70,9,mint);circle(16,-70,9,mint);circle(-16,-72,4,ink);circle(16,-72,4,ink);eye(-16,-72);eye(16,-72);line('M-10 -58q10 6 20 0',dark);},
  'spaghetti-hat':()=>{path('M-29 -62h58l-7 12h-44Z',pink);for(let i=0;i<5;i++)line(`M${-20+i*10} -62q-12-18 2-14t2 14`,gold,3);circle(-10,-70,4,'#db7668');circle(16,-66,4,'#db7668');},
  'fishbowl-helmet':()=>{path('M-25 -56Q-39 -77-23 -80h46q16 3 2 24Z','#77bed688');line('M-22 -79h44M-25 -56h50',blue,3);fish(5,-66,1.1);circle(-17,-71,2,ink);},
  'tiny-planet':()=>{circle(0,-65,15,mint);path('M-9 -76l5 9 13-3-2 9-11 4-5-8Z','#679b89',null,0);oval(0,-64,31,6,'none',gold);},
  'wizard-traffic-light':()=>{path('M-23 -51L-10 -81h20l13 30Z',purple);rect(-5,-77,10,24,dark);for(const [y,c]of [[-72,'#ef9494'],[-65,gold],[-58,mint]])circle(0,y,2.5,c,null,0);line('M-30 -51h60',gold,4);},
  'teapot-tower':()=>{path('M-15 -55v-16q15-10 30 0v16Z',pink);path('M14 -70q24-7 18 8l-18 4',pink);path('M-15 -68q-17-10-16 1t16 5','none',gold,3);oval(0,-74,17,4,purple);circle(0,-80,3,gold);},
  'satellite-dish':()=>{line('M0 -53v-16M-7 -53h14',gold,3);path('M-27 -76Q0 -45 27 -76Z',blue);line('M0 -70v-12',gold);circle(0,-81,2,pink);line('M34 -79q8 8 0 16M40 -82q12 13 0 24',mint);},
  'disco-ufo':()=>{path('M-14 -66q0-17 14-17t14 17',blue);oval(0,-64,32,8,purple);for(const x of [-22,-11,0,11,22])circle(x,-63,2,gold,null,0);path('M-13 -57L-25 -49h50l-12-8',mint,null,0,.35);},
  'royal-pancakes':()=>{for(const y of [-55,-62,-69])oval(0,y,25,5,'#d2a271');path('M-20 -71q9-6 16 0t24 0v6q-7-5-9 0t-8-1-9 1-14 0Z','#9f6654',null,0);path('M-10 -76l-2-7 8 4 4-4 4 4 8-4-2 7Z',gold);},
  'emotional-support-moon':()=>{path('M16 -81Q-21 -85-24 -65Q-21 -42 16 -52Q-12 -55-5 -72Q0 -80 16 -81Z',gold);circle(-15,-67,3,'#d9bb7d',null,0);star(25,-73,6);star(31,-55,3,mint);},
  'billionaires-bucket':()=>{path('M-23 -78h46l-5 26h-36Z',blue);line('M-25 -78h50',gold,3);path('M-27 -75Q-40 -52 0 -50Q40 -52 27 -75','none',gold,2);rect(-6,-69,12,9,gold);},
  'trillion-point-tophat':()=>{rect(-19,-81,38,29,dark,gold);rect(-20,-62,40,8,purple,gold);oval(0,-52,34,5,dark,gold);star(0,-69,7);for(const x of [-37,37]){star(x,-75,5,mint);star(x,-57,3,pink);}},
  'googly-eyes':()=>{circle(-12,-33,11,ink);circle(12,-33,11,ink);circle(-15,-29,4,dark,null,0);circle(15,-37,4,dark,null,0);},
  'pickle-monocle':()=>{oval(12,-33,9,13,mint);for(const [x,y]of [[9,-39],[16,-32],[10,-26]])circle(x,y,1.5,'#65a78e',null,0);line('M19 -22q12 8 6 17',gold);},
  'baguette-mustache':()=>{path('M0 -20Q-26 -32-29 -20Q-27 -8 0 -17Q27 -8 29 -20Q26 -32 0 -20Z','#dba770');line('M-20 -23l4 7M-11 -22l3 5M11 -22l-3 5M20 -23l-4 7',gold);},
  'snorkeling-tuba':()=>{path('M-22 -39h42v14h-42Z','#7fc5d5aa',blue);line('M24 -29v-24h9v33q0 18-15 9',gold,5);path('M25 -55l-6-10h20l-6 10Z',gold);},
  'disco-visor':()=>{path('M-27 -41h54l-3 18h-48Z',purple);for(const x of [-18,-6,6,18]){rect(x-4,-38,7,5,x<0?blue:pink,null);rect(x-4,-30,7,4,gold,null);}star(30,-46,4);},
  'fish-tank-glasses':()=>{for(const x of [-13,13]){rect(x-11,-44,22,22,'#71bfd499');fish(x,-32,.7);circle(x-5,-39,1.7,ink);}line('M-2 -34h4',gold,3);},
  'emotional-support-eyebrows':()=>{path('M-27 -47Q-13 -65-2 -43L-7 -39Q-17 -49-27 -42ZM2 -43Q18 -60 28 -43L27 -37Q13 -46 7 -38Z','#624b72',gold);},
  'waffle-mask':()=>{rect(-24,-43,48,30,'#deb17b');for(const x of [-17,-5,7])for(const y of [-37,-26])rect(x,y,7,6,'#ae795b',gold);line('M-27 -30h-5M27 -30h5',gold,3);},
  'tiny-weather':()=>{cloud(-17,-44,.6);circle(22,-42,7,gold);line('M-23 -37l-4 9M-15 -35l-4 10',blue);line('M22 -54v-4M33 -43h5M30 -51l4-4',gold);path('M-6 -27l6-10 1 7h7l-8 13 1-10Z',gold);},
  'celestial-sneeze':()=>{path('M-10 -26Q0 -38 10 -26L0 -19Z',pink);for(const [x,y,r]of [[-30,-28,6],[31,-22,7],[-18,-47,4],[20,-46,5],[0,-53,3]])star(x,y,r,x<0?blue:gold);},
  'diamond-nostril':()=>{path('M-12 -32L-6 -41H6L12 -32L0 -19Z',blue);line('M-12 -32h24M-6 -41L0 -19L6 -41',ink);star(23,-42,5);},
  'bureaucratic-beard':()=>{path('M-25 -24l9 6 16-4 16 4 9-6-6 35L0 23-19 11Z','#c2b9d3');for(const [x,y]of [[-15,-13],[3,-9],[-7,3]]){rect(x,y,12,13,'#f6e7bd');line(`M${x+2} ${y+4}h8m-8 4h6`,'#8e82a2',1);}rect(12,2,13,6,pink);},
  'squeaky-hammer':()=>{line('M41 35v-55',gold,5);rect(26,-29,31,17,pink);oval(26,-20,4,9,gold);},
  'certified-pebble':()=>{path('M27 8q0-20 17-19t15 20l-10 9h-17Z','#9eabbf');path('M36 5l5 5 10-12','none',mint,3);path('M43 17l-4 13 7-3 6 5-2-15',gold);},
  'pocket-tornado':()=>{path('M45 27q-15-10-5-16t0-13q-20-11 1-18t15 8q-6 7-1 12t-10 27Z',blue);line('M31 -12q15 9 27-3M36 3q12 8 20-1M40 16h10',ink);},
  'baguette-saber':()=>{path('M34 28L29 22L45 -59Q51 -69 57 -59L43 25Z','#dba770');line('M43 -47l10 4M41 -33l10 4M38 -17l10 4M36 -3l10 4',gold);line('M27 25l22 4M37 29l-2 13',purple,4);},
  'tiny-whiteboard':()=>{rect(27,-19,35,38,'#e9f3eb',purple);line('M30 -16h29v32H30Z',purple,1);line('M33 -5h15M33 2h22M33 9h12',dark);line('M44 20v18',purple,4);},
  'fish-on-a-stick':()=>{line('M43 40v-80','#b88e6b',4);fish(43,-43,1.5);rect(38,-55,10,4,dark,gold);},
  'plunger-of-destiny':()=>{line('M43 42v-76',gold,5);path('M26 -36q17-24 34 0v5H26Z',pink);star(43,-63,7);},
  'bottomless-mug':()=>{rect(28,-9,25,29,purple);path('M53 -4q14-4 8 16l-8 1','none',gold,4);line('M34 -16q-9-10 0-18t0-19M46 -16q9-10 0-18t0-19',blue);star(38,-47,4);},
  'emotional-support-brick':()=>{path('M26 -7L48 -16L62 -8V17L40 25L26 17Z','#c7887c');line('M26 -7L40 1L62 -8M40 1v24','#ffe2ba');path('M38 6q3-5 6 0t6 0q3 6-6 12Z',pink,null,0);},
  'megaphone-of-whispers':()=>{path('M28 -10L57 -25V10L28 -3Z',gold);oval(57,-8,5,17,pink);rect(33,-2,7,24,purple);line('M43 -8h6',ink,1);circle(49,-8,1,ink);},
  'lobster-gavel':()=>{line('M42 40v-55',gold,5);oval(42,-24,8,14,pink);path('M37 -28Q19 -31 27 -45L31 -35L35 -45Q45 -35 37 -28ZM47 -28Q65 -31 57 -45L53 -35L49 -45Q39 -35 47 -28Z',pink);line('M37 -17l-9 8M47 -17l10 8',pink);eye(39,-28);eye(45,-28);},
  'rubber-chicken':()=>{path('M38 31l2-20q-18-8-8-26 8-8 7-22-7-17 5-18 15 0 7 16l4 26q5 16-7 24l-1 20Z',gold);path('M43 -55l-4-8 6 2 5-4 3 10',pink);path('M50 -48l10 5-10 3Z','#ec9a68');eye(47,-49);line('M38 32h-7M46 32h7','#ec9a68',3);},
  'ten-million-fork':()=>{path('M40 42v-70q-13 0-13-13v-28h5v26h6v-26h5v26h6v-26h5v28q0 13-9 13v70Z',gold);star(53,-77,4,mint);},
  'billion-point-nothing':()=>{rect(27,-50,34,65,'#a8d5e518',gold);line('M30 -47l27 58M57 -47L30 11','#d9faff44',1);rect(30,17,28,7,purple);rect(39,25,9,18,gold);circle(44,-18,6,'none',purple);},
  'backpack-snail':()=>{oval(0,31,48,12,mint);circle(-34,14,22,'#d5ac7b');path('M-34 2q-19 1-12 18t23-2q1-15-13-11t-3 12','none',gold,2);line('M37 23l6-15M43 23l12-14',mint,3);circle(43,7,3,mint);circle(55,9,3,mint);},
  'emergency-door':()=>{rect(-33,-66,66,110,'#aa8370',gold);rect(-26,-58,52,94,dark);rect(-20,-50,40,39,'#745d68');rect(-20,-4,40,33,'#745d68');circle(20,-7,3,gold);},
  'sandwich-jetpack':()=>{for(const x of [-45,32]){rect(x,-35,14,54,'#d5a678');rect(x,-29,14,8,mint);rect(x,-18,14,7,pink);rect(x,-7,14,5,gold);path(`M${x} 21l7 23 7-23Z`,gold);}},
  'inflatable-castle':()=>{path('M-55 40v-71h18v16h20v-28h34v28h20v-16h18v71Z',purple);for(const x of [-46,0,46]){path(`M${x-12} -31l12-19 12 19Z`,pink);circle(x,-51,3,gold);}rect(-56,32,112,10,blue);},
  'tiny-tornado-engine':()=>{for(const x of [-44,44]){rect(x-11,-32,22,59,purple);path(`M${x-9} -23q23 7 0 15t0 15q23 6 0 13`,'none',blue,3);path(`M${x-8} 29l8 16 8-16Z`,mint);}},
  'mailbox-of-mystery':()=>{line('M-43 -10v56',gold,5);path('M-59 -6v-33q16-24 32 0v33Z',blue);path('M-59 -6h32v-31q-16-19-32 0',purple);line('M-27 -42v-25h18v9h-18',pink,3);rect(33,-26,22,14,gold);line('M33 -26l11 8 11-8',pink);},
  'shopping-cart-wings':()=>{for(const sign of [-1,1]){path(`M${sign*25} -9l${sign*34} -34 ${-sign*5} 44 ${-sign*29} 15Z`,'#94b5c655');for(const y of [-25,-12])line(`M${sign*28} ${y+6}l${sign*28} -16`,blue);circle(sign*34,22,6,dark,gold);circle(sign*53,10,6,dark,gold);line(`M${sign*24} -6l${sign*35} -34`,gold,3);}},
  'aquarium-backpack':()=>{rect(-50,-46,100,81,'#72c7dc66');rect(-54,-51,108,8,purple);rect(-54,34,108,8,purple);fish(-40,-12,.8);fish(39,14,1);for(const [x,y]of [[-42,-30],[42,-25],[-36,23]])circle(x,y,3,blue);},
  'moon-cheese':()=>{path('M-54 34L-23 -61L53 34Z','#e4bd71');for(const [x,y,r]of [[-28,-19,6],[-38,14,8],[31,20,7],[3,7,5],[-18,-43,4]])circle(x,y,r,'#b99455',gold);},
  'portable-volcano':()=>{path('M-60 43L-25 -29H25L60 43Z','#8b7794');path('M-25 -29q25 12 50 0l-5 23-12-6-9 27-9-32-13 16Z','#f1a282');path('M-16 -37q-27-18-8-29t27 4q24-18 32 2t-23 24Z','#d5b5ca',null,0);star(-34,-70,5,gold);star(30,-73,4,gold);},
  'couch-of-destiny':()=>{path('M-56 34v-51q0-15 14-15h84q14 0 14 15v51Z',purple);rect(-61,-4,20,39,pink);rect(41,-4,20,39,pink);rect(-40,16,80,20,'#9c83bf');line('M-47 36v9M47 36v9',gold,5);},
  'hundred-million-fridge':()=>{rect(-39,-79,78,122,'#c2dee7');rect(-32,-72,64,34,'#aac5db');rect(-32,-33,64,68,'#aac5db');line('M-23 -64v16M-23 -24v25',gold,4);rect(19,-22,10,14,pink);rect(17,8,12,13,mint);},
  'floating-spoons':()=>{spoon(-45,-39,.7);spoon(46,-42,.65);spoon(-44,26,.6);spoon(46,23,.7);},
  'soap-bubble-parade':()=>{for(const [x,y,r]of [[-45,-43,10],[44,-48,11],[-47,19,9],[42,30,12],[0,-76,5]]){circle(x,y,r,'#9bdcf233',blue);line(`M${x-r*.5} ${y}q0-${r*.6} ${r*.7}-${r*.7}`,pink,1.6);}},
  'suspicious-pigeons':()=>{for(const [x,y]of [[-47,-39],[45,-51],[-43,28],[44,30]]){oval(x,y,9,7,'#b2b7d1');circle(x+4,y-8,5,'#b2b7d1');path(`M${x+8} ${y-9}l5 2-5 2Z`,gold);eye(x+5,y-9);line(`M${x-4} ${y+6}v5m7-5v5`,pink);}},
  'miniature-rain':()=>{cloud(-43,-43,.7);cloud(40,-57,.6);for(const [x,y]of [[-54,-25],[-43,-19],[-31,-25],[33,-41],[45,-37],[-42,23]])line(`M${x} ${y}l-3 8`,blue);},
  'orbiting-tacos':()=>{for(const [x,y]of [[-46,-37],[43,-50],[-44,28],[43,30]]){path(`M${x-10} ${y-4}q10-13 20 0l-2 13h-16Z`,gold);path(`M${x-9} ${y-3}l4-4 4 3 5-4 5 5`,mint);circle(x-3,y,2,pink,null,0);}},
  'tiny-office':()=>{for(const [x,y]of [[-47,-32],[44,-43],[-43,32],[44,31]]){rect(x-10,y,20,4,'#b8977d');line(`M${x-8} ${y+4}v8M${x+8} ${y+4}v8`,'#b8977d');rect(x-5,y-12,10,9,blue);line(`M${x} ${y-3}v3`,ink);}},
  'confetti-emergency':()=>{for(let i=0;i<14;i++){const x=i%2?39+(i%3)*8:-39-(i%3)*8,y=-71+Math.floor(i/2)*17;path(`M${x} ${y}l5 3-3 7-5-3Z`,[mint,pink,gold,blue][i%4],null,0);}line('M-46 4q-20 15 0 20M44 -25q20 15 0 20',purple,2);},
  'toast-satellites':()=>{for(const [x,y]of [[-46,-37],[43,-49],[-43,28],[43,30]]){toast(x,y,.65);rect(x-16,y-3,7,9,blue);rect(x+9,y-3,7,9,blue);}},
  'mathematical-panic':()=>{line('M-56 -51h18M-47 -60v18M37 -48l18 18M55 -48L37 -30',pink,3);line('M-56 20h19m-19 7h19M38 25h20',mint,3);circle(48,17,2,mint);circle(48,33,2,mint);path('M-8 -76q5-8 10-1t8-1','none',gold,2);},
  'cosmic-jellyfish':()=>{for(const [x,y]of [[-45,-44],[42,-55],[-42,21],[44,23]]){path(`M${x-11} ${y}q0-20 11-20t11 20Z`,purple);for(const dx of [-6,0,6])line(`M${x+dx} ${y}q-7 7 0 14`,pink,1.5);eye(x-3,y-6);eye(x+3,y-6);}},
  'duck-black-hole':()=>{oval(0,-16,62,43,'#090e21',purple);oval(0,-16,61,14,'none',gold);duck(-46,-35,.65);duck(46,13,.65);star(-38,29,5,pink);star(39,-65,5,mint);},
  'billion-point-loading':()=>{for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=Math.round(Math.cos(angle)*53),y=-15+Math.round(Math.sin(angle)*57);circle(x,y,3.5,[mint,blue,purple,pink][Math.floor(i/3)],null,0);}rect(-28,39,56,7,dark,gold);rect(-26,41,12,3,mint,null);},
  'origami-dragon':()=>{path('M-31 -52L-28 -73L-9 -62L1 -82L12 -66L31 -73L23 -54L3 -49Z',mint);path('M-28 -73L-9 -54L1 -82L5 -58L31 -73',blue);eye(16,-61);},
  'library-castle':()=>{path('M-30 -52v-25h13v8h10v-13H7v13h10v-8h13v25Z',purple,gold);rect(-7,-63,14,11,blue);line('M-24 -72h3m3 9h5m27-9h3m-9 9h5',gold,2);star(0,-77,3);},
  'quest-snail':()=>{oval(0,-55,30,6,mint);circle(-8,-67,14,purple);path('M-8 -76q-13 0-9 12t15-2q0-8-7-5t0 6','none',gold,2);line('M20 -59l3-17M26 -58l8-14',mint,2);circle(23,-77,3,mint);circle(34,-73,3,mint);},
  'quest-cosmic-goose':()=>{path('M-22 -54q-12-14 5-21l20 1q-2-9 9-7 12 5 2 10l-1 12 12 5Z',ink,purple);path('M17 -80l10 3-11 3Z',gold);eye(12,-79);line('M-21 -58l17-9',blue);star(-33,-75,5,gold);star(35,-63,4,pink);},
  'pixel-spectacles':()=>{path('M-26 -43h22v5h8v-5h22v22H4v-10h-8v10h-22Z',purple,gold);rect(-20,-37,10,10,dark);rect(10,-37,10,10,dark);star(30,-47,4,mint);},
  'all-seeing-toast':()=>{toast(0,-30,1.65);path('M-14 -31q14-15 28 0-14 15-28 0Z',ink,purple);circle(0,-31,5,purple);circle(0,-31,2,dark,null,0);for(const x of [-23,23])star(x,-49,4,gold);},
  'kindness-lantern':()=>{line('M42 -35q-12 0-12 13m12-13q12 0 12 13',gold);path('M30 -20h24l4 35H26Z',purple);rect(33,-14,18,22,'#fff0ac');path('M36 -4q3-6 6-1 6-5 6 1t-6 10Z',pink,null,0);line('M26 18h32',gold,3);},
  'council-scepter':()=>{line('M43 43v-80',purple,6);line('M43 43v-80',gold,2);oval(43,-31,17,5,gold);duck(43,-43,.8);duck(29,-35,.5);duck(56,-35,.5);star(43,-63,6,mint);},
  'courier-cape':()=>{path('M-24 -24L-53 40L-23 31L0 45L23 31L53 40L24 -24Z',blue,gold);for(const sign of [-1,1])path(`M${sign*25} -7l${sign*26} -12 ${-sign*10} 20 ${-sign*16} 10Z`,gold);},
  'cloud-train':()=>{for(const [x,y]of [[-43,-44],[43,-33],[-42,17],[43,27]]){cloud(x,y+10,.6);rect(x-10,y-12,20,17,purple);rect(x-6,y-8,5,6,gold);rect(x+2,y-8,5,6,gold);circle(x-6,y+5,3,blue);circle(x+6,y+5,3,blue);}line('M-44 -69q-12-12 2-13',blue);},
  'bookshelf-wings':()=>{for(const sign of [-1,1]){path(`M${sign*25} -15l${sign*36} -34v71l${-sign*36} -8Z`,'#8e7383',gold);for(let i=0;i<4;i++)rect(sign<0?-57+i*5:36+i*5,-30+i*5,sign<0?6:4,23,[pink,mint,blue,gold][i]);line(`M${sign*28} 3l${sign*31} -10`,gold,3);}},
  'wandering-island':()=>{path('M-62 26q62 30 124 0L32 46H-32Z','#8f86a6',gold);oval(0,24,60,11,mint);rect(-48,-21,23,41,purple);path('M-55 -21l18-18 19 18Z',pink);rect(30,-41,21,61,blue);path('M25 -41l16-19 16 19Z',gold);cloud(-42,-58,.65);cloud(44,-72,.5);},
  'curious-fireflies':()=>{for(const [x,y]of [[-46,-45],[44,-52],[-43,23],[45,27],[0,-74]]){circle(x,y,7,'#ffdf8040',null,0);oval(x-3,y-3,3,5,'#c7eddd');oval(x+3,y-3,3,5,'#c7eddd');circle(x,y+1,3,gold,null,0);}},
  'universe-in-a-jar':()=>{for(const [x,y]of [[-46,-45],[45,-51],[-44,22],[44,23]]){jar(x,y,.8);circle(x,y+2,5,purple);oval(x,y+2,8,2,'none',gold);star(x-5,y-3,2,mint);}},
  'second-wind':()=>{line('M-61 -34q20-20 24 0t-15 4M38 -54q28-9 24 9t-19 2M-57 24q30-15 31 1M30 32q25-15 31 1',mint,3);for(const [x,y]of [[-51,-47],[47,-25],[-45,11]])path(`M${x} ${y}q-7-12 5-17 12 13-5 17Z`,blue);},
  'phoenix-of-revision':()=>{path('M-23 -10L-61 -66L-57 -24L-42 -31L-50 5L-31 -5L-45 29L-18 18ZM23 -10L61 -66L57 -24L42 -31L50 5L31 -5L45 29L18 18Z','#efae91',gold);path('M-17 27L0 47L17 27L0 37Z',gold);star(-43,-74,5,pink);star(43,-74,5,pink);}
 };
 art[id]?.();if(art[id])cache.set(id,parts);return parts;
}
