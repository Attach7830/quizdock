import test from 'node:test';
import assert from 'node:assert/strict';
import {QuizRoom} from '../src/worker.js';
import {TeacherLibrary} from '../src/library-service.js';
import {hash} from '../src/library-domain.js';
import {MODES} from '../src/game.js';
import {context,Socket} from './memory-runtime.js';

async function fixture() {
  const libraryCtx=context(), owner=await hash('teacher@example.com');
  const library=new TeacherLibrary(libraryCtx,{TEACHER_EMAILS:'teacher@example.com'});
  let archiveFails=false;
  const env={TEACHER_LIBRARY:{idFromName:n=>n,get:()=>({fetch:(url,init)=>archiveFails?Promise.resolve(Response.json({error:'unavailable'},{status:503})):library.fetch(new Request(url,init))})}};
  const ctx=context(), service=new QuizRoom(ctx,env); await ctx.boot;
  await service.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'teacher-secret',title:'Class review',mode:'treasure',reportOwner:owner,questions:[{cardId:'card_one',text:'hola',answers:['hello','bye'],correct:[0]}]})}));
  const host=new Socket();ctx.sockets.push(host);
  const send=(socket,msg)=>service.webSocketMessage(socket,JSON.stringify(msg));
  await send(host,{type:'auth',protocol:2,role:'host',token:'teacher-secret'});
  const students=[];
  for (const name of ['Student A','Student B']) {
    const response=await service.fetch(new Request('https://room.internal/api/room/123456/join',{method:'POST',body:JSON.stringify({name})}));
    const credentials=await response.json(), socket=new Socket();ctx.sockets.push(socket);
    await send(socket,{type:'auth',protocol:2,role:'student',playerId:credentials.playerId,token:credentials.playerToken});
    students.push({socket,...credentials});
  }
  return {service,ctx,libraryCtx,owner,host,students,send,setFail:value=>{archiveFails=value;}};
}

test('all game-type transitions retain PIN, sockets, player IDs and tokens while resetting scores',async()=>{
  const f=await fixture();let round=0;
  const original=f.students.map(p=>({...p,joinedAt:f.service.room.players[p.playerId].joinedAt}));
  for (const from of MODES) for (const to of MODES) {
    if(f.service.room.status==='playing')await f.send(f.host,{type:'end'});
    await f.send(f.host,{type:'start',mode:from,minutes:3});round++;
    const oldKey=f.service.room.players[f.students[0].playerId].current.key;
    const p=f.service.room.players[f.students[0].playerId];p.score=99;p.coins=70;p.cash=80;p.answered=4;p.correct=3;p.streak=2;p.rodLevel=2;p.machineLevel=3;p.hp=20;p.pendingChests=[{kind:'coins',amount:20}];
    await f.send(f.host,{type:'end'});
    await f.send(f.host,{type:'start',mode:to,minutes:8});round++;
    assert.equal(f.service.room.pin,'123456');assert.equal(f.service.room.mode,to);assert.equal(f.service.room.roundNumber,round);
    assert.equal(f.service.room.durationMinutes,8);assert.equal(f.ctx.sockets.length,3);
    for(const saved of original){
      const now=f.service.room.players[saved.playerId];
      assert.equal(now.token,saved.playerToken);assert.equal(now.name,saved.name);assert.equal(now.joinedAt,saved.joinedAt);
      for(const key of ['score','coins','cash','answered','correct','streak','rodLevel','machineLevel'])assert.equal(now[key],0);
      assert.equal(now.hp,100);assert.equal(now.pendingChests,null);assert.equal(now.feedback,null);
      assert.equal(saved.socket.last().mode,to);assert.equal(saved.socket.last().status,'playing');assert.equal(!!saved.socket.closed,false);
    }
    assert.notEqual(f.service.room.players[f.students[0].playerId].current.key,oldKey);
  }
});

