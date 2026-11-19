import {shuffled} from './expeditions/shared.js';
export const WORD_ACTIVITIES=['auto','forge','crossword','repair','affixes','chain'];
export const canonicalWord=q=>String(q.answers[q.correct[0]]).split(';').map(s=>s.trim()).find(Boolean)||'';
const letters=word=>[...word.normalize('NFC').toLocaleUpperCase('es')].filter(c=>/^\p{L}$/u.test(c));
const normalized=word=>word.normalize('NFC').toLocaleLowerCase('es');

export function sentenceRepair(q){
 const answer=canonicalWord(q),source=q.repair||q.text.match(/[«“"]([^»”"]+)[»”"]/)?.[1];if(!source)return null;
 const before=[...source.normalize('NFC').matchAll(/[\p{L}\p{N}]+/gu)],after=[...answer.normalize('NFC').matchAll(/[\p{L}\p{N}]+/gu)];if(before.length!==after.length||!after.length)return null;
 const changed=after.map((m,i)=>normalized(m[0])!==normalized(before[i][0]));if(!changed.some(Boolean)||changed.filter(Boolean).length>4)return null;
 const segments=[];let last=0;after.forEach((m,i)=>{if(m.index>last)segments.push({text:answer.slice(last,m.index)});segments.push(changed[i]?{blank:i,original:before[i][0]}:{text:m[0]});last=m.index+m[0].length;});if(last<answer.length)segments.push({text:answer.slice(last)});
 return {segments,changes:changed.filter(Boolean).length};
}
export function wordParts(q){
 const word=canonicalWord(q);if(q.parts?.length&&normalized(q.parts.join(''))===normalized(word))return {parts:[...q.parts],kind:'affixes'};
 if((/^to\s+\p{L}/iu.test(q.text)||/\binfinitiv[eo]\b/iu.test(q.text))&&/^[\p{L}]{2,}(ar|er|ir)$/u.test(word.toLocaleLowerCase('es')))return {parts:[word.slice(0,-2),word.slice(-2)],kind:'stem-ending'};
 if(!/^\p{L}{3,18}$/u.test(word))return null;
 const split=Math.ceil([...word].length/2);return {parts:[[...word].slice(0,split).join(''),[...word].slice(split).join('')],kind:'pieces'};
}
export function makeCrossword(questions,rng,{limit=8,maxLength=16,includeDisconnected=false,initialEntries=[]}={}){
 const grid=new Map(),entries=[];let serial=0;
 const pool=questions.map((q,index)=>({index,word:letters(canonicalWord(q)).join(''),clue:q.text})).filter(x=>x.word.length>=2&&x.word.length<=maxLength),fixed=new Set(initialEntries.map(e=>e.index));
 const candidates=shuffled(pool.filter(c=>!fixed.has(c.index)),rng).slice(0,Math.max(0,limit-initialEntries.length));
 const key=(r,c)=>r+':'+c;
 function fits(word,row,col,direction){
  const dr=direction==='down'?1:0,dc=1-dr;if(grid.has(key(row-dr,col-dc))||grid.has(key(row+dr*word.length,col+dc*word.length)))return false;let crosses=0;
  for(let i=0;i<word.length;i++){const r=row+dr*i,c=col+dc*i,cell=grid.get(key(r,c));if(cell){if(cell.letter!==word[i]||cell.directions.includes(direction))return false;crosses++;}else if(grid.has(key(r+dc,c+dr))||grid.has(key(r-dc,c-dr)))return false;}
  return !grid.size||crosses>0;
 }
 function place(candidate,row,col,direction,number=serial+1){serial=Math.max(serial,number);entries.push({...candidate,row,col,direction,number});for(let i=0;i<candidate.word.length;i++){const r=row+(direction==='down'?i:0),c=col+(direction==='across'?i:0),old=grid.get(key(r,c));grid.set(key(r,c),{row:r,col:c,letter:candidate.word[i],indices:[...(old?.indices||[]),candidate.index],directions:[...(old?.directions||[]),direction],number:i===0?number:old?.number||null});}}
 for(const e of initialEntries){const c=pool.find(c=>c.index===e.index);if(c)place(c,e.row,e.col,e.direction,e.number);}
 let todo=candidates;
 while(todo.length){
  const pending=[];let placed=false;
  for(const candidate of todo){
   if(!grid.size){place(candidate,0,0,'across');placed=true;continue;}
   let found=null;outer:for(const cell of grid.values())for(let i=0;i<candidate.word.length;i++)if(candidate.word[i]===cell.letter)for(const direction of ['across','down']){
    const row=cell.row-(direction==='down'?i:0),col=cell.col-(direction==='across'?i:0),bound=includeDisconnected?60:18;
    if(row< -bound||col< -bound||row>bound||col>bound)continue;
    if(fits(candidate.word,row,col,direction)){found={row,col,direction};break outer;}
   }
   if(found){place(candidate,found.row,found.col,found.direction);placed=true;}else pending.push(candidate);
  }
  if(!includeDisconnected||!pending.length)break;
  // Retry deferred words after new crossings exist. Only start a separate
  // island when none can connect, so an exact teacher count never shrinks.
  if(!placed){const candidate=pending.shift();place(candidate,Math.max(...[...grid.values()].map(c=>c.row))+3,0,'across');}
  todo=pending;
 }
 const cells=[...grid.values()],minRow=Math.min(0,...cells.map(c=>c.row)),minCol=Math.min(0,...cells.map(c=>c.col));for(const cell of cells){cell.row-=minRow;cell.col-=minCol;}for(const entry of entries){entry.row-=minRow;entry.col-=minCol;}return {rows:Math.max(0,...cells.map(c=>c.row))+1,cols:Math.max(0,...cells.map(c=>c.col))+1,cells,entries};
}
export function publicCrossword(board,solved=[],active=null){const known=new Set(solved);return {rows:board.rows,cols:board.cols,cells:board.cells.map(c=>({row:c.row,col:c.col,number:c.number,value:c.indices.some(i=>known.has(i))?c.letter:'',active:c.indices.includes(active)})),entries:board.entries.map(e=>({index:e.index,number:e.number,clue:e.clue,direction:e.direction,length:e.word.length,solved:known.has(e.index),active:e.index===active}))};}
export function publicWordActivity(room,p,requested,rng=(min)=>min){
 const q=room.questions[p.current?.index];if(!q)return null;const repair=sentenceRepair(q),parts=wordParts(q),style=WORD_ACTIVITIES.includes(requested)?requested:'auto',selected=style==='auto'?(repair?'repair':parts&&p.correct%3===1?'affixes':p.correct%3===2?'chain':'crossword'):style;
 const activity=(selected==='repair'&&!repair||selected==='affixes'&&!parts)?'forge':selected;
 const bank=parts?shuffled([...new Set([...parts.parts,...room.questions.filter(x=>x!==q).flatMap(x=>wordParts(x)?.parts||[]).slice(0,4)])],rng):[];
 const answer=canonicalWord(q);let example=q.example||'';for(const candidate of q.correct.map(i=>q.answers[i]).flatMap(x=>[x,...x.split(';')]).filter(Boolean)){const escaped=candidate.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');example=example.replace(new RegExp(escaped,'giu'),'_____');}
 return {kind:activity,repair:activity==='repair'?repair:null,parts:activity==='affixes'?{kind:parts.kind,bank}:null,hint:q.hint||q.text,example,image:q.image||'',length:letters(answer).length};
}
