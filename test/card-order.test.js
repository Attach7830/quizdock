import test from 'node:test';
import assert from 'node:assert/strict';
import {shuffledOrder,drawShuffledCard} from '../public/js/card-order.js';
import {QuizRoom} from '../src/worker.js';
import {context,Socket} from './memory-runtime.js';
import {roundReport} from '../src/round-metrics.js';

test('shuffled passes visit every eligible card once and avoid an immediate boundary repeat',()=>{
 assert.deepEqual(shuffledOrder(4,-1,()=>0),[1,2,3,0]);
 const indices=[1,4,6,9],original=[...indices];let cycle=null,previous=-1;
 for(let pass=0;pass<5;pass++){
  const seen=[];
  for(let i=0;i<indices.length;i++){
   const saved=structuredClone(cycle),draw=drawShuffledCard(cycle,indices,previous,()=>0);
   assert.deepEqual(cycle,saved);assert.notEqual(draw.index,previous);
   seen.push(draw.index);previous=draw.index;cycle=draw.cycle;
  }
  assert.deepEqual(seen.sort((a,b)=>a-b),indices);
 }
 assert.deepEqual(indices,original);
});
test('a single card remains usable and a changed deck starts a valid fresh pass',()=>{
 let cycle=null;for(let i=0;i<4;i++){const draw=drawShuffledCard(cycle,[7],7);assert.equal(draw.index,7);cycle=draw.cycle;}
 const old=drawShuffledCard(null,[1,4,6],-1,()=>0),next=drawShuffledCard(old.cycle,[10,11],-1,()=>0);
 assert.ok([10,11].includes(next.index));assert.equal(next.cycle.deck,'10,11');assert.throws(()=>drawShuffledCard(null,[]),/at least one/);
});

async function roomFixture(mode){
 const ctx=context(),room=new QuizRoom(ctx,{});await ctx.boot;
 const questions=['uno','dos','tres','cuatro'].map((word,i)=>({cardId:'shuffle_card_'+i,text:'Prompt '+i,answers:[word,'wrong'],correct:[0]}));
 await room.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host',mode,title:'Shuffled',questions})}));
 const host=new Socket();ctx.sockets.push(host);const send=(socket,message)=>room.webSocketMessage(socket,JSON.stringify(message));await send(host,{type:'auth',role:'host',token:'host',protocol:2});const students=[];
 for(let i=0;i<2;i++){
  const joined=await(await room.fetch(new Request('https://room.internal/join',{method:'POST',body:JSON.stringify({name:'Student '+i})}))).json(),socket=new Socket();ctx.sockets.push(socket);await send(socket,{type:'auth',role:'student',token:joined.playerToken,playerId:joined.playerId,protocol:2});students.push({...joined,socket});
 }
 await send(host,{type:'start',mode});return {ctx,room,questions,host,students,send};
}
for(const mode of ['treasure','fishing','battle','factory','rally','keep','word'])test(mode+' shuffles full passes on the real server and keeps reconnects on the active card',async()=>{
 const f=await roomFixture(mode),student=f.students[0],player=f.room.room.players[student.playerId];
 if(mode==='rally'||mode==='keep')await f.send(student.socket,{type:'choose-role',roleType:mode==='rally'?'sprinter':'warden'});
 let previous=-1;
 for(let pass=0;pass<3;pass++){
  const seen=[];
  for(let i=0;i<f.questions.length;i++){
   const index=player.current.index,key=player.current.key;seen.push(index);assert.notEqual(index,previous);
   await f.send(student.socket,{type:'sync'});assert.equal(student.socket.last().me.question.key,key);assert.equal(player.current.index,index);assert.equal(student.socket.last().me.questionCycle,undefined);assert.equal(student.socket.last().me.wordCycle,undefined);
   player.lastAnswerAt=0;await f.send(student.socket,{type:'answer',key,...(mode==='word'?{answer:'not-the-word'}:{choice:player.current.order.indexOf(1)})});
   assert.equal(player.answered,pass*f.questions.length+i+1);assert.equal(player.feedback.correct,false);
   previous=index;await f.send(student.socket,{type:'next'});
  }
  assert.deepEqual(seen.sort((a,b)=>a-b),[0,1,2,3]);
 }
 const report=roundReport(f.room.room.roundMetrics);assert.equal(report.summary.attempts,12);assert.ok(report.cards.every(c=>c.attempts===3&&c.incorrect===3));
 const saved=structuredClone(player.current),restored=new QuizRoom(f.ctx,{});await f.ctx.boot;assert.deepEqual(restored.room.players[player.id].current,saved);
});
test('Sketch Relay shuffles shared word passes independently of the rotating artist',async()=>{
 const f=await roomFixture('sketch'),first=f.room.room.sketch.artistId,artists=[first,f.students.find(s=>s.playerId!==first).playerId];let previous=-1;
 for(let pass=0;pass<3;pass++){
  const seen=[];
  for(let i=0;i<f.questions.length;i++){
   const sketch=f.room.room.sketch;seen.push(sketch.cardIndex);assert.notEqual(sketch.cardIndex,previous);
   assert.equal(sketch.artistId,artists[(sketch.turn-1)%2]);
   await f.send(f.students[0].socket,{type:'sync'});assert.equal(f.room.room.sketch.id,sketch.id);assert.equal(f.students[0].socket.last().sketchCycle,undefined);
   previous=sketch.cardIndex;await f.send(f.host,{type:'sketch-next',wordId:sketch.id});await f.send(f.host,{type:'sketch-next',wordId:sketch.id});
  }
  assert.deepEqual(seen.sort((a,b)=>a-b),[0,1,2,3]);
 }
 assert.equal(roundReport(f.room.room.roundMetrics).summary.attempts,0);
});
