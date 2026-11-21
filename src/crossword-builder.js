// A bounded, connected two- or three-axis layout. Only the private server sees words.
const axes={across:[0,1,0],down:[1,0,0],depth:[0,0,1]},key=(r,c,z)=>`${r}:${c}:${z}`;
function shuffle(values,rng){const a=[...values];for(let i=a.length-1;i>0;i--){const j=rng(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function connectedWordGroups(candidates){
 const groups=[];
 for(const c of candidates){let group={words:[c],letters:new Set(c.word)};for(let i=groups.length-1;i>=0;i--)if([...group.letters].some(l=>groups[i].letters.has(l))){group={words:[...group.words,...groups[i].words],letters:new Set([...group.letters,...groups[i].letters])};groups.splice(i,1);}groups.push(group);}
 return groups.map(g=>g.words).sort((a,b)=>b.length-a.length);
}
export function connectedCrossword(candidates,goal,rng,{initial=[],dimension=3}={}){
 const axisNames=dimension===2?['across','down']:Object.keys(axes);
 const groups=connectedWordGroups(candidates).filter(g=>g.length>=goal),seeded=new Set(initial.map(e=>e.index));
 if(!groups.length&&!initial.length)return null;
 let best=null;
 const attempts=dimension===2?48:goal<=10?24:12;
 for(let attempt=0;attempt<attempts;attempt++){
  const grid=new Map(),byLetter=new Map(),entries=[],used=new Set(),directions=new Set();let serial=0;
  function place(c,row,col,depth,direction,number=++serial){
   serial=Math.max(serial,number);entries.push({...c,row,col,depth,direction,number});used.add(c.index);directions.add(direction);const [dr,dc,dz]=axes[direction];
   [...c.word].forEach((letter,i)=>{const r=row+dr*i,k=col+dc*i,z=depth+dz*i,id=key(r,k,z),old=grid.get(id);if(old)old.directions.add(direction);else{const cell={row:r,col:k,depth:z,letter,directions:new Set([direction])};grid.set(id,cell);if(!byLetter.has(letter))byLetter.set(letter,[]);byLetter.get(letter).push(cell);}});
  }
  for(const e of initial){const c=candidates.find(c=>c.index===e.index);if(c)place(c,e.row,e.col,e.depth||0,e.direction,e.number);}
  const pool=shuffle(initial.length?candidates:groups[rng(0,groups.filter(g=>g.length===groups[0].length).length-1)],rng),todo=pool.filter(c=>!seeded.has(c.index));
  if(!entries.length){const seed=todo.shift();place(seed,0,0,0,'across');}
  let pending=todo,steps=0;
  while(entries.length<goal&&pending.length&&steps++<goal){
   const retry=[];let changed=false;
   for(const candidate of pending){
    if(entries.length>=goal)break;
    const poses=[],chars=[...candidate.word],axisOrder=shuffle(axisNames,rng).sort((a,b)=>Number(directions.has(a))-Number(directions.has(b)));
    search:for(const direction of axisOrder){const [dr,dc,dz]=axes[direction];for(let i=0;i<chars.length;i++)for(const cell of byLetter.get(chars[i])||[]){
     if(cell.directions.has(direction))continue;
     const r=cell.row-dr*i,c=cell.col-dc*i,z=cell.depth-dz*i;
     if(grid.has(key(r-dr,c-dc,z-dz))||grid.has(key(r+dr*chars.length,c+dc*chars.length,z+dz*chars.length)))continue;
     let crosses=0,valid=true;
     for(let j=0;j<chars.length;j++){const row=r+dr*j,col=c+dc*j,depth=z+dz*j,old=grid.get(key(row,col,depth));if(old){if(old.letter!==chars[j]||old.directions.has(direction)){valid=false;break;}crosses++;}else if(dimension===2&&(grid.has(key(row+dc,col+dr,depth))||grid.has(key(row-dc,col-dr,depth)))){valid=false;break;}}
     if(valid){const extent=Math.max(Math.abs(r),Math.abs(c),Math.abs(z),Math.abs(r+dr*chars.length),Math.abs(c+dc*chars.length),Math.abs(z+dz*chars.length));poses.push({r,c,z,direction,score:crosses*8-extent+(directions.has(direction)?0:20)+rng(0,5)});if(poses.length>=12)break search;}
    }}
    if(poses.length){poses.sort((a,b)=>b.score-a.score);const p=poses[0];place(candidate,p.r,p.c,p.z,p.direction);changed=true;}else retry.push(candidate);
   }
   if(!changed)break;pending=retry;
  }
  const cells=[...grid.values()],minR=Math.min(...cells.map(c=>c.row)),minC=Math.min(...cells.map(c=>c.col)),minZ=Math.min(...cells.map(c=>c.depth));
  const rows=Math.max(...cells.map(c=>c.row))-minR+1,cols=Math.max(...cells.map(c=>c.col))-minC+1,layers=Math.max(...cells.map(c=>c.depth))-minZ+1;
  const board={rows,cols,layers,entries:entries.map(e=>({...e,row:e.row-minR,col:e.col-minC,depth:e.depth-minZ})),score:entries.length*100000+directions.size*1000-rows*cols*layers};
  if(!best||board.score>best.score)best=board;
  if(entries.length===goal&&directions.size===Math.min(axisNames.length,goal)&&attempt>=3)break;
 }
 return best?.entries.length>=goal?best:null;
}
