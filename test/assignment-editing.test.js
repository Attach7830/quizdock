import test from 'node:test';import assert from 'node:assert/strict';
import {TeacherLibrary} from '../src/library-service.js';import {AcademyService} from '../src/academy-domain.js';
import {hash,uid,ListRepository} from '../src/library-domain.js';import {context,internal} from './memory-runtime.js';
import {assignmentEdits} from '../src/assignment-editing.js';import {localDateTimeInput} from '../public/js/assignment-dates.js';
import {assignmentGradeRows} from '../public/js/assignment-ui.js';
const baseline=Date.parse('2026-11-19T20:00:00Z'),env={TEACHER_EMAILS:'teacher@example.com,otherteacher@example.com'};
async function fixture(rules={minMinutes:0,minCards:1,minAccuracy:100},dueLocal='2026-11-20T23:59'){
 const ctx=context(),library=new TeacherLibrary(ctx,env),owner=await hash('teacher@example.com'),student=await hash('student@example.com'),teacherToken=uid(),studentToken=uid(),otherToken=uid();
 await ctx.storage.put({['session:'+await hash(teacherToken)]:{owner,email:'teacher@example.com',expiresAt:Date.now()+365*86400000},['session:'+await hash(studentToken)]:{owner:student,email:'student@example.com',kind:'student',expiresAt:Date.now()+365*86400000},['session:'+await hash(otherToken)]:{owner:await hash('otherteacher@example.com'),email:'otherteacher@example.com',expiresAt:Date.now()+365*86400000},['account:'+student]:{id:student,email:'student@example.com',name:'Student',points:190,owned:['mint'],skin:'mint',createdAt:Date.now()-10000}});
 const call=async(action,p={},token=studentToken)=>{const r=await library.fetch(internal('academy:'+action,p,token));return {status:r.status,body:await r.json()};};
 const course=(await call('create-class',{name:'Spanish',timezone:'America/Los_Angeles'},teacherToken)).body.class;await new AcademyService(ctx.storage,env).enroll(course.id,student,'student@example.com','Student');
 const listId=uid(),cards=['casa','habló','aprender','biblioteca'].map((answer,i)=>({type:'pair',prompt:'Clue '+i,answer}));await new ListRepository(ctx.storage,owner).save({id:listId,revision:0,mutationId:uid(),list:{title:'Weekly words',cards}});
 const a=(await call('create-assignment',{classId:course.id,listId,title:'Weekly work',dueLocal,rules},teacherToken)).body.assignment;
 const edit=async(change={},revision)=>{const latest=(await call('assignment-detail',{assignmentId:a.id},teacherToken)).body.assignment;return call('update-assignment',{assignmentId:a.id,revision:revision??latest.revision,mutationId:uid(),...change},teacherToken);};
 const pkey=`practice:${a.id}:${student}`;
 return {ctx,library,owner,student,teacherToken,studentToken,otherToken,course,listId,a,call,edit,pkey};
}
async function clock(fn){const old=Date.now;let now=baseline;Date.now=()=>now;try{await fn(ms=>now+=ms);}finally{Date.now=old;}}
async function answer(f,v,advance){advance(600);const a=await f.ctx.storage.get('assignment:'+f.a.id),card=a.cards.find(c=>c.id===v.question.cardId);const r=await f.call('practice-answer',{assignmentId:f.a.id,lease:v.lease,assignmentRevision:v.assignment.revision,questionKey:v.question.key,answer:card.answer,mutationId:uid()});assert.equal(r.status,200);return r.body;}
async function solve(f,v,entry,advance,extra={}){advance(600);const a=await f.ctx.storage.get('assignment:'+f.a.id),card=a.cards.find(c=>c.prompt===entry.clue);const r=await f.call('practice-crossword-answer',{assignmentId:f.a.id,lease:v.lease,assignmentRevision:v.assignment.revision,puzzleId:v.crossword.id,entry:entry.number,answer:card.answer,mutationId:uid(),...extra});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}

