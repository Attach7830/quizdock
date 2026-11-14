// Simulated classroom concurrency: real rules and persistence adapter, NOT a Cloudflare load benchmark.
import test from 'node:test';
import assert from 'node:assert/strict';
import {QuizRoom} from '../src/worker.js';
import {TeacherLibrary} from '../src/library-service.js';
import {AcademyService} from '../src/academy-domain.js';
import {hash,uid} from '../src/library-domain.js';
import {PLAYER_TYPES} from '../public/js/catalog.js';
import {context,namespace,Socket,internal} from './memory-runtime.js';
class BoundedSocket extends Socket {
 send(text){const value=JSON.parse(text);this.latest=value;if(value.type==='state')this.state=value;if(value.type==='error')this.error=value;this.count=(this.count||0)+1;}
 last(type='state'){return type==='error'?this.error:this.state;}
}
async function classroom(count=45){
 const owner=await hash('teacher@example.com'),config={TEACHER_EMAILS:'teacher@example.com'},lc=context(),library=new TeacherLibrary(lc,config),academy=new AcademyService(lc.storage,config),c={id:uid(),ownerId:owner,name:'Load-test class',timezone:'America/Los_Angeles'};
 await lc.storage.put({['class:'+c.id]:c,['class-owner:'+owner+':'+c.id]:c});
 const env={TEACHER_LIBRARY:namespace(library)},ctx=context(),service=new QuizRoom(ctx,env);await ctx.boot;
 await service.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'445566',hostToken:'host-test',mode:'treasure',title:'Synthetic classroom',classId:c.id,reportOwner:owner,questions:Array.from({length:12},(_,i)=>({cardId:'question_'+i,text:'Prompt '+i,answers:['right','wrong'],correct:[0]}))})}));
 const host=new BoundedSocket();ctx.sockets.push(host);const send=(s,m)=>service.webSocketMessage(s,JSON.stringify(m));await send(host,{type:'auth',role:'host',token:'host-test'});
 const students=[];
 for(let i=0;i<count;i++){
  const email=`load${i}@example.com`,accountId=await hash(email),name=`Student ${i}`;await academy.enroll(c.id,accountId,email,name);await lc.storage.put('account:'+accountId,{id:accountId,email,name,points:0,owned:['mint'],skin:'mint',createdAt:Date.now()-1000});
  const response=await service.fetch(new Request('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity:{accountId,email,name,skin:'mint'}})}));assert.equal(response.status,200);
  const identity=await response.json(),socket=new BoundedSocket();ctx.sockets.push(socket);await send(socket,{type:'auth',role:'student',token:identity.playerToken,playerId:identity.playerId});students.push({...identity,accountId,socket});
 }
 return {owner,lc,ctx,library,service,host,students,send};
}
test('45-player concurrent answer bursts preserve grading and separate reports across all six modes',async()=>{
 const f=await classroom();let seq=0;const real=Date.now;let now=real();Date.now=()=>now;
 try{
  for(const mode of ['treasure','fishing','battle','factory','rally','keep']){
   await f.send(f.host,{type:'start',mode,settings:{minutes:10,kind:'time',allowLate:true,target:1000}});seq++;
   assert.equal(f.service.room.mode,mode);assert.equal(f.service.room.roundNumber,seq);
   if(PLAYER_TYPES[mode])await Promise.all(f.students.map((p,i)=>f.send(p.socket,{type:'choose-role',roleType:PLAYER_TYPES[mode][i%3].id})));
   for(let turn=0;turn<3;turn++){
    now+=600;
    const events=f.students.map((s,i)=>{const p=f.service.room.players[s.playerId];return {s,msg:{type:'answer',key:p.current.key,choice:p.current.order.indexOf(i%5===0?1:0),roundNumber:seq}};});
    await Promise.all(events.map(e=>f.send(e.s.socket,e.msg)));
    assert.equal(Object.values(f.service.room.players).reduce((n,p)=>n+p.answered,0),45*(turn+1));
    // Retrying the same answer must not double-grade a rapid retry.
    await Promise.all(events.map(e=>f.send(e.s.socket,e.msg)));
    assert.equal(Object.values(f.service.room.players).reduce((n,p)=>n+p.answered,0),45*(turn+1));
    if(mode==='treasure')await Promise.all(f.students.filter(s=>f.service.room.players[s.playerId].pendingChests).map(s=>f.send(s.socket,{type:'chest',index:0,roundNumber:seq})));
    await Promise.all(f.students.map(s=>f.send(s.socket,{type:'next',roundNumber:seq})));
   }
   await f.send(f.host,{type:'end'});const report=f.host.last().cardReport;
   assert.equal(report.summary.attempts,135);assert.equal(report.summary.correct,108);assert.equal(report.summary.incorrect,27);assert.equal(report.summary.participatingStudents,45);
   assert.equal(f.host.last().reportArchived,true);assert.equal(f.students[0].socket.last().mode,mode);assert.equal(f.students[0].socket.last().roundNumber,seq);
   assert.equal(JSON.stringify(f.students[0].socket.last()).includes('@example.com'),false);
   const before=await f.lc.storage.get('account:'+f.students[1].accountId);await f.service.publishReport(true);const after=await f.lc.storage.get('account:'+f.students[1].accountId);assert.equal(before.points,after.points);
   const disconnected=f.students[0],replacement=new BoundedSocket();f.ctx.sockets.push(replacement);await f.send(replacement,{type:'auth',role:'student',playerId:disconnected.playerId,token:disconnected.playerToken});disconnected.socket=replacement;assert.equal(replacement.last().me.id,disconnected.playerId);
  }
  assert.equal((await f.lc.storage.list({prefix:`round:${f.owner}:`})).size,6);
  assert.equal(Object.keys(f.service.room.players).length,45);
 }finally{Date.now=real;}
});
test('45 rostered student email requests and verification attempts share a classroom IP without lockout',async()=>{
 const ctx=context(),cfg={TEACHER_EMAILS:'teacher@example.com',EMAIL_FROM:'login@example.com',RESEND_API_KEY:'test'},svc=new TeacherLibrary(ctx,cfg),owner=await hash('teacher@example.com'),c={id:uid(),ownerId:owner,name:'Shared IP',allowCode:true,code:'0123456789',timezone:'America/Los_Angeles'};
 await ctx.storage.put({['class:'+c.id]:c,['class-code:'+c.code]:c.id});const original=fetch,mails=new Map();globalThis.fetch=async(u,init)=>{const body=JSON.parse(init.body);mails.set(body.to[0],body.text.match(/\b\d{6}\b/)[0]);return Response.json({id:uid()});};
 try{
  const results=await Promise.all(Array.from({length:45},async(_,i)=>{const email=`school${i}@example.com`,r=await svc.fetch(internal('academy:login-request',{email,name:'School '+i,classCode:c.code},'','shared-school-ip'));assert.equal(r.status,200);const p=await r.json();return {email,challenge:p.challenge};}));
  assert.equal(mails.size,45);
  await Promise.all(results.map(async p=>{const r=await svc.fetch(internal('academy:login-verify',{...p,code:mails.get(p.email)},'','shared-school-ip'));assert.equal(r.status,200);assert.ok(r.headers.get('set-cookie'));}));
  assert.equal((await ctx.storage.list({prefix:'session:'})).size,45);
 }finally{globalThis.fetch=original;}
});
