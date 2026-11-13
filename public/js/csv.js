import {parseDelimited,parseImport,compileQuestions} from './list-model.js';
export function readCsv(text){return parseDelimited(text,',').map(row=>row.cells);}
export function importCsv(text){
  const parsed=parseImport(text,'csv');
  if(parsed.errors.length)throw new Error(`Row ${parsed.errors[0].line}: ${parsed.errors[0].message} Use the teacher library import preview to inspect all rows.`);
  return compileQuestions({title:parsed.title||'Imported questions',description:'',cards:parsed.cards});
}
export const TEMPLATE = `Question Text,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer(s),Image URL,Image Alt\n"¿Qué significa ""aprovechar""?",to take advantage of,to refuse,to collect,to forget,1,,\n"¿Cómo se dice ""to learn""?",aprender,olvidar,correr,dormir,1,,\n"¿Cuál es el pretérito de ""tener"" (yo)?",tuve,tenía,tengo,tendré,1,,\n`;
export const DEMO = `Spanish,English\naprender,to learn\ncomer,to eat\nescribir,to write\ncaminar,to walk\nvender,to sell\nvivir,to live\ncomprar,to buy\nabrir,to open\nrecibir,to receive\nbeber,to drink\nconocer,to know a person\nexplicar,to explain\n`;
