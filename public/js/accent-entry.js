const MAP={a:['á'],e:['é'],i:['í'],o:['ó'],u:['ú','ü'],n:['ñ'],'?':['¿'],'!':['¡']};
const base=c=>c.normalize('NFD').replace(/[\u0301\u0308\u0303]/g,'').toLowerCase();
export function accentOptions(text,caret){const last=String(text).slice(0,caret).slice(-1);const values=MAP[last.toLowerCase()]||[];return last&&last===last.toUpperCase()&&/[A-Z]/.test(last)?values.map(c=>c.toUpperCase()):values;}
export function insertAccent(input,char){const caret=input.selectionStart??input.value.length,start=input.selectionStart??caret,end=input.selectionEnd??caret,prev=input.value.slice(0,caret).slice(-1);const replace=start===end&&prev&&base(prev)===base(char);const c=prev&&prev===prev.toUpperCase()&&/[A-ZÁÉÍÓÚÜÑ]/.test(prev)?char.toUpperCase():char;input.setRangeText(c,replace?start-1:start,end,'end');input.focus({preventScroll:true});input.dispatchEvent(new Event('input',{bubbles:true}));}
export function installAccents(input,zone,onChange=()=>{}){
 const measure=document.createElement('canvas').getContext('2d');
 function update(){const chars=accentOptions(input.value,input.selectionStart??input.value.length);zone.innerHTML='';if(!chars.length)return;
  const box=document.createElement('div');box.className='accent-pop';const style=getComputedStyle(input);measure.font=style.font;
  const prefix=input.value.slice(0,Math.max(0,(input.selectionStart||0)-1));const desired=measure.measureText(prefix).width+parseFloat(style.paddingLeft)-input.scrollLeft;
  box.style.left=Math.max(0,Math.min(desired,input.clientWidth-chars.length*42))+'px';
  for(const c of chars){const b=document.createElement('button');b.type='button';b.className='accent';b.textContent=c;b.setAttribute('aria-label',`Use ${c}`);b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>{insertAccent(input,c);onChange();});box.append(b);}zone.append(box);
 }
 input.addEventListener('input',update);input.addEventListener('click',update);input.addEventListener('keyup',update);input.addEventListener('scroll',update);
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){zone.innerHTML='';return;}if(e.altKey&&e.key==='ArrowUp'){const c=accentOptions(input.value,input.selectionStart).at(0);if(c){e.preventDefault();insertAccent(input,c);onChange();}}});update();
}
