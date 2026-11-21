import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,clock} from './study-fixture.js';
import {uid} from '../src/library-domain.js';
import {crosswordGrid,draftEntries} from '../public/js/crossword-grid-model.js';
import {crosswordLetters} from '../src/assignment-crossword.js';

async function open(f,dimension,student=f.students[0]){let v=(await f.call('practice-open',{assignmentId:f.a.id},student.token)).body;assert.equal(v.crossword,null);return (await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease,grid:true,dimension},student.token)).body;}
const resetPayload=(v,dimension)=>({assignmentId:v.assignment.id,assignmentRevision:v.assignment.revision,lease:v.lease,puzzleId:v.crossword.id,draftRevision:v.crossword.draft.revision,dimension,mutationId:uid(),confirm:'CLEAR CROSSWORD PROGRESS'});
async function save(f,v,correct=false){const a=await f.ctx.storage.get('assignment:'+f.a.id),grid=crosswordGrid(v.crossword.entries),values={};for(const e of grid.entries){const answer=correct?crosswordLetters(a.cards.find(c=>c.prompt===e.clue).answer):'Z'.repeat(e.length);e.keys.forEach((key,i)=>values[key]=[...answer][i]);}const r=await f.call('practice-crossword-draft',{...resetPayload(v,v.crossword.dimension),entries:draftEntries(grid,values)},f.students[0].token);assert.equal(r.status,200);v.crossword.draft=r.body.draft;return v;}

test('students independently choose 2D or 3D, and reopening preserves their mode, layout and account draft',()=>clock(async()=>{
 const f=await fixture(2);
 for(const [i,dimension] of [2,3].entries()){
  const s=f.students[i],v=await open(f,dimension,s);assert.equal(v.crossword.dimension,dimension);assert.equal(v.crossword.entries.length,3);assert.equal(new Set(v.crossword.entries.map(e=>e.direction)).size,dimension);
  if(dimension===2){assert.equal(v.crossword.layers,1);assert.ok(v.crossword.entries.every(e=>e.depth===0));}
  const again=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;assert.equal(again.crossword.id,v.crossword.id);assert.deepEqual(again.crossword.entries,v.crossword.entries);assert.equal(again.crossword.dimension,dimension);assert.equal(again.crossword.week,v.crossword.week);
  const mismatch=await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:again.lease,grid:true,dimension:dimension===2?3:2},s.token);assert.equal(mismatch.status,409);assert.equal((await f.call('practice-status',{assignmentId:f.a.id,lease:again.lease},s.token)).body.crossword.id,v.crossword.id);
 }
}));

test('restart requires explicit confirmation and current mode, puzzle, revision and lease; failed requests preserve work',()=>clock(async()=>{
 const f=await fixture(2),v=await save(f,await open(f,2)),before=await f.ctx.storage.list(),payload=resetPayload(v,3);
 for(const patch of [{confirm:''},{dimension:4},{dimension:'3'},{puzzleId:uid()},{draftRevision:-1},{assignmentRevision:0},{lease:uid()},{mutationId:'x'}]){assert.ok((await f.call('practice-crossword-reset',{...payload,...patch},f.students[0].token)).status>=400);assert.deepEqual(await f.ctx.storage.list(),before);}
 assert.equal((await f.call('practice-crossword-reset',payload,f.students[1].token)).status,409);assert.equal((await f.call('practice-crossword-reset',payload,f.teacher)).status,403);assert.equal((await f.call('practice-crossword-reset',payload,f.other)).status,403);
 const same=(await f.call('practice-status',{assignmentId:f.a.id,lease:v.lease},f.students[0].token)).body;assert.deepEqual(same.crossword.draft,v.crossword.draft);
}));

test('confirmed mode changes clear only crossword work, retries reuse the new puzzle, and stale saves cannot restore old letters',()=>clock(async()=>{
 const f=await fixture(1),s=f.students[0],v=await save(f,await open(f,3)),key=`practice:${f.a.id}:${s.userId}`,old=await f.ctx.storage.get(key);old.activeMs=12345;old.answered=7;old.correct=4;old.cardStats={kept:{correct:4,incorrect:3}};old.feedback={correct:true,answer:'kept'};await f.ctx.storage.put(key,old);
 const payload=resetPayload(v,2),r=await f.call('practice-crossword-reset',payload,s.token);assert.equal(r.status,200);assert.equal(r.body.crossword.dimension,2);assert.notEqual(r.body.crossword.id,v.crossword.id);assert.equal(r.body.crossword.solved,0);assert.equal(r.body.crossword.check,null);assert.ok(Object.values(r.body.crossword.draft.entries).every(v=>!v.trim()));
 const saved=await f.ctx.storage.get(key);for(const field of ['activeMs','answered','correct','cardStats','feedback','questionKey','cardIndex','cardCycle'])assert.deepEqual(saved[field],old[field],field);assert.equal((await f.view()).me.xp,0);
 const retry=await f.call('practice-crossword-reset',payload,s.token);assert.equal(retry.body.crossword.id,r.body.crossword.id);assert.equal((await f.call('practice-crossword-reset',{...payload,dimension:3},s.token)).status,409);
 assert.equal((await f.call('practice-crossword-draft',{...payload,entries:v.crossword.draft.entries},s.token)).status,409);assert.equal((await f.call('practice-crossword-check',payload,s.token)).status,409);
 const another=await f.call('practice-crossword-reset',resetPayload(r.body,2),s.token);assert.equal(another.status,200);assert.notEqual(another.body.crossword.id,r.body.crossword.id);assert.equal((await f.call('practice-crossword-reset',payload,s.token)).status,409);
 const reopened=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;assert.equal(reopened.crossword.id,another.body.crossword.id);assert.equal(reopened.crossword.dimension,2);
}));

test('completed crossword submissions keep their final mode and grade and cannot be restarted',()=>clock(async({advance})=>{
 const f=await fixture(1),s=f.students[0];let v=await save(f,await open(f,2),true);advance(600);v=(await f.call('practice-crossword-check',resetPayload(v,2),s.token)).body;assert.equal(v.crossword.complete,true);v=(await f.call('practice-submit',{...resetPayload(v,2),method:'crossword'},s.token)).body;assert.equal(v.progress.creditPercent,100);
 const before=await f.ctx.storage.list(),x=await f.ctx.storage.get(`practice:${f.a.id}:${s.userId}`);assert.equal((await f.call('practice-crossword-reset',{...resetPayload({...v,crossword:{id:x.assignmentCrossword.id,draft:x.assignmentCrossword.gridDraft}},3)},s.token)).status,409);assert.deepEqual(await f.ctx.storage.list(),before);assert.equal(x.assignmentCrossword.dimension,2);
}));

test('flat-puzzle assignment extensions preserve the selected mode, saved letters and puzzle identity',()=>clock(async()=>{
 const f=await fixture(1),s=f.students[0],v=await save(f,await open(f,2)),old=v.crossword;
 assert.equal((await f.call('update-assignment',{assignmentId:f.a.id,revision:1,mutationId:uid(),rules:{crosswordWords:4}})).status,200);
 const next=(await f.call('practice-status',{assignmentId:f.a.id,lease:v.lease},s.token)).body;assert.equal(next.crossword.id,old.id);assert.equal(next.crossword.dimension,2);assert.ok(next.crossword.entries.length===4||next.crossword.restartRequired);assert.equal(next.crossword.goal,4);assert.ok(next.crossword.entries.every(e=>e.direction!=='depth'));for(const e of old.entries)assert.equal(next.crossword.draft.entries[e.number],old.draft.entries[e.number]);
}));
