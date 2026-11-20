import {mountCrosswordSpace} from './crossword-space.js';
import {crosswordGrid,gridKey,draftCells,draftEntries,gridCharacters,requiredCrosswordNumbers} from './crossword-grid-model.js';
import {api} from './ui.js';
import {assignmentRevision} from './assignment-dates.js';

const sessions=new Map(),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function mountCrosswordGrid(root,practice,userId,callbacks={}){
 const puzzle=practice.crossword,grid=crosswordGrid(puzzle.entries),cells=new Map(grid.cells.map(c=>[c.key,c])),words=new Map(grid.entries.map(e=>[e.number,e]));
 const storageKey=`qd-crossword:${userId}:${practice.assignment.id}:${puzzle.id}`,sessionKey=storageKey+':'+practice.lease;
 let session=sessions.get(sessionKey);
 if(!session){session={revision:puzzle.draft.revision,entries:puzzle.draft.entries,queue:Promise.resolve(),pending:null};sessions.set(sessionKey,session);}
 else if(puzzle.draft.revision>=session.revision){session.revision=puzzle.draft.revision;session.entries=puzzle.draft.entries;}
 const values=draftCells(grid,puzzle.draft.entries),fixed=new Map(puzzle.cells.filter(c=>c.value).map(c=>[gridKey(c.row,c.col,c.depth||0),c.value]));
 for(const [key,value]of fixed)values[key]=value;
 let current=grid.entries.find(e=>!e.solved)||grid.entries[0],active=current.keys.find(k=>!values[k]&&!fixed.has(k))||current.keys[0],disposed=false,checking=false,timer,resize,compositionTarget=null,zoom=null,recovery=null,nativeFullscreen=false,view=puzzle.dimension===3?'3d':'layers',layer=0,space=null;
 const inputs=new Map([...root.querySelectorAll('[data-crossword-input]')].map(el=>[el.dataset.cell,el]));
 const entryValues=()=>draftEntries(grid,values),required=requiredCrosswordNumbers(puzzle);
 function cache(){if(recovery||disposed)return;try{localStorage.setItem(storageKey,JSON.stringify({entries:entryValues(),base:session.entries,dirty:!equal(entryValues(),session.entries),active,entry:current.number}));}catch{}}
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(!saved){for(const e of grid.entries){if(e.solved)continue;const old=sessionStorage.getItem(`qd-draft:${userId}:${practice.assignment.id}:${puzzle.id}:${e.number}`),letters=gridCharacters(old).filter(c=>/^\p{L}$/u.test(c));if(letters.length&&letters.length<=e.length&&e.keys.every((key,i)=>!letters[i]||!values[key]||values[key]===letters[i]))e.keys.forEach((key,i)=>{if(letters[i]&&!fixed.has(key))values[key]=letters[i];});}}
  if(saved){
   const base=draftCells(grid,saved.base),local=draftCells(grid,saved.entries);let conflicts=false;
   if(saved.dirty)for(const cell of grid.cells){const key=cell.key;if(fixed.has(key)||(local[key]||' ')===(base[key]||' '))continue;if((values[key]||' ')===(base[key]||' ')||(values[key]||' ')===(local[key]||' '))values[key]=local[key]||'';else conflicts=true;}
   if(conflicts)recovery=saved;
   current=words.get(saved.entry)||current;if(cells.has(saved.active)&&current.keys.includes(saved.active))active=saved.active;
  }
 }catch{}
 const status=text=>{if(!disposed){const el=root.querySelector('[data-cw-save]');if(el)el.textContent=text;}};
 function repaint({focus=false}={}){
  if(disposed)return;
  for(const [key,input]of inputs){input.parentElement.hidden=view==='layers'&&cells.get(key).depth!==layer;if(compositionTarget!==input)input.value=values[key]||'';input.tabIndex=view==='layers'&&key===active?0:-1;input.disabled=checking;const box=input.parentElement;box.classList.toggle('selected-word',current.keys.includes(key));box.classList.toggle('active-square',key===active);box.setAttribute('aria-selected',String(key===active));}
  const direction=current.direction==='across'?'Across':current.direction==='depth'?'Depth':'Down';const label=root.querySelector('[data-cw-current-label]');label.textContent=`${current.label} ${direction} · ${current.length} letters${puzzle.dimension===3?' · layer '+(cells.get(active).depth+1):''}`;
  root.querySelector('[data-cw-current-clue]').textContent=current.clue;root.querySelector('[data-cw=direction]').textContent=direction;
  if(space){if(compositionTarget!==space.input)space.input.value=values[active]||'';space.input.readOnly=fixed.has(active);space.input.disabled=checking;space.input.setAttribute('aria-label',`${current.label} ${direction}, square ${current.keys.indexOf(active)+1} of ${current.length}`);space.update(values,active,current);}
  for(const button of root.querySelectorAll('[data-cw=clue]')){const selected=Number(button.dataset.entry)===current.number;button.classList.toggle('selected-clue',selected);button.setAttribute('aria-current',String(selected));}
  const filled=grid.entries.filter(e=>required.has(e.number)&&e.keys.every(k=>values[k])).length,ready=filled===required.size;
  root.querySelector('[data-cw-filled]').textContent=`${filled}/${required.size} words filled`;
  root.querySelector('[data-cw-check]').disabled=!ready||checking||!!recovery;const focusCheck=root.querySelector('[data-cw=focus-check]');focusCheck.hidden=!ready;focusCheck.disabled=checking||!!recovery;
  const dirty=!equal(entryValues(),puzzle.draft.entries);if(dirty)root.querySelector('[data-cw-result]').hidden=true;
  if(focus){if(view==='layers'&&cells.get(active).depth!==layer){layer=cells.get(active).depth;for(const [key,input]of inputs)input.parentElement.hidden=cells.get(key).depth!==layer;}const picker=root.querySelector('[data-cw-layer]');if(picker)picker.value=String(layer);const input=view==='3d'?space?.input:inputs.get(active);input?.focus({preventScroll:true});input?.select();input?.scrollIntoView({block:'nearest',inline:'nearest'});}
 }
 function choose(number,{focus=true,position}={}){
  current=words.get(Number(number))||current;
  active=position&&current.keys.includes(position)?position:current.keys.find(k=>!values[k]&&!fixed.has(k))||current.keys.find(k=>!fixed.has(k))||current.keys[0];
  root.classList.remove('show-clues');root.querySelector('[data-cw=toggle-clues]').setAttribute('aria-expanded','false');repaint({focus});cache();callbacks.onSelect?.(current.number);
 }
 function nextClue(step=1){const at=grid.entries.indexOf(current);choose(grid.entries[(at+step+grid.entries.length)%grid.entries.length].number);}
 function toggleDirection(){const options=cells.get(active).entries;if(options.length>1){const next=options[(options.findIndex(e=>e.number===current.number)+1)%options.length];choose(next.number,{position:active});}else repaint({focus:true});}
 function changed(){callbacks.onActivity?.();cache();repaint();status('Saving letters…');clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),450);}
 function write(text,key=active){
  if(checking||recovery)return;
  const letters=gridCharacters(text).filter(c=>/^\p{L}$/u.test(c));if(!letters.length)return;
  if(!current.keys.includes(key)){const e=cells.get(key).entries.find(e=>e.direction===current.direction)||cells.get(key).entries[0];current=words.get(e.number);}
  let at=current.keys.indexOf(key);if(letters.length===current.length)at=0;
  for(const letter of letters){if(at>=current.keys.length)break;const target=current.keys[at];if(!fixed.has(target))values[target]=letter;at++;}
  active=current.keys[Math.min(at,current.keys.length-1)];while(fixed.has(active)&&at<current.keys.length-1)active=current.keys[++at];changed();repaint({focus:true});
 }
 function erase(backwards=false){
  if(checking||recovery)return;let at=current.keys.indexOf(active);
  if(backwards&&(!values[active]||fixed.has(active))){do{at--;}while(at>=0&&fixed.has(current.keys[at]));if(at>=0)active=current.keys[at];}
  if(!fixed.has(active))values[active]='';changed();repaint({focus:true});
 }
 function move(row,col,depth=0){
  const c=cells.get(active),axis=depth?'depth':col?'across':'down';let r=c.row+row,k=c.col+col,z=c.depth+depth;
  while(r>=0&&r<puzzle.rows&&k>=0&&k<puzzle.cols&&z>=0&&z<(puzzle.layers||1)){const next=cells.get(gridKey(r,k,z));if(next){const e=next.entries.find(e=>e.direction===axis)||next.entries[0];choose(e.number,{position:next.key});return;}r+=row;k+=col;z+=depth;}
 }
 async function transmit(payload){
  const result=await api('practice-crossword-draft',payload);
  if(result.draft.revision>=session.revision){session.revision=result.draft.revision;session.entries=result.draft.entries;}
  session.pending=null;callbacks.onDraft?.(result.draft);cache();return result;
 }
 function flush(){
  clearTimeout(timer);cache();
  const task=session.queue.catch(()=>{}).then(async()=>{
   if(recovery)return;
   try{
    if(session.pending)await transmit(session.pending);
    const entries=entryValues();
    if(!equal(entries,session.entries)){
     session.pending={assignmentId:practice.assignment.id,assignmentRevision:assignmentRevision(practice.assignment),lease:practice.lease,puzzleId:puzzle.id,draftRevision:session.revision,entries,mutationId:crypto.randomUUID()};
     await transmit(session.pending);
    }
    cache();status('Letters saved');
   }catch(error){if(error.status===409||error.status===412){session.pending=null;callbacks.onConflict?.(error);}status('Saved on this device · retry when connected');callbacks.onSaveError?.(error);throw error;}
  });session.queue=task.catch(()=>{});return task;
 }
 let pendingCheck=null;
 async function check(event){
  event?.preventDefault();event?.stopPropagation();if(checking||root.querySelector('[data-cw-check]').disabled)return;
  checking=true;repaint();status('Saving and checking the complete puzzle…');
  try{await flush();if(disposed)return;pendingCheck=pendingCheck?.draftRevision===session.revision?pendingCheck:{puzzleId:puzzle.id,draftRevision:session.revision,mutationId:crypto.randomUUID()};await callbacks.onCheck?.(pendingCheck);pendingCheck=null;}
  catch(error){status(error.message);callbacks.onSaveError?.(error);}
  finally{checking=false;repaint();}
 }
 function keydown(event){
  if(event.isComposing||event.key==='Dead'||checking)return;
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();event.stopPropagation();check();return;}
  if(event.altKey&&event.key==='ArrowUp'){
   event.preventDefault();let key=active;if(!values[key])key=current.keys[Math.max(0,current.keys.indexOf(active)-1)];const accents={A:'Á',Á:'A',E:'É',É:'E',I:'Í',Í:'I',O:'Ó',Ó:'O',U:'Ú',Ú:'Ü',Ü:'U',N:'Ñ',Ñ:'N'};
   if(!fixed.has(key)&&accents[values[key]]){values[key]=accents[values[key]];changed();repaint({focus:true});}return;
  }
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const arrows={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0],PageUp:[0,0,-1],PageDown:[0,0,1]};
  if(arrows[event.key]){event.preventDefault();move(...arrows[event.key]);}
  else if(event.key==='Backspace'){event.preventDefault();erase(true);}
  else if(event.key==='Delete'){event.preventDefault();erase();}
  else if(event.key===' '){event.preventDefault();toggleDirection();}
  else if(event.key==='Tab'||event.key==='Enter'){event.preventDefault();event.stopPropagation();nextClue(event.shiftKey?-1:1);}
  else if(event.key==='Escape'){event.preventDefault();if(root.classList.contains('cw-focus-view')){exitFullscreen();return;}const button=root.querySelector('[data-cw-check]');(button.disabled?root.querySelector('[data-cw=help]'):button).focus({preventScroll:true});}
  else if(fixed.has(active)&&/^\p{L}$/u.test(event.key)){event.preventDefault();write(event.key);}
 }
 function resizeGrid(force=false){if(view==='3d')return;
  const viewport=root.querySelector('.crossword-grid-viewport'),box=viewport.getBoundingClientRect();if(!box.width||!box.height)return;
  const fit=Math.min((box.width-8)/puzzle.cols,(box.height-8)/puzzle.rows),size=zoom==='fit'?Math.max(10,Math.min(44,fit)):typeof zoom==='number'?zoom:Math.max(24,Math.min(44,fit));
  root.querySelector('.crossword-input-grid').style.setProperty('--cw-cell',size+'px');if(force)inputs.get(active)?.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 async function enterFullscreen(){root.classList.add('cw-focus-view');document.body.classList.add('cw-focus-mode');resizeGrid();try{if(root.requestFullscreen){await root.requestFullscreen();nativeFullscreen=true;}}catch{/* The same focused view works when browser fullscreen is unavailable. */}resizeGrid();repaint({focus:true});}
 function exitFullscreen(){root.classList.remove('cw-focus-view','expanded-clue');document.body.classList.remove('cw-focus-mode');nativeFullscreen=false;if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});resizeGrid();}
 const fullscreenChanged=()=>{if(nativeFullscreen&&document.fullscreenElement!==root)exitFullscreen();};document.addEventListener('fullscreenchange',fullscreenChanged);
 if(document.body.classList.contains('cw-focus-mode'))root.classList.add('cw-focus-view');
 function click(event){
  const button=event.target.closest('[data-cw]');if(!button)return;
  const action=button.dataset.cw;
  if(action==='clue')choose(button.dataset.entry);
  else if(action==='next'||action==='previous')nextClue(action==='next'?1:-1);
  else if(action==='direction')toggleDirection();
  else if(action==='letter')write(button.dataset.letter);
  else if(action==='clear-word'){for(const key of current.keys)if(!fixed.has(key))values[key]='';changed();choose(current.number);}
  else if(action==='toggle-clues'||action==='close-clues'){const open=action==='toggle-clues'&&!root.classList.contains('show-clues');root.classList.toggle('show-clues',open);root.querySelector('[data-cw=toggle-clues]').setAttribute('aria-expanded',String(open));}
  else if(action==='view-3d'||action==='view-layers'){view=action==='view-3d'?'3d':'layers';root.dataset.cwView=view;layer=cells.get(active).depth;root.querySelector('[data-cw=view-3d]')?.setAttribute('aria-pressed',String(view==='3d'));root.querySelector('[data-cw=view-layers]')?.setAttribute('aria-pressed',String(view==='layers'));root.querySelector('.crossword-layer-picker').hidden=view!=='layers';space?.setVisible(view==='3d');resizeGrid();repaint({focus:true});}
  else if(action==='focus-word'){button.setAttribute('aria-pressed',String(space?.focus()));}
  else if(action==='reset-camera')space?.reset();
  else if(action==='fit'||action==='zoom-in'||action==='zoom-out'){if(view==='3d'){if(action==='fit')space.fit();else space.zoom(action==='zoom-in'?1:-1);return;}const currentSize=parseFloat(root.querySelector('.crossword-input-grid').style.getPropertyValue('--cw-cell'))||28;zoom=action==='fit'?'fit':Math.max(18,Math.min(64,currentSize+(action==='zoom-in'?6:-6)));resizeGrid(true);}
  else if(action==='fullscreen')enterFullscreen();
  else if(action==='exit-fullscreen')exitFullscreen();
  else if(action==='focus-check')check();
  else if(action==='read'){if(root.classList.contains('cw-focus-view'))root.classList.toggle('expanded-clue');else callbacks.onRead?.(current);}
  else if(action==='help')callbacks.onHelp?.();
  else if(action==='recover-device'||action==='recover-account'){
   if(action==='recover-device'){const local=draftCells(grid,recovery.entries);for(const key of cells.keys())if(!fixed.has(key))values[key]=local[key]||'';}
   recovery=null;root.querySelector('.crossword-draft-recovery')?.remove();changed();repaint({focus:true});
  }
 }
 if(puzzle.dimension===3)space=mountCrosswordSpace(root.querySelector('.crossword-space'),grid,{select:key=>{const cell=cells.get(key),entry=cell.entries.find(e=>e.number===current.number)||cell.entries[0];choose(entry.number,{position:key});},onRotate:()=>callbacks.onActivity?.()});
 root.querySelector('[data-cw-layer]')?.addEventListener('change',event=>{layer=Number(event.target.value);const cell=grid.cells.find(c=>c.depth===layer);if(cell){const e=cell.entries[0];choose(e.number,{position:cell.key});}});
 root.addEventListener('click',click);root.querySelector('#crossword-grid-form').addEventListener('submit',check);
 for(const [storedKey,input]of [...inputs,...(space?[['3d',space.input]]:[])]){
  const is3D=storedKey==='3d',getKey=()=>is3D?active:storedKey;
  input.addEventListener('keydown',keydown);
  input.addEventListener('focus',()=>{const key=getKey();active=key;if(!current.keys.includes(key)){const e=cells.get(key).entries.find(e=>e.direction===current.direction)||cells.get(key).entries[0];current=words.get(e.number);}repaint();});
  input.addEventListener('click',()=>{const key=getKey();active=key;repaint();input.select();});input.addEventListener('dblclick',toggleDirection);
  input.addEventListener('paste',event=>{event.preventDefault();write(event.clipboardData.getData('text'),getKey());});
  input.addEventListener('compositionstart',()=>compositionTarget=input);
  input.addEventListener('compositionend',()=>{compositionTarget=null;write(input.value,getKey());compositionTarget=input;setTimeout(()=>{if(compositionTarget===input)compositionTarget=null;},0);});
  input.addEventListener('input',event=>{const key=getKey();if(event.isComposing||compositionTarget===input)return;if(event.inputType?.startsWith('delete')){values[key]='';active=key;changed();repaint();}else if(event.data===' '){input.value=values[key]||'';toggleDirection();}else write(input.value,key);});
 }
 if(recovery){const box=document.createElement('div');box.className='crossword-draft-recovery';box.setAttribute('role','alert');box.innerHTML='<p>This device has different unsaved letters. Both copies are kept until you choose.</p><button type="button" class="btn small" data-cw="recover-device">Use device letters</button> <button type="button" class="btn ghost small" data-cw="recover-account">Keep account letters</button>';root.prepend(box);}
 const retry=()=>{if(!disposed&&!recovery)flush().catch(()=>{});};window.addEventListener('online',retry);
 if(typeof ResizeObserver!=='undefined'){resize=new ResizeObserver(()=>resizeGrid());resize.observe(root.querySelector('.crossword-grid-viewport'));}resizeGrid();repaint();cache();
 if(!equal(entryValues(),session.entries)&&!recovery)timer=setTimeout(retry,100);
 queueMicrotask(()=>{if(!disposed&&!document.querySelector('dialog[open]'))repaint({focus:true});});
 return {flush,snapshot:()=>{cache();return {entry:current.number,active,entries:entryValues()};},dispose:({keepFocus=false}={})=>{cache();document.removeEventListener('fullscreenchange',fullscreenChanged);if(!keepFocus)exitFullscreen();clearTimeout(timer);disposed=true;space?.dispose();resize?.disconnect();window.removeEventListener('online',retry);if(!recovery&&!equal(entryValues(),session.entries))flush().catch(()=>{});}};
}

export function clearCrosswordDeviceDrafts(){sessions.clear();try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key.startsWith('qd-crossword:'))localStorage.removeItem(key);}}catch{}}
