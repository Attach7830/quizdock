// Geometry and student-entered letters only. This module never contains solutions.
export const gridKey=(row,col,depth=0)=>depth?`${row}:${col}:${depth}`:`${row}:${col}`;
export const gridCharacters=value=>[...String(value??'').normalize('NFC').toLocaleUpperCase('es')];
export function crosswordGrid(entries){
 const cells=new Map(),starts=new Map();
 for(const entry of entries){
  const start=gridKey(entry.row,entry.col,entry.depth||0);if(!starts.has(start))starts.set(start,{row:entry.row,col:entry.col,depth:entry.depth||0});
  for(let i=0;i<entry.length;i++){
   const row=entry.row+(entry.direction==='down'?i:0),col=entry.col+(entry.direction==='across'?i:0),depth=(entry.depth||0)+(entry.direction==='depth'?i:0),key=gridKey(row,col,depth);
   const cell=cells.get(key)||{key,row,col,depth,entries:[]};cell.entries.push({number:entry.number,index:i,direction:entry.direction});cells.set(key,cell);
  }
 }
 const labels=new Map([...starts].sort(([,a],[,b])=>a.depth-b.depth||a.row-b.row||a.col-b.col).map(([key],i)=>[key,i+1]));
 const words=entries.map(entry=>({...entry,label:labels.get(gridKey(entry.row,entry.col,entry.depth||0)),keys:Array.from({length:entry.length},(_,i)=>gridKey(entry.row+(entry.direction==='down'?i:0),entry.col+(entry.direction==='across'?i:0),(entry.depth||0)+(entry.direction==='depth'?i:0)))}));
 for(const cell of cells.values()){cell.label=labels.get(cell.key)||null;cell.entries.sort((a,b)=>a.direction.localeCompare(b.direction));}
 return {entries:words,cells:[...cells.values()].sort((a,b)=>a.row-b.row||a.col-b.col)};
}
export function draftEntries(grid,values){return Object.fromEntries(grid.entries.map(e=>[e.number,e.keys.map(key=>values[key]||' ').join('')]));}
export function draftCells(grid,entries={}){
 const values={};for(const e of grid.entries){const letters=gridCharacters(entries[e.number]||'');e.keys.forEach((key,i)=>{if(letters[i]&&letters[i]!==' ')values[key]=letters[i];});}return values;
}
export function requiredCrosswordNumbers(puzzle){
 const solved=e=>e.solved||Array.isArray(puzzle.solved)&&puzzle.solved.includes(e.number);
 return new Set([...puzzle.entries.filter(solved),...puzzle.entries.filter(e=>!solved(e))].slice(0,puzzle.goal).map(e=>e.number));
}
