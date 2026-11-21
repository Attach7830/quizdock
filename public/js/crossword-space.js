// A lightweight 3D camera and cube renderer. Geometry and entered letters only;
// grading and solutions never enter this module. No third-party script needed.
export function mountCrosswordSpace(host,grid,{select,onRotate}={}){
 const canvas=host.querySelector('canvas'),input=host.querySelector('[data-crossword-3d-input]'),ctx=canvas.getContext('2d');
 const cells=grid.cells,byKey=new Map(cells.map(c=>[c.key,c])),centre={x:(Math.max(...cells.map(c=>c.col)))/2,y:(Math.max(...cells.map(c=>c.row)))/2,z:(Math.max(...cells.map(c=>c.depth)))/2};
 let yaw=-.58,pitch=.42,magnification=1,values={},active=cells[0].key,word=grid.entries[0],frame=0,disposed=false,visible=true,drag=null,points=[],focusWord=false,showOtherLetters=false,overview=null;
 const palettes={across:{rail:'#72e4c9',faces:['#a0d5c9','#e0f6eb','#78b8ac']},down:{rail:'#87c8ff',faces:['#a1cce8','#e0f2ff','#79accf']},depth:{rail:'#c6a8ff',faces:['#c4b0e5','#eee5ff','#a18bc7']}};
 const rotate=(x,y,z)=>{const a=x*Math.cos(yaw)-z*Math.sin(yaw),b=x*Math.sin(yaw)+z*Math.cos(yaw);return {x:a,y:y*Math.cos(pitch)-b*Math.sin(pitch),z:y*Math.sin(pitch)+b*Math.cos(pitch)};};
 const queue=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(draw);};
 function draw(){
  frame=0;if(!visible||disposed)return;const box=host.getBoundingClientRect(),w=box.width,h=box.height;if(w<1||h<1)return;
  const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const rotated=cells.filter(c=>!focusWord||word.keys.includes(c.key)).map(c=>({...c,...rotate(c.col-centre.x,c.row-centre.y,c.depth-centre.z)})),chosen=rotated,palette=palettes[word.direction];
  const minX=Math.min(...chosen.map(c=>c.x))-.7,maxX=Math.max(...chosen.map(c=>c.x))+.7,minY=Math.min(...chosen.map(c=>c.y))-.7,maxY=Math.max(...chosen.map(c=>c.y))+.7;
  const scale=Math.max(5,Math.min((w-36)/(maxX-minX),(h-36)/(maxY-minY),58))*magnification,ox=w/2-(minX+maxX)/2*scale,oy=h/2-(minY+maxY)/2*scale;
  const project=(x,y,z)=>{const p=rotate(x-centre.x,y-centre.y,z-centre.z);return {x:ox+p.x*scale,y:oy+p.y*scale,z:p.z};};
  points=rotated.map(c=>({...c,sx:ox+c.x*scale,sy:oy+c.y*scale,size:scale})).sort((a,b)=>a.z-b.z);
  // Rails identify actual word connections, even where unconnected cubes pass nearby.
  for(const e of grid.entries){if(focusWord&&e.number!==word.number)continue;const first=byKey.get(e.keys[0]),last=byKey.get(e.keys.at(-1)),a=project(first.col,first.row,first.depth),b=project(last.col,last.row,last.depth);ctx.globalAlpha=1;ctx.strokeStyle=e.number===word.number?palette.rail:'#2e435a';ctx.lineWidth=Math.max(2,scale*(e.number===word.number ? .12 : .06));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  function cube(c,selected){
   const half=.34,vertices=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z])=>project(c.col+x*half,c.row+y*half,c.depth+z*half));
   const normals=[[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];
   const faces=[[0,1,2,3],[4,5,6,7],[0,4,5,1],[3,7,6,2],[0,3,7,4],[1,2,6,5]].map((ids,i)=>({ids,i,z:ids.reduce((n,j)=>n+vertices[j].z,0)/4})).filter(face=>rotate(...normals[face.i]).z>.001).sort((a,b)=>a.z-b.z);
   ctx.globalAlpha=1;
   for(const face of faces){ctx.beginPath();face.ids.forEach((j,i)=>{const p=vertices[j];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=c.key===active?'#f5ce68':selected?palette.faces[face.i%3]:['#24384c','#314d65','#1b2c40'][face.i%3];ctx.fill();ctx.lineWidth=selected?1.2:.8;ctx.strokeStyle=c.key===active?'#c18c32':selected?palette.rail:'#3a536c';ctx.stroke();}
   const font=Math.max(10,Math.min(30,scale*.5));ctx.font=`750 ${font}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=selected?'#102d35':'#b7c9dc';if(selected||showOtherLetters)ctx.fillText(values[c.key]||'',c.sx,c.sy);
   if(selected&&c.key===word.keys[0]&&scale>=15){ctx.font=`650 ${Math.max(7,Math.min(11,scale*.2))}px system-ui`;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(String(word.label),c.sx-scale*.25,c.sy-scale*.28);}
  }
  for(const c of points)if(!word.keys.includes(c.key))cube(c,false);
  // The highlighted word is shown through the others so interior squares can
  // always be selected, rather than requiring a precise camera angle.
  for(const c of points)if(word.keys.includes(c.key))cube(c,true);
  ctx.globalAlpha=1;const p=points.find(c=>c.key===active),size=Math.max(24,Math.min(44,scale*.72));
  input.style.width=size+'px';input.style.height=size+'px';input.style.fontSize=Math.max(16,size*.63)+'px';input.style.left=Math.max(2,Math.min(w-size-2,p.sx-size/2))+'px';input.style.top=Math.max(2,Math.min(h-size-2,p.sy-size/2))+'px';canvas.dataset.camera=`${yaw.toFixed(3)},${pitch.toFixed(3)},${magnification.toFixed(2)}`;
 }
 function down(e){drag={x:e.clientX,y:e.clientY,yaw,pitch,moved:false};canvas.setPointerCapture?.(e.pointerId);}
 function move(e){if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){yaw=drag.yaw+dx*.008;pitch=Math.max(-1.3,Math.min(1.3,drag.pitch+dy*.008));queue();onRotate?.();}}
 function up(e){if(!drag)return;const moved=drag.moved;drag=null;if(moved)return;const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;const hits=points.filter(c=>Math.abs(c.sx-x)<=Math.max(12,c.size*.48)&&Math.abs(c.sy-y)<=Math.max(12,c.size*.48)).sort((a,b)=>Number(word.keys.includes(b.key))-Number(word.keys.includes(a.key))||b.z-a.z);if(hits[0])select?.(hits[0].key);}
 const wheel=e=>{e.preventDefault();magnification=Math.max(.45,Math.min(4,magnification*(e.deltaY>0?.9:1.1)));queue();};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('wheel',wheel,{passive:false});
 const resize=new ResizeObserver(queue);resize.observe(host);queue();
 function alignWord(){yaw=word.direction==='depth'?-1.35:-.18;pitch=word.direction==='down' ? .15 : .25;}
 return {input,update:(v,key,entry)=>{const changed=word.number!==entry.number;values=v;active=key;word=entry;if(focusWord&&changed)alignWord();queue();},setVisible:value=>{visible=value;queue();},zoom:step=>{magnification=Math.max(.45,Math.min(4,magnification+step*.2));queue();},fit:()=>{magnification=1;queue();},focus:()=>{focusWord=!focusWord;if(focusWord){overview={yaw,pitch,magnification};magnification=1;alignWord();}else if(overview){({yaw,pitch,magnification}=overview);}queue();return focusWord;},toggleLetters:()=>{showOtherLetters=!showOtherLetters;queue();return showOtherLetters;},reset:()=>{yaw=-.58;pitch=.42;magnification=1;focusWord=false;queue();},dispose:()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();}};
}
