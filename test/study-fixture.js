import {TeacherLibrary} from '../src/library-service.js';
import {AcademyService} from '../src/academy-domain.js';
import {LeagueService} from '../src/league-service.js';
import {hash,uid,ListRepository} from '../src/library-domain.js';
import {context,internal} from './memory-runtime.js';
const initial=Date.parse('2026-11-19T20:00:00Z');
export async function clock(fn){const old=Date.now;let now=initial;Date.now=()=>now;try{await fn({advance:ms=>now+=ms,set:ms=>now=ms});}finally{Date.now=old;}}
export async function fixture(count=6){
  const ctx=context(),env={TEACHER_EMAILS:'teacher@example.com,second@example.com'},library=new TeacherLibrary(ctx,env),owner=await hash('teacher@example.com'),second=await hash('second@example.com'),teacher=uid(),other=uid();
  await ctx.storage.put({['session:'+await hash(teacher)]:{owner,email:'teacher@example.com',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000},['session:'+await hash(other)]:{owner:second,email:'second@example.com',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000}});
  const call=async(action,p={},token=teacher)=>{const response=await library.fetch(internal('academy:'+action,p,token));return {status:response.status,body:await response.json()};};
  const course=(await call('create-class',{name:'Weekly crew',timezone:'America/Los_Angeles'})).body.class;
  const otherCourse=(await call('create-class',{name:'Other crew',timezone:'Pacific/Kiritimati'},other)).body.class;
  const students=[];
  for(let i=0;i<count;i++){
    const email=`student${i}@example.com`,userId=await hash(email),token=uid(),profile={id:userId,email,name:'Student '+i,points:190,owned:['mint','coral'],skin:'coral',createdAt:Date.now()-1000};
    await ctx.storage.put({['account:'+userId]:profile,['session:'+await hash(token)]:{owner:userId,email,kind:'student',issuedAt:Date.now(),expiresAt:Date.now()+365*86400000}});
    await new AcademyService(ctx.storage,env).enroll(course.id,userId,email,profile.name);students.push({userId,token,email});
  }
  const listId=uid();await new ListRepository(ctx.storage,owner).save({id:listId,revision:0,mutationId:uid(),list:{title:'Words',cards:['casa','perro','verde','botas'].map((answer,i)=>({type:'pair',prompt:'Clue '+i,answer}))}});
  await call('share-list',{classId:course.id,listId});
  const a=(await call('create-assignment',{classId:course.id,listId,title:'Weekly practice',dueLocal:'2026-11-20T23:59',rules:{minMinutes:0,minCards:1,minAccuracy:100,crosswordWords:3}})).body.assignment;
  const leagues=new LeagueService(ctx.storage),view=async(student=students[0],extra={})=>(await call('league-home',{classId:course.id,...extra},student.token)).body;
  const key=u=>`league-player:${course.id}:${u||students[0].userId}`;
  return {ctx,env,library,owner,teacher,other,course,otherCourse,students,listId,a,call,leagues,view,key};
}
