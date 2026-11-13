export class MemoryStorage {
  constructor(data=new Map()){this.data=data;this.alarmAt=null;this.tail=Promise.resolve();}
  async get(key){if(Array.isArray(key))return new Map(key.filter(k=>this.data.has(k)).map(k=>[k,structuredClone(this.data.get(k))]));return structuredClone(this.data.get(key));}
  async put(key,value){if(typeof key==='object'){for(const [k,v] of Object.entries(key))this.data.set(k,structuredClone(v));}else this.data.set(key,structuredClone(value));}
  async delete(keys){if(Array.isArray(keys))return keys.reduce((n,k)=>n+Number(this.data.delete(k)),0);return this.data.delete(keys);}
  async deleteAll(){this.data.clear();this.alarmAt=null;}
  async getAlarm(){return this.alarmAt;}
  async setAlarm(time){this.alarmAt=Number(time);}
  async list(options={}){let keys=[...this.data.keys()].filter(k=>(!options.prefix||k.startsWith(options.prefix))&&(!options.start||k>=options.start)&&(!options.startAfter||k>options.startAfter)&&(!options.end||k<options.end)).sort();if(options.reverse)keys.reverse();if(options.limit)keys=keys.slice(0,options.limit);return new Map(keys.map(k=>[k,structuredClone(this.data.get(k))]));}
  transaction(callback){const run=this.tail.then(async()=>{const tx=new MemoryStorage(structuredClone(this.data));tx.alarmAt=this.alarmAt;const result=await callback(tx);this.data=tx.data;this.alarmAt=tx.alarmAt;return result;});this.tail=run.catch(()=>{});return run;}
}
export function context(storage=new MemoryStorage()){
 const ctx={storage,sockets:[],getWebSockets(){return this.sockets.filter(s=>!s.closed);},blockConcurrencyWhile(fn){this.boot=Promise.resolve().then(fn);return this.boot;},acceptWebSocket(ws){this.sockets.push(ws);}};return ctx;
}
export class Socket {
 constructor(){this.messages=[];this.closed=false;this.attachment={role:'pending'};}
 send(text){this.messages.push(JSON.parse(text));}
 serializeAttachment(a){this.attachment=structuredClone(a);}
 deserializeAttachment(){return structuredClone(this.attachment);}
 close(){this.closed=true;}
 last(type='state'){return this.messages.filter(m=>m.type===type).at(-1);}
}
export const internal=(action,payload={},token='',ip='test-ip')=>new Request('https://library.internal/',{method:'POST',body:JSON.stringify({action,payload,token,ip})});
export function namespace(service){return {idFromName:n=>n,get:()=>({fetch:(url,init)=>service.fetch(url instanceof Request?url:new Request(url,init))})};}
