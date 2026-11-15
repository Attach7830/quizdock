import test from 'node:test';
import assert from 'node:assert/strict';
import {QuizRoom} from '../src/worker.js';
import {context,Socket} from './memory-runtime.js';
import {roundReport} from '../src/round-metrics.js';
import {validateReport} from '../src/round-repository.js';
import {validateWordDeck,gradeWord,tickSketch,appendSketchStroke,MAX_DRAW_POINTS} from '../src/word-games.js';
async function fixture(mode='word',count=2){
 const ctx=context(),service=new QuizRoom(ctx,{});await ctx.boot;
 await service.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host',mode,title:'Vocabulary',questions:[{cardId:'card_one',text:'He spoke yesterday.',answers:['habló','él habló','incorrecto'],correct:[0,1]}]})}));
 const host=new Socket();ctx.sockets.push(host);const send=(s,m)=>service.webSocketMessage(s,JSON.stringify(m.type==='sketch-guess'&&!m.id?{...m,id:crypto.randomUUID()}:m));await send(host,{type:'auth',role:'host',protocol:2,token:'host'});const students=[];
 for(let i=0;i<count;i++){const joined=await(await service.fetch(new Request('https://room.internal/api/room/123456/join',{method:'POST',body:JSON.stringify({name:'Student '+i})}))).json(),socket=new Socket();ctx.sockets.push(socket);await send(socket,{type:'auth',protocol:2,role:'student',token:joined.playerToken,playerId:joined.playerId});students.push({...joined,socket});}
 await send(host,{type:'start',mode});return {ctx,service,host,students,send};
}
const state=(f,s)=>f.service.room.players[s.playerId];
function role(f,artist){return f.students.find(s=>(s.playerId===f.service.room.sketch.artistId)===artist);}
function stroke(f,id='stroke_one'){const s=f.service.room.sketch;return {type:'sketch-stroke',wordId:s.id,roundNumber:f.service.room.roundNumber,clearEpoch:s.clearEpoch,id,color:'#18344d',size:12,points:[[10,20],[400,300],[800,500]]};}
test('Word Forge validates accents and alternatives without sending answer choices',async()=>{
 const f=await fixture(),s=f.students[0],p=state(f,s),q=s.socket.last().me.question;assert.equal(q.input,'word');assert.equal(q.options,undefined);assert.equal(JSON.stringify(q).includes('habló'),false);assert.equal(q.slots.length,5);
 await f.send(s.socket,{type:'word-letter',key:q.key,letter:'O'});assert.equal(p.wordPuzzle.misses,1);await f.send(s.socket,{type:'word-letter',key:q.key,letter:'Ó'});await f.send(s.socket,{type:'word-letter',key:q.key,letter:'Ó'});assert.equal(p.wordPuzzle.guesses.length,2);assert.equal(p.answered,0);assert.equal(roundReport(f.service.room.roundMetrics).summary.attempts,0);
 await f.send(s.socket,{type:'answer',key:q.key,answer:'hablo'});assert.equal(p.correct,0);assert.equal(p.answered,1);let report=validateReport(roundReport(f.service.room.roundMetrics));assert.equal(report.cards[0].typedIncorrect,1);assert.equal(report.cards[0].hintedAttempts,1);assert.deepEqual(report.cards[0].choiceCounts,[0,0,0]);
 await f.send(s.socket,{type:'next'});p.lastAnswerAt=0;await f.send(s.socket,{type:'answer',key:p.current.key,answer:'ÉL HABLÓ'});assert.equal(p.correct,1);assert.equal(p.answered,2);report=validateReport(roundReport(f.service.room.roundMetrics));assert.equal(report.cards[0].typedCorrect,1);assert.equal(report.cards[0].attempts,2);assert.deepEqual(report.cards[0].choiceCounts,[0,0,0]);
});
test('Word Forge late join and reconnect preserve the active puzzle and reject stale letter actions',async()=>{
 const f=await fixture(),joined=await(await f.service.fetch(new Request('https://room.internal/join',{method:'POST',body:JSON.stringify({name:'Late student'})}))).json(),socket=new Socket();f.ctx.sockets.push(socket);await f.send(socket,{type:'auth',protocol:2,role:'student',playerId:joined.playerId,token:joined.playerToken});let q=socket.last().me.question;await f.send(socket,{type:'word-letter',key:q.key,letter:'H'});assert.equal(socket.last().me.question.guesses[0],'h');const saved=structuredClone(socket.last().me.question);await f.send(socket,{type:'sync'});assert.deepEqual(socket.last().me.question,saved);await f.send(socket,{type:'word-letter',key:'stale',letter:'A'});assert.match(socket.last('error').error,/no longer active/);assert.equal(state(f,joined).answered,0);
});
test('old clients get a refresh instruction for new input modes instead of a malformed question',async()=>{
 const f=await fixture(),s=f.students[0],old=new Socket();f.ctx.sockets.push(old);await f.send(old,{type:'auth',role:'student',playerId:s.playerId,token:s.playerToken});assert.equal(old.last('error').refreshRequired,true);assert.match(old.last('error').error,/Refresh QuizDock/);
});
test('word eligibility and Unicode grading remain server-owned',()=>{
 assert.throws(()=>validateWordDeck([{answers:['x'.repeat(41)],correct:[0]}]),/at most 40/);assert.deepEqual(validateWordDeck([{answers:['123'],correct:[0]},{answers:['niño'],correct:[0]}]),[1]);const q={answers:['niño','el niño'],correct:[0,1]};assert.equal(gradeWord(q,'NIÑO').correct,true);assert.equal(gradeWord(q,'nin\u0303o').correct,true);assert.equal(gradeWord(q,'nino').correct,false);assert.throws(()=>gradeWord(q,''),/Type a word/);
});
test('Sketch Relay privately assigns an artist and persists bounded delta strokes without grading them',async()=>{
 const f=await fixture('sketch'),a=role(f,true),g=role(f,false),r=f.service.room;assert.equal(a.socket.last().sketch.word,'habló');assert.equal(g.socket.last().sketch.word,undefined);assert.equal(g.socket.last().me.question,null);assert.equal(JSON.stringify(g.socket.last()).includes('habló'),false);assert.equal(f.host.last().sketch.word,'habló');
 const msg=stroke(f);await f.send(a.socket,msg);assert.equal(r.sketch.strokes.length,1);assert.equal((await f.ctx.storage.get('room')).sketch.strokes.length,1);assert.deepEqual(g.socket.last('sketch-stroke').stroke.points,msg.points);assert.equal(g.socket.last('sketch-stroke').word,undefined);await f.send(a.socket,msg);assert.equal(r.sketch.strokes.length,1);assert.equal(r.sketch.revision,1);assert.equal(roundReport(r.roundMetrics).summary.attempts,0);
 await f.send(g.socket,{...stroke(f,'forged_stroke')});assert.match(g.socket.last('error').error,/current artist/);assert.equal(r.sketch.strokes.length,1);assert.equal(f.service.snapshotFor(g.socket.deserializeAttachment()).sketch.strokes,undefined);await f.send(g.socket,{type:'sync'});assert.equal(g.socket.last().sketch.strokes.length,1);
});
test('wrong drawing guesses hide the word, clues are ungraded, and correct guesses rotate the artist',async()=>{
 const f=await fixture('sketch'),a=role(f,true),g=role(f,false),p=state(f,g),r=f.service.room,id=r.sketch.id;await f.send(g.socket,{type:'sketch-guess',wordId:id,answer:'wrong'});assert.equal(p.answered,1);assert.equal(p.correct,0);assert.deepEqual(p.feedback.correctAnswers,[]);assert.equal(g.socket.last().sketch.word,undefined);
 r.sketch.nextHintAt=Date.now()-1;await f.send(g.socket,{type:'ping'});assert.equal(r.sketch.revealed.length,1);assert.equal(roundReport(r.roundMetrics).summary.attempts,1);p.lastAnswerAt=0;await f.send(g.socket,{type:'sketch-guess',wordId:id,answer:'hablo\u0301'});assert.equal(p.correct,1);assert.equal(p.answered,2);assert.equal(r.sketch.phase,'reveal');assert.equal(g.socket.last().sketch.word,'habló');assert.equal(state(f,a).correct,0);assert.equal(state(f,a).answered,0);assert.equal(state(f,a).score,10);
 const report=validateReport(roundReport(r.roundMetrics));assert.equal(report.cards[0].typedCorrect,1);assert.equal(report.cards[0].typedIncorrect,1);assert.equal(report.cards[0].hintedAttempts,1);assert.equal(report.cards[0].choiceCounts.reduce((n,v)=>n+v),0);
 await f.send(f.host,{type:'sketch-next',wordId:id});assert.notEqual(r.sketch.id,id);assert.equal(r.sketch.artistId,g.playerId);assert.equal(a.socket.last().sketch.word,undefined);await f.send(a.socket,{...stroke(f),wordId:id});assert.match(a.socket.last('error').error,/current artist/);assert.equal(r.sketch.strokes.length,0);
});
test('pause freezes drawing timers, clear is authorized and pause rejects incoming strokes',async()=>{
 const f=await fixture('sketch'),a=role(f,true),g=role(f,false),r=f.service.room;await f.send(a.socket,stroke(f));await f.send(g.socket,{type:'sketch-clear',wordId:r.sketch.id});assert.equal(r.sketch.strokes.length,1);await f.send(f.host,{type:'pause'});const remaining=r.sketch.remaining;assert.equal(tickSketch(r,f.service.onlineIds(),Date.now()+100000),false);await f.send(a.socket,stroke(f,'paused_stroke'));assert.equal(r.sketch.strokes.length,1);await f.send(f.host,{type:'resume'});assert.ok(Math.abs(r.sketch.endsAt-Date.now()-remaining)<100);await f.send(f.host,{type:'sketch-clear',wordId:r.sketch.id});assert.equal(r.sketch.strokes.length,0);assert.equal(r.sketch.clearEpoch,1);
});
test('drawing validation rejects arbitrary styles, invalid coordinates and excessive ink',async()=>{
 const f=await fixture('sketch'),a=role(f,true),p=state(f,a),r=f.service.room;assert.throws(()=>appendSketchStroke(r,p,{...stroke(f),color:'url(bad)'},Date.now()),/Invalid drawing/);assert.throws(()=>appendSketchStroke(r,p,{...stroke(f),points:[[1001,0]]},Date.now()),/Invalid drawing/);const base=Date.now();let accepted=0;
 for(let i=0;i<300;i++){try{appendSketchStroke(r,p,{...stroke(f,'stroke_'+i),points:Array.from({length:24},()=>[1,1])},base+i*100);accepted++;}catch(error){assert.match(error.message,/ink is full/);break;}}
 assert.ok(r.sketch.strokes.reduce((n,s)=>n+s.points.length,0)<=MAX_DRAW_POINTS);assert.ok(accepted>100);assert.equal(roundReport(r.roundMetrics).summary.attempts,0);
});
test('45-player drawing guesses retain exact typed metrics and cap artist bonuses',async()=>{
 const f=await fixture('sketch',45),a=role(f,true),r=f.service.room,id=r.sketch.id;await f.send(a.socket,stroke(f));const guessers=f.students.filter(s=>s.playerId!==a.playerId);await Promise.all(guessers.map(s=>f.send(s.socket,{type:'sketch-guess',wordId:id,answer:'habló'})));const report=validateReport(roundReport(r.roundMetrics));assert.equal(report.summary.attempts,44);assert.equal(report.summary.correct,44);assert.equal(report.summary.participatingStudents,44);assert.equal(state(f,a).score,60);assert.equal(state(f,a).answered,0);assert.equal(r.sketch.phase,'reveal');assert.ok(guessers.every(s=>state(f,s).correct===1));
});
test('replayed incorrect sketch guesses do not add a second graded attempt',async()=>{
 const f=await fixture('sketch'),g=role(f,false),p=state(f,g),msg={type:'sketch-guess',id:'same_guess_retry',wordId:f.service.room.sketch.id,answer:'wrong'};await f.send(g.socket,msg);p.lastAnswerAt=0;await f.send(g.socket,msg);assert.equal(p.answered,1);assert.equal(roundReport(f.service.room.roundMetrics).summary.attempts,1);await f.send(g.socket,{...msg,id:'second_real_guess'});assert.equal(p.answered,2);
});
test('an offline artist hands the brush to another connected student after a grace period',async()=>{
 const f=await fixture('sketch',3),a=role(f,true),r=f.service.room,now=Date.now();a.socket.close();tickSketch(r,f.service.onlineIds(),now);assert.equal(r.sketch.artistId,a.playerId);tickSketch(r,f.service.onlineIds(),now+8001);assert.notEqual(r.sketch.artistId,a.playerId);assert.ok(r.sketch.artists.includes(a.playerId));assert.equal(r.sketch.id,f.host.last().sketch.id);assert.equal(roundReport(r.roundMetrics).summary.attempts,0);
});
test('erasing the active artist removes their drawing and private game state',async()=>{
 const f=await fixture('sketch'),a=role(f,true),p=state(f,a),r=f.service.room;p.accountId='artist-account';p.email='artist@example.com';await f.send(a.socket,stroke(f));assert.equal(r.sketch.strokes.length,1);const response=await f.service.fetch(new Request('https://room.internal/privacy-purge',{method:'POST',body:JSON.stringify({createdAt:r.createdAt,accountId:'artist-account'})}));assert.equal(response.status,200);assert.equal(r.sketch.strokes.length,0);assert.equal(p.wordPuzzle,null);assert.equal(p.sketchReceipt,null);assert.equal(p.adventure,null);assert.equal(p.email,null);assert.equal(r.sketch.artists.includes(p.id),false);
});
test('the final chunk of a quick stroke is accepted while sustained frame floods are bounded',async()=>{
 const f=await fixture('sketch'),a=role(f,true),p=state(f,a),r=f.service.room,now=Date.now();for(let i=0;i<12;i++)appendSketchStroke(r,p,stroke(f,'quick_'+i),now+i);assert.equal(r.sketch.strokes.length,12);assert.throws(()=>appendSketchStroke(r,p,stroke(f,'overflow_frame'),now+13),/too quickly/);appendSketchStroke(r,p,stroke(f,'next_window'),now+1001);assert.equal(r.sketch.strokes.length,13);assert.equal(p.answered,0);
});