test('archived report keeps the old mode and answers after a game-type change',async()=>{
  const f=await fixture();await f.send(f.host,{type:'start',mode:'battle',minutes:3});
  const p=f.service.room.players[f.students[0].playerId];await f.send(f.students[0].socket,{type:'answer',key:p.current.key,choice:p.current.order.indexOf(1)});
  await f.send(f.host,{type:'end'});const id=f.service.room.roundMetrics.id;
  const stored=await f.libraryCtx.storage.get(`round:${f.owner}:${id}`);
  await f.send(f.host,{type:'start',mode:'fishing',minutes:5});
  assert.equal(stored.mode,'battle');assert.equal(stored.cards[0].incorrect,1);
  assert.deepEqual(await f.libraryCtx.storage.get(`round:${f.owner}:${id}`),stored);
  assert.equal(f.service.room.roundMetrics.mode,'fishing');assert.notEqual(f.service.room.roundMetrics.id,id);
});

test('a delayed answer from the previous round cannot count in the new round',async()=>{
  const f=await fixture();await f.send(f.host,{type:'start',mode:'battle'});
  const oldKey=f.students[0].socket.last().me.question.key;await f.send(f.host,{type:'end'});
  await f.send(f.host,{type:'start',mode:'factory'});
  await f.send(f.students[0].socket,{type:'answer',key:oldKey,choice:0});
  assert.match(f.students[0].socket.last('error').error,/no longer active/);
  assert.equal(f.service.room.players[f.students[0].playerId].answered,0);
});

test('students cannot choose or start the next game',async()=>{
  const f=await fixture();await f.send(f.students[0].socket,{type:'start',mode:'factory'});
  assert.match(f.students[0].socket.last('error').error,/Teacher access/);assert.equal(f.service.room.status,'lobby');
});

test('invalid modes and mid-round changes do not mutate the game',async()=>{
  const f=await fixture();await f.send(f.host,{type:'start',mode:'unknown'});
  assert.match(f.host.last('error').error,/valid game mode/);assert.equal(f.service.room.mode,'treasure');assert.equal(f.service.room.status,'lobby');
  await f.send(f.host,{type:'start',mode:'battle'});const id=f.service.room.roundMetrics.id;
  await f.send(f.host,{type:'start',mode:'factory'});assert.match(f.host.last('error').error,/End the current/);assert.equal(f.service.room.mode,'battle');assert.equal(f.service.room.roundMetrics.id,id);
  await f.send(f.host,{type:'pause'});await f.send(f.host,{type:'start',mode:'factory'});assert.equal(f.service.room.status,'paused');assert.equal(f.service.room.mode,'battle');
});

test('archive failure blocks switching without losing the old mode or scores',async()=>{
  const f=await fixture();await f.send(f.host,{type:'start',mode:'battle'});f.setFail(true);
  const p=f.service.room.players[f.students[0].playerId];p.score=123;await f.send(f.host,{type:'end'});const id=f.service.room.roundMetrics.id;
  await f.send(f.host,{type:'start',mode:'factory'});assert.match(f.host.last('error').error,/still being saved/);
  assert.equal(f.service.room.mode,'battle');assert.equal(f.service.room.roundMetrics.id,id);assert.equal(f.service.room.players[p.id].score,123);
  f.setFail(false);await f.send(f.host,{type:'start',mode:'factory'});assert.equal(f.service.room.mode,'factory');assert.equal(f.service.room.players[p.id].score,0);
});

test('an existing player can reload and reconnect after changing games',async()=>{
  const f=await fixture();await f.send(f.host,{type:'start',mode:'battle'});await f.send(f.host,{type:'end'});await f.send(f.host,{type:'start',mode:'fishing'});
  const s=new Socket();f.ctx.sockets.push(s);const p=f.students[0];await f.send(s,{type:'auth',role:'student',token:p.playerToken,playerId:p.playerId});
  assert.equal(s.last().me.id,p.playerId);assert.equal(s.last().mode,'fishing');assert.equal(s.last().roundNumber,2);assert.equal(Object.keys(f.service.room.players).length,2);
});

test('older clients can replay without a mode field',async()=>{
  const f=await fixture();await f.send(f.host,{type:'start',mode:'factory',minutes:5});const started=f.service.room.startedAt;
  await f.send(f.host,{type:'end'});await f.send(f.host,{type:'start',minutes:3});
  assert.equal(f.service.room.mode,'factory');assert.equal(f.service.room.roundNumber,2);assert.ok(f.service.room.startedAt>started);
});
