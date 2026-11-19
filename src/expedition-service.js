import {FISH_SPECIES,FISH_BY_ID} from '../public/js/fish-catalog.js';
import {ensure} from './library-domain.js';
import {JourneyService} from './journey-service.js';
import {ownedEquipment,cleanEquipment} from '../public/js/item-catalog.js';
import {CHAPTERS,HUB_BUILDINGS,AQUARIUM_DECOR,HANGAR_COLORS,HANGAR_TRAILS,HANGAR_EMBLEMS,ACHIEVEMENTS,COLLECTIONS} from '../public/js/expedition-catalog.js';
const MODES=CHAPTERS.map(c=>c.mode),count=(v,max=1000000)=>Math.max(0,Math.min(max,Number.isSafeInteger(v)?v:0));
const title=(v,n=40)=>String(v||'').normalize('NFC').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,n);
const sid=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(v);
export const cleanHangar=(value={})=>({paint:HANGAR_COLORS.some(x=>x.id===value.paint)?value.paint:'harbor',trail:HANGAR_TRAILS.some(x=>x.id===value.trail)?value.trail:'cloud',emblem:HANGAR_EMBLEMS.some(x=>x.id===value.emblem)?value.emblem:'star'});
export class ExpeditionService {
 constructor(store,academy){this.store=store;this.academy=academy;}
 key(c,u){return `expedition-profile:${c}:${u}`;}
 async passport(c,u){return await this.store.get(this.key(c,u))||{classId:c,userId:u,stats:{rounds:0,correct:0,answered:0,support:0,discoveries:0,rescues:0,improvements:0,accurateRounds:0},modes:[],best:{},fish:{},achievements:{},hubTokens:0,aquarium:{name:'My lantern lagoon',decor:'reef',residents:[]}};}
 async world(c){return await this.store.get('expedition-world:'+c)||{classId:c,chapter:0,counts:Object.fromEntries(MODES.map(m=>[m,0])),buildings:Object.fromEntries(HUB_BUILDINGS.map(b=>[b.id,0])),decor:{stars:0,lanterns:0,banners:0},revision:0};}
 async eligible(c,u,start){const [p,m,erased,memberErase]=await Promise.all([this.academy.profile(u),this.academy.enrollment(u,c),this.store.get(`data:erased-account:${u}`),this.store.get(`data:erased-member:${c}:${u}`)]);return p&&!p.disabled&&m?.active&&start>=(p.createdAt||0)&&start>(erased?.at||0)&&start>(memberErase?.at||0);}
 async record(outcome,owner,authoritative){
  if(!outcome||outcome.version!==1||!sid(outcome.roundId)||!MODES.includes(outcome.mode)||!outcome.classId||outcome.ownerId!==owner)return {};
  ensure(authoritative?.id===outcome.roundId&&authoritative.status==='finished'&&authoritative.mode===outcome.mode,'Adventure report must match a finished round.');
  const course=await this.store.get('class:'+outcome.classId);if(!course||course.archived||course.ownerId!==owner||await this.store.get(`round-deleted:${owner}:${outcome.roundId}`))return {};
  const policy=await this.store.get('data:policy:'+owner);if(policy?.enabled&&outcome.finishedAt<Date.now()-policy.days*86400000)return {};
  const passports={},c=course.id,world=await this.world(c),roundKey=`expedition-class-round:${c}:${outcome.roundId}`;let contribution=0;
  for(const result of (outcome.players||[]).slice(0,45)){
   const u=result.accountId;if(!sid(u)||!await this.eligible(c,u,outcome.startedAt))continue;
   const receipt=`expedition-receipt:${c}:${u}:${outcome.roundId}`;const p=await this.passport(c,u);if(await this.store.get(receipt)){passports[u]=p;continue;}
   const answered=count(result.answered,10000),correct=Math.min(answered,count(result.correct,10000));if(!answered&&!count(result.stats?.support,1000)){passports[u]=p;continue;}
   const score=count(Math.floor(result.score)),old=p.best[outcome.mode];p.stats.rounds++;p.stats.correct+=correct;p.stats.answered+=answered;p.stats.rescues+=count(result.rescues,1000);
   for(const metric of ['support','discoveries','quests'])p.stats[metric]=(p.stats[metric]||0)+count(result.stats?.[metric],10000);
   if(answered>=5&&correct/answered>=.9)p.stats.accurateRounds++;
   if(!p.modes.includes(outcome.mode))p.modes.push(outcome.mode);
   if(!old||score>old.score){if(old)p.stats.improvements++;p.best[outcome.mode]={score,correct,answered,roundId:outcome.roundId,at:outcome.finishedAt,timeline:(result.timeline||[]).slice(-60).map(t=>({answered:count(t.answered,10000),score:count(Math.floor(t.score))}))};}
   for(const [species,fish]of Object.entries(result.fish||{}).filter(([id])=>FISH_BY_ID.has(id)).slice(0,FISH_SPECIES.length)){if(!fish||typeof fish!=='object')continue;const before=p.fish[species]||{count:0,best:0};p.fish[species]={count:before.count+count(fish.count,1000),best:Math.max(before.best,Math.min(10000,Number(fish.best)||0)),...(fish.shinyCount||before.shinyCount?{shinyCount:(before.shinyCount||0)+Math.min(count(fish.count,1000),count(fish.shinyCount,1000)),shinyBest:Math.max(before.shinyBest||0,Math.max(0,Math.min(10000,Number(fish.shinyBest)||0)))}:{})};}
   p.hubTokens+=Math.floor((p.stats.correct-correct)/5+correct/5)-Math.floor((p.stats.correct-correct)/5);p.stats.modes=p.modes.length;
   for(const a of ACHIEVEMENTS)if(p.stats[a.stat]>=a.goal&&!p.achievements[a.id])p.achievements[a.id]=outcome.finishedAt;
   p.updatedAt=Date.now();await this.store.put({[this.key(c,u)]:p,[receipt]:{classId:c,userId:u,roundId:outcome.roundId,at:Date.now()}});passports[u]=p;contribution+=correct;
   await new JourneyService(this.store).sync(await this.academy.profile(u),p);
  }
  if(!await this.store.get(roundKey)){
   world.counts[outcome.mode]+=contribution;while(world.chapter<CHAPTERS.length&&world.counts[CHAPTERS[world.chapter].mode]>=CHAPTERS[world.chapter].goal)world.chapter++;
   world.revision++;world.updatedAt=Date.now();await this.store.put({['expedition-world:'+c]:world,[roundKey]:{classId:c,roundId:outcome.roundId,at:Date.now()}});
   const gallery=(outcome.gallery||[]).slice(-8).filter(g=>Array.isArray(g.artistAccounts)&&g.artistAccounts.every(u=>Object.hasOwn(passports,u)));
   if(gallery.length)await this.store.put(`expedition-gallery:${c}:${String(Math.floor(outcome.finishedAt)).padStart(13,'0')}:${outcome.roundId}`,{classId:c,roundId:outcome.roundId,at:Date.now(),frames:gallery.map(g=>({id:g.id,word:title(g.word,180),format:title(g.format,20),artistAccounts:g.artistAccounts,strokes:g.strokes.slice(0,120)}))});
  }
  return passports;
 }
 async route(action,p,user){
  if(action==='preset')return this.preset(p,user);
  if(action==='hangar')return this.hangar(p,user);
  const c=await this.academy.course(p.classId,user),profile=await this.passport(c.id,user.id),world=await this.world(c.id);
  if(action==='home'){
   const gallery=[...(await this.store.list({prefix:`expedition-gallery:${c.id}:`,reverse:true,limit:12})).values()];gallery.sort((a,b)=>b.at-a.at);
   return {class:{id:c.id,name:c.name},passport:profile,world,journey:await new JourneyService(this.store).summary(user.id),gallery:gallery.slice(0,12).map(g=>({roundId:g.roundId,at:g.at,frames:g.frames.map(({artistAccounts,...frame})=>frame)})),collections:COLLECTIONS.map(collection=>({...collection,owned:collection.items.filter(id=>user.ownedItems?.includes(id))})),presets:user.outfitPresets||[],hangar:cleanHangar(user.hangar),hangarRescues:await this.rescueTotal(user.id)};
  }
  ensure(user.role==='student','Use a student account to customize your expedition.',403);
  if(action==='aquarium'){
   const decor=AQUARIUM_DECOR.find(x=>x.id===p.decor),residents=Array.isArray(p.residents)?p.residents:[];ensure(decor&&Object.keys(profile.fish).length>=decor.need,'Discover more fish to unlock this decoration.');ensure(residents.length<=4&&residents.every(r=>profile.fish[r.species]&&(!r.shiny||profile.fish[r.species].shinyCount>0)&&title(r.name)),'Choose up to four fish you have discovered and name them.');profile.aquarium={name:title(p.name)||'My lantern lagoon',decor:decor.id,residents:residents.map(r=>({species:r.species,name:title(r.name,24),...(r.shiny?{shiny:true}:{})}))};
  }else if(action==='hub'){
   const building=HUB_BUILDINGS.find(b=>b.id===p.building);if(building){ensure(profile.hubTokens>0,'Earn an island supply for every five correct game answers.');ensure(world.buildings[building.id]<50,'This building is complete.');profile.hubTokens--;world.buildings[building.id]++;}
   else{ensure(['stars','lanterns','banners'].includes(p.decor),'Choose a listed island decoration.');if(profile.hubDecor!==p.decor){if(profile.hubDecor)world.decor[profile.hubDecor]=Math.max(0,world.decor[profile.hubDecor]-1);world.decor[p.decor]++;profile.hubDecor=p.decor;}}
   world.revision++;await this.store.put('expedition-world:'+c.id,world);
  }else throw new Error('Unknown expedition request.');
  profile.updatedAt=Date.now();await this.store.put(this.key(c.id,user.id),profile);return {ok:true};
 }
 async preset(p,user){
  const profile=await this.academy.profile(user.id),presets=profile.outfitPresets||[];
  if(p.operation==='save'){ensure(presets.length<5,'Keep up to five outfit presets.');const name=title(p.name,28);ensure(name,'Name your outfit.');presets.push({id:crypto.randomUUID(),name,skin:profile.skin,equipment:ownedEquipment(profile)});}
  else{const at=presets.findIndex(x=>x.id===p.id);ensure(at>=0,'Outfit preset not found.',404);if(p.operation==='delete')presets.splice(at,1);else{ensure(p.operation==='equip','Choose save, equip, or delete.');const outfit=presets[at];ensure(profile.owned.includes(outfit.skin),'Unlock this avatar first.');const valid=cleanEquipment(outfit.equipment);ensure(Object.values(valid).every(id=>profile.ownedItems?.includes(id)),'An outfit item is no longer owned.');profile.skin=outfit.skin;profile.equipment=valid;}}
  profile.outfitPresets=presets;await this.store.put('account:'+user.id,profile);return {user:await new JourneyService(this.store).sync({...profile,role:user.role})};
 }
 async rescueTotal(userId){const memberships=await this.academy.rows(`enrollment:${userId}:`,201);let rescues=0;for(const m of memberships)if(m.active)rescues+=(await this.passport(m.classId,userId)).stats.rescues||0;return rescues;}
 async hangar(p,user){
  const rescues=await this.rescueTotal(user.id);
  const value=cleanHangar(p);for(const [key,catalog]of [['paint',HANGAR_COLORS],['trail',HANGAR_TRAILS],['emblem',HANGAR_EMBLEMS]])ensure(catalog.find(x=>x.id===value[key]).need<=rescues,'Rescue more couriers to unlock this hangar decoration.');
  const profile=await this.academy.profile(user.id);profile.hangar=value;await this.store.put('account:'+user.id,profile);return {user:await new JourneyService(this.store).sync({...profile,role:user.role})};
 }
}
