import {ensure,uid} from './library-domain.js';
import {correctAnswers} from '../public/js/list-model.js';
import {normalizeAnswer} from '../public/js/answer-check.js';
import {makeCrossword} from './word-activities.js';
export const crosswordLetters=value=>[...String(value||'').normalize('NFC').toLocaleUpperCase('es')].filter(c=>/^\p{L}$/u.test(c)).join('');
const answer=card=>String(correctAnswers(card)[0]||'').split(';').map(s=>s.trim()).find(Boolean)||'';
export function crosswordCandidates(cards){const seen=new Set();return cards.map((card,index)=>({index,word:crosswordLetters(answer(card)),clue:card.prompt})).filter(c=>{if(c.word.length<2||c.word.length>32||seen.has(c.word))return false;seen.add(c.word);return true;});}
export function createAssignmentCrossword(a,rng){
 const goal=a.rules.crosswordWords,candidates=crosswordCandidates(a.cards);ensure(goal>0&&goal<=candidates.length,'This assignment does not have enough unique 2–32-letter answers for the crossword.');
 const questions=candidates.map(c=>({text:c.clue,answers:[c.word],correct:[0]}));let board=null;
 for(let attempt=0;attempt<4;attempt++){const trial=makeCrossword(questions,rng,{limit:goal,maxLength:32,includeDisconnected:true});if(!board||trial.rows*trial.cols<board.rows*board.cols)board=trial;}
 // Persist layout and card references only. Answers remain in the teacher's
 // private assignment snapshot, never in student progress or unsolved responses.
 return {id:uid(),goal,rows:board.rows,cols:board.cols,entries:board.entries.map(e=>({index:candidates[e.index].index,number:e.number,row:e.row,col:e.col,direction:e.direction,length:e.word.length})),solved:[],receipts:[],feedback:null};
}
export function crosswordProgress(p,rules){const required=rules.crosswordWords||0,x=p.assignmentCrossword,solved=x?.goal===required?new Set(x.solved).size:0;return {required,solved,ready:required>0&&solved===required};}
export function publicAssignmentCrossword(a,p){
 const x=p.assignmentCrossword;if(!x)return null;const solved=new Set(x.solved),cells=new Map();
 for(const e of x.entries){const word=crosswordLetters(answer(a.cards[e.index]));for(let i=0;i<e.length;i++){
  const row=e.row+(e.direction==='down'?i:0),col=e.col+(e.direction==='across'?i:0),key=row+':'+col,cell=cells.get(key)||{row,col,number:null,value:'',entries:[]};
  if(i===0)cell.number=cell.number===null?e.number:Math.min(cell.number,e.number);if(solved.has(e.number))cell.value=word[i];cell.entries.push(e.number);cells.set(key,cell);
 }}
 return {id:x.id,goal:x.goal,rows:x.rows,cols:x.cols,solved:x.solved.length,complete:x.solved.length===x.goal,cells:[...cells.values()],entries:x.entries.map(e=>({...e,index:undefined,clue:a.cards[e.index].prompt,image:a.cards[e.index].image,imageAlt:a.cards[e.index].imageAlt,solved:solved.has(e.number)})),feedback:x.feedback};
}
export function checkCrosswordAnswer(a,p,payload,now){
 const x=p.assignmentCrossword;ensure(x&&x.id===payload.puzzleId,'Open your current crossword before answering.',409);
 const entry=x.entries.find(e=>e.number===Number(payload.entry));ensure(entry,'Choose a clue in your crossword.');
 ensure(/^[a-zA-Z0-9_-]{8,80}$/.test(String(payload.mutationId||'')),'Invalid answer identifier.');
 const input=String(payload.answer||'').trim();ensure(input.length>0&&input.length<=300,'Type an answer of 1–300 characters.');
 const old=x.receipts.find(r=>r.id===payload.mutationId);if(old){ensure(old.entry===entry.number&&old.input===input,'That answer identifier was already used.',409);return;}
 if(x.solved.includes(entry.number))return;
 ensure(now-(p.lastSubmittedAt||0)>=500,'Please answer a little more slowly.',429);
 const card=a.cards[entry.index],correct=normalizeAnswer(crosswordLetters(input),a.rules)===normalizeAnswer(crosswordLetters(answer(card)),a.rules);
 const stats=p.cardStats[card.id]||{prompt:card.prompt,correct:0,incorrect:0,firstCorrect:correct};if(correct){stats.correct++;p.correct++;x.solved.push(entry.number);}else stats.incorrect++;
 p.cardStats[card.id]=stats;p.answered++;p.lastAnswer=now;p.lastSubmittedAt=now;p.updatedAt=now;
 x.feedback={entry:entry.number,correct,text:correct?'Word locked in. Your crossing letters are revealed.':`Not quite. Try the answer that fits ${entry.length} squares. Spaces and punctuation are left out.`};
 x.receipts.push({id:payload.mutationId,entry:entry.number,input});if(x.receipts.length>64)x.receipts.shift();
}
