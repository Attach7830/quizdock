import {changeContentVisibility} from './content-visibility.js';
import {reconcileCrosswordDraft,saveCrosswordDraft,checkCrosswordGrid,crosswordDraftAssessment} from './crossword-grid.js';
import {LeagueService} from './league-service.js';
import {LEAGUE_TIERS} from '../public/js/league-catalog.js';
import {assignmentEdits,assignmentRevision,ensureAssignmentRevision,submissionSnapshot,submittedAssignment} from './assignment-editing.js';
import {crosswordCandidates,createAssignmentCrossword,connectedCrosswordCapacity,crosswordLayoutKey,publicAssignmentCrossword,checkCrosswordAnswer,syncAssignmentCrossword} from './assignment-crossword.js';
import {ExpeditionService} from './expedition-service.js';
import {JourneyService} from './journey-service.js';
import {assignmentSemester,validateSemester,inCurrentAssignmentSemester,availableAssignmentCredit} from './assignment-policy.js';
import {WORD_ACTIVITIES,makeCrossword,publicCrossword} from './word-activities.js';
import {ensure,LibraryError,uid,hash,teacherEmails,cleanEmail,randomCode,codeDigest,constantEqual,ListRepository} from './library-domain.js';
import {correctAnswers,validateList,CARD_CATEGORIES} from '../public/js/list-model.js';
import {SKINS} from '../public/js/catalog.js';
import {AVATAR_ITEMS,ITEM_SLOTS,itemById,ownedEquipment} from '../public/js/item-catalog.js';
import {DEFAULT_ZONE,zone,localDay,weekStart,addDays,dateTimeInZone,gradeTyped,practiceRules,progressSummary,raffleEntries,weightedWinner,rankedParticipants} from './academy-model.js';
import {StudyRewards,rewardPolicy} from './study-rewards.js';
import {publicWordQuestion,guessWordLetter} from './word-games.js';
import {startGoogleLogin,finishGoogleLogin} from './google-login.js';
import {drawShuffledCard} from '../public/js/card-order.js';
const HOUR=3600000,DAY=24*HOUR;
const id=v=>{ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(String(v||'')),'Invalid identifier.');return String(v);};
const text=(v,max=80)=>String(v??'').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g,' ').trim().slice(0,max);
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const cookie=value=>`__Host-quizdock-library=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${value?604800:0}`;
const publicAssignment=a=>{const {cards,ownerId,lastEditMutation,lastVisibilityMutation,...rest}=a;return {...rest,revision:assignmentRevision(a),cardCount:cards.length};};

