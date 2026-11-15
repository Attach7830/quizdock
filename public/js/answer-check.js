import {correctAnswers} from './list-model.js';
export function normalizeAnswer(value,{strictAccents=true}={}){
 let s=String(value??'').normalize('NFC').trim().toLocaleLowerCase('es').replace(/\s+/g,' ');
 // ñ remains a different letter even when optional accents are ignored.
 if(!strictAccents)s=s.replace(/[áéíóúü]/g,c=>({á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u'}[c]));
 return s;
}
export function gradeTyped(card,value,rules={}){const expected=correctAnswers(card);return {correct:expected.some(a=>normalizeAnswer(a,rules)===normalizeAnswer(value,rules)),expected};}
