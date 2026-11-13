import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQuestions,newPlayer,createQuestion,publicQuestion,grantAnswerReward,
  openChest,upgrade,settleTime,scoreboard
} from '../src/game.js';

const questions=validateQuestions([{text:'¿Cómo se dice hello?',answers:['hola','adiós','gracias'],correct:[0]},{text:'The cat',answers:['el gato','el perro'],correct:[0]}]);
test('validates answer sets and strips unsupported fields',()=>{
  assert.equal(questions.length,2);
  assert.throws(()=>validateQuestions([{text:'?',answers:['same','same'],correct:[0]}]),/duplicate/i);
  assert.throws(()=>validateQuestions([{text:'?',answers:['yes','no'],correct:[4]}]),/invalid/i);
});
test('student questions do not expose the answer key',()=>{
  const state=createQuestion(questions,0);
  const pub=publicQuestion(questions[0],state);
  assert.equal(pub.options.length,3);
  assert.equal(JSON.stringify(pub).includes('correct'),false);
});
test('treasure rewards open once and can never overdraft',()=>{
  const p=newPlayer('a','secret','Ana',questions);
  const other=newPlayer('b','secret2','Ben',questions);
  other.coins=1;
  const room={mode:'treasure',players:{a:p,b:other}};
  grantAnswerReward(room,p);
  assert.ok(p.pendingChests);
  openChest(room,p,0);
  assert.equal(p.pendingChests,null);
  assert.ok(p.coins>=0);
  assert.ok(other.coins>=0);
  assert.throws(()=>openChest(room,p,0),/Choose/);
});
test('fishing upgrades use points and improve rod level',()=>{
  const p=newPlayer('a','secret','Ana',questions);
  const room={mode:'fishing',players:{a:p}};
  for(let i=0;i<10;i++)grantAnswerReward(room,p);
  assert.ok(p.score>=100);
  const old=p.score;
  upgrade(room,p);
  assert.equal(p.rodLevel,1);
  assert.equal(p.score,old-100);
});
test('factory passive income advances in discrete 5-second ticks',()=>{
  const p=newPlayer('a','secret','Ana',questions);
  const room={mode:'factory',players:{a:p},status:'playing',endsAt:40_000,lastPassiveAt:10_000};
  p.cash=120;upgrade(room,p);
  assert.equal(p.machineLevel,1);
  assert.equal(p.cash,0);
  assert.equal(settleTime(room,21_000),true);
  assert.equal(p.cash,16);
  assert.equal(room.lastPassiveAt,20_000);
  assert.equal(settleTime(room,22_000),false);
  assert.equal(p.cash,16);
});
test('battle damage and leaderboard scores update',()=>{
  const p=newPlayer('a','secret','Ana',questions);
  const other=newPlayer('b','secret2','Ben',questions);
  const room={mode:'battle',players:{a:p,b:other}};
  const reward=grantAnswerReward(room,p);
  assert.match(reward.text,/hit Ben/);
  assert.equal(other.hp,80);
  assert.equal(scoreboard(room.players,'battle')[0].id,'a');
});
