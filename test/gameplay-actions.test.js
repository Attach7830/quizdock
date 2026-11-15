import test from 'node:test';
import assert from 'node:assert/strict';
import {QuizRoom} from '../src/worker.js';
import {context,Socket} from './memory-runtime.js';
async function fixture(mode='battle'){
 const ctx=context(),service=new QuizRoom(ctx,{});await service.boot;
 await service.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host',mode,title:'Game actions',questions:[{cardId:'card_one',text:'Q',answers:['A','B'],correct:[0]}]})}));
 const host=new Socket();ctx.sockets.push(host);const send=(s,m)=>service.webSocketMessage(s,JSON.stringify(m));await send(host,{type:'auth',role:'host',token:'host'});
 const students=[];for(const name of ['Alpha','Bravo']){const joined=await(await service.fetch(new Request('https://room.internal/api/room/123456/join',{method:'POST',body:JSON.stringify({name})}))).json(),socket=new Socket();ctx.sockets.push(socket);await send(socket,{type:'auth',role:'student',token:joined.playerToken,playerId:joined.playerId});students.push({...joined,socket});}
 await send(host,{type:'start',mode});if(['keep','rally'].includes(mode))for(const s of students)await send(s.socket,{type:'choose-role',roleType:mode==='keep'?'warden':'ace'});
 return {ctx,service,host,students,send};
}
async function answer(f,student=f.students[0],correct=true){const p=f.service.room.players[student.playerId];p.lastAnswerAt=0;await f.send(student.socket,{type:'answer',key:p.current.key,choice:p.current.order.indexOf(correct?0:1),roundNumber:f.service.room.roundNumber});return p;}
test('real WebSocket moves are authenticated, idempotent and independent of report attempts',async()=>{
 const f=await fixture(),s=f.students[0],p=await answer(f),id=p.pendingPlay.id,metrics=structuredClone(f.service.room.roundMetrics);await f.send(s.socket,{type:'play',id,choice:'charge'});assert.equal(p.adventure.charge,1);assert.deepEqual(f.service.room.roundMetrics,metrics);
 await f.send(s.socket,{type:'play',id,choice:'charge'});assert.equal(p.adventure.charge,1);assert.deepEqual(f.service.room.roundMetrics,metrics);
 await f.send(f.host,{type:'play',id,choice:'charge'});assert.match(f.host.last('error').error,/Student access/);
 await f.send(s.socket,{type:'next'});const key=p.current.key;await f.send(s.socket,{type:'play',id,choice:'guard'});assert.equal(p.current.key,key);assert.equal(p.correct,1);assert.equal(p.answered,1);
});
test('pause/end/round guards preserve a pending decision and reconnect restores it without rerolling',async()=>{
 const f=await fixture('factory'),s=f.students[0],p=await answer(f),pending=structuredClone(p.pendingPlay),replacement=new Socket();f.ctx.sockets.push(replacement);await f.send(replacement,{type:'auth',role:'student',playerId:s.playerId,token:s.playerToken});assert.equal(replacement.last().me.play.id,pending.id);
 await f.send(f.host,{type:'pause'});await f.send(replacement,{type:'play',id:pending.id,choice:'continue'});assert.match(replacement.last('error').error,/not active/);assert.deepEqual(p.pendingPlay,pending);
 await f.send(f.host,{type:'resume'});await f.send(replacement,{type:'next'});assert.equal(p.pendingPlay,null);assert.equal(p.adventure.assetValue,0);assert.equal(p.answered,1);
 await f.send(f.host,{type:'end'});await f.send(replacement,{type:'play',id:pending.id,choice:'continue'});assert.match(replacement.last('error').error,/not active/);await f.send(f.host,{type:'start',mode:'factory'});await f.send(replacement,{type:'play',id:pending.id,choice:'continue',roundNumber:1});assert.match(replacement.last('error').error,/new round/);assert.equal(f.service.room.players[s.playerId].adventure.orders,0);
});
test('an outcome failure rolls back in place without accepting or losing a grade',async()=>{
 const f=await fixture('fishing'),s=f.students[0],p=f.service.room.players[s.playerId],key=p.current.key;p.adventure.water='invalid';await answer(f);assert.equal(f.service.room.players[s.playerId],p);assert.equal(p.answered,0);assert.equal(p.correct,0);assert.equal(f.service.room.roundMetrics.cards[0].correct,0);assert.equal(p.current.key,key);p.adventure.water='reef';await answer(f);assert.equal(p.correct,1);assert.equal(f.service.room.roundMetrics.cards[0].correct,1);
});
test('wrong answers cannot manufacture choices and snapshots do not expose hidden chests or private identity',async()=>{
 const f=await fixture('treasure'),s=f.students[0],p=await answer(f);const snapshot=s.socket.last();assert.equal(snapshot.me.pendingChests,true);assert.equal(JSON.stringify(snapshot).includes('roll'),false);assert.equal(JSON.stringify(snapshot).includes('token'),false);await f.send(s.socket,{type:'chest',index:0});await f.send(s.socket,{type:'next'});await answer(f,s,false);const before=p.coins;await f.send(s.socket,{type:'play',id:'forged',choice:'jackpot'});assert.equal(p.coins,before);assert.equal(p.answered,2);assert.equal(p.correct,1);
});
test('privacy erasure clears new game receipts and account-linked adventure state',async()=>{
 const f=await fixture(),s=f.students[0],p=await answer(f),other=f.service.room.players[f.students[1].playerId];other.accountId='erased-account';other.email='erase@example.com';await f.send(s.socket,{type:'play',id:p.pendingPlay.id,choice:'strike'});assert.ok(p.lastPlay.text.includes(other.name));
 const response=await f.service.fetch(new Request('https://room.internal/privacy-purge',{method:'POST',body:JSON.stringify({createdAt:f.service.room.createdAt,accountId:'erased-account'})}));assert.equal(response.status,200);assert.equal(p.lastPlay,null);assert.equal(p.feedback.game,undefined);assert.equal(other.adventure,null);assert.equal(other.email,null);
});
