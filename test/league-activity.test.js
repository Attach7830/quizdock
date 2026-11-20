import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,clock} from './study-fixture.js';
import {uid} from '../src/library-domain.js';
import {startLeagueGame,captureLeagueGame,leagueGamePacket,leagueAction,recordLeagueGame} from '../src/league-game.js';
import {weekStart,dateTimeInZone} from '../src/academy-model.js';
import {internal,context,namespace,Socket} from './memory-runtime.js';
import {QuizRoom} from '../src/worker.js';
import gateway from '../src/library-worker.js';

test('reviewing either flashcard result earns XP exactly once, without candy, grading or client-total awards',()=>clock(async({advance})=>{
 const f=await fixture(),s=f.students[0],deck=(await f.call('solo-open',{classId:f.course.id,listId:f.listId},s.token)).body.deck,base={classId:f.course.id,listId:f.listId,cardId:deck.cards[0].id};
 for(const mark of ['again','known']){advance(600);const p={...base,mark,mutationId:uid()};assert.equal((await f.call('solo-review',p,s.token)).status,200);assert.equal((await f.call('solo-review',p,s.token)).body.duplicate,true);assert.equal((await f.call('solo-review',{...p,mark:mark==='again'?'known':'again'},s.token)).status,409);}
 assert.equal((await f.view()).me.xp,4);assert.equal((await f.view()).me.correct,0);assert.equal((await f.call('home',{},s.token)).body.studyRewards[0].completed,0);assert.equal((await f.ctx.storage.get('account:'+s.userId)).points,190);
 assert.equal((await f.call('solo-review',{...base,mark:'known',mutationId:uid()},s.token)).status,429);advance(600);
 assert.equal((await f.call('solo-review',{...base,cardId:uid(),mark:'known',mutationId:uid()},s.token)).status,400);
 await f.call('solo-save',{...base,index:3,known:deck.cards.map(c=>c.id),xp:999999},s.token);assert.equal((await f.view()).me.xp,4);
}));
function round(f){const p={id:'player_1',accountId:f.students[0].userId,answered:0,correct:0},room={players:{player_1:p},classId:f.course.id,reportOwner:f.owner,leagueTimezone:f.course.timezone,startedAt:Date.now(),roundMetrics:{id:uid(),revision:1}};startLeagueGame(room);return {room,p,report:()=>({id:room.roundMetrics.id,startedAt:room.startedAt})};}
test('answer, event and milestone counters bank progressively and ignore replayed or older packets',()=>clock(async({advance})=>{
 const f=await fixture(),{room,p,report}=round(f);advance(1000);p.answered=2;p.correct=1;leagueAction(p);p.eventProgress={sequence:1};p.expedition={stats:{discoveries:1,quests:1}};assert.equal(captureLeagueGame(room),true);const packet=leagueGamePacket(room);await recordLeagueGame(f.ctx.storage,packet,f.owner,report());assert.equal((await f.view()).me.xp,38);await recordLeagueGame(f.ctx.storage,packet,f.owner,report());assert.equal((await f.view()).me.xp,38);
 advance(15000);p.answered++;p.correct++;captureLeagueGame(room);await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());await recordLeagueGame(f.ctx.storage,packet,f.owner,report());assert.equal((await f.view()).me.xp,48);assert.equal(captureLeagueGame(room),false);assert.equal((await f.ctx.storage.get('account:'+p.accountId)).points,190);
}));
test('Sunday activity cannot spill into Monday when a packet is delayed, while fresh Monday events count',()=>clock(async({set,advance})=>{
 const f=await fixture();set(dateTimeInZone('2026-11-22T23:59',f.course.timezone));const {room,p,report}=round(f);p.answered=1;p.correct=1;captureLeagueGame(room);const sunday=leagueGamePacket(room),old=weekStart(Date.now(),f.course.timezone);await recordLeagueGame(f.ctx.storage,sunday,f.owner,report());assert.equal((await f.view()).me.xp,10);
 advance(61000);p.answered++;p.correct++;leagueAction(p);captureLeagueGame(room);await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());const v=await f.view();assert.notEqual(v.week,old);assert.equal(v.me.xp,13);assert.equal(v.me.history[0].xp,10);await recordLeagueGame(f.ctx.storage,sunday,f.owner,report());assert.equal((await f.view()).me.xp,13);
}));
test('paused leagues consume event receipts without backpay; erased accounts and deleted rounds cannot recreate XP',()=>clock(async({advance})=>{
 const f=await fixture(),{room,p,report}=round(f);p.answered=1;p.correct=1;captureLeagueGame(room);f.course.leagues={enabled:false};await f.ctx.storage.put('class:'+f.course.id,f.course);await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());assert.equal((await f.view()).me.xp,0);f.course.leagues.enabled=true;await f.ctx.storage.put('class:'+f.course.id,f.course);await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());assert.equal((await f.view()).me.xp,0);
 advance(1000);p.answered++;p.correct++;captureLeagueGame(room);await f.ctx.storage.put(`data:erased-member:${f.course.id}:${p.accountId}`,{at:Date.now()});await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());assert.equal((await f.view()).me.xp,0);await f.ctx.storage.delete(`data:erased-member:${f.course.id}:${p.accountId}`);await f.ctx.storage.put(`round-deleted:${f.owner}:${report().id}`,true);await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());assert.equal((await f.view()).me.xp,0);
}));
test('incremental game receipts export privately, erase with class data and cannot restore from an old backup',()=>clock(async()=>{
 const f=await fixture(),{room,p,report}=round(f);p.answered=1;p.correct=1;captureLeagueGame(room);const packet=leagueGamePacket(room);await recordLeagueGame(f.ctx.storage,packet,f.owner,report());
 const key=`league-game:${f.course.id}:${p.accountId}:${report().id}`,data=async(action,payload={},token=f.teacher)=>{const r=await f.library.fetch(internal('data:'+action,payload,token));assert.equal(r.status,200);return r.json();};
 const bundle=await data('backup',{classId:f.course.id});assert.ok(bundle.payload.records.some(([k])=>k===key));assert.ok((await data('personal-export',{},f.students[0].token)).records.some(([k])=>k===key));assert.ok(!(await data('personal-export',{},f.students[1].token)).records.some(([k])=>k===key));
 await data('delete-student',{classId:f.course.id,userId:p.accountId,confirm:f.students[0].email});assert.equal(await f.ctx.storage.get(key),undefined);await recordLeagueGame(f.ctx.storage,packet,f.owner,report());assert.equal(await f.ctx.storage.get(key),undefined);assert.ok((await data('restore-preview',{bundle})).preview.privacyBlocked>0);
}));
test('retention expires old game activity receipts without reversing retained account points',()=>clock(async({advance})=>{
 const f=await fixture(),{room,p,report}=round(f);p.answered=1;p.correct=1;captureLeagueGame(room);await recordLeagueGame(f.ctx.storage,leagueGamePacket(room),f.owner,report());advance(31*86400000);
 const r=await f.library.fetch(internal('data:retention-run',{days:30,confirm:'DELETE EXPIRED RECORDS'},f.teacher));assert.equal(r.status,200);assert.equal((await f.ctx.storage.list({prefix:'league-game:'+f.course.id+':'})).size,0);assert.equal((await f.ctx.storage.get('account:'+p.accountId)).points,190);
}));
for(const mode of ['treasure','fishing','battle','factory','rally','keep','word'])test(mode+': a real class room banks activity before finish and a final archive cannot award it twice',()=>clock(async({advance})=>{
 const f=await fixture(),ctx=context(),r=new QuizRoom(ctx,{TEACHER_LIBRARY:namespace(f.library)});await ctx.boot;
 const init={pin:'877155',hostToken:'host_token',mode,title:'Class game',questions:[{text:'Question',answers:['casa','perro'],correct:[0]}],settings:{minutes:10,engagement:true},classId:f.course.id,reportOwner:f.owner,leagueTimezone:f.course.timezone};
 assert.equal((await r.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify(init)}))).status,200);
 const join=await(await r.fetch(new Request('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity:{accountId:f.students[0].userId,name:'Student',skin:'mint'}})}))).json(),host=new Socket(),student=new Socket();host.serializeAttachment({role:'host',protocol:2});student.serializeAttachment({role:'student',playerId:join.playerId,protocol:2});ctx.sockets.push(host,student);
 const send=async(ws,msg)=>{await r.webSocketMessage(ws,JSON.stringify({...msg,roundNumber:r.room.roundNumber}));assert.equal(ws.last('error'),undefined,JSON.stringify(ws.last('error')));};
 await send(host,{type:'start',settings:{minutes:10,engagement:true}});advance(16000);const p=r.room.players[join.playerId];if(mode==='rally'||mode==='keep')await send(student,{type:'choose-role',roleType:mode==='rally'?'sprinter':'warden'});
 await send(student,{type:'answer',key:p.current.key,...(mode==='word'?{answer:'casa'}:{choice:p.current.order.indexOf(0)})});const during=(await f.view()).me.xp;assert.ok(during>=10,mode+' activity saved during game');assert.equal(r.room.status,'playing');const packet=leagueGamePacket(r.room);assert.equal(JSON.stringify(student.last()).includes('league-game'),false);
 await send(host,{type:'end'});const finished=(await f.view()).me.xp;assert.ok(finished>=during);await r.publishReport(true);await recordLeagueGame(f.ctx.storage,packet,f.owner,{id:packet.roundId,startedAt:packet.startedAt});assert.equal((await f.view()).me.xp,finished);
}));
test('Sketch Relay credits artists once per drawing word and credits real guesses without per-stroke farming',()=>clock(async({advance})=>{
 const f=await fixture(),ctx=context(),r=new QuizRoom(ctx,{TEACHER_LIBRARY:namespace(f.library)});await ctx.boot;await r.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'877155',hostToken:'host',mode:'sketch',title:'Draw',questions:[{text:'Home',answers:['casa','perro'],correct:[0]}],classId:f.course.id,reportOwner:f.owner,leagueTimezone:f.course.timezone})}));const host=new Socket();host.serializeAttachment({role:'host',protocol:2});ctx.sockets.push(host);const players=[];
 for(const s of f.students.slice(0,2)){const join=await(await r.fetch(new Request('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity:{accountId:s.userId,name:s.email}})}))).json(),socket=new Socket();socket.serializeAttachment({role:'student',playerId:join.playerId,protocol:2});ctx.sockets.push(socket);players.push({socket,playerId:join.playerId,user:s});}
 const send=(socket,msg)=>r.webSocketMessage(socket,JSON.stringify({roundNumber:r.room.roundNumber,...msg}));await send(host,{type:'start',settings:{minutes:10,engagement:true}});advance(16000);const artist=players.find(s=>s.playerId===r.room.sketch.artistId),guesser=players.find(s=>s!==artist),sketch=r.room.sketch;
 const stroke={type:'sketch-stroke',wordId:sketch.id,clearEpoch:sketch.clearEpoch,id:uid(),color:'#18344d',size:12,points:[[10,20],[400,300]]};await send(artist.socket,stroke);assert.equal(artist.socket.last('error'),undefined);assert.equal((await f.view(artist.user)).me.xp,3);await send(artist.socket,stroke);advance(1000);await send(artist.socket,{...stroke,id:uid(),points:[[20,30],[200,300]]});await r.publishReport(true);assert.equal((await f.view(artist.user)).me.xp,3);
 await send(guesser.socket,{type:'sketch-guess',wordId:sketch.id,answer:'wrong',id:uid()});await r.publishReport(true);assert.equal((await f.view(guesser.user)).me.xp,2);advance(1000);await send(guesser.socket,{type:'sketch-guess',wordId:sketch.id,answer:'casa',id:uid()});await r.publishReport(true);assert.ok((await f.view(guesser.user)).me.xp>=12);assert.equal(r.room.players[artist.playerId].answered,0);
}));
