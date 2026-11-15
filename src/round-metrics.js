import {normalizeAnswer} from '../public/js/answer-check.js';
// Server-owned round analytics. Original choice indices are used, never shuffled display positions.
const clone=value=>structuredClone(value);
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(value);
export function createRoundMetrics(room,{now=Date.now(),partial=false}={}) {
  const cursor=Object.fromEntries(Object.values(room.players||{}).map(p=>[p.id,partial?p.answered:0]));
  return {
    id:crypto.randomUUID(),version:1,revision:1,title:room.title,pin:room.pin,mode:room.mode,
    ownerId:room.reportOwner||null,source:room.sourceList?clone(room.sourceList):null,
    startedAt:room.startedAt||now,trackingStartedAt:now,partial,status:room.status,finishedAt:null,updatedAt:now,
    joinedPlayers:Object.keys(room.players||{}).length,cursor,
    cards:room.questions.map((q,i)=>({id:validId(q.cardId)?q.cardId:`question_${i+1}`,number:i+1,prompt:q.text,
      answers:[...q.answers],correctOptions:[...q.correct],image:q.image||'',imageAlt:q.imageAlt||'',
      correct:0,incorrect:0,firstCorrect:0,firstIncorrect:0,choiceCounts:q.answers.map(()=>0),respondents:{}}))
  };
}
export function recordCardAnswer(metrics,{playerId,sequence,cardIndex,optionIndex,correct,typedAnswer,hintsUsed=0,now=Date.now()}) {
  if(!metrics||metrics.status!=='playing')return false;
  if(typeof playerId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(playerId))throw new Error('Invalid respondent identifier.');
  if(!Number.isSafeInteger(sequence)||sequence<1)throw new Error('Invalid answer sequence.');
  const prior=Object.hasOwn(metrics.cursor,playerId)?metrics.cursor[playerId]:0;
  if(sequence<=prior)return false; // Retries, duplicate events and reconnections cannot add attempts.
  const card=metrics.cards[cardIndex];
  const typed=typedAnswer!==undefined;
  if(!card||(!typed&&(!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>=card.answers.length)))throw new Error('Invalid analytics choice.');
  if(typed&&(typeof typedAnswer!=='string'||typedAnswer.length>180||!Number.isInteger(hintsUsed)||hintsUsed<0||hintsUsed>40))throw new Error('Invalid typed analytics answer.');
  const graded=typed?card.correctOptions.some(i=>normalizeAnswer(card.answers[i])===normalizeAnswer(typedAnswer)):card.correctOptions.includes(optionIndex);
  if(typeof correct!=='boolean'||graded!==correct)throw new Error('Analytics result differs from server grading.');
  if(sequence!==prior+1)metrics.partial=true;
  const seen=Object.hasOwn(card.respondents,playerId)?card.respondents[playerId]:0;
  if(!seen){if(correct)card.firstCorrect++;else card.firstIncorrect++;}
  Object.defineProperty(card.respondents,playerId,{value:seen|(correct?1:2),writable:true,enumerable:true,configurable:true});
  Object.defineProperty(metrics.cursor,playerId,{value:sequence,writable:true,enumerable:true,configurable:true});
  if(correct)card.correct++;else card.incorrect++;
  if(typed){const key=correct?'typedCorrect':'typedIncorrect';card[key]=(card[key]||0)+1;if(hintsUsed)card.hintedAttempts=(card.hintedAttempts||0)+1;}else card.choiceCounts[optionIndex]++;metrics.revision++;metrics.updatedAt=now;return true;
}
export function updateRoundMetrics(metrics,room,now=Date.now()) {
  if(!metrics)return false;
  const count=Object.keys(room.players||{}).length;
  if(metrics.status===room.status&&metrics.joinedPlayers===count)return false;
  metrics.status=room.status;metrics.joinedPlayers=count;metrics.updatedAt=now;metrics.revision++;
  if(room.status==='finished'&&!metrics.finishedAt)metrics.finishedAt=room.finishedAt||now;
  return true;
}
export function roundReport(metrics) {
  if(!metrics)return null;
  const cards=metrics.cards.map(c=>{
    const attempts=c.correct+c.incorrect,respondents=Object.values(c.respondents),firstAttempts=c.firstCorrect+c.firstIncorrect;
    return {id:c.id,number:c.number,prompt:c.prompt,answers:[...c.answers],correctOptions:[...c.correctOptions],image:c.image,imageAlt:c.imageAlt,
      attempts,correct:c.correct,incorrect:c.incorrect,accuracy:attempts?100*c.correct/attempts:null,errorRate:attempts?100*c.incorrect/attempts:null,
      uniqueStudents:respondents.length,uniqueCorrectStudents:respondents.filter(n=>n&1).length,uniqueIncorrectStudents:respondents.filter(n=>n&2).length,
      firstAttempts,firstCorrect:c.firstCorrect,firstIncorrect:c.firstIncorrect,firstAccuracy:firstAttempts?100*c.firstCorrect/firstAttempts:null,choiceCounts:[...c.choiceCounts],typedCorrect:c.typedCorrect||0,typedIncorrect:c.typedIncorrect||0,typedAttempts:(c.typedCorrect||0)+(c.typedIncorrect||0),hintedAttempts:c.hintedAttempts||0};
  });
  const {cursor,ownerId,cards:privateCards,...meta}=metrics;
  const attempts=cards.reduce((n,c)=>n+c.attempts,0),correct=cards.reduce((n,c)=>n+c.correct,0);
  return {...meta,cards,summary:{attempts,correct,incorrect:attempts-correct,accuracy:attempts?100*correct/attempts:null,
    cardsAnswered:cards.filter(c=>c.attempts>0).length,cardsUnanswered:cards.filter(c=>c.attempts===0).length,
    participatingStudents:new Set(metrics.cards.flatMap(c=>Object.keys(c.respondents))).size,joinedPlayers:metrics.joinedPlayers}};
}
