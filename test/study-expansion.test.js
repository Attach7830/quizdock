import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherLibrary} from '../src/library-service.js';
import {AcademyService} from '../src/academy-domain.js';
import {StudyRewards} from '../src/study-rewards.js';
import {hash,uid} from '../src/library-domain.js';
import {context,internal,Socket,namespace} from './memory-runtime.js';
import gateway from '../src/library-worker.js';
import {QuizRoom} from '../src/worker.js';
import {validateCard,parseImport,exportList,compileQuestions} from '../public/js/list-model.js';
import {createPracticeClock} from '../public/js/practice-clock.js';
import {SHORTCUT_DEFAULTS,validateShortcutSettings,loadShortcutSettings,eventShortcut} from '../public/js/shortcut-settings.js';
const env={TEACHER_EMAILS:'teacher@example.com,other@example.com',EMAIL_FROM:'login@example.com',RESEND_API_KEY:'private-test-key'};
async function setup(){
 const ctx=context(),service=new TeacherLibrary(ctx,env),owner=await hash('teacher@example.com'),token=uid(),userId=await hash('student@example.com'),studentToken=uid();
 await ctx.storage.put('session:'+await hash(token),{email:'teacher@example.com',owner,expiresAt:Date.now()+3600000});
 const call=async(action,p={},t=token)=>{const r=await service.fetch(internal('academy:'+action,p,t));return {status:r.status,body:await r.json()};};
 const course=(await call('create-class',{name:'Spanish',timezone:'America/Los_Angeles'})).body.class;
 await new AcademyService(ctx.storage,env).enroll(course.id,userId,'student@example.com','Test Student');
 await ctx.storage.put('account:'+userId,{id:userId,email:'student@example.com',name:'Test Student',points:35,owned:['mint'],skin:'mint',createdAt:Date.now()-10000});
 await ctx.storage.put('session:'+await hash(studentToken),{owner:userId,email:'student@example.com',kind:'student',expiresAt:Date.now()+3600000});
 const listId=uid(),cards=[validateCard({prompt:'learn',answer:'aprender',category:'vocabulary'}),validateCard({prompt:'narrow',answer:'tight; narrow',category:'grammar'}),validateCard({prompt:'country',answer:'España',category:'culture'}),validateCard({prompt:'legacy',answer:'old'})];
 await service.fetch(internal('save',{id:listId,revision:0,mutationId:uid(),list:{title:'Categories',cards}},token));await call('share-list',{classId:course.id,listId});
 return {ctx,service,owner,token,userId,studentToken,course,listId,cards,call};
}
test('categories round-trip through CSV and JSON, retain old uncategorized cards and reject typos',()=>{
 const cards=['grammar','vocabulary','culture',undefined].map(category=>validateCard({prompt:'term '+category,answer:'answer '+category,category}));
 for(const format of ['csv','json']){const result=parseImport(exportList({title:'Set',cards},format),format);assert.equal(result.errors.length,0);assert.deepEqual(result.cards.map(c=>c.category),cards.map(c=>c.category));}
 assert.equal(validateCard({prompt:'old',answer:'legacy'}).category,undefined);assert.throws(()=>validateCard({prompt:'x',answer:'y',category:'grammer'}),/Category/);
 assert.equal(parseImport('Prompt,Answer,Category\nhello,hola,Vocabulary\ncountry,España,Culture','csv').cards[0].category,'vocabulary');
 assert.equal(compileQuestions({title:'one',cards:[cards[0]]},{typedOnly:true})[0].answers.length,1);
});
test('solo filters use categories; assignment snapshots always retain the full set',async()=>{
 const f=await setup();for(const category of ['grammar','vocabulary','culture']){const r=await f.call('solo-open',{classId:f.course.id,listId:f.listId,category},f.studentToken);assert.equal(r.status,200);assert.equal(r.body.deck.cards.length,1);assert.equal(r.body.deck.cards[0].category,category);assert.equal(r.body.categories.all,4);}
 assert.equal((await f.call('solo-open',{classId:f.course.id,listId:f.listId,category:'invented'},f.studentToken)).status,400);
 const a=(await f.call('create-assignment',{classId:f.course.id,listId:f.listId,dueLocal:'2026-12-18T23:59',rules:{minMinutes:0,minCards:1,minAccuracy:0}})).body.assignment;
 assert.equal(a.cardCount,4);assert.equal((await f.call('practice-open',{assignmentId:a.id,category:'culture'},f.studentToken)).body.assignment.cardCount,4);
});
test('only independent typed checks earn candy; retries, flashcard marks, homework and game currency stay separate',async()=>{
 const f=await setup();await f.call('study-rewards-settings',{classId:f.course.id,cardsPerReward:2,semesterEnd:'2026-12-18'});
 await f.call('solo-save',{classId:f.course.id,listId:f.listId,index:0,known:f.cards.map(c=>c.id),again:[]},f.studentToken);
 assert.equal((await f.call('home',{},f.studentToken)).body.studyRewards[0].completed,0);
 const payload={classId:f.course.id,listId:f.listId,cardId:f.cards[1].id,answer:'narrow',mutationId:uid()};
 const first=await f.call('solo-answer',payload,f.studentToken);assert.equal(first.body.feedback.correct,true);assert.equal(first.body.studyRewards.points,1);
 const old=Date.now;let now=old()+1000;Date.now=()=>now;
 try{await f.call('solo-answer',{...payload,mutationId:uid(),answer:'tight'},f.studentToken);const retry=await f.call('solo-answer',payload,f.studentToken);assert.equal(retry.body.studyRewards.available,1);assert.equal(retry.body.studyRewards.completed,2);assert.equal((await f.call('solo-answer',{...payload,answer:'different'},f.studentToken)).status,409);}finally{Date.now=old;}
 const a=(await f.call('create-assignment',{classId:f.course.id,listId:f.listId,dueLocal:'2026-12-18T23:59',rules:{minMinutes:0,minCards:1,minAccuracy:0}})).body.assignment;
 const p=(await f.call('practice-open',{assignmentId:a.id},f.studentToken)).body;
 await f.call('practice-answer',{assignmentId:a.id,lease:p.lease,questionKey:p.question.key,answer:'wrong',mutationId:uid()},f.studentToken);
 const h=(await f.call('home',{},f.studentToken)).body;assert.equal(h.studyRewards[0].completed,2);assert.equal(h.user.points,35);assert.equal(h.assignments[0].progress.answered,1);
});
test('teachers can claim a reward once, students and other teachers cannot claim or change its policy',async()=>{
 const f=await setup();const r=new StudyRewards(f.ctx.storage);await r.credit(f.course,f.userId,100);const award=(await r.summary(f.course,f.userId)).awards[0];
 const p={classId:f.course.id,userId:f.userId,awardId:award.id,requestId:uid()};assert.equal((await f.call('study-rewards-claim',p,f.studentToken)).status,403);assert.equal((await f.call('study-rewards-settings',{...p,cardsPerReward:1},f.studentToken)).status,403);
 const first=await f.call('study-rewards-claim',p);assert.equal(first.status,200);assert.deepEqual((await f.call('study-rewards-claim',p)).body,first.body);assert.equal((await f.call('study-rewards-claim',{...p,requestId:uid()})).status,409);
 const status=await r.summary(f.course,f.userId);assert.equal(status.available,0);assert.equal(status.claimed,1);
 const other=uid();await f.ctx.storage.put('session:'+await hash(other),{owner:await hash('other@example.com'),email:'other@example.com',expiresAt:Date.now()+10000});assert.equal((await f.call('study-rewards',p,other)).status,403);
});
test('rewards expire after exactly 30 days, points survive reloads and reset after December 18 in the class timezone',async()=>{
 const f=await setup(),r=new StudyRewards(f.ctx.storage),at=Date.parse('2026-11-17T20:00:00Z');await r.credit(f.course,f.userId,135,at);let s=await r.summary(f.course,f.userId,at);assert.equal(s.points,35);assert.equal(s.available,1);assert.equal(s.awards[0].expiresAt,at+30*86400000);
 assert.equal((await new StudyRewards(f.ctx.storage).summary(f.course,f.userId,at+1)).points,35);assert.equal((await r.summary(f.course,f.userId,at+30*86400000)).available,0);
 assert.equal((await r.summary(f.course,f.userId,Date.parse('2026-12-19T07:59:59Z'))).points,35);assert.equal((await r.summary(f.course,f.userId,Date.parse('2026-12-19T08:00:00Z'))).points,0);
 await r.credit(f.course,f.userId,100,Date.parse('2026-12-19T08:00:00Z'));assert.equal((await r.summary(f.course,f.userId,at)).completed,135);
});
test('focus epochs discard background intervals and stale heartbeat replies without accepting client time',async()=>{
 const f=await setup(),a=(await f.call('create-assignment',{classId:f.course.id,listId:f.listId,dueLocal:'2026-12-18T23:59',rules:{minMinutes:1,minCards:1,minAccuracy:0}})).body.assignment;
 const old=Date.now;let now=old();Date.now=()=>now;
 try{const p=(await f.call('practice-open',{assignmentId:a.id},f.studentToken)).body;const beat=async(active,focused,focusVersion)=>f.call('practice-tick',{assignmentId:a.id,lease:p.lease,active,focused,focusVersion,seconds:999999},f.studentToken);
 await beat(true,true,0);now+=10000;assert.equal((await beat(true,true,0)).body.progress.seconds,10);now+=6000;await beat(false,false,1);now+=10000;await beat(false,true,2);await beat(true,true,2);now+=10000;assert.equal((await beat(true,true,2)).body.progress.seconds,20);now+=10000;assert.equal((await beat(true,true,0)).body.progress.seconds,20);now+=30000;assert.equal((await beat(true,true,2)).body.progress.seconds,20);
 }finally{Date.now=old;}
});
test('Word Forge assignment clues do not count as answers or narrow the assignment; final typed input uses normal grading',async()=>{
 const f=await setup(),a=(await f.call('create-assignment',{classId:f.course.id,listId:f.listId,dueLocal:'2026-12-18T23:59',rules:{minMinutes:0,minCards:1,minAccuracy:0}})).body.assignment,p=(await f.call('practice-open',{assignmentId:a.id},f.studentToken)).body;
 const clue=await f.call('practice-letter',{assignmentId:a.id,lease:p.lease,questionKey:p.question.key,letter:'a'},f.studentToken);assert.equal(clue.body.progress.answered,0);assert.equal(clue.body.assignment.cardCount,4);assert.deepEqual(clue.body.word.guesses,['a']);assert.equal(clue.body.question.key,p.question.key);
 const card=f.cards.find(c=>c.id===p.question.cardId),answer=card.answer==='tight; narrow'?'tight':card.answer;
 const graded=await f.call('practice-answer',{assignmentId:a.id,lease:p.lease,questionKey:p.question.key,answer,mutationId:uid()},f.studentToken);assert.equal(graded.body.progress.correct,1);assert.equal((await f.call('home',{},f.studentToken)).body.studyRewards[0].completed,0);
});
test('hotkeys validate custom sequences, reject collisions and browser-reserved keys, and recover saved defaults',()=>{
 const custom=validateShortcutSettings({...SHORTCUT_DEFAULTS,next:'n',known:'k'});assert.equal(custom.next,'n');assert.equal(custom.known,'k');assert.equal(validateShortcutSettings({...SHORTCUT_DEFAULTS,guide:''}).guide,'');
 assert.throws(()=>validateShortcutSettings({...SHORTCUT_DEFAULTS,next:'Space'}),/Two actions/);assert.throws(()=>validateShortcutSettings({...SHORTCUT_DEFAULTS,next:'Ctrl+w'}),/reserved/);assert.throws(()=>validateShortcutSettings({...SHORTCUT_DEFAULTS,next:'g'}),/sequence/);
 assert.deepEqual(loadShortcutSettings({getItem:()=>'{broken'}),SHORTCUT_DEFAULTS);assert.equal(eventShortcut({key:'Enter',ctrlKey:true}),'Ctrl+Enter');assert.equal(eventShortcut({key:' ',shiftKey:false}),'Space');
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Browser storage blocked');}});assert.deepEqual(loadShortcutSettings(),SHORTCUT_DEFAULTS);}finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
test('solo game creation is private, excludes Sketch Relay, and never exposes a host token',async()=>{
 const f=await setup();const rooms=new Map();const e={...env,TEACHER_LIBRARY:namespace(f.service),ROOMS:{idFromName:n=>n,get(n){if(!rooms.has(n)){const c=context(),r=new QuizRoom(c,e);rooms.set(n,{fetch:async(...args)=>{await c.boot;return r.fetch(typeof args[0]==='string'?new Request(args[0],args[1]):args[0]);},r,c});}return rooms.get(n);}}};
 const req=mode=>new Request('https://q.test/api/solo',{method:'POST',headers:{origin:'https://q.test','content-type':'application/json',cookie:'__Host-quizdock-library='+f.studentToken},body:JSON.stringify({classId:f.course.id,listId:f.listId,mode,category:'vocabulary'})});
 assert.equal((await gateway.fetch(req('sketch'),e)).status,400);
 const response=await gateway.fetch(req('word'),e);const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.ok(data.playerToken);assert.equal(data.hostToken,undefined);const g=rooms.get(data.pin),socket=new Socket();g.c.sockets.push(socket);await g.r.webSocketMessage(socket,JSON.stringify({type:'auth',role:'student',protocol:2,playerId:data.playerId,token:data.playerToken}));await g.r.webSocketMessage(socket,JSON.stringify({type:'start'}));assert.equal(socket.last().status,'playing');assert.equal(socket.last().solo,true);
 assert.equal((await g.r.fetch(new Request('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity:{accountId:'someone-else',name:'Other'}})}))).status,403);
 await g.r.webSocketMessage(socket,JSON.stringify({type:'pause'}));assert.equal(socket.last().status,'paused');await g.r.webSocketMessage(socket,JSON.stringify({type:'resume'}));assert.equal(socket.last().status,'playing');
 const p=g.r.room.players[data.playerId];await g.r.webSocketMessage(socket,JSON.stringify({type:'answer',key:p.current.key,answer:'aprender'}));await g.r.publishReport(true);assert.equal((await f.call('home',{},f.studentToken)).body.studyRewards[0].completed,1);await g.r.publishReport(true);assert.equal((await f.call('home',{},f.studentToken)).body.studyRewards[0].completed,1);
 assert.equal((await f.call('home',{},f.studentToken)).body.liveGames.length,0);assert.equal((await f.call('raffle-preview')).body.totalTickets,0);assert.equal((await f.call('home',{},f.studentToken)).body.user.points,35);
 await g.r.fetch(new Request('https://room.internal/privacy-purge',{method:'POST',body:JSON.stringify({createdAt:g.r.room.createdAt,accountId:f.userId,erasedAt:Date.now()})}));assert.equal(g.r.room.solo.accountId,null);assert.throws(()=>g.r.requireHost({role:'student',playerId:data.playerId}),/Teacher/);
});
test('reward balances and claims are included in private backups, preserved during restore, and removed by student erasure',async()=>{
 const f=await setup(),rewards=new StudyRewards(f.ctx.storage);await rewards.credit(f.course,f.userId,100);const award=(await rewards.summary(f.course,f.userId)).awards[0];
 const data=async(action,p={},token=f.token)=>{const r=await f.service.fetch(internal('data:'+action,p,token));return {status:r.status,body:await r.json()};};
 const backup=(await data('backup')).body;assert.ok(backup.payload.records.some(([key])=>key.startsWith('study-award:')));
 assert.ok((await data('personal-export',{},f.studentToken)).body.records.some(([key])=>key.startsWith('study-ledger:')));
 await f.call('study-rewards-claim',{classId:f.course.id,userId:f.userId,awardId:award.id,requestId:uid()});
 const restored=await data('restore',{bundle:backup,confirm:'RESTORE MISSING RECORDS'});assert.equal(restored.status,200);assert.equal((await rewards.summary(f.course,f.userId)).claimed,1);
 const sessionKey='session:'+await hash(f.token),session=await f.ctx.storage.get(sessionKey);session.issuedAt=Date.now();await f.ctx.storage.put(sessionKey,session);
 const erased=await data('delete-student',{classId:f.course.id,userId:f.userId,confirm:'student@example.com'});assert.equal(erased.status,200,JSON.stringify(erased.body));assert.equal((await rewards.summary(f.course,f.userId)).available,0);assert.equal((await rewards.summary(f.course,f.userId)).completed,0);
 const prior=Date.now()-1000;await new AcademyService(f.ctx.storage,env).enroll(f.course.id,f.userId,'student@example.com','Test Student');
 const report=await f.service.fetch(internal('record-solo-round',{solo:{classId:f.course.id,accountId:f.userId,ownerId:f.owner},report:{id:uid(),mode:'word',startedAt:prior,cards:[{typedAttempts:100}]}}));assert.equal((await report.json()).skipped,true);assert.equal((await rewards.summary(f.course,f.userId)).completed,0);
});

test('the assignment display clock advances every second, preserves renders, pauses immediately and ignores old confirmations',()=>{
 let now=0;const clock=createPracticeClock(()=>now);clock.reset(1200,true);now=1000;assert.equal(clock.seconds(),2);clock.confirm(1200,true);now=2000;assert.equal(clock.seconds(),3);clock.pause();now=100000;assert.equal(clock.seconds(),3);clock.confirm(3200,false);clock.confirm(1200,true);assert.equal(clock.seconds(),3);clock.confirm(3200,true);now+=1000;assert.equal(clock.seconds(),4);
});
test('closing a focused interval credits only bounded elapsed time once, without counting later background time',async()=>{
 const f=await setup(),a=(await f.call('create-assignment',{classId:f.course.id,listId:f.listId,dueLocal:'2026-12-18T23:59',rules:{minMinutes:1,minCards:1,minAccuracy:0}})).body.assignment;const old=Date.now;let now=old();Date.now=()=>now;
 try{const p=(await f.call('practice-open',{assignmentId:a.id},f.studentToken)).body;const beat=extra=>f.call('practice-tick',{assignmentId:a.id,lease:p.lease,...extra},f.studentToken);await beat({active:true,focused:true,focusVersion:0});now+=5000;let r=await beat({active:false,focused:false,focusVersion:1,closing:true,elapsedMs:3000});assert.equal(r.body.progress.seconds,3);now+=10000;r=await beat({active:false,focused:false,focusVersion:1,closing:true,elapsedMs:999999});assert.equal(r.body.progress.seconds,3);now+=10000;r=await beat({active:false,focused:true,focusVersion:2});assert.equal(r.body.progress.seconds,3);assert.equal(r.body.clock.eligible,false);
 }finally{Date.now=old;}
});

test('semester changes keep separate historical balances and never consume existing earned awards',async()=>{
 const f=await setup(),r=new StudyRewards(f.ctx.storage),now=Date.parse('2026-11-17T20:00:00Z');await r.credit(f.course,f.userId,135,now);const next={...f.course,studyRewards:{cardsPerReward:100,semesterEnd:'2027-05-28'}};assert.equal((await r.summary(next,f.userId,now)).points,0);await r.credit(next,f.userId,12,now);assert.equal((await r.summary(next,f.userId,now)).points,12);assert.equal((await r.summary(f.course,f.userId,now)).points,35);assert.equal((await r.summary(next,f.userId,now)).available,1);
});
