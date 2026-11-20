import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,clock} from './study-fixture.js';
import {uid} from '../src/library-domain.js';
import {internal} from './memory-runtime.js';
import {crosswordGrid,draftEntries,draftCells} from '../public/js/crossword-grid-model.js';
import {crosswordLetters} from '../src/assignment-crossword.js';

async function open(f){const s=f.students[0];let v=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;return (await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease,grid:true},s.token)).body;}
function payload(v){return {assignmentId:v.assignment.id,assignmentRevision:v.assignment.revision,lease:v.lease,puzzleId:v.crossword.id,draftRevision:v.crossword.draft.revision,mutationId:uid()};}
async function letters(f,v){const a=await f.ctx.storage.get('assignment:'+v.assignment.id),grid=crosswordGrid(v.crossword.entries),values={};for(const e of grid.entries){const word=crosswordLetters(a.cards.find(c=>c.prompt===e.clue).answer);e.keys.forEach((k,i)=>values[k]=[...word][i]);}return {grid,values,entries:draftEntries(grid,values)};}
async function save(f,v,entries){const r=await f.call('practice-crossword-draft',{...payload(v),entries},f.students[0].token);assert.equal(r.status,200,JSON.stringify(r.body));v.crossword.draft=r.body.draft;return r;}
test('direct-grid drafts save exact letters and are idempotent without grading, XP or correctness leaks',()=>clock(async()=>{
 const f=await fixture(),v=await open(f),solved=await letters(f,v),p={...payload(v),entries:solved.entries},s=f.students[0];
 const r=await f.call('practice-crossword-draft',p,s.token);assert.equal(r.status,200);assert.deepEqual(r.body.draft.entries,solved.entries);assert.equal((await f.call('practice-crossword-draft',p,s.token)).body.draft.revision,r.body.draft.revision);
 const status=(await f.call('practice-status',{...payload(v)},s.token)).body;assert.equal(status.progress.answered,0);assert.equal(status.progress.correct,0);assert.equal(status.crossword.solved,0);assert.equal(status.crossword.check,null);assert.ok(status.crossword.cells.every(c=>!c.value));assert.equal((await f.view()).me.xp,0);
 const teacher=(await f.call('assignment-report',{assignmentId:v.assignment.id})).body.students.find(s=>s.userId===f.students[0].userId);assert.equal(teacher.liveCrossword.correct,3);assert.equal(teacher.liveCrossword.filled,3);assert.equal((await f.call('assignment-report',{assignmentId:v.assignment.id},s.token)).status,403);
 const exp=await(await f.library.fetch(internal('data:personal-export',{},s.token))).json();assert.ok(!JSON.stringify(exp).includes('liveCrossword'));assert.ok(!JSON.stringify(exp).includes('checkedCorrect'));assert.ok(!JSON.stringify(status).includes('lastMutation'));assert.ok(!JSON.stringify(status).includes('"index"'));
}));
test('partial and crossing-inconsistent drafts cannot grade or submit; malformed saves are atomic',()=>clock(async()=>{
 const f=await fixture(),v=await open(f),x=await letters(f,v),s=f.students[0],base=payload(v),prior=await f.ctx.storage.get(`practice:${f.a.id}:${s.userId}`);
 const entry=x.grid.entries.find(e=>e.keys.some(k=>x.grid.cells.find(c=>c.key===k).entries.length>1)),bad=structuredClone(x.entries);
 if(entry){bad[entry.number]='Z'.repeat(entry.length);assert.equal((await f.call('practice-crossword-draft',{...base,entries:bad},s.token)).status,400);}
 assert.equal((await f.call('practice-crossword-draft',{...base,entries:{}},s.token)).status,409);assert.deepEqual(await f.ctx.storage.get(`practice:${f.a.id}:${s.userId}`),prior);
 assert.equal((await f.call('practice-crossword-check',base,s.token)).status,400);assert.equal((await f.call('practice-submit',{...base,method:'crossword'},s.token)).status,409);assert.equal((await f.call('practice-crossword-answer',{...base,entry:1,answer:'casa'},s.token)).status,412);assert.equal((await f.view()).me.xp,0);
}));
test('whole-grid check grades once, locks saved words, preserves typed thresholds and credits crossword explicitly',()=>clock(async({advance})=>{
 const f=await fixture(),v=await open(f),x=await letters(f,v),s=f.students[0];await save(f,v,x.entries);advance(600);const check=payload(v),r=await f.call('practice-crossword-check',check,s.token);assert.equal(r.status,200);assert.equal(r.body.crossword.check.complete,true);assert.equal(r.body.progress.correct,3);assert.equal(r.body.progress.answered,3);assert.equal((await f.view()).me.xp,30);
 assert.equal((await f.call('practice-crossword-check',check,s.token)).body.progress.answered,3);assert.equal((await f.view()).me.xp,30);
 const changed=structuredClone(x.entries);changed[x.grid.entries[0].number]='Z'.repeat(x.grid.entries[0].length);assert.equal((await f.call('practice-crossword-draft',{...payload(r.body),entries:changed},s.token)).status,400);
 const done=await f.call('practice-submit',{...payload(r.body),method:'crossword'},s.token);assert.equal(done.body.progress.completionMethod,'crossword');assert.equal(done.body.progress.creditPercent,100);
 assert.equal((await f.ctx.storage.get('account:'+s.userId)).points,190);assert.equal((await f.call('home',{},s.token)).body.studyRewards[0].completed,0);
}));
test('wrong complete grids earn attempt credit only on changed checks; edits and stale revisions cannot overwrite saved work',()=>clock(async({advance})=>{
 const f=await fixture(),v=await open(f),x=await letters(f,v),s=f.students[0],wrong=draftEntries(x.grid,Object.fromEntries(x.grid.cells.map(c=>[c.key,'Z'])));await save(f,v,wrong);advance(600);const one=await f.call('practice-crossword-check',payload(v),s.token);assert.equal(one.body.crossword.check.correct,0);assert.equal(one.body.crossword.check.incorrect.length,3);assert.equal((await f.view()).me.xp,6);advance(600);
 await f.call('practice-crossword-check',payload(one.body),s.token);assert.equal((await f.view()).me.xp,6);
 const old=payload(one.body);await save(f,v,x.entries);assert.equal((await f.call('practice-crossword-draft',{...old,entries:wrong},s.token)).status,409);
 const other=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;assert.equal((await f.call('practice-crossword-draft',{...payload(v),entries:x.entries},s.token)).status,409);assert.deepEqual(other.crossword.draft.entries,x.entries);
}));
test('grid migration retains the same puzzle, solved words and assignment history',()=>clock(async({advance})=>{
 const f=await fixture(),s=f.students[0];let v=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease},s.token)).body;const e=v.crossword.entries[0],a=await f.ctx.storage.get('assignment:'+f.a.id);advance(600);
 v=(await f.call('practice-crossword-answer',{assignmentId:f.a.id,lease:v.lease,puzzleId:v.crossword.id,entry:e.number,answer:a.cards.find(c=>c.prompt===e.clue).answer,mutationId:uid()},s.token)).body;const old=structuredClone(v);
 v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease,grid:true},s.token)).body;assert.equal(v.crossword.id,old.crossword.id);assert.equal(v.crossword.solved,1);assert.equal(v.progress.correct,old.progress.correct);assert.equal((await f.view()).me.xp,10);assert.ok(v.crossword.draft.entries[e.number].trim());
}));
test('traditional clue numbering shares starting squares without changing persistent entry identifiers',()=>{
 const grid=crosswordGrid([{number:9,row:0,col:0,direction:'down',length:3},{number:2,row:0,col:0,direction:'across',length:3},{number:7,row:2,col:0,direction:'across',length:2}]);assert.deepEqual(grid.entries.map(e=>[e.number,e.label]),[[9,1],[2,1],[7,2]]);
 const entries=draftEntries(grid,{'0:0':'Á','2:1':'Ñ'});assert.equal(entries[9],'Á  ');assert.equal(entries[7],' Ñ');assert.equal(draftCells(grid,entries)['0:0'],'Á');
});
test('classmates receive distinct personal layouts saved across leases and stamped for the assignment week',()=>clock(async()=>{
 const f=await fixture(),layouts=new Set();
 for(const s of f.students){let v=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;v=(await f.call('practice-crossword-open',{assignmentId:f.a.id,lease:v.lease,grid:true},s.token)).body;assert.equal(v.crossword.dimension,3);assert.equal(v.crossword.week,'2026-11-16');layouts.add(JSON.stringify(v.crossword.entries));const again=(await f.call('practice-open',{assignmentId:f.a.id},s.token)).body;assert.equal(again.crossword.id,v.crossword.id);assert.deepEqual(again.crossword.entries,v.crossword.entries);assert.deepEqual(again.crossword.draft,v.crossword.draft);}
 assert.equal(layouts.size,f.students.length);
}));
