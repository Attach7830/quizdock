import {ensure,uid} from './library-domain.js';
import {correctAnswers} from '../public/js/list-model.js';
import {normalizeAnswer} from '../public/js/answer-check.js';
import {connectedCrossword,connectedWordGroups} from './crossword-builder.js';
import {makeCrossword} from './word-activities.js';
export const crosswordLetters=value=>[...String(value||'').normalize('NFC').toLocaleUpperCase('es')].filter(c=>/^\p{L}$/u.test(c)).join('');
const answer=card=>String(correctAnswers(card)[0]||'').split(';').map(s=>s.trim()).find(Boolean)||'';
export {answer as crosswordAnswer};
export function crosswordCandidates(cards){const seen=new Set();return cards.map((card,index)=>({index,word:crosswordLetters(answer(card)),clue:card.prompt})).filter(c=>{if(c.word.length<2||c.word.length>32||seen.has(c.word))return false;seen.add(c.word);return true;});}
export function createAssignmentCrossword(a,rng,dimension=3){
 ensure(dimension===2||dimension===3,'Choose a 2D or 3D crossword.');
 const goal=a.rules.crosswordWords,candidates=crosswordCandidates(a.cards);ensure(goal>0&&goal<=candidates.length,'This assignment does not have enough unique 2–32-letter answers for the crossword.');
 const board=connectedCrossword(candidates,goal,rng,{dimension});ensure(board,'These answers could not form one connected crossword in this mode. Try the other mode or ask your teacher to choose fewer words.');
 // Persist layout and card references only. Answers remain in the teacher's
 // private assignment snapshot, never in student progress or unsolved responses.
 return {id:uid(),goal,dimension,layoutVersion:2,layers:board.layers,rows:board.rows,cols:board.cols,entries:board.entries.map(e=>({index:e.index,number:e.number,row:e.row,col:e.col,depth:e.depth||0,direction:e.direction,length:e.word.length})),solved:[],receipts:[],feedback:null};
}
// Keep the saved puzzle ID, clue numbers, solved words and answer receipts.
// A larger target extends the grid; a smaller target keeps extra clues optional.
export function syncAssignmentCrossword(a,p,rng){
 const x=p.assignmentCrossword,goal=a.rules.crosswordWords||0;if(p.submittedAt||!x||!goal||x.goal===goal)return false;
 if(goal>x.entries.length){
  const candidates=crosswordCandidates(a.cards),questions=candidates.map(c=>({text:c.clue,answers:[c.word],correct:[0]}));
  const initialEntries=x.entries.map(e=>({...e,index:candidates.findIndex(c=>c.index===e.index)}));
  ensure(initialEntries.every(e=>e.index>=0),'The saved crossword does not match this assignment.');
  const modern=x.dimension===3||x.layoutVersion===2,board=modern?connectedCrossword(candidates,goal,rng,{initial:x.entries,dimension:x.dimension}):makeCrossword(questions,rng,{limit:goal,maxLength:32,includeDisconnected:true,initialEntries});
  // A teacher's larger goal must not erase a student's existing flat layout.
  // Keep the draft usable and let the student explicitly restart if it cannot extend.
  if(!board&&x.layoutVersion===2&&x.dimension===2){x.goal=goal;x.restartRequired=true;return true;}
  ensure(board,'The added words could not connect to this saved puzzle. Choose fewer words.');if(modern)x.layers=board.layers;
  x.rows=board.rows;x.cols=board.cols;x.entries=board.entries.map(e=>({index:modern?e.index:candidates[e.index].index,number:e.number,row:e.row,col:e.col,depth:e.depth||0,direction:e.direction,length:e.word.length}));
 }
 delete x.restartRequired;x.goal=goal;return true;
}
export function crosswordProgress(p,rules){const required=rules.crosswordWords||0,x=p.assignmentCrossword,solved=required&&x?Math.min(required,new Set(x.solved).size):0;return {required,solved,ready:required>0&&solved===required};}
export function publicAssignmentCrossword(a,p){
 const x=p.assignmentCrossword;if(!x)return null;const solved=new Set(x.solved),cells=new Map();
 for(const e of x.entries){const word=crosswordLetters(answer(a.cards[e.index]));for(let i=0;i<e.length;i++){
  const row=e.row+(e.direction==='down'?i:0),col=e.col+(e.direction==='across'?i:0),depth=(e.depth||0)+(e.direction==='depth'?i:0),key=depth?row+':'+col+':'+depth:row+':'+col,cell=cells.get(key)||{row,col,depth,number:null,value:'',entries:[]};
  if(i===0)cell.number=cell.number===null?e.number:Math.min(cell.number,e.number);if(solved.has(e.number))cell.value=word[i];cell.entries.push(e.number);cells.set(key,cell);
 }}
 return {id:x.id,goal:x.goal,dimension:x.dimension||2,layers:x.layers||1,week:x.week||null,rows:x.rows,cols:x.cols,solved:Math.min(x.solved.length,x.goal),totalSolved:x.solved.length,complete:x.solved.length>=x.goal,restartRequired:!!x.restartRequired,extraClues:x.entries.length>x.goal,cells:[...cells.values()],entries:x.entries.map(e=>({...e,index:undefined,clue:a.cards[e.index].prompt,image:a.cards[e.index].image,imageAlt:a.cards[e.index].imageAlt,solved:solved.has(e.number)})),feedback:x.feedback,...(x.gridMode?{gridMode:true,draft:{revision:x.gridDraft.revision,entries:x.gridDraft.entries,updatedAt:x.gridDraft.updatedAt},check:x.lastGridCheck?.revision===x.gridDraft.revision?x.lastGridCheck:null}:{} )};
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

export const connectedCrosswordCapacity=cards=>connectedWordGroups(crosswordCandidates(cards))[0]?.length||0;
export const crosswordLayoutKey=x=>JSON.stringify(x.entries.map(e=>[e.index,e.row,e.col,e.depth||0,e.direction]).sort((a,b)=>a[0]-b[0]));