// Instantiated INSIDE TeacherLibrary's storage transaction. External email delivery remains outside it.
export class AcademyService {
 constructor(store,config){this.store=store;this.config=config;}
 async rows(prefix,limit=600){return [...(await this.store.list({prefix,limit})).values()];}
 async rate(key,max,period=HOUR){const now=Date.now(),k='rate:academy:'+key,prior=await this.store.get(k),r=prior?.expiresAt>now?prior:{count:0,expiresAt:now+period};ensure(r.count<max,`Too many requests. Try again in ${Math.max(1,Math.ceil((r.expiresAt-now)/60000))} minutes.`,429);r.count++;await this.store.put(k,r);}
 async profile(accountId){return await this.store.get('account:'+accountId);}
 async identity(token){
  const s=token?await this.store.get('session:'+await hash(token)):null;ensure(s?.expiresAt>Date.now(),'Sign in again to continue.',401);
  const teacher=teacherEmails(this.config).includes(s.email);ensure(teacher||s.kind==='student','Account access is no longer available.',403);
  let profile=await this.profile(s.owner);
  if(!profile){profile={id:s.owner,email:s.email,name:text(s.email.split('@')[0]),points:0,owned:['mint'],skin:'mint',createdAt:Date.now()};await this.store.put('account:'+s.owner,profile);}
  ensure(!profile.disabled,'This account has been disabled.',403);return {...profile,role:teacher?'teacher':'student'};
 }
 teacher(user){ensure(user.role==='teacher','Teacher access required.',403);}
 async course(classId,user,teacherOnly=false){const c=await this.store.get('class:'+id(classId));ensure(c&&!c.archived,'Class not found.',404);if(c.ownerId===user.id&&user.role==='teacher')return c;ensure(!teacherOnly&&(await this.store.get(`member:${c.id}:${user.id}`))?.active,'This class is not linked to your account.',403);return c;}
 async enrollment(userId,classId){return await this.store.get(`member:${classId}:${userId}`);}
 async enroll(classId,userId,email,name){const key=`member:${classId}:${userId}`,old=await this.store.get(key);if(!old){const members=await this.rows(`member:${classId}:`,201);ensure(members.length<200,'This class has reached its 200-student limit.');}
  const m={classId,userId,email,name:text(name)||email.split('@')[0],active:true,joinedAt:old?.joinedAt||Date.now()};await this.store.put({[key]:m,[`enrollment:${userId}:${classId}`]:m});return m;
 }
 async byCode(raw,email=''){const code=String(raw||'').trim().toUpperCase();ensure(/^[A-Z0-9]{10}$/.test(code),'Use the 10-character class code from your teacher.');const classId=await this.store.get('class-code:'+code),c=classId?await this.store.get('class:'+classId):null;ensure(c&&!c.archived&&c.allowCode,'Class code is unavailable.',403);ensure(!email||!c.emailDomain||email.endsWith('@'+c.emailDomain),'Use your school email for this class.',403);return c;}
 async eligibleStudent(email,code){const userId=await hash(email);if(code){const c=await this.byCode(code,email),m=await this.enrollment(userId,c.id);ensure(!m||m.active,'Ask your teacher to restore your class access.',403);return {userId,joinClass:c.id};}const memberships=await this.rows('enrollment:'+userId+':');for(const m of memberships){const c=await this.store.get('class:'+m.classId);if(m.active&&c&&!c.archived)return {userId,joinClass:null};}throw new LibraryError('Use your school email and a class code, or ask your teacher to add you to the roster.',403);}
 async login(action,p,ip){
  ensure(this.config.RESEND_API_KEY&&this.config.EMAIL_FROM,'Email sign-in is not configured.',503);const email=cleanEmail(p.email),userId=await hash(email),now=Date.now();
  if(action==='login-request'){
   await this.rate('send-ip:'+await hash(ip),200);ensure(!teacherEmails(this.config).includes(email),'Choose Teacher sign-in for this account.',400);
   const eligible=await this.eligibleStudent(email,p.classCode),key='student-code:'+userId,prior=await this.store.get(key);
   ensure(!prior||now-prior.createdAt>=60000,'Wait one minute before requesting another code.',429);
   await this.rate('send-email:'+userId,5);await this.rate('daily-email',Math.min(1000,Math.max(100,Number(this.config.STUDENT_EMAIL_DAILY_LIMIT)||500)),DAY);
   const name=text(p.name)||text(email.split('@')[0]);
   const challenge=uid(),code=randomCode();await this.store.put(key,{email,userId,joinClass:eligible.joinClass,joinCode:eligible.joinClass?String(p.classCode).trim().toUpperCase():null,name,challenge,digest:await codeDigest(this.config.RESEND_API_KEY,challenge,code),tries:0,createdAt:now,expiresAt:now+600000});
   return {key,challenge,mail:{from:this.config.EMAIL_FROM,to:[email],subject:'Your QuizDock sign-in code',text:`Your QuizDock sign-in code is ${code}. It expires in 10 minutes. Do not share it. Ignore this message if you did not request it.`}};
  }
  await this.rate('verify-ip:'+await hash(ip),100,600000);const key='student-code:'+userId,c=await this.store.get(key);
  ensure(c&&c.expiresAt>now&&c.tries<6&&c.challenge===p.challenge,'Code expired or invalid. Request a new code.',401);c.tries++;await this.store.put(key,c);
  ensure(/^\d{6}$/.test(String(p.code))&&constantEqual(await codeDigest(this.config.RESEND_API_KEY,c.challenge,String(p.code)),c.digest),'Incorrect code.',401);
  let profile=await this.profile(userId);ensure(!profile?.disabled,'This account has been disabled.',403);
  if(c.joinClass){const klass=await this.store.get('class:'+c.joinClass);ensure(klass&&!klass.archived&&klass.allowCode&&klass.code===c.joinCode,'Class enrollment changed. Request a new code or contact your teacher.',403);ensure(!klass.emailDomain||email.endsWith('@'+klass.emailDomain),'Use your school email.',403);const old=await this.enrollment(userId,c.joinClass);ensure(!old||old.active,'Ask your teacher to restore your class access.',403);await this.enroll(c.joinClass,userId,email,old?.name||c.name);}
  else await this.eligibleStudent(email,null);
  profile=profile||{id:userId,email,name:c.name,points:0,owned:['mint'],skin:'mint',createdAt:now};await this.store.put('account:'+userId,profile);
  const session=uid()+uid();await this.store.put('session:'+await hash(session),{email,owner:userId,kind:'student',issuedAt:now,expiresAt:now+7*DAY});await this.store.delete(key);return response({ok:true},200,{'set-cookie':cookie(session)});
 }
 async home(user){
  const now=Date.now();
  if(user.role==='student')user=await new JourneyService(this.store).sync(user);
  const classes=user.role==='teacher'?(await this.rows('class-owner:'+user.id+':')).filter(c=>!c.archived):await Promise.all((await this.rows('enrollment:'+user.id+':')).filter(m=>m.active).map(async m=>{const c=await this.store.get('class:'+m.classId);return c&&!c.archived?{id:c.id,name:c.name,timezone:c.timezone,semester:assignmentSemester(c,now)}:null;})).then(a=>a.filter(Boolean));
  const result={user,classes:classes.map(c=>({...c,semester:assignmentSemester(c,now)})),assignments:[],liveGames:[],sharedLists:[],studyRewards:[],skins:SKINS,avatarItems:AVATAR_ITEMS,now};
  for(const c of result.classes){
   if(user.role==='student'){const course=await this.store.get('class:'+c.id);result.studyRewards.push(await new StudyRewards(this.store).summary(course,user.id,result.now));}
   for(const a of await this.rows('assignment-index:'+c.id+':')){if(a.archived||user.role==='student'&&a.removedAt)continue;const p=user.role==='student'?await this.store.get(`practice:${a.id}:${user.id}`):null;const week=weekStart(result.now,c.timezone),dueDay=localDay(a.dueAt,c.timezone);result.assignments.push({...submittedAssignment(a,p||{}),className:c.name,dueThisWeek:dueDay>=week&&dueDay<addDays(week,7),overdue:a.dueAt<result.now&&!p?.submittedAt,inCurrentSemester:inCurrentAssignmentSemester(a,c.semester,c.timezone,result.now),creditAvailablePercent:p?.submittedAt?null:availableAssignmentCredit(a,result.now),progress:p?progressSummary(p,a.rules):null});}
   const room=await this.store.get('class-live:'+c.id);if(room&&room.expiresAt>result.now&&!['finished','expired'].includes(room.status))result.liveGames.push({...room,className:c.name});
   const shared=(await this.rows('shared-index:'+c.id+':')).filter(s=>!s.hiddenAt);result.sharedLists.push(...shared.map(s=>({...s,className:c.name})));
  }
  result.assignments.sort((a,b)=>a.dueAt-b.dueAt);return result;
 }
 async assignment(assignmentId,user){const a=await this.store.get('assignment:'+id(assignmentId));ensure(a&&!a.archived,'Assignment is unavailable.',404);await this.course(a.classId,user);ensure(user.role==='teacher'||!a.removedAt,'Your teacher removed this assignment from students. Your saved work is kept.',404);return a;}
 async practice(assignmentId,user){ensure(user.role==='student','Practice submissions require a student account.',403);const a=await this.assignment(assignmentId,user),key=`practice:${a.id}:${user.id}`,prior=await this.store.get(key),p=prior||{assignmentId:a.id,userId:user.id,answered:0,correct:0,activeMs:0,cardStats:{},questionKey:uid(),feedback:null,createdAt:Date.now(),lastBeat:0,lastAnswer:Date.now(),lastMutation:null,lease:null};
  // Keep a pre-update active prompt/feedback attached to its original card.
  if(p.cardIndex===undefined){if(prior)p.cardIndex=(p.answered-(p.feedback?1:0))%a.cards.length;else this.nextPracticeCard(a,p);}
  return {a,key,p};
 }
 nextPracticeCard(a,p){const draw=drawShuffledCard(p.cardCycle,a.cards.map((_,i)=>i),p.cardIndex);p.cardIndex=draw.index;p.cardCycle=draw.cycle;}
 practiceWord(a,p){const card=a.cards[p.cardIndex],answers=correctAnswers(card);return {room:{status:'playing',questions:[{text:card.prompt,answers,correct:answers.map((_,i)=>i),image:card.image,imageAlt:card.imageAlt,hint:card.hint,example:card.example,repair:card.repair,parts:card.parts}],expedition:{},settings:{wordActivity:p.wordActivity||'forge'}},player:{current:{key:p.questionKey,index:0},feedback:p.feedback,wordPuzzle:p.wordPuzzle?.key===p.questionKey?p.wordPuzzle:{key:p.questionKey,guesses:[],misses:0}}};}
 viewPractice(a,p){const card=a.cards[p.cardIndex],word=this.practiceWord(a,p);return {assignment:publicAssignment(submittedAssignment(a,p)),progress:progressSummary(p,a.rules),lease:p.lease,question:p.submittedAt?null:{key:p.questionKey,cardId:card.id,number:(p.answered-(p.feedback?1:0))%a.cards.length+1,prompt:card.prompt,image:card.image,imageAlt:card.imageAlt},word:p.submittedAt?null:{...publicWordQuestion(word.room,word.player),...(p.wordCrossword?{crossword:publicCrossword(p.wordCrossword,a.cards.map((c,i)=>p.cardStats[c.id]?.correct?i:-1).filter(i=>i>=0),p.cardIndex)}:{}),chain:p.wordChain||0},feedback:p.feedback,...(a.rules.crosswordWords?{crossword:p.submittedAt?null:publicAssignmentCrossword(a,p)}:{}),clock:{milliseconds:p.activeMs||0,eligible:!!p.focusActive}};}
 async generateCrossword(a,user,dimension,previous=null){
  const existing=new Set((await this.rows('practice:'+a.id+':',201)).filter(v=>v.userId!==user.id&&v.assignmentCrossword).map(v=>crosswordLayoutKey(v.assignmentCrossword)));if(previous)existing.add(crosswordLayoutKey(previous));
  let puzzle;for(let attempt=0;attempt<12;attempt++){puzzle=createAssignmentCrossword(a,(min,max)=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return min+n[0]%(max-min+1);},dimension);if(!existing.has(crosswordLayoutKey(puzzle)))break;}
  puzzle.week=weekStart(a.dueAt,a.timezone);return puzzle;
 }
 async practiceAction(action,payload,user){
  const {a,key,p}=await this.practice(payload.assignmentId,user),now=Date.now();
  const syncPuzzle=()=>{const changed=syncAssignmentCrossword(a,p,(min,max)=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return min+n[0]%(max-min+1);});return reconcileCrosswordDraft(a,p,{bump:changed})||changed;};
  if(action==='practice-open'){syncPuzzle();p.lease=uid();p.lastBeat=now;p.lastAnswer=now;p.focusActive=false;p.focusVersion=0;await this.store.put(key,p);return this.viewPractice(a,p);}
  ensure(payload.lease&&payload.lease===p.lease,'Practice was opened in another tab. Reopen it here to continue.',409);
  if(syncPuzzle())await this.store.put(key,p);
  if(action==='practice-status')return this.viewPractice(a,p);
  if(action==='practice-submit'){
   if(p.submittedAt)return this.viewPractice(a,p);ensureAssignmentRevision(a,payload);ensure(progressSummary(p,a.rules).ready,'Meet the time, answered-card and accuracy requirements before submitting.',409);
   if(payload.method==='crossword')ensure(progressSummary(p,a.rules).crossword?.ready,'Complete and check the crossword before submitting it.',409);
   if(a.rules.crosswordWords){const summary=progressSummary(p,a.rules);p.completionMethod=payload.method==='crossword'&&summary.crossword.ready||!summary.typedReady&&summary.crossword.ready?'crossword':'typed';}
   p.submission=submissionSnapshot(a);p.submittedAt=now;p.late=now>a.dueAt;p.creditPercent=availableAssignmentCredit(a,now);await this.store.put(key,p);return this.viewPractice(a,p);
  }
  ensure(!p.submittedAt,'This practice has already been submitted.',409);
  if(action==='practice-crossword-open'){
   ensure(a.rules.crosswordWords>0,'Your teacher has not enabled Crossword Mode for this assignment.');
   const dimension=payload.dimension??(p.assignmentCrossword?p.assignmentCrossword.dimension||2:3);
   ensure(dimension===2||dimension===3,'Choose a 2D or 3D crossword.');
   if(!p.assignmentCrossword)p.assignmentCrossword=await this.generateCrossword(a,user,payload.dimension??3);
   else ensure((p.assignmentCrossword.dimension||2)===dimension,'Your saved crossword uses a different mode. Resume it or confirm starting over.',409);
   if(payload.grid===true)reconcileCrosswordDraft(a,p,{enable:true,now});
   await this.store.put(key,p);return this.viewPractice(a,p);
  }
  if(action==='practice-crossword-reset'){
   ensure(a.rules.crosswordWords>0,'Your teacher has not enabled Crossword Mode for this assignment.');
   const mutationId=id(payload.mutationId),dimension=payload.dimension,x=p.assignmentCrossword;
   ensure(dimension===2||dimension===3,'Choose a 2D or 3D crossword.');ensure(payload.confirm==='CLEAR CROSSWORD PROGRESS','Confirm that starting over clears the current crossword.');
   if(p.lastCrosswordReset?.id===mutationId){ensure(p.lastCrosswordReset.dimension===dimension&&p.lastCrosswordReset.fromPuzzleId===payload.puzzleId&&p.lastCrosswordReset.toPuzzleId===x?.id,'That restart identifier was already used.',409);return this.viewPractice(a,p);}
   ensureAssignmentRevision(a,payload);ensure(x&&x.id===payload.puzzleId,'Your crossword changed. Reopen it before starting over.',409);
   ensure(payload.draftRevision===(x.gridDraft?.revision??0),'More letters were saved. Reopen the warning before clearing your progress.',409);
   p.assignmentCrossword=await this.generateCrossword(a,user,dimension,x);reconcileCrosswordDraft(a,p,{enable:true,now});
   p.lastCrosswordReset={id:mutationId,dimension,fromPuzzleId:x.id,toPuzzleId:p.assignmentCrossword.id};p.updatedAt=now;
   await this.store.put(key,p);return this.viewPractice(a,p);
  }
  if(action==='practice-crossword-draft'){
   ensureAssignmentRevision(a,payload);await saveCrosswordDraft(a,p,payload,now);await this.store.put(key,p);return {puzzleId:p.assignmentCrossword.id,draft:publicAssignmentCrossword(a,p).draft};
  }
  if(action==='practice-crossword-check'){
   const retry=p.assignmentCrossword?.gridChecks?.some(r=>r.id===payload.mutationId);if(!retry)ensureAssignmentRevision(a,payload);
   ensure(a.rules.crosswordWords>0||retry,'Crossword Mode is not enabled for this assignment.');const result=checkCrosswordGrid(a,p,payload,now);
   if(result.answered)await new LeagueService(this.store).award(await this.course(a.classId,user),user.id,{answered:result.answered,correct:result.correct});
   await this.store.put(key,p);return this.viewPractice(a,p);
  }
  if(action==='practice-crossword-answer'){
   ensure(!p.assignmentCrossword?.gridMode,'Crossword Mode checks the whole grid. Refresh this page to use the crossword squares.',412);
   const retry=p.assignmentCrossword?.receipts.some(r=>r.id===payload.mutationId)||p.assignmentCrossword?.solved.includes(Number(payload.entry));
   if(!retry){ensureAssignmentRevision(a,payload);ensure(a.rules.crosswordWords>0,'Crossword Mode is not enabled for this assignment.');}const before=p.correct,answeredBefore=p.answered;checkCrosswordAnswer(a,p,payload,now);if(p.answered>answeredBefore)await new LeagueService(this.store).award(await this.course(a.classId,user),user.id,{answered:p.answered-answeredBefore,correct:p.correct-before});await this.store.put(key,p);return this.viewPractice(a,p);
  }
  if(action==='practice-activity'){ensure(payload.questionKey===p.questionKey&&!p.feedback,'This prompt is no longer active.',409);ensure(WORD_ACTIVITIES.includes(payload.activity),'Choose a word activity.');p.wordActivity=payload.activity;if(payload.activity==='crossword'&&!p.wordCrossword)p.wordCrossword=makeCrossword(a.cards.map(c=>({text:c.prompt,answers:correctAnswers(c),correct:correctAnswers(c).map((_,i)=>i)})),(min,max)=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return min+a[0]%(max-min+1);});await this.store.put(key,p);return this.viewPractice(a,p);}
  if(action==='practice-letter'){
   ensure(payload.questionKey===p.questionKey&&!p.feedback,'This prompt is no longer active.',409);
   const word=this.practiceWord(a,p);guessWordLetter(word.room,word.player,p.questionKey,payload.letter);p.wordPuzzle=word.player.wordPuzzle;await this.store.put(key,p);return this.viewPractice(a,p);
  }
  if(action==='practice-tick'){
   const metadata=payload.assignmentRevision!==undefined&&payload.assignmentRevision!==assignmentRevision(a)?{assignment:publicAssignment(a)}:{};
   // Never trust a client-supplied duration. Only count bounded, connected, active intervals.
   if(Number.isInteger(payload.focusVersion)&&payload.focusVersion<(p.focusVersion||0))return {progress:progressSummary(p,a.rules),clock:{milliseconds:p.activeMs,eligible:!!p.focusActive},...metadata};
   const sameFocus=payload.focusVersion===undefined||payload.focusVersion===(p.focusVersion||0);
   const elapsed=now-p.lastBeat,focusEligible=sameFocus&&(payload.focused===undefined||(payload.focused===true&&p.focusActive===true));
   const closing=payload.closing===true&&p.focusActive===true&&payload.active===false&&(sameFocus||payload.focusVersion===(p.focusVersion||0)+1);
   const clientBound=Number.isFinite(payload.elapsedMs)?Math.max(0,payload.elapsedMs):15000;
   if((payload.active===true&&focusEligible||closing)&&elapsed>=0&&elapsed<=25000&&now-p.lastAnswer<=120000)p.activeMs+=Math.min(elapsed,15000,clientBound);
   p.focusActive=payload.focused===true&&payload.active===true&&now-p.lastAnswer<=120000;if(Number.isInteger(payload.focusVersion))p.focusVersion=payload.focusVersion;
   p.lastBeat=now;p.updatedAt=now;await this.store.put(key,p);return {progress:progressSummary(p,a.rules),clock:{milliseconds:p.activeMs,eligible:!!p.focusActive},...metadata};
  }
  if(action==='practice-next'){ensure(p.feedback,'Answer the current prompt first.',409);this.nextPracticeCard(a,p);p.feedback=null;p.questionKey=uid();await this.store.put(key,p);return this.viewPractice(a,p);}
  ensure(action==='practice-answer','Unknown practice action.');const mutationId=id(payload.mutationId);
  if(p.lastMutation===mutationId){ensure(p.lastInput===String(payload.answer),'That answer identifier was already used.',409);return this.viewPractice(a,p);}
  ensureAssignmentRevision(a,payload);
  ensure(!p.feedback&&payload.questionKey===p.questionKey,'This prompt is no longer active. Refresh practice.',409);
  ensure(now-(p.lastSubmittedAt||0)>=500,'Please answer a little more slowly.',429);const input=String(payload.answer??'').trim();ensure(input.length>0&&input.length<=300,'Type an answer of 1–300 characters.');
  const card=a.cards[p.cardIndex],graded=gradeTyped(card,input,a.rules),stats=p.cardStats[card.id]||{prompt:card.prompt,correct:0,incorrect:0,firstCorrect:graded.correct};
  if(graded.correct){stats.correct++;p.correct++;}else stats.incorrect++;p.cardStats[card.id]=stats;p.answered++;p.wordChain=graded.correct?(p.wordChain||0)+1:0;
  p.feedback={correct:graded.correct,expected:graded.expected,answer:input,prompt:card.prompt};p.lastMutation=mutationId;p.lastInput=String(payload.answer);p.lastAnswer=now;p.lastSubmittedAt=now;p.updatedAt=now;
  await new LeagueService(this.store).award(await this.course(a.classId,user),user.id,{answered:1,correct:Number(graded.correct)});
  await this.store.put(key,p);return this.viewPractice(a,p);
 }
 async recordOutcome(outcome,owner,{leagueTracked=false}={}){
  ensure(outcome&&/^[a-zA-Z0-9_-]{8,80}$/.test(outcome.id)&&Array.isArray(outcome.players)&&outcome.players.length<=45,'Invalid round outcome.');
  if(await this.store.get('outcome:'+outcome.id)||await this.store.get('outcome-settled:'+outcome.id)||await this.store.get(`round-deleted:${owner}:${outcome.id}`))return;
  const c=outcome.classId?await this.store.get('class:'+outcome.classId):null;ensure(!outcome.classId||c?.ownerId===owner,'Class does not belong to the round owner.',403);
  const players=[];const seen=new Set();for(const raw of outcome.players){
   if(!raw.accountId||seen.has(raw.accountId))continue;ensure(/^[a-f0-9]{64}$/.test(raw.accountId),'Invalid player identity.');
   const profile=await this.profile(raw.accountId);if(!profile||profile.createdAt>outcome.startedAt)continue;const membership=c?await this.enrollment(raw.accountId,c.id):null;if(c&&!membership?.active)continue;
   ensure(Number.isSafeInteger(raw.answered)&&raw.answered>=0&&Number.isSafeInteger(raw.correct)&&raw.correct>=0&&raw.correct<=raw.answered&&Number.isFinite(raw.score)&&raw.score>=0,'Invalid player totals.');
   seen.add(raw.accountId);players.push({accountId:raw.accountId,name:membership?.name||profile.name,email:profile.email,score:raw.score,answered:raw.answered,correct:raw.correct});
  }
  ensure(Number.isFinite(outcome.finishedAt),'Finished time required.');const record={id:outcome.id,ownerId:owner,classId:c?.id||null,mode:text(outcome.mode,30),title:text(outcome.title,100),finishedAt:outcome.finishedAt,startedAt:outcome.startedAt,players};
  await this.store.put('outcome-settled:'+record.id,true);await this.store.put('outcome:'+record.id,record);await this.store.put(`outcome-index:${owner}:${record.id}`,record);await this.store.put(`outcome-week:${owner}:${weekStart(record.finishedAt,DEFAULT_ZONE)}:${record.id}`,record);if(c)await this.store.put(`class-outcome-week:${owner}:${c.id}:${weekStart(record.finishedAt,c.timezone)}:${record.id}`,record);
  for(const p of rankedParticipants(players)){
   if(c&&!leagueTracked)await new LeagueService(this.store).credit(c,p.accountId,p.correct,record.finishedAt);
   const profile=await this.profile(p.accountId),day=localDay(record.finishedAt,c?.timezone||DEFAULT_ZONE),dk=`reward-day:${p.accountId}:${day}`,prior=await this.store.get(dk)||0;
   const amount=p.correct?Math.min(Math.max(0,250-prior),Math.min(100,p.correct*2)+({1:15,2:10,3:5}[p.rank]||0)):0;
   profile.points+=amount;await this.store.put({['account:'+p.accountId]:profile,[dk]:prior+amount,[`reward:${p.accountId}:${record.id}`]:{roundId:record.id,amount,at:record.finishedAt}});
  }
 }
 async route(action,p={},token='',ip='unknown',googleIdentity=null){
  if(action==='google-start')return startGoogleLogin(this,p,ip);
  if(action==='google-signin')return finishGoogleLogin(this,p,googleIdentity,ip);
  if(action==='class-invite'){const c=await this.byCode(p.code);return response({name:c.name});}
  if(action==='login-request'||action==='login-verify'){ensure(!this.config.GOOGLE_CLIENT_ID,'Use Sign in with Google for student accounts.',400);return this.login(action,p,ip);}
  if(action==='status'){let user=null;try{user=await this.identity(token);}catch{}return response({configured:!!(this.config.RESEND_API_KEY&&this.config.EMAIL_FROM),googleConfigured:!!this.config.GOOGLE_CLIENT_ID,user});}
  const user=await this.identity(token);
  if(action==='league-home'||action==='league-settings'){
   const course=await this.course(p.classId,user,user.role==='teacher');
   if(action==='league-settings'){this.teacher(user);ensure(typeof p.enabled==='boolean','Choose whether leagues are enabled.');ensure(p.tier===undefined||Number.isInteger(Number(p.tier))&&Number(p.tier)>=0&&Number(p.tier)<LEAGUE_TIERS.length,'Choose a listed league.');await new LeagueService(this.store).sync(course);course.leagues={enabled:p.enabled};await this.store.put({['class:'+course.id]:course,['class-owner:'+user.id+':'+course.id]:course});}
   return response(await new LeagueService(this.store).view(course,user,p.tier));
  }
  if(action.startsWith('expedition-'))return response(await new ExpeditionService(this.store,this).route(action.slice(11),p,user));
  if(action==='home')return response(await this.home(user));
  if(action==='join-class'){await this.rate('join:'+user.id,15);const c=await this.byCode(p.code,user.email),old=await this.enrollment(user.id,c.id);ensure(!old||old.active,'Ask your teacher to restore your class access.',403);await this.enroll(c.id,user.id,user.email,old?.name||user.name);return response({ok:true});}
  if(action==='create-class'){
   this.teacher(user);const existing=await this.rows('class-owner:'+user.id+':',101);ensure(existing.length<100,'Maximum 100 classes.');const name=text(p.name);ensure(name,'Name your class.');const classId=uid(),code=uid().replaceAll('-','').slice(0,10).toUpperCase();const emailDomain=text(p.emailDomain,100).toLowerCase();ensure(!emailDomain||/^[a-z0-9.-]+\.[a-z]{2,}$/.test(emailDomain),'Enter a school domain without @.');const c={id:classId,name,ownerId:user.id,code,timezone:zone(p.timezone||DEFAULT_ZONE),emailDomain,allowCode:p.allowCode!==false,createdAt:Date.now()};c.semester=p.semester?validateSemester(p.semester):assignmentSemester(c);await this.store.put({['class:'+classId]:c,['class-owner:'+user.id+':'+classId]:c,['class-code:'+code]:classId});return response({class:c});
  }
  if(action==='class-detail'){const c=await this.course(p.classId,user,true),members=await Promise.all((await this.rows('member:'+c.id+':',201)).filter(m=>!m.erased).map(async member=>{const profile=await this.profile(member.userId);return {...member,appearance:{skin:profile?.owned?.includes(profile.skin)?profile.skin:'mint',equipment:ownedEquipment(profile||{})}};}));return response({class:c,members,sharedLists:await this.rows('shared-index:'+c.id+':')});}
  if(action==='set-semester'){
   const c=await this.course(p.classId,user,true);c.semester=validateSemester(p.semester);
   await this.store.put({['class:'+c.id]:c,['class-owner:'+user.id+':'+c.id]:c});return response({class:c});
  }
  if(action==='roster-add'){
   const c=await this.course(p.classId,user,true);ensure(Array.isArray(p.students)&&p.students.length<=100,'Add at most 100 students at once.');const validated=p.students.map(r=>({email:cleanEmail(r.email),name:text(r.name)}));for(const r of validated){ensure(r.name.length>=2,'Every roster entry needs a name.');if(c.emailDomain)ensure(r.email.endsWith('@'+c.emailDomain),'A roster email does not match the school domain.');}
   const ids=await Promise.all(validated.map(r=>hash(r.email))),existing=new Set((await this.rows('member:'+c.id+':',201)).map(m=>m.userId));ensure(new Set([...existing,...ids]).size<=200,'This roster would exceed the 200-student limit.');for(let i=0;i<validated.length;i++){const r=validated[i];await this.enroll(c.id,ids[i],r.email,r.name);}return response({ok:true});
  }
  if(action==='roster-remove'){const c=await this.course(p.classId,user,true),m=await this.enrollment(id(p.userId),c.id);ensure(m,'Student not found.',404);m.active=false;await this.store.put({[`member:${c.id}:${m.userId}`]:m,[`enrollment:${m.userId}:${c.id}`]:m});return response({ok:true});}
  if(action==='class-close-enrollment'){const c=await this.course(p.classId,user,true);c.allowCode=false;await this.store.put({['class:'+c.id]:c,['class-owner:'+user.id+':'+c.id]:c});return response({ok:true});}
  if(action==='class-rotate-code'){const c=await this.course(p.classId,user,true);await this.store.delete('class-code:'+c.code);c.code=uid().replaceAll('-','').slice(0,10).toUpperCase();c.allowCode=true;await this.store.put({['class:'+c.id]:c,['class-owner:'+user.id+':'+c.id]:c,['class-code:'+c.code]:c.id});return response({class:c});}
  if(action==='share-list'||action==='create-assignment'){
   this.teacher(user);const c=await this.course(p.classId,user,true),list=await new ListRepository(this.store,user.id).get(p.listId);ensure(list.cards.length,'This list has no cards.');
   if(action==='share-list'){const previous=await this.store.get(`shared:${c.id}:${list.id}`),sharingVersion=previous?(previous.sharingVersion||1)+1:1;const data={sharingVersion,classId:c.id,listId:list.id,revision:list.revision,title:list.title,cards:structuredClone(list.cards)},index={classId:c.id,listId:list.id,title:list.title,count:list.cards.length,revision:list.revision,sharingVersion};await this.store.put({[`shared:${c.id}:${list.id}`]:data,[`shared-index:${c.id}:${list.id}`]:index});return response({ok:true});}
   const dueAt=dateTimeInZone(p.dueLocal,c.timezone),rules=practiceRules(p.rules),title=text(p.title,100)||list.title;ensure(rules.cardCountMode!=='distinct'||rules.minCards<=list.cards.length,'Distinct-card minimum cannot exceed the number of cards in the list.');ensure(dueAt>Date.now()-365*DAY&&dueAt<Date.now()+730*DAY,'Choose a due date within the supported range.');
   if(rules.crosswordWords)ensure(rules.crosswordWords<=connectedCrosswordCapacity(list.cards),`This deck has ${connectedCrosswordCapacity(list.cards)} answers in its largest connected word group. Choose that many words or fewer (2–32 letters each).`);
   const a={id:uid(),revision:1,classId:c.id,ownerId:user.id,title,listId:list.id,listRevision:list.revision,cards:structuredClone(list.cards),rules,dueAt,timezone:c.timezone,createdAt:Date.now()};await this.store.put({['assignment:'+a.id]:a,[`assignment-index:${c.id}:${a.id}`]:publicAssignment(a)});return response({assignment:publicAssignment(a)});
  }
  if(action==='assignment-visibility'){
   this.teacher(user);const a=await this.assignment(p.assignmentId,user);await this.course(a.classId,user,true);ensure(a.ownerId===user.id,'This assignment belongs to another teacher.',403);const before=submissionSnapshot(a),changed=changeContentVisibility(a,p);
   if(changed){for(const attempt of await this.rows('practice:'+a.id+':',201))if(attempt.submittedAt&&!attempt.submission){attempt.submission=before;await this.store.put(`practice:${a.id}:${attempt.userId}`,attempt);}await this.store.put({['assignment:'+a.id]:a,[`assignment-index:${a.classId}:${a.id}`]:publicAssignment(a)});}
   return response({assignment:publicAssignment(a)});
  }
  if(action==='class-list-visibility'){
   this.teacher(user);const c=await this.course(p.classId,user,true),listId=id(p.listId),key=`shared:${c.id}:${listId}`,deck=await this.store.get(key);ensure(deck,'Shared list not found.',404);const changed=changeContentVisibility(deck,p,{versionField:'sharingVersion',hiddenField:'hiddenAt'});
   if(changed){const index={classId:c.id,listId,title:deck.title,count:deck.cards.length,revision:deck.revision,sharingVersion:deck.sharingVersion,...(deck.hiddenAt?{hiddenAt:deck.hiddenAt}:{})};await this.store.put({[key]:deck,[`shared-index:${c.id}:${listId}`]:index});}
   return response({ok:true,sharingVersion:deck.sharingVersion||1,visible:!deck.hiddenAt});
  }
  if(action==='assignment-detail'||action==='update-assignment'){
   this.teacher(user);const a=await this.assignment(p.assignmentId,user);await this.course(a.classId,user,true);ensure(a.ownerId===user.id,'This assignment belongs to another teacher.',403);
   if(action==='update-assignment')ensure(!a.removedAt,'Restore the assignment before editing it.',409);
   if(action==='assignment-detail')return response({assignment:publicAssignment(a),crosswordEligibleCount:connectedCrosswordCapacity(a.cards)});
   const mutationId=id(p.mutationId),changes=assignmentEdits(a,p),digest=await hash(JSON.stringify(changes));
   if(a.lastEditMutation?.id===mutationId){ensure(a.lastEditMutation.digest===digest,'That save identifier was already used for different settings.',409);return response({assignment:publicAssignment(a)});}
   ensure(Number.isSafeInteger(p.revision)&&p.revision===assignmentRevision(a),'This assignment changed in another tab. Reload the posted settings before saving.',409);
   if(JSON.stringify({title:a.title,dueAt:a.dueAt,rules:a.rules})===JSON.stringify(changes))return response({assignment:publicAssignment(a)});
   for(const attempt of await this.rows('practice:'+a.id+':',201))if(attempt.submittedAt&&!attempt.submission){attempt.submission=submissionSnapshot(a);await this.store.put(`practice:${a.id}:${attempt.userId}`,attempt);}
   Object.assign(a,changes,{revision:assignmentRevision(a)+1,updatedAt:Date.now(),lastEditMutation:{id:mutationId,digest}});
   await this.store.put({['assignment:'+a.id]:a,[`assignment-index:${a.classId}:${a.id}`]:publicAssignment(a)});return response({assignment:publicAssignment(a)});
  }
  if(action.startsWith('practice-'))return response(await this.practiceAction(action,p,user));
  if(action==='assignment-report'){
   this.teacher(user);const a=await this.assignment(p.assignmentId,user);await this.course(a.classId,user,true);const members=await this.rows('member:'+a.classId+':',201),attempts=await this.rows('practice:'+a.id+':',201),map=new Map(attempts.map(x=>[x.userId,x]));const cards=a.cards.map(c=>({id:c.id,prompt:c.prompt,correct:0,incorrect:0,firstCorrect:0,firstAttempts:0}));
   for(const attempt of attempts)for(const c of cards){const s=attempt.cardStats[c.id];if(s){c.correct+=s.correct;c.incorrect+=s.incorrect;c.firstAttempts++;c.firstCorrect+=Number(s.firstCorrect);}}
   return response({assignment:publicAssignment(a),students:members.filter(m=>!m.erased).map(m=>({...m,progress:progressSummary(map.get(m.userId)||{},a.rules),liveCrossword:crosswordDraftAssessment(a,map.get(m.userId)||{})})),cards});
  }
  if(action==='solo-open'){
   await this.course(p.classId,user);const deck=await this.store.get(`shared:${id(p.classId)}:${id(p.listId)}`);ensure(deck&&!deck.hiddenAt,'This list is not shared with your class.',404);
   const category=p.category||'all';ensure(category==='all'||CARD_CATEGORIES.includes(category),'Choose Grammar, Vocabulary, Culture, or All categories.');
   const categories=Object.fromEntries(['all',...CARD_CATEGORIES].map(c=>[c,c==='all'?deck.cards.length:deck.cards.filter(card=>card.category===c).length]));
   const progress=await this.store.get(`solo:${user.id}:${p.classId}:${p.listId}`)||{index:0,known:[],again:[]},cards=deck.cards.filter(card=>(category==='all'||card.category===category)&&(!p.recovery||(progress.cardStats?.[card.id]?.misses||0)>(progress.cardStats?.[card.id]?.recoveries||0)));const {lastVisibilityMutation,...visibleDeck}=deck;return response({deck:{...visibleDeck,cards},category,categories,recovery:!!p.recovery,progress});
  }
  if(action==='solo-review'){
   ensure(user.role==='student','Use a student account for independent practice.',403);const course=await this.course(p.classId,user),deck=await this.store.get(`shared:${course.id}:${id(p.listId)}`);ensure(deck&&!deck.hiddenAt,'This list is not currently shared with your class.',404);const card=deck.cards.find(c=>c.id===p.cardId);ensure(card&&['known','again'].includes(p.mark),'Choose a card and a review result.');const mutationId=id(p.mutationId),receiptKey=`study-attempt:${course.id}:${user.id}:${mutationId}`,receipt=await this.store.get(receiptKey);
   if(receipt){ensure(receipt.kind==='review'&&receipt.cardId===card.id&&receipt.listId===deck.listId&&receipt.mark===p.mark,'That review identifier was already used.',409);return response({ok:true,duplicate:true});}
   const key=`solo:${user.id}:${course.id}:${deck.listId}`,progress=await this.store.get(key)||{index:0,known:[],again:[]};ensure(Date.now()-(progress.lastReviewAt||0)>=500,'Take a moment to review the next card.',429);await this.rate('solo-review:'+user.id,120);
   progress.known=(progress.known||[]).filter(v=>v!==card.id);progress.again=(progress.again||[]).filter(v=>v!==card.id);progress[p.mark].push(card.id);progress.lastReviewAt=Date.now();progress.updatedAt=Date.now();await new LeagueService(this.store).award(course,user.id,{reviews:1});await this.store.put({[key]:progress,[receiptKey]:{kind:'review',classId:course.id,userId:user.id,listId:deck.listId,cardId:card.id,mark:p.mark,at:Date.now()}});return response({ok:true});
  }
  if(action==='solo-answer'){
   ensure(user.role==='student','Use a student account for independent practice.',403);const course=await this.course(p.classId,user),deck=await this.store.get(`shared:${id(p.classId)}:${id(p.listId)}`);ensure(deck&&!deck.hiddenAt,'This list is not currently shared with your class.',404);const card=deck.cards.find(c=>c.id===p.cardId);ensure(card,'This card is not in the shared list.',404);const key=`solo:${user.id}:${p.classId}:${p.listId}`,progress=await this.store.get(key)||{index:0,known:[],again:[]},mutationId=id(p.mutationId),answer=String(p.answer??'').trim();ensure(answer&&answer.length<=300,'Type an answer of 1–300 characters.');
   const receiptKey=`study-attempt:${course.id}:${user.id}:${mutationId}`,receipt=await this.store.get(receiptKey);if(receipt){ensure(receipt.cardId===card.id&&receipt.answer===answer,'That answer identifier was already used.',409);return response({feedback:receipt.feedback,studyRewards:await new StudyRewards(this.store).summary(course,user.id)});}
   ensure(Date.now()-(progress.lastTyped?.at||0)>=500,'Take a moment before checking another answer.',429);
   const checked=p.reverse?{type:'pair',answer:card.prompt,alternatives:[]}:card,feedback={...gradeTyped(checked,answer,{strictAccents:p.strictAccents!==false}),answer};progress.cardStats=progress.cardStats||{};const stat=progress.cardStats[card.id]||{misses:0,recoveries:0};if(!feedback.correct)stat.misses++;else if(stat.recoveries<stat.misses)stat.recoveries++;progress.cardStats[card.id]=stat;progress.lastTyped={id:mutationId,cardId:card.id,answer,feedback,at:Date.now()};await this.store.put({[key]:progress,[receiptKey]:{classId:course.id,userId:user.id,listId:deck.listId,cardId:card.id,answer,feedback,at:Date.now()}});await new StudyRewards(this.store).credit(course,user.id,1);await new LeagueService(this.store).award(course,user.id,{answered:1,correct:Number(feedback.correct)});return response({feedback,studyRewards:await new StudyRewards(this.store).summary(course,user.id)});
  }
  if(action==='study-rewards'||action==='study-rewards-settings'||action==='study-rewards-claim'){
   this.teacher(user);const course=await this.course(p.classId,user,true),rewards=new StudyRewards(this.store);
   if(action==='study-rewards-settings'){course.studyRewards=rewardPolicy(p);await this.store.put({['class:'+course.id]:course,['class-owner:'+user.id+':'+course.id]:course});return response({ok:true,policy:course.studyRewards});}
   if(action==='study-rewards-claim'){const member=await this.enrollment(id(p.userId),course.id);ensure(member?.active,'Student is not in this class.',403);const receipt=await rewards.claim(course,member.userId,id(p.awardId),id(p.requestId),user.id);return response({ok:true,receipt});}
   const members=(await this.rows('member:'+course.id+':',201)).filter(m=>m.active&&!m.erased);return response({class:course,students:await Promise.all(members.map(async m=>({userId:m.userId,name:m.name,email:m.email,...await rewards.summary(course,m.userId)})))});
  }
  if(action==='solo-save'){
   await this.course(p.classId,user);const deck=await this.store.get(`shared:${id(p.classId)}:${id(p.listId)}`);ensure(deck&&!deck.hiddenAt,'This list is not currently shared with your class.',404);const allowed=new Set(deck.cards.map(c=>c.id));const clean=x=>Array.isArray(x)?[...new Set(x)].filter(v=>allowed.has(v)).slice(0,250):[];const prior=await this.store.get(`solo:${user.id}:${p.classId}:${p.listId}`);const progress={...prior,...(prior?.cardStats?{cardStats:prior.cardStats}:{}),...(prior?.lastTyped?{lastTyped:prior.lastTyped}:{}),index:Math.max(0,Math.min(deck.cards.length-1,Math.floor(Number(p.index)||0))),known:clean(p.known),again:clean(p.again),updatedAt:Date.now()};await this.store.put(`solo:${user.id}:${p.classId}:${p.listId}`,progress);return response({ok:true});
  }
  if(['buy-item','equip-item','remove-item'].includes(action)){
   const profile=await this.profile(user.id),owned=Array.isArray(profile.ownedItems)?profile.ownedItems:[],equipment=ownedEquipment(profile);
   if(action==='remove-item'){ensure(Object.hasOwn(ITEM_SLOTS,p.slot),'Choose a valid item slot.');delete equipment[p.slot];}
   else{
    const item=itemById(p.itemId);ensure(item,'Unknown avatar item.');
    if(action==='buy-item'&&!owned.includes(item.id)){ensure(!item.quest,'Earn this accessory through its expedition quest.',403);ensure(Number.isSafeInteger(profile.points)&&profile.points>=item.price,'You need more character points.');profile.points-=item.price;owned.push(item.id);}
    ensure(owned.includes(item.id),'Unlock this item first.',403);equipment[item.slot]=item.id;
   }
   profile.ownedItems=owned;profile.equipment=equipment;if(owned.includes(profile.wardrobeGoal))delete profile.wardrobeGoal;await this.store.put('account:'+user.id,profile);return response({user:await new JourneyService(this.store).sync({...profile,role:user.role})});
  }
  if(action==='item-goal'){
   const profile=await this.profile(user.id),item=p.itemId?itemById(p.itemId):null;
   if(p.itemId){ensure(item&&!item.quest,'Choose a shop item as your savings goal.');ensure(!profile.ownedItems?.includes(item.id),'You already own this item.');profile.wardrobeGoal=item.id;}else delete profile.wardrobeGoal;
   await this.store.put('account:'+user.id,profile);return response({user:await new JourneyService(this.store).sync({...profile,role:user.role})});
  }
  if(action==='buy-skin'||action==='equip-skin'){
   const skin=SKINS.find(s=>s.id===p.skinId);ensure(skin,'Unknown character skin.');const profile=await this.profile(user.id);
   if(action==='buy-skin'&&!profile.owned.includes(skin.id)){ensure(profile.points>=skin.price,'You need more reward points.');profile.points-=skin.price;profile.owned.push(skin.id);}
   ensure(profile.owned.includes(skin.id),'Unlock this skin first.',403);profile.skin=skin.id;await this.store.put('account:'+user.id,profile);return response({user:await new JourneyService(this.store).sync({...profile,role:user.role})});
  }
  if(action==='raffle-preview'||action==='raffle-draw'||action==='raffle-history'){
   this.teacher(user);let timezone=DEFAULT_ZONE;if(p.classId){const c=await this.course(p.classId,user,true);timezone=c.timezone;}
   const selectedWeek=p.week||weekStart(Date.now(),timezone);ensure(/^\d{4}-\d\d-\d\d$/.test(selectedWeek)&&weekStart(Date.parse(selectedWeek+'T12:00:00Z'),'UTC')===selectedWeek,'Choose a Monday as the week start.');
   if(action==='raffle-history')return response({draws:await this.rows('raffle:'+user.id+':',500)});
   const prefix=p.classId?`class-outcome-week:${user.id}:${p.classId}:${selectedWeek}:`:`outcome-week:${user.id}:${selectedWeek}:`;const rounds=await this.rows(prefix,2001);ensure(rounds.length<=2000,'This week exceeds the supported 2,000-round raffle limit. Choose a single class.',409);const policy=p.policy||'podium',entries=raffleEntries(rounds,policy);
   if(action==='raffle-preview')return response({entries,totalTickets:entries.reduce((n,e)=>n+e.tickets,0),roundCount:rounds.length,week:selectedWeek,timezone});
   const requestId=id(p.requestId),key=`raffle:${user.id}:${requestId}`,prior=await this.store.get(key);if(prior)return response({draw:prior});
   const winner=weightedWinner(entries),draw={id:requestId,classId:p.classId||null,week:selectedWeek,timezone,policy,entries,winner:{accountId:winner.accountId,name:winner.name},roundIds:rounds.map(r=>r.id),drawnAt:Date.now()};await this.store.put(key,draw);return response({draw});
  }
  throw new LibraryError('Unknown classroom action.',404);
 }
}
