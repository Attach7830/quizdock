// Offline bridge: real QuizRoom logic with the existing in-memory Cloudflare adapter.
import readline from 'node:readline';
import {QuizRoom} from '../src/worker.js';
import {context,Socket} from './memory-runtime.js';
const ctx=context(),room=new QuizRoom(ctx,{});await ctx.boot;
await room.fetch(new Request('https://room.internal/init',{method:'POST',body:JSON.stringify({pin:'123456',hostToken:'host-test',title:'Spanish Review',mode:'treasure',questions:[{text:'¿Qué significa aprender?',answers:['To learn','To run','To sing','To read'],correct:[0]}]})}));
const join=await (await room.fetch(new Request('https://room.internal/join',{method:'POST',body:JSON.stringify({name:'Test Student'})}))).json();
const host=new Socket(),student=new Socket();ctx.sockets.push(host,student);
await room.webSocketMessage(host,JSON.stringify({type:'auth',role:'host',token:'host-test'}));
await room.webSocketMessage(student,JSON.stringify({type:'auth',role:'student',token:join.playerToken,playerId:join.playerId}));
const snapshot=()=>({host:host.last(),student:student.last(),identity:{host:{role:'host',pin:'123456',token:'host-test'},student:{role:'student',pin:'123456',token:join.playerToken,playerId:join.playerId}}});
console.log(JSON.stringify(snapshot()));
for await(const line of readline.createInterface({input:process.stdin})){
 try{const request=JSON.parse(line),socket=request.role==='host'?host:student;
 host.messages=[];student.messages=[];
 await room.webSocketMessage(socket,JSON.stringify(request.message));
 console.log(JSON.stringify({...snapshot(),errors:[...host.messages,...student.messages].filter(m=>m.type==='error')}));
 }catch(error){console.log(JSON.stringify({bridgeError:error.message}));}
}
