import {AVATAR_ITEMS} from '../public/js/item-catalog.js';
import {JOURNEY_TRACKS} from '../public/js/expedition-catalog.js';

// Derive progress from private, server-written passports. No client totals, extra
// currency or daily resets; archived classes count until their data is erased.
export class JourneyService {
 constructor(store){this.store=store;}
 async summary(userId,current=null){
  const memberships=[...(await this.store.list({prefix:`enrollment:${userId}:`,limit:601})).values()];
  const classIds=new Set(memberships.filter(m=>m.userId===userId).map(m=>m.classId));
  if(current?.userId===userId)classIds.add(current.classId);
  const passports=await Promise.all([...classIds].map(classId=>current?.classId===classId?current:this.store.get(`expedition-profile:${classId}:${userId}`)));
  const stats=Object.fromEntries(JOURNEY_TRACKS.map(track=>[track.stat,0]));
  for(const passport of passports){
   if(passport?.userId!==userId)continue;
   for(const stat of Object.keys(stats)){const value=passport.stats?.[stat];if(Number.isSafeInteger(value)&&value>0)stats[stat]=Math.min(Number.MAX_SAFE_INTEGER,stats[stat]+value);}
  }
  return {stats};
 }
 async sync(user,current=null){
  const journey=await this.summary(user.id,current),owned=new Set(user.ownedItems||[]),earned=AVATAR_ITEMS.filter(item=>item.quest&&journey.stats[item.quest.stat]>=item.quest.goal&&!owned.has(item.id));
  if(earned.length){
   const profile=await this.store.get('account:'+user.id);
   if(profile&&!profile.disabled){profile.ownedItems=[...new Set([...(profile.ownedItems||[]),...earned.map(item=>item.id)])];await this.store.put('account:'+user.id,profile);user={...profile,...(user.role?{role:user.role}:{})};}
  }
  return {...user,journey};
 }
}
