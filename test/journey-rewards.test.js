import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyService} from '../src/journey-service.js';
import {ExpeditionService} from '../src/expedition-service.js';
import {AcademyService} from '../src/academy-domain.js';
import {TeacherLibrary} from '../src/library-service.js';
import {DataTools} from '../src/data-tools.js';
import {hash,uid} from '../src/library-domain.js';
import {AVATAR_ITEMS,itemById,ITEM_SLOTS} from '../public/js/item-catalog.js';
import {JOURNEY_TRACKS,journeyMilestones,COLLECTIONS} from '../public/js/expedition-catalog.js';
import {wardrobeItems,wardrobeResults} from '../public/js/wardrobe-ui.js';
import {MemoryStorage,context,internal} from './memory-runtime.js';

async function fixture(points=333){
 const store=new MemoryStorage(),config={TEACHER_EMAILS:'teacher@example.com'},academy=new AcademyService(store,config),library=new TeacherLibrary(context(store),config),owner=await hash('teacher@example.com'),id=await hash('journey@example.com'),token=uid(),teacherToken=uid();
 await store.put({['account:'+id]:{id,email:'journey@example.com',name:'Journey Student',points,owned:['mint','coral'],skin:'coral',ownedItems:['paper-boat'],equipment:{hat:'paper-boat'},createdAt:Date.now()-100000},['session:'+await hash(token)]:{owner:id,email:'journey@example.com',kind:'student',issuedAt:Date.now(),expiresAt:Date.now()+60000},['session:'+await hash(teacherToken)]:{owner,email:'teacher@example.com',issuedAt:Date.now(),expiresAt:Date.now()+60000}});
 const call=async(action,p={},session=token)=>{const r=await library.fetch(internal('academy:'+action,p,session));return {status:r.status,body:await r.json()};};
 const course=(await call('create-class',{name:'Journey class'},teacherToken)).body.class;await academy.enroll(course.id,id,'journey@example.com','Journey Student');
 return {store,config,academy,library,owner,id,token,teacherToken,course,call,service:new ExpeditionService(store,academy),journey:new JourneyService(store)};
}
async function passport(f,classId,stats){const p=await f.service.passport(classId,f.id);Object.assign(p.stats,stats);await f.store.put(f.service.key(classId,f.id),p);return p;}

test('the expanded wardrobe spans every slot, affordable beginnings, extravagant trophies and sixteen quest rewards',()=>{
 assert.equal(AVATAR_ITEMS.length,100);assert.equal(AVATAR_ITEMS.filter(item=>item.quest).length,16);
 const shop=AVATAR_ITEMS.filter(item=>!item.quest);assert.equal(shop.length,84);assert.equal(Math.min(...shop.map(item=>item.price)),10);assert.equal(Math.max(...shop.map(item=>item.price)),1000000000000);
 for(const slot of Object.keys(ITEM_SLOTS))assert.ok(AVATAR_ITEMS.filter(item=>item.slot===slot).length>=15);
 assert.ok(shop.filter(item=>item.price<=250).length>=15);assert.ok(shop.filter(item=>item.price>=1000000).length>=10);
 const milestones=journeyMilestones();assert.equal(milestones.length,48);assert.equal(new Set(milestones.map(m=>m.id)).size,48);
 for(const track of JOURNEY_TRACKS)assert.ok(track.goals.every((goal,i)=>Number.isSafeInteger(goal)&&goal>0&&(!i||goal>track.goals[i-1])));
 for(const item of AVATAR_ITEMS.filter(item=>item.quest))assert.equal(milestones.filter(m=>m.reward===item.id).length,1);
 assert.equal(COLLECTIONS.length,12);assert.ok(COLLECTIONS.every(c=>new Set(c.items).size===c.items.length&&c.items.every(itemById)));
});

