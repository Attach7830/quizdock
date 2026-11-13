import test from 'node:test';
import assert from 'node:assert/strict';
import {TeacherLibrary} from '../src/library-service.js';
import {hash} from '../src/library-domain.js';
import {context,internal} from './memory-runtime.js';

const env={TEACHER_EMAILS:'teacher@example.com, other@example.com',RESEND_API_KEY:'test-secret',EMAIL_FROM:'login@example.com'};
async function fixture(){
  const ctx=context(),service=new TeacherLibrary(ctx,env);
  return {ctx,service,owner:await hash('teacher@example.com'),ipHash:await hash('test-ip')};
}
async function request(service,email='teacher@example.com',ip='test-ip'){
  const response=await service.fetch(internal('login-request',{email},'',ip));
  return {status:response.status,body:await response.json()};
}
async function mockMail(fn,ok=true){
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async url=>{assert.equal(url,'https://api.resend.com/emails');calls++;return Response.json(ok?{id:'test-mail'}:{name:'validation_error'},{status:ok?200:403});};
  try{return await fn(()=>calls);}finally{globalThis.fetch=original;}
}
const budget=(count,ms=3600000)=>({count,expiresAt:Date.now()+ms});

test('one-time recovery clears a teacher send lockout without resetting other protected data',async()=>{
  const {ctx,service,owner,ipHash}=await fixture(),other=await hash('other@example.com');
  const protectedData={
    ['rate:verify:'+ipHash]:budget(100),
    ['rate:email:'+other]:budget(5),
    'rate:all-email':budget(5,86400000),
    'session:example':{owner,expiresAt:Date.now()+3600000},
    ['list:'+owner+':example']:{title:'Do not delete'},
    ['round:'+owner+':example']:{title:'Keep this round'},
    ['code:'+other]:{tries:6,challenge:'unchanged'}
  };
  await ctx.storage.put({...protectedData,['rate:email:'+owner]:budget(5),['rate:ip:'+ipHash]:budget(40)});
  await mockMail(async calls=>{
    const result=await request(service);assert.equal(result.status,200);assert.equal(calls(),1);
    assert.equal((await ctx.storage.get('rate:email:'+owner)).count,1);
    assert.equal((await ctx.storage.get('rate:ip:'+ipHash)).count,1);
    assert.equal((await ctx.storage.get('rate:all-email')).count,6);
    for(const [key,value] of Object.entries(protectedData))if(key!=='rate:all-email')assert.deepEqual(await ctx.storage.get(key),value);
  });
});

test('recovery persists across service restarts and cannot be repeated by changing IP',async()=>{
  const {ctx,service,owner}=await fixture();
  await mockMail(async calls=>{
    assert.equal((await request(service)).status,200);
    await ctx.storage.delete('code:'+owner);
    await ctx.storage.put('rate:email:'+owner,budget(5));
    const restarted=new TeacherLibrary(ctx,env),result=await request(restarted,'teacher@example.com','new-ip');
    assert.equal(result.status,429);assert.match(result.body.error,/Try again in \d+ minutes?/);assert.equal(calls(),1);
    assert.equal((await ctx.storage.list({prefix:'migration:'})).size,1);
  });
});

test('blocked cooldown clicks do not consume email or daily send quota',async()=>{
  const {ctx,service,owner,ipHash}=await fixture();
  await mockMail(async calls=>{
    assert.equal((await request(service)).status,200);
    for(let i=0;i<8;i++)assert.equal((await request(service)).status,429);
    assert.equal(calls(),1);assert.equal((await ctx.storage.get('rate:email:'+owner)).count,1);
    assert.equal((await ctx.storage.get('rate:all-email')).count,1);
    assert.equal((await ctx.storage.get('rate:ip:'+ipHash)).count,9);
  });
});

test('unauthorized emails cannot trigger recovery or erase an IP lockout',async()=>{
  const {ctx,service,ipHash}=await fixture();
  const existing=budget(40);await ctx.storage.put('rate:ip:'+ipHash,existing);
  await mockMail(async calls=>{
    assert.equal((await request(service,'stranger@example.com')).status,429);
    assert.equal(calls(),0);assert.deepEqual(await ctx.storage.get('rate:ip:'+ipHash),existing);
    assert.equal((await ctx.storage.list({prefix:'migration:'})).size,0);
  });
});

test('five-request email cap remains enforced after the one-time recovery',async()=>{
  const {ctx,service,owner}=await fixture();
  await mockMail(async calls=>{
    for(let i=0;i<5;i++){
      assert.equal((await request(service)).status,200);
      await ctx.storage.delete('code:'+owner); // Simulate an expired/completed challenge, avoiding the cooldown.
    }
    const result=await request(service);assert.equal(result.status,429);assert.equal(calls(),5);
    assert.match(result.body.error,/Try again in 60 minutes/);
  });
});

test('failed deliveries remain rate-limited and are not silently retried forever',async()=>{
  const {ctx,service,owner}=await fixture();
  await mockMail(async calls=>{
    for(let i=0;i<5;i++)assert.equal((await request(service)).status,503);
    assert.equal((await request(service)).status,429);assert.equal(calls(),5);
    assert.equal(await ctx.storage.get('code:'+owner),undefined);
  },false);
});

test('daily send cap is preserved and the rate message reports remaining time',async()=>{
  const {ctx,service}=await fixture();
  await ctx.storage.put('rate:all-email',budget(100,61000));
  await mockMail(async calls=>{
    const result=await request(service);assert.equal(result.status,429);assert.equal(calls(),0);
    assert.match(result.body.error,/Try again in 2 minutes/);
  });
});
