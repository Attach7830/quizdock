import {forgeState,RELIC_PATHS} from './word-forge.js';
import {drawCharacter} from './characters.js';
import {skinById} from './catalog.js';
import {drawFish} from './fish-art.js';
import {FISH_SPECIES,STATIONS} from './gameplay-catalog.js';
const box=(ctx,x,y,w,h,color,stroke=null,r=5)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}};
const ellipse=(ctx,x,y,rx,ry,color)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
const line=(ctx,x1,y1,x2,y2,color,width=2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
const text=(ctx,value,x,y,color='#d8f5f1',size=10,maxWidth)=>{ctx.font=`800 ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle=color;if(maxWidth)ctx.fillText(String(value),x,y,maxWidth);else ctx.fillText(String(value),x,y);};
function glow(ctx,x,y,r,color){const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');ellipse(ctx,x,y,r,r,g);}
export function gameplayBackdrop(ctx,state,W,t){
 if(!state.gameplay||!state.me?.adventure)return;
 const s=state.me.adventure;
 if(state.mode==='battle'&&s.arena!=='standard'){const color={surge:'#f5d684',mirror:'#b4ffff',gale:'#d6b4ff'}[s.arena];glow(ctx,W*.5,100,130,color+'22');for(let i=0;i<7;i++)line(ctx,i*W/6,0,i*W/6+Math.sin(t+i)*22,190,color+'18',2);}
 if(state.mode==='rally'){
  const lanes=[80,106,132];for(const [i,y]of lanes.entries()){ctx.setLineDash([12,15]);line(ctx,0,y,W,y,i===['rings','glide','dive'].indexOf(s.line)?'#ceffff66':'#c2d5f922',1.4);ctx.setLineDash([]);}
  if(s.wind==='storm'){glow(ctx,W*.72,60,100,'#b689e533');for(let i=0;i<4;i++){const x=(W-(t*38+i*101)%(W+70));line(ctx,x,10,x-15,180,'#e8d2ff22',1);}}
 }
}
export function factoryWorld(ctx,state,W,t,p,event){
 const s=state.me?.adventure;if(!state.gameplay||!s)return false;
 ctx.fillStyle='#142d3b';ctx.fillRect(0,151,W,49);for(let i=0;i<8;i++)line(ctx,i*W/7,151,i*W/7-45,200,'#90adc120',1);
 box(ctx,18,151,W-36,19,'#263e52','#73a6aa',9);for(let i=0;i<14;i++){const x=22+(i*31+t*21)%(W-45);line(ctx,x,157,x+4,165,'#a5cfcc66',2);}
 STATIONS.forEach((station,i)=>{const x=W*(.26+i*.27),level=s.stations[station.id],on=level>0;box(ctx,x-29,79,58,71,on?'#3b6571':'#253a50',on?station.color:'#5a7181');box(ctx,x-20,58,40,23,on?'#365564':'#22354a',station.color,4);text(ctx,station.name.toUpperCase(),x,48,station.color,8);text(ctx,on?'L'+level:'BUILD',x,72,on?'#eaffef':'#8da5b7',10);
  if(station.id==='press'){ctx.save();ctx.translate(x,113);ctx.rotate(t*.65);for(let j=0;j<8;j++){ctx.rotate(Math.PI/4);box(ctx,12,-3,11,6,'#c5dddf',null,1);}ellipse(ctx,0,0,16,16,'#a2bfc7');ellipse(ctx,0,0,7,7,'#2d4d60');ctx.restore();}
  if(station.id==='cells'){for(let j=0;j<3;j++){box(ctx,x-20+j*14,98,11,34,'#172d45',station.color,3);box(ctx,x-18+j*14,115-Math.sin(t*2+j)*5,7,13,station.color,null,2);}}
  if(station.id==='assembler'){line(ctx,x-15,97,x,114,'#d5c2f5',5);line(ctx,x,114,x+18,102+Math.sin(t*2)*5,'#d5c2f5',4);box(ctx,x-11,119,24,24,'#9e8bc4',station.color,5);ellipse(ctx,x-5,127,2,2,'#ecffff');ellipse(ctx,x+5,127,2,2,'#ecffff');}
  text(ctx,s.stock[station.part]+' '+station.part,x,187,station.color,9);if(on&&event?.type==='correct')glow(ctx,x,115,40,'#b4ffcf'+(p<.8?'45':'18'));
 });
 for(let i=0;i<4;i++){const x=28+(t*25+i*79)%(W-60);box(ctx,x,137,17,17,['#deb47a','#9fdfcd','#c0a1ef'][i%3],'#d4eedc',2);}
 drawCharacter(ctx,28,139,.38,skinById(state.me.skin,state.me.equipment));text(ctx,'ORDER: '+s.order.quantity+' '+s.order.part+' → $'+s.order.payout,W*.5,23,'#ffe3ac',10);return true;
}
export function gameplayForeground(ctx,state,W,t,p,event){
 const s=state.me?.adventure;if(!state.gameplay||!s)return;
 ctx.save();
 if(state.mode==='treasure'){
  const x=W*.84;glow(ctx,x,124,48,'#8debdc22');box(ctx,x-31,88,63,69,'#355868','#aff8db',7);box(ctx,x-24,96,49,54,'#234050','#8ac9c3',5);ellipse(ctx,x,122,12,12,'#789ea7');line(ctx,x-7,122,x+7,122,'#e1fff0',3);line(ctx,x,115,x,129,'#e1fff0',3);text(ctx,'VAULT',x,77,'#c6ffe0',9);text(ctx,s.vault+' protected',x,175,'#c6ffe0',9);
  if(s.lastChest?.route==='harbor'&&event?.type==='chest'){ctx.globalAlpha=1-p;for(let i=0;i<8;i++){const q=(p+i*.07)%1,cx=W*.51+(x-W*.51)*q,cy=100-Math.sin(q*Math.PI)*40;ellipse(ctx,cx,cy,5,5,'#ffdf8c');}ctx.globalAlpha=1;}
 }
 if(state.mode==='fishing'){
  if(s.water==='reef')for(let i=0;i<4;i++){const x=W*.07+i*14;line(ctx,x,196,x+Math.sin(i)*8,170-i%2*8,'#e99a9988',5);line(ctx,x,181,x+11,174,'#f8b0a688',3);}
  if(s.lastCatch){const f=FISH_SPECIES.find(f=>f.id===s.lastCatch.species),jump=event?.type==='correct'?Math.sin(p*Math.PI)*43:0,scale=.65+Math.min(.35,s.lastCatch.weight/24);if(f?.rare)glow(ctx,W*.77,110-jump,63,'#dbc3ff55');drawFish(ctx,W*.77,118-jump+Math.sin(t*1.3)*3,scale,s.lastCatch.species,event?.type==='correct'?-Math.sin(p*Math.PI)*.3:Math.sin(t)*.025,{shiny:s.lastCatch.shiny});text(ctx,(s.lastCatch.shiny?'✦ SHINY ':'')+f.name,W*.77,185,f.rare?'#ffe3ab':'#caffeb',9,W*.42);}
  text(ctx,s.collection.length+'/'+FISH_SPECIES.length+' DISCOVERED',W*.5,24,'#c1fff0',9);
 }
 if(state.mode==='battle'){
  const x=W*.29;if(s.shield){ctx.strokeStyle='#a3f8ff99';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x,112,48,58,0,0,Math.PI*2);ctx.stroke();glow(ctx,x,112,65,'#a1efff22');}
  for(let i=0;i<3;i++){ellipse(ctx,x-22+i*22,192,6,6,i<s.charge?'#ffde93':'#233c55');if(i<s.charge)glow(ctx,x-22+i*22,192,13,'#ffd98955');}
  const target=state.players?.find(x=>x.id!==state.me.id);if(target?.shield){ctx.strokeStyle='#e6c1ff88';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(W*.71,112,48,58,0,0,Math.PI*2);ctx.stroke();}text(ctx,s.stance.toUpperCase(),W*.5,24,'#dbd7ff',10);
 }
 if(state.mode==='rally'){
  text(ctx,'NEXT: '+s.wind.toUpperCase(),W*.5,24,'#e5ffff',10);for(let i=0;i<3;i++)box(ctx,15+i*17,178,12,7,i<s.boost?'#ffe1a0':'#294357','#c8d5e655',2);
  if(s.line==='rings')for(let i=0;i<3;i++){ctx.strokeStyle='#d9ffda99';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(W*.58+i*W*.11,80,10,23,0,0,Math.PI*2);ctx.stroke();}
 }
 if(state.mode==='keep'){
  const k=state.gameplay.keep,x=W*.87,y=118;glow(ctx,x,y,45,k.enemy==='wyvern'?'#d3a2ff44':'#ffc78422');
  if(k.enemy==='swarm'){for(let i=0;i<5;i++){const px=x+Math.sin(t+i*2)*19,py=y+Math.cos(t*1.4+i)*22;ellipse(ctx,px-5,py-3,9,4,'#d0f8e766');ellipse(ctx,px+5,py-3,9,4,'#d0f8e766');ellipse(ctx,px,py,6,8,'#f7d477');}}
  else if(k.enemy==='golem'){box(ctx,x-24,y-29,48,53,'#8e8eaa','#e5dfdf',7);box(ctx,x-17,y-47,34,27,'#a2a0b5','#e5dfdf',6);for(const dx of [-13,13])ellipse(ctx,x+dx*.55,y-35,3,3,'#ffcc8d');line(ctx,x-24,y-15,x-36,y+10,'#a7a6be',11);line(ctx,x+24,y-15,x+34,y+10,'#a7a6be',11);}
  else{ctx.save();ctx.translate(x,y);const flap=Math.sin(t*2)*10;ctx.beginPath();ctx.moveTo(-8,-7);ctx.lineTo(-47,-35-flap);ctx.lineTo(-35,6);ctx.lineTo(-12,12);ctx.moveTo(8,-7);ctx.lineTo(40,-35-flap);ctx.lineTo(33,7);ctx.lineTo(12,12);ctx.fillStyle='#ab83d6';ctx.fill();ellipse(ctx,0,0,15,27,'#b7a1e0');ellipse(ctx,-2,-28,20,12,'#cfb8ed');ellipse(ctx,-8,-31,3,3,'#fff2b4');ctx.restore();}
  box(ctx,x-31,166,62,5,'#192940',null,2);box(ctx,x-31,166,62*Math.max(0,k.enemyHp)/k.enemyMax,5,'#e5b4e9',null,2);text(ctx,'WAVE '+k.wave+(k.enemy==='wyvern'?' · BOSS':''),W*.5,24,'#e4fbe1',10);
  for(let i=0;i<Math.min(4,k.towers.bolt);i++){const tx=W*.2+i*17;box(ctx,tx,94,10,30,'#83c9cb','#c4ffdb',2);ellipse(ctx,tx+5,92,6,6,'#affff0');}
  if(k.towers.ward){ctx.strokeStyle='#b0e7ff66';ctx.lineWidth=2+k.towers.ward*.2;ctx.beginPath();ctx.ellipse(W*.42,104,65,75,0,Math.PI,0);ctx.stroke();}
  text(ctx,'CRYSTAL '+k.crystal+'/300',W*.42,198,k.crystal<80?'#ffbbbc':'#baf4e3',9);
 }
 ctx.restore();
}

const relicPaths=new Map();
export function wordWorld(ctx,state,W,t,p,event){
 if(state.mode!=='word')return false;
 const s=state.me?.adventure||{solved:0,constellations:0},correct=event?.type==='correct',f=forgeState(s.solved,{result:!!state.me?.feedback,correct:!!state.me?.feedback?.correct}),cx=W*.59,cy=108,heat=Math.min(1,.22+f.step*.15);
 glow(ctx,cx,cy,100,f.complete?'#ffcb7155':'#9d87ff33');ellipse(ctx,W*.5,185,W*.38,17,'#0a1f3877');
 drawCharacter(ctx,W*.18,140,.67,skinById(state.me?.skin,state.me?.equipment),Math.sin(t)*.025);
 // The forge visibly changes with correct typed answers, without revealing the answer.
 for(let i=0;i<11;i++){
  const x=cx-57+i*11,flame=8+Math.sin(t*3+i*1.7)*6+heat*17;
  ctx.beginPath();ctx.moveTo(x-7,177);ctx.quadraticCurveTo(x-10,168-flame,x+Math.sin(t+i)*5,155-flame);ctx.quadraticCurveTo(x+11,164,x+7,177);ctx.fillStyle=i%2?'#ffb16f':'#e97ca6';ctx.globalAlpha=.65;ctx.fill();
 }ctx.globalAlpha=1;
 box(ctx,cx-63,165,126,17,'#32445c','#a7b5db',4);
 ctx.beginPath();ctx.moveTo(cx-67,149);ctx.lineTo(cx-39,135);ctx.lineTo(cx+65,135);ctx.lineTo(cx+46,151);ctx.lineTo(cx+15,154);ctx.lineTo(cx+24,165);ctx.lineTo(cx-27,165);ctx.lineTo(cx-19,153);ctx.closePath();ctx.fillStyle='#59617c';ctx.strokeStyle='#bdcae2';ctx.lineWidth=2;ctx.fill();ctx.stroke();
 const rise=f.complete?Math.sin(t*1.4)*4:0;
 if(!relicPaths.has(f.shape))relicPaths.set(f.shape,new Path2D(RELIC_PATHS[f.shape]));
 ctx.save();ctx.translate(cx-28,42-rise);ctx.scale(.76,.85);ctx.globalAlpha=.4+f.step*.12;ctx.fillStyle=f.complete?'#ffd584':'#b9a6ff';ctx.strokeStyle='#fff0c4';ctx.lineWidth=2;ctx.fill(relicPaths.get(f.shape));ctx.stroke(relicPaths.get(f.shape));ctx.restore();
 ctx.save();ctx.translate(cx-58,97);ctx.rotate(correct?-Math.sin(Math.min(1,p*3)*Math.PI)*1.05:-.4+Math.sin(t)*.03);box(ctx,-4,-46,8,47,'#a17362','#e2b49a',2);box(ctx,-21,-57,42,20,'#9faed1','#e5eeff',4);ctx.restore();
 if(correct){ctx.globalAlpha=1-p;for(let i=0;i<(f.complete?28:16);i++){const a=i*2.399,r=15+p*110;glow(ctx,cx+Math.cos(a)*r,132+Math.sin(a)*r*.58-p*32,4+(i%3),'#ffdc9b');}ctx.globalAlpha=1;}
 for(let i=0;i<5;i++){const x=W*.27+i*W*.115,y=23;glow(ctx,x,y,i<f.step?16:6,i<f.step?'#ffd59c77':'#d9cdff11');text(ctx,'✦',x,y+4,i<f.step?'#ffe6a9':'#6e6c93',i<f.step?17:12);}
 text(ctx,f.complete?'RELIC AWAKENED!':f.stage.toUpperCase()+' · '+f.step+'/5',W*.5,195,f.complete?'#ffda9c':'#e9d0ff',10);return true;
}
