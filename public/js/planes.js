// Original aircraft silhouettes shared by the choice cards and live canvas.
export const PLANES = {
 sprinter:{name:'Comet Racer',tagline:'Built for straight-line speed',color:'#ffae65',trim:'#ffe8b0',wing:'#cf6356',
  body:[[-69,8],[-39,-5],[37,-3],[75,10],[35,21],[-49,22]],
  wings:[[-15,8],[-62,46],[8,31],[37,12]],tail:[[-47,6],[-69,-18],[-69,15]],engines:[[56,10]],flame:true},
 navigator:{name:'Harbor Twinwing',tagline:'A steady flight through every storm',color:'#7de0d5',trim:'#d4ffff',wing:'#437baf',
  body:[[-57,4],[-29,-7],[33,-7],[63,9],[30,23],[-47,20]],
  wings:[[-33,2],[-48,47],[26,45],[38,10]],tail:[[-42,5],[-64,-24],[-62,17]],engines:[[19,32],[52,6]],flame:false},
 ace:{name:'Violet Kestrel',tagline:'A nimble craft for streak masters',color:'#c2a3ff',trim:'#fff0b4',wing:'#7558bc',
  body:[[-71,13],[-31,-7],[35,-10],[78,10],[17,27],[-52,24]],
  wings:[[-13,7],[-68,49],[22,29],[39,9]],tail:[[-48,8],[-71,-26],[-65,17]],engines:[[50,9]],flame:true}
};
export const planeByRole = role => PLANES[role] || PLANES.sprinter;
const points = polygon => polygon.map(p=>p.join(',')).join(' ');
export function planeMarkup(role) {
 const p=planeByRole(role);
 return `<svg class="plane-preview" viewBox="-110 -55 220 120" aria-hidden="true" focusable="false" data-plane="${PLANES[role]?role:'sprinter'}"><ellipse cx="0" cy="51" rx="79" ry="7" fill="#091a3155"/><path d="M-100 1h33m-30 20h24m-12 19h18" stroke="${p.trim}" stroke-width="3" stroke-linecap="round" opacity=".4"/><polygon points="${points(p.wings)}" fill="${p.wing}" stroke="${p.trim}" stroke-width="1.5"/><polygon points="${points(p.tail)}" fill="${p.wing}"/><polygon points="${points(p.body)}" fill="${p.color}" stroke="${p.trim}" stroke-width="1.5"/><path d="M-35 13h66" stroke="${p.trim}" stroke-width="4"/><path d="M-13 1q0-29 28-21L29 0Z" fill="#1c3c61" stroke="${p.trim}" stroke-width="2"/><path d="M-5-7l14-9" stroke="#c6f6ff" stroke-width="3"/>${p.engines.map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="5" ry="17" fill="#e9ffffaa"/>`).join('')}</svg>`;
}
export function drawPlane(ctx,role,x,y,scale=1,propeller=1,boost=0) {
 const p=planeByRole(role);
 const polygon=(vertices,fill)=>{ctx.beginPath();vertices.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=p.trim;ctx.lineWidth=1.3;ctx.stroke();};
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 if(boost&&p.flame)polygon([[-60,12],[-100-boost*22,17],[-60,22]],'#ffda88');
 polygon(p.wings,p.wing);polygon(p.tail,p.wing);polygon(p.body,p.color);
 ctx.strokeStyle=p.trim;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-35,13);ctx.lineTo(31,13);ctx.stroke();
 for(const [a,b] of p.engines){ctx.beginPath();ctx.ellipse(a,b,3,8+Math.abs(propeller)*14,0,0,Math.PI*2);ctx.fillStyle='#e6ffffbb';ctx.fill();}
 ctx.restore();
}
