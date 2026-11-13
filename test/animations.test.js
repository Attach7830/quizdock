import test from 'node:test';
import assert from 'node:assert/strict';
import { animationEvents } from '../public/js/animations.js';

function state(mode = 'treasure') {
  return { pin: '123456', mode, status: 'playing', startedAt: 100, players: [], me: {
    id: 'student', answered: 0, correct: 0, coins: 0, cash: 0, score: 0,
    hp: 100, rodLevel: 0, machineLevel: 0, feedback: null, pendingChests: false,
    question: { key: 'one' }
  } };
}
const types = (a,b) => animationEvents(a,b).map(e=>e.type);

test('initial connection and unchanged snapshots never replay rewards', () => {
  const s = state();
  assert.deepEqual(animationEvents(null, s), []);
  assert.deepEqual(animationEvents(s, structuredClone(s)), []);
  assert.deepEqual(animationEvents(s, null), []);
});
test('another student answering does not trigger my animations', () => {
  const a = state(), b = structuredClone(a);
  b.players = [{ id: 'someone-else', score: 50 }];
  assert.deepEqual(animationEvents(a,b), []);
});
test('treasure waits for the server to confirm a chest before awarding coins', () => {
  const a=state(), b=structuredClone(a);
  b.me.answered=1; b.me.feedback={correct:true,reward:'Choose a mystery chest!'}; b.me.pendingChests=true;
  assert.deepEqual(types(a,b),['correct']);
  const c=structuredClone(b); c.me.pendingChests=false; c.me.coins=35; c.me.feedback.reward='+35 coins';
  assert.deepEqual(animationEvents(b,c),[{type:'chest'},{type:'score',delta:35}]);
  assert.deepEqual(animationEvents(c,structuredClone(c)),[]);
});
test('fishing correct answer triggers catch and exact score change', () => {
  const a=state('fishing'), b=structuredClone(a);
  b.me.answered=1; b.me.score=42; b.me.feedback={correct:true};
  assert.deepEqual(animationEvents(a,b),[{type:'correct'},{type:'score',delta:42}]);
});
test('incorrect answers do not trigger rewards', () => {
  const a=state('battle'), b=structuredClone(a);
  b.me.answered=1; b.me.hp=95; b.me.feedback={correct:false};
  assert.deepEqual(types(a,b),['incorrect']);
});
test('incoming battle hits include respawns without inventing points', () => {
  const a=state('battle'), b=structuredClone(a); b.me.hp=80;
  assert.deepEqual(types(a,b),['hit']);
  a.me.hp=20; b.me.hp=100;
  assert.deepEqual(types(a,b),['hit']);
});
test('purchased upgrades show a debit, not a reward', () => {
  for (const mode of ['fishing','factory']) {
    const a=state(mode), b=structuredClone(a);
    a.me.score=a.me.cash=200;
    b.me.score=b.me.cash=80;
    b.me[mode==='fishing'?'rodLevel':'machineLevel']=1;
    assert.deepEqual(animationEvents(a,b),[{type:'upgrade'},{type:'score',delta:-120}]);
  }
});
test('passive factory income displays the authoritative delta only', () => {
  const a=state('factory'), b=structuredClone(a); b.me.cash=24;
  assert.deepEqual(animationEvents(a,b),[{type:'score',delta:24}]);
});
test('coins lost to another player are a negative delta', () => {
  const a=state(), b=structuredClone(a); a.me.coins=80; b.me.coins=55;
  assert.deepEqual(animationEvents(a,b),[{type:'score',delta:-25}]);
});
test('new questions animate once even if their text repeats', () => {
  const a=state(), b=structuredClone(a); b.me.question.key='two';
  assert.deepEqual(types(a,b),['question']);
  assert.deepEqual(types(b,structuredClone(b)),[]);
});
test('pause and resume do not replay completed answers', () => {
  const a=state('fishing'); a.me.answered=1; a.me.feedback={correct:true}; a.me.score=42;
  const b=structuredClone(a); b.status='paused';b.me.question=null;
  assert.deepEqual(types(a,b),[]);
  assert.deepEqual(types(b,a),[]);
});
test('new rounds reset animation history without false losses', () => {
  const a=state(), b=state(); a.status='finished';a.me.coins=500;b.startedAt=200;
  assert.deepEqual(types(a,b),['start']);
});
test('unrelated rooms and modes do not share animation history', () => {
  const a=state(), b=state(); b.pin='654321'; b.me.coins=200;
  assert.deepEqual(types(a,b),[]);
  b.pin=a.pin;b.mode='factory';
  assert.deepEqual(types(a,b),[]);
});
test('finish event is emitted once; missing student data is safe', () => {
  const a=state(), b=structuredClone(a);b.status='finished';
  assert.deepEqual(types(a,b),['finish']);
  assert.deepEqual(types(b,structuredClone(b)),[]);
  delete a.me;delete b.me;b.status='playing';
  assert.deepEqual(types(a,b),[]);
});
