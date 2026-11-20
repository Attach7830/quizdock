import {weekStart,dateTimeInZone} from './academy-model.js';
import {ensure} from './library-domain.js';
import {LeagueService} from './league-service.js';

const fields=['answered','correct','events','milestones'];
const zero=()=>Object.fromEntries(fields.map(k=>[k,0]));
const milestone=p=>['rooms','discoveries','combos','deliveries','checkpoints','bosses','quests'].reduce((n,k)=>n+(p.expedition?.stats[k]||0),0);
export function startLeagueGame(room){
 const timezone=room.leagueTimezone||room.solo?.timezone;
 room.league=timezone?{timezone,startedAt:room.startedAt,cursor:{},weeks:{},updatedAt:room.startedAt}:null;
}
export function leagueAction(player){player.leagueActions=(player.leagueActions||0)+1;}
// These counters come only from validated room actions. Per-week buckets are
// captured when the action occurs, not when a delayed report arrives.
export function captureLeagueGame(room,now=Date.now()){
 const state=room.league;if(!state||!room.roundMetrics)return false;
 let changed=false;const week=weekStart(now,state.timezone);
 for(const p of Object.values(room.players)){
  if(!p.accountId||p.deleted)continue;
  const counts={answered:p.answered,correct:p.correct,events:(p.leagueActions||0)+(p.eventProgress?.sequence||0),milestones:milestone(p)},old=state.cursor[p.id]||zero(),delta=Object.fromEntries(fields.map(k=>[k,Math.max(0,counts[k]-old[k])]));
  if(fields.some(k=>delta[k])){state.weeks[week]=state.weeks[week]||{};const bucket=state.weeks[week][p.accountId]||zero();for(const k of fields)bucket[k]+=delta[k];state.weeks[week][p.accountId]=bucket;changed=true;}
  state.cursor[p.id]=counts;
 }
 if(changed){state.updatedAt=now;room.roundMetrics.revision++;room.roundMetrics.updatedAt=now;}
 return changed;
}
export function leagueGamePacket(room){
 const s=room.league;if(!s)return null;
 return {version:1,classId:room.classId||room.solo?.classId,ownerId:room.reportOwner||room.solo?.ownerId,roundId:room.roundMetrics.id,startedAt:s.startedAt,timezone:s.timezone,updatedAt:s.updatedAt,weeks:structuredClone(s.weeks)};
}
export function purgeLeaguePlayer(room,player){
 if(!room.league)return;delete room.league.cursor[player.id];for(const bucket of Object.values(room.league.weeks))delete bucket[player.accountId];
}
export async function recordLeagueGame(store,packet,owner,report){
 ensure(packet?.version===1&&packet.ownerId===owner&&packet.roundId===report.id&&packet.startedAt===report.startedAt,'Invalid league game identity.');
 const course=await store.get('class:'+packet.classId);ensure(course?.ownerId===owner&&packet.timezone===course.timezone,'Invalid league class.',403);
 ensure(packet.weeks&&typeof packet.weeks==='object'&&!Array.isArray(packet.weeks)&&Object.keys(packet.weeks).length<=3&&Number.isFinite(packet.updatedAt)&&packet.updatedAt>=packet.startedAt&&packet.updatedAt<=Date.now()+5000,'Invalid league activity.');
 if(course.archived||await store.get(`round-deleted:${owner}:${report.id}`))return;
 const accounts=new Map(),validated=[];
 for(const [week,players]of Object.entries(packet.weeks)){
  ensure(/^\d{4}-\d\d-\d\d$/.test(week)&&weekStart(dateTimeInZone(week+'T12:00',course.timezone),course.timezone)===week&&week>=weekStart(packet.startedAt,course.timezone)&&week<=weekStart(packet.updatedAt,course.timezone),'Invalid league week.');
  ensure(players&&typeof players==='object'&&!Array.isArray(players)&&Object.keys(players).length<=45,'Invalid league participants.');
  for(const [userId,counts]of Object.entries(players)){
   ensure(/^[a-f0-9]{64}$/.test(userId)&&fields.every(k=>Number.isSafeInteger(counts[k])&&counts[k]>=0&&counts[k]<=10000)&&counts.correct<=counts.answered,'Invalid league counts.');validated.push({week,userId,counts});
   if(!accounts.has(userId)){const profile=await store.get('account:'+userId),member=await store.get(`member:${course.id}:${userId}`),erased=await store.get('data:erased-account:'+userId),erasedMember=await store.get(`data:erased-member:${course.id}:${userId}`);accounts.set(userId,profile&&!profile.disabled&&member?.active&&!member.erased&&packet.startedAt>=(profile.createdAt||0)&&packet.startedAt>(erased?.at||0)&&packet.startedAt>(erasedMember?.at||0));}
  }
 }
 const settled=await store.get('outcome-settled:'+report.id),leagues=new LeagueService(store);
 for(const {week,userId,counts}of validated){
  if(!accounts.get(userId))continue;
  const key=`league-game:${course.id}:${userId}:${report.id}`,prior=await store.get(key);
  // Older finished rounds keep their original payout; new tracking cannot
  // replay them after erasure, restore or deployment.
  if(settled&&!prior)continue;
  const old=prior?.weeks?.[week]||zero();ensure(fields.every(k=>counts[k]>=old[k])||fields.every(k=>counts[k]<=old[k]),'League counters cannot partially decrease.',409);
  if(fields.every(k=>counts[k]<=old[k]))continue;
  const delta=Object.fromEntries(fields.map(k=>[k,counts[k]-old[k]]));
  ensure(delta.correct<=delta.answered,'League answer counters changed inconsistently.',409);
  await leagues.award(course,userId,delta,dateTimeInZone(week+'T12:00',course.timezone));
  await store.put(key,{classId:course.id,userId,roundId:report.id,weeks:{...prior?.weeks,[week]:counts},updatedAt:Date.now()});
 }
}
