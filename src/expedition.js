import {randomInt} from './game.js';
import {EXPEDITION_VERSION,INTENSITIES,MODIFIERS,MODE_EVENTS,PERSONAL_QUESTS} from '../public/js/expedition-catalog.js';
import {bonus,celebrate,contribute,pick,requireChoice,shuffled} from './expeditions/shared.js';
import {createTreasure,treasurePlayer,treasureAnswer,treasureAction,treasureView} from './expeditions/treasure.js';
import {createFishing,fishingPlayer,fishingAnswer,fishingAction,fishingView} from './expeditions/fishing.js';
import {createBattle,battlePlayer,battleAnswer,battleAction,battleView} from './expeditions/battle.js';
import {createFactory,factoryPlayer,factoryAnswer,factoryAction,factoryView} from './expeditions/factory.js';
import {createRally,rallyPlayer,rallyAnswer,rallyAction,rallyView} from './expeditions/rally.js';
import {createKeep,keepPlayer,keepAnswer,keepAction,keepView} from './expeditions/keep.js';
import {createWord,wordPlayer,wordAnswer,wordAction,wordView} from './expeditions/word.js';
const MODES={treasure:{create:createTreasure,player:treasurePlayer,answer:treasureAnswer,action:treasureAction,view:treasureView},fishing:{create:createFishing,player:fishingPlayer,answer:fishingAnswer,action:fishingAction,view:fishingView},battle:{create:createBattle,player:battlePlayer,answer:battleAnswer,action:battleAction,view:battleView},factory:{create:createFactory,player:factoryPlayer,answer:factoryAnswer,action:factoryAction,view:factoryView},rally:{create:createRally,player:rallyPlayer,answer:rallyAnswer,action:rallyAction,view:rallyView},keep:{create:createKeep,player:keepPlayer,answer:keepAnswer,action:keepAction,view:keepView},word:{create:createWord,player:wordPlayer,answer:wordAnswer,action:wordAction,view:wordView}};
const score=(room,p)=>room.mode==='treasure'?p.coins:room.mode==='factory'?p.cash+(p.adventure?.assetValue||0):p.score;
export const hasExpedition=room=>room.expedition?.version===EXPEDITION_VERSION;
export function voteExpedition(room,p,modifier){
 requireChoice(['lobby','finished'].includes(room.status),'The vote closes when the round starts.');requireChoice(MODIFIERS.some(m=>m.id===modifier),'Choose a listed round modifier.');room.expeditionVotes=room.expeditionVotes||{};room.expeditionVotes[p.id]=modifier;
}
export function publicVote(room,p){const votes=Object.values(room.expeditionVotes||{});return {options:MODIFIERS.map(m=>({...m,votes:votes.filter(id=>id===m.id).length})),selected:room.expeditionVotes?.[p?.id]||null};}
export function createExpedition(room,rng=randomInt){
 if(!room.settings?.engagement){room.expedition=null;return null;}
 const size=Math.max(1,Object.values(room.players).filter(p=>!p.deleted).length),votes=publicVote(room).options,modifier=[...votes].sort((a,b)=>b.votes-a.votes||MODIFIERS.findIndex(m=>m.id===a.id)-MODIFIERS.findIndex(m=>m.id===b.id))[0]?.id||'explorers';
 room.expedition={version:EXPEDITION_VERSION,size,mode:room.mode,intensity:room.settings.intensity||'standard',modifier,tick:0,revision:0,celebrations:0,tradeSerial:0,eventSerial:0,event:null,cinema:null,deck:shuffled([0,1,2,3,4,5],rng),deckAt:0,sketch:{nextFormat:null,panels:0}};
 MODES[room.mode]?.create(room.expedition,size,rng,room.questions);
 for(const p of Object.values(room.players))ensureExpeditionPlayer(room,p);
 room.expeditionVotes={};return room.expedition;
}
export function ensureExpeditionPlayer(room,p){
 if(!hasExpedition(room))return null;if(p.expedition?.round===room.roundNumber)return p.expedition;
 const quest=PERSONAL_QUESTS[((p.id.charCodeAt(0)||0)+(room.roundNumber||0))%PERSONAL_QUESTS.length];
 p.expedition={round:room.roundNumber,revision:0,energy:0,bonus:0,lastAnswer:p.answered,lastCorrect:0,modeState:MODES[room.mode]?.player()||{panels:0},stats:{correct:0,rooms:0,discoveries:0,support:0,combos:0,deliveries:0,checkpoints:0,bosses:0,quests:0},quest:{id:quest.id,baseline:0,completed:0},receipts:[],timeline:[],note:'Correct answers earn adventure tokens. Open Adventure to choose your path.'};if(room.mode==='word')p.expedition.modeState.activity=room.settings.wordActivity||'auto';return p.expedition;
}
function eventEffect(room,p,index,rng){
 const w=room.expedition,s=p.expedition.modeState;
 if(room.mode==='treasure'){if(index===0)w.treasure.fragments++;if(index===1&&!s.encounter)s.encounter={kind:'mimic',progress:0,goal:2};if(index===2)p.expedition.freeSteps=1;if(index===3&&!s.relics.includes('lantern'))s.relics.push('lantern');if(index===4){w.treasure.fragments+=2;contribute(p,'discoveries');}if(index===5){w.treasure.fragments=Math.max(w.treasure.fragments,w.treasure.fragmentGoal);w.treasure.shipPosition=s.position;}}
 if(room.mode==='fishing'){const f=w.fishing;if(index===0)f.migration=pick(['reef','deep','shallows'],rng);if(index===1){const site=f.sites.find(x=>!s.sonar.includes(x.id));if(site){s.sonar.push(site.id);contribute(p,'discoveries');}}if(index===2||index===3)s.luck=2;if(index>=4){f.boss.hp=Math.max(1,f.boss.hp-15);f.boss.phase=3;}}
 if(room.mode==='battle'){const b=w.battle;if(index===0)b.hazard=(b.hazard+1)%3;if(index===1)s.elements.push('wind');if(index===2)s.guard=12;if(index===3){b.objective=['beacon','escort','defend'][(b.objectives+1)%3];b.objectives++;}if(index>=4){b.boss.hp=Math.max(1,b.boss.hp-15);b.weakness=pick(['fire','frost','wind'],rng);}}
 if(room.mode==='factory'){if(index===0||index===2)s.incident={kind:index===0?'jam':'power',cell:1};if(index===1)s.contract.customer='The Royal Toaster Inspector';if(index===3&&!w.factory.offers.some(o=>o.npc))w.factory.offers.push({id:'merchant:'+w.eventSerial,playerId:null,npc:true,give:'cells',giveCount:1,want:'gears',wantCount:2});if(index===4)s.inspector=true;if(index===5)w.factory.project.progress++;}
 if(room.mode==='rally'){const r=w.rally;if(index===0){const next=r.map[s.position].next[0];if(next!==undefined)r.map[next].kind='ruins';}if(index===1&&!s.rescue&&r.map[s.position].next.length)s.rescue={destination:r.map[s.position].next[0],passenger:'lost courier'};if(index===2)r.gate=(r.gate+1)%3;if(index===3)p.adventure.boost=Math.min(3,p.adventure.boost+1);if(index>=4){r.visitor=index===4?'cloud whale':'flying fortress';r.obstacle.hp=Math.max(1,r.obstacle.hp-12);}}
 if(room.mode==='keep'){const k=w.keep;if(index===0)k.front=(k.front+1)%3;if(index===1){const tower=k.grid.find(Boolean);if(tower)tower.level=Math.min(3,tower.level+1);}if(index===2){k.scout='Scouts found an opening. Your next four correct answers strike harder.';k.scoutFor=4;}if(index===3)k.ultimate+=Math.ceil(k.ultimateGoal/4);if(index===4){k.openCells=Math.min(16,k.openCells+4);k.floor++;}if(index===5){k.dragon=true;k.scoutFor=6;}}
 if(room.mode==='word'){if(index===0)p.expedition.energy=Math.min(12,p.expedition.energy+1);if(index===1)s.rooms++;if(index===2)s.activity='repair';if(index===3)s.activity='affixes';if(index>=4)w.word.guardian.hp=Math.max(1,w.word.guardian.hp-12);}
 if(room.mode==='sketch'){if(index===0)w.sketch.nextFormat='constraint';if(index===1)w.sketch.panels++;if(index===2)w.sketch.nextFormat='duo';if(index===3)w.sketch.nextFormat='story';if(index>=4)celebrate(room,'mural',index===4?'The living gallery!':'The ink phoenix!', 'Your class’s drawings light up the expedition.');}
}
function drawEvent(room,p,rng){
 const w=room.expedition,config=INTENSITIES[w.intensity]||INTENSITIES.standard;if(w.tick%Math.max(2,config.eventEvery-(w.modifier==='discovery'?1:0)))return;
 let index=w.deck[w.deckAt++];if(w.deckAt>=w.deck.length){w.deck=shuffled([0,1,2,3,4,5],rng);w.deckAt=0;}if(index>=4&&w.eventSerial%config.rareEvery!==0)index=w.eventSerial%4;
 const [kind,title,detail]=MODE_EVENTS[room.mode][index];w.event={id:`${room.roundNumber}:${++w.eventSerial}`,kind,title,detail,rare:index>=4,tick:w.tick};eventEffect(room,p,index,rng);if(w.cinema?.tick!==w.tick)celebrate(room,index>=4?'rare':'event',title+'!',detail);
}
export function expeditionAnswer(room,p,correct,rng=randomInt){
 const state=ensureExpeditionPlayer(room,p);if(!state||p.answered<=state.lastAnswer)return;state.lastAnswer=p.answered;state.revision++;room.expedition.revision++;
 if(!correct){if(room.mode==='word')state.modeState.chain=0;state.note='Your answer is saved. The next correct answer earns another adventure token.';return;}
 const w=room.expedition;w.tick++;state.stats.correct++;state.lastCorrect=w.tick;state.energy=Math.min(12,state.energy+1+(w.modifier==='explorers'&&state.stats.correct%3===0?1:0));
 state.note='Adventure token earned. Choose your next move.';MODES[room.mode]?.answer(room,p,rng);state.timeline.push({answered:p.answered,score:score(room,p)});if(state.timeline.length>60)state.timeline.splice(0,state.timeline.length-60);drawEvent(room,p,rng);
}
export function actExpedition(room,p,msg,rng=randomInt){
 requireChoice(hasExpedition(room)&&room.status==='playing','Adventure actions are available during an expedition round.');const s=ensureExpeditionPlayer(room,p);
 requireChoice(typeof msg.id==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(msg.id),'Invalid adventure action identifier.');requireChoice(typeof msg.action==='string'&&msg.action.length<=40&&['string','number'].includes(typeof msg.value)&&String(msg.value).length<=160,'Choose a valid adventure action.');
 const receipt=s.receipts.find(r=>r.id===msg.id);if(receipt){requireChoice(receipt.action===msg.action&&receipt.value===String(msg.value),'That action identifier was already used.');return {duplicate:true,note:receipt.note};}
 requireChoice(Number.isInteger(msg.revision)&&msg.revision===s.revision,'Your adventure changed. Choose from its current screen.');
 const now=Date.now(),rate=s.rate&&now-s.rate.at<1000?s.rate:{at:now,count:0};requireChoice(rate.count<20,'Take a moment between adventure choices.');s.rate={at:rate.at,count:rate.count+1};let note;
 if(msg.action==='quest'){const q=PERSONAL_QUESTS.find(q=>q.id===msg.value);requireChoice(q,'Choose a personal quest.');s.quest={id:q.id,baseline:s.stats[q.metric]||0,completed:s.quest.completed};note='Personal quest selected.';}
 else if(msg.action==='claim-quest'){const q=PERSONAL_QUESTS.find(q=>q.id===s.quest.id);requireChoice((s.stats[q.metric]||0)-s.quest.baseline>=q.target,'Complete your personal quest first.');s.quest.baseline=s.stats[q.metric]||0;s.quest.completed++;s.energy=Math.min(12,s.energy+2);bonus(room,p,12);contribute(p,'quests');note='Personal quest complete! Two adventure tokens and a game bonus.';}
 else note=MODES[room.mode]?.action(room,p,msg.action,String(msg.value),rng);
 requireChoice(note,'That mode does not use this adventure action.');s.note=note;s.revision++;room.expedition.revision++;s.receipts.push({id:msg.id,action:msg.action,value:String(msg.value),note});if(s.receipts.length>64)s.receipts.shift();return {note};
}
export function publicExpedition(room,p){
 if(!hasExpedition(room))return null;const w=room.expedition,shared={version:w.version,mode:room.mode,intensity:w.intensity,modifier:w.modifier,tick:w.tick,revision:w.revision,event:w.event,cinema:w.cinema,size:w.size};
 if(!p)return {...shared,summary:expeditionSummary(room)};
 const s=ensureExpeditionPlayer(room,p),q=PERSONAL_QUESTS.find(q=>q.id===s.quest.id),ghost=p.passport?.best?.[room.mode]||null;
 return {...shared,energy:s.energy,playerRevision:s.revision,bonus:s.bonus,note:s.note,stats:{...s.stats},quest:{...q,progress:Math.max(0,(s.stats[q.metric]||0)-s.quest.baseline),completed:s.quest.completed},ghost:ghost?{score:ghost.score,correct:ghost.correct,timeline:ghost.timeline||[]}:null,state:MODES[room.mode]?.view(room,p)||{panels:w.sketch.panels}};
}
export function expeditionSummary(room){const w=room.expedition;if(!w)return null;return {correct:w.tick,cinema:w.cinema?.title||'',project:room.mode==='factory'?w.factory.project.launches:0,bosses:room.mode==='battle'?w.battle.boss.defeated:room.mode==='fishing'?w.fishing.boss.defeated:room.mode==='rally'?w.rally.obstacle.defeated:room.mode==='word'?w.word.guardian.defeated:room.mode==='treasure'?w.treasure.ship.defeated:0};}
export function expeditionOutcome(room){
 if(!hasExpedition(room))return null;return {version:EXPEDITION_VERSION,classId:room.classId||room.solo?.classId||null,ownerId:room.reportOwner||room.solo?.ownerId||null,roundId:room.roundMetrics?.id,startedAt:room.startedAt,finishedAt:room.finishedAt||Date.now(),mode:room.mode,summary:expeditionSummary(room),players:Object.values(room.players).filter(p=>p.accountId&&!p.deleted&&p.expedition).map(p=>({accountId:p.accountId,answered:p.answered,correct:p.correct,score:score(room,p),stats:p.expedition.stats,timeline:p.expedition.timeline,fish:room.mode==='fishing'?p.expedition.modeState.fish:{},rescues:room.mode==='rally'?p.expedition.modeState.rescued:0})),gallery:room.sketchGallery||[]};
}
export function purgeExpeditionPlayer(room,p){
 if(!hasExpedition(room))return;p.expedition=null;p.passport=null;if(room.expeditionVotes)delete room.expeditionVotes[p.id];for(const mode of ['treasure','fishing','battle','rally','word']){const state=room.expedition[mode],b=state?.boss||state?.ship||state?.obstacle||state?.guardian;if(b)b.contributors=b.contributors.filter(id=>id!==p.id);}if(room.expedition.factory)room.expedition.factory.offers=room.expedition.factory.offers.filter(o=>o.playerId!==p.id);if(room.expedition.keep){room.expedition.keep.ultimateContributors=room.expedition.keep.ultimateContributors.filter(id=>id!==p.id);for(const tile of room.expedition.keep.grid)if(tile?.playerId===p.id)tile.playerId=null;}room.sketchGallery=(room.sketchGallery||[]).filter(entry=>!entry.artistIds?.includes(p.id));
}

// The live room only needs personal-best ghosts. Lifetime collections stay in
// private class profiles, rather than being copied into every active room.
export const roomPassport=passport=>passport?{best:passport.best||{}}:null;
