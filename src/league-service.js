import {LEAGUE_TIERS,LEAGUE_XP,LEAGUE_ACTIVITY_XP,LEAGUE_MIN_FIELD,LEAGUE_SMALL_GOAL} from '../public/js/league-catalog.js';
import {ownedEquipment} from '../public/js/item-catalog.js';
import {weekStart,addDays,dateTimeInZone} from './academy-model.js';
import {leagueStandings} from './league-model.js';
import {ensure} from './library-domain.js';

const enabled=c=>c.leagues?.enabled!==false;
const playerKey=(c,u)=>`league-player:${c}:${u}`;
const newPlayer=(c,u,week,now)=>({classId:c,userId:u,tier:0,week,xp:0,correct:0,history:[],weeks:0,promotions:0,wins:0,lastActivityAt:now,updatedAt:now});
const resetAt=(week,timezone)=>dateTimeInZone(addDays(week,7)+'T00:00',timezone);

// Called inside TeacherLibrary's existing storage transaction. Weekly XP never
// touches grades, candy, spendable points, or lifetime adventure counters.
export class LeagueService {
  constructor(store){this.store=store;}
  async sync(course,now=Date.now()){
    const week=weekStart(now,course.timezone),profiles=[...(await this.store.list({prefix:`league-player:${course.id}:`,limit:201})).values()];
    const members=new Map([...(await this.store.list({prefix:`member:${course.id}:`,limit:201})).values()].filter(m=>m.active&&!m.erased).map(m=>[m.userId,m]));
    const accounts=new Map();
    for(const userId of members.keys()){
      if(userId===course.ownerId)continue;
      const account=await this.store.get('account:'+userId);
      if(account&&!account.disabled)accounts.set(userId,account);
    }
    const stale=profiles.filter(p=>p.week<week),groups=new Map();
    for(const p of stale){const k=p.week+':'+p.tier;if(!groups.has(k))groups.set(k,[]);if(accounts.has(p.userId)&&p.xp>0)groups.get(k).push(p);}
    const placements=new Map();
    for(const group of groups.values())for(const p of leagueStandings(group,enabled(course)))placements.set(p.userId,p);
    for(const p of stale){
      if(p.xp>0){
        const placed=placements.get(p.userId),before=p.tier,after=Math.max(0,Math.min(LEAGUE_TIERS.length-1,before+(placed?.movement||0)));
        const participants=groups.get(p.week+':'+before)?.length||0;
        p.history=[{week:p.week,endsAt:resetAt(p.week,course.timezone),timezone:course.timezone,xp:p.xp,correct:p.correct,rank:placed?.rank||null,participants,tierBefore:before,tierAfter:after,result:after>before?'promoted':after<before?'demoted':before===LEAGUE_TIERS.length-1&&placed?.rank===1?'summit':'held',small:participants<LEAGUE_MIN_FIELD},...(p.history||[])].slice(0,12);
        p.weeks=(p.weeks||0)+1;p.promotions=(p.promotions||0)+Number(after>before);p.wins=(p.wins||0)+Number(placed?.rank===1);p.tier=after;
      }
      p.week=week;p.xp=0;p.correct=0;p.activity={};p.updatedAt=now;await this.store.put(playerKey(course.id,p.userId),p);
    }
    const key='league-state:'+course.id+':current',prior=await this.store.get(key),endsAt=resetAt(week,course.timezone);
    if(prior?.week!==week||prior.timezone!==course.timezone)await this.store.put(key,{classId:course.id,week,timezone:course.timezone,resetAt:endsAt,updatedAt:now});
    return {week,resetAt:endsAt,profiles,members,accounts};
  }
  async credit(course,userId,correct,at=Date.now()){
    return this.award(course,userId,{answered:correct,correct},at);
  }
  async award(course,userId,activity,at=Date.now()){
    const now=Date.now();
    // A delayed report cannot rewrite a closed week or spill old XP into a new
    // week. Game credit uses the authoritative round-finished timestamp.
    const counts=Object.fromEntries(['answered','correct','reviews','events','milestones'].map(k=>[k,activity[k]??0]));
    if(!enabled(course)||Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<0||n>10000)||counts.correct>counts.answered||!Object.values(counts).some(Boolean)||weekStart(at,course.timezone)!==weekStart(now,course.timezone))return 0;
    const week=weekStart(now,course.timezone),key=playerKey(course.id,userId);
    const values=await this.store.get(['league-state:'+course.id+':current',key,'account:'+userId,`member:${course.id}:${userId}`]);
    const account=values.get('account:'+userId),member=values.get(`member:${course.id}:${userId}`);
    if(userId===course.ownerId||!account||account.disabled||!member?.active||member.erased)return 0;
    let p=values.get(key);
    if(values.get('league-state:'+course.id+':current')?.week!==week||p&&p.week<week){const state=await this.sync(course,now);p=state.profiles.find(p=>p.userId===userId);}
    p=p||newPlayer(course.id,userId,week,now);
    if(p.week!==week)return 0;
    const amount=counts.correct*LEAGUE_XP+(counts.answered-counts.correct)*LEAGUE_ACTIVITY_XP.attempt+counts.reviews*LEAGUE_ACTIVITY_XP.review+counts.events*LEAGUE_ACTIVITY_XP.event+counts.milestones*LEAGUE_ACTIVITY_XP.milestone;
    p.xp=Math.min(Number.MAX_SAFE_INTEGER-LEAGUE_XP,p.xp+amount);p.correct+=counts.correct;p.activity=p.activity||{};for(const [k,n]of Object.entries(counts))p.activity[k]=(p.activity[k]||0)+n;p.lastActivityAt=now;p.updatedAt=now;
    await this.store.put(key,p);return amount;
  }
  async view(course,user,tier){
    const state=await this.sync(course),mine=state.profiles.find(p=>p.userId===user.id)||newPlayer(course.id,user.id,state.week,Date.now());
    const selected=tier===undefined?mine.tier:Number(tier);ensure(Number.isInteger(selected)&&selected>=0&&selected<LEAGUE_TIERS.length,'Choose a listed league.');
    const participants=state.profiles.filter(p=>p.week===state.week&&p.xp>0&&state.accounts.has(p.userId));
    const rows=leagueStandings(participants.filter(p=>p.tier===selected),enabled(course));
    const ownRows=selected===mine.tier?rows:leagueStandings(participants.filter(p=>p.tier===mine.tier),enabled(course));
    const own=ownRows.find(p=>p.userId===user.id),target=ownRows.length<LEAGUE_MIN_FIELD?LEAGUE_SMALL_GOAL:ownRows[Math.max(0,Math.ceil(ownRows.length*.2)-1)]?.xp||LEAGUE_SMALL_GOAL;
    const safety=ownRows[Math.max(0,ownRows.length-Math.max(1,Math.floor(ownRows.length*.2))-1)]?.xp||0;
    const gap=mine.tier===LEAGUE_TIERS.length-1&&own?.zone!=='demotion'?0:Math.max(0,(own?.zone==='demotion'?safety:target)-mine.xp);
    return {
      class:{id:course.id,name:course.name,timezone:course.timezone},enabled:enabled(course),week:state.week,resetAt:state.resetAt,now:Date.now(),tier:selected,
      tiers:LEAGUE_TIERS.map((t,i)=>({...t,index:i,participants:participants.filter(p=>p.tier===i).length})),totalParticipants:participants.length,
      rules:{xpPerCorrect:LEAGUE_XP,activityXp:LEAGUE_ACTIVITY_XP,smallGoal:LEAGUE_SMALL_GOAL,minField:LEAGUE_MIN_FIELD,small:rows.length<LEAGUE_MIN_FIELD,promotionPlaces:Math.max(1,Math.ceil(rows.length*.2)),demotionPlaces:selected>0&&rows.length>=LEAGUE_MIN_FIELD?Math.max(1,Math.floor(rows.length*.2)):0},
      me:user.role==='student'?{tier:mine.tier,xp:mine.xp,correct:mine.correct,rank:own?.rank||null,zone:own?.zone||'unranked',gap,weeks:mine.weeks||0,promotions:mine.promotions||0,wins:mine.wins||0,history:mine.history||[]}:null,
      leaderboard:rows.map(p=>{const account=state.accounts.get(p.userId),member=state.members.get(p.userId);return {rank:p.rank,xp:p.xp,correct:p.correct,name:member.name||account.name,self:p.userId===user.id,zone:p.zone,appearance:{skin:account.owned?.includes(account.skin)?account.skin:'mint',equipment:ownedEquipment(account)}};})
    };
  }
}
