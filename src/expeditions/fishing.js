import {selectFish,rollShiny} from '../fishing-catches.js';
import {bonus,boss,celebrate,contribute,hitBoss,pick,requireChoice,spend} from './shared.js';
const WATERS=['reef','deep','shallows'],HABITATS=['coral','kelp','cave'];
export function createFishing(w,size,rng){w.fishing={migration:pick(WATERS,rng),migrationStep:0,boss:boss(size,'Lantern Leviathan'),sites:Array.from({length:12},(_,i)=>({id:i,kind:pick(['wreck','cave','pearls','lantern'],rng)}))};}
export function fishingPlayer(){return {water:'reef',habitat:['coral','kelp','cave'],sonar:[],fish:{},lastCatch:null,legendary:0};}
function logCatch(p,id,weight,shiny=false){const s=p.expedition.modeState,old=s.fish[id]||{count:0,best:0};s.fish[id]={count:old.count+1,best:Math.max(old.best,weight),...(shiny||old.shinyCount?{shinyCount:(old.shinyCount||0)+(shiny?1:0),shinyBest:Math.max(old.shinyBest||0,shiny?weight:0)}:{})};s.lastCatch={id,weight,shiny};if(!old.count)contribute(p,'discoveries');}
export function fishingAnswer(room,p,rng){const w=room.expedition.fishing;if(p.adventure?.lastCatch)logCatch(p,p.adventure.lastCatch.species,p.adventure.lastCatch.weight,p.adventure.lastCatch.shiny);if(room.expedition.tick%4===0){w.migration=pick(WATERS.filter(id=>id!==w.migration),rng);w.migrationStep++;}}
export function fishingAction(room,p,action,value,rng){
 const w=room.expedition.fishing,s=p.expedition.modeState;
 if(action==='water'){requireChoice(WATERS.includes(value));s.water=value;return `Following the school into ${value}.`;}
 if(action==='habitat'){const [slot,kind]=String(value).split(':');requireChoice(/^[0-2]$/.test(slot)&&HABITATS.includes(kind));spend(p);s.habitat[+slot]=kind;return 'Habitat arranged. Coral favors reefs, kelp favors discoveries, caves favor larger deep-water fish.';}
 if(action==='cast'){
  spend(p);const affinity=s.habitat.filter(h=>h===(s.water==='reef'?'coral':s.water==='deep'?'cave':'kelp')).length;
  const boost=affinity+(w.migration===s.water?1:0)+(s.luck>0?1:0)+(room.expedition.modifier==='discovery'?1:0);
  if(s.luck>0)s.luck--;
  const fish=selectFish({water:s.water,boost,owned:Object.keys(s.fish),preferNew:Object.keys(s.fish).length%3===2},rng),shiny=rollShiny(rng);
  const weight=Math.round((rng(8,50)+affinity*4+(w.migration===s.water?8:0)))/10;
  logCatch(p,fish.id,weight,shiny);p.fishCount++;p.biggestFish=Math.max(p.biggestFish,weight);bonus(room,p,8+(fish.rare?10:0));
  if(shiny)celebrate(room,'catch','A prismatic shiny!',`${fish.name} shines like an entire galaxy.`);
  else if(fish.rarity==='mythic')celebrate(room,'catch','A Mythic has surfaced!',`${fish.name} — an almost impossible discovery.`);
  return `${shiny?'SHINY! ':''}${fish.rarity==='mythic'?'MYTHIC! ':''}${fish.name}, ${weight.toFixed(1)} kg, joins your expedition journal.`;
 }
 if(action==='sonar'){const index=Number(value);requireChoice(Number.isInteger(index)&&index>=0&&index<12&&!s.sonar.includes(index),'Choose an unsearched sonar square.');spend(p);s.sonar.push(index);contribute(p,'discoveries');bonus(room,p,10);return `Sonar found ${w.sites[index].kind==='pearls'?'a pearl bed':'a hidden '+w.sites[index].kind}!`;}
 if(action==='reel'){spend(p);const damage=w.boss.phase===3?(s.water===w.migration?34:12):w.boss.phase===2?12+new Set(s.habitat).size*5:15+new Set(s.habitat).size*3,won=hitBoss(room,p,w.boss,damage,'The Lantern Leviathan surfaces!');contribute(p,'support');if(won){s.legendary++;logCatch(p,'leviathan-koi',12+new Set(s.habitat).size);bonus(room,p,40);celebrate(room,'catch','A class-sized catch!',`${w.boss.name} lights the lagoon.`);}return won?'The enormous catch joins your journal.':'The class reel tightens. Keep contributing to the giant catch.';}
 throw new Error('Choose a lagoon action.');
}
export function fishingView(room,p){const w=room.expedition.fishing,s=p.expedition.modeState;return {...s,migration:w.migration,migrationStep:w.migrationStep,boss:{...w.boss,contributors:undefined},sites:w.sites.map(site=>({id:site.id,kind:s.sonar.includes(site.id)?site.kind:'unknown',found:s.sonar.includes(site.id)}))};}
