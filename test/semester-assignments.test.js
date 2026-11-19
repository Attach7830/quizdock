import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherLibrary} from '../src/library-service.js';
import {AcademyService} from '../src/academy-domain.js';
import {hash,uid,ListRepository} from '../src/library-domain.js';
import {dateTimeInZone} from '../src/academy-model.js';
import {assignmentSemester,validateSemester,inCurrentAssignmentSemester} from '../src/assignment-policy.js';
import {assignmentDashboard,assignmentGradeRows} from '../public/js/assignment-ui.js';
import {context,internal,namespace} from './memory-runtime.js';
import gateway from '../src/library-worker.js';

const semester={start:'2026-08-15',end:'2026-12-18'},timezone='America/Los_Angeles',initialTime=Date.parse('2026-11-19T20:00:00Z');
async function atTime(fn){const original=Date.now;let now=initialTime;Date.now=()=>now;try{return await fn(value=>now=value);}finally{Date.now=original;}}
async function fixture(){
 const ctx=context(),config={TEACHER_EMAILS:'teacher@example.com,otherteacher@example.com'},library=new TeacherLibrary(ctx,config),academy=new AcademyService(ctx.storage,config),owner=await hash('teacher@example.com'),id=await hash('semester.student@example.com'),teacherToken=uid(),studentToken=uid(),otherToken=uid();
 await ctx.storage.put({['session:'+await hash(teacherToken)]:{owner,email:'teacher@example.com',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000},['session:'+await hash(studentToken)]:{owner:id,email:'semester.student@example.com',kind:'student',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000},['session:'+await hash(otherToken)]:{owner:await hash('otherteacher@example.com'),email:'otherteacher@example.com',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000},['account:'+id]:{id,email:'semester.student@example.com',name:'Semester Student',points:190,owned:['mint'],skin:'mint',createdAt:Date.now()-100000}});
 const call=async(action,p={},token=studentToken)=>{const r=await library.fetch(internal('academy:'+action,p,token));return {status:r.status,body:await r.json()};};
 const course=(await call('create-class',{name:'Spanish',timezone,semester},teacherToken)).body.class;await academy.enroll(course.id,id,'semester.student@example.com','Semester Student');
 const listId=uid();await new ListRepository(ctx.storage,owner).save({id:listId,revision:0,mutationId:uid(),list:{title:'Review',cards:[{type:'pair',prompt:'House',answer:'casa'}]}});
 const assign=async(title,dueLocal,classId=course.id)=>(await call('create-assignment',{classId,listId,title,dueLocal,rules:{minMinutes:0,minCards:1,minAccuracy:100}},teacherToken)).body.assignment;
 const complete=async(a,mode='type')=>{const open=(await call('practice-open',{assignmentId:a.id})).body;if(mode==='word')await call('practice-activity',{assignmentId:a.id,lease:open.lease,questionKey:open.question.key,activity:'forge'});await call('practice-answer',{assignmentId:a.id,lease:open.lease,questionKey:open.question.key,answer:'casa',mutationId:uid()});return open;};
 return {ctx,library,academy,owner,id,teacherToken,studentToken,otherToken,course,call,assign,complete};
}

test('semester boundaries follow the class local calendar, including midnight and the whole end date',()=>{
 assert.deepEqual(validateSemester(semester),semester);assert.throws(()=>validateSemester({start:'2026-02-30',end:'2026-06-01'}));assert.throws(()=>validateSemester({start:'2026-12-18',end:'2026-08-15'}));
 for(const [local,expected] of [['2026-08-14T23:59',false],['2026-08-15T00:00',true],['2026-12-18T23:59',true],['2026-12-19T00:00',false]])assert.equal(inCurrentAssignmentSemester({dueAt:dateTimeInZone(local,timezone)},semester,timezone,initialTime),expected,local);
 assert.equal(inCurrentAssignmentSemester({dueAt:initialTime},semester,timezone,dateTimeInZone('2026-12-19T00:00',timezone)),false);
 assert.equal(inCurrentAssignmentSemester({dueAt:initialTime,archived:true},semester,timezone,initialTime),false);
 assert.equal(inCurrentAssignmentSemester({dueAt:initialTime,createdAt:initialTime+1},semester,timezone,initialTime),false);
 assert.deepEqual(assignmentSemester({timezone},initialTime),{start:'2026-08-10',end:'2026-12-18'});assert.deepEqual(assignmentSemester({timezone,semester},initialTime),semester);
});

