import {BUILD_MOVES} from '../../public/js/expedition-catalog.js';
import {bonus,boss,celebrate,contribute,hitBoss,pick,requireChoice,spend} from './shared.js';
const ELEMENTS=['fire','frost','wind'],OBJECTIVES=['beacon','escort','defend'];
export function createBattle(w,size,rng){w.battle={boss:boss(size,'The mirror guardian'),hazard:1,objective:'beacon',objectiveProgress:0,objectives:0,weakness:pick(ELEMENTS,rng),comboSerial:0};}
export function battlePlayer(){return {loadout:['spark','frost','gale'],draftLocked:false,lane:0,guard:0,elements:[],combos:0,objectives:0,lastCastTick:-100,lastElement:null,pairSerial:-1};}
export function battleAnswer(room,p,rng){const w=room.expedition.battle,s=p.expedition.modeState;if(s.lane===w.hazard){const loss=Math.max(0,7-s.guard);p.hp=Math.max(10,p.hp-loss);s.guard=0;}if(room.expedition.tick%3===0)w.hazard=(w.hazard+1)%3;if(room.expedition.tick%6===0)w.weakness=pick(ELEMENTS,rng);}
export function battleAction(room,p,action,value,rng){
 const w=room.expedition.battle,s=p.expedition.modeState;
 if(action==='draft'){requireChoice(!s.draftLocked,'Your loadout locks after your first spell.');const ids=String(value).split(',');requireChoice(ids.length===3&&new Set(ids).size===3&&ids.every(id=>BUILD_MOVES.some(m=>m.id===id)));s.loadout=ids;return 'Three moves drafted for this round.';}
 if(action==='lane'){requireChoice(/^[0-2]$/.test(String(value)));s.lane=+value;return `Moved to lane ${s.lane+1}. Read the next hazard before answering.`;}
 if(action==='cast'){
  const move=BUILD_MOVES.find(m=>m.id===value);requireChoice(move&&s.loadout.includes(value),'Choose a move in your drafted loadout.');spend(p);s.draftLocked=true;
  if(value==='mend'){p.hp=Math.min(100,p.hp+12);contribute(p,'support');hitBoss(room,p,w.boss,8);return 'Mend restored health and supported the class encounter.';}
  if(value==='ward'){s.guard=12;contribute(p,'support');return 'Your ward will absorb the next lane hazard.';}
  s.elements.push(move.element);if(s.elements.length>2)s.elements.shift();const phase=w.boss.phase;let damage=move.element===w.weakness?(phase===3?34:26):(phase===2?10:14),detail=`${move.name} struck the guardian.`;
  if(s.elements.length===2&&s.elements[0]!==s.elements[1]){damage+=18;s.combos++;contribute(p,'combos');detail=s.elements.includes('fire')?'Storm strike! Two elements combined.':'Frost veil! Two elements combined.';if(!s.elements.includes('fire'))s.guard=8;s.elements=[];}
  const peers=Object.values(room.players).filter(x=>x.id!==p.id&&!x.deleted).sort((a,b)=>a.id.localeCompare(b.id)),partner=peers.length?peers[Math.abs(Object.keys(room.players).sort().indexOf(p.id))%peers.length]:null,ps=partner?.expedition?.modeState;
  if(ps&&room.expedition.tick-ps.lastCastTick<=3&&ps.lastElement!==move.element&&s.pairSerial!==w.comboSerial){damage+=12;s.pairSerial=w.comboSerial++;contribute(p,'support');detail+=' Partner resonance!';}
  if(phase===3){p.hp=Math.max(10,p.hp-Math.max(0,4-s.guard));s.guard=Math.max(0,s.guard-4);}s.lastCastTick=room.expedition.tick;s.lastElement=move.element;const won=hitBoss(room,p,w.boss,damage,'The mirror guardian falls!');bonus(room,p,won?45:10);return detail+(won?' The class cleared a boss phase!':'');
 }
 if(action==='objective'){spend(p);w.objectiveProgress++;s.objectives++;contribute(p,'support');bonus(room,p,12);if(w.objectiveProgress>=Math.max(3,Math.ceil(room.expedition.size/2))){w.objectiveProgress=0;w.objectives++;w.objective=OBJECTIVES[w.objectives%3];celebrate(room,'objective','Objective complete!',`Next objective: ${w.objective}.`);}return `You helped ${w.objective==='beacon'?'hold the beacon':w.objective==='escort'?'escort the courier':'defend the crystal'}.`;}
 throw new Error('Choose an arena action.');
}
export function battleView(room,p){const w=room.expedition.battle;return {...p.expedition.modeState,...w,size:room.expedition.size,boss:{...w.boss,contributors:undefined}};}
