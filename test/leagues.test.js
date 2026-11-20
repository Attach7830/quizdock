import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherLibrary} from '../src/library-service.js';
import {AcademyService} from '../src/academy-domain.js';
import {LeagueService} from '../src/league-service.js';
import {leagueStandings} from '../src/league-model.js';
import {weekStart,dateTimeInZone} from '../src/academy-model.js';
import {hash,uid,ListRepository} from '../src/library-domain.js';
import {context,internal} from './memory-runtime.js';

const initial=Date.parse('2026-11-19T20:00:00Z');
async function clock(fn){const old=Date.now;let now=initial;Date.now=()=>now;try{await fn({advance:ms=>now+=ms,set:ms=>now=ms});}finally{Date.now=old;}}
async function fixture(count=6){
  const ctx=context(),env={TEACHER_EMAILS:'teacher@example.com,second@example.com'},library=new TeacherLibrary(ctx,env),owner=await hash('teacher@example.com'),second=await hash('second@example.com'),teacher=uid(),other=uid();
  await ctx.storage.put({['session:'+await hash(teacher)]:{owner,email:'teacher@example.com',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000},['session:'+await hash(other)]:{owner:second,email:'second@example.com',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000}});
  const call=async(action,p={},token=teacher)=>{const response=await library.fetch(internal('academy:'+action,p,token));return {status:response.status,body:await response.json()};};
  const course=(await call('create-class',{name:'Weekly crew',timezone:'America/Los_Angeles'})).body.class;
  const otherCourse=(await call('create-class',{name:'Other crew',timezone:'Pacific/Kiritimati'},other)).body.class;
  const students=[];
  for(let i=0;i<count;i++){
    const email=`student${i}@example.com`,userId=await hash(email),token=uid(),profile={id:userId,email,name:'Student '+i,points:190,owned:['mint','coral'],skin:'coral',createdAt:Date.now()-1000};
    await ctx.storage.put({['account:'+userId]:profile,['session:'+await hash(token)]:{owner:userId,email,kind:'student',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000}});
    await new AcademyService(ctx.storage,env).enroll(course.id,userId,email,profile.name);students.push({userId,token,email});
  }
  const listId=uid();await new ListRepository(ctx.storage,owner).save({id:listId,revision:0,mutationId:uid(),list:{title:'Words',cards:['casa','perro','verde','botas'].map((answer,i)=>({type:'pair',prompt:'Clue '+i,answer}))}});
  await call('share-list',{classId:course.id,listId});
  const a=(await call('create-assignment',{classId:course.id,listId,title:'Weekly practice',dueLocal:'2026-11-20T23:59',rules:{minMinutes:0,minCards:1,minAccuracy:100,crosswordWords:3}})).body.assignment;
  const leagues=new LeagueService(ctx.storage),view=async(student=students[0],extra={})=>(await call('league-home',{classId:course.id,...extra},student.token)).body;
  const key=u=>`league-player:${course.id}:${u||students[0].userId}`;
  return {ctx,env,library,owner,teacher,other,course,otherCourse,students,listId,a,call,leagues,view,key};
}
async function game(f,correct=3,extra={}){
  const at=Date.now(),roundId=uid(),outcome={id:roundId,classId:f.course.id,ownerId:f.owner,mode:'treasure',startedAt:at-500,finishedAt:at,players:[{accountId:f.students[0].userId,answered:5,correct,score:100000,stats:{}}],...extra};
  const record=()=>f.ctx.storage.transaction(tx=>new AcademyService(tx,f.env).recordOutcome(outcome,f.owner));
  return {outcome,record};
}

