import test from 'node:test';
import assert from 'node:assert/strict';
import {playerPhase,playerViewKey} from '../public/js/player-flow.js';
import {PLANES,planeMarkup,planeByRole} from '../public/js/planes.js';
import {PLAYER_TYPES} from '../public/js/catalog.js';
import {CHIP_TUNES,chipFrame} from '../public/js/chip-score.js';
import {checkSoloAnswer,resetSoloEntry} from '../public/js/solo-typing.js';
import {validateCard} from '../public/js/list-model.js';
const room=()=>({pin:'123456',mode:'treasure',status:'playing',roundNumber:1,startedAt:123,me:{answered:0,feedback:null,question:{key:'q1'}}});
test('player phases separate questions, role selection, authoritative results, pause and final-answer results',()=>{
 const s=room();assert.equal(playerPhase(s),'question');const key=playerViewKey(s);s.me.coins=42;assert.equal(playerViewKey(s),key);
 s.me.feedback={correct:false};s.me.answered=1;assert.equal(playerPhase(s),'result');const resultKey=playerViewKey(s);assert.notEqual(resultKey,key);
 s.me.pendingChests=true;assert.equal(playerViewKey(s),resultKey);s.status='finished';s.me.question=null;assert.equal(playerPhase(s),'result');
 s.status='paused';assert.equal(playerPhase(s),'paused');s.status='playing';s.me.feedback=null;s.mode='rally';assert.equal(playerPhase(s),'roles');
 s.me.roleType='ace';assert.equal(playerPhase(s),'question');s.roundNumber++;assert.notEqual(playerViewKey(s),key);
});
test('each existing Rally role maps to distinct aircraft art, with original role tradeoffs unchanged',()=>{
 assert.deepEqual(Object.keys(PLANES),PLAYER_TYPES.rally.map(r=>r.id));assert.equal(new Set(Object.values(PLANES).map(p=>p.name)).size,3);
 assert.equal(new Set(Object.keys(PLANES).map(planeMarkup)).size,3);assert.deepEqual(PLAYER_TYPES.rally.map(r=>[r.gain,r.penalty]),[[32,14],[20,2],[22,8]]);
 assert.equal(planeByRole('unknown'),PLANES.sprinter);
});
test('every RPG composition has a full 16-bar phrase, changing harmony, sustained notes and layered percussion',()=>{
 for(const score of Object.values(CHIP_TUNES)){
  assert.equal(score.lead.length,128);assert.equal(score.chords.length,16);assert.ok(score.lead.includes(-1));
  assert.ok(new Set(score.chords.map(c=>c.join(','))).size>=4);
  const events=Array.from({length:256},(_,i)=>chipFrame(score,i)).flat();
  assert.deepEqual([...new Set(events.map(e=>e.voice))].sort(),['arp','bass','harmony','hat','kick','lead','snare']);
  assert.ok(events.every(e=>Number.isFinite(e.duration)&&e.duration>0&&Number.isFinite(e.note)&&e.level>0&&e.level<1));
  assert.deepEqual(chipFrame(score,256),chipFrame(score,0));
 }
});
function solo(card=validateCard({prompt:'He spoke yesterday.',answer:'habló',alternatives:['él habló']})){
 return {deck:{cards:[card]},progress:{index:0,known:[],again:[]},strictAccents:true,reverse:false,typedFeedback:null,typedStats:{answered:0,correct:0}};
}
test('solo typing checks accents and alternatives and persists only confidence, without changing assignment or wallet data',()=>{
 const s=solo();s.assignment={correct:8,answered:10};s.points=90;
 assert.equal(checkSoloAnswer(s,'hablo').correct,false);assert.deepEqual(s.progress.again,[s.deck.cards[0].id]);
 checkSoloAnswer(s,'habló');assert.equal(s.typedStats.answered,1);resetSoloEntry(s);
 assert.equal(checkSoloAnswer(s,' ÉL HABLÓ ').correct,true);assert.deepEqual(s.progress.known,[s.deck.cards[0].id]);assert.equal(s.progress.again.length,0);
 assert.deepEqual(s.assignment,{correct:8,answered:10});assert.equal(s.points,90);assert.equal(s.typedStats.answered,2);
 resetSoloEntry(s);s.strictAccents=false;assert.equal(checkSoloAnswer(s,'hablo').correct,true);
});
test('solo typing accepts choice-card alternatives, supports reverse prompts, rejects empty answers and preserves ñ',()=>{
 const s=solo(validateCard({type:'choice',prompt:'Choose a greeting',choices:['hola','buenos días','adiós'],correct:[0,1]}));
 assert.throws(()=>checkSoloAnswer(s,'  '),/Type/);assert.equal(checkSoloAnswer(s,'buenos días').correct,true);
 resetSoloEntry(s);s.reverse=true;assert.equal(checkSoloAnswer(s,'choose A greeting').correct,true);
 const spanish=solo(validateCard({prompt:'year',answer:'año'}));spanish.strictAccents=false;assert.equal(checkSoloAnswer(spanish,'ano').correct,false);
});
