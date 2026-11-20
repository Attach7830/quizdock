import {ensure,hash} from './library-domain.js';
import {crosswordLetters,crosswordAnswer} from './assignment-crossword.js';
import {normalizeAnswer} from '../public/js/answer-check.js';
import {crosswordGrid,draftEntries,draftCells,gridCharacters,requiredCrosswordNumbers} from '../public/js/crossword-grid-model.js';

const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(value);
const solution=(a,e)=>crosswordLetters(crosswordAnswer(a.cards[e.index]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function requiredCrosswordEntries(x){
 return requiredCrosswordNumbers(x);
}
export function reconcileCrosswordDraft(a,p,{enable=false,bump=false,now=Date.now()}={}){
 const x=p.assignmentCrossword;if(!x||!enable&&!x.gridMode)return false;
 const grid=crosswordGrid(x.entries),values=draftCells(grid,x.gridDraft?.entries),solved=new Set(x.solved);
 for(const e of grid.entries)if(solved.has(e.number)){const word=gridCharacters(solution(a,e));e.keys.forEach((key,i)=>values[key]=word[i]);}
 const entries=draftEntries(grid,values),changed=!x.gridMode||!x.gridDraft||!same(entries,x.gridDraft.entries)||bump;
 if(changed){x.gridMode=true;x.feedback=null;x.gridDraft={revision:(x.gridDraft?.revision||0)+Number(!!x.gridDraft),entries,updatedAt:now};}
 return changed;
}
function validateEntries(a,x,input){
 ensure(input&&typeof input==='object'&&!Array.isArray(input),'Send the letters in your crossword.');
 const grid=crosswordGrid(x.entries),keys=Object.keys(input),values={},solved=new Set(x.solved);
 ensure(keys.length===grid.entries.length&&keys.every(k=>grid.entries.some(e=>String(e.number)===k)),'The crossword changed. Reload its current clues.',409);
 for(const e of grid.entries){
  ensure(typeof input[e.number]==='string','Use text for each crossword entry.');
  const letters=gridCharacters(input[e.number]);ensure(letters.length===e.length&&letters.every(c=>c===' '||/^\p{L}$/u.test(c)),'Each square holds one letter; leave empty squares blank.');
  const fixed=solved.has(e.number)?gridCharacters(solution(a,e)):null;
  e.keys.forEach((key,i)=>{
   if(fixed)ensure(letters[i]===fixed[i],'Keep letters in words already saved as correct.');
   ensure(values[key]===undefined||values[key]===letters[i],'Crossing words must share the same letter.');values[key]=letters[i];
  });
 }
 return draftEntries(grid,values);
}
export async function saveCrosswordDraft(a,p,payload,now=Date.now()){
 const x=p.assignmentCrossword;ensure(x?.gridMode&&payload.puzzleId===x.id,'Open the current crossword grid.',409);
 ensure(validId(payload.mutationId),'Invalid draft identifier.');
 const entries=validateEntries(a,x,payload.entries),digest=await hash(JSON.stringify(entries)),old=x.gridDraft;
 if(old.lastMutation?.id===payload.mutationId){ensure(old.lastMutation.digest===digest,'That draft identifier was already used.',409);return false;}
 ensure(Number.isSafeInteger(payload.draftRevision)&&payload.draftRevision===old.revision,'Your saved grid changed. Reload it before saving more letters.',409);
 if(same(entries,old.entries))return false;
 x.gridDraft={entries,revision:old.revision+1,updatedAt:now,lastMutation:{id:payload.mutationId,digest}};p.lastAnswer=now;p.updatedAt=now;return true;
}
export function crosswordDraftAssessment(a,p){
 const x=p.assignmentCrossword;if(!x?.gridMode)return null;
 let filled=0,correct=0;
 for(const e of x.entries){const entered=x.gridDraft.entries[e.number]||'';if(gridCharacters(entered).length!==e.length||entered.includes(' '))continue;filled++;if(normalizeAnswer(entered,a.rules)===normalizeAnswer(solution(a,e),a.rules))correct++;}
 return {correct:Math.min(x.goal,correct),filled:Math.min(x.goal,filled),total:x.goal,entries:x.entries.length,updatedAt:x.gridDraft.updatedAt,checkedCorrect:Math.min(x.goal,x.solved.length)};
}
export function checkCrosswordGrid(a,p,payload,now=Date.now()){
 const x=p.assignmentCrossword;ensure(x?.gridMode&&payload.puzzleId===x.id,'Open your current crossword grid.',409);ensure(validId(payload.mutationId),'Invalid check identifier.');
 const receipt=x.gridChecks?.find(r=>r.id===payload.mutationId);
 if(receipt){ensure(receipt.revision===payload.draftRevision,'That check identifier was already used.',409);return {duplicate:true,answered:0,correct:0};}
 ensure(payload.draftRevision===x.gridDraft.revision,'Save your latest letters before checking the puzzle.',409);
 const required=requiredCrosswordEntries(x),entries=x.gridDraft.entries;
 ensure(x.entries.filter(e=>required.has(e.number)).every(e=>entries[e.number]&&!entries[e.number].includes(' ')),'Fill every square in the required clues before checking the whole crossword.');
 ensure(now-(p.lastSubmittedAt||0)>=500,'Take a moment before checking the crossword again.',429);
 let answered=0,correct=0;const incorrect=[];x.lastGridInputs=x.lastGridInputs||{};
 for(const e of x.entries){
  const input=entries[e.number];if(!input||input.includes(' ')||x.solved.includes(e.number))continue;
  const right=normalizeAnswer(input,a.rules)===normalizeAnswer(solution(a,e),a.rules);
  if(!right)incorrect.push(e.number);
  if(x.lastGridInputs[e.number]===input)continue;
  const card=a.cards[e.index],stats=p.cardStats[card.id]||{prompt:card.prompt,correct:0,incorrect:0,firstCorrect:right};
  if(right){stats.correct++;p.correct++;correct++;x.solved.push(e.number);}else stats.incorrect++;
  p.cardStats[card.id]=stats;p.answered++;answered++;x.lastGridInputs[e.number]=input;
 }
 if(answered){p.lastAnswer=now;p.lastSubmittedAt=now;p.updatedAt=now;}
 // Canonical spelling replaces accepted unaccented variants only after the
 // student has checked a fully filled puzzle.
 reconcileCrosswordDraft(a,p,{now});
 x.lastGridCheck={revision:x.gridDraft.revision,at:now,incorrect,correct:x.solved.length,total:x.goal,complete:x.solved.length>=x.goal};
 x.gridChecks=[...(x.gridChecks||[]),{id:payload.mutationId,revision:payload.draftRevision}].slice(-32);
 return {answered,correct};
}