test('student homepage lists upcoming and overdue posted work together, excluding other terms and completed or archived work',()=>atTime(async()=>{
 const f=await fixture(),late=await f.assign('Overdue current work','2026-11-18T23:59'),upcoming=await f.assign('Upcoming current work','2026-11-25T23:59'),submitted=await f.assign('Already finished','2026-11-20T23:59'),archived=await f.assign('Archived work','2026-11-21T23:59');
 await f.assign('Old semester','2026-06-01T23:59');await f.assign('Next semester','2027-01-20T23:59');
 const record=await f.ctx.storage.get(`assignment-index:${f.course.id}:${archived.id}`);record.archived=true;await f.ctx.storage.put(`assignment-index:${f.course.id}:${archived.id}`,record);
 const open=await f.complete(submitted);await f.call('practice-submit',{assignmentId:submitted.id,lease:open.lease});
 const home=(await f.call('home')).body,pending=home.assignments.filter(a=>a.inCurrentSemester&&!a.progress?.submittedAt);assert.deepEqual(pending.map(a=>a.id),[late.id,upcoming.id]);assert.equal(pending[0].creditAvailablePercent,50);assert.equal(pending[1].creditAvailablePercent,100);
 const markup=assignmentDashboard(home);assert.match(markup,/1 upcoming · 1 overdue/);assert.match(markup,/half credit \(50%\)/);assert.ok(markup.indexOf('Overdue current work')<markup.indexOf('Upcoming current work'));assert.ok(!markup.includes('Already finished')&&!markup.includes('Old semester')&&!markup.includes('Next semester')&&!markup.includes('Archived work'));
 assert.ok(home.assignments.some(a=>a.title==='Old semester'));assert.ok(home.assignments.every(a=>!a.cards&&!a.ownerId));assert.equal(assignmentDashboard({...home,user:{role:'teacher'}}),'');
}));

test('new late submissions record half credit exactly once, keep accuracy separate, and reject forged full credit',()=>atTime(async()=>{
 const f=await fixture(),a=await f.assign('Late review','2026-11-18T23:59'),before=await f.ctx.storage.get('account:'+f.id);
 const open=await f.complete(a,'word'),first=await f.call('practice-submit',{assignmentId:a.id,lease:open.lease,creditPercent:100,late:false});assert.equal(first.status,200);assert.equal(first.body.progress.creditPercent,50);assert.equal(first.body.progress.accuracy,100);assert.equal(first.body.progress.late,true);
 const again=await f.call('practice-submit',{assignmentId:a.id,lease:open.lease,creditPercent:100});assert.equal(again.body.progress.creditPercent,50);assert.equal(again.body.progress.submittedAt,first.body.progress.submittedAt);assert.equal((await f.call('practice-answer',{assignmentId:a.id,lease:open.lease,questionKey:open.question.key,answer:'casa',mutationId:uid()})).status,409);
 const report=(await f.call('assignment-report',{assignmentId:a.id},f.teacherToken)).body;assert.equal(report.students[0].progress.creditPercent,50);const csv=assignmentGradeRows(report);assert.equal(csv[0].at(-1),'Credit %');assert.equal(csv[1].at(-1),50);assert.equal(csv[1][6],'100.00');
 assert.deepEqual(await f.ctx.storage.get('account:'+f.id),before);assert.equal((await f.ctx.storage.list({prefix:'study-award:'})).size,0);
}));

