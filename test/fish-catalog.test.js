import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_SPECIES,FISH_RARITIES,FISH_BY_ID,FISH_ROLL_TOTAL,fishRarityWeights} from '../public/js/fish-catalog.js';
import {fishParts,fishMarkup} from '../public/js/fish-art.js';
import {journalPage,FISH_PAGE_SIZE,fishJournal} from '../public/js/fish-journal.js';
import {catchRarity,selectFish} from '../src/fishing-catches.js';
import {newPlayer,validateQuestions} from '../src/game.js';
import {createGameWorld,grantGameplayReward} from '../src/gameplay.js';
import {createExpedition,roomPassport} from '../src/expedition.js';
import {fishingAction} from '../src/expeditions/fishing.js';
import {gameSettings} from '../src/academy-model.js';
const first=a=>a,last=(a,b)=>b;
test('300 named species have stable legacy identities and every water has the complete rarity ladder',()=>{
 assert.equal(FISH_SPECIES.length,300);assert.equal(FISH_BY_ID.size,300);assert.equal(new Set(FISH_SPECIES.map(f=>f.name)).size,300);
 const legacy=['reef-skipper','golden-fin','coral-crown','star-whisker','blue-grouper','steel-marlin','abyss-ray','leviathan-koi','lantern-minnow','glass-fin','moon-carp','aurora-dragon'];
 assert.deepEqual(FISH_SPECIES.filter(f=>f.legacy).map(f=>f.id),legacy);assert.notEqual(FISH_BY_ID.get('leviathan-koi').rarity,'mythic');
 for(const water of ['reef','deep','shallows']){
  assert.equal(FISH_SPECIES.filter(f=>f.water===water).length,100);
  assert.deepEqual(FISH_RARITIES.map(r=>FISH_SPECIES.filter(f=>f.water===water&&f.rarity===r.id).length),[40,28,16,10,4,2]);
 }
 for(const f of FISH_SPECIES){assert.match(f.id,/^[a-z0-9-]{1,40}$/);assert.ok(f.description);assert.match(f.color,/^#[0-9a-f]{6}$/);}
});
test('exact ticket boundaries keep the Mythic tier at 50 per million with every habitat boost',()=>{
 for(let boost=0;boost<=6;boost++){
  const weights=fishRarityWeights(boost);assert.equal(weights.reduce((a,b)=>a+b),FISH_ROLL_TOTAL);assert.equal(weights.at(-1),50);
  let prior=0;weights.forEach((weight,i)=>{assert.ok(weight>0);assert.equal(catchRarity(prior+1,boost),FISH_RARITIES[i].id);assert.equal(catchRarity(prior+weight,boost),FISH_RARITIES[i].id);prior+=weight;});
  assert.equal(catchRarity(999950,boost),'legendary');assert.equal(catchRarity(999951,boost),'mythic');assert.equal(catchRarity(1000000,boost),'mythic');
 }
 assert.throws(()=>catchRarity(0));assert.throws(()=>catchRarity(1000001));assert.throws(()=>catchRarity(1.5));
 assert.deepEqual(fishRarityWeights(100),fishRarityWeights(6));assert.deepEqual(fishRarityWeights(-1),fishRarityWeights(0));
});
test('discovery help stays inside a rolled rarity, never converts duplicates to Mythics, and does not favor unseen Mythics',()=>{
 for(const water of ['reef','deep','shallows']){
  const owned=FISH_SPECIES.filter(f=>f.rarity!=='mythic').map(f=>f.id);
  assert.equal(selectFish({water,boost:6,owned,preferNew:true},first).rarity,'common');
  const one=selectFish({water},first),fresh=selectFish({water,owned:[one.id],preferNew:true},first);assert.notEqual(fresh.id,one.id);assert.equal(fresh.rarity,one.rarity);
  const mythics=FISH_SPECIES.filter(f=>f.water===water&&f.rarity==='mythic');
  const rng=(a,b)=>b===1000000?b:a;
  assert.equal(selectFish({water,owned:[mythics[0].id],preferNew:true},rng).id,mythics[0].id);
  assert.equal(selectFish({water},last).id,mythics[1].id);
 }
});
function room(){const r={pin:'123456',mode:'fishing',roundNumber:1,status:'playing',settings:gameSettings({engagement:true}),players:{},questions:validateQuestions([{text:'Q',answers:['A','B'],correct:[0]}])};r.players.p=newPlayer('p','token','Student',r.questions);createGameWorld(r);createExpedition(r,first);return r;}
test('ordinary correct-answer and optional habitat casts both use the real Mythic selection rules',()=>{
 const r=room(),p=r.players.p;p.answered++;p.correct++;const reward=grantGameplayReward(r,p,last);
 assert.equal(FISH_BY_ID.get(p.adventure.lastCatch.species).rarity,'mythic');assert.match(reward.text,/MYTHIC/);
 p.expedition.energy=1;fishingAction(r,p,'water','deep',first);const text=fishingAction(r,p,'cast','cast',last);
 assert.equal(FISH_BY_ID.get(p.expedition.modeState.lastCatch.id).rarity,'mythic');assert.equal(FISH_BY_ID.get(p.expedition.modeState.lastCatch.id).water,'deep');assert.match(text,/MYTHIC/);assert.equal(p.expedition.energy,0);
});
test('all species have distinct cached original art, and unknown IDs cannot inject markup',()=>{
 const art=new Set();for(const f of FISH_SPECIES){const p=fishParts(f.id);assert.ok(p.length>=3);assert.equal(fishParts(f.id),p);assert.ok(p.every(x=>x.d&&x.fill&&!/NaN|undefined/.test(x.d)));art.add(JSON.stringify(p));assert.match(fishMarkup(f.id),/<svg/);}
 assert.equal(art.size,300);assert.equal(fishMarkup('\"><script>bad</script>').includes('<script>'),false);
});
test('journal paging covers the whole catalog, combines filters and searches, and caps each render',()=>{
 const all=[];for(let page=0;page<13;page++){const p=journalPage({}, {page});assert.ok(p.items.length<=FISH_PAGE_SIZE);all.push(...p.items.map(f=>f.id));}assert.equal(new Set(all).size,300);
 const f=FISH_SPECIES.find(f=>f.water==='deep'&&f.rarity==='mythic'),records={[f.id]:{count:2,best:4.2}};
 assert.deepEqual(journalPage(records,{water:'deep',rarity:'mythic',owned:'caught',search:f.name}).items.map(f=>f.id),[f.id]);
 assert.equal(journalPage(records,{owned:'missing'}).total,299);assert.equal(journalPage(records,{page:999}).page,12);assert.equal(journalPage({}, {search:'not-a-species'}).total,0);
 assert.equal((fishJournal(records).match(/class="exp-fish-card /g)||[]).length,24);assert.match(fishJournal(records),/1 in 20,000/);
});
test('live room passports keep ghosts but do not copy lifetime fish collections or private progress',()=>{
 const input={best:{fishing:{score:200}},fish:{'reef-skipper':{count:9}},stats:{correct:99},userId:'private'};
 assert.deepEqual(roomPassport(input),{best:input.best});assert.equal(roomPassport(null),null);assert.equal(input.fish['reef-skipper'].count,9);
});

test('shiny fish use an independent 1 in 8192 roll, with distinct original SVG/canvas geometry for every species',async()=>{
 const {rollShiny,SHINY_ODDS}=await import('../src/fishing-catches.js');assert.equal(SHINY_ODDS,8192);let hits=0;for(let ticket=1;ticket<=SHINY_ODDS;ticket++)if(rollShiny((a,b)=>{assert.equal(a,1);assert.equal(b,8192);return ticket;}))hits++;assert.equal(hits,1);
 const shinyArt=new Set();for(const f of FISH_SPECIES){const p=fishParts(f.id,{shiny:true});assert.notDeepEqual(p,fishParts(f.id));assert.ok(p.every(p=>!String(p.d).includes('NaN')));shinyArt.add(JSON.stringify(p));assert.match(fishMarkup(f.id,{shiny:true}),/shiny-fish/);}assert.equal(shinyArt.size,300);
 const r=room(),p=r.players.p;p.answered++;p.correct++;grantGameplayReward(r,p,first);assert.equal(p.adventure.lastCatch.shiny,true);assert.ok(p.adventure.shinyCollection.includes(p.adventure.lastCatch.species));
 const both=(a,b)=>b===8192?1:b;p.answered++;p.correct++;grantGameplayReward(r,p,both);assert.equal(FISH_BY_ID.get(p.adventure.lastCatch.species).rarity,'mythic');assert.equal(p.adventure.lastCatch.shiny,true);
});
test('shiny journal filtering keeps base and variant discovery records separate',()=>{
 const records={'reef-skipper':{count:4,best:6,shinyCount:1,shinyBest:2}};
 assert.equal(journalPage(records,{variant:'shiny',owned:'caught'}).total,1);assert.equal(journalPage(records,{variant:'shiny',owned:'missing'}).total,299);assert.equal(journalPage(records,{owned:'caught'}).total,1);
});
