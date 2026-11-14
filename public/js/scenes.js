import {skinById,GAME_TYPES} from './catalog.js';
import {drawArcadeEvent} from './event-effects.js';
// Original vector scenes, drawn in a contained canvas. No downloaded art or proprietary assets.
export function createScene(){
 const el=document.createElement('section');el.className='game-scene';
 el.innerHTML='<div class="scene-top"><span class="scene-name"></span><div class="row" style="gap:4px"><button type="button" data-scene="collapse">Hide scene</button><button type="button" data-scene="motion">Motion on</button><button type="button" data-scene="sound">Effects off</button></div></div><canvas class="scene-canvas" aria-hidden="true"></canvas>';
 const canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d');const media=matchMedia('(prefers-reduced-motion:reduce)');
 let special=null;
 let state=null,previous=null,motion=true,sound=false,collapsed=false,event=null,frame=0,lastFrame=0,audio=null;
 try{motion=localStorage.getItem('qd-motion')!=='off';}catch{}
 const canMove=()=>motion&&!media.matches&&!document.hidden&&!collapsed&&state?.status==='playing';
 function labels(){el.querySelector('[data-scene=motion]').textContent=media.matches?'Reduced motion':`Motion ${motion?'on':'off'}`;el.querySelector('[data-scene=sound]').textContent=`Effects ${sound?'on':'off'}`;el.querySelector('[data-scene=collapse]').textContent=collapsed?'Show scene':'Hide scene';el.classList.toggle('collapsed',collapsed);}
 function chime(){if(!sound||!audio||document.hidden)return;const t=audio.currentTime;for(const [i,f] of [523.25,659.25,783.99].entries()){const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.06);g.gain.linearRampToValueAtTime(.035,t+i*.06+.018);g.gain.exponentialRampToValueAtTime(.001,t+i*.06+.19);o.connect(g);g.connect(audio.destination);o.start(t+i*.06);o.stop(t+i*.06+.2);}}
 el.addEventListener('click',e=>{const b=e.target.closest('[data-scene]');if(!b)return;if(b.dataset.scene==='motion'){motion=!motion;try{localStorage.setItem('qd-motion',motion?'on':'off');}catch{}}
  if(b.dataset.scene==='collapse')collapsed=!collapsed;
  if(b.dataset.scene==='sound'){sound=!sound;if(sound){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{sound=false;}}}labels();redraw();});
 const motionChanged=()=>{labels();redraw();};
 media.addEventListener('change',motionChanged);document.addEventListener('visibilitychange',redraw);
 function roundKey(s){return s?`${s.pin}:${s.roundNumber}:${s.startedAt}:${s.mode}`:'';}
 function update(next){
  if(roundKey(next)!==roundKey(previous)){event=null;special=null;previous=null;delete el.dataset.eventId;}
  state=next;el.querySelector('.scene-name').textContent=GAME_TYPES[next?.mode]?.name||'Your adventure';
  if(previous?.me&&next?.me&&next.status==='playing'){
   const score=s=>s.mode==='treasure'?s.me.coins:s.mode==='factory'?s.me.cash:s.me.score;const delta=score(next)-score(previous);
   if(next.me.answered>previous.me.answered&&next.me.feedback){event={type:next.me.feedback.correct?'correct':'incorrect',start:performance.now(),effect:next.me.feedback.effect};if(next.me.feedback.correct)chime();}
   if(previous.me.pendingChests&&!next.me.pendingChests&&next.me.feedback?.correct)event={type:'chest',start:performance.now(),effect:next.me.feedback.effect};
   if(next.me.machineLevel>previous.me.machineLevel||next.me.rodLevel>previous.me.rodLevel)event={type:'upgrade',start:performance.now()};
   if(next.mode==='battle'&&next.me.hp!==previous.me.hp&&next.me.answered===previous.me.answered)event={type:'hit',start:performance.now()};
   if(delta&&next.me.answered===previous.me.answered&&!previous.me.pendingChests&&next.me.machineLevel===previous.me.machineLevel&&next.me.rodLevel===previous.me.rodLevel)event={type:'balance',start:performance.now()};
   if(event&&delta)event.delta=delta;
  }
  const latest=next?.me?next.me.lastEvent:next?.lastArcadeEvent,prior=previous?.me?previous.me.lastEvent:previous?.lastArcadeEvent;
  if(previous&&latest?.id&&latest.id!==prior?.id&&next.status==='playing'){special={kind:latest.kind,start:performance.now()};el.dataset.eventId=latest.id;}
  previous=structuredClone(next);redraw();
 }
 function redraw(){cancelAnimationFrame(frame);frame=0;draw(performance.now());if(canMove())frame=requestAnimationFrame(loop);}
 function loop(t){if(t-lastFrame>30){draw(t);lastFrame=t;}if(canMove())frame=requestAnimationFrame(loop);else frame=0;}
 const resize=new ResizeObserver(redraw);resize.observe(canvas);
 function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.6;ctx.stroke();}}
 function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
 function line(points,color,width=2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 function poly(points,color){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
 function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');ellipse(x,y,r,r,g);}
 function star(x,y,r,color){const p=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;p.push([x+Math.cos(a)*(i%2?r*.28:r),y+Math.sin(a)*(i%2?r*.28:r)]);}poly(p,color);}
 function avatar(x,y,scale=1,skin='mint',tilt=0){const s=skinById(skin);ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(scale,scale);ellipse(0,29,32,7,'#07152655');rr(-25,-30,50,60,17,s.primary,s.accent);rr(13,-23,10,47,6,s.secondary);rr(-18,-12,36,20,8,'#142c46',s.accent);ellipse(-9,-3,3,3,s.accent);ellipse(9,-3,3,3,s.accent);rr(-8,17,16,5,2,s.accent);if(s.shape==='crown')poly([[-20,-30],[-20,-45],[-8,-37],[0,-48],[9,-37],[20,-45],[20,-30]],s.accent);if(s.shape==='horns'){line([[-22,-18],[-34,-30],[-34,-43]],s.accent,7);line([[22,-18],[34,-30],[34,-43]],s.accent,7);}ctx.restore();}
 function clouds(W,t,color='#a1bad91a'){for(let i=0;i<5;i++){const x=((i*W*.27+t*(7+i)%W)%(W+160))-80,y=28+(i%3)*28;ellipse(x,y,48,12,color);ellipse(x-13,y-9,24,17,color);ellipse(x+18,y-5,31,14,color);}}
 function water(W,t,y=150){ctx.fillStyle='#16435b';ctx.fillRect(0,y,W,60);for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(0,y+j*12);for(let x=0;x<=W+10;x+=8)ctx.lineTo(x,y+j*12+Math.sin(x*.023+t*1.3+j)*4);ctx.lineTo(W,200);ctx.lineTo(0,200);ctx.closePath();ctx.fillStyle=['#21596a','#27768166','#32929144'][j];ctx.fill();}for(let i=0;i<12;i++){const x=(i*87+t*11)%(W+40)-20;line([[x,175+i%3*6],[x+18,175+i%3*6]],'#82d6d92c',1.5);}}
 function coin(x,y,r=7,alpha=1){ctx.save();ctx.globalAlpha=alpha;ellipse(x,y,r,r,'#e1a54b');ellipse(x,y,r*.76,r*.76,'#ffda86');ctx.strokeStyle='#9c6d31';ctx.lineWidth=1;ctx.stroke();line([[x,y-r*.4],[x,y+r*.4]],'#af7e37',1.7);ctx.restore();}
 function particles(x,y,p,kind='gold',n=18){if(p<=0||p>=1)return;for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2,dx=Math.cos(a)*(40+i%4*11),dy=-70-i%5*6;const px=x+dx*p,py=y+dy*p+105*p*p;const color=kind==='water'?'#a9f4ee':['#ffdc86','#88ebd0','#d6c3ff'][i%3];ctx.globalAlpha=(1-p)*.9;star(px,py,3+i%3,color);}ctx.globalAlpha=1;}
 function chest(W,t,p){water(W,t,151);const x=W*.51;ellipse(x,170,138,17,'#0a1c2c55');ellipse(x,157,132,23,'#b69762');ellipse(x,150,130,18,'#debc84');glow(x,113,88,'#efcc5933');
  const owned=Math.min(14,Math.floor((state?.me?.coins||0)/25));for(let i=0;i<owned;i++)coin(x+84+(i%4)*10,147-Math.floor(i/4)*8,6);
  avatar(x-111,122,.72,state?.me?.skin,t?Math.sin(t)*.03:0);
  const opening=event?.type==='chest'?Math.sin(Math.min(1,p*1.4)*Math.PI):0,wiggle=event?.type==='correct'?Math.sin(p*24)*(1-p)*.035:0;
  ctx.save();ctx.translate(x,132);ctx.rotate(wiggle);ellipse(0,15,66,11,'#714c3d55');
  rr(-59,-27,118,53,7,'#9e6339','#f0c274');rr(-52,-20,103,11,2,'#b77542');rr(-52,-3,103,10,2,'#905331');rr(-43,-27,12,53,0,'#edbd65');rr(31,-27,12,53,0,'#edbd65');
  if(opening){glow(0,-33,54,'#ffe09d99');poly([[-48,-30],[-74,-110],[70,-110],[49,-30]],'#ffe09d11');}
  ctx.save();ctx.translate(-58,-29);ctx.rotate(-opening*.3);ctx.translate(0,-opening*27);rr(0,-28,116,32,[12,12,3,3],'#a96d3d','#ffe1a2');rr(14,-28,11,32,0,'#f4c773');rr(91,-28,11,32,0,'#f4c773');line([[28,-16],[86,-16]],'#74472e',2);ctx.restore();rr(-10,-36,20,25,4,'#ffdb89','#c18a41');rr(-2,-30,4,11,2,'#7d542d');ctx.restore();
  if(event?.type==='chest'){particles(x,111,p);for(let i=0;i<7;i++){const q=Math.max(0,Math.min(1,(p-i*.055)/.55));if(q>0&&q<1)coin(x+q*(W*.85-x),103-Math.sin(q*Math.PI)*63-q*16,6,1-q*.4);}if(event.effect?.type==='raid'){ctx.fillStyle='#f7dca5';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText('RAID BONUS',x,35);}}
  for(let i=0;i<3;i++)star(x-74+i*70,40+(i%2)*12,4+(motion?Math.sin(t*2+i)*1.5:0),'#ffdf9a88');
 }
 function fishing(W,t,p){clouds(W,t);ellipse(W*.78,38,18,18,'#e8cf9255');water(W,t,140);const x=W*.42,bob=Math.sin(t*1.4)*3;ctx.save();ctx.translate(0,bob);poly([[x-72,123],[x+70,123],[x+48,151],[x-49,151]],'#8e633d');line([[x-73,123],[x+73,123]],'#f2c67f',5);avatar(x-13,96,.7,state?.me?.skin);line([[x+7,98],[x+50,50],[x+93,68]],'#c8b58a',4);const lift=event?.type==='correct'?Math.sin(p*Math.PI)*36:0;line([[x+91,68],[x+115,140-lift]],'#cce8e0aa',1.5);ellipse(x+115,140-lift,5,3,'#ffcf86');ctx.restore();
  if(event?.type==='correct'){const jump=Math.sin(p*Math.PI),fx=x+117+Math.sin(p*3)*10,fy=149-jump*85,weight=event.effect?.weight||2,scale=.5+Math.min(1.5,weight/6);ctx.save();ctx.translate(fx,fy);ctx.rotate(-.5+p);ctx.scale(scale,scale);poly([[-21,0],[-41,-16],[-38,16]],'#ffb967');ellipse(0,0,26,14,'#ffd17e');poly([[-5,-10],[5,-24],[15,-10]],'#f4a15e');ellipse(14,-4,3,3,'#173045');ctx.restore();particles(x+110,147,p,'water',14);if(p<.85){ctx.font='bold 14px system-ui';ctx.fillStyle='#f6e8bf';ctx.textAlign='center';ctx.fillText(`${weight.toFixed(1)} kg`,fx,fy-30);}}
  if(state?.me?.rodLevel){ctx.fillStyle='#a5ebd6';ctx.font='bold 11px system-ui';ctx.textAlign='left';ctx.fillText(`ROD ${state.me.rodLevel}`,W*.1,34);}
  for(let i=0;i<3;i++){const fx=(i*W*.31+t*8)%(W+50)-25;ellipse(fx,177+i%2*8,13,5,'#9ce4d82b');poly([[fx-10,177+i%2*8],[fx-20,172+i%2*8],[fx-20,182+i%2*8]],'#9ce4d82b');}
 }
 function battle(W,t,p){const x=W*.29,y=W*.71;glow(W*.5,100,160,'#bba2ff1e');ellipse(W*.5,166,W*.37,28,'#675c8d33');ellipse(W*.5,160,W*.35,25,'#27374f');ctx.strokeStyle='#766da866';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(W*.5,160,W*.35,25,0,0,Math.PI*2);ctx.stroke();
  const hit=event?.type==='correct'&&p>.48?Math.sin((p-.48)*24)*5*(1-p):0;avatar(x,124,.98,state?.me?.skin,['incorrect','hit'].includes(event?.type)?Math.sin(p*23)*.05:Math.sin(t)*.025);const rival=state?.players?.find(s=>s.id===event?.effect?.targetId)||state?.players?.find(s=>s.id!==state.me?.id);avatar(y+hit,124,.98,rival?.skin||'coral',hit*.007);
  rr(x-36,174,72,5,3,'#1a263e');rr(x-36,174,72*(state?.me?.hp??100)/100,5,3,'#7fe6bb');rr(y-36,174,72,5,3,'#1a263e');rr(y-36,174,72*(rival?.hp??100)/100,5,3,'#d58caa');
  if(event?.type==='correct'){const q=Math.max(0,Math.min(1,(p-.12)/.48)),ox=x+35+(y-x-70)*q;for(let i=6;i>=0;i--)ellipse(ox-i*9,112,Math.max(2,12-i),Math.max(2,8-i),'#b4ffee'+['22','33','55','77','99','bb','ff'][6-i]);glow(ox,112,30,'#7ce7ff55');if(p>.55)particles(y,115,(p-.55)/.45,'gold',18);}
  ctx.fillStyle='#cee4ef';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('YOU',x,48);ctx.fillText((rival?.name||'RIVAL').slice(0,18),y,48);
 }
 function gear(x,y,r,t){ctx.save();ctx.translate(x,y);ctx.rotate(t);for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);rr(r*.64,-3,r*.5,6,1,'#c6dbe1');}ellipse(0,0,r*.8,r*.8,'#92b7c2');ellipse(0,0,r*.31,r*.31,'#29445d');ctx.restore();}
 function factory(W,t,p){const n=Math.max(1,Math.min(5,(state?.me?.machineLevel||0)+1)),left=W*.22,step=Math.min(105,(W*.65)/n);ctx.fillStyle='#162b3a';ctx.fillRect(0,150,W,50);for(let i=0;i<7;i++)line([[i*W/6,150],[i*W/6-40,200]],'#60808320');rr(W*.15,152,W*.7,18,9,'#22394c','#628c9c');for(let x=W*.15+4;x<W*.85-5;x+=18)line([[x,157],[x+5,165]],'#8ca7b155',3);
  for(let i=0;i<n;i++){const x=left+i*step;rr(x-31,80,64,70,7,i%2?'#587797':'#3a7d83','#96d9ce');rr(x-22,58,17,23,3,'#3c5b71','#9fc4cc');rr(x+6,87,17,8,2,'#a1f2bd');gear(x-8,120,17,t*(state?.me?.machineLevel?1:0));gear(x+17,134,11,-t*(state?.me?.machineLevel?1:0));}
  for(let i=0;i<4;i++){const x=W*.17+((t*25+i*74)%(W*.64));rr(x,130,20,22,2,'#bd8d53','#f3d394');rr(x+7,131,5,19,0,'#ecd295');}
  avatar(W*.1,132,.65,state?.me?.skin);
  if(event?.type==='upgrade')particles(left+(n-1)*step,80,p);if(event?.type==='correct')particles(left,90,p,'gold',10);
 }
 function rally(W,t,p){clouds(W,t*3,'#c8e7ed22');for(let i=0;i<4;i++){const y=145+i*13;line([[0,y],[W,y]],'#c4dcec13',1);}const progress=Math.min(.9,(state?.me?.score||0)/(state?.settings?.target||1000));const x=W*.18+progress*W*.65+(event?.type==='correct'?Math.sin(p*Math.PI)*15:0),y=106+Math.sin(t*2)*3;
  for(let i=0;i<5;i++){const sx=(W-(t*80+i*73)%(W+90));line([[sx,80+i*23],[sx+22,80+i*23]],'#b9effd33',2);}
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t)*.03);poly([[-62,12],[35,12],[53,27],[-47,31]],'#86c7c6');poly([[-18,20],[-55,54],[19,27]],'#518dad');poly([[-35,10],[-58,-8],[-58,20]],'#f3c584');avatar(-3,-7,.69,state?.me?.skin);ellipse(55,21,3,23,'#e6ffff77');if(event?.type==='correct')poly([[-61,15],[-103-Math.sin(p*25)*13,24],[-61,29]],'#f8d088cc');ctx.restore();
  const fx=W*.88;line([[fx,50],[fx,170]],'#d4e1ea99',3);for(let r=0;r<4;r++)for(let c=0;c<5;c++)rr(fx+c*8,50+r*8,8,8,0,(c+r)%2?'#1e3149':'#d9edf0');
 }
 function keep(W,t,p){clouds(W,t,'#b3b1d522');const x=W*.53;ellipse(x,178,150,14,'#0d183177');poly([[x-130,155],[x-90,123],[x+91,123],[x+135,155],[x+90,178],[x-85,178]],'#51606b');
  for(const dx of [-87,64]){rr(x+dx,97,37,61,3,'#73828b','#a9bac1');for(let i=0;i<3;i++)rr(x+dx+i*13,88,10,15,1,'#9caeb2');rr(x+dx+12,117,11,20,5,'#24354a');}
  rr(x-60,129,124,32,3,'#596f7d','#9fb8c0');const pulse=event?.type==='correct'?Math.sin(p*Math.PI)*10:Math.sin(t*1.4)*2;glow(x,92,65+pulse,'#9fdcfb44');poly([[x,39-pulse*.15],[x+27,87],[x+18,125],[x-18,125],[x-28,87]],'#93e6e6');poly([[x,39-pulse*.15],[x,125],[x-18,125],[x-28,87]],'#4b94b6');poly([[x,39-pulse*.15],[x+27,87],[x,101]],'#cdfcf0');line([[x-28,87],[x,101],[x+27,87]],'#e6fff0',1.5);avatar(x-133,137,.75,state?.me?.skin);rr(x-60,182,120,5,3,'#24354b');rr(x-60,182,120*(state?.me?.hp??100)/100,5,3,'#93dfc8');if(event?.type==='correct')particles(x,93,p,'gold',24);
 }
 function draw(now){
  if(collapsed||!state||!ctx)return;const rect=canvas.getBoundingClientRect(),h=rect.height,w=rect.width;if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr*h/200,0,0,dpr*h/200,0,0);const W=w*200/h;ctx.clearRect(0,0,W,200);const bg=ctx.createLinearGradient(0,0,0,200);const colors={treasure:['#1d3b56','#183246'],fishing:['#274b66','#1d4052'],battle:['#342d52','#172a43'],factory:['#28434d','#162e43'],rally:['#294b69','#4c7687'],keep:['#2c3758','#223d51']}[state.mode]||['#1b3448','#142b40'];bg.addColorStop(0,colors[0]);bg.addColorStop(1,colors[1]);ctx.fillStyle=bg;ctx.fillRect(0,0,W,200);
  const t=canMove()?now/1000:0;let p=event&&canMove()?Math.min(1,(now-event.start)/1250):0;if(event&&p>=1)event=null;
  const scenes={treasure:chest,fishing,battle,factory,rally,keep};scenes[state.mode]?.(W,t,p);
  if(event?.delta&&p>0&&p<1){ctx.save();ctx.globalAlpha=Math.min(1,(1-p)*3);ctx.font='bold 15px system-ui';ctx.textAlign='center';const label=`${event.delta>0?'+':'−'}${Math.abs(Math.round(event.delta))}`,width=ctx.measureText(label).width+24;rr(W*.5-width*.5,25-p*8,width,26,13,'#122938dd',event.delta>0?'#8feac9':'#edbf98');ctx.fillStyle=event.delta>0?'#b5f7db':'#ffe0bb';ctx.fillText(label,W*.5,43-p*8);ctx.restore();}
  if(special){const elapsed=(now-special.start)/2400;if(elapsed>=1){special=null;}else drawArcadeEvent(ctx,special.kind,W,elapsed,canMove());}
  if(state.status!=='playing'){ctx.fillStyle='#09172c55';ctx.fillRect(0,0,W,200);}ctx.setTransform(1,0,0,1,0,0);
 }
 labels();return {el,mount(parent){if(parent&&!parent.contains(el))parent.append(el);redraw();},update,dispose(){cancelAnimationFrame(frame);resize.disconnect();media.removeEventListener('change',motionChanged);document.removeEventListener('visibilitychange',redraw);if(audio)audio.close().catch(()=>{});el.remove();}};
}
