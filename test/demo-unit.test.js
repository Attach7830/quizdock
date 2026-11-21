import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseImport,compileQuestions} from '../public/js/list-model.js';
import {createAssignmentCrossword,crosswordCandidates} from '../src/assignment-crossword.js';
import {connectedWordGroups} from '../src/crossword-builder.js';

test('downloadable demo imports all categories and generates a single connected three-axis assignment puzzle',()=>{
 const file=fs.readFileSync(new URL('../public/examples/QuizDock-Demo-Unit-Ropa-Gramatica-Cultura.csv',import.meta.url),'utf8'),parsed=parseImport(file);
 assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.warnings,[]);assert.equal(parsed.cards.length,30);
 assert.deepEqual(Object.fromEntries(['vocabulary','grammar','culture'].map(k=>[k,parsed.cards.filter(c=>c.category===k).length])),{vocabulary:12,grammar:10,culture:8});
 assert.equal(compileQuestions({title:'Demo',cards:parsed.cards}).length,30);assert.equal(connectedWordGroups(crosswordCandidates(parsed.cards))[0].length,30);
 for(const dimension of [2,3])for(const goal of [12,30])for(let seed=1;seed<=12;seed++){
  let state=seed;const rng=(min,max)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return min+state%(max-min+1);};
  const x=createAssignmentCrossword({cards:parsed.cards,rules:{crosswordWords:goal}},rng,dimension);assert.equal(x.entries.length,goal);assert.equal(x.dimension,dimension);assert.equal(new Set(x.entries.map(e=>e.direction)).size,dimension);
  const keys=e=>Array.from({length:e.length},(_,i)=>`${e.row+(e.direction==='down'?i:0)}:${e.col+(e.direction==='across'?i:0)}:${e.depth+(e.direction==='depth'?i:0)}`),seen=new Set(keys(x.entries[0]));let count=0,previous=-1;
  while(count!==previous){previous=count;count=0;for(const e of x.entries)if(keys(e).some(k=>seen.has(k))){keys(e).forEach(k=>seen.add(k));count++;}}
  assert.equal(count,goal);
 }
});
