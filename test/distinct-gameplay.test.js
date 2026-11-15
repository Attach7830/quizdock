import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,validateQuestions,scoreboard,settleTime} from '../src/game.js';
import {createGameWorld,grantGameplayReward,openGameplayChest,resolveGameplayChoice,finishDefaultChoice,publicPlay,publicWorld,newAdventure} from '../src/gameplay.js';
import {FISH_SPECIES} from '../public/js/gameplay-catalog.js';
const min=(a,b)=>a,max=(a,b)=>b;
const questions=validateQuestions([{text:'Q',answers:['A','B'],correct:[0]}]);
function room(mode,count=2){const r={pin:'123456',mode,status:'playing',roundNumber:1,players:{},endsAt:60000,lastPassiveAt:10000};for(let i=0;i<count;i++){const p=newPlayer('p'+i,'token'+i,'Player '+i,questions);p.roleType=mode==='rally'?'navigator':mode==='keep'?'warden':null;r.players[p.id]=p;}createGameWorld(r);return r;}
function good(r,p,rng=min){p.answered++;p.correct++;p.streak++;return grantGameplayReward(r,p,rng);}
function move(r,p,choice,rng=min){return resolveGameplayChoice(r,p,p.pendingPlay.id,choice,rng,123);}
test('treasure banking, capped raids, protected turns and storms preserve the vault',()=>{
 const r=room('treasure'),[p,other]=Object.values(r.players);p.coins=100;p.adventure.expedition=3;good(r,p);const bank=openGameplayChest(r,p,0);assert.equal(p.adventure.vault,p.coins);assert.equal(p.adventure.expedition,0);assert.equal(bank.points,18);
 other.coins=200;other.adventure.vault=180;good(r,p);p.pendingChests[2].roll=20;const raid=openGameplayChest(r,p,2);assert.equal(other.coins,196);assert.equal(other.adventure.vault,180);assert.equal(raid.points,22);
 good(r,p);p.pendingChests[2].roll=20;openGameplayChest(r,p,2);assert.equal(other.coins,196,'a reading student is not raided repeatedly');
 other.answered++;good(r,p);p.pendingChests[2].roll=20;openGameplayChest(r,p,2);assert.equal(other.coins,192);
 p.coins=200;p.adventure.vault=190;good(r,p);p.pendingChests[2].roll=60;const storm=openGameplayChest(r,p,2);assert.equal(p.adventure.vault,190);assert.equal(storm.points,8);assert.equal(p.coins,208);assert.throws(()=>openGameplayChest(r,p,2),/available chest/);
});
test('treasure exploration builds a capped multiplier and chest outcomes remain fixed until opened',()=>{
 const r=room('treasure'),p=r.players.p0;let prior=0;
 for(let i=0;i<10;i++){good(r,p);const stored=structuredClone(p.pendingChests),reward=openGameplayChest(r,p,1);assert.deepEqual(stored[1],{route:'ruins',roll:1,amount:24});assert.ok(reward.points>=prior);prior=reward.points;}
 assert.equal(p.adventure.expedition,5);assert.equal(prior,34);
});
test('fishing guarantees new discoveries within chosen waters and preserves real catches on every success',()=>{
 const r=room('fishing'),p=r.players.p0,weather=new Set([p.adventure.weather]);
 for(let i=0;i<25;i++){const old=p.score,reward=good(r,p);assert.ok(reward.points>0&&p.score>old);assert.equal(p.fishCount,i+1);weather.add(p.adventure.weather);finishDefaultChoice(r,p);}
 assert.equal(p.adventure.collection.length,4);assert.ok(p.adventure.collection.every(id=>FISH_SPECIES.find(f=>f.id===id).water==='reef'));assert.ok(p.biggestFish>0);assert.ok(weather.size>=2);
 good(r,p);move(r,p,'deep');const old=p.adventure.collection.length;good(r,p);assert.equal(FISH_SPECIES.find(f=>f.id===p.adventure.lastCatch.species).water,'deep');assert.equal(p.adventure.collection.length,old+1);
});
test('battle has deferred moves, bounded protection, charged strikes and guard counters',()=>{
 const r=room('battle'),p=r.players.p0,other=r.players.p1;
 good(r,other);move(r,other,'guard');good(r,other);move(r,other,'guard');assert.equal(other.adventure.shield,36);
 good(r,p);assert.equal(other.hp,100,'correct answer alone does not auto-attack');const before=other.score;move(r,p,'strike');assert.equal(other.hp,100);assert.equal(other.score,before+12);assert.equal(other.adventure.shield,16);
 good(r,p);const training=move(r,p,'strike');assert.match(training.text,/Training/);assert.equal(other.hp,100);
 other.answered++;good(r,p);move(r,p,'charge');assert.equal(p.adventure.charge,2);good(r,p);const hit=move(r,p,'strike');assert.equal(p.adventure.charge,1);assert.equal(hit.effect.amount,20);assert.equal(other.hp,80);
});
test('battle knockouts never eliminate a player and a move cannot be paid twice',()=>{
 const r=room('battle'),p=r.players.p0,other=r.players.p1;other.hp=10;good(r,p);const id=p.pendingPlay.id;move(r,p,'strike');assert.equal(other.hp,100);assert.equal(p.knockouts,1);const score=p.score;
 assert.equal(resolveGameplayChoice(r,p,id,'strike').duplicate,true);assert.equal(p.score,score);assert.equal(p.knockouts,1);assert.throws(()=>resolveGameplayChoice(r,p,id,'guard'),/no longer available/);
});
test('factory stations consume real cash, retain asset value and make complementary parts',()=>{
 const r=room('factory'),p=r.players.p0;for(let i=0;i<3;i++){good(r,p);if(i<2)finishDefaultChoice(r,p);}
 const total=scoreboard(r.players,'factory').find(x=>x.id===p.id).score,oldCash=p.cash;move(r,p,'build-cells');assert.equal(p.cash,oldCash-90);assert.equal(p.adventure.assetValue,90);assert.equal(scoreboard(r.players,'factory').find(x=>x.id===p.id).score,total);
 good(r,p);assert.equal(p.adventure.stock.cells,1);finishDefaultChoice(r,p);good(r,p);move(r,p,'build-assembler');good(r,p);assert.equal(p.adventure.stock.bots,1);assert.equal(p.adventure.stock.cells,2);
 const order=structuredClone(p.adventure.order),before=p.cash,id=p.pendingPlay.id;move(r,p,'ship');assert.equal(p.cash,before+order.payout);assert.equal(p.adventure.orders,1);const paid=p.cash;resolveGameplayChoice(r,p,id,'ship');assert.equal(p.cash,paid);
});
test('factory refuses unaffordable construction and Next never spends cash automatically',()=>{
 const r=room('factory'),p=r.players.p0;good(r,p);const before=structuredClone(p);assert.throws(()=>move(r,p,'build-assembler'),/current supplies/);assert.deepEqual(p,before);finishDefaultChoice(r,p);assert.equal(p.cash,before.cash);assert.equal(p.adventure.assetValue,0);
});
test('new-round passive production is fuel-bounded and stops during pause',()=>{
 const r=room('factory'),p=r.players.p0;p.machineLevel=2;p.adventure.fuel=2;p.cash=0;settleTime(r,30000);assert.equal(p.cash,32);assert.equal(p.adventure.fuel,0);settleTime(r,35000);assert.equal(p.cash,32);r.status='paused';p.adventure.fuel=2;assert.equal(settleTime(r,39000),false);assert.equal(p.adventure.fuel,2);
});
test('rally route failure preserves base role distance, boost has a cost, and drafting is capped',()=>{
 const r=room('rally'),p=r.players.p0;p.adventure.line='rings';p.adventure.wind='storm';const fail=good(r,p,max);assert.equal(fail.points,23);assert.equal(p.adventure.lastLeg.bonus,0);assert.equal(p.score,23);finishDefaultChoice(r,p);
 p.adventure.line='glide';good(r,p);finishDefaultChoice(r,p);good(r,p);assert.equal(p.adventure.boost,3);move(r,p,'dive');const before=p.score,boosted=good(r,p);assert.equal(p.adventure.boost,1);assert.ok(p.score-before>=20+boosted.effect.bonus);assert.ok([16,32].includes(boosted.effect.bonus));
 r.players.p1.score=100000;finishDefaultChoice(r,p);good(r,p);assert.equal(p.adventure.lastLeg.draft,10);
});
test('Keep supplies build permanent team towers without spending contribution score',()=>{
 const r=room('keep'),p=r.players.p0;for(let i=0;i<3;i++){good(r,p);if(i<2)finishDefaultChoice(r,p);}const score=p.score,correct=p.correct;move(r,p,'tower');assert.equal(r.gameplay.keep.towers.bolt,1);assert.equal(p.adventure.supplies,0);assert.equal(p.score,score);assert.equal(p.correct,correct);
 good(r,p);finishDefaultChoice(r,p);good(r,p);r.gameplay.keep.crystal=295;const repaired=move(r,p,'repair');assert.equal(r.gameplay.keep.crystal,300);assert.match(repaired.text,/5 shared health/);
});
test('Keep enemy replies account for broad participation, wave wins and last stands are recoverable',()=>{
 const r=room('keep',45),p=r.players.p0,k=r.gameplay.keep;assert.equal(k.enemyMax,540);for(let i=0;i<4;i++){good(r,p);finishDefaultChoice(r,p);}assert.equal(k.crystal,300);
 for(let i=1;i<23;i++)good(r,r.players['p'+i]);assert.equal(k.crystal,290);
 k.enemyHp=1;const before=p.score;good(r,p);assert.equal(k.cleared,1);assert.equal(k.wave,2);assert.ok(p.score>=before+12);assert.ok(k.enemyHp>0);
 const solo=room('keep',1),s=solo.players.p0;solo.gameplay.keep.crystal=1;solo.gameplay.keep.enemyHp=1000;good(solo,s);assert.equal(solo.gameplay.keep.crystal,120);assert.equal(solo.gameplay.keep.lastStand,1);assert.equal(s.correct,1);
});
test('public game state exposes only available offers and legacy rooms keep their original rules',()=>{
 const r=room('factory'),p=r.players.p0;good(r,p);const offer=publicPlay(r,p);assert.equal(offer.options.length,4);assert.equal(offer.defaultChoice,'continue');assert.ok(offer.options.some(x=>!x.enabled));assert.equal(JSON.stringify(publicWorld(room('keep'))).includes('participants'),false);
 const legacy=room('battle');delete legacy.gameplay;const old=legacy.players.p1.hp;grantGameplayReward(legacy,legacy.players.p0);assert.equal(legacy.players.p1.hp,old-20);assert.equal(publicWorld(legacy),null);assert.equal(publicPlay(legacy,legacy.players.p0),null);assert.equal(newAdventure('treasure').vault,0);
});
