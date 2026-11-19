import {ensure} from './library-domain.js';
import {practiceRules,dateTimeInZone} from './academy-model.js';
import {crosswordCandidates} from './assignment-crossword.js';
import {assignmentRevision,localDateTimeInput} from '../public/js/assignment-dates.js';
export {assignmentRevision};
export function ensureAssignmentRevision(a,p){
 const revision=assignmentRevision(a);if(p.assignmentRevision!==undefined||revision>1)ensure(p.assignmentRevision===revision,'Your teacher updated this assignment. Reload practice to review the new requirements. Your saved progress is kept.',412);
}
export const submissionSnapshot=a=>({revision:assignmentRevision(a),rules:structuredClone(a.rules),dueAt:a.dueAt,timezone:a.timezone});
export const submittedAssignment=(a,p)=>p.submittedAt&&p.submission?{...a,rules:p.submission.rules,dueAt:p.submission.dueAt,timezone:p.submission.timezone}:a;
export function assignmentEdits(a,p,now=Date.now()){
 ensure(!['cards','classId','listId','ownerId','timezone','createdAt','dueAt'].some(k=>Object.hasOwn(p,k)),'Edit the title, due date and practice settings. The class and posted cards stay with this assignment.');
 const title=Object.hasOwn(p,'title')?String(p.title??'').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g,' ').trim().slice(0,100):a.title;
 ensure(title,'Enter an assignment title.');
 const dueAt=p.dueLocal===undefined||p.dueLocal===localDateTimeInput(a.dueAt,a.timezone)?a.dueAt:dateTimeInZone(p.dueLocal,a.timezone);
 if(dueAt!==a.dueAt)ensure(dueAt>now-365*86400000&&dueAt<now+730*86400000,'Choose a due date within the supported range.');
 ensure(p.rules===undefined||p.rules&&typeof p.rules==='object'&&!Array.isArray(p.rules),'Use valid practice settings.');
 const rules=practiceRules({...a.rules,minMinutes:a.rules.minSeconds/60,...p.rules});
 ensure(rules.cardCountMode!=='distinct'||rules.minCards<=a.cards.length,'Distinct-card minimum cannot exceed the number of posted cards.');
 const eligible=crosswordCandidates(a.cards).length;ensure(!rules.crosswordWords||rules.crosswordWords<=eligible,`This assignment has ${eligible} unique answers that fit a crossword. Choose that many words or fewer (2–32 letters each).`);
 return {title,dueAt,rules};
}
