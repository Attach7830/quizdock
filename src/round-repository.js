import {ensure,LibraryError} from './library-domain.js';
const id=value=>{ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(String(value||'')),'Invalid round identifier.');return String(value);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const ratio=(a,b)=>b?100*a/b:null;
export function validateReport(input){
  ensure(input&&typeof input==='object'&&!Array.isArray(input),'Invalid round report.');
  const r=structuredClone(input);id(r.id);
  ensure(Number.isSafeInteger(r.revision)&&r.revision>0,'Invalid report revision.');
  ensure(typeof r.title==='string'&&r.title.length<=100&&typeof r.mode==='string'&&r.mode.length<=30,'Invalid report title or mode.');
  ensure(['playing','paused','finished'].includes(r.status)&&finite(r.startedAt)&&finite(r.updatedAt),'Invalid report state.');
  ensure(r.status!=='finished'||finite(r.finishedAt),'A finished report needs an end time.');
  ensure(Array.isArray(r.cards)&&r.cards.length>0&&r.cards.length<=250,'Invalid report cards.');
  ensure(new Set(r.cards.map(c=>c.id)).size===r.cards.length,'Duplicate card identifiers in report.');
  for(const c of r.cards){
    id(c.id);ensure(typeof c.prompt==='string'&&c.prompt.length<=400,'Invalid card prompt.');
    ensure(Array.isArray(c.answers)&&c.answers.length>=2&&c.answers.length<=4&&c.answers.every(v=>typeof v==='string'&&v.length<=180),'Invalid answer snapshot.');
    ensure(Array.isArray(c.correctOptions)&&c.correctOptions.length&&new Set(c.correctOptions).size===c.correctOptions.length&&c.correctOptions.every(i=>Number.isInteger(i)&&i>=0&&i<c.answers.length),'Invalid correct answer snapshot.');
    for(const key of ['number','attempts','correct','incorrect','uniqueStudents','uniqueCorrectStudents','uniqueIncorrectStudents','firstAttempts','firstCorrect','firstIncorrect'])ensure(count(c[key]),`Invalid ${key} count.`);
    ensure(c.attempts===c.correct+c.incorrect&&c.firstAttempts===c.firstCorrect+c.firstIncorrect&&c.firstAttempts===c.uniqueStudents&&c.firstAttempts<=c.attempts,'Inconsistent card attempt counts.');
    ensure(c.firstCorrect<=c.correct&&c.firstIncorrect<=c.incorrect&&c.uniqueCorrectStudents<=c.correct&&c.uniqueIncorrectStudents<=c.incorrect&&c.uniqueCorrectStudents<=c.uniqueStudents&&c.uniqueIncorrectStudents<=c.uniqueStudents,'Inconsistent student counts.');
    ensure(Array.isArray(c.choiceCounts)&&c.choiceCounts.length===c.answers.length&&c.choiceCounts.every(count)&&c.choiceCounts.reduce((n,v)=>n+v,0)===c.attempts,'Inconsistent answer-choice counts.');
    ensure(c.correctOptions.reduce((n,i)=>n+c.choiceCounts[i],0)===c.correct,'Correct-choice totals do not match grading.');
    c.accuracy=ratio(c.correct,c.attempts);c.errorRate=ratio(c.incorrect,c.attempts);c.firstAccuracy=ratio(c.firstCorrect,c.firstAttempts);
    delete c.respondents;
  }
  delete r.cursor;delete r.ownerId;
  const attempts=r.cards.reduce((n,c)=>n+c.attempts,0),correct=r.cards.reduce((n,c)=>n+c.correct,0);
  ensure(r.summary&&count(r.summary.joinedPlayers)&&r.summary.joinedPlayers<=45&&count(r.summary.participatingStudents)&&r.summary.participatingStudents<=r.summary.joinedPlayers,'Invalid participation counts.');
  r.summary={attempts,correct,incorrect:attempts-correct,accuracy:ratio(correct,attempts),cardsAnswered:r.cards.filter(c=>c.attempts>0).length,cardsUnanswered:r.cards.filter(c=>!c.attempts).length,participatingStudents:r.summary.participatingStudents,joinedPlayers:r.summary.joinedPlayers};
  ensure(new TextEncoder().encode(JSON.stringify(r)).length<=500000,'Report is too large.');return r;
}
export class RoundRepository {
  constructor(store,owner){ensure(/^[a-f0-9]{64}$/.test(String(owner)),'Invalid report owner.');this.store=store;this.owner=owner;}
  key(roundId){return `round:${this.owner}:${id(roundId)}`;}
  index(r){return `round-index:${this.owner}:${String(Math.floor(r.startedAt)).padStart(13,'0')}:${r.id}`;}
  async upsert(input){
    const r=validateReport(input),key=this.key(r.id),prior=await this.store.get(key);
    // A delete tombstone prevents an in-flight room retry from recreating a removed report.
    if(await this.store.get('round-deleted:'+this.owner+':'+r.id))return {stored:false,deleted:true};
    if(prior&&prior.revision>=r.revision)return {stored:false,revision:prior.revision};
    if(prior?.status==='finished')return {stored:false,revision:prior.revision};
    if(prior){ensure(prior.startedAt===r.startedAt&&prior.pin===r.pin&&prior.mode===r.mode,'Round identity changed.',409);ensure(prior.summary.attempts<=r.summary.attempts,'Round counts cannot decrease.',409);ensure(prior.cards.length===r.cards.length&&prior.cards.every((c,i)=>c.id===r.cards[i].id&&c.prompt===r.cards[i].prompt&&JSON.stringify(c.answers)===JSON.stringify(r.cards[i].answers)&&JSON.stringify(c.correctOptions)===JSON.stringify(r.cards[i].correctOptions)),'The round question snapshot cannot change.',409);}
    const {cards,...summary}=r;await this.store.put({[key]:r,[this.index(r)]:summary});return {stored:true,revision:r.revision};
  }
  async get(roundId){const r=await this.store.get(this.key(roundId));ensure(r,'Round report not found.',404);return r;}
  async list(cursor='',limit=40){
    limit=Math.min(100,Math.max(1,Math.floor(Number(limit)||40)));const prefix='round-index:'+this.owner+':';
    if(cursor)ensure(/^\d{13}:[a-zA-Z0-9_-]{8,80}$/.test(cursor),'Invalid report cursor.');
    const values=await this.store.list({prefix,reverse:true,limit:limit+1,...(cursor?{end:prefix+cursor}:{})});
    const rows=[...values.entries()],hasMore=rows.length>limit,shown=rows.slice(0,limit);
    return {rounds:shown.map(([,v])=>v),nextCursor:hasMore?shown.at(-1)[0].slice(prefix.length):null};
  }
  async remove(roundId){const key=this.key(roundId),prior=await this.store.get(key);if(!prior)return {deleted:true};ensure(prior.status==='finished','Finish the round before deleting its report.',409);await this.store.put('round-deleted:'+this.owner+':'+id(roundId),true);await this.store.delete([key,this.index(prior)]);return {deleted:true};}
}