test('assignment detail and edits are limited to the owning teacher and never expose posted answers or edit receipts',()=>clock(async()=>{
 const f=await fixture();for(const token of [f.studentToken,f.otherToken]){assert.equal((await f.call('assignment-detail',{assignmentId:f.a.id},token)).status,403);assert.equal((await f.call('update-assignment',{assignmentId:f.a.id,revision:1,mutationId:uid(),title:'Bad'},token)).status,403);}
 const r=await f.edit({title:'Updated'});assert.equal(r.status,200);assert.equal(r.body.assignment.revision,2);assert.ok(!r.body.assignment.cards&&!r.body.assignment.ownerId&&!r.body.assignment.lastEditMutation);
 const detail=(await f.call('assignment-detail',{assignmentId:f.a.id},f.teacherToken)).body;assert.equal(detail.crosswordEligibleCount,4);assert.equal(detail.assignment.title,'Updated');assert.equal(JSON.stringify(detail).includes('biblioteca'),false);
}));
test('editing updates the existing assignment and dashboard index while preserving its class and question snapshot',()=>clock(async()=>{
 const f=await fixture(),before=await f.ctx.storage.get('assignment:'+f.a.id);
 const r=await f.edit({title:'Revised weekly practice',dueLocal:'2026-12-01T22:15',rules:{minMinutes:2.5,minCards:4,minAccuracy:75,cardCountMode:'distinct',strictAccents:false,crosswordWords:3}});assert.equal(r.status,200);
 const after=await f.ctx.storage.get('assignment:'+f.a.id);assert.deepEqual(after.cards,before.cards);for(const field of ['id','classId','listId','listRevision','ownerId','createdAt','timezone'])assert.deepEqual(after[field],before[field]);
 assert.equal(localDateTimeInput(after.dueAt,after.timezone),'2026-12-01T22:15');assert.equal(after.rules.minSeconds,150);assert.equal(after.rules.crosswordWords,3);
 const index=await f.ctx.storage.get(`assignment-index:${f.course.id}:${f.a.id}`);assert.equal(index.revision,2);assert.equal(index.title,after.title);assert.equal(index.dueAt,after.dueAt);assert.equal(index.lastEditMutation,undefined);
 const home=(await f.call('home')).body;assert.equal(home.assignments.length,1);assert.equal(home.assignments[0].title,after.title);assert.equal(home.assignments[0].rules.crosswordWords,3);
}));
test('duplicate saves settle once, changed content cannot reuse an identifier, and stale editors cannot overwrite a later edit',()=>clock(async()=>{
 const f=await fixture(),payload={assignmentId:f.a.id,revision:1,mutationId:uid(),title:'One saved change'};
 const [a,b]=await Promise.all([f.call('update-assignment',payload,f.teacherToken),f.call('update-assignment',payload,f.teacherToken)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.assignment.revision,2);assert.equal(b.body.assignment.revision,2);
 assert.equal((await f.call('update-assignment',{...payload,title:'Other content'},f.teacherToken)).status,409);assert.equal((await f.edit({title:'Stale'},1)).status,409);assert.equal((await f.ctx.storage.get('assignment:'+f.a.id)).title,'One saved change');
}));
test('validation and immutable-field attempts fail before changing assignments or student records; deleted source lists do not prevent edits',()=>clock(async()=>{
 const f=await fixture();await f.call('practice-open',{assignmentId:f.a.id});const a=await f.ctx.storage.get('assignment:'+f.a.id),p=await f.ctx.storage.get(f.pkey);
 for(const changes of [{rules:{crosswordWords:5}},{rules:{minCards:5,cardCountMode:'distinct'}},{rules:{minAccuracy:101}},{rules:{minMinutes:-1}},{title:''},{classId:uid()},{cards:[]},{listId:uid()},{dueLocal:'bad'}])assert.equal((await f.edit(changes)).status,400,JSON.stringify(changes));
 assert.deepEqual(await f.ctx.storage.get('assignment:'+f.a.id),a);assert.deepEqual(await f.ctx.storage.get(f.pkey),p);
 await new ListRepository(f.ctx.storage,f.owner).remove(f.listId,1);assert.equal((await f.edit({title:'Still editable',rules:{crosswordWords:4}})).status,200);
}));
test('submitted late credit and original rules stay frozen after a due-date extension and stricter requirements',()=>clock(async advance=>{
 const f=await fixture(undefined,'2026-11-18T23:59');let v=(await f.call('practice-open',{assignmentId:f.a.id})).body;v=await answer(f,v,advance);v=(await f.call('practice-submit',{assignmentId:f.a.id,lease:v.lease,assignmentRevision:1})).body;
 assert.equal(v.progress.creditPercent,50);const before=await f.ctx.storage.get(f.pkey);assert.equal(before.submission.rules.minCards,1);
 await f.edit({dueLocal:'2026-12-18T23:59',rules:{minMinutes:30,minCards:100,minAccuracy:100,crosswordWords:3}});
 const after=await f.ctx.storage.get(f.pkey);assert.deepEqual(after,before);
 const report=(await f.call('assignment-report',{assignmentId:f.a.id},f.teacherToken)).body;assert.equal(report.students[0].progress.creditPercent,50);assert.equal(report.students[0].progress.ready,true);assert.equal(report.students[0].progress.submittedAt,v.progress.submittedAt);assert.equal(assignmentGradeRows(report)[1].at(-1),50);
 const reopened=(await f.call('practice-open',{assignmentId:f.a.id})).body;assert.equal(reopened.assignment.rules.minCards,1);assert.equal(reopened.assignment.dueAt,f.a.dueAt);assert.equal(reopened.progress.creditPercent,50);assert.equal(reopened.progress.late,true);
}));
test('legacy submissions receive one grading snapshot on first edit without changing historical or unspecified credit',()=>clock(async()=>{
 const f=await fixture(undefined,'2026-11-18T23:59'),legacy={assignmentId:f.a.id,userId:f.student,answered:1,correct:1,activeMs:0,cardStats:{},submittedAt:baseline-1000,late:true,manualGrade:88};await f.ctx.storage.put(f.pkey,legacy);
 const stored=await f.ctx.storage.get('assignment:'+f.a.id);delete stored.revision;await f.ctx.storage.put('assignment:'+f.a.id,stored);
 await f.edit({rules:{minCards:20,minMinutes:20},dueLocal:'2026-12-18T23:59'});const after=await f.ctx.storage.get(f.pkey),{submission,...original}=after;assert.deepEqual(original,legacy);assert.equal(submission.revision,1);assert.equal(submission.rules.minCards,1);
 await f.edit({title:'Another edit'});assert.deepEqual((await f.ctx.storage.get(f.pkey)).submission,submission);
 const report=(await f.call('assignment-report',{assignmentId:f.a.id},f.teacherToken)).body;assert.equal(report.students[0].progress.creditPercent,null);assert.equal(assignmentGradeRows(report)[1].at(-1),'');
}));
test('unfinished typing survives edits, stale grading is rejected, and heartbeats advertise changed settings without trusting elapsed totals',()=>clock(async advance=>{
 const f=await fixture({minMinutes:1,minCards:10,minAccuracy:80});let v=(await f.call('practice-open',{assignmentId:f.a.id})).body;const key=v.question.key,oldLease=v.lease;v=await answer(f,v,advance);
 await f.edit({title:'New title',rules:{minCards:20,minMinutes:2,crosswordWords:2}});const stale=await f.call('practice-submit',{assignmentId:f.a.id,lease:oldLease,assignmentRevision:1,ready:true});assert.equal(stale.status,412);
 const next=(await f.call('practice-next',{assignmentId:f.a.id,lease:oldLease})).body,record=await f.ctx.storage.get(f.pkey);advance(600);
 assert.equal((await f.call('practice-answer',{assignmentId:f.a.id,lease:oldLease,assignmentRevision:1,questionKey:next.question.key,answer:'anything',mutationId:uid()})).status,412);assert.equal((await f.ctx.storage.get(f.pkey)).answered,record.answered);
 assert.equal((await f.call('practice-answer',{assignmentId:f.a.id,lease:oldLease,questionKey:next.question.key,answer:'anything',mutationId:uid()})).status,412);
 const tick=(await f.call('practice-tick',{assignmentId:f.a.id,lease:oldLease,assignmentRevision:1,active:false,focused:false,elapsedMs:999999})).body;assert.equal(tick.assignment.revision,2);assert.equal(tick.progress.answered,1);assert.equal(tick.clock.milliseconds,0);
 const status=(await f.call('practice-status',{assignmentId:f.a.id,lease:oldLease})).body;assert.equal(status.lease,oldLease);assert.equal(status.question.key,next.question.key);assert.notEqual(status.question.key,key);assert.equal(status.progress.correct,1);assert.equal(status.assignment.rules.crosswordWords,2);
}));
test('increasing a crossword target extends the same puzzle and preserves solved words, clue numbers, receipts and focused time',()=>clock(async advance=>{
 const f=await fixture({minMinutes:5,minCards:20,minAccuracy:80,crosswordWords:2});let v=(await f.call('practice-open',{assignmentId:f.a.id})).body;v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease})).body;v=await solve(f,v,v.crossword.entries[0],advance);
 const p=await f.ctx.storage.get(f.pkey);p.activeMs=12345;await f.ctx.storage.put(f.pkey,p);const old=structuredClone(p.assignmentCrossword),questionKey=p.questionKey;
 await f.edit({rules:{crosswordWords:4}});v=(await f.call('practice-status',{assignmentId:f.a.id,lease:v.lease})).body;const current=await f.ctx.storage.get(f.pkey);
 assert.equal(v.crossword.id,old.id);assert.equal(v.crossword.entries.length,4);assert.equal(v.crossword.solved,1);assert.equal(v.progress.ready,false);assert.equal(current.activeMs,12345);assert.equal(current.questionKey,questionKey);assert.deepEqual(current.assignmentCrossword.receipts,old.receipts);assert.deepEqual(current.assignmentCrossword.solved,old.solved);
 const shifts=old.entries.map(e=>{const n=current.assignmentCrossword.entries.find(n=>n.number===e.number);assert.equal(n.index,e.index);assert.equal(n.direction,e.direction);return [n.row-e.row,n.col-e.col];});assert.ok(shifts.every(s=>s[0]===shifts[0][0]&&s[1]===shifts[0][1]));
}));
test('lowering, disabling and re-enabling Crossword Mode keep saved work, count existing solves and preserve the final grade',()=>clock(async advance=>{
 const f=await fixture({minMinutes:5,minCards:20,minAccuracy:80,crosswordWords:4});let v=(await f.call('practice-open',{assignmentId:f.a.id})).body;v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease})).body;
 v=await solve(f,v,v.crossword.entries[0],advance);v=await solve(f,v,v.crossword.entries[1],advance);const id=v.crossword.id;
 await f.edit({rules:{crosswordWords:1}});v=(await f.call('practice-status',{assignmentId:f.a.id,lease:v.lease})).body;assert.equal(v.progress.crossword.solved,1);assert.equal(v.crossword.totalSolved,2);assert.equal(v.crossword.extraClues,true);assert.equal(v.progress.ready,true);
 await f.edit({rules:{crosswordWords:0}});v=(await f.call('practice-status',{assignmentId:f.a.id,lease:v.lease})).body;assert.equal(v.crossword,undefined);assert.equal(v.progress.ready,false);assert.equal((await f.ctx.storage.get(f.pkey)).assignmentCrossword.id,id);
 await f.edit({rules:{crosswordWords:2}});v=(await f.call('practice-status',{assignmentId:f.a.id,lease:v.lease})).body;assert.equal(v.crossword.id,id);assert.equal(v.crossword.solved,2);assert.equal(v.progress.answered,2);assert.equal(v.progress.ready,true);
 v=(await f.call('practice-submit',{assignmentId:f.a.id,lease:v.lease,assignmentRevision:v.assignment.revision,method:'crossword'})).body;assert.equal(v.progress.creditPercent,100);assert.equal(v.progress.completionMethod,'crossword');await f.edit({rules:{crosswordWords:0,minCards:100}});
 const report=(await f.call('assignment-report',{assignmentId:f.a.id},f.teacherToken)).body;assert.equal(report.students[0].progress.creditPercent,100);assert.equal(report.students[0].progress.crossword.required,2);assert.equal(report.students[0].progress.completionMethod,'crossword');
}));
test('an answer accepted before an edit remains idempotent when its old revision is retried',()=>clock(async advance=>{
 const f=await fixture({minMinutes:5,minCards:20,minAccuracy:80,crosswordWords:2});let v=(await f.call('practice-open',{assignmentId:f.a.id})).body;v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease})).body;const e=v.crossword.entries[0],a=await f.ctx.storage.get('assignment:'+f.a.id),card=a.cards.find(c=>c.prompt===e.clue),payload={assignmentId:f.a.id,lease:v.lease,assignmentRevision:1,puzzleId:v.crossword.id,entry:e.number,answer:card.answer,mutationId:uid()};advance(600);assert.equal((await f.call('practice-crossword-answer',payload)).status,200);await f.edit({rules:{crosswordWords:4}});const again=await f.call('practice-crossword-answer',payload);assert.equal(again.status,200);assert.equal(again.body.progress.answered,1);assert.equal(again.body.assignment.revision,2);
}));
test('unchanged local due-time inputs preserve the exact timestamp during the daylight-saving repeated hour',()=>{
 const a={title:'Fold',timezone:'America/Los_Angeles',dueAt:Date.parse('2026-11-01T09:30:00Z'),rules:{minSeconds:0,minCards:1,minAccuracy:0,strictAccents:true,cardCountMode:'attempts'},cards:[{type:'pair',answer:'casa',alternatives:[]}]};assert.equal(localDateTimeInput(a.dueAt,a.timezone),'2026-11-01T01:30');assert.equal(assignmentEdits(a,{title:'Renamed',dueLocal:'2026-11-01T01:30'},baseline).dueAt,a.dueAt);
});
