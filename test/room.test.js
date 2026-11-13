import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A light-weight Durable Object runtime simulation tests the room handlers.
// It does not substitute for an actual Cloudflare WebSocket integration test.
const workerPath = new URL('../src/worker.js', import.meta.url);
const gamePath = new URL('../src/game.js', import.meta.url).href;
const workerText = (await readFile(workerPath, 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", `class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }`)
  .replace("} from './game.js';", `} from '${gamePath}';`);
const { QuizRoom } = await import(`data:text/javascript;base64,${Buffer.from(workerText).toString('base64')}`);

function mockContext() {
  const memory = new Map();
  const ctx = {
    sockets: [],
    storage: {
      get: async key => memory.get(key), put: async (key,value)=>memory.set(key,structuredClone(value)),
      setAlarm: async time=>{ctx.alarmAt=time}, deleteAll: async ()=>memory.clear()
    },
    getWebSockets: ()=>ctx.sockets.filter(ws=>!ws.closed),
    blockConcurrencyWhile: callback=>{ctx.boot=callback()},
    acceptWebSocket: ws=>ctx.sockets.push(ws)
  };
  return ctx;
}
class FakeSocket {
  constructor() { this.messages=[]; this.closed=false; this.attachment={role:'pending'}; }
  send(message) { this.messages.push(JSON.parse(message)); }
  serializeAttachment(value) {this.attachment=value;}
  deserializeAttachment() {return this.attachment;}
  close(){this.closed=true;}
  latest(type) {return this.messages.filter(m=>m.type===type).at(-1);}
}
async function setup(mode='treasure') {
  const ctx=mockContext(); const server=new QuizRoom(ctx,{}); await ctx.boot;
  const init=await server.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({
    pin:'123456',title:'Spanish Quiz',hostToken:'teacher-secret',mode,
    questions:[{text:'¿Hola?',answers:['hello','bye','thank you'],correct:[0]}]
  })}));
  assert.equal(init.status,200);
  const join=await server.fetch(new Request('https://room.internal/api/room/123456/join',{method:'POST',body:JSON.stringify({name:'Ana'})}));
  assert.equal(join.status,200);
  const student=await join.json();
  const hostWs=new FakeSocket(); const playerWs=new FakeSocket();
  ctx.sockets.push(hostWs,playerWs);
  await server.webSocketMessage(hostWs,JSON.stringify({type:'auth',role:'host',token:'teacher-secret'}));
  await server.webSocketMessage(playerWs,JSON.stringify({type:'auth',role:'student',token:student.playerToken,playerId:student.playerId}));
  return {server,ctx,hostWs,playerWs,student};
}
test('private room starts, answers, resolves treasure chests, and ends', async()=>{
  const {server,hostWs,playerWs,ctx}=await setup();
  assert.ok(ctx.alarmAt>Date.now());
  assert.equal(playerWs.latest('state').status,'lobby');
  await server.webSocketMessage(hostWs,JSON.stringify({type:'start',minutes:5}));
  const s=playerWs.latest('state');
  assert.equal(s.status,'playing');
  assert.equal(s.me.question.options.length,3);
  assert.equal(JSON.stringify(s).includes('teacher-secret'),false);
  const choice=s.me.question.options.indexOf('hello');
  await server.webSocketMessage(playerWs,JSON.stringify({type:'answer',choice,key:s.me.question.key}));
  let updated=playerWs.latest('state');
  assert.equal(updated.me.feedback.correct,true);
  assert.equal(updated.me.pendingChests,true);
  await server.webSocketMessage(playerWs,JSON.stringify({type:'chest',index:0}));
  updated=playerWs.latest('state');
  assert.equal(updated.me.pendingChests,false);
  assert.ok(updated.me.coins>0);
  await server.webSocketMessage(playerWs,JSON.stringify({type:'next'}));
  assert.equal(playerWs.latest('state').me.feedback,null);
  await server.webSocketMessage(hostWs,JSON.stringify({type:'pause'}));
  assert.equal(playerWs.latest('state').status,'paused');
  await server.webSocketMessage(hostWs,JSON.stringify({type:'resume'}));
  assert.equal(playerWs.latest('state').status,'playing');
  await server.webSocketMessage(hostWs,JSON.stringify({type:'end'}));
  assert.equal(playerWs.latest('state').status,'finished');
});
test('a student cannot send teacher commands',async()=>{
  const {server,playerWs}=await setup();
  await server.webSocketMessage(playerWs,JSON.stringify({type:'start'}));
  assert.match(playerWs.latest('error').error,/Teacher access required/);
  assert.equal(playerWs.latest('state').status,'lobby');
});
test('factory mode upgrades and gets correct feedback',async()=>{
  const {server,hostWs,playerWs}=await setup('factory');
  await server.webSocketMessage(hostWs,JSON.stringify({type:'start',minutes:3}));
  const s=playerWs.latest('state');
  await server.webSocketMessage(playerWs,JSON.stringify({type:'answer',choice:s.me.question.options.indexOf('hello'),key:s.me.question.key}));
  assert.equal(playerWs.latest('state').me.cash,40);
  assert.equal(playerWs.latest('state').me.feedback.correct,true);
});
