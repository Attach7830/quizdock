// Each event has its own vector choreography, contained inside the existing canvas.
// With motion disabled, draw a still at the midpoint; the text notice remains readable.
export function drawArcadeEvent(ctx, kind, width, progress, moving = true) {
 const p = moving ? Math.max(0, Math.min(1, progress)) : .5;
 const x = width * .5, y = 92, travel = Math.sin(p * Math.PI), gold = '#ffda83', mint = '#a3f5df', violet = '#cbb5ff';
 const dot = (a,b,r,color) => { ctx.beginPath(); ctx.arc(a,b,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); };
 const path = (points,color,size=3) => { ctx.beginPath(); points.forEach(([a,b],i) => i ? ctx.lineTo(a,b) : ctx.moveTo(a,b)); ctx.strokeStyle=color; ctx.lineWidth=size; ctx.stroke(); };
 const ring = (a,b,r,color,size=3) => { ctx.beginPath(); ctx.ellipse(a,b,r,r*.7,0,0,Math.PI*2); ctx.strokeStyle=color; ctx.lineWidth=size; ctx.stroke(); };
 const box = (a,b,w,h,color) => { ctx.fillStyle=color; ctx.fillRect(a,b,w,h); };
 const sparkle = (a,b,r,color) => { path([[a-r,b],[a+r,b]],color,2); path([[a,b-r],[a,b+r]],color,2); };
 ctx.save(); ctx.globalAlpha = moving ? Math.min(1,p*6,(1-p)*5) : .85;
 switch (kind) {
  case 'coin-comet': {
   const cx = width * (.1 + p*.8), cy = 25 + p*85;
   for(let i=9;i>=0;i--)dot(cx-i*9,cy-i*4,Math.max(2,12-i),i%2?gold:'#fff4c2');
   for(let i=0;i<7;i++)dot(x+(i-3)*23,30+((p*150+i*17)%130),4,gold);
   break;
  }
  case 'vault-echo':
   for(let i=0;i<4;i++)ring(x,113,16+((p*85+i*23)%95),gold,4-i*.7);
   box(x-18,87,36,27,gold); path([[x-9,100],[x+9,100]],'#6f4c31'); break;
  case 'compass-cache':
   ring(x,y,43,gold); ctx.translate(x,y); ctx.rotate(p*Math.PI*3);
   path([[0,-35],[10,0],[0,35],[-10,0],[0,-35]],mint,4);dot(0,0,5,gold); break;
  case 'lantern-shoal':
   for(let i=0;i<6;i++){const fx=width*((p+i/6)%1),fy=110+Math.sin(p*6+i)*24;dot(fx,fy,8,mint);path([[fx-8,fy],[fx-19,fy-7],[fx-19,fy+7],[fx-8,fy]],gold,3);dot(fx+3,fy-2,2,'#17374c');}break;
  case 'pearl-dive':
   ring(x,148,45*travel,mint);dot(x,145-travel*85,18,'#fff3e1');ring(x,145-travel*85,23,violet);sparkle(x+27,48,8,gold);break;
  case 'tidal-lift':
   for(let j=0;j<3;j++){const pts=[];for(let i=0;i<=30;i++)pts.push([width*i/30,115+Math.sin(i*.22-p*7+j*.7)*(18+travel*15)+j*11]);path(pts,['#89dbe5',mint,'#d4ffff'][j],4);}break;
  case 'aegis-bloom':
   for(let i=0;i<8;i++){const a=i*Math.PI/4;ring(x+Math.cos(a)*30*travel,y+Math.sin(a)*25*travel,18,mint);}
   path([[x-25,65],[x+25,65],[x+19,104],[x,123],[x-19,104],[x-25,65]],gold,4);break;
  case 'meteor-volley':
   for(let i=0;i<4;i++){const a=p*5+i*Math.PI/2,mx=x+Math.cos(a)*width*.27,my=y+Math.sin(a)*48;path([[mx-18,my-10],[mx,my]],gold,5);dot(mx,my,9,violet);}break;
  case 'repair-drone': {
   const dx=x+Math.sin(p*5)*width*.16,dy=40+travel*12;box(dx-18,dy-8,36,16,mint);dot(dx,dy,5,violet);path([[dx-28,dy-13],[dx+28,dy-13]],gold);
   path([[dx-10,dy+12],[x-18,142],[x+18,142],[dx+10,dy+12]],'#b9ffe799',2);sparkle(x,122,12,mint);break;
  }
  case 'overdrive':
   for(let i=0;i<3;i++){ctx.save();ctx.translate(x+(i-1)*58,y);ctx.rotate((i%2?-1:1)*p*9);ring(0,0,22,gold,5);for(let j=0;j<8;j++){ctx.rotate(Math.PI/4);box(19,-4,12,8,mint);}ctx.restore();}break;
  case 'cargo-airship': {
   const bx=width*(-.1+p*1.2);dot(bx,40,28,gold);path([[bx-18,58],[bx-12,82],[bx+12,82],[bx+18,58]],mint,2);box(bx-13,80,26,17,'#e3b67d');
   box(bx-7,102+travel*30,14,14,violet);break;
  }
  case 'golden-blueprint':
   box(x-60,44,120,94,'#244c6e');path([[x-60,44],[x+60,44],[x+60,138],[x-60,138],[x-60,44]],gold,3);
   for(let i=0;i<4;i++)path([[x-48,60+i*19],[x+48,60+i*19]],'#d5edff55',1);
   path([[x-40,117],[x-17,75],[x+10,103],[x+37,65]],mint,4);sparkle(x+44,y,10*travel,gold);break;
  case 'slipstream':
   for(let j=0;j<5;j++){const pts=[];for(let i=0;i<=30;i++)pts.push([width*i/30,y+Math.sin(i*.19-p*7+j*.55)*20+(j-2)*13]);path(pts,j%2?mint:'#e2f3ff88',3);}break;
  case 'rainbow-gates':
   for(let i=0;i<3;i++){const gx=width*(.2+i*.28)-p*width*.13;ring(gx,y,26+travel*13,[gold,mint,violet][i],6);sparkle(gx,y,4,'#f3ffff');}break;
  case 'cloud-trampoline':
   for(let i=0;i<5;i++)dot(x+(i-2)*21,146+Math.abs(i-2)*3+travel*8,19,'#cee9fc');
   path([[x-38,107-travel*48],[x,94-travel*48],[x+38,107-travel*48]],gold,5);
   path([[x-20,125],[x-20,113-travel*15]],mint,3);path([[x+20,125],[x+20,113-travel*15]],mint,3);break;
  case 'aurora-bridge':
   for(let j=0;j<5;j++){const pts=[];for(let i=0;i<=30;i++)pts.push([width*.2+width*.6*i/30,114-Math.sin(i/30*Math.PI)*(60+travel*12)+j*5+Math.sin(p*6+i*.3)*5]);path(pts,[mint,violet,gold,'#94cfff','#d5ffec'][j],4);}break;
  case 'root-renewal':
   for(let i=0;i<7;i++){const dx=(i-3)*23;path([[x,156],[x+dx*.35,135-travel*15],[x+dx,142-travel*55]],mint,4);dot(x+dx,142-travel*55,5,gold);}break;
  case 'crystal-orbit':
   ring(x,y,58,violet,2);
   for(let i=0;i<3;i++){const a=p*5+i*Math.PI*2/3,cx=x+Math.cos(a)*58,cy=y+Math.sin(a)*40;path([[cx,cy-15],[cx+10,cy],[cx,cy+15],[cx-10,cy],[cx,cy-15]],mint,4);sparkle(cx,cy,4,gold);}break;
 }
 ctx.restore();
}
