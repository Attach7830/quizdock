import {ensure,LibraryError} from './library-domain.js';
import {correctAnswers} from '../public/js/list-model.js';
export const DEFAULT_ZONE='America/Los_Angeles';
export function zone(value=DEFAULT_ZONE){try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format();return value;}catch{throw new LibraryError('Choose a valid IANA timezone.');}}
export function localDay(timestamp,timezone=DEFAULT_ZONE){return new Intl.DateTimeFormat('en-CA',{timeZone:zone(timezone),year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));}
export function weekStart(timestamp,timezone=DEFAULT_ZONE){const d=new Date(localDay(timestamp,timezone)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export function addDays(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function dateTimeInZone(value,timezone=DEFAULT_ZONE){
 ensure(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value),'Enter a due date and time.');zone(timezone);
 const wanted=Date.parse(value+':00Z');ensure(Number.isFinite(wanted),'Enter a valid due date and time.');let guess=wanted;
 for(let i=0;i<4;i++){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess).map(x=>[x.type,x.value]));
  const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const shift=wanted-represented;guess+=shift;if(!shift)return guess;
 }
 throw new LibraryError('This local time does not exist because of a clock change. Choose a different time.');
}
export function normalizeAnswer(value,{strictAccents=true}={}){
 let s=String(value??'').normalize('NFC').trim().toLocaleLowerCase('es').replace(/\s+/g,' ');
 // ñ remains a different letter even when optional accents are ignored.
 if(!strictAccents)s=s.replace(/[áéíóúü]/g,c=>({á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u'}[c]));
 return s;
}
export function gradeTyped(card,value,rules={}){const expected=correctAnswers(card);return {correct:expected.some(a=>normalizeAnswer(a,rules)===normalizeAnswer(value,rules)),expected};}
export function practiceRules(raw={}){
 const out={minSeconds:Math.round(Number(raw.minMinutes??5)*60),minCards:Number(raw.minCards??20),minAccuracy:Number(raw.minAccuracy??80),strictAccents:raw.strictAccents!==false,cardCountMode:raw.cardCountMode||'attempts'};
 ensure(['attempts','distinct'].includes(out.cardCountMode),'Choose answer attempts or distinct cards.');
 ensure(Number.isInteger(out.minSeconds)&&out.minSeconds>=0&&out.minSeconds<=10800,'Minimum time must be 0–180 minutes.');
 ensure(Number.isInteger(out.minCards)&&out.minCards>=1&&out.minCards<=2000,'Minimum answered cards must be 1–2000.');
 ensure(Number.isFinite(out.minAccuracy)&&out.minAccuracy>=0&&out.minAccuracy<=100,'Accuracy must be 0–100%.');return out;
}
export function progressSummary(p,rules){const answered=p.answered||0,correct=p.correct||0,seconds=Math.floor((p.activeMs||0)/1000),accuracy=answered?100*correct/answered:0;const uniqueCards=Object.keys(p.cardStats||{}).length,studiedCards=rules.cardCountMode==='distinct'?uniqueCards:answered;return {answered,correct,seconds,accuracy,uniqueCards,studiedCards,ready:seconds>=rules.minSeconds&&studiedCards>=rules.minCards&&accuracy>=rules.minAccuracy,submittedAt:p.submittedAt||null,late:!!p.late};}
export function gameSettings(raw={}){
 const kind=raw.kind??'time',minutes=Number(raw.minutes??10),target=Number(raw.target??1000);
 ensure(['time','score'].includes(kind),'Choose time or target score.');ensure(Number.isInteger(minutes)&&minutes>=1&&minutes<=60,'Game time must be 1–60 minutes.');
 ensure(Number.isInteger(target)&&target>=1&&target<=1000000,'Target score must be 1–1,000,000.');
 return {kind,minutes,target,allowLate:raw.allowLate!==false};
}
export function rankedParticipants(rows){
 const sorted=rows.filter(p=>p.answered>0).slice().sort((a,b)=>b.score-a.score||b.correct-a.correct||a.name.localeCompare(b.name));
 let rank=0;return sorted.map((p,i)=>{if(!i||p.score!==sorted[i-1].score||p.correct!==sorted[i-1].correct)rank=i+1;return {...p,rank};});
}
export function raffleEntries(rounds,policy='podium'){
 ensure(['first','podium'].includes(policy),'Choose first place or the weighted podium.');const entries=new Map();
 for(const round of rounds)for(const p of rankedParticipants(round.players)){
  const tickets=policy==='first'?(p.rank===1?1:0):({1:3,2:2,3:1}[p.rank]||0);if(!p.accountId||!tickets)continue;
  const item=entries.get(p.accountId)||{accountId:p.accountId,name:p.name,tickets:0,rounds:[]};item.tickets+=tickets;item.rounds.push({roundId:round.id,rank:p.rank,tickets});entries.set(p.accountId,item);
 }return [...entries.values()].sort((a,b)=>b.tickets-a.tickets||a.name.localeCompare(b.name));
}
export function secureBelow(max){ensure(Number.isSafeInteger(max)&&max>0&&max<=0xffffffff,'Invalid random range.');const bound=Math.floor(0x100000000/max)*max,a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=bound);return a[0]%max;}
export function weightedWinner(entries,random=secureBelow){const total=entries.reduce((n,e)=>n+e.tickets,0);ensure(total>0,'No eligible tickets for this week.');let ticket=random(total);for(const e of entries){if(ticket<e.tickets)return e;ticket-=e.tickets;}throw new Error('Invalid ticket selection.');}
