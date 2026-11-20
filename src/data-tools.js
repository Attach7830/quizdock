// Account-scoped recovery and erasure. No session tokens, email codes or API keys leave this service.
import {ensure,uid,hash,ListRepository} from './library-domain.js';
import {RoundRepository} from './round-repository.js';
const DAY=86400000, MAX_RECORDS=20000, MAX_BYTES=5_000_000;
const bytes=s=>new TextEncoder().encode(s);
const jsonSize=v=>bytes(JSON.stringify(v)).length;
const sid=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const PERSONAL_PREFIXES=['member:','enrollment:','practice:','solo:','outcome:','outcome-index:','outcome-week:','class-outcome-week:','raffle:','study-ledger:','study-award:','study-claim:','study-attempt:','study-game:','expedition-profile:','expedition-receipt:','expedition-gallery:','expedition-class-round:','league-player:','league-state:'];
export const DATA_ACTIONS=['status','backup','restore-preview','restore','delete-student','delete-account','retention-preview','retention-save','retention-run','erasure-status','personal-export','diagnostics'];
async function scan(store,prefix='',maximum=MAX_RECORDS){
 const out=new Map();let start;
 for(;;){const page=await store.list({prefix,limit:250,...(start?{startAfter:start}:{})});
  for(const [k,v]of page)out.set(k,v);
  ensure(out.size<=maximum,'This operation exceeds the safe record limit. Export one class at a time or contact the administrator.',413);
  if(page.size<250)return out;start=[...page.keys()].at(-1);
 }
}
async function sign(key,value){const k=await crypto.subtle.importKey('raw',bytes(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,bytes(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const safeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};
const hasId=(v,ids)=>{if(typeof v==='string')return ids.has(v);if(Array.isArray(v))return v.some(x=>hasId(x,ids));if(v&&typeof v==='object')return Object.entries(v).some(([k,x])=>ids.has(k)||hasId(x,ids));return false;};
function groupKey(k,v){
 if(k.startsWith('league-'))return 'league:'+v.classId;
 if(k.startsWith('list:')||k.startsWith('index:'))return 'list:'+v.id;
 if(k.startsWith('class:')||k.startsWith('class-owner:')||k.startsWith('class-code:'))return 'class:'+(typeof v==='string'?v:v.id);
 if(k.startsWith('member:')||k.startsWith('enrollment:'))return `member:${v.classId}:${v.userId}`;
 if(k.startsWith('assignment:')||k.startsWith('assignment-index:'))return 'assignment:'+v.id;
 if(k.startsWith('shared:')||k.startsWith('shared-index:'))return `shared:${v.classId}:${v.listId}`;
 if(k.startsWith('round:')||k.startsWith('round-index:'))return 'round:'+v.id;
 if(/^(outcome:|outcome-index:|outcome-week:|class-outcome-week:)/.test(k))return 'outcome:'+v.id;
 return k;
}
export class DataTools {
 constructor(store,config,academy){this.store=store;this.config=config;this.academy=academy;}
 async classes(owner){return [...(await scan(this.store,`class-owner:${owner}:`,101)).values()];}
 async key(owner){let key=await this.store.get('data:backup-key:'+owner);if(!key){key=uid()+uid();await this.store.put('data:backup-key:'+owner,key);}return key;}
 async policy(owner){return await this.store.get('data:policy:'+owner)||{days:null,enabled:false};}
 async collect(user,classId=null){
  this.academy.teacher(user);if(classId)await this.academy.course(classId,user,true);
  const records=new Map(),classes=(await this.classes(user.id)).filter(c=>!classId||c.id===classId),classIds=new Set(classes.map(c=>c.id)),assignmentIds=new Set(),roundIds=new Set();
  const add=async prefix=>{for(const [k,v]of await scan(this.store,prefix))records.set(k,v);};
  // Lists belong to the teacher, not the class, so include reusable lists in either export.
  await add(`list:${user.id}:`);await add(`index:${user.id}:`);
  for(const c of classes){const world=await this.store.get('expedition-world:'+c.id);if(world)records.set('expedition-world:'+c.id,world);records.set('class:'+c.id,c);records.set(`class-owner:${user.id}:${c.id}`,c);if(c.code)records.set('class-code:'+c.code,c.id);
   for(const prefix of ['member:','assignment-index:','shared:','shared-index:','study-ledger:','study-award:','study-claim:','study-attempt:','study-game:','expedition-profile:','expedition-receipt:','expedition-gallery:','expedition-class-round:','league-player:','league-state:'])await add(prefix+c.id+':');
   for(const m of (await scan(this.store,'member:'+c.id+':')).values()){const k=`enrollment:${m.userId}:${c.id}`,v=await this.store.get(k);if(v)records.set(k,v);await add(`solo:${m.userId}:${c.id}:`);}
   for(const a of (await scan(this.store,'assignment-index:'+c.id+':')).values()){assignmentIds.add(a.id);const v=await this.store.get('assignment:'+a.id);if(v)records.set('assignment:'+a.id,v);await add('practice:'+a.id+':');}
  }
  for(const [k,v]of await scan(this.store,'outcome-index:'+user.id+':'))if(!classId||v.classId===classId){records.set(k,v);roundIds.add(v.id);records.set('outcome:'+v.id,v);}
  for(const prefix of [`outcome-week:${user.id}:`,`class-outcome-week:${user.id}:`,`round:${user.id}:`,`round-index:${user.id}:`,`raffle:${user.id}:`])for(const [k,v]of await scan(this.store,prefix)){
   if(!classId||roundIds.has(v.id)||(v.classId===classId))records.set(k,v);
  }
  ensure(records.size<=MAX_RECORDS,'Backup is too large. Choose a single class.',413);
  const payload={format:'quizdock-workspace',version:1,owner:user.id,createdAt:Date.now(),classId,records:[...records].map(([k,v])=>[k,k.startsWith('practice:')?{...v,lease:null,lastBeat:0,lastAnswer:0}:v]).sort(([a],[b])=>a.localeCompare(b))};
  ensure(jsonSize(payload)<=MAX_BYTES,'Backup exceeds 5 MB. Choose a single class.',413);return payload;
 }
 async backup(user,p){const payload=await this.collect(user,p.classId||null);return {payload,signature:await sign(await this.key(user.id),payload)};}
 async planRestore(user,bundle){
  this.academy.teacher(user);ensure(bundle&&jsonSize(bundle)<=MAX_BYTES+2000,'Backup must be smaller than 5 MB.',413);
  const b=bundle.payload;ensure(b?.format==='quizdock-workspace'&&b.version===1&&b.owner===user.id&&Array.isArray(b.records)&&b.records.length<=MAX_RECORDS,'This backup belongs to a different account or uses an unsupported format.');
  const key=await this.store.get('data:backup-key:'+user.id);ensure(key&&safeEqual(await sign(key,b),bundle.signature),'Backup signature is invalid. Use an unmodified export from this deployment.',400);
  const erased=new Set(),erasedClasses=new Set();for(const [k,v]of await scan(this.store,'data:erased-account:'))if(v.at>=b.createdAt)erased.add(k.slice('data:erased-account:'.length));
  for(const [k,v]of await scan(this.store,'data:erased-member:'))if(v.at>=b.createdAt)erasedClasses.add(k.slice('data:erased-member:'.length));
  const groups=new Map(),classes=new Map(),assignments=new Map();
  for(const [k,v]of b.records){ensure(typeof k==='string'&&k.length<400,'Invalid backup key.');if(k.startsWith('class:'))classes.set(v.id,v);if(k.startsWith('assignment:'))assignments.set(v.id,v);const g=groupKey(k,v);if(!groups.has(g))groups.set(g,[]);groups.get(g).push([k,v]);}
  const allowed=(k,v)=>{
   if([`list:${user.id}:`,`index:${user.id}:`,`round:${user.id}:`,`round-index:${user.id}:`,`outcome-index:${user.id}:`,`outcome-week:${user.id}:`,`class-outcome-week:${user.id}:`,`raffle:${user.id}:`].some(pre=>k.startsWith(pre)))return true;
   if(k.startsWith('class:')||k.startsWith('class-owner:'))return v.ownerId===user.id&&classes.has(v.id);
   if(k.startsWith('class-code:'))return classes.get(v)?.ownerId===user.id&&classes.get(v).code===k.slice(11);
   if(k.startsWith('assignment:'))return v.ownerId===user.id&&classes.get(v.classId)?.ownerId===user.id;
   if(k.startsWith('outcome:'))return v.ownerId===user.id;
   if(['member:','enrollment:','assignment-index:','shared:','shared-index:','study-ledger:','study-award:','study-claim:','study-attempt:','study-game:','expedition-profile:','expedition-receipt:','expedition-gallery:','expedition-class-round:','league-player:','league-state:'].some(pre=>k.startsWith(pre)))return classes.get(v.classId)?.ownerId===user.id;
   if(k.startsWith('expedition-world:'))return classes.get(v.classId)?.ownerId===user.id;
   if(k.startsWith('practice:'))return assignments.get(v.assignmentId)?.ownerId===user.id;
   if(k.startsWith('solo:'))return classes.get(k.split(':')[2])?.ownerId===user.id;return false;
  };
  const operations=[],counts={records:0,groups:0,unchanged:0,conflicts:0,privacyBlocked:0,deletedRounds:0},policy=await this.policy(user.id);
  for(const [group,entries]of groups){
   for(const [k,v]of entries)ensure(allowed(k,v),'Backup contains data outside your workspace.',403);
   const v=entries[0][1],roundId=/^(round|outcome):/.test(group)?group.split(':')[1]:null;
   if(roundId&&await this.store.get(`round-deleted:${user.id}:${roundId}`)){counts.deletedRounds++;continue;}
   // Erasure tombstones intentionally take precedence over old signed backups.
   const ids=new Set(erased);for(const item of erasedClasses){const [c,u]=item.split(':');if(entries.some(([k,x])=>x.classId===c||assignments.get(x.assignmentId)?.classId===c||k.includes(':'+c+':')))ids.add(u);}
   if(entries.some(([k,x])=>PERSONAL_PREFIXES.some(pre=>k.startsWith(pre))&&(hasId(x,ids)||[...ids].some(u=>k.includes(':'+u))))){counts.privacyBlocked++;continue;}
   if(policy.enabled&&entries.some(([k,x])=>/^(round:|outcome:|raffle:|practice:|expedition-gallery:|expedition-receipt:|expedition-class-round:|league-player:)/.test(k)&&(x.finishedAt||x.drawnAt||x.at||x.lastActivityAt||x.updatedAt||x.createdAt||Date.now())<Date.now()-policy.days*DAY)){counts.privacyBlocked++;continue;}
   if(v.assignmentId&&(await this.store.get('assignment:'+v.assignmentId))?.archived){counts.privacyBlocked++;continue;}
   const classId=v.classId||assignments.get(v.assignmentId)?.classId;if(classId){const c=await this.store.get('class:'+classId);if(c?.archived){counts.privacyBlocked++;continue;}}
   let conflict=false,missing=[];for(const [k,x]of entries){const prior=await this.store.get(k);if(prior===undefined)missing.push([k,x]);else if(!same(prior,x))conflict=true;}
   if(conflict){counts.conflicts++;continue;}if(!missing.length){counts.unchanged++;continue;}
   operations.push(...missing);counts.groups++;counts.records+=missing.length;
  }
  return {operations,counts,createdAt:b.createdAt};
 }
 async restore(user,p){const plan=await this.planRestore(user,p.bundle);if(p.preview)return {preview:plan.counts,createdAt:plan.createdAt};ensure(p.confirm==='RESTORE MISSING RECORDS','Type RESTORE MISSING RECORDS to confirm.');
  // No existing key is overwritten; a practice lease is never restored.
  for(const [k,v]of plan.operations){const clean=structuredClone(v);if(k.startsWith('practice:')){clean.lease=null;clean.lastBeat=0;clean.lastAnswer=0;}await this.store.put(k,clean);}
  await this.store.put('data:last-restore:'+user.id,{at:Date.now(),...plan.counts});return {restored:plan.counts};
 }
 async eraseOutcome(owner,roundId){
  ensure(sid(roundId),'Invalid round identifier.');
  const outcome=await this.store.get('outcome:'+roundId);if(outcome)ensure(outcome.ownerId===owner,'Round belongs to another teacher.',403);
  await this.store.put(`round-deleted:${owner}:${roundId}`,true);
  const repo=new RoundRepository(this.store,owner),report=await this.store.get(repo.key(roundId));if(report)await this.store.delete([repo.key(roundId),repo.index(report)]);
  for(const prefix of ['outcome:'+roundId,`outcome-index:${owner}:`,`outcome-week:${owner}:`,`class-outcome-week:${owner}:`])for(const [k,v]of await scan(this.store,prefix))if(v.id===roundId)await this.store.delete(k);
  for(const [k,v]of await scan(this.store,`raffle:${owner}:`))if(v.roundIds?.includes(roundId))await this.store.delete(k);
  // Balances are not reversed. Keep a non-identifying payout marker against duplicate awards.
  await this.store.put('outcome-settled:'+roundId,true);
  for(const [k,v]of await scan(this.store,'expedition-gallery:'))if(v.roundId===roundId&&(await this.store.get('class:'+v.classId))?.ownerId===owner)await this.store.delete(k);
  if(outcome)for(const player of outcome.players||[])await this.store.delete(`reward:${player.accountId}:${roundId}`);
  return {deleted:true};
 }
 async recentSession(token,user){const s=await this.store.get('session:'+await hash(token));ensure(s?.issuedAt&&Date.now()-s.issuedAt<10*60000,'Sign out and sign back in before deleting student data.',401);ensure(s.owner===user.id,'Sign in again.',401);}
 async eraseStudent(user,p,token,self=false){
  await this.recentSession(token,user);let target,scope=null;
  if(self){ensure(user.role==='student','Teacher account deletion is managed by the site administrator.',403);target=user.id;ensure(p.confirm===user.email,'Enter your exact email to confirm account deletion.');}
  else{this.academy.teacher(user);const c=await this.academy.course(p.classId,user,true);scope=c.id;ensure(sid(p.userId),'Invalid student.');target=p.userId;const member=await this.academy.enrollment(target,scope);ensure(member,'Student not found.',404);ensure(p.confirm===member.email,'Enter the student’s exact email to confirm.');}
  const now=Date.now(),all=await scan(this.store,'',50000),assignmentClasses=new Map([...all].filter(([k])=>k.startsWith('assignment:')).map(([,v])=>[v.id,v.classId]));
  const marker=scope?`data:erased-member:${scope}:${target}`:`data:erased-account:${target}`;await this.store.put(marker,{at:now});
  let deleted=0,redacted=0;
  for(const [k,v]of all){
   const studentKey=k===`account:${target}`||k===`student-code:${target}`||k===`code:${target}`||k.startsWith(`reward:${target}:`)||k.startsWith(`reward-day:${target}:`)||k.startsWith(`rate:academy:send-email:${target}`)||k.startsWith(`rate:email:${target}`)||k.startsWith(`solo:${target}:`);
   const member=(k.startsWith('member:')||k.startsWith('enrollment:'))&&v.userId===target&&(!scope||v.classId===scope);
   const league=k.startsWith('league-player:')&&v.userId===target&&(!scope||v.classId===scope);
   const expedition=k.startsWith('expedition-')&&(!scope||v.classId===scope)&&v.userId===target;
   if(k.startsWith('expedition-gallery:')&&(!scope||v.classId===scope)&&v.frames?.some(frame=>frame.artistAccounts?.includes(target))){const frames=v.frames.filter(frame=>!frame.artistAccounts?.includes(target));if(frames.length)await this.store.put(k,{...v,frames});else await this.store.delete(k);redacted++;continue;}
   const study=k.startsWith('study-')&&v.userId===target&&(!scope||v.classId===scope);
   const practice=k.startsWith('practice:')&&v.userId===target&&(!scope||assignmentClasses.get(v.assignmentId)===scope);
   const session=k.startsWith('session:')&&v.owner===target;
   const solo=k.startsWith(`solo:${target}:`)&&(!scope||k.split(':')[2]===scope);
   if(member||practice||solo||study||expedition||league||!scope&&(studentKey||session)){await this.store.delete(k);deleted++;continue;}
   if(/^(outcome:|outcome-index:|outcome-week:|class-outcome-week:)/.test(k)&&(!scope||v.classId===scope)&&v.players?.some(x=>x.accountId===target)){const clean=structuredClone(v);clean.players=clean.players.filter(x=>x.accountId!==target);await this.store.put(k,clean);redacted++;}
   if(k.startsWith('raffle:')&&(!scope||k.startsWith('raffle:'+user.id+':')&&(v.classId===scope||!v.classId))&&v.entries?.some(e=>e.accountId===target)){
    // An all-class draw is removed rather than retaining a cross-class identity in a historical snapshot.
    await this.store.delete(k);redacted++;
   }
  }
  if(scope){const tomb={classId:scope,userId:target,active:false,erased:true,joinedAt:now};await this.store.put({[`member:${scope}:${target}`]:tomb,[`enrollment:${target}:${scope}`]:tomb});}
  const rooms=[...all].filter(([k,r])=>k.startsWith('active-room:')&&r.expiresAt>now&&(!scope||r.classId===scope)&&(!r.accountIds||r.accountIds.includes(target))).map(([,r])=>({pin:r.pin,createdAt:r.createdAt}));
  const receipt=uid()+uid(),jobId=uid();await this.store.put('data:privacy-job:'+jobId,{id:jobId,owner:scope?user.id:null,receiptHash:await hash(receipt),target,scope,createdAt:now,pending:rooms,completed:rooms.length===0,deleted,redacted});
  return {deleted,redacted,receipt,roomCleanup:rooms.length?'pending':'complete',message:scope?'Student work and class membership erased. Other teachers’ classes and the student’s account are unchanged.':'Account removed and sessions revoked. Local or previously downloaded copies must be deleted separately.'};
 }
 async retention(user,p,apply=false){
  this.academy.teacher(user);const days=Number(p.days);ensure([30,90,180,365,730].includes(days),'Choose 30, 90, 180, 365 or 730 days.');const cutoff=Date.now()-days*DAY,rounds=[],assignments=[];
  for(const r of (await scan(this.store,`round:${user.id}:`)).values())if(r.status==='finished'&&r.finishedAt<cutoff)rounds.push(r.id);
  for(const c of await this.classes(user.id))for(const a of (await scan(this.store,'assignment-index:'+c.id+':')).values())if(a.dueAt<cutoff&&!a.archived)assignments.push(a.id);
  const result={days,rounds:rounds.length,assignments:assignments.length,cutoff};if(!apply)return result;
  for(const r of rounds)await this.eraseOutcome(user.id,r);
  for(const assignmentId of assignments){const a=await this.store.get('assignment:'+assignmentId);if(!a)continue;for(const [k]of await scan(this.store,'practice:'+assignmentId+':'))await this.store.delete(k);a.archived=true;await this.store.put('assignment:'+assignmentId,a);const index=await this.store.get(`assignment-index:${a.classId}:${a.id}`);if(index)await this.store.put(`assignment-index:${a.classId}:${a.id}`,{...index,archived:true});}
  // Raffle snapshots and ungraded progress also expire under the selected policy.
  for(const [k,v]of await scan(this.store,'raffle:'+user.id+':'))if(v.drawnAt<cutoff)await this.store.delete(k);
  for(const c of await this.classes(user.id))for(const prefix of ['expedition-gallery:','expedition-receipt:','expedition-class-round:'])for(const [k,v]of await scan(this.store,prefix+c.id+':'))if(v.at<cutoff)await this.store.delete(k);
  for(const c of await this.classes(user.id))for(const m of (await scan(this.store,'member:'+c.id+':')).values())for(const [k,v]of await scan(this.store,`solo:${m.userId}:${c.id}:`))if(v.updatedAt<cutoff)await this.store.delete(k);
  for(const c of await this.classes(user.id))for(const prefix of ['study-attempt:','study-game:','expedition-profile:','expedition-receipt:','expedition-gallery:','expedition-class-round:'])for(const [k,v]of await scan(this.store,prefix+c.id+':'))if((v.at||v.updatedAt)<cutoff)await this.store.delete(k);
  for(const c of await this.classes(user.id))for(const [k,v]of await scan(this.store,'league-player:'+c.id+':')){if((v.lastActivityAt||v.updatedAt)<cutoff)await this.store.delete(k);else if(v.history?.some(h=>h.endsAt<cutoff))await this.store.put(k,{...v,history:v.history.filter(h=>h.endsAt>=cutoff)});}
  await this.store.put('data:last-retention:'+user.id,{at:Date.now(),...result});return result;
 }
 async route(action,p,token){
  if(action==='erasure-status'){ensure(typeof p.receipt==='string'&&p.receipt.length<200,'Invalid receipt.');const digest=await hash(p.receipt);const jobs=await scan(this.store,'data:privacy-job:');const job=[...jobs.values()].find(j=>safeEqual(j.receiptHash,digest));ensure(job,'Receipt not found.',404);return {complete:job.completed,pendingRooms:job.pending.length};}
  const user=await this.academy.identity(token);
  if(action==='status')return {role:user.role,email:user.email,classes:user.role==='teacher'?(await this.classes(user.id)).map(c=>({id:c.id,name:c.name})):[],policy:user.role==='teacher'?await this.policy(user.id):null,lastRestore:await this.store.get('data:last-restore:'+user.id)||null,lastRetention:await this.store.get('data:last-retention:'+user.id)||null,pendingCleanup:[...(await scan(this.store,'data:privacy-job:')).values()].filter(j=>j.owner===user.id&&!j.completed).length};
  if(action==='diagnostics'){this.academy.teacher(user);const key='data:probe:'+uid(),nonce=uid();await this.store.put(key,nonce);const storage=await this.store.get(key)===nonce;await this.store.delete(key);return {storage,emailConfigured:!!(this.config.RESEND_API_KEY&&this.config.EMAIL_FROM),emailDelivery:'not-tested',at:Date.now()};}
  if(action==='personal-export'){const records=[];for(const [k,v]of await scan(this.store,'',50000))if(k===`account:${user.id}`||k.startsWith(`enrollment:${user.id}:`)||k.startsWith(`solo:${user.id}:`)||k.startsWith(`reward:${user.id}:`)||(k.startsWith('practice:')||k.startsWith('study-')||k.startsWith('expedition-profile:')||k.startsWith('expedition-receipt:')||k.startsWith('league-player:'))&&v.userId===user.id||k.startsWith('expedition-gallery:')&&v.frames?.some(f=>f.artistAccounts?.includes(user.id)))records.push([k,k.startsWith('practice:')?{...v,lease:null,lastBeat:0,lastAnswer:0}:k.startsWith('expedition-gallery:')?{...v,frames:v.frames.filter(f=>f.artistAccounts?.includes(user.id)).map(f=>({...f,artistAccounts:[user.id]}))}:v]);const result={format:'quizdock-personal-export',createdAt:Date.now(),records};ensure(jsonSize(result)<=MAX_BYTES,'Personal export exceeds the safe limit.',413);return result;}
  if(action==='backup')return this.backup(user,p);
  if(action==='restore-preview')return this.restore(user,{...p,preview:true});
  if(action==='restore')return this.restore(user,p);
  if(action==='delete-student')return this.eraseStudent(user,p,token);
  if(action==='delete-account')return this.eraseStudent(user,p,token,true);
  if(action==='retention-preview')return this.retention(user,p);
  if(action==='retention-save'){this.academy.teacher(user);if(p.enabled)await this.retention(user,p);ensure(p.confirm==='SAVE RETENTION POLICY','Type SAVE RETENTION POLICY to confirm.');const policy={days:p.enabled?Number(p.days):null,enabled:!!p.enabled,updatedAt:Date.now()};await this.store.put('data:policy:'+user.id,policy);return {policy};}
  if(action==='retention-run'){ensure(p.confirm==='DELETE EXPIRED RECORDS','Type DELETE EXPIRED RECORDS to confirm.');return this.retention(user,p,true);}
  ensure(false,'Unknown data-management action.',404);
 }
}
// Called outside storage transactions. Retried by alarms; no public route can invoke room erasure.
export async function flushPrivacyJobs(store,env){
 let remaining=false;
 for(const [key,job]of await scan(store,'data:privacy-job:')){
  if(job.completed)continue;
  for(const target of job.pending.slice(0,8)){
   try{if(!env.ROOMS)throw new Error('No room binding');const r=await env.ROOMS.get(env.ROOMS.idFromName(target.pin)).fetch('https://room.internal/privacy-purge',{method:'POST',body:JSON.stringify({accountId:job.target,createdAt:target.createdAt,erasedAt:job.createdAt})});if(!r.ok)throw new Error('Room cleanup pending');job.pending=job.pending.filter(x=>x.pin!==target.pin||x.createdAt!==target.createdAt);}catch{remaining=true;}
  }
  job.completed=!job.pending.length;if(job.completed)job.completedAt=Date.now();else remaining=true;await store.put(key,job);
 }
 return remaining;
}
export async function runRetentionPolicies(store,config,academyFactory){
 for(const [key,policy]of await scan(store,'data:policy:'))if(policy.enabled){const owner=key.slice('data:policy:'.length),last=await store.get('data:last-retention:'+owner);if(last?.at>Date.now()-DAY)continue;await store.transaction(async tx=>{const svc=academyFactory(tx);await new DataTools(tx,config,svc).retention({id:owner,role:'teacher'},{days:policy.days},true);});}
}
