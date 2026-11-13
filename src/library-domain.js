import {validateList,compileQuestions} from '../public/js/list-model.js';
export class LibraryError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const ensure=(condition,message,status=400)=>{if(!condition)throw new LibraryError(message,status);};
export const uid=()=>crypto.randomUUID();
export async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function teacherEmails(env){return String(env.TEACHER_EMAILS||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);}
export function cleanEmail(raw){const e=String(raw||'').trim().toLowerCase();ensure(e.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e),'Enter a valid email address.');return e;}
export function randomCode(){const a=new Uint32Array(1),limit=Math.floor(4294967296/1000000)*1000000;do{crypto.getRandomValues(a);}while(a[0]>=limit);return String(a[0]%1000000).padStart(6,'0');}
export async function codeDigest(secret,challenge,code){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(challenge+':'+code)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function constantEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
const validId=value=>{ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(String(value||'')),'Invalid list identifier.');return String(value);};
export class ListRepository {
  constructor(storage,owner){this.storage=storage;this.owner=owner;}
  key(id){return `list:${this.owner}:${validId(id)}`;}
  async all(){const rows=await this.storage.list({prefix:`index:${this.owner}:`,limit:501});ensure(rows.size<=500,'This library is full. Export and delete old lists before adding more.',409);return [...rows.values()].sort((a,b)=>b.updatedAt-a.updatedAt||a.title.localeCompare(b.title));}
  async get(id){const item=await this.storage.get(this.key(id));ensure(item,'List not found.',404);return item;}
  async save(input,now=Date.now()){
    const id=validId(input.id),revision=Number(input.revision),mutation=validId(input.mutationId);ensure(Number.isSafeInteger(revision)&&revision>=0,'A valid base revision is required.');
    let content;try{content=validateList(input.list);}catch(e){throw new LibraryError(e.message);}
    const digest=await hash(JSON.stringify(content)),prior=await this.storage.get(this.key(id));
    if(prior?.lastMutation===mutation){ensure(prior.lastDigest===digest,'That save identifier was already used for different content.',409);return prior;}
    if(prior)ensure(prior.revision===revision,'This list changed in another tab or device. Reload the saved version or save your draft as a new list.',409);
    else{ensure(revision===0,'This list was deleted. Save your draft as a new list.',409);ensure((await this.all()).length<500,'Maximum 500 saved lists.',409);}
    const saved={id,...content,revision:revision+1,createdAt:prior?.createdAt||now,updatedAt:now,lastMutation:mutation,lastDigest:digest};
    const index={id,title:saved.title,description:saved.description,count:saved.cards.length,revision:saved.revision,createdAt:saved.createdAt,updatedAt:now};
    await this.storage.put({[this.key(id)]:saved,[`index:${this.owner}:${id}`]:index});return saved;
  }
  async remove(id,revision){const prior=await this.storage.get(this.key(id));if(!prior)return {deleted:true};ensure(prior.revision===Number(revision),'This list changed after you opened it. Reload before deleting.',409);await this.storage.delete([this.key(id),`index:${this.owner}:${id}`]);return {deleted:true};}
  async duplicate(input){const source=await this.get(input.sourceId);ensure(source.revision===Number(input.revision),'The source changed. Reload before duplicating.',409);const {validateCard}=await import('../public/js/list-model.js');return this.save({id:input.id,revision:0,mutationId:input.mutationId,list:{title:input.title||`${source.title.slice(0,90)} (copy)`,description:source.description,cards:source.cards.map(c=>validateCard(c))}});}
  async snapshot(id,revision){const saved=await this.get(id);ensure(saved.revision===Number(revision),'This list changed. Reload it before starting the game.',409);let questions;try{questions=compileQuestions(saved);}catch(e){throw new LibraryError(e.message);}return {listId:saved.id,listRevision:saved.revision,title:saved.title,questions};}
}
export function publicList(list){const {lastMutation,lastDigest,...visible}=list;return visible;}
