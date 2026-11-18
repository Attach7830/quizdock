export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const requireChoice=(ok,message='That adventure choice is unavailable.')=>{if(!ok)throw new Error(message);};
export function pick(list,rng){return list.length?list[rng(0,list.length-1)]:undefined;}
export function shuffled(list,rng){const out=[...list];for(let i=out.length-1;i>0;i--){const j=rng(0,i);[out[i],out[j]]=[out[j],out[i]];}return out;}
export function spend(p,amount=1){const discount=Math.min(amount,p.expedition.freeSteps||0),cost=amount-discount;requireChoice(p.expedition.energy>=cost,`Earn ${cost} adventure token${cost===1?'':'s'} with correct answers first.`);p.expedition.energy-=cost;p.expedition.freeSteps=(p.expedition.freeSteps||0)-discount;}
export function bonus(room,p,amount){amount=clamp(Math.round(amount),0,100);if(room.mode==='treasure')p.coins+=amount;else if(room.mode==='factory')p.cash+=amount;else p.score+=amount;p.expedition.bonus+=amount;return amount;}
export function contribute(p,kind,amount=1){p.expedition.stats[kind]=(p.expedition.stats[kind]||0)+amount;}
export function celebrate(room,kind,title,detail){const w=room.expedition;w.cinema={id:`${room.roundNumber}:${++w.celebrations}`,kind,title,detail,tick:w.tick};}
export function boss(size,name){const max=Math.max(90,size*28);return {name,hp:max,max,phase:1,defeated:0,contributors:[]};}
export function hitBoss(room,p,target,damage,title){
 if(room.expedition.modifier==='teamwork'&&!target.contributors.includes(p.id))damage+=Math.min(12,target.contributors.length*3);target.hp=Math.max(0,target.hp-damage);if(!target.contributors.includes(p.id))target.contributors.push(p.id);target.phase=target.hp<target.max/3?3:target.hp<target.max*2/3?2:1;
 if(target.hp)return false;target.defeated++;celebrate(room,'boss',title||`${target.name} cleared!`,`${target.contributors.length} adventurer${target.contributors.length===1?'':'s'} contributed.`);contribute(p,'bosses');target.max=Math.round(target.max*1.15);target.hp=target.max;target.phase=1;target.contributors=[];return true;
}
export function graph(rng,size=18,kinds=['cache','relic','temple']){return Array.from({length:size},(_,i)=>({id:i,row:Math.floor(i/3),column:i%3,kind:i===0?'start':pick(kinds,rng),next:i>=size-3?[]:[(Math.floor(i/3)+1)*3+i%3,(Math.floor(i/3)+1)*3+(i%3+1)%3]}));}
export function startPath(){return {position:0,visited:[0],chapter:1};}
export function stepPath(path,map,index){requireChoice(Number.isInteger(index)&&map[path.position]?.next.includes(index),'Choose a connected, unexplored route.');path.position=index;path.visited.push(index);return map[index];}
export function publicMap(path,map){const visible=new Set([...path.visited,...(map[path.position]?.next||[])]);return map.map(n=>({id:n.id,row:n.row,column:n.column,kind:visible.has(n.id)?n.kind:'fog',next:visible.has(n.id)?n.next:[],visited:path.visited.includes(n.id),available:map[path.position]?.next.includes(n.id)}));}
