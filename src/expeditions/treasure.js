import {bonus,boss,celebrate,contribute,graph,hitBoss,pick,publicMap,requireChoice,spend,startPath,stepPath} from './shared.js';
const REGIONS=['cave','ruins','wreck'];
export function createTreasure(w,size,rng){w.treasure={map:graph(rng,18,['cache','fragment','relic','mimic','temple']),fragments:0,fragmentGoal:Math.max(4,size*2),shipPosition:15,ship:boss(size,'The roaming ghost ship')};}
export function treasurePlayer(){return {...startPath(),region:'ruins',relics:[],encounter:null,locks:0,temples:0,fragments:0,secret:0};}
export function treasureAnswer(room,p){
 const w=room.expedition.treasure,s=p.expedition.modeState;
 if(s.encounter){s.encounter.progress++;if(s.encounter.progress>=s.encounter.goal){const kind=s.encounter.kind;s.encounter=null;s.locks++;bonus(room,p,kind==='mimic'?18:30);contribute(p,'discoveries');if(kind==='temple'){s.temples++;w.fragments++;celebrate(room,'vault','Temple vault opened!','Three learning seals gave way.');}}}
 if(room.expedition.tick%4===0)w.shipPosition=(w.shipPosition+1)%18;
}
export function treasureAction(room,p,action,value,rng){
 const w=room.expedition.treasure,s=p.expedition.modeState;
 if(action==='region'){requireChoice(REGIONS.includes(value));spend(p);s.region=value;contribute(p,'discoveries');return `Your expedition now explores the ${value}.`;}
 if(action==='travel'){
  requireChoice(!s.encounter,'Complete the current encounter with correct answers first.');spend(p);const node=stepPath(s,w.map,Number(value));contribute(p,'rooms');
  if(node.kind==='fragment'){w.fragments++;s.fragments++;contribute(p,'support');return 'A map fragment joins the class atlas.';}
  if(node.kind==='relic'){const found=pick(['compass','lantern','key'].filter(id=>!s.relics.includes(id)),rng);if(found)s.relics.push(found);contribute(p,'discoveries');return found?`Relic discovered: ${found}.`:'Your relic collection is complete.';}
  if(node.kind==='mimic'||node.kind==='temple'){s.encounter={kind:node.kind,progress:0,goal:node.kind==='mimic'?2:s.relics.includes('key')?2:3};return node.kind==='mimic'?'A mimic! Correct answers help you escape with its bonus cache.':'A temple lock awaits. Correct answers break its seals.';}
  bonus(room,p,8+(s.region==='wreck'?4:0));return 'An expedition cache added to your haul.';
 }
 if(action==='secret'){requireChoice(s.relics.includes('compass')&&s.relics.includes('lantern')&&s.secret<s.chapter,'Combine a compass and lantern to find one secret chamber per map.');spend(p);s.secret=s.chapter;w.fragments+=2;bonus(room,p,28);contribute(p,'discoveries');return 'Compass + lantern: a secret room and two atlas fragments!';}
 if(action==='heist'){requireChoice(w.fragments>=w.fragmentGoal,'The class must assemble the atlas first.');spend(p,Math.abs(s.position-w.shipPosition)<=3?1:2);const won=hitBoss(room,p,w.ship,22,'The ghost ship’s vault is yours!');contribute(p,'support');bonus(room,p,won?35:8);return won?'The class intercepted the ghost ship and opened its vault!':'Your expedition intercepted the ghost ship. Its spectral defenses weakened.';}
 if(action==='new-map'){requireChoice(!w.map[s.position].next.length,'Reach the end of this map first.');spend(p);s.position=0;s.visited=[0];s.chapter++;s.encounter=null;bonus(room,p,15);return 'A new island expedition begins.';}
 throw new Error('Choose a treasure expedition action.');
}
export function treasureView(room,p){const w=room.expedition.treasure,s=p.expedition.modeState;return {...s,map:publicMap(s,w.map),fragments:w.fragments,fragmentGoal:w.fragmentGoal,ship:{...w.ship,contributors:undefined},shipPosition:w.shipPosition};}
