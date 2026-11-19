import {selectFish,rollShiny} from './fishing-catches.js';
import {randomInt,grantAnswerReward} from './game.js';
import {roleById} from '../public/js/catalog.js';
import {GAMEPLAY_VERSION,WATERS,FISH_SPECIES,WINDS,FISH_WEATHER,ARENAS,STATIONS,ENEMIES,CHEST_ROUTES} from '../public/js/gameplay-catalog.js';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pick=(items,rng)=>items[rng(0,items.length-1)];
const nextDifferent=(items,id,rng)=>pick(items.filter(x=>x.id!==id),rng).id;
export const hasGameplay=room=>room?.gameplay?.version===GAMEPLAY_VERSION;
export function newAdventure(mode){
 const common={mode,revision:0};
 if(mode==='word'||mode==='sketch')return {...common,solved:0,drawings:0,constellations:0};
 if(mode==='treasure')return {...common,vault:0,expedition:0,protectedAt:-1,lastChest:null};
 if(mode==='fishing')return {...common,water:'reef',weather:'clear',casts:0,collection:[],shinyCollection:[],drought:0,lastCatch:null};
 if(mode==='battle')return {...common,shield:0,charge:0,protectedAt:-1,stance:'ready',arena:'standard',turns:0};
 if(mode==='factory')return {...common,stations:{press:1,cells:0,assembler:0},stock:{gears:0,cells:0,bots:0},assetValue:0,fuel:0,cycles:0,market:'gears',order:{id:1,part:'gears',quantity:4,payout:65},orders:0};
 if(mode==='rally')return {...common,line:'glide',boost:0,wind:'tailwind',legs:0,lastLeg:null};
 return {...common,supplies:0,contribution:0};
}
function state(room,p){if(!p.adventure||p.adventure.mode!==room.mode)p.adventure=newAdventure(room.mode);return p.adventure;}
export function createGameWorld(room){
 const size=clamp(Object.keys(room.players).length,1,45),max=Math.max(80,size*12);
 room.gameplay={version:GAMEPLAY_VERSION,activePlayers:size,keep:{wave:1,crystal:300,maxCrystal:300,enemy:'swarm',enemyHp:max,enemyMax:max,energy:0,towers:{bolt:0,ward:0},participants:[],contributors:[],steps:0,lastStand:0,cleared:0,lastOutcome:'The first wave approaches.'}};
 for(const p of Object.values(room.players)){p.adventure=newAdventure(room.mode);p.pendingPlay=null;p.lastPlay=null;}
 return room.gameplay;
}
function offer(room,p,options,defaultChoice){p.pendingPlay={id:`${room.roundNumber}:${p.id}:${p.answered}`,options,defaultChoice};}
function stationCost(s,station){return station.base+s.stations[station.id]*45;}
function available(room,p,option){
 const s=state(room,p);
 if(option.id.startsWith('build-')){const station=STATIONS.find(x=>x.id===option.id.slice(6));return !!station&&s.stations[station.id]<5&&p.cash>=stationCost(s,station);}
 if(option.id==='ship')return s.stock[s.order.part]>=s.order.quantity;
 if(room.mode==='rally'&&option.id==='dive')return s.boost>=2;
 if(room.mode==='keep'){if(option.id==='tower')return s.supplies>=3&&room.gameplay.keep.towers.bolt+room.gameplay.keep.towers.ward<8;if(option.id==='repair')return s.supplies>=2&&room.gameplay.keep.crystal<300;if(option.id==='barrage')return s.supplies>=1;}
 return true;
}
function preparePlay(room,p){
 const s=state(room,p);let options=[],defaultChoice;
 if(room.mode==='fishing'){options=WATERS.map(w=>({id:w.id,label:w.name,hint:w.hint}));defaultChoice=s.water;}
 if(room.mode==='battle'){options=[{id:'strike',label:s.charge?'Charged strike':'Strike',hint:s.charge?'Spend one charge for a stronger hit.':'Hit a nearby-rank rival. A protected rival cannot be hit again yet.'},{id:'guard',label:'Guard and recover',hint:`Restore 10 health and absorb up to ${(ARENAS.find(a=>a.id===s.arena)||ARENAS[0]).guard} damage. A full block earns a counter bonus.`},{id:'charge',label:'Build charge',hint:`Store ${(ARENAS.find(a=>a.id===s.arena)||ARENAS[0]).charge} charge for a future strike. Maximum 3 charges.`}];defaultChoice='strike';}
 if(room.mode==='factory'){options=[...STATIONS.map(station=>({id:'build-'+station.id,label:`${s.stations[station.id]?'Upgrade':'Build'} ${station.name}`,hint:`$${stationCost(s,station)} · ${station.id==='assembler'?'Turns gears + cells into bots.':`Produces ${station.part} on correct answers.`}`,cost:stationCost(s,station)})),{id:'ship',label:`Ship ${s.order.quantity} ${s.order.part}`,hint:`Earn $${s.order.payout}. This order stays until you complete it.`},{id:'continue',label:'Keep producing',hint:'Save your cash.',hidden:true}];defaultChoice='continue';}
 if(room.mode==='rally'){options=[{id:'glide',label:'Glide and charge',hint:'Reliable distance and stored boost.'},{id:'rings',label:'Ring route',hint:`A chance at extra distance. ${WINDS.find(x=>x.id===s.wind).hint}`},{id:'dive',label:'Boost dive',hint:'Spend 2 boost on the next correct answer for a breakaway.'}];defaultChoice=s.line==='dive'&&s.boost<2?'glide':s.line;}
 if(room.mode==='keep'){options=[{id:'barrage',label:'Crystal barrage',hint:'1 supply · Deal 18 damage to the shared enemy.'},{id:'tower',label:room.gameplay.keep.towers.bolt<=room.gameplay.keep.towers.ward?'Build bolt tower':'Build ward tower',hint:'3 supplies · Alternating attack and defense towers help the whole class.'},{id:'repair',label:'Repair the crystal',hint:'2 supplies · Restore up to 40 shared health.'},{id:'save',label:'Save supplies',hint:'Keep supplies for a tower or repair.',hidden:true}];defaultChoice='save';}
 if(options.length)offer(room,p,options,defaultChoice);
}
function change(p){p.adventure.revision++;}
export function grantGameplayReward(room,p,rng=randomInt){
 if(!hasGameplay(room))return grantAnswerReward(room,p);
 const s=state(room,p);let reward;
 if(room.mode==='word'){const used=p.wordPuzzle?.guesses.length||0,misses=p.wordPuzzle?.misses||0,points=60+Math.min(p.streak*5,25)+Math.max(0,18-misses*3-used*2);p.score+=points;s.solved++;const complete=s.solved%5===0?30:0;p.score+=complete;s.constellations=Math.floor(s.solved/5);reward={text:`Word forged! +${points+complete} points${complete?' · Constellation complete!':''}`,points:points+complete,effect:{type:'decode',amount:points+complete}};
 }else if(room.mode==='treasure'){
  p.pendingChests=CHEST_ROUTES.map(route=>({route:route.id,roll:rng(1,100),amount:route.id==='harbor'?rng(18,28):route.id==='ruins'?rng(24,42):rng(18,28)}));
  reward={text:'Choose a route for your treasure.',needsChest:true,effect:{type:'prepare'}};
 }else if(room.mode==='fishing'){
  const water=WATERS.find(w=>w.id===s.water),fish=selectFish({water:s.water,boost:(s.water==='shallows'?1:0)+(s.weather==='moon'?1:0),owned:s.collection,preferNew:s.drought>=5},rng),shiny=rollShiny(rng);
  if(shiny){s.shinyCollection||=[];if(!s.shinyCollection.includes(fish.id))s.shinyCollection.push(fish.id);}
  const fresh=!s.collection.includes(fish.id);if(fresh){s.collection.push(fish.id);s.drought=0;}else s.drought++;
  const weight=Math.round(rng(6,60)/10*(1+p.rodLevel*.4)*water.factor*(s.weather==='current'?1.1:1)*10)/10,collectionBonus=fresh&&s.collection.length%4===0?35:0,points=Math.round(weight*10)+(fresh?8:0)+(fish.rare?45:0)+collectionBonus;
  p.fishCount++;p.biggestFish=Math.max(p.biggestFish,weight);p.score+=points;s.casts++;s.lastCatch={species:fish.id,shiny,weight,points,fresh,collectionBonus,water:s.water};
  if(s.casts%4===0)s.weather=nextDifferent(FISH_WEATHER,s.weather,rng);
  reward={text:`${fresh?'New discovery! ':''}${shiny?'SHINY! ':''}${fish.rarity==='mythic'?'MYTHIC! ':''}${fish.name} · ${weight.toFixed(1)} kg · +${points} points${collectionBonus?' · Collection bonus!':''}`,points,effect:{type:'catch',weight,points,species:fish.id,shiny}};
 }else if(room.mode==='battle'){
  const points=60+Math.min(p.streak*10,50);p.score+=points;s.turns++;if(s.turns%3===0)s.arena=nextDifferent(ARENAS,s.arena,rng);reward={text:`+${points} accuracy points. Choose your arena move.`,points,effect:{type:'prepare'}};
 }else if(room.mode==='factory'){
  reward=grantAnswerReward(room,p);s.cycles++;s.fuel=Math.min(6,s.fuel+2);if(!room.expedition)s.stock.gears+=s.stations.press*2;if(!room.expedition)s.stock.cells+=s.stations.cells;
  const bots=room.expedition?0:Math.min(s.stations.assembler,s.stock.gears,s.stock.cells);s.stock.gears-=bots;s.stock.cells-=bots;s.stock.bots+=bots;
  if(s.cycles%5===0)s.market=nextDifferent(STATIONS.map(x=>({id:x.part})),s.market,rng);
  reward={...reward,text:`${reward.text} Your line produced parts${bots?` and ${bots} bot${bots===1?'':'s'}`:''}.`,effect:{type:'production',bots}};
 }else if(room.mode==='rally'){
  reward=grantAnswerReward(room,p);const role=roleById('rally',p.roleType);let bonus=0,detail='Gliding stores boost.';
  if(s.line==='glide'){bonus=s.wind==='storm'?5:8;}
  if(s.line==='rings'){const chance=s.wind==='storm'?50:s.wind==='crosswind'?65:85,success=rng(1,100)<=chance+(p.roleType==='navigator'?10:0);bonus=success?(p.roleType==='ace'?24:18):0;detail=success?'Rings cleared!':'The rings shifted. Your base distance is safe.';}
  if(s.line==='dive'&&s.boost>=2){s.boost-=2;bonus=s.wind==='storm'?16:32;detail='Boost dive!';}else if(s.line==='dive'){bonus=5;detail='Boost is charging.';}
  const leader=Math.max(...Object.values(room.players).map(x=>x.score||0),p.score),draft=leader-p.score>=100?Math.min(10,Math.floor((leader-p.score)/30)):0;
  p.score+=bonus+draft;s.boost=Math.min(3,s.boost+(s.line==='glide'?2:s.line==='rings'?1:bonus===5?1:0));s.legs++;s.lastLeg={line:s.line,wind:s.wind,bonus,draft};if(s.legs%3===0)s.wind=nextDifferent(WINDS,s.wind,rng);
  reward={...reward,text:`${reward.text} · ${detail}${bonus?` +${bonus} route distance.`:''}${draft?` Slipstream +${draft}.`:''}`,points:reward.points+bonus+draft,effect:{...reward.effect,route:s.line,bonus}};
 }else{
  reward=grantAnswerReward(room,p);s.supplies=Math.min(8,s.supplies+1);s.contribution+=reward.points;
  const k=room.gameplay.keep;k.energy+=reward.points;
  if(p.roleType==='mender')k.crystal=Math.min(300,k.crystal+3);
  const damage=6+(p.roleType==='striker'?4:0)+Math.min(12,k.towers.bolt*3);k.enemyHp=Math.max(0,k.enemyHp-damage);k.steps++;
  if(!k.participants.includes(p.id))k.participants.push(p.id);if(!k.contributors.includes(p.id))k.contributors.push(p.id);
  if(!advanceWave(room,rng)){
   const size=clamp(room.gameplay.activePlayers||Object.keys(room.players).length,1,45),ready=k.participants.length>=Math.max(1,Math.ceil(size*.5))||k.steps>=Math.max(4,size*2);
   if(ready){const enemy=ENEMIES.find(e=>e.id===k.enemy),damage=Math.max(2,enemy.damage+Math.floor(k.wave/3)*2-Math.min(14,k.towers.ward*4)-(room.expedition?.keep?.wardBonus||0)-(room.expedition&&p.expedition?.modeState?.front===room.expedition.keep.front?2:0));k.crystal=Math.max(0,k.crystal-damage);k.lastOutcome=`${enemy.name} dealt ${damage} crystal damage.`;k.participants=[];k.steps=0;if(k.crystal===0){k.lastStand++;k.crystal=120;k.lastOutcome='Last stand! The crystal reformed with 120 health. Keep defending.';}}
  }
  reward={...reward,text:`${reward.text} · Your class dealt ${damage} damage. ${k.lastOutcome}`,effect:{...reward.effect,damage}};
 }
 change(p);preparePlay(room,p);return reward;
}
function advanceWave(room,rng){
 const k=room.gameplay.keep;if(k.enemyHp>0)return false;
 const cleared=k.wave;k.cleared++;k.wave++;k.enemy=k.wave%3===0?'wyvern':pick(ENEMIES.filter(e=>e.id!=='wyvern'&&e.id!==k.enemy),rng).id;
 const size=clamp(room.gameplay.activePlayers||Object.keys(room.players).length,1,45),max=Math.round(Math.max(80,size*12)*(1+Math.min(12,k.wave-1)*.12)*(k.enemy==='wyvern'?1.35:1));k.enemyMax=max;k.enemyHp=max;
 for(const id of k.contributors){const p=room.players[id];if(p){p.score+=12;state(room,p).contribution+=12;}}
 k.crystal=Math.min(300,k.crystal+15);k.participants=[];k.contributors=[];k.steps=0;k.lastOutcome=`Wave ${cleared} cleared! +12 energy for its defenders. ${ENEMIES.find(e=>e.id===k.enemy).name} approaches.`;return true;
}
export function openGameplayChest(room,p,chosen,rng=randomInt){
 const s=state(room,p);if(!Array.isArray(p.pendingChests)||!Number.isInteger(chosen)||chosen<0||chosen>2)throw new Error('Choose an available chest.');
 const chest=p.pendingChests[chosen];if(!CHEST_ROUTES.some(x=>x.id===chest.route))throw new Error('This chest belongs to an earlier game.');
 let points=chest.amount,text,effect={type:'chest'};
 if(chest.route==='harbor'){p.coins+=points;s.vault=p.coins;s.expedition=0;text=`Harbor sealed! +${points} coins · ${s.vault} coins protected in your vault.`;}
 if(chest.route==='ruins'){const bonus=Math.round(points*Math.min(5,s.expedition)*.08);points+=bonus;p.coins+=points;s.expedition=Math.min(5,s.expedition+1);text=`Ruins explored! +${points} coins. Your next exploration bonus is ${s.expedition*8}%.`;}
 if(chest.route==='corsair'){
  let detail='A hidden purse!';
  if(chest.roll<=15){points+=65;detail='Corsair jackpot!';}
  else if(chest.roll<=50){const rivals=Object.values(room.players).filter(x=>x.id!==p.id&&x.coins>(x.adventure?.vault||0)&&x.adventure?.protectedAt!==x.answered).sort((a,b)=>(b.coins-(b.adventure?.vault||0))-(a.coins-(a.adventure?.vault||0)));if(rivals.length){const target=rivals[0],ts=state(room,target),stolen=Math.min(40,Math.ceil((target.coins-ts.vault)*.2));target.coins-=stolen;ts.protectedAt=target.answered;points+=stolen;detail=`Raided ${stolen} exposed coins from ${target.name}.`;effect={type:'raid',amount:stolen,targetId:target.id,targetName:target.name};}else{points+=10;detail='The coast was guarded. You found a hidden cache.';}}
  else if(chest.roll<=75){const loss=Math.min(12,Math.max(0,p.coins-s.vault));points-=loss;detail=`Storm crossing! ${loss} exposed coins used for repairs. Your vault stayed safe.`;}
  else points+=12;
  p.coins+=points;text=`${detail} +${points} net coins.`;
 }
 p.pendingChests=null;s.lastChest={route:chest.route,points};change(p);return {text,points,effect:{...effect,route:chest.route,amount:points}};
}
function arenaMove(room,p,choice){
 const s=state(room,p),arena=ARENAS.find(a=>a.id===s.arena)||ARENAS[0];
 if(choice==='guard'){const healed=Math.min(10,100-p.hp);p.hp+=healed;s.shield=Math.min(36,s.shield+arena.guard);s.stance='guard';p.score+=8;return {text:`Guard raised! ${healed} health restored · ${s.shield} shield ready · +8 points.`,effect:{type:'guard',amount:s.shield}};}
 if(choice==='charge'){const gain=Math.min(3-s.charge,arena.charge);s.charge+=gain;s.stance='charge';p.score+=8;return {text:`${gain?'Power charged!':'Charge full!'} ${s.charge}/3 charges stored · +8 points.`,effect:{type:'charge',amount:s.charge}};}
 const targets=Object.values(room.players).filter(x=>x.id!==p.id&&x.adventure?.protectedAt!==x.answered).sort((a,b)=>Math.abs(a.score-p.score)-Math.abs(b.score-p.score)||a.id.localeCompare(b.id));
 if(!targets.length){p.score+=12;s.stance='strike';return {text:'Training strike! Rivals are protected while they answer. +12 points.',effect:{type:'training'}};}
 const target=targets[0],ts=state(room,target),charged=s.charge>0,damage=arena.strike+(charged?16:0),blocked=Math.min(ts.shield,damage);if(charged)s.charge--;ts.shield-=blocked;ts.protectedAt=target.answered;s.stance='strike';target.hp-=damage-blocked;p.score+=12;
 let detail=blocked?` ${blocked} damage absorbed.`:'';if(blocked===damage){const counter=(ARENAS.find(a=>a.id===ts.arena)||ARENAS[0]).counter;target.score+=counter;detail+=` Guard counter! Your rival earned ${counter} points.`;}
 if(target.hp<=0){target.hp=100;p.knockouts++;p.score+=35;detail+=' Knockout! +35 points. Your rival returns at full health.';}
 return {text:`${charged?'Charged strike':'Strike'}! ${target.name} took ${damage-blocked} damage.${detail} +12 points.`,effect:{type:'attack',targetId:target.id,targetName:target.name,amount:damage-blocked,blocked,charged}};
}
export function resolveGameplayChoice(room,p,id,choice,rng=randomInt,now=Date.now()){
 if(!hasGameplay(room))throw new Error('This round uses the original game rules.');
 if(p.lastPlay?.id===id&&p.lastPlay.choice===choice)return {duplicate:true};
 const pending=p.pendingPlay;if(!pending||pending.id!==id)throw new Error('That game choice is no longer available.');
 const option=pending.options.find(x=>x.id===choice);if(!option||!available(room,p,option))throw new Error('That game choice is not available with your current supplies.');
 const s=state(room,p);let reward;
 if(room.mode==='battle')reward=arenaMove(room,p,choice);
 if(room.mode==='fishing'){s.water=choice;reward={text:`Next cast: ${WATERS.find(w=>w.id===choice).name}.`,effect:{type:'water',water:choice}};}
 if(room.mode==='rally'){s.line=choice;reward={text:`Next racing line: ${option.label}. ${s.boost}/3 boost ready.`,effect:{type:'route',route:choice}};}
 if(room.mode==='factory'){
  if(choice==='continue')reward={text:'Cash saved. Your production line is ready for the next correct answer.',effect:{type:'plan'}};
  else if(choice==='ship'){const order=s.order;s.stock[order.part]-=order.quantity;p.cash+=order.payout;s.orders++;const part=pick(STATIONS,rng).part,quantity=part==='bots'?2:part==='cells'?3:4;s.order={id:order.id+1,part,quantity,payout:Math.round(({gears:65,cells:90,bots:140}[part])*(s.market===part?1.3:1))};reward={text:`Order shipped! ${order.quantity} ${order.part} delivered · $${order.payout} earned.`,effect:{type:'shipment',amount:order.payout,part:order.part}};}
  else{const station=STATIONS.find(x=>x.id===choice.slice(6)),cost=stationCost(s,station);p.cash-=cost;s.assetValue+=cost;s.stations[station.id]++;reward={text:`${station.name} level ${s.stations[station.id]} online! $${cost} converted into factory assets.`,effect:{type:'upgrade',station:station.id}};}
  p.score=p.cash+s.assetValue;
 }
 if(room.mode==='keep'){
  const k=room.gameplay.keep;
  if(choice==='barrage'){s.supplies--;const damage=Math.min(k.enemyHp,18);k.enemyHp-=damage;reward={text:`Crystal barrage! ${damage} damage dealt to ${ENEMIES.find(e=>e.id===k.enemy).name}.`,effect:{type:'charge',amount:damage}};}
  if(choice==='tower'){s.supplies-=3;const tower=k.towers.bolt<=k.towers.ward?'bolt':'ward';k.towers[tower]++;if(room.expedition?.keep){const grid=room.expedition.keep.grid,at=grid.findIndex((x,i)=>!x&&i<room.expedition.keep.openCells);if(at>=0)grid[at]={type:tower,level:1,playerId:p.id};}reward={text:`${tower==='bolt'?'Bolt':'Ward'} tower built! Your whole class is stronger.`,effect:{type:'upgrade',tower}};}
  if(choice==='repair'){s.supplies-=2;const restored=Math.min(40,300-k.crystal);k.crystal+=restored;reward={text:`Crystal restored! ${restored} shared health repaired.`,effect:{type:'repair',amount:restored}};}
  if(choice==='save')reward={text:`${s.supplies} supplies saved for your next defense.`,effect:{type:'plan'}};
  if(advanceWave(room,rng))reward.text+=' '+k.lastOutcome;
 }
 if(!reward)throw new Error('Unknown game choice.');
 p.pendingPlay=null;change(p);p.lastPlay={id,choice,...reward,at:now};return reward;
}
export function finishDefaultChoice(room,p,rng=randomInt){if(p.pendingPlay)return resolveGameplayChoice(room,p,p.pendingPlay.id,p.pendingPlay.defaultChoice,rng);return null;}
export function publicAdventure(room,p){if(!hasGameplay(room))return null;const s=p.adventure||newAdventure(room.mode);return structuredClone(s);}
export function publicPlay(room,p){
 if(!hasGameplay(room)||!p.pendingPlay)return null;
 const pending=p.pendingPlay;return {id:pending.id,defaultChoice:pending.defaultChoice,options:pending.options.filter(x=>!x.hidden).map(x=>{const enabled=available(room,p,x),s=state(room,p);let reason='Save more supplies for this move.';if(x.id.startsWith('build-')){const st=STATIONS.find(t=>t.id===x.id.slice(6));reason=s.stations[st.id]>=5?'Maximum station level reached.':`Need $${stationCost(s,st)} cash.`;}else if(x.id==='ship')reason=`Produce ${Math.max(0,s.order.quantity-s.stock[s.order.part])} more ${s.order.part}.`;else if(x.id==='dive')reason='Store at least 2 boost first.';else if(x.id==='repair')reason=room.gameplay.keep.crystal>=300?'The crystal is fully repaired.':'Save 2 supplies to repair.';else if(x.id==='tower')reason=room.gameplay.keep.towers.bolt+room.gameplay.keep.towers.ward>=8?'All eight team towers are built.':'Save 3 supplies for a tower.';return{id:x.id,label:x.label,hint:x.hint,enabled,reason:enabled?'':reason};})};
}
export function publicWorld(room){if(!hasGameplay(room))return null;return room.mode==='keep'?{version:GAMEPLAY_VERSION,keep:{...room.gameplay.keep,participants:undefined,contributors:undefined,steps:undefined}}:{version:GAMEPLAY_VERSION};}