test('existing progress combines across classes, including archived memberships, and retroactive rewards never spend or equip',async()=>{
 const f=await fixture(),otherClass=uid();await f.academy.enroll(otherClass,f.id,'journey@example.com','Journey Student');
 const membership=await f.store.get(`enrollment:${f.id}:${otherClass}`);membership.active=false;await f.store.put(`enrollment:${f.id}:${otherClass}`,membership);
 await passport(f,f.course.id,{correct:300,rounds:25,support:60,accurateRounds:10});await passport(f,otherClass,{correct:200,rounds:25,support:40,accurateRounds:15});
 await f.store.put(`expedition-profile:${f.course.id}:another-account`,{userId:'another-account',stats:{correct:999999,quests:9999}});
 const first=(await f.call('home',{stats:{correct:100000}})).body.user;assert.equal(first.journey.stats.correct,500);assert.equal(first.journey.stats.quests,0);
 for(const item of ['origami-dragon','bookshelf-wings','kindness-lantern','pixel-spectacles'])assert.ok(first.ownedItems.includes(item));
 assert.equal(first.points,333);assert.deepEqual(first.equipment,{hat:'paper-boat'});assert.deepEqual(first.owned,['mint','coral']);
 assert.deepEqual((await f.call('home')).body.user.ownedItems,first.ownedItems);
 const saved=await f.store.get('account:'+f.id);assert.equal(saved.journey,undefined);assert.ok(!saved.ownedItems.includes('library-castle'));
 const home=(await f.call('expedition-home',{classId:f.course.id})).body;assert.equal(home.journey.stats.correct,500);assert.ok(!JSON.stringify(home.journey).includes('another-account'));
});

test('finished results unlock eight medium-term accessories once and preserve wallets, grades and study rewards',async()=>{
 const f=await fixture(),p=await passport(f,f.course.id,{correct:495,rounds:49,support:99,discoveries:99,rescues:49,accurateRounds:24,improvements:9,quests:24});p.best.word={score:1};await f.store.put(f.service.key(f.course.id,f.id),p);
 const assignment={answered:70,correct:65,activeMs:600000,submittedAt:12345},ledger={eligibleTyped:88};await f.store.put({[`practice:assignment:${f.id}`]:assignment,[`study-ledger:${f.course.id}:${f.id}`]:ledger});
 const o={version:1,classId:f.course.id,ownerId:f.owner,roundId:uid(),startedAt:Date.now()-1000,finishedAt:Date.now(),mode:'word',players:[{accountId:f.id,answered:5,correct:5,score:500,stats:{support:1,discoveries:1,quests:1},rescues:1}],gallery:[]},report={id:o.roundId,status:'finished',mode:'word'};
 await f.service.record(o,f.owner,report);const user=await f.store.get('account:'+f.id),stats=(await f.service.passport(f.course.id,f.id)).stats;
 const rewards=['origami-dragon','quest-snail','pixel-spectacles','kindness-lantern','courier-cape','bookshelf-wings','curious-fireflies','second-wind'];assert.ok(rewards.every(id=>user.ownedItems.includes(id)));assert.equal(user.ownedItems.length,9);assert.equal(user.points,333);assert.deepEqual(user.equipment,{hat:'paper-boat'});
 await f.service.record(o,f.owner,report);assert.deepEqual((await f.service.passport(f.course.id,f.id)).stats,stats);assert.deepEqual(await f.store.get('account:'+f.id),user);
 assert.deepEqual(await f.store.get(`practice:assignment:${f.id}`),assignment);assert.deepEqual(await f.store.get(`study-ledger:${f.course.id}:${f.id}`),ledger);
 assert.equal((await f.call('equip-item',{itemId:'origami-dragon'})).status,200);assert.equal((await f.call('home')).body.user.points,333);
});

test('quest rewards cannot be bought or equipped using forged progress, prices or action payloads',async()=>{
 const f=await fixture(1000000000000),before=await f.store.get('account:'+f.id);
 assert.equal((await f.call('buy-item',{itemId:'library-castle',price:0,stats:{correct:100000},journey:{stats:{correct:100000}}})).status,403);
 assert.equal((await f.call('equip-item',{itemId:'library-castle',ownedItems:['library-castle']})).status,403);
 assert.equal((await f.call('item-goal',{itemId:'library-castle'})).status,400);assert.equal((await f.call('item-goal',{itemId:'paper-boat'})).status,400);
 assert.deepEqual(await f.store.get('account:'+f.id),before);
 const unauth=await f.library.fetch(internal('academy:item-goal',{itemId:'million-stick'}));assert.equal(unauth.status,401);
});

