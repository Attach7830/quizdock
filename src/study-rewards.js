import {ensure,uid} from './library-domain.js';
import {dateTimeInZone,DEFAULT_ZONE} from './academy-model.js';
const DAY=86400000;
export const DEFAULT_STUDY_REWARDS=Object.freeze({cardsPerReward:100,semesterEnd:'2026-12-18'});
export function rewardPolicy(raw={}){
 const cardsPerReward=Number(raw.cardsPerReward??100),semesterEnd=String(raw.semesterEnd||DEFAULT_STUDY_REWARDS.semesterEnd);
 ensure(Number.isInteger(cardsPerReward)&&cardsPerReward>=1&&cardsPerReward<=10000,'Use 1–10,000 typed questions per Jolly Rancher.');
 const semesterTimestamp=Date.parse(semesterEnd+'T12:00:00Z');
 ensure(/^\d{4}-\d\d-\d\d$/.test(semesterEnd)&&Number.isFinite(semesterTimestamp)&&new Date(semesterTimestamp).toISOString().slice(0,10)===semesterEnd,'Choose a valid semester end date.');
 return {cardsPerReward,semesterEnd};
}
export class StudyRewards {
 constructor(store){this.store=store;}
 async rows(prefix){let after,out=[];for(;;){const rows=await this.store.list({prefix,limit:250,...(after?{startAfter:after}:{})});out.push(...rows.values());ensure(out.length<=20000,'Too many reward records. Ask your teacher to archive older records.',413);if(rows.size<250)return out;after=[...rows.keys()].at(-1);}}
 async summary(course,userId,now=Date.now()){
  const policy=rewardPolicy(course.studyRewards),ledger=await this.store.get(`study-ledger:${course.id}:${userId}:${policy.semesterEnd}`),awards=await this.rows(`study-award:${course.id}:${userId}:`);
  const current=ledger?.semesterEnd===policy.semesterEnd&&now<dateTimeInZone(policy.semesterEnd+'T23:59',course.timezone||DEFAULT_ZONE)+60000;
  return {classId:course.id,className:course.name,policy,points:current?ledger?.points||0:0,completed:current?ledger?.completed||0:0,available:awards.reduce((n,a)=>n+(a.expiresAt>now?Math.max(0,a.quantity-a.claimed):0),0),claimed:awards.reduce((n,a)=>n+a.claimed,0),awards:awards.sort((a,b)=>b.earnedAt-a.earnedAt).map(a=>({...a,available:a.expiresAt>now?Math.max(0,a.quantity-a.claimed):0,expired:a.expiresAt<=now})),semesterActive:current||now<dateTimeInZone(policy.semesterEnd+'T23:59',course.timezone||DEFAULT_ZONE)+60000};
 }
 async credit(course,userId,count,now=Date.now()){
  ensure(Number.isSafeInteger(count)&&count>=0&&count<=10000,'Invalid typed-practice count.');if(!count)return;
  const policy=rewardPolicy(course.studyRewards),ends=dateTimeInZone(policy.semesterEnd+'T23:59',course.timezone||DEFAULT_ZONE)+60000;
  if(now>=ends)return;
  const key=`study-ledger:${course.id}:${userId}:${policy.semesterEnd}`,old=await this.store.get(key);
  const ledger=old?.semesterEnd===policy.semesterEnd?old:{classId:course.id,userId,semesterEnd:policy.semesterEnd,points:0,completed:0};
  ledger.points+=count;ledger.completed+=count;ledger.updatedAt=now;
  const quantity=Math.floor(ledger.points/policy.cardsPerReward);
  if(quantity){ledger.points-=quantity*policy.cardsPerReward;const award={id:uid(),classId:course.id,userId,quantity,claimed:0,earnedAt:now,expiresAt:now+30*DAY};await this.store.put(`study-award:${course.id}:${userId}:${award.id}`,award);}
  await this.store.put(key,ledger);
 }
 async claim(course,userId,awardId,requestId,teacherId,now=Date.now()){
  const key=`study-award:${course.id}:${userId}:${awardId}`,award=await this.store.get(key);ensure(award,'Reward not found.',404);
  const receiptKey=`study-claim:${course.id}:${userId}:${requestId}`,prior=await this.store.get(receiptKey);
  if(prior){ensure(prior.awardId===awardId,'This claim identifier was used for another reward.',409);return prior;}
  ensure(award.expiresAt>now,'This Jolly Rancher reward has expired.',409);ensure(award.claimed<award.quantity,'This reward has already been claimed.',409);
  award.claimed++;award.lastClaimedAt=now;
  const receipt={id:requestId,awardId,classId:course.id,userId,teacherId,claimedAt:now};await this.store.put({[key]:award,[receiptKey]:receipt});return receipt;
 }
}
