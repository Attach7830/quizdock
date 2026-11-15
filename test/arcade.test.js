import test from 'node:test';
import assert from 'node:assert/strict';
import {shuffledOrder,startSolo,advanceSolo,reshuffleSolo} from '../public/js/solo-order.js';
import {CHIP_TUNES,createArcadeMusic} from '../public/js/arcade-music.js';
import {ARCADE_EVENTS} from '../public/js/event-catalog.js';
import {maybeArcadeEvent} from '../src/arcade-events.js';
import {newPlayer,validateQuestions} from '../src/game.js';
import {QuizRoom} from '../src/worker.js';
import {context,Socket} from './memory-runtime.js';
const questions=validateQuestions([{text:'Q',answers:['Yes','No'],correct:[0]}]);
test('solo shuffled passes visit every card once and preserve original-index persistence and confidence IDs',()=>{
 const deck={cards:Array.from({length:25},(_,i)=>({id:'card'+i}))},progress={index:12,known:['card4'],again:['card8']};
 const s={deck,...startSolo(deck,progress)};
 for(let pass=0;pass<3;pass++){
  const seen=[];for(let i=0;i<25;i++){seen.push(s.progress.index);advanceSolo(s);}
  assert.equal(new Set(seen).size,25);assert.notEqual(s.progress.index,seen.at(-1));
 }
 assert.deepEqual(s.progress.known,['card4']);assert.deepEqual(s.progress.again,['card8']);assert.equal(progress.index,12);
 const current=s.progress.index;reshuffleSolo(s);assert.notEqual(s.progress.index,current);assert.equal(s.cursor,0);
 advanceSolo(s,-1);assert.equal(s.cursor,0);advanceSolo(s);const next=s.progress.index;advanceSolo(s,-1);advanceSolo(s);assert.equal(s.progress.index,next);
});
test('one-card solo decks work for repeated passes and reshuffling',()=>{
 const s={deck:{cards:[{id:'one'}]},...startSolo({cards:[{id:'one'}]},{index:0,known:[],again:[]})};
 for(let i=0;i<10;i++)advanceSolo(s);reshuffleSolo(s);assert.deepEqual(s.order,[0]);assert.equal(s.progress.index,0);
 assert.deepEqual(shuffledOrder(0),[]);
});
for(const [mode,events] of Object.entries(ARCADE_EVENTS))test(`${mode}: all three distinctive events apply bounded game effects without changing learning data`,()=>{
 for(let i=0;i<events.length;i++){
  const p=newPlayer('p','private-token','Student',questions);p.hp=80;p.correct=5;p.answered=6;p.streak=3;p.machineLevel=2;p.eventProgress={steps:3,sequence:0,lastKind:null};
  const room={mode,status:'playing',roundNumber:1,players:{p}},event=maybeArcadeEvent(room,p,40,()=>i,123);
  assert.equal(event.kind,events[i].kind);assert.equal(event.at,123);assert.equal(p.lastEvent,event);assert.equal(room.lastArcadeEvent,event);
  assert.ok(p.hp<=100&&p.hp>=80);assert.ok(event.amount>=0&&event.amount<=60);assert.equal(p.correct,5);assert.equal(p.answered,6);assert.equal(p.streak,3);assert.equal(p.accountId,null);assert.equal(p.machineLevel,2);
  assert.equal(JSON.stringify(event).includes('private-token'),false);assert.equal(p.eventProgress.steps,0);
  assert.equal(maybeArcadeEvent(room,p,40,()=>0),null);
  p.eventProgress.steps=3;assert.notEqual(maybeArcadeEvent(room,p,40,()=>0).kind,event.kind);
 }
});
test('paused and finished games cannot create events',()=>{
 const p=newPlayer('p','t','P',questions);p.eventProgress={steps:3};
 for(const status of ['lobby','paused','finished'])assert.equal(maybeArcadeEvent({mode:'battle',status},p),null);
 assert.equal(p.eventProgress.steps,3);
});
for(const mode of Object.keys(ARCADE_EVENTS))test(`${mode}: room rejects event injection and duplicate rewards, persists events, clears them on replay`,async()=>{
 const ctx=context(),room=new QuizRoom(ctx,{});await ctx.boot;
 await room.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host',mode,title:'Events',questions})}));
 const join=await(await room.fetch(new Request('https://room.internal/join',{method:'POST',body:JSON.stringify({name:'Student'})}))).json();
 const host=new Socket(),student=new Socket();ctx.sockets.push(host,student);const send=(ws,m)=>room.webSocketMessage(ws,JSON.stringify(m));
 await send(host,{type:'auth',role:'host',token:'host'});await send(student,{type:'auth',role:'student',token:join.playerToken,playerId:join.playerId});
 await send(host,{type:'start'});if(['rally','keep'].includes(mode))await send(student,{type:'choose-role',roleType:mode==='rally'?'ace':'mender'});
 const p=room.room.players[join.playerId];
 for(let i=0;i<4;i++){
  p.lastAnswerAt=0;const message={type:'answer',key:p.current.key,choice:p.current.order.indexOf(0)};await send(student,message);
  if(mode==='treasure'){const before=p.eventProgress?.steps;await send(student,{type:'chest',index:0});const event=structuredClone(p.lastEvent);await send(student,{type:'chest',index:0});assert.deepEqual(p.lastEvent,event);if(i===0)assert.equal(before,undefined);}
  const last=structuredClone(p.lastEvent);await send(student,message);assert.deepEqual(p.lastEvent,last);await send(student,{type:'next'});
 }
 assert.equal(p.correct,4);assert.equal(p.answered,4);assert.ok(p.lastEvent?.id);const stored=await ctx.storage.get('room');assert.deepEqual(stored.players[p.id].lastEvent,p.lastEvent);
 const id=p.lastEvent.id;await send(student,{type:'arcade-event',kind:'coin-comet',amount:9999});assert.equal(p.lastEvent.id,id);assert.match(student.last('error').error,/Unknown/);
 await send(student,{type:'sync'});assert.equal(student.last().me.lastEvent.id,id);assert.equal(host.last().lastArcadeEvent.id,id);
 const reloaded=new QuizRoom(ctx,{});await ctx.boot;assert.equal(reloaded.room.players[p.id].lastEvent.id,id);
 await send(host,{type:'end'});await send(host,{type:'start'});assert.equal(student.last().me.lastEvent,null);assert.equal(student.last().lastArcadeEvent,null);
});
function audioFixture(){
 const memory=new Map(),intervals=new Map(),buttons=[{textContent:'',setAttribute(){}}],doc=new EventTarget();doc.hidden=false;doc.querySelectorAll=s=>s.includes('toggle')?buttons:[];
 let count=0,contextCount=0;const param={setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}};
 class Audio {constructor(){contextCount++;this.state='suspended';this.currentTime=0;this.destination={};this.notes=[];this.closed=false;}
 createGain(){return {gain:{...param,value:0},connect(){},disconnect(){}};}
 createOscillator(){const node={frequency:param,connect(){},disconnect(){},start:()=>this.notes.push(node),stop(){}};return node;}
 resume(){this.state='running';this.onstatechange?.();return Promise.resolve();}suspend(){this.state='suspended';this.onstatechange?.();return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}}
 let instance;const view=new EventTarget();Object.assign(view,{localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},AudioContext:class extends Audio{constructor(){super();instance=this;}},setInterval:fn=>{intervals.set(++count,fn);return count;},clearInterval:id=>intervals.delete(id)});
 const click=()=>{const e=new Event('click');Object.defineProperty(e,'target',{value:{closest:s=>s.includes('toggle')?{}:null}});doc.dispatchEvent(e);};
 return {doc,view,memory,intervals,click,get instance(){return instance;},get count(){return contextCount;}};
}
test('music composes original distinct tunes and manages one audio context across mute, pause, visibility and replay',async()=>{
 assert.equal(new Set(Object.values(CHIP_TUNES).map(t=>t.lead.join(','))).size,9);
 const f=audioFixture(),music=createArcadeMusic(f);music.enter({mode:'treasure',status:'lobby'});await Promise.resolve();
 assert.equal(f.count,1);assert.equal(f.intervals.size,1);assert.ok(f.instance.notes.length>0);
 music.enter({mode:'fishing',status:'playing'});music.enter({mode:'fishing',status:'playing'});assert.equal(f.count,1);assert.equal(f.intervals.size,1);
 f.click();assert.equal(f.memory.get('qd-music'),'off');assert.equal(f.intervals.size,0);f.click();await Promise.resolve();assert.equal(f.intervals.size,1);
 music.enter({status:'paused'});assert.equal(f.intervals.size,0);f.click();assert.equal(f.memory.get('qd-music'),'off');f.click();assert.equal(f.intervals.size,0);
 music.enter({status:'playing'});await Promise.resolve();assert.equal(f.intervals.size,1);
 f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.intervals.size,0);f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();assert.equal(f.intervals.size,1);
 music.dispose();assert.equal(f.intervals.size,0);assert.equal(f.instance.closed,true);
});
test('music respects a saved mute preference without allocating audio resources',()=>{
 const f=audioFixture();f.memory.set('qd-music','off');const music=createArcadeMusic(f);music.enter({status:'playing'});assert.equal(f.count,0);assert.equal(f.intervals.size,0);music.dispose();
});
test('music volume zero stops playback, persists, and a positive volume resumes',async()=>{
 const f=audioFixture(),music=createArcadeMusic(f);music.enter({status:'playing'});await Promise.resolve();
 const volume=value=>{const event=new Event('input');Object.defineProperty(event,'target',{value:{dataset:{music:'volume'},value:String(value)}});f.doc.dispatchEvent(event);};
 volume(0);assert.equal(f.intervals.size,0);assert.equal(f.memory.get('qd-music-volume'),'0');volume(50);await Promise.resolve();assert.equal(f.intervals.size,1);assert.equal(f.memory.get('qd-music-volume'),'0.5');music.dispose();
});
test('active-room privacy purge removes event names along with the student identity',async()=>{
 const ctx=context(),room=new QuizRoom(ctx,{});await ctx.boot;
 await room.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host',mode:'factory',title:'Privacy',questions})}));
 const accountId='a'.repeat(64),identity={accountId,email:'student@example.com',name:'Private Student',skin:'mint'};
 const joined=await(await room.fetch(new Request('https://room.internal/join-verified',{method:'POST',body:JSON.stringify({identity})}))).json();
 const p=room.room.players[joined.playerId];room.room.status='playing';room.room.endsAt=Date.now()+60000;p.eventProgress={steps:3,sequence:0,lastKind:null};maybeArcadeEvent(room.room,p,40,()=>0);await room.save();
 const result=await room.fetch(new Request('https://room.internal/privacy-purge',{method:'POST',body:JSON.stringify({accountId,createdAt:room.room.createdAt})}));
 assert.equal(result.status,200);assert.equal(p.lastEvent,null);assert.equal(room.room.lastArcadeEvent,null);assert.equal(p.name,'Deleted participant');
});