test('savings targets persist and exact trillion-point purchases are charged once under concurrent requests',async()=>{
 const f=await fixture(1000000000055);assert.equal((await f.call('item-goal',{itemId:'trillion-point-tophat'})).status,200);assert.equal((await f.call('home')).body.user.wardrobeGoal,'trillion-point-tophat');
 const requests=await Promise.all([f.call('buy-item',{itemId:'trillion-point-tophat',price:1}),f.call('buy-item',{itemId:'trillion-point-tophat',price:-10})]);assert.ok(requests.every(r=>r.status===200));
 const user=(await f.call('home')).body.user;assert.equal(user.points,55);assert.equal(user.wardrobeGoal,undefined);assert.equal(user.ownedItems.filter(id=>id==='trillion-point-tophat').length,1);assert.equal(user.equipment.hat,'trillion-point-tophat');
 await f.call('item-goal',{itemId:'million-stick'});await f.call('item-goal',{itemId:''});assert.equal((await f.call('home')).body.user.wardrobeGoal,undefined);
});

test('shop filtering keeps quest locks, savings and large prices distinct while escaping search text',()=>{
 const user={skin:'mint',points:50,ownedItems:['paper-boat'],journey:{stats:{correct:499}}};
 const within=wardrobeItems(user,{slot:'all',availability:'affordable'});assert.ok(within.length>=5);assert.ok(within.every(i=>i.price<=50&&!i.quest&&i.id!=='paper-boat'));
 assert.deepEqual(wardrobeItems(user,{slot:'all',availability:'owned'}).map(i=>i.id),['paper-boat']);assert.equal(wardrobeItems(user,{slot:'all',availability:'quests'}).length,16);
 assert.equal(wardrobeItems(user,{slot:'all',sort:'expensive'})[0].id,'trillion-point-tophat');assert.ok(wardrobeItems(user,{slot:'all',search:'DUCK'}).every(i=>/duck/i.test(i.name+' '+i.description)));
 const markup=wardrobeResults(user,{slot:'all',search:'Dragon of 500'});assert.match(markup,/499 \/ 500 correct answers/);assert.match(markup,/data-act="item-quest"[^>]*disabled/);assert.ok(!markup.includes('data-act="item-buy"'));
 assert.ok(!wardrobeResults(user,{slot:'all',search:'<img src=x onerror=alert(1)>'}).includes('<img'));
});

test('erasure removes only the appropriate class progress and stale reports cannot rebuild long-term goals',async()=>{
 const f=await fixture(),otherClass=uid();await f.academy.enroll(otherClass,f.id,'journey@example.com','Journey Student');await passport(f,otherClass,{correct:20});await passport(f,f.course.id,{correct:499});
 const teacher=await f.academy.identity(f.teacherToken),tools=new DataTools(f.store,f.config,f.academy),startedAt=Date.now()-1000;
 const bundle=await tools.backup(teacher,{});await tools.eraseStudent(teacher,{classId:f.course.id,userId:f.id,confirm:'journey@example.com'},f.teacherToken);
 assert.equal((await f.journey.summary(f.id)).stats.correct,20);await f.academy.enroll(f.course.id,f.id,'journey@example.com','Journey Student');
 const o={version:1,classId:f.course.id,ownerId:f.owner,roundId:uid(),startedAt,finishedAt:Date.now(),mode:'word',players:[{accountId:f.id,answered:10000,correct:10000,score:1000000,stats:{quests:1000}}]};await f.service.record(o,f.owner,{id:o.roundId,status:'finished',mode:'word'});
 assert.equal((await f.journey.summary(f.id)).stats.correct,20);assert.ok(!(await f.call('home')).body.user.ownedItems.includes('origami-dragon'));assert.ok((await tools.planRestore(teacher,bundle)).counts.privacyBlocked>0);
 await f.call('item-goal',{itemId:'million-stick'});const exportResponse=await f.library.fetch(internal('data:personal-export',{},f.token)),records=(await exportResponse.json()).records;assert.equal(records.find(([k])=>k==='account:'+f.id)[1].wardrobeGoal,'million-stick');
});