test('league ranks share ties, protect a tie across the demotion boundary, and use a small-group goal',()=>{
  const rows=leagueStandings([100,90,90,70,60,50,40,30,30,10].map((xp,i)=>({userId:String(i),xp,tier:1})));
  assert.deepEqual(rows.slice(0,3).map(p=>[p.rank,p.zone]),[[1,'promotion'],[2,'promotion'],[2,'promotion']]);
  assert.equal(rows[8].rank,8);assert.equal(rows[8].zone,'safe');assert.equal(rows[9].zone,'demotion');
  assert.deepEqual(leagueStandings([{userId:'a',xp:100,tier:0},{userId:'b',xp:90,tier:0}]).map(p=>p.zone),['promotion','safe']);
  assert.equal(leagueStandings([{userId:'a',xp:100,tier:7}])[0].zone,'summit');
});
test('only class members and their teacher can view leagues; public standings have no email addresses or account IDs',()=>clock(async()=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,2);
  assert.equal((await f.call('league-home',{classId:f.course.id},'')).status,401);
  assert.equal((await f.call('league-home',{classId:f.course.id},f.other)).status,403);
  assert.equal((await f.call('league-home',{classId:f.otherCourse.id},f.students[0].token)).status,403);
  assert.equal((await f.call('league-home',{classId:f.course.id,tier:8},f.students[0].token)).status,400);
  const v=await f.view();assert.equal(v.me.xp,20);assert.equal(v.leaderboard[0].name,'Student 0');assert.equal(v.leaderboard[0].self,true);
  assert.equal(v.leaderboard[0].appearance.skin,'coral');assert.ok(!JSON.stringify(v).includes('@'));assert.ok(!JSON.stringify(v).includes(f.students[0].userId));
  assert.equal((await f.call('league-home',{classId:f.course.id})).body.me,null);
}));
test('typed assignments award XP once for a correct answer, with grading, currency and candy unchanged',()=>clock(async({advance})=>{
  const f=await fixture(),student=f.students[0];let v=(await f.call('practice-open',{assignmentId:f.a.id},student.token)).body;
  const a=await f.ctx.storage.get('assignment:'+f.a.id),card=a.cards.find(c=>c.id===v.question.cardId),payload={assignmentId:a.id,lease:v.lease,assignmentRevision:1,questionKey:v.question.key,answer:card.answer,mutationId:uid()};advance(600);
  for(let i=0;i<2;i++)assert.equal((await f.call('practice-answer',payload,student.token)).status,200);
  assert.equal((await f.view()).me.xp,10);assert.equal((await f.ctx.storage.get('account:'+student.userId)).points,190);
  const ledger=(await f.call('home',{},student.token)).body.studyRewards[0];assert.equal(ledger.completed,0);
  const submitted=(await f.call('practice-submit',{assignmentId:a.id,lease:v.lease,assignmentRevision:1},student.token)).body;assert.equal(submitted.progress.creditPercent,100);assert.equal(submitted.progress.correct,1);
}));
test('crossword solves and wrong attempts award their respective XP once',()=>clock(async({advance})=>{
  const f=await fixture(),s=f.students[0];let v=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease},s.token)).body;
  const entry=v.crossword.entries[0],a=await f.ctx.storage.get('assignment:'+f.a.id),card=a.cards.find(c=>c.prompt===entry.clue),base={assignmentId:a.id,lease:v.lease,assignmentRevision:1,puzzleId:v.crossword.id,entry:entry.number};advance(600);
  assert.equal((await f.call('practice-crossword-answer',{...base,answer:'incorrect',mutationId:uid()},s.token)).status,200);assert.equal((await f.view()).me.xp,2);advance(600);
  const correct={...base,answer:card.answer,mutationId:uid()};await f.call('practice-crossword-answer',correct,s.token);await f.call('practice-crossword-answer',correct,s.token);assert.equal((await f.view()).me.xp,12);
}));
test('independent typed practice credits correct answers once; flashcard self-report totals cannot create XP',()=>clock(async({advance})=>{
  const f=await fixture(),s=f.students[0],deck=(await f.call('solo-open',{classId:f.course.id,listId:f.listId},s.token)).body.deck;
  const p={classId:f.course.id,listId:f.listId,cardId:deck.cards[0].id,answer:deck.cards[0].answer,mutationId:uid()};
  await f.call('solo-answer',p,s.token);await f.call('solo-answer',p,s.token);assert.equal((await f.view()).me.xp,10);advance(600);
  await f.call('solo-answer',{...p,answer:'wrong',mutationId:uid()},s.token);assert.equal((await f.view()).me.xp,12);
  await f.call('solo-save',{classId:f.course.id,listId:f.listId,index:2,known:deck.cards.map(c=>c.id),xp:1000000},s.token);assert.equal((await f.view()).me.xp,12);
  assert.equal((await f.call('home',{},s.token)).body.studyRewards[0].completed,2);
}));
test('completed game XP follows correct answers, settles once across retries, and ignores game score',()=>clock(async()=>{
  const f=await fixture(),g=await game(f,3);await g.record();await g.record();assert.equal((await f.view()).me.xp,30);
  const wrong=await game(f,0);await wrong.record();assert.equal((await f.view()).me.xp,30);
  assert.equal((await f.ctx.storage.get('account:'+f.students[0].userId)).points,211);
}));
test('Monday resets XP exactly once, advances a qualifying small group, and preserves submitted grades and points',()=>clock(async({advance,set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);
  const account=await f.ctx.storage.get('account:'+f.students[0].userId),oldWeek=(await f.view()).week;
  const key=`practice:${f.a.id}:${f.students[0].userId}`,grade={assignmentId:f.a.id,userId:f.students[0].userId,submittedAt:Date.now(),creditPercent:50,late:true,answered:1,correct:1,activeMs:60000,cardStats:{}};await f.ctx.storage.put(key,grade);
  set(dateTimeInZone('2026-11-23T00:00',f.course.timezone)-1);assert.equal((await f.view()).me.xp,100);advance(1);
  const responses=await Promise.all([f.view(),f.view()]);for(const v of responses){assert.equal(v.me.tier,1);assert.equal(v.me.xp,0);assert.equal(v.me.history.length,1);assert.equal(v.me.history[0].week,oldWeek);assert.equal(v.me.history[0].result,'promoted');assert.equal(v.me.weeks,1);}
  assert.deepEqual(await f.ctx.storage.get(key),grade);assert.deepEqual(await f.ctx.storage.get('account:'+f.students[0].userId),account);
}));
test('competitive leagues promote the top fifth and demote the bottom fifth; inactive students retain their tier',()=>clock(async({set})=>{
  const f=await fixture();for(let i=0;i<5;i++){await f.leagues.credit(f.course,f.students[i].userId,20-i*3);const p=await f.ctx.storage.get(f.key(f.students[i].userId));p.tier=1;await f.ctx.storage.put(f.key(p.userId),p);}
  const inactive={classId:f.course.id,userId:f.students[5].userId,week:weekStart(Date.now(),f.course.timezone),tier:3,xp:0,correct:0,history:[],lastActivityAt:Date.now()};await f.ctx.storage.put(f.key(inactive.userId),inactive);
  set(dateTimeInZone('2026-11-23T00:00',f.course.timezone));await f.view();
  assert.equal((await f.ctx.storage.get(f.key(f.students[0].userId))).tier,2);assert.equal((await f.ctx.storage.get(f.key(f.students[2].userId))).tier,1);assert.equal((await f.ctx.storage.get(f.key(f.students[4].userId))).tier,0);
  assert.equal((await f.ctx.storage.get(f.key(inactive.userId))).tier,3);assert.equal((await f.ctx.storage.get(f.key(inactive.userId))).history.length,0);
}));
test('long absences settle one played week and cannot skip through tiers or create phantom weeks',()=>clock(async({set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,1000);set(Date.parse('2027-02-01T20:00:00Z'));const v=await f.view();assert.equal(v.me.tier,1);assert.equal(v.me.weeks,1);assert.equal(v.me.history.length,1);assert.equal(v.me.xp,0);assert.equal((await f.view()).me.tier,1);
}));
test('class-local resets account for DST and do not share a global UTC boundary',()=>clock(async({set})=>{
  const f=await fixture();set(Date.parse('2026-03-04T12:00:00Z'));const spring=await f.view();assert.equal(spring.resetAt,dateTimeInZone('2026-03-09T00:00',f.course.timezone));assert.equal(spring.resetAt-dateTimeInZone('2026-03-02T00:00',f.course.timezone),167*3600000);
  set(Date.parse('2026-10-29T12:00:00Z'));const fall=await f.view();assert.equal(fall.resetAt-dateTimeInZone('2026-10-26T00:00',f.course.timezone),169*3600000);
  const teacher=(await f.call('league-home',{classId:f.otherCourse.id},f.other)).body;assert.notEqual(teacher.resetAt,fall.resetAt);
}));
test('late game delivery cannot change a closed result or add old XP to the current week',()=>clock(async({set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);const delayed=await game(f,5);set(dateTimeInZone('2026-11-23T00:00',f.course.timezone));const before=await f.view();await delayed.record();const after=await f.view();assert.equal(after.me.xp,0);assert.deepEqual(after.me.history,before.me.history);
}));
test('league settings are owner-only, pause XP and movement, and preserve the saved week',()=>clock(async({set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);
  for(const token of [f.other,f.students[0].token])assert.equal((await f.call('league-settings',{classId:f.course.id,enabled:false},token)).status,403);
  assert.equal((await f.call('league-settings',{classId:f.course.id,enabled:'false'})).status,400);
  const off=(await f.call('league-settings',{classId:f.course.id,enabled:false})).body;assert.equal(off.enabled,false);assert.equal((await f.view()).me.xp,100);
  const course=await f.ctx.storage.get('class:'+f.course.id);assert.equal(await f.leagues.credit(course,f.students[0].userId,10),0);
  set(dateTimeInZone('2026-11-23T00:00',f.course.timezone));const next=await f.view();assert.equal(next.me.xp,0);assert.equal(next.me.tier,0);assert.equal(next.me.history[0].xp,100);
  await f.call('league-settings',{classId:f.course.id,enabled:true});await f.leagues.credit(await f.ctx.storage.get('class:'+f.course.id),f.students[0].userId,1);assert.equal((await f.view()).me.xp,10);
}));
test('removed, disabled and erased accounts cannot earn XP or appear in standings',()=>clock(async()=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,1);const p=await f.ctx.storage.get('account:'+f.students[0].userId);p.disabled=true;await f.ctx.storage.put('account:'+p.id,p);assert.equal(await f.leagues.credit(f.course,p.id,2),0);assert.equal((await f.call('league-home',{classId:f.course.id})).body.leaderboard.length,0);
  const member=await f.ctx.storage.get(`member:${f.course.id}:${f.students[1].userId}`);member.active=false;await f.ctx.storage.put(`member:${f.course.id}:${member.userId}`,member);assert.equal(await f.leagues.credit(f.course,member.userId,3),0);assert.equal(await f.leagues.credit(f.course,f.owner,3),0);
}));
test('signed class backups include league state, personal exports include only the owner, and erasure blocks old restores',()=>clock(async()=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);await f.leagues.credit(f.course,f.students[1].userId,2);
  const call=async(action,p={},token=f.teacher)=>{const r=await f.library.fetch(internal('data:'+action,p,token));return {status:r.status,body:await r.json()};};
  const bundle=(await call('backup',{classId:f.course.id})).body;assert.ok(bundle.payload.records.some(([k])=>k==='league-state:'+f.course.id+':current'));assert.ok(bundle.payload.records.some(([k])=>k===f.key()));
  const personal=(await call('personal-export',{},f.students[0].token)).body;assert.ok(personal.records.some(([k])=>k===f.key()));assert.ok(!personal.records.some(([k])=>k===f.key(f.students[1].userId)));
  const erase=await call('delete-student',{classId:f.course.id,userId:f.students[0].userId,confirm:f.students[0].email});assert.equal(erase.status,200);assert.equal(await f.ctx.storage.get(f.key()),undefined);assert.ok(await f.ctx.storage.get(f.key(f.students[1].userId)));
  const preview=await call('restore-preview',{bundle});assert.equal(preview.status,200);assert.ok(preview.body.preview.privacyBlocked>0);assert.equal(await f.ctx.storage.get(f.key()),undefined);
}));
test('retention uses last learning activity and trims expired league results without resetting active tiers',()=>clock(async({set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);set(Date.parse('2027-02-01T20:00:00Z'));await f.view();const before=await f.ctx.storage.get(f.key());assert.ok(before.updatedAt>before.lastActivityAt);
  const r=await f.library.fetch(internal('data:retention-run',{days:30,confirm:'DELETE EXPIRED RECORDS'},f.teacher));assert.equal(r.status,200);assert.equal(await f.ctx.storage.get(f.key()),undefined);assert.ok(await f.ctx.storage.get('league-state:'+f.course.id+':current'));
}));
test('concurrent first answers after rollover keep all XP and settle the previous week only once',()=>clock(async({set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);set(dateTimeInZone('2026-11-23T00:00',f.course.timezone));
  await Promise.all(f.students.slice(0,3).map(s=>f.ctx.storage.transaction(tx=>new LeagueService(tx).credit(f.course,s.userId,1))));
  const v=await f.view();assert.equal(v.me.xp,10);assert.equal(v.me.history.length,1);assert.equal(v.me.tier,1);assert.equal(v.totalParticipants,3);
}));
test('solo rounds bank XP on completion once, including games without adventure settings',()=>clock(async()=>{
  const f=await fixture(),student=f.students[0],solo={classId:f.course.id,accountId:student.userId,ownerId:f.owner},report={id:uid(),mode:'treasure',startedAt:Date.now()-500,status:'playing',cards:[{typedAttempts:0,correct:3,attempts:5}]};
  const send=async r=>{const response=await f.library.fetch(internal('record-solo-round',{solo,report:r}));assert.equal(response.status,200);};
  await send(report);assert.equal((await f.view()).me.xp,0);
  const complete={...report,status:'finished',finishedAt:Date.now()};await send(complete);await send(complete);assert.equal((await f.view()).me.xp,30);
  const saved=await f.ctx.storage.get(`study-game:${f.course.id}:${student.userId}:${report.id}`);assert.equal(saved.leagueSettled,true);
  assert.equal((await f.call('home',{},student.token)).body.studyRewards[0].completed,0);
}));
test('every hosted game mode banks correct-answer XP with the existing once-only outcome settlement',()=>clock(async()=>{
  const f=await fixture();for(const mode of ['treasure','fishing','battle','factory','rally','keep','word','sketch']){const g=await game(f,1,{mode});await g.record();await g.record();}
  assert.equal((await f.view()).me.xp,80);
}));
test('turning leagues back on after a paused deadline settles the paused week before enabling new XP',()=>clock(async({set})=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,10);await f.call('league-settings',{classId:f.course.id,enabled:false});
  set(dateTimeInZone('2026-11-23T00:00',f.course.timezone));const response=await f.call('league-settings',{classId:f.course.id,enabled:true});assert.equal(response.status,200);const v=await f.view();assert.equal(v.me.tier,0);assert.equal(v.me.xp,0);assert.equal(v.me.history[0].result,'held');
}));
test('an old signed league backup cannot restore missing old XP alongside newer live standings',()=>clock(async()=>{
  const f=await fixture();await f.leagues.credit(f.course,f.students[0].userId,1);await f.leagues.credit(f.course,f.students[1].userId,2);
  const backup=await f.library.fetch(internal('data:backup',{classId:f.course.id},f.teacher)),bundle=await backup.json();
  await f.leagues.credit(f.course,f.students[0].userId,1);await f.ctx.storage.delete(f.key(f.students[1].userId));
  const r=await f.library.fetch(internal('data:restore',{bundle,confirm:'RESTORE MISSING RECORDS'},f.teacher));assert.equal(r.status,200);assert.ok((await r.json()).restored.conflicts>0);assert.equal(await f.ctx.storage.get(f.key(f.students[1].userId)),undefined);assert.equal((await f.view()).me.xp,20);
}));
test('scoped erasure removes only the selected class league and old room reports cannot recreate it',()=>clock(async({advance})=>{
  const f=await fixture(),s=f.students[0];await f.leagues.credit(f.course,s.userId,10);
  await new AcademyService(f.ctx.storage,f.env).enroll(f.otherCourse.id,s.userId,s.email,'Student');await f.leagues.credit(f.otherCourse,s.userId,2);
  const report={id:uid(),mode:'treasure',startedAt:Date.now()-500,status:'finished',finishedAt:Date.now(),cards:[{typedAttempts:0,correct:3,attempts:5}]};advance(1000);
  const response=await f.library.fetch(internal('data:delete-student',{classId:f.course.id,userId:s.userId,confirm:s.email},f.teacher));assert.equal(response.status,200);
  await new AcademyService(f.ctx.storage,f.env).enroll(f.course.id,s.userId,s.email,'Student');
  const retry=await f.library.fetch(internal('record-solo-round',{solo:{classId:f.course.id,accountId:s.userId,ownerId:f.owner},report}));assert.equal((await retry.json()).skipped,true);assert.equal(await f.ctx.storage.get(f.key()),undefined);assert.equal((await f.ctx.storage.get(`league-player:${f.otherCourse.id}:${s.userId}`)).xp,20);
}));
test('league tiers stop at Diamond and twelve recent results remain alongside lifetime achievements',()=>clock(async({set})=>{
  const f=await fixture();for(let i=0;i<15;i++){set(initial+i*7*86400000);await f.leagues.credit(f.course,f.students[0].userId,10);set(initial+(i+1)*7*86400000);await f.view();}
  const v=await f.view();assert.equal(v.me.tier,7);assert.equal(v.me.promotions,7);assert.equal(v.me.weeks,15);assert.equal(v.me.wins,15);assert.equal(v.me.history.length,12);assert.equal(v.me.xp,0);assert.equal(v.me.gap,0);
}));
