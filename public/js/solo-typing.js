import {gradeTyped} from './answer-check.js';
export function checkSoloAnswer(solo,value){
 if(solo.typedFeedback)return solo.typedFeedback;
 const answer=String(value??'').trim();if(!answer||answer.length>300)throw new Error('Type an answer of 1–300 characters.');
 const card=solo.deck.cards[solo.progress.index],checked=solo.reverse?{type:'pair',answer:card.prompt,alternatives:[]}:card;
 const result={...gradeTyped(checked,answer,{strictAccents:solo.strictAccents}),answer};
 solo.typedFeedback=result;solo.typedStats.answered++;if(result.correct)solo.typedStats.correct++;
 // This is only the existing self-study confidence record, never an assignment.
 solo.progress.known=solo.progress.known.filter(id=>id!==card.id);solo.progress.again=solo.progress.again.filter(id=>id!==card.id);
 solo.progress[result.correct?'known':'again'].push(card.id);
 return result;
}
export function resetSoloEntry(solo){solo.typedFeedback=null;solo.typedDraft='';}
