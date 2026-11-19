import test from 'node:test';
import assert from 'node:assert/strict';
import {eventPresentation,eventNotice} from '../public/js/event-notice.js';
import {ARCADE_EVENTS} from '../public/js/event-catalog.js';
import {characterParts,characterMarkup} from '../public/js/characters.js';
import {SKINS} from '../public/js/catalog.js';
import {maybeArcadeEvent} from '../src/arcade-events.js';
import {newPlayer,validateQuestions} from '../src/game.js';
import {TeacherLibrary} from '../src/library-service.js';
import {context,internal} from './memory-runtime.js';
import {hash} from '../src/library-domain.js';
test('Aegis flash uses actual restored health instead of its maximum description',()=>{
 const q=validateQuestions([{text:'Q',answers:['A','B'],correct:[0]}]);
 for(const [hp,expected] of [[75,'25 health restored'],[96,'4 health restored'],[100,'Health already full']]){
  const p=newPlayer('p','token','Student',q);p.hp=hp;p.eventProgress={steps:3,sequence:0,lastKind:null};const room={mode:'battle',status:'playing',roundNumber:1,players:{p}};
  const event=maybeArcadeEvent(room,p,0,()=>0);assert.equal(eventPresentation(event).title,'Aegis bloom!');assert.equal(eventPresentation(event).outcome,expected);assert.equal(p.hp,100);assert.equal(p.correct,0);assert.equal(p.answered,0);
 }
});
test('all event announcements use the awarded currencies and combined rewards truthfully',()=>{
 for(const events of Object.values(ARCADE_EVENTS))for(const event of events)assert.ok(eventPresentation({...event,amount:17,health:4,fish:0}).title.endsWith('!'));
 assert.equal(eventPresentation({kind:'overdrive',amount:60}).outcome,'$60 earned');
 assert.equal(eventPresentation({kind:'repair-drone',amount:10,health:3}).outcome,'3 health restored · 10 bonus points');
 assert.equal(eventPresentation({kind:'vault-echo',amount:12}).outcome,'12 coins gained');
 assert.equal(eventPresentation({kind:'lantern-shoal',amount:20,fish:2}).outcome,'20 bonus points · 2 bonus fish caught');
 assert.equal(eventPresentation({kind:'aegis-bloom',health:NaN,amount:Infinity}).outcome,'Reward received');
 assert.equal(eventPresentation({kind:'unknown'}),null);
 assert.match(eventNotice({kind:'aegis-bloom',id:'one',health:25}),/<em>Aegis bloom!<\/em>/);
 assert.equal(eventNotice({kind:'aegis-bloom',id:'one',health:25,playerName:'<script>bad</script>'},true).includes('<script>'),false);
});
test('character catalog preserves old IDs/prices and adds five distinct original purchasable designs',()=>{
 assert.deepEqual(SKINS.slice(0,8).map(s=>[s.id,s.price]),[['mint',0],['coral',60],['solar',90],['orchid',120],['arctic',150],['ember',180],['forest',200],['midnight',250]]);
 assert.deepEqual(SKINS.filter(s=>s.rarity).map(s=>[s.id,s.price]),[['stormwing',7500],['frostblade',10000],['nebula',50000],['sunforge',100000],['kitsune',250000]]);assert.equal(SKINS.length,13);assert.equal(new Set(SKINS.map(s=>s.id)).size,13);assert.equal(new Set(SKINS.map(characterMarkup)).size,13);
 for(const skin of SKINS){const parts=characterParts(skin);assert.ok(parts.length>15);assert.ok(parts.every(p=>p.d&&Number.isFinite(p.opacity)));assert.equal(characterParts(skin),parts);}
 assert.equal(characterMarkup({primary:'" onload="bad()'}).includes('onload='),false);assert.doesNotThrow(()=>characterMarkup(null));
});
test('new character purchases use the existing atomic wallet, preserve old ownership and cannot charge twice',async()=>{
 const ctx=context(),service=new TeacherLibrary(ctx,{}),email='student@example.com',id=await hash(email),token='test-session';
 await ctx.storage.put({['account:'+id]:{id,email,name:'Student',points:SKINS.find(s=>s.id==='stormwing').price+10,owned:['mint','coral'],skin:'coral'},['session:'+await hash(token)]:{owner:id,email,kind:'student',expiresAt:Date.now()+60000}});
 const buy=()=>service.fetch(internal('academy:buy-skin',{skinId:'stormwing'},token));const rs=await Promise.all([buy(),buy()]);assert.ok(rs.every(r=>r.status===200));
 const p=await ctx.storage.get('account:'+id);assert.equal(p.points,10);assert.deepEqual(p.owned,['mint','coral','stormwing']);assert.equal(p.skin,'stormwing');
 const denied=await service.fetch(internal('academy:buy-skin',{skinId:'nebula'},token));assert.equal(denied.status,400);assert.match((await denied.json()).error,/more reward points/);assert.equal((await ctx.storage.get('account:'+id)).points,10);
 assert.equal((await service.fetch(internal('academy:equip-skin',{skinId:'coral'},token))).status,200);assert.equal((await ctx.storage.get('account:'+id)).points,10);
});

test('higher prices reject a forged cheap price while already-owned legendary characters stay free to equip',async()=>{
 const ctx=context(),service=new TeacherLibrary(ctx,{}),email='student@example.com',id=await hash(email),token='price-session';
 await ctx.storage.put({['account:'+id]:{id,email,name:'Student',points:450,owned:['mint','kitsune'],skin:'mint'},['session:'+await hash(token)]:{owner:id,email,kind:'student',expiresAt:Date.now()+60000}});
 assert.equal((await service.fetch(internal('academy:buy-skin',{skinId:'nebula',price:450},token))).status,400);
 assert.equal((await service.fetch(internal('academy:equip-skin',{skinId:'kitsune'},token))).status,200);
 const p=await ctx.storage.get('account:'+id);assert.equal(p.points,450);assert.equal(p.skin,'kitsune');assert.deepEqual(p.owned,['mint','kitsune']);
});
