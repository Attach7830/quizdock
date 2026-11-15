import {correctAnswers} from './list-model.js';
export function normalizeAnswer(value,{strictAccents=true}={}){
 let s=String(value??'').normalize('NFC').trim().toLocaleLowerCase('es').replace(/\s+/g,' ');
 // ñ remains a different letter even when optional accents are ignored.
 if(!strictAccents)s=s.replace(/[áéíóúü]/g,c=>({á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u'}[c]));
 return s;
}
export function matchesTypedAnswer(expected,value,rules={}){
 const answer=normalizeAnswer(value,rules);if(!answer)return false;
 // Keep the complete answer valid, while treating semicolons as alternative meanings.
 return [expected,...String(expected??'').split(';')].some(a=>normalizeAnswer(a,rules)===answer);
}
export function gradeTyped(card,value,rules={}){const expected=correctAnswers(card);return {correct:expected.some(a=>matchesTypedAnswer(a,value,rules)),expected};}
