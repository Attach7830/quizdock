import test from 'node:test';import assert from 'node:assert/strict';
import {validateCard} from '../public/js/list-model.js';
import {createAssignmentCrossword,crosswordCandidates,crosswordLetters,publicAssignmentCrossword} from '../src/assignment-crossword.js';
const cards=['casa','perro','estrecho','zapatos','botas','bufanda','pantalones','sombrero','camisa','habló','aprender','grande','pequeño','cinturón','azul','verde','rojo','amarillo','negro','blanco','chico','lejos','cerca','aquel','aquellas','estas','ese','esos','cuero','algodón','lana','seda','vestido','falda','traje','abrigo','guantes','sudadera','calcetines','chaqueta'].map((answer,i)=>validateCard({prompt:'Clue '+i,answer}));
function rng(seed){return (min,max)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return min+seed%(max-min+1);};}
test('random crosswords contain exactly the teacher count, including decks with no shared letters',()=>{
 for(const goal of [1,2,8,20,40]){const a={cards,rules:{crosswordWords:goal}},x=createAssignmentCrossword(a,rng(goal));assert.equal(x.entries.length,goal);assert.equal(new Set(x.entries.map(e=>e.index)).size,goal);assert.ok(x.rows>0&&x.cols>0);const pub=publicAssignmentCrossword(a,{assignmentCrossword:x});assert.ok(pub.cells.every(c=>!c.value));assert.ok(pub.entries.every(e=>e.clue&&!('index'in e)||e.index===undefined));}
 const disconnected={cards:['aa','bb','cc','dd'].map((answer,i)=>validateCard({prompt:'Clue '+i,answer})),rules:{crosswordWords:4}};assert.equal(createAssignmentCrossword(disconnected,rng(3)).entries.length,4);
 const one=createAssignmentCrossword({cards,rules:{crosswordWords:10}},rng(1)),two=createAssignmentCrossword({cards,rules:{crosswordWords:10}},rng(2));assert.notDeepEqual(one.entries,two.entries);
});
test('crossing cells have consistent letters and reveal only after a containing word is solved',()=>{
 for(let seed=1;seed<=10;seed++){const a={cards,rules:{crosswordWords:20}},x=createAssignmentCrossword(a,rng(seed)),grid=new Map();for(const e of x.entries){const word=crosswordLetters(cards[e.index].answer);for(let i=0;i<e.length;i++){const k=(e.row+(e.direction==='down'?i:0))+':'+(e.col+(e.direction==='across'?i:0));if(grid.has(k))assert.equal(grid.get(k),word[i]);else grid.set(k,word[i]);}}
  x.solved=[x.entries[0].number];const pub=publicAssignmentCrossword(a,{assignmentCrossword:x});assert.ok(pub.cells.filter(c=>c.value).every(c=>c.entries.includes(x.entries[0].number)));
 }
 assert.equal(crosswordLetters('¡él habló!'),'ÉLHABLÓ');
 assert.equal(crosswordCandidates([...cards,cards[0],validateCard({prompt:'long',answer:'a'.repeat(33)})]).length,40);
});
