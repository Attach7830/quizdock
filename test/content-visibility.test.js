import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,clock} from './study-fixture.js';
import {uid,ListRepository} from '../src/library-domain.js';
import {internal} from './memory-runtime.js';
import {AcademyService} from '../src/academy-domain.js';
import {assignmentGradeRows} from '../public/js/assignment-ui.js';

const visibility=(f,visible,revision=1,extra={})=>f.call('assignment-visibility',{assignmentId:f.a.id,visible,revision,mutationId:uid(),...extra});
const sharing=(f,visible,revision=1,extra={})=>f.call('class-list-visibility',{classId:f.course.id,listId:f.listId,visible,revision,mutationId:uid(),...extra});
async function open(f){const token=f.students[0].token;let v=(await f.call('practice-open',{assignmentId:f.a.id},token)).body;return (await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease,grid:true},token)).body;}

test('only the owning teacher can remove content, and invalid requests change nothing',()=>clock(async()=>{
 const f=await fixture(1),before=await f.ctx.storage.list();
 for(const [action,payload] of [['assignment-visibility',{assignmentId:f.a.id}],['class-list-visibility',{classId:f.course.id,listId:f.listId}]]){
  for(const token of [f.students[0].token,f.other])assert.equal((await f.call(action,{...payload,visible:false,revision:1,mutationId:uid()},token)).status,403);
 }
 for(const payload of [{visible:'false'},{mutationId:'x'},{revision:0},{revision:2}])assert.ok((await visibility(f,false,1,payload)).status>=400);
 assert.deepEqual(await f.ctx.storage.list(),before);
}));

test('assignment removal blocks every student practice route without erasing drafts, time, grades or rewards',()=>clock(async()=>{
 const f=await fixture(2),s=f.students[0],v=await open(f),pkey=`practice:${f.a.id}:${s.userId}`,saved=await f.ctx.storage.get(pkey);
 saved.activeMs=12345;saved.answered=2;saved.correct=1;await f.ctx.storage.put(pkey,saved);
 const r=await visibility(f,false);assert.equal(r.status,200);assert.ok(r.body.assignment.removedAt);assert.equal(r.body.assignment.revision,2);assert.equal(r.body.assignment.lastVisibilityMutation,undefined);
 assert.ok(!(await f.call('home',{},s.token)).body.assignments.some(a=>a.id===f.a.id));assert.ok((await f.call('home')).body.assignments.find(a=>a.id===f.a.id).removedAt);
 const before=await f.ctx.storage.list();
 for(const action of ['practice-open','practice-status','practice-answer','practice-next','practice-tick','practice-letter','practice-activity','practice-crossword-open','practice-crossword-reset','practice-crossword-answer','practice-crossword-draft','practice-crossword-check','practice-submit']){
  const denied=await f.call(action,{assignmentId:f.a.id,lease:v.lease,assignmentRevision:1,mutationId:uid(),elapsedMs:999999,active:true,focused:true},s.token);assert.equal(denied.status,404,action);
 }
 assert.deepEqual(await f.ctx.storage.list(),before);assert.deepEqual(await f.ctx.storage.get(pkey),saved);
 const report=(await f.call('assignment-report',{assignmentId:f.a.id})).body;assert.equal(report.students.find(x=>x.userId===s.userId).progress.correct,1);
 assert.equal((await f.call('update-assignment',{assignmentId:f.a.id,revision:2,mutationId:uid(),title:'Hidden edit'})).status,409);
 assert.equal((await visibility(f,true,2)).status,200);const resumed=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;
 assert.equal(resumed.crossword.id,v.crossword.id);assert.deepEqual(resumed.crossword.draft,v.crossword.draft);assert.equal(resumed.progress.answered,2);assert.equal(resumed.clock.milliseconds,12345);assert.equal(resumed.assignment.revision,3);
 assert.equal((await f.call('home',{},s.token)).body.assignments.length,1);
}));

test('removal freezes legacy submitted requirements while keeping CSV credit and teacher reports',()=>clock(async()=>{
 const f=await fixture(1),s=f.students[0],key=`practice:${f.a.id}:${s.userId}`,legacy={assignmentId:f.a.id,userId:s.userId,answered:4,correct:3,activeMs:54321,cardStats:{},submittedAt:Date.now()-1000,creditPercent:50,late:true,completionMethod:'typed',manualGrade:88};await f.ctx.storage.put(key,legacy);
 assert.equal((await visibility(f,false)).status,200);const removed=await f.ctx.storage.get(key),{submission,...rest}=removed;assert.deepEqual(rest,legacy);assert.equal(submission.revision,1);assert.equal(submission.rules.minCards,1);
 const before=(await f.call('assignment-report',{assignmentId:f.a.id})).body;assert.equal(before.students[0].progress.creditPercent,50);assert.equal(assignmentGradeRows(before)[1].at(-1),50);
 await visibility(f,true,2);await f.call('update-assignment',{assignmentId:f.a.id,revision:3,mutationId:uid(),rules:{minCards:100,minMinutes:30}});assert.deepEqual((await f.ctx.storage.get(key)).submission,submission);
 const after=(await f.call('assignment-report',{assignmentId:f.a.id})).body;assert.equal(after.students[0].progress.creditPercent,50);assert.equal(after.students[0].progress.ready,before.students[0].progress.ready);assert.deepEqual(assignmentGradeRows(after),assignmentGradeRows(before));
}));

