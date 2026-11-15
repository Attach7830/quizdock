import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeTyped} from '../public/js/answer-check.js';
import {validateCard} from '../public/js/list-model.js';
import {checkSoloAnswer,resetSoloEntry} from '../public/js/solo-typing.js';
import {createRoundMetrics,recordCardAnswer,roundReport} from '../src/round-metrics.js';

test('either semicolon-separated meaning and the original full answer are accepted',()=>{
 const card=validateCard({prompt:'estrecho',answer:'tight; narrow'});
 for(const answer of ['tight','narrow',' TIGHT ','tight; narrow'])assert.equal(gradeTyped(card,answer).correct,true,answer);
 for(const answer of ['tig','wide','tight; wide','','   '])assert.equal(gradeTyped(card,answer).correct,false,answer);
 assert.deepEqual(gradeTyped(card,'narrow').expected,['tight; narrow']);
 assert.equal(card.answer,'tight; narrow');
});
test('semicolon meanings work in explicit alternatives and correct choice answers, without splitting other punctuation',()=>{
 const card=validateCard({prompt:'estrecho',answer:'tight; narrow',alternatives:['close; snug']});
 for(const answer of ['close','snug'])assert.equal(gradeTyped(card,answer).correct,true);
 const choice=validateCard({type:'choice',prompt:'estrecho',choices:['tight; narrow','wide; broad'],correct:[0]});
 assert.equal(gradeTyped(choice,'narrow').correct,true);assert.equal(gradeTyped(choice,'broad').correct,false);
 for(const answer of ['red, white','black / white','bread and butter']){
  const literal=validateCard({prompt:'phrase',answer});
  assert.equal(gradeTyped(literal,answer).correct,true);assert.equal(gradeTyped(literal,answer.split(/[ ,/]/)[0]).correct,false);
 }
 assert.equal(gradeTyped(validateCard({prompt:'word',answer:'tight; ; narrow;'}),' ').correct,false);
});
test('semicolon alternatives retain accent, Unicode, whitespace and ñ rules',()=>{
 const card=validateCard({prompt:'word',answer:'él habló; el niño'});
 assert.equal(gradeTyped(card,'ÉL HABLO\u0301').correct,true);
 assert.equal(gradeTyped(card,'el   niño').correct,true);
 assert.equal(gradeTyped(card,'el hablo').correct,false);
 assert.equal(gradeTyped(card,'el hablo',{strictAccents:false}).correct,true);
 assert.equal(gradeTyped(card,'el nino',{strictAccents:false}).correct,false);
});
test('solo typed answers accept either meaning without changing grade or wallet records',()=>{
 const card=validateCard({prompt:'estrecho',answer:'tight; narrow'}),solo={deck:{cards:[card]},progress:{index:0,known:[],again:[]},strictAccents:true,reverse:false,typedStats:{answered:0,correct:0},assignment:{correct:8},points:90};
 for(const answer of ['tight','narrow']){resetSoloEntry(solo);assert.equal(checkSoloAnswer(solo,answer).correct,true);}
 assert.deepEqual(solo.progress.known,[card.id]);assert.deepEqual(solo.assignment,{correct:8});assert.equal(solo.points,90);assert.equal(solo.typedStats.correct,2);
});
test('typed round reports use the same alternative grading and retain original answer snapshots',()=>{
 const room={pin:'123456',title:'Meanings',mode:'word',status:'playing',players:{student:{id:'student',answered:0}},questions:[{cardId:'meaning_card',text:'estrecho',answers:['tight; narrow','wide'],correct:[0]}]},metrics=createRoundMetrics(room);
 recordCardAnswer(metrics,{playerId:'student',sequence:1,cardIndex:0,typedAnswer:'narrow',correct:true});
 assert.throws(()=>recordCardAnswer(metrics,{playerId:'student',sequence:2,cardIndex:0,typedAnswer:'wide',correct:true}),/differs/);
 const report=roundReport(metrics);assert.equal(report.summary.correct,1);assert.equal(report.cards[0].typedCorrect,1);assert.deepEqual(report.cards[0].answers,['tight; narrow','wide']);assert.deepEqual(report.cards[0].choiceCounts,[0,0]);
});
