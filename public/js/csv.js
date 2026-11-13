// Flexible imports: Blooket template, Gimkit exports, generic MCQ, and two-column vocabulary sets.
export function readCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let field = ''; let row = []; let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (inQuotes && input[i+1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && input[i+1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  if (inQuotes) throw new Error('CSV contains an unclosed quotation mark.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
const normalize = s => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const find = (headers, names) => headers.findIndex(h => names.some(n => normalize(h) === normalize(n)));
const val = (r, i) => i < 0 ? '' : String(r[i] ?? '').trim();
const compact = x => String(x).trim();
function dedupe(options) { return [...new Set(options.map(compact).filter(Boolean))]; }

export function importCsv(text) {
  const rows = readCsv(text);
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one question.');
  if (rows.length > 1000) throw new Error('Please import no more than 250 questions at a time.');
  const headers = rows[0];
  const qIndex = find(headers, ['Question Text', 'Question', 'Prompt', 'Spanish', 'Term', 'Front']);
  const correctIndex = find(headers, ['Correct Answer', 'Correct', 'Answer', 'English', 'Definition', 'Back']);
  const correctNumbersIndex = find(headers, ['Correct Answer(s)', 'Correct Answers', 'Correct Option', 'Correct Option(s)']);
  const answerCols = [1, 2, 3, 4].map(i => find(headers, [`Answer ${i}`, `Option ${i}`, `Choice ${i}`]));
  const wrongCols = [1, 2, 3].map(i => find(headers, [`Incorrect Answer ${i}`, `Wrong Answer ${i}`]));
  if (qIndex < 0) {
    throw new Error('Missing a question column. Use “Question Text” or “Question”.');
  }
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i], text = val(row, qIndex);
    if (!text) continue;
    let answers = [], correct = [];
    if (answerCols.some(index => index >= 0)) {
      answers = answerCols.map(col => val(row, col)).filter(Boolean);
      const numeric = val(row, correctNumbersIndex);
      if (numeric) {
        correct = numeric.split(/[,;|\s]+/).map(s => Number(s) - 1).filter(i => Number.isInteger(i) && i >= 0 && i < answers.length);
      } else {
        const target = val(row, correctIndex);
        const asNumber = Number(target);
        const match = answers.findIndex(a => a.toLowerCase() === target.toLowerCase());
        if (match >= 0) correct = [match];
        else if (target && Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= answers.length) correct = [asNumber - 1];
      }
      if (!correct.length) throw new Error(`Row ${i + 1}: specify the correct answer or option number.`);
    } else if (correctIndex >= 0) {
      const answer = val(row, correctIndex);
      if (!answer) throw new Error(`Row ${i + 1}: missing correct answer.`);
      answers = dedupe([answer, ...wrongCols.map(col => val(row, col))]);
      correct = [answers.findIndex(a => a === answer)];
    } else throw new Error('CSV needs answer columns or a “Correct Answer” column.');
    records.push({ text, answers, correct });
  }
  if (records.length < 1 || records.length > 250) throw new Error('Import between 1 and 250 questions.');
  // For simple vocabulary CSVs, distractors come from other correct answers in the SAME upload.
  const answerPool = dedupe(records.flatMap(r => r.correct.map(i => r.answers[i])));
  const finished = records.map((r, i) => {
    if (r.answers.length < 2) {
      const correctAnswer = r.answers[r.correct[0]];
      const alternatives = answerPool.filter(a => a.toLocaleLowerCase() !== correctAnswer.toLocaleLowerCase());
      const distractors = alternatives.slice(i % Math.max(1, alternatives.length)).concat(alternatives.slice(0, i % Math.max(1, alternatives.length)));
      r.answers = dedupe([correctAnswer, ...distractors]).slice(0, 4);
      r.correct = [0];
    }
    if (r.answers.length < 2) throw new Error('At least two distinct answers are needed. Add more vocabulary pairs or answer choices.');
    if (new Set(r.answers.map(a => a.toLocaleLowerCase())).size < r.answers.length) throw new Error(`Question ${i + 1} has duplicate choices.`);
    return r;
  });
  return finished;
}
export const TEMPLATE = `Question Text,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer(s)\n¿Qué significa "aprovechar"?,to take advantage of,to refuse,to collect,to forget,1\n¿Cómo se dice "to learn"?,aprender,olvidar,correr,dormir,1\n¿Cuál es el pretérito de "tener" (yo)?,tuve,tenía,tengo,tendré,1\n`;
export const DEMO = `Spanish,English\naprender,to learn\ncomer,to eat\nescribir,to write\ncaminar,to walk\nvender,to sell\nvivir,to live\ncomprar,to buy\nabrir,to open\nrecibir,to receive\nbeber,to drink\nconocer,to know a person\nexplicar,to explain\n`;