test('visibility retries are idempotent and stale requests cannot undo a restore or a republished list',()=>clock(async()=>{
 const f=await fixture(1),request=uid();assert.equal((await visibility(f,false,1,{mutationId:request})).status,200);assert.equal((await visibility(f,false,1,{mutationId:request})).body.assignment.revision,2);assert.equal((await visibility(f,true,2,{mutationId:request})).status,409);
 await visibility(f,true,2);assert.equal((await visibility(f,false,1,{mutationId:request})).status,409);assert.equal((await visibility(f,false,2)).status,409);assert.ok(!(await f.call('assignment-detail',{assignmentId:f.a.id})).body.assignment.removedAt);
 assert.equal((await visibility(f,true,3)).body.assignment.revision,3);
 const hideId=uid();await sharing(f,false,1,{mutationId:hideId});assert.equal((await sharing(f,false,1,{mutationId:hideId})).body.sharingVersion,2);await f.call('share-list',{classId:f.course.id,listId:f.listId});assert.equal((await sharing(f,false,1,{mutationId:hideId})).status,409);assert.equal((await sharing(f,false,2)).status,409);assert.equal((await f.call('home',{},f.students[0].token)).body.sharedLists.length,1);
}));

test('removing a class study list preserves its private source, other classes, assignment snapshots and study history',()=>clock(async()=>{
 const f=await fixture(1),s=f.students[0],course2=(await f.call('create-class',{name:'Another class'})).body.class;
 await new AcademyService(f.ctx.storage,f.env).enroll(course2.id,s.userId,s.email,'Student');await f.call('share-list',{classId:course2.id,listId:f.listId});
 const shared=(await f.call('solo-open',{classId:f.course.id,listId:f.listId},s.token)).body,card=shared.deck.cards[0],skey=`solo:${s.userId}:${f.course.id}:${f.listId}`,history={index:2,known:[card.id],again:[],cardStats:{[card.id]:{misses:2,recoveries:1}},updatedAt:Date.now()-1000};await f.ctx.storage.put(skey,history);
 assert.equal((await sharing(f,false)).status,200);const after=await f.ctx.storage.list();
 for(const action of ['solo-open','solo-answer','solo-review','solo-save'])assert.equal((await f.call(action,{classId:f.course.id,listId:f.listId,cardId:card.id,answer:card.answer,mark:'known',mutationId:uid()},s.token)).status,404,action);
 const game=await f.library.fetch(internal('solo-game-source',{classId:f.course.id,listId:f.listId,mode:'word'},s.token));assert.equal(game.status,404);assert.deepEqual(await f.ctx.storage.list(),after);
 assert.equal((await f.call('home',{},s.token)).body.sharedLists.length,1);assert.equal((await f.call('solo-open',{classId:course2.id,listId:f.listId},s.token)).status,200);assert.equal((await f.call('practice-open',{assignmentId:f.a.id},s.token)).status,200);
 const repo=new ListRepository(f.ctx.storage,f.owner),source=await repo.get(f.listId);assert.equal(source.cards.length,4);await repo.remove(f.listId,source.revision);
 assert.equal((await sharing(f,true,2)).status,200);const restored=(await f.call('solo-open',{classId:f.course.id,listId:f.listId},s.token)).body;assert.deepEqual(restored.deck.cards,shared.deck.cards);assert.deepEqual(restored.progress,history);assert.equal(restored.deck.lastVisibilityMutation,undefined);
 const roster=(await f.call('class-detail',{classId:f.course.id})).body;assert.equal(roster.sharedLists[0].sharingVersion,3);assert.equal((await f.call('class-detail',{classId:f.course.id},s.token)).status,403);
}));

test('old backups cannot republish removed content; new backups retain visibility and archived retention cannot be restored',()=>clock(async()=>{
 const f=await fixture(1),data=async(action,p={})=>{const r=await f.library.fetch(internal('data:'+action,p,f.teacher));return {status:r.status,body:await r.json()};};
 const bundle=(await data('backup')).body;await visibility(f,false);await sharing(f,false);const current=(await data('backup')).body;
 const oldPlan=await data('restore-preview',{bundle});assert.equal(oldPlan.status,200);assert.ok(oldPlan.body.preview.conflicts>=2);
 const assignmentIndex=`assignment-index:${f.course.id}:${f.a.id}`,sharedIndex=`shared-index:${f.course.id}:${f.listId}`;await f.ctx.storage.delete([assignmentIndex,sharedIndex]);await data('restore',{bundle,confirm:'RESTORE MISSING RECORDS'});assert.equal(await f.ctx.storage.get(assignmentIndex),undefined);assert.equal(await f.ctx.storage.get(sharedIndex),undefined);
 await data('restore',{bundle:current,confirm:'RESTORE MISSING RECORDS'});assert.ok((await f.ctx.storage.get(assignmentIndex)).removedAt);assert.ok((await f.ctx.storage.get(sharedIndex)).hiddenAt);assert.equal((await f.call('home',{},f.students[0].token)).body.assignments.length,0);
 const a=await f.ctx.storage.get('assignment:'+f.a.id);a.archived=true;await f.ctx.storage.put('assignment:'+a.id,a);assert.equal((await visibility(f,true,2)).status,404);assert.ok((await f.ctx.storage.get('assignment:'+a.id)).archived);
}));
