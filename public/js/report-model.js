// Reporting math is independent of gameplay points and random rewards.
export function sortedCards(cards,sort='missed',minimumAttempts=0,query='') {
  const min=Math.max(0,Math.floor(Number(minimumAttempts)||0)),q=String(query).toLocaleLowerCase('es');
  const direction={missed:-1,correct:-1,errorRate:-1,accuracy:-1,firstError:-1,order:1};
  if(!Object.hasOwn(direction,sort))sort='missed';
  const score=c=>sort==='missed'?c.incorrect:sort==='correct'?c.correct:sort==='errorRate'?c.errorRate:sort==='accuracy'?c.accuracy:sort==='firstError'?(c.firstAccuracy==null?null:100-c.firstAccuracy):c.number;
  return cards.filter(c=>c.attempts>=min&&c.prompt.toLocaleLowerCase('es').includes(q)).map(c=>({...c})).sort((a,b)=>{
    // Never treat an unanswered card as 0% or 100% accurate.
    if(sort!=='order'&&(!a.attempts||!b.attempts)){if(!a.attempts&&!b.attempts)return a.number-b.number;return a.attempts?-1:1;}
    const delta=(score(a)-score(b))*direction[sort];
    return delta||b.attempts-a.attempts||a.number-b.number;
  });
}
const csvCell=value=>{
  let s=value==null?'':String(value);if(typeof value==='string'&&/^\s*[=+\-@\t\r]/.test(value))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
};
export function reportCSV(report){
  const header=['Round ID','Game','Mode','Status','Started (UTC)','Finished (UTC)','List ID','List revision','Tracking partial','Card number','Card ID','Prompt','Correct answers','Attempts','Correct','Incorrect','Accuracy %','Distinct player sessions','Players ever correct','Players ever incorrect','First attempts','First correct','First incorrect','First-attempt accuracy %','Option 1','Option 1 selections','Option 2','Option 2 selections','Option 3','Option 3 selections','Option 4','Option 4 selections','Typed attempts','Typed correct','Typed incorrect','Attempts with letter clues'];
  const date=n=>n?new Date(n).toISOString():'';
  const rows=report.cards.map(c=>[report.id,report.title,report.mode,report.status,date(report.startedAt),date(report.finishedAt),report.source?.id||'',report.source?.revision??'',!!report.partial,c.number,c.id,c.prompt,c.correctOptions.map(i=>c.answers[i]).join(' | '),c.attempts,c.correct,c.incorrect,c.accuracy==null?'':Number(c.accuracy.toFixed(2)),c.uniqueStudents,c.uniqueCorrectStudents,c.uniqueIncorrectStudents,c.firstAttempts,c.firstCorrect,c.firstIncorrect,c.firstAccuracy==null?'':Number(c.firstAccuracy.toFixed(2)),...[0,1,2,3].flatMap(i=>[c.answers[i]||'',c.choiceCounts[i]??'']),c.typedAttempts||0,c.typedCorrect||0,c.typedIncorrect||0,c.hintedAttempts||0]);
  return [header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
