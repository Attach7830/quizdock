const palette={treasure:['#ffdf8c','#f8b363'],fishing:['#b4f9ed','#81d8ff'],battle:['#dab8ff','#ffb4d9'],factory:['#ffdb95','#a0f4df'],rally:['#d0ffff','#acbeff'],keep:['#b2ffe4','#d0baff'],word:['#ebc3ff','#ffe6b1'],sketch:['#a9ecff','#ffdeab']};
function star(ctx,x,y,r,color){ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.3:r;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();}
export function sceneAtmosphere(ctx,mode,w,h,t){
 const [light,second]=palette[mode]||palette.treasure;
 ctx.save();
 const glow=ctx.createRadialGradient(w*.5,h*.42,3,w*.5,h*.45,Math.max(w,h)*.65);glow.addColorStop(0,light+'24');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 for(let i=0;i<20;i++){const x=(i*79.7+t*(mode==='rally'?25:2.5))%(w+24)-12,y=18+(i*43.3)%(h-32);ctx.globalAlpha=.13+(Math.sin(t*.7+i)+1)*.1;star(ctx,x,y,1.5+i%3, i%2?light:second);}
 if(mode==='rally')for(let i=0;i<9;i++){const x=w-(t*85+i*47)%(w+80),y=20+i*(h-30)/9;ctx.globalAlpha=.1;ctx.strokeStyle=light;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+25+i%3*10,y);ctx.stroke();}
 ctx.restore();
}
export function rewardBurst(ctx,mode,w,h,progress,moving=true){
 const p=moving?Math.max(0,Math.min(1,progress)):.42;if(p>=1)return;
 const [light,second]=palette[mode]||palette.treasure,x=w*.5,y=h*.47;
 ctx.save();ctx.globalAlpha=moving?Math.sin(p*Math.PI)*.45:.15;
 for(let i=0;i<12;i++){const a=i*Math.PI/6+p*.18,r=Math.max(w,h)*.72;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.lineTo(x+Math.cos(a+.075)*r,y+Math.sin(a+.075)*r);ctx.closePath();ctx.fillStyle=i%2?light:second;ctx.fill();}
 for(let i=0;i<38;i++){const a=i*2.39996,r=(30+i%6*8)+p*Math.min(w,h)*.6,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.75+p*p*35;ctx.globalAlpha=(1-p)*.8;star(ctx,px,py,2+i%4,i%2?light:second);}
 ctx.globalAlpha=(1-p)*.6;ctx.strokeStyle=light;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(x,y,24+p*w*.45,16+p*h*.25,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
