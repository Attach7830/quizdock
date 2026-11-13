import test from 'node:test';
import assert from 'node:assert/strict';
import {readCsv,importCsv,TEMPLATE,DEMO} from '../public/js/csv.js';
test('CSV parses commas, escaped quotes, multi-line strings and BOM',()=>{
 const rows=readCsv('\uFEFFQuestion,Answer\r\n"Hola, "+"X","Hello"\r\n"Two ""quotes""",yes\n');
 assert.equal(rows[0][0],'Question');
 assert.equal(rows[1][0],'Hola, +X');
 assert.equal(rows[2][0],'Two "quotes"');
});
test('Blooket template correct answer indices and Spanish quotes',()=>{
 const qs=importCsv(TEMPLATE);
 assert.equal(qs.length,3);
 assert.equal(qs[0].correct[0],0);
 assert.equal(qs[0].text,'¿Qué significa aprovechar?');
});
test('vocabulary pairs generate 4 multiple choice answers',()=>{
 const qs=importCsv(DEMO);
 assert.equal(qs.length,12);
 assert.equal(qs[0].answers.length,4);
 assert.equal(qs[0].answers[0],'to learn');
 assert.ok(qs[0].answers.includes('to eat'));
});
test('Gimkit-style answers accepted',()=>{
 const qs=importCsv('Question,Correct Answer,Incorrect Answer 1,Incorrect Answer 2,Incorrect Answer 3\nHola,hello,goodbye,thanks,please\n');
 assert.equal(qs[0].answers.length,4);
 assert.equal(qs[0].correct[0],0);
});
test('Blooket numeric answer reference accepted',()=>{
 const qs=importCsv('Question Text,Answer 1,Answer 2,Correct Answer(s)\n¿Cuál?,uno,dos,2\n');
 assert.deepEqual(qs[0].correct,[1]);
});
test('single pair without distractors is rejected',()=>{
 assert.throws(()=>importCsv('Spanish,English\nhola,hello'),/distinct answers/);
});
