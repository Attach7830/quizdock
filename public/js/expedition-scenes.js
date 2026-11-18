// Mission state is painted behind the existing characters and game rewards.
export function drawExpeditionWorld(c,room,W,t){
 const x=room.expedition,s=x?.state;if(!s)return;const pulse=1+Math.sin(t*1.4)*.04;
 const rect=(a,b,w,h,color)=>{c.fillStyle=color;c.beginPath();c.roundRect(a,b,w,h,4);c.fill();};
 const orb=(a,b,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(a,b,r,0,Math.PI*2);c.fill();};
 c.save();c.font='bold 10px system-ui';c.textAlign='center';
 if(room.mode==='treasure'||room.mode==='rally'){
  const position=s.position,current=s.map[position],available=s.map.filter(n=>n.available),left=W*.07;
  for(const node of available){const ax=left+node.column*34,ay=40+node.row%2*18;c.strokeStyle='#b6dacf80';c.lineWidth=2;c.beginPath();c.moveTo(left+(current?.column||0)*34,82);c.lineTo(ax,ay);c.stroke();orb(ax,ay,12,node.kind==='mimic'?'#d592aa':'#8be8cc');c.fillStyle='#142d43';c.fillText(String(node.id+1),ax,ay+4);}
  if(room.mode==='treasure'){c.fillStyle='#d7c4f8';c.fillText('ATLAS '+s.fragments+'/'+s.fragmentGoal,W*.17,20);}
  else{c.strokeStyle='#b5f5ea';c.lineWidth=6;c.beginPath();c.ellipse(W*.78,68,24,44,0,0,Math.PI*2);c.stroke();c.strokeStyle='#f3d69e';c.lineWidth=2;c.stroke();c.fillStyle='#f5ecce';c.fillText('GATE '+(s.gate+1),W*.78,126);}
 }
 if(room.mode==='fishing'){
  for(let i=0;i<6;i++){const px=W*.68+i*15+Math.sin(t+i)*6,py=158+(i%3)*11;c.fillStyle='#9effd37d';c.beginPath();c.ellipse(px,py,7,3,0,0,Math.PI*2);c.fill();}
  c.fillStyle='#bce8ed';c.fillText(s.migration.toUpperCase()+' MIGRATION',W*.76,22);
  s.habitat.forEach((h,i)=>{const a=W*.58+i*W*.12;for(let j=0;j<3;j++){c.strokeStyle=h==='coral'?'#edb2af88':h==='kelp'?'#a8edbc88':'#a9afff88';c.lineWidth=3;c.beginPath();c.moveTo(a+j*8,199);c.quadraticCurveTo(a+j*8-9,173,a+j*8+Math.sin(t+j)*4,157+j*7);c.stroke();}});
 }
 if(room.mode==='battle'){
  for(let lane=0;lane<3;lane++){const left=W*.34+lane*W*.11;rect(left,154,W*.09,19,lane===s.hazard?'#ee8c7c66':'#a4d8e133');if(lane===s.lane){c.fillStyle='#a1ffdd';c.fillText('YOU',left+W*.045,168);}}
 }
 if(room.mode==='factory'){
  const left=W*.68,cell=Math.min(22,W*.065);for(let i=0;i<12;i++){const a=left+i%4*cell,b=34+Math.floor(i/4)*cell;rect(a,b,cell-3,cell-3,s.incident?.cell===i?'#ff968e88':'#567f9c77');const parcels=s.transit.filter(p=>p.cell===i);if(parcels.length){c.fillStyle='#f8d49c';c.fillText(parcels[0].part==='bots'?'♟':parcels[0].part==='cells'?'▣':'⚙',a+cell/2,b+cell*.7);}}
  c.fillStyle='#bee4e3';c.fillText('AIRSHIP '+(s.project.stage+1)+'/3',W*.81,25);
 }
 if(room.mode==='keep'){
  const size=Math.min(14,W*.035),left=W*.77;s.grid.forEach((tile,i)=>{rect(left+i%4*size,37+Math.floor(i/4)*size,size-2,size-2,tile?tile.type==='ward'?'#8aead0':tile.type==='lens'?'#c6b3ff':'#efc78d':i<s.openCells?'#6689a177':'#31465d');});c.fillStyle='#d4e9f0';c.fillText('FLOOR '+s.floor,W*.84,28);c.fillText(s.frontName.toUpperCase(),W*.3,24);
 }
 if(room.mode==='word'){
  for(let i=0;i<Math.min(8,s.seals);i++)orb(W*.65+i%4*18,32+Math.floor(i/4)*20,4,'#ddc0ff');c.fillStyle='#c9f9df';c.fillText('CHAIN '+s.chain,W*.79,91);
 }
 const b=s.boss||s.ship||s.obstacle||s.guardian;
 if(b&&room.mode!=='treasure'){
  const a=W*.9,cy=122;c.save();c.translate(a,cy);c.scale(pulse,pulse);const r=b.phase===3?22:18;c.strokeStyle=b.phase===3?'#ffa4a0':'#c6b2ff';c.lineWidth=3;c.beginPath();for(let i=0;i<6;i++){const angle=i*Math.PI/3;const xx=Math.cos(angle)*r,yy=Math.sin(angle)*r;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.stroke();orb(-6,-1,2,'#f5f6fc');orb(6,-1,2,'#f5f6fc');c.restore();rect(a-27,cy+30,54,4,'#10243b');rect(a-27,cy+30,54*b.hp/b.max,4,'#cbb6ff');
 }
 c.restore();
}
