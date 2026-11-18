// Keep each actual word intact; punctuation is visible and never becomes a
// letter blank. Slots come from the server's canonical accepted answer.
export function groupWordSlots(slots=[]){
 const groups=[];let word=[];
 const flush=()=>{if(word.length){groups.push({slots:word,letters:word.filter(s=>s.letter).length});word=[];}};
 for(const slot of slots){
  if(!slot.letter&&/^\s+$/u.test(slot.value||'')){flush();groups.push({space:true,value:slot.value});}
  else word.push(slot);
 }
 flush();return groups;
}
