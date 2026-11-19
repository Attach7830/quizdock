import {ensure} from './library-domain.js';
import {DEFAULT_ZONE,localDay} from './academy-model.js';

export const LATE_ASSIGNMENT_CREDIT=50;
export function validateSemester(value){
 const valid=day=>typeof day==='string'&&/^\d{4}-\d\d-\d\d$/.test(day)&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;
 ensure(value&&valid(value.start)&&valid(value.end),'Choose valid semester start and end dates.');
 ensure(value.start<=value.end,'The semester end must be on or after its start.');
 return {start:value.start,end:value.end};
}
export function assignmentSemester(course,now=Date.now()){
 if(course.semester)return validateSemester(course.semester);
 const day=localDay(now,course.timezone||DEFAULT_ZONE),year=day.slice(0,4),fall=day.slice(5,7)>='07';
 // The teacher's initial fall term runs from August 10 through December 18.
 return {start:year+(fall?(year==='2026'?'-08-10':'-08-01'):'-01-01'),end:year+(fall?(year==='2026'?'-12-18':'-12-31'):'-06-30')};
}
export function inCurrentAssignmentSemester(assignment,semester,timezone=DEFAULT_ZONE,now=Date.now()){
 if(assignment.archived||!Number.isFinite(assignment.dueAt)||assignment.createdAt>now)return false;
 const today=localDay(now,timezone),due=localDay(assignment.dueAt,timezone);
 return today>=semester.start&&today<=semester.end&&due>=semester.start&&due<=semester.end;
}
export function availableAssignmentCredit(assignment,now=Date.now()){
 return now>assignment.dueAt?LATE_ASSIGNMENT_CREDIT:100;
}
