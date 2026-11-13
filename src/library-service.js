import {RoundRepository} from './round-repository.js';
import {DurableObject} from 'cloudflare:workers';
import {LibraryError,ensure,uid,hash,teacherEmails,cleanEmail,randomCode,codeDigest,constantEqual,ListRepository,publicList} from './library-domain.js';
const HOUR=3600000,DAY=24*HOUR;
// One-time recovery for email-delivery setup failures; never reset OTP verification.
const SEND_RECOVERY='email-setup-recovery-2026-11-13';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const cookie=value=>`__Host-quizdock-library=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${value?604800:0}`;
export class TeacherLibrary extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.store=ctx.storage;this.config=env;}
  ready(){return !!(this.config.RESEND_API_KEY && this.config.EMAIL_FROM && teacherEmails(this.config).length);}
  async fetch(request){
    try{
      const message=await request.json();
      const result=await this.store.transaction(async store=>{
        const service=Object.create(this);service.store=store;
        try{return await service.route(message);}catch(e){if(e instanceof LibraryError)return json({error:e.message},e.status);throw e;}
      });
      if(['login-request','login-verify'].includes(message.action))await this.ensureAlarm();
      if(result instanceof Response)return result;
      // External delivery is outside the storage transaction; retries use a stable idempotency key.
      let sent;try{sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${this.config.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':result.challenge},body:JSON.stringify(result.mail),signal:AbortSignal.timeout(8000)});}catch{sent=null;}
      if(!sent?.ok){await this.store.transaction(async s=>{const pending=await s.get(result.key);if(pending?.challenge===result.challenge)await s.delete(result.key);});throw new LibraryError('Email could not be sent. Check the sender and email-service configuration.',503);}
      return json({challenge:result.challenge,message:'Check your email for a six-digit sign-in code.'});
    }catch(e){return json({error:e instanceof LibraryError?e.message:'The library could not complete this request. Please retry.'},e instanceof LibraryError?e.status:500);}
  }
  async rate(key,max,period=HOUR){
    const now=Date.now(),k='rate:'+key,prior=await this.store.get(k),r=prior?.expiresAt>now?prior:{count:0,expiresAt:now+period};
    const minutes=Math.max(1,Math.ceil((r.expiresAt-now)/60000));
    ensure(r.count<max,`Too many attempts. Try again in ${minutes} minute${minutes===1?'':'s'}.`,429);
    r.count++;await this.store.put(k,r);
  }
  async recoverSendLockoutOnce(owner,ipHash){
    // Runs inside the existing storage transaction for an allowlisted teacher only.
    // The permanent marker makes this a single recovery, not a repeatable bypass.
    const marker=`migration:${SEND_RECOVERY}:${owner}`;
    if(await this.store.get(marker))return;
    await this.store.delete(['rate:email:'+owner,'rate:ip:'+ipHash]);
    await this.store.put(marker,{appliedAt:Date.now()});
    // Keep the daily sending cap, OTP attempts, sessions, lists and reports intact.
  }
  async identity(token,required=true){
    const session=token?await this.store.get('session:'+await hash(token)):null;
    const user=session?.expiresAt>Date.now()&&teacherEmails(this.config).includes(session.email)?{id:session.owner,email:session.email,role:'teacher'}:null;
    if(required)ensure(user,'Sign in to the teacher library first.',401);return user;
  }
  async route({action,payload:p={},token='',ip='unknown'}){
    const now=Date.now();
    if(action==='record-round'){return json(await new RoundRepository(this.store,p.owner).upsert(p.report));}
    if(action==='status')return json({configured:this.ready(),user:await this.identity(token,false)});
    if(action==='login-request'){
      ensure(this.ready(),'Teacher sign-in is not configured. Add TEACHER_EMAILS, EMAIL_FROM and RESEND_API_KEY in Cloudflare.',503);
      const email=cleanEmail(p.email),owner=await hash(email),ipHash=await hash(ip);
      const authorized=teacherEmails(this.config).includes(email);
      if(authorized)await this.recoverSendLockoutOnce(owner,ipHash);
      await this.rate('ip:'+ipHash,40);
      ensure(authorized,'This email is not authorized for the teacher library.',403);
      // Repeated clicks during the resend cooldown must not use the email quota.
      const key='code:'+owner,old=await this.store.get(key);ensure(!old||now-old.createdAt>=60000,'Wait one minute before requesting another code.',429);
      await this.rate('email:'+owner,5);await this.rate('all-email',100,DAY);
      const challenge=uid(),code=randomCode();await this.store.put(key,{email,owner,challenge,digest:await codeDigest(this.config.RESEND_API_KEY,challenge,code),tries:0,createdAt:now,expiresAt:now+600000});
      return {key,challenge,mail:{from:this.config.EMAIL_FROM,to:[email],subject:'Your QuizDock teacher sign-in code',text:`Your QuizDock code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request it, ignore this message.`}};
    }
    if(action==='login-verify'){
      ensure(this.ready(),'Teacher sign-in is not configured.',503);
      const email=cleanEmail(p.email),owner=await hash(email);await this.rate('verify:'+await hash(ip),100,600000);
      const key='code:'+owner,c=await this.store.get(key);
      ensure(c&&c.expiresAt>now&&c.tries<6&&c.challenge===p.challenge&&teacherEmails(this.config).includes(email),'Code expired or invalid. Request a new code.',401);
      c.tries++;await this.store.put(key,c);
      ensure(/^\d{6}$/.test(String(p.code))&&constantEqual(await codeDigest(this.config.RESEND_API_KEY,c.challenge,String(p.code)),c.digest),'Incorrect code.',401);
      const session=uid()+uid();await this.store.put('session:'+await hash(session),{email,owner,expiresAt:now+7*DAY});await this.store.delete(key);
      return json({ok:true},200,{'set-cookie':cookie(session)});
    }
    if(action==='logout'){if(token)await this.store.delete('session:'+await hash(token));return json({ok:true},200,{'set-cookie':cookie('')});}
    const user=await this.identity(token),repository=new ListRepository(this.store,user.id);
    if(action==='authorize-game')return json({owner:user.id});
    if(action==='rounds')return json(await new RoundRepository(this.store,user.id).list(p.cursor||'',p.limit));
    if(action==='round')return json({report:await new RoundRepository(this.store,user.id).get(p.id)});
    if(action==='delete-round')return json(await new RoundRepository(this.store,user.id).remove(p.id));
    if(action==='lists')return json({lists:await repository.all()});
    if(action==='get')return json({list:publicList(await repository.get(p.id))});
    if(action==='save')return json({list:publicList(await repository.save(p))});
    if(action==='duplicate')return json({list:publicList(await repository.duplicate(p))});
    if(action==='delete')return json(await repository.remove(p.id,p.revision));
    if(action==='snapshot')return json(await repository.snapshot(p.id,p.revision));
    throw new LibraryError('Unknown library action.',404);
  }
  async ensureAlarm(){if(!(await this.store.getAlarm()))await this.store.setAlarm(Date.now()+HOUR);}
  async alarm(){
    let next=Infinity;const now=Date.now();
    for(const prefix of ['code:','session:','rate:'])for(const [key,value]of await this.store.list({prefix})){
      if(value.expiresAt<=now)await this.store.delete(key);else next=Math.min(next,value.expiresAt);
    }
    if(Number.isFinite(next))await this.store.setAlarm(Math.max(now+60000,next));
  }
}
