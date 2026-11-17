// Dependency-free import, editing and export rules shared by browser and server.
export const MAX_CARDS = 250;
export const MAX_LIST_BYTES = 100000;
export const CARD_CATEGORIES = ['grammar','vocabulary','culture'];
export const newId = () => crypto.randomUUID();
const text = value => String(value ?? '').trim().normalize('NFC');
const norm = value => text(value).toLocaleLowerCase('es').replace(/\s+/g, ' ');
const heading = value => text(value).toLowerCase().replace(/\(s\)/g, 's').replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
const unique = values => [...new Map(values.map(v => [norm(v),text(v)])).values()];
const limitText = (value,name,max,required=true) => {
  const s=text(value);
  if ((required && !s) || s.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)) throw new Error(`${name} must be ${required?'1':'0'}–${max} characters, without control characters.`);
  return s;
};
export function imageURL(value) {
  const s=text(value);if (!s) return '';
  if (s.length>2048 || /[\u0000-\u0020\u007f]/.test(s)) throw new Error('Image URL must be a full public HTTP(S) URL, without spaces.');
  let u;try{u=new URL(s);}catch{throw new Error('Image URL must begin with https:// or http://.');}
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Image URLs cannot contain login credentials or scripts.');
  return u.href;
}
export function validateCard(raw, {renewId=false}={}) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('A card must be an object.');
  const type=raw.type || (Array.isArray(raw.choices)?'choice':'pair');
  if(!['pair','choice'].includes(type))throw new Error('Card type must be pair or choice.');
  const id=!renewId && /^[a-zA-Z0-9_-]{8,80}$/.test(String(raw.id||''))?String(raw.id):newId();
  const card={id,type,prompt:limitText(raw.prompt,'Prompt',400),image:imageURL(raw.image),imageAlt:limitText(raw.imageAlt||'Question image','Image description',300,false)};
  const category=text(raw.category).toLowerCase();
  if(category){if(!CARD_CATEGORIES.includes(category))throw new Error('Category must be Grammar, Vocabulary, or Culture.');card.category=category;}
  if(type==='pair') {
    card.answer=limitText(raw.answer,'Answer',180);
    if(raw.alternatives!=null && !Array.isArray(raw.alternatives))throw new Error('Alternative answers must be an array.');
    card.alternatives=unique((raw.alternatives||[]).map(a=>limitText(a,'Alternative answer',180))).filter(a=>norm(a)!==norm(card.answer));
    if(card.alternatives.length>5)throw new Error('Use at most five alternative accepted answers.');
  }else{
    if(!Array.isArray(raw.choices)||raw.choices.length<2||raw.choices.length>4)throw new Error('A multiple-choice card needs 2–4 choices.');
    card.choices=raw.choices.map(a=>limitText(a,'Choice',180));
    if(unique(card.choices).length!==card.choices.length)throw new Error('Answer choices must be distinct.');
    if(!Array.isArray(raw.correct)||!raw.correct.length||raw.correct.some(i=>!Number.isInteger(i)||i<0||i>=card.choices.length))throw new Error('Mark at least one valid correct choice.');
    card.correct=[...new Set(raw.correct)];
  }
  return card;
}
export function validateList(raw) {
  if(!raw || typeof raw!=='object')throw new Error('Invalid list.');
  if(!Array.isArray(raw.cards)||raw.cards.length>MAX_CARDS)throw new Error(`A list can contain 0–${MAX_CARDS} cards.`);
  const list={title:limitText(raw.title,'List name',100),description:limitText(raw.description,'Description',500,false),cards:raw.cards.map((c,i)=>{try{return validateCard(c);}catch(e){throw new Error(`Card ${i+1}: ${e.message}`);}})};
  if(new Set(list.cards.map(c=>c.id)).size!==list.cards.length)throw new Error('Duplicate card identifiers. Duplicate a card using the editor so it gets a new identifier.');
  if(new TextEncoder().encode(JSON.stringify(list)).length>MAX_LIST_BYTES)throw new Error('This list exceeds 100 KB. Split it into smaller lists; image URLs count toward this limit.');
  return list;
}
export const correctAnswers = c => c.type==='pair'?[c.answer,...c.alternatives]:c.correct.map(i=>c.choices[i]);
export function cardFingerprint(card) {const c=validateCard(card);return JSON.stringify([norm(c.prompt),c.type,correctAnswers(c).map(norm).sort(),c.type==='choice'?c.choices.map(norm):[],c.image,c.imageAlt,c.category||'']);}
export function compileQuestions(raw,{typedOnly=false}={}) {
  const list=validateList(raw);if(!list.cards.length)throw new Error('Add cards before starting a game.');
  if(typedOnly)return list.cards.map(c=>({cardId:c.id,text:c.prompt,answers:correctAnswers(c),correct:correctAnswers(c).map((_,i)=>i),...(c.image?{image:c.image,imageAlt:c.imageAlt}:{})}));
  const pool=unique(list.cards.flatMap(correctAnswers));
  return list.cards.map((c,i)=>{
    let answers,correct;
    if(c.type==='choice'){answers=[...c.choices];correct=[...c.correct];}
    else{
      const accepted=new Set(correctAnswers(c).map(norm));
      const alternatives=pool.filter(x=>!accepted.has(norm(x)));
      const offset=i%Math.max(1,alternatives.length);
      answers=[c.answer,...alternatives.slice(offset),...alternatives.slice(0,offset)].slice(0,4);correct=[0];
      if(answers.length<2)throw new Error(`Card ${i+1} needs a distractor for live games. Add another distinct answer to the list or give this card explicit choices.`);
    }
    return {cardId:c.id,text:c.prompt,answers,correct,...(c.image?{image:c.image,imageAlt:c.imageAlt}:{})};
  });
}
// RFC-style quoted fields, including embedded line breaks. Row numbers identify source lines.
export function parseDelimited(input,delimiter=',') {
  const s=String(input||'').replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false,closed=false,line=1,start=1;
  const finish=()=>{row.push(field);if(row.some(x=>x.trim()))rows.push({cells:row,line:start});row=[];field='';closed=false;start=line+1;};
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(quoted){if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=c;if(c==='\n')line++;}continue;}
    if(c==='"' && !field && !closed){quoted=true;continue;}
    if(c===delimiter){row.push(field);field='';closed=false;continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;finish();line++;start=line;continue;}
    if(closed && !/\s/.test(c))throw new Error(`Line ${line}: unexpected text after a quoted field.`);
    if(!closed)field+=c;
  }
  if(quoted)throw new Error(`Line ${start}: a quoted field is not closed.`);
  finish();return rows;
}
const findHeader=(headers,names)=>headers.findIndex(h=>names.some(n=>heading(h)===heading(n)));
function cell(row,index){return index<0?'':text(row[index]);}
function unprotect(s,protectedText){return protectedText && /^'[=+\-@\t\r]/.test(s)?s.slice(1):s;}
function cardFromRow(row,headers,sourceLine) {
  const get=(...names)=>cell(row,findHeader(headers,names));
  const protectedText=get('QuizDock Safe Text')==='yes';
  const read=(...names)=>unprotect(get(...names),protectedText);
  const prompt=read('Question Text','Question','Prompt','Term','Spanish','Front','English');
  const image=read('Image URL','Image','Question Image','Prompt Image'),imageAlt=read('Image Alt','Image Description','Alt Text');
  const indexed=[1,2,3,4].map(i=>read(`Answer ${i}`,`Option ${i}`,`Choice ${i}`));
  const explicitAnswer=read('Correct Answer','Answer','Definition','Back');
  const languageColumns=headers.map((h,i)=>({h:heading(h),i})).filter(x=>['spanish','english'].includes(x.h));
  const answer=explicitAnswer || (languageColumns.length===2?unprotect(cell(row,languageColumns[1].i),protectedText):'');
  const rawCorrect=get('Correct Answer(s)','Correct Answers','Correct Option','Correct Options');
  // Preserve correct-option indices even if an intermediate answer column is blank.
  const present=indexed.map((v,i)=>({v,i})).filter(x=>x.v);
  let card;
  if(get('Card Type')!=='pair' && present.length){
    let indices=[];
    if(rawCorrect){
      const parts=rawCorrect.split(/[,;|\s]+/).filter(Boolean);
      if(parts.some(v=>!/^\d+$/.test(v)))throw new Error('Correct Answer(s) must contain option numbers, such as 1 or 1,3.');
      indices=parts.map(v=>Number(v)-1);
    }else{
      const match=indexed.findIndex(v=>v && norm(v)===norm(answer));
      if(match>=0)indices=[match];else if(/^[1-4]$/.test(answer))indices=[Number(answer)-1];
    }
    if(!indices.length||indices.some(i=>!indexed[i]))throw new Error('A correct option is missing or points to a blank answer column.');
    card={type:'choice',prompt,choices:present.map(x=>x.v),correct:indices.map(i=>present.findIndex(x=>x.i===i))};
  }else{
    const wrong=[1,2,3].map(i=>read(`Incorrect Answer ${i}`,`Wrong Answer ${i}`)).filter(Boolean);
    if(wrong.length)card={type:'choice',prompt,choices:[answer,...wrong],correct:[0]};
    else card={type:'pair',prompt,answer,alternatives:read('Accepted Alternatives','Alternative Answers').split('|').map(text).filter(Boolean)};
  }
  return validateCard({...card,image,imageAlt,category:read('Category','Question Category')},{renewId:true});
}
function adaptJson(raw) {
  if(raw.type==='pair'||raw.type==='choice'||raw.prompt)return validateCard(raw,{renewId:true});
  if(Array.isArray(raw.answers))return validateCard({type:'choice',category:raw.category,prompt:raw.text||raw.question,choices:raw.answers,correct:Array.isArray(raw.correct)?raw.correct:[raw.correct],image:raw.image,imageAlt:raw.imageAlt},{renewId:true});
  return validateCard({type:'pair',category:raw.category,prompt:raw.term||raw.question||raw.front,answer:raw.definition||raw.answer||raw.back,alternatives:raw.alternatives||[],image:raw.image||raw.imageUrl,imageAlt:raw.imageAlt},{renewId:true});
}
export function parseImport(input,format='auto') {
  const s=String(input||'').replace(/^\uFEFF/,'');
  if(new TextEncoder().encode(s).length>1000000)throw new Error('Import files must be smaller than 1 MB.');
  if(!s.trim())throw new Error('Paste or upload a list first.');
  if(!['auto','csv','tsv','semicolon','colon','json'].includes(format))throw new Error('Unknown import format.');
  const result={cards:[],errors:[],warnings:[],format,title:'',rows:0};
  const add=(fn,line)=>{try{result.cards.push(fn());}catch(e){result.errors.push({line,message:e.message});}};
  if(format==='json'||(format==='auto'&&/^[\[{]/.test(s.trim()))){
    let data;try{data=JSON.parse(s);}catch{throw new Error('This is not valid JSON.');}
    const cards=Array.isArray(data)?data:data.cards||data.questions||data.list?.cards;
    if(!Array.isArray(cards))throw new Error('JSON must be a QuizDock backup or an array of cards.');
    if(cards.length>MAX_CARDS)throw new Error(`Split this import into lists of at most ${MAX_CARDS} cards.`);
    result.title=typeof data.title==='string'?data.title.slice(0,100):'';result.format='json';result.rows=cards.length;
    cards.forEach((c,i)=>add(()=>adaptJson(c),i+1));
  }else{
    if(format==='auto'){
      if(s.includes('\t'))format='tsv';
      else{
        const first=s.split(/\r?\n/).find(x=>x.trim())||'';
        if(first.includes(';')&&(!first.includes(',')||/Question|Prompt|Term/i.test(first)))format='semicolon';
        else if(first.includes(':') && !/Question Text|Correct Answer|Answer 1/i.test(first) && first.indexOf(':')<first.indexOf(','))format='colon';
        else if(!first.includes(',')&&first.includes(':'))format='colon';
        else format='csv';
      }
    }
    result.format=format;
    if(format==='colon'){
      const lines=s.split(/\r?\n/).map((line,i)=>({line,i})).filter(x=>x.line.trim());
      if(lines.length>MAX_CARDS)throw new Error(`Split this import into lists of at most ${MAX_CARDS} cards.`);
      result.rows=lines.length;
      lines.forEach(({line,i})=>add(()=>{const pos=line.indexOf(':');if(pos<0)throw new Error('Expected term:definition (one pair per line).');return validateCard({type:'pair',prompt:line.slice(0,pos),answer:line.slice(pos+1)},{renewId:true});},i+1));
    }else{
      const rows=parseDelimited(s,format==='tsv'?'\t':format==='semicolon'?';':',');
      if(!rows.length)throw new Error('No rows found.');
      let headers=rows[0].cells;
      let hasHeader=findHeader(headers,['Question Text','Question','Prompt','Term','Front','Spanish','English'])>=0 && headers.some(h=>['answer','answer1','correctanswer','definition','back','english','spanish'].includes(heading(h)));
      let data=hasHeader?rows.slice(1):rows;
      if(data.length>MAX_CARDS)throw new Error(`Split this import into lists of at most ${MAX_CARDS} cards.`);
      result.rows=data.length;
      // Two-column language and vocabulary headers use left as prompt, right as answer.
      const twoColumn=(!hasHeader && headers.length===2)||(hasHeader && headers.length===2 && findHeader(headers,['Answer 1'])<0);
      if(!hasHeader&&!twoColumn)throw new Error('For multiple-choice imports, include column headers. Two-column pairs may omit headers.');
      data.forEach(({cells,line})=>add(()=>{
        if(cells.length>headers.length && !twoColumn)throw new Error('This row has more fields than the header. Quote text that contains the delimiter.');
        if(twoColumn){if(cells.length!==2)throw new Error('Expected exactly two columns; quote embedded commas.');return validateCard({type:'pair',prompt:cells[0],answer:cells[1]},{renewId:true});}
        return cardFromRow(cells,headers,line);
      },line));
    }
  }
  const seen=new Set();let duplicates=0;
  for(const c of result.cards){const f=cardFingerprint(c);if(seen.has(f))duplicates++;seen.add(f);}
  if(duplicates)result.warnings.push(`${duplicates} exact duplicate card(s) found. They are preserved unless you choose to skip duplicates.`);
  if(result.cards.some(c=>c.image.startsWith('http:')))result.warnings.push('Some images use HTTP. Use HTTPS image URLs to avoid browser mixed-content blocks.');
  return result;
}
export function mergeCards(existing,incoming,{replace=false,skipDuplicates=false}={}) {
  const cards=replace?[]:existing.map(c=>validateCard(c));const seen=new Set(cards.map(cardFingerprint));let skipped=0;
  for(const raw of incoming){const c=validateCard(raw,{renewId:true}),fp=cardFingerprint(c);if(skipDuplicates&&seen.has(fp)){skipped++;continue;}cards.push(c);seen.add(fp);}
  if(cards.length>MAX_CARDS)throw new Error(`This would create ${cards.length} cards. The limit is ${MAX_CARDS}.`);
  return {cards,skipped};
}
const csvQuote = s => `"${String(s??'').replaceAll('"','""')}"`;
const csvSafe = s => /^[=+\-@\t\r]/.test(String(s))?"'"+s:String(s??'');
export function exportList(raw,format='json') {
  const list=validateList(raw);
  if(format==='json')return JSON.stringify({format:'quizdock-list',version:1,...list},null,2);
  if(format!=='csv')throw new Error('Export format must be CSV or JSON.');
  const header=['Card Type','Question Text','Correct Answer','Accepted Alternatives','Answer 1','Answer 2','Answer 3','Answer 4','Correct Answer(s)','Image URL','Image Alt','Category','QuizDock Safe Text'];
  const rows=list.cards.map(c=>[c.type,c.prompt,c.type==='pair'?c.answer:'',c.type==='pair'?c.alternatives.join('|'):'',...[0,1,2,3].map(i=>c.type==='choice'?(c.choices[i]||''):''),c.type==='choice'?c.correct.map(i=>i+1).join(','):'',c.image,c.imageAlt,c.category||'','yes'].map(csvSafe));
  return [header,...rows].map(r=>r.map(csvQuote).join(',')).join('\r\n');
}
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
