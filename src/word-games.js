import {randomId,shuffle} from './game.js';
import {gradeTyped} from '../public/js/answer-check.js';
import {drawShuffledCard} from '../public/js/card-order.js';
export const WORD_MODES=['word','sketch'];
export const DRAW_COLORS=['#18344d','#e55f78','#3b9fc7','#48a889','#d4a146','#9471c6','#ffffff'];
export const DRAW_SIZES=[3,6,12,24];
export const MAX_DRAW_POINTS=4000,MAX_DRAW_STROKES=300;
const letters=s=>[...String(s).normalize('NFC')];
const alphabetic=c=>/^\p{L}$/u.test(c);
const clueWord=q=>String(q.answers[q.correct[0]]).split(';').map(s=>s.trim()).find(Boolean)||q.answers[q.correct[0]];
export function wordCardIndices(questions){return questions.map((q,i)=>({i,word:clueWord(q)})).filter(x=>letters(x.word).length<=40&&letters(x.word).some(alphabetic)).map(x=>x.i);}
export function validateWordDeck(questions){const indices=wordCardIndices(questions);if(!indices.length)throw new Error('Word games need an answer of at most 40 characters containing letters.');return indices;}
export function prepareWordQuestion(room,p){const draw=drawShuffledCard(p.wordCycle,validateWordDeck(room.questions),p.current?.index);p.wordCycle=draw.cycle;delete p.wordOrder;p.current={index:draw.index,key:randomId(6),order:[]};p.wordPuzzle={key:p.current.key,guesses:[],misses:0};}
function answerCard(q){return {type:'pair',answer:q.answers[q.correct[0]],alternatives:q.correct.slice(1).map(i=>q.answers[i])};}
export function gradeWord(q,raw){if(typeof raw!=='string'||!raw.trim()||raw.length>180)throw new Error('Type a word of 1–180 characters.');return gradeTyped(answerCard(q),raw,{strictAccents:true});}
function masked(word,shown){return letters(word).map((c,i)=>({value:!alphabetic(c)||shown.has(i)?c:'',letter:alphabetic(c)}));}
export function publicWordQuestion(room,p){if(!p.current)return null;const q=room.questions[p.current.index],word=clueWord(q),puzzle=p.wordPuzzle||{guesses:[],misses:0},shown=new Set(letters(word).map((c,i)=>puzzle.guesses.includes(c.toLocaleLowerCase('es'))?i:-1));return {key:p.current.key,text:q.text,number:p.current.index+1,input:'word',slots:masked(word,shown),guesses:puzzle.guesses,misses:puzzle.misses,hintsUsed:puzzle.guesses.length,...(q.image?{image:q.image,imageAlt:q.imageAlt}:{})};}
export function guessWordLetter(room,p,key,letter){
 if(room.status!=='playing'||p.feedback||p.current?.key!==key)throw new Error('This word is no longer active.');
 if(typeof letter!=='string'||letters(letter).length!==1||!alphabetic(letter))throw new Error('Choose one letter.');
 const puzzle=p.wordPuzzle;if(!puzzle||puzzle.key!==key)throw new Error('This word is no longer active.');letter=letter.normalize('NFC').toLocaleLowerCase('es');
 if(puzzle.guesses.includes(letter))return false;if(puzzle.misses>=6)throw new Error('Ink is empty. Type your final word guess.');
 puzzle.guesses.push(letter);const word=clueWord(room.questions[p.current.index]).toLocaleLowerCase('es');if(!word.includes(letter))puzzle.misses++;return true;
}
function candidates(room,online){const ids=new Set(online);return Object.values(room.players).filter(p=>!p.deleted&&ids.has(p.id)).sort((a,b)=>a.joinedAt-b.joinedAt||a.id.localeCompare(b.id));}
export function startSketchWord(room,online,now=Date.now()){
 const turn=(room.sketch?.turn||0)+1,pool=candidates(room,online),artist=pool.length?pool[(turn-1)%pool.length]:null,draw=drawShuffledCard(room.sketchCycle,validateWordDeck(room.questions),room.sketch?.cardIndex),index=draw.index,word=clueWord(room.questions[index]);
 room.sketchCycle=draw.cycle;
 room.sketch={id:randomId(8),turn,cardIndex:index,word,artistId:artist?.id||null,artists:artist?[artist.id]:[],phase:'drawing',startedAt:now,endsAt:now+60000,nextHintAt:now+15000,revealOrder:shuffle(letters(word).map((c,i)=>alphabetic(c)?i:-1).filter(i=>i>=0)),revealed:[],guessed:[],strokes:[],revision:0,clearEpoch:0,points:0,lastStrokeAt:0,offlineAt:null,reason:''};
 for(const p of Object.values(room.players)){p.feedback=null;p.pendingPlay=null;p.sketchReceipt=null;}
 if(artist&&artist.adventure)artist.adventure.drawings=(artist.adventure.drawings||0)+1;
 return room.sketch;
}
function closeSketch(room,reason,now){const s=room.sketch;s.phase='reveal';s.endsAt=now+5000;s.reason=reason;}
export function tickSketch(room,online,now=Date.now()){
 const s=room.sketch;if(room.mode!=='sketch'||room.status!=='playing'||!s)return false;let changed=false;
 if(now>=s.endsAt){if(s.phase==='drawing')closeSketch(room,'Time to reveal the word.',now);else startSketchWord(room,online,now);return true;}
 if(s.phase==='reveal')return false;
 const pool=candidates(room,online),guessers=pool.filter(p=>!s.artists.includes(p.id));
 if(guessers.length&&guessers.every(p=>s.guessed.includes(p.id))){closeSketch(room,'Everyone guessed it!',now);return true;}
 if(!pool.some(p=>p.id===s.artistId)){
  if(s.offlineAt===null){s.offlineAt=now;changed=true;}
  if(now-s.offlineAt>=8000){const next=pool.find(p=>!s.artists.includes(p.id));if(next&&pool.length>=2){s.artistId=next.id;s.artists.push(next.id);s.offlineAt=null;changed=true;}else if(pool.length>=2){closeSketch(room,'Passing the brush to a new word.',now);return true;}}
 }else if(s.offlineAt!==null){s.offlineAt=null;changed=true;}
 const maxHints=Math.min(4,Math.floor(s.revealOrder.length*.4));
 while(now>=s.nextHintAt&&s.revealed.length<maxHints){s.revealed.push(s.revealOrder[s.revealed.length]);s.nextHintAt+=15000;changed=true;}
 if(s.revealed.length>=maxHints)s.nextHintAt=s.endsAt;
 return changed;
}
export function pauseSketch(room,now=Date.now()){const s=room.sketch;if(s){s.remaining=Math.max(0,s.endsAt-now);s.hintRemaining=Math.max(0,s.nextHintAt-now);}}
export function resumeSketch(room,now=Date.now()){const s=room.sketch;if(s&&s.remaining!==undefined){s.endsAt=now+s.remaining;s.nextHintAt=now+s.hintRemaining;delete s.remaining;delete s.hintRemaining;}}
export function submitSketchGuess(room,p,id,raw,now=Date.now(),guessId){
 const s=room.sketch;if(room.status!=='playing'||s?.id!==id||s.phase!=='drawing'||now>=s.endsAt||now>=room.endsAt)throw new Error('This drawing word is no longer active.');
 if(typeof guessId!=='string'||!/^[a-zA-Z0-9_-]{6,80}$/.test(guessId))throw new Error('Invalid word guess identifier.');
 if(p.sketchReceipt?.wordId===id&&p.sketchReceipt.ids.includes(guessId))return{duplicate:true};
 if(s.artists.includes(p.id))throw new Error('Artists draw clues for this word. You can guess the next one.');
 if(s.guessed.includes(p.id))throw new Error('You already solved this word.');if(now-p.lastAnswerAt<900)throw new Error('Take a moment to look at the drawing before guessing again.');
 const q=room.questions[s.cardIndex],graded=gradeWord(q,raw);if(p.sketchReceipt?.wordId!==id)p.sketchReceipt={wordId:id,ids:[]};p.sketchReceipt.ids.push(guessId);if(p.sketchReceipt.ids.length>72)p.sketchReceipt.ids.shift();p.lastAnswerAt=now;p.answered++;p.streak=graded.correct?p.streak+1:0;let points=0;
 if(graded.correct){p.correct++;points=80+Math.max(0,4-s.revealed.length)*5;p.score+=points;s.guessed.push(p.id);const artist=room.players[s.artistId];if(artist&&!artist.deleted){const earned=Math.min(10,Math.max(0,60-s.points));artist.score+=earned;s.points+=earned;}if(p.adventure)p.adventure.solved=(p.adventure.solved||0)+1;}
 p.feedback={correct:graded.correct,correctAnswers:[],reward:graded.correct?`Word decoded! +${points} points. Keep the word secret for your classmates.`:'Not quite. Look at the drawing and letter clues, then try another word.',effect:{type:graded.correct?'decode':'guess'}};
 return {correct:graded.correct,cardIndex:s.cardIndex,typedAnswer:raw,hintsUsed:s.revealed.length,points};
}
export function publicSketch(room,connection,{history=false}={}){
 const s=room.sketch;if(room.mode!=='sketch'||!s)return null;const p=room.players[connection.playerId],artist=room.players[s.artistId],host=connection.role==='host',reveal=s.phase==='reveal'||room.status==='finished',isArtist=p&&s.artistId===p.id;
 return {id:s.id,turn:s.turn,artistId:s.artistId,artistName:artist?.name||'Waiting for an artist',phase:s.phase,endsAt:s.endsAt,remaining:s.remaining,revision:s.revision,clearEpoch:s.clearEpoch,canDraw:!!isArtist&&room.status==='playing'&&s.phase==='drawing',canManage:host,canPass:!!isArtist&&room.status==='playing'&&s.phase==='drawing',hasDrawn:!!p&&s.artists.includes(p.id),solved:!!p&&s.guessed.includes(p.id),guessedCount:s.guessed.length,reason:s.reason,slots:masked(s.word,new Set(reveal?letters(s.word).map((_,i)=>i):s.revealed)),word:host||isArtist||reveal?s.word:undefined,artistPoints:s.points,inkPercent:Math.max(0,Math.round((MAX_DRAW_POINTS-s.strokes.reduce((n,x)=>n+x.points.length,0))/MAX_DRAW_POINTS*100)),inkRemaining:MAX_DRAW_POINTS-s.strokes.reduce((n,x)=>n+x.points.length,0),...(history?{strokes:structuredClone(s.strokes)}:{})};
}
export function appendSketchStroke(room,p,msg,now=Date.now()){
 const s=room.sketch;if(room.status!=='playing'||s?.id!==msg.wordId||s.phase!=='drawing'||s.artistId!==p.id||now>=s.endsAt||now>=room.endsAt)throw new Error('Only the current artist can draw.');
 if(msg.clearEpoch!==s.clearEpoch)throw new Error('The drawing was cleared. Sync before drawing again.');
 if(typeof msg.id!=='string'||!/^[a-zA-Z0-9_-]{6,80}$/.test(msg.id))throw new Error('Invalid drawing stroke.');
 if(s.strokes.some(x=>x.id===msg.id))return {duplicate:true};
 const rate=s.strokeRate&&now-s.strokeRate.at<1000?s.strokeRate:{at:now,count:0};if(rate.count>=12)throw new Error('Drawing updates are arriving too quickly.');
 if(!DRAW_COLORS.includes(msg.color)||!DRAW_SIZES.includes(msg.size)||!Array.isArray(msg.points)||msg.points.length<1||msg.points.length>24||msg.points.some(p=>!Array.isArray(p)||p.length!==2||p.some((v,i)=>!Number.isInteger(v)||v<0||v>(i?650:1000))))throw new Error('Invalid drawing stroke.');
 const used=s.strokes.reduce((n,x)=>n+x.points.length,0);if(s.strokes.length>=MAX_DRAW_STROKES||used+msg.points.length>MAX_DRAW_POINTS)throw new Error('Canvas ink is full. Clear or erase to start a fresh drawing.');
 const stroke={id:msg.id,color:msg.color,size:msg.size,points:msg.points.map(p=>[...p])};s.strokes.push(stroke);s.strokeRate={at:rate.at,count:rate.count+1};s.lastStrokeAt=now;s.revision++;return {wordId:s.id,revision:s.revision,clearEpoch:s.clearEpoch,stroke};
}
export function clearSketch(room,actor,id,epoch){const s=room.sketch;if(room.status!=='playing'||s?.id!==id||s.phase!=='drawing'||!(actor.role==='host'||actor.playerId===s.artistId))throw new Error('Only the artist or teacher can clear the current drawing.');if(epoch!==undefined&&epoch!==s.clearEpoch)throw new Error('The drawing has already changed.');s.strokes=[];s.revision++;s.clearEpoch++;}
export function passSketch(room,actor,id,now=Date.now()){const s=room.sketch;if(room.status!=='playing'||s?.id!==id||!(actor.role==='host'||actor.playerId===s.artistId))throw new Error('Only the artist or teacher can pass the brush.');if(s.phase==='reveal'){if(actor.role!=='host')throw new Error('Wait for the next word.');return false;}closeSketch(room,'The artist passed the brush.',now);return true;}
