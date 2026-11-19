// datetime-local inputs use the class calendar, never the browser's timezone.
export function localDateTimeInput(timestamp,timezone='America/Los_Angeles'){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(timestamp).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export const assignmentRevision=a=>Number.isSafeInteger(a?.revision)&&a.revision>0?a.revision:1;