test('submission time controls credit at the exact due-time boundary without changing completion requirements',()=>atTime(async setTime=>{
 const f=await fixture(),a=await f.assign('On time','2026-11-19T12:10'),late=await f.assign('Crossing the deadline','2026-11-19T12:10');
 const notReady=(await f.call('practice-open',{assignmentId:a.id})).body;assert.equal((await f.call('practice-submit',{assignmentId:a.id,lease:notReady.lease})).status,409);
 const first=await f.complete(a),second=await f.complete(late);setTime(a.dueAt);
 assert.equal((await f.call('practice-submit',{assignmentId:a.id,lease:first.lease})).body.progress.creditPercent,100);
 setTime(a.dueAt+1);assert.equal((await f.call('practice-submit',{assignmentId:late.id,lease:second.lease})).body.progress.creditPercent,50);
}));

test('previous submissions retain their recorded grades and exports leave legacy credit unspecified',()=>atTime(async()=>{
 const f=await fixture(),a=await f.assign('Previously submitted','2026-11-18T23:59'),key=`practice:${a.id}:${f.id}`,legacy={assignmentId:a.id,userId:f.id,answered:10,correct:8,activeMs:300000,cardStats:{},submittedAt:initialTime-1000,late:true,manualGrade:88};await f.ctx.storage.put(key,legacy);
 const home=(await f.call('home')).body,report=(await f.call('assignment-report',{assignmentId:a.id},f.teacherToken)).body;assert.equal(home.assignments[0].progress.creditPercent,null);assert.equal(report.students[0].progress.creditPercent,null);assert.equal(assignmentGradeRows(report)[1].at(-1),'');assert.deepEqual(await f.ctx.storage.get(key),legacy);assert.ok(!assignmentDashboard(home).includes('Previously submitted'));
 const exported=await f.library.fetch(internal('data:personal-export',{},f.studentToken));const records=(await exported.json()).records;assert.equal(records.find(([k])=>k===key)[1].manualGrade,88);
}));

test('only the owning teacher can set valid semester dates, with no effect on reward ledgers or class membership',()=>atTime(async()=>{
 const f=await fixture(),course=await f.ctx.storage.get('class:'+f.course.id),ledgerKey=`study-ledger:${f.course.id}:${f.id}:2026-12-18`,ledger={classId:f.course.id,userId:f.id,semesterEnd:'2026-12-18',points:85,completed:185};course.studyRewards={cardsPerReward:100,semesterEnd:'2026-12-18'};await f.ctx.storage.put({['class:'+course.id]:course,[ledgerKey]:ledger});
 const change={classId:course.id,semester:{start:'2026-09-01',end:'2026-12-20'}};
 assert.equal((await f.call('set-semester',change)).status,403);assert.equal((await f.call('set-semester',change,f.otherToken)).status,403);assert.equal((await f.call('set-semester',{...change,semester:{start:'2026-12-01',end:'2026-11-01'}},f.teacherToken)).status,400);
 assert.equal((await f.call('set-semester',change,f.teacherToken)).status,200);const saved=await f.ctx.storage.get('class:'+course.id);assert.deepEqual(saved.semester,change.semester);assert.deepEqual(saved.studyRewards,course.studyRewards);assert.deepEqual((await f.ctx.storage.get(`class-owner:${f.owner}:${course.id}`)).semester,change.semester);assert.deepEqual(await f.ctx.storage.get(ledgerKey),ledger);assert.equal((await f.academy.enrollment(f.id,course.id)).active,true);
 const request=token=>new Request('https://quiz.test/api/academy/set-semester',{method:'POST',headers:{origin:'https://quiz.test','content-type':'application/json',cookie:'__Host-quizdock-library='+token},body:JSON.stringify(change)}),env={TEACHER_LIBRARY:namespace(f.library)};assert.equal((await gateway.fetch(request(f.teacherToken),env)).status,200);assert.equal((await gateway.fetch(request(f.studentToken),env)).status,403);assert.equal((await gateway.fetch(request(''),env)).status,401);
}));
