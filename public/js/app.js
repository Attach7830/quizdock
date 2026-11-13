import { importCsv, TEMPLATE, DEMO } from './csv.js';
import { createGameAnimations } from './animations.js?v=round-layout-2';
import { createPlayerViewport } from './player-viewport.js?v=round-layout-2';
import {imageMarkup,installImageFallback} from './list-images.js';
import {sortedCards,reportCSV} from './report-model.js';
installImageFallback();

const MODES = {
  treasure: { name: 'Treasure Quest', icon: '🧰', tagline: 'Open mystery chests and raid rivals.', instruction: 'Answer correctly to unlock one of three mystery chests.' },
  fishing: { name: 'Fishing Frenzy', icon: '🎣', tagline: 'Catch big fish and upgrade your rod.', instruction: 'Correct answers catch fish. Save points for a better rod.' },
  battle: { name: 'Battle Arena', icon: '⚡', tagline: 'Race for points and land big hits.', instruction: 'Every correct answer hits a random opponent.' },
  factory: { name: 'Factory Tycoon', icon: '🏭', tagline: 'Build machines that earn as you play.', instruction: 'Earn cash with answers, then build income-generating machines.' }
};
const $ = selector => document.querySelector(selector);
const root = $('#app');
const animations = createGameAnimations();
const playerViewport = createPlayerViewport(toast);
let roundSetupKey = null, nextMode = null;
const draft = { title: 'Spanish Review', mode: 'treasure', questions: [], source: '', minutes: 10 };
let session = null, room = null, socket = null, reconnectTimer = null, toastTimer = null, awaitingResponse = false;
const safe = value => String(value ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]));
const attr = safe;
const scorefmt = n => Number(n ?? 0).toLocaleString('en-US');
const modeInfo = mode => MODES[mode] || MODES.treasure;
const statusMarkup = status => `<span class="status ${safe(status)}">● ${safe({lobby:'Lobby',playing:'Live game',paused:'Paused',finished:'Finished'}[status] || status)}</span>`;
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4100);
}
function nav() {
  if (session?.role === 'student') return `<header class="player-toolbar"><div class="brand"><span class="brand-mark" aria-hidden="true">⚡</span><span>QuizDock</span></div><div class="nav-actions"><button type="button" class="btn ghost tiny-btn player-stats-button" data-player-action="stats" aria-controls="player-stats" aria-expanded="false">Stats</button><button type="button" class="btn ghost tiny-btn" data-player-action="fullscreen" aria-pressed="false">Fullscreen</button><button type="button" class="btn ghost tiny-btn" data-action="leave">Leave</button></div></header>`;
  return `<header><div class="brand"><span class="brand-mark">⚡</span><span>QuizDock</span></div><div class="nav-actions"><a class="btn ghost tiny-btn" href="/library.html">My lists</a><a class="btn ghost tiny-btn" href="/reports.html">Reports</a>${session
    ? `<button type="button" class="btn ghost tiny-btn" data-action="leave">← Leave room</button>`
    : `<button type="button" class="btn ghost" data-action="focus-join">Join a game</button><button type="button" class="btn mint" data-action="focus-create">Host a game</button>`}</div></header>`;
}
function footer() {
  return `<footer>QuizDock · A custom classroom arcade · Bring your own questions · Original game modes</footer>`;
}
function homeMarkup() {
  return `${nav()}<main class="container">
    <section class="hero"><div class="hero-copy"><div class="eyebrow">Class is in session. Game on.</div>
      <h1>Your classroom.<br><em>Your arcade.</em></h1>
      <p>Upload a CSV, pick a game, and watch your students jump into the action. No student accounts. Your own saved question library. Just learning that feels like play.</p>
      <div class="hero-actions"><button class="btn primary big" data-action="focus-create">✦ Create a game</button><button class="btn ghost big" data-action="focus-join">Join with a PIN ↗</button></div>
      <div class="muted small">✦ Built for classroom-sized live sessions · Up to 45 players</div>
    </div><div class="hero-art" aria-hidden="true">
      <div class="art-card art-main"><div class="art-head"><span class="pill">⚡ LIVE ROUND</span><span>🏆 2,480</span></div><div class="art-emoji">🏆💰</div><div style="font-size:21px;font-weight:900;font-family:Outfit">¿Qué significa “aprender”?</div><div class="art-answer">✓ To learn</div><div class="art-answer">To sleep</div></div>
      <div class="art-card art-small">+250 ✨</div><div class="art-card art-bottom">🔥 5 answer streak</div><span class="spark one">✦</span><span class="spark two">✨</span>
    </div></section>
    <section id="create-section"><div class="section-title"><div><div class="eyebrow">01 · Choose your adventure</div><h2>Four ways to play</h2></div><span class="muted small">One CSV works for every mode</span></div>
      <div class="grid four">${Object.entries(MODES).map(([key, m]) => `<button type="button" class="card mode ${draft.mode===key?'selected':''}" data-action="mode" data-mode="${key}" aria-pressed="${draft.mode===key}"><span class="mode-icon">${m.icon}</span><span class="mode-label">${m.name}</span><span class="mode-desc">${m.tagline}</span></button>`).join('')}</div>
      <div class="setup-area"><div class="card"><div class="card-head"><span class="step">2</span><h3>Bring your questions</h3></div>
        <label class="field-label" for="game-title">Game title</label><input class="field" id="game-title" maxlength="70" placeholder="e.g., Spanish 2 — Unit 3" value="${attr(draft.title)}" />
        <label class="field-label" for="csv-file">Question set (.csv)</label>
        <label class="dropzone" id="dropzone" tabindex="0" for="csv-file"><span class="upload-icon">📂</span><strong>${draft.source ? safe(draft.source) : 'Choose a CSV or drag it here'}</strong><span class="muted small">Blooket-style, Gimkit-style or two-column vocabulary CSV</span><input type="file" id="csv-file" accept=".csv,text/csv" /></label>
        <div class="sub-actions"><button class="link-btn" data-action="template" type="button">↓ Download CSV template</button><button class="link-btn" data-action="demo" type="button">Try demo questions</button></div>
        ${draft.questions.length ? `<div class="preview"><strong>✓ ${draft.questions.length} questions ready</strong>${draft.questions.slice(0,4).map((q,i)=> `<div class="preview-row"><span class="muted">${i+1}.</span> ${safe(q.text)}<div class="muted tiny">${safe(q.answers[q.correct[0]])} · ${q.answers.length} choices</div></div>`).join('')}</div>` : `<p class="notice">Your files stay in the game room for this session, rather than in a public question library.</p>`}
      </div><div class="card" id="join-section"><div class="card-head"><span class="step">3</span><h3>Start the fun</h3></div>
        <p class="muted small">Ready? Create a private classroom PIN and share it with your students.</p>
        <div style="margin:20px 0;padding:18px;border:1px solid #3d4672;border-radius:15px;background:#111831"><div class="muted small">Selected game</div><h3 style="margin:7px 0">${modeInfo(draft.mode).icon} ${modeInfo(draft.mode).name}</h3><p class="muted small">${modeInfo(draft.mode).instruction}</p></div>
        <button type="button" data-action="create" class="btn primary wide big" ${draft.questions.length ? '' : 'disabled'}>Create game room →</button>
        <p class="notice">Sign in to My lists to host games and save private round reports. Students still join with a PIN.</p>
        <div style="border-top:1px solid var(--border);margin:23px 0 19px"></div>
        <h3>Joining as a student?</h3><p class="muted small" style="margin:9px 0 15px">Enter your teacher's six-digit room PIN.</p>
        <form id="join-form"><label class="field-label" for="join-pin">Game PIN</label><input id="join-pin" class="field" required pattern="[0-9]{6}" inputmode="numeric" maxlength="6" placeholder="123456" value="${safe(new URLSearchParams(location.search).get('join') || '')}" />
          <label class="field-label" for="join-name">Nickname</label><input id="join-name" class="field" required minlength="2" maxlength="24" autocomplete="nickname" placeholder="Your nickname" />
          <button class="btn mint wide" style="margin-top:17px" type="submit">Join game →</button></form>
      </div></div>
    </section><div class="features"><div class="feature"><div class="glyph">⚡</div><b>Live multiplayer</b><p>Instant feedback, synchronized scores, and a classroom leaderboard.</p></div><div class="feature"><div class="glyph">📄</div><b>CSV-friendly</b><p>Works with your existing question sets, including vocabulary lists.</p></div><div class="feature"><div class="glyph">🔒</div><b>Minimal student data</b><p>Nicknames only. Students don't need accounts to join.</p></div></div>
  </main>${footer()}`;
}
function leaderboard(state, compact = false) {
  if (!state?.players?.length) return `<div class="waiting"><div class="waiting-emoji">🪑</div><p class="muted">No players yet. Share the PIN to invite your class.</p></div>`;
  return `<div class="table-wrap"><table class="rank-table"><thead><tr><th>Rank</th><th>Player</th><th class="num">${state.mode === 'treasure' ? 'Coins' : state.mode === 'factory' ? 'Cash' : 'Points'}</th>${compact?'':'<th class="num">Correct</th>'}</tr></thead><tbody>${state.players.slice(0, compact ? 7 : 45).map((p,i)=> `<tr data-player-id="${attr(p.id)}"><td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td><td>${safe(p.name)} ${state.me?.id===p.id?'(you)':''}</td><td class="num"><b>${scorefmt(p.score)}</b></td>${compact?'':`<td class="num">${p.correct}/${p.answered}</td>`}</tr>`).join('')}</tbody></table></div>`;
}
function cardReportPanel(s) {
  const r=s.cardReport;if(!r)return '';
  const missed=sortedCards(r.cards,'missed',1).filter(c=>c.incorrect>0).slice(0,4);
  const mastered=sortedCards(r.cards,'correct',1).filter(c=>c.correct>0).slice(0,4);
  const rows=(cards,key)=>cards.map(c=>`<p>${c.number}. ${safe(c.prompt)}<small>${c[key]} ${key} / ${c.attempts} attempts · ${c.uniqueStudents} players</small></p>`).join('')||'<p class="muted">No matching answers recorded.</p>';
  return `<section class="card live-card-panel"><h3>Card-level results</h3><p class="muted small">${r.summary.correct} correct · ${r.summary.incorrect} incorrect · ${r.summary.cardsAnswered}/${r.cards.length} cards answered${r.partial?' · Partial tracking':''}</p><div class="live-card-columns"><div><h3>Most missed</h3>${rows(missed,'incorrect')}</div><div><h3>Most correct</h3>${rows(mastered,'correct')}</div></div><div class="live-report-tools"><button class="btn ghost tiny-btn" data-action="round-csv">Export card results · CSV</button><a class="btn mint tiny-btn" href="/reports.html?round=${attr(r.id)}" target="_blank" rel="noopener">Open detailed report</a></div><p class="notice">${s.reportArchived?'This snapshot is saved to your teacher account.':'Answers are saved in this game room; the private report archive is syncing.'} Repeated attempts and distinct player sessions are counted separately.</p></section>`;
}
function teacherMarkup() {
  const s = room;
  if (!s) return `${nav()}<main class="container"><div class="card waiting"><div class="waiting-emoji">📡</div><h2>Connecting to your room…</h2><p class="muted">Check your connection if this persists.</p></div></main>`;
  const status = s.status;
  const setupKey = `${s.pin}:${s.startedAt || 0}:${status}`;
  if (roundSetupKey !== setupKey) { roundSetupKey = setupKey; nextMode = s.mode; draft.minutes = s.durationMinutes || draft.minutes; }
  const online = new Set(s.online || []);
  const time = status === 'playing' ? Math.max(0, s.endsAt-Date.now()) : status === 'paused' ? s.remainingMs : 0;
  return `${nav()}<main class="container">
    <div class="room-header"><div><div class="eyebrow">Teacher control center</div><h1 class="room-title">${safe(s.title)}</h1><div style="margin-top:10px">${statusMarkup(status)} <span class="muted small" style="margin-left:9px">${modeInfo(s.mode).icon} ${modeInfo(s.mode).name}</span></div></div>
      <div class="code-block"><div><div class="muted tiny">SHARE THIS GAME PIN</div><div class="room-pin">${s.pin}</div></div><button class="btn ghost tiny-btn" data-action="copy-pin">📋 Copy</button></div></div>
    <div class="teacher-grid"><div class="grid">
      <section class="card"><h3>🎮 Game controls</h3><p class="muted small" style="margin-top:7px">Students join at <b>${safe(location.host)}</b> with the PIN above. <button class="link-btn" data-action="copy-link">Copy join link</button></p>
      ${status==='lobby'||status==='finished'? `<div class="round-setup"><h3>${status==='finished'?'Next game · same room':'Set up this game'}</h3><p class="muted small">${status==='finished'?'Everyone stays connected. Keep this game type or choose another. Scores reset; the previous report stays saved.':'Choose a game type and duration for this room.'}</p><div class="control-row"><label class="small bold mode-field">Game type<select class="field" id="next-mode">${Object.entries(MODES).map(([id,m])=>`<option value="${id}" ${nextMode===id?'selected':''}>${m.name}</option>`).join('')}</select></label><label class="small bold">Game length<select class="field" id="duration">${[3,5,8,10,15,20,30].map(n=> `<option value="${n}" ${draft.minutes===n?'selected':''}>${n} min</option>`).join('')}</select></label><button class="btn mint big" data-action="start" ${s.players.length?'':'disabled'}>▶ ${status==='finished'?'Start next game':'Start game'}</button></div><p class="notice">Same PIN ${s.pin} · Same question set · ${s.players.length} players${status==='finished'?` · Next round ${(s.roundNumber || 1)+1}`:''}</p></div>`:''}
      ${status==='playing'? `<div class="control-row"><div style="flex:1"><div class="muted small">Time remaining</div><div class="timer" data-countdown>${formatTime(time)}</div></div><button class="btn ghost" data-action="pause">Ⅱ Pause</button><button class="btn danger" data-action="end">■ End game</button></div>`:''}
      ${status==='paused'? `<div class="control-row"><div class="timer" data-countdown>${formatTime(time)}</div><button class="btn mint" data-action="resume">▶ Resume</button><button class="btn danger" data-action="end">■ End game</button></div>`:''}
      ${status==='finished'? `<div class="feedback good"><b>🏆 Game complete!</b><p>${s.players[0]?`${safe(s.players[0].name)} finished in first place with ${scorefmt(s.players[0].score)} ${s.mode==='treasure'?'coins':s.mode==='factory'?'cash':'points'}.`:'No players competed.'}</p></div><div style="margin-top:13px"><button class="btn ghost tiny-btn" data-action="export">↓ Export student results</button></div>`:''}
      <div class="kpi-grid"><div class="kpi"><strong>${s.players.length}</strong><small>Players</small></div><div class="kpi"><strong>${s.questionCount}</strong><small>Questions</small></div><div class="kpi"><strong>${s.players.reduce((a,p)=>a+p.answered,0)}</strong><small>Answers</small></div></div>
      </section>
      <section class="card"><h3>👋 Students in the room</h3><p class="muted small" style="margin-top:7px">${online.size} connected · ${s.players.length} joined</p><div class="people">${s.players.map(p=> `<span class="person ${online.has(p.id)?'':'offline'}">${online.has(p.id)?'🟢':'⚪'} ${safe(p.name)}</span>`).join('') || '<span class="muted">Waiting for the first student…</span>'}</div></section>
      </div><div class="card"><h3>🏆 Live leaderboard</h3><p class="muted small" style="margin:8px 0 15px">Scores update as students play.</p>${leaderboard(s)}</div></div>
    ${cardReportPanel(s)}
    <p class="notice">Tip: Keep this teacher tab open while your class plays. If you reload it, the same private session will reconnect.</p>
  </main>${footer()}`;
}
function studentStats(s) {
  const p = s.me || {};
  const base = s.mode === 'treasure' ? [['🪙 Coins',p.coins], ['🔥 Streak',p.streak]] :
    s.mode === 'fishing' ? [['🐟 Fish',p.fishCount], ['🏋️ Biggest',`${p.biggestFish ?? 0} kg`], ['🎣 Rod level',p.rodLevel], ['✨ Points',p.score]] :
    s.mode === 'factory' ? [['💵 Cash',`$${scorefmt(p.cash)}`], ['🏭 Machines',p.machineLevel], ['🔥 Streak',p.streak]] :
    [['⭐ Points',p.score], ['❤️ HP',p.hp], ['🔥 Streak',p.streak]];
  return `<div class="stats-grid">${base.map(([name,value])=> `<div class="stat"><span class="value">${safe(value)}</span><span class="name">${safe(name)}</span></div>`).join('')}</div>`;
}
function gameControls(s) {
  if (s.mode === 'fishing') return `<button class="btn ghost wide" data-action="upgrade" ${s.me.score < (s.me.rodLevel+1)*100?'disabled':''}>🎣 Upgrade rod · ${(s.me.rodLevel+1)*100} points</button>`;
  if (s.mode === 'factory') return `<button class="btn gold wide" data-action="upgrade" ${s.me.cash < (s.me.machineLevel+1)*120?'disabled':''}>🏭 Buy machine · $${(s.me.machineLevel+1)*120}</button><p class="notice">Each machine produces $8 every five seconds.</p>`;
  return '';
}
function gameQuestion(s) {
  const p = s.me, q = p.question;
  if (!q) return '<p class="muted">Preparing your next question…</p>';
  const fb = p.feedback;
  return `<div class="eyebrow">Question ${q.number} of ${s.questionCount}</div>${imageMarkup(q)}<h2 class="quiz-title">${safe(q.text)}</h2>
    <div class="option-list">${q.options.map((ans,i)=> `<button class="option ${fb && fb.correctAnswers.includes(ans)?'correct-opt':''} ${fb && fb.selected===i && !fb.correct?'wrong-opt':''}" data-action="answer" data-key="${attr(q.key)}" data-choice="${i}" ${fb||awaitingResponse?'disabled':''}><span class="letter">${'ABCD'[i]}</span>${safe(ans)}</button>`).join('')}</div>
    ${fb ? `<div class="feedback ${fb.correct?'good':'bad'}"><b>${fb.correct?'✓ Correct answer!':'✗ Not quite!'}</b><p>${safe(fb.reward)}</p>${fb.correct?'':`<p style="margin-top:5px">Correct: ${safe(fb.correctAnswers.join(' / '))}</p>`}</div>
      ${p.pendingChests ? `<div class="center" style="margin:17px 0;font-weight:800">Pick your treasure chest!</div><div class="chests">${[0,1,2].map(i=> `<button class="chest" data-action="chest" data-index="${i}"><span>🧰</span>Chest ${i+1}</button>`).join('')}</div>` : `<button style="margin-top:16px" class="btn mint wide big" data-action="next">Next question →</button>`}` : `<p class="notice">Tap the answer you think is correct.</p>`}
  `;
}
function studentMarkup() {
  const s = room;
  if (!s) return `${nav()}<main class="player-main"><div class="card waiting"><div class="waiting-emoji">📡</div><h2>Connecting to the game…</h2></div></main>`;
  const playerScore = s.players.find(p=>p.id===s.me?.id)?.score || 0;
  return `${nav()}<main class="player-main"><div class="player-heading"><div class="player-identity"><h1 class="room-title" title="${attr(s.title)}">${safe(s.title)}</h1><div class="player-meta"><span>${safe(s.me?.name)}</span><span>PIN ${s.pin}</span><span>Round ${s.roundNumber || (s.startedAt?1:0) || 1}</span></div></div><div class="player-hud"><span class="player-score" title="Your score">${scorefmt(playerScore)} <small>${s.mode==='treasure'?'coins':s.mode==='factory'?'cash':'pts'}</small></span>${s.status==='playing'||s.status==='paused'?`<span class="timer" data-countdown aria-label="Time remaining">${formatTime(s.status==='paused'?s.remainingMs:s.endsAt-Date.now())}</span>`:statusMarkup(s.status)}</div></div>
    <div class="student-layout"><section class="card player-question-card" aria-label="Game and questions"><div class="question-scroll" tabindex="0" aria-label="Question and answer area">${s.status==='playing'?gameQuestion(s): s.status==='lobby'?`<div class="waiting"><div class="waiting-emoji">🚀</div><h2>You're in!</h2><p class="muted">Waiting for your teacher to start the game.</p><p class="notice">${s.players.length} players have joined so far.</p></div>`:
      s.status==='paused'?`<div class="waiting"><div class="waiting-emoji">⏸️</div><h2>Game paused</h2><p class="muted">Your teacher will resume shortly.</p></div>`:
      `<div class="waiting"><div class="waiting-emoji">🏆</div><h2>Round complete!</h2><p class="muted">${s.players[0]?.id===s.me?.id?'You finished in first place!':`Winner: ${safe(s.players[0]?.name || 'No one')}`}</p><p class="bold">Your score: ${scorefmt(playerScore)}</p><p class="stay-connected">Stay here! Your teacher can start another game with the same PIN.</p></div>`}</div></section>
      <button type="button" class="player-scrim" data-player-action="close-stats" aria-label="Close statistics" tabindex="-1" hidden></button><aside id="player-stats" class="grid player-sidebar" aria-label="Your statistics and leaderboard" tabindex="-1"><div class="player-sidebar-heading"><h2>Game stats</h2><button type="button" class="btn ghost tiny-btn" data-player-action="close-stats">Back to game</button></div><div class="card"><h3>${modeInfo(s.mode).icon} ${modeInfo(s.mode).name}</h3><p class="muted small" style="margin-top:7px">${modeInfo(s.mode).instruction}</p>${studentStats(s)}${s.status==='playing'?gameControls(s):''}</div>
      <div class="card"><h3>🏅 Leaderboard</h3>${leaderboard(s,true)}</div></aside></div>
  </main>`;
}
function formatTime(ms) { const s = Math.ceil(Math.max(0, Number(ms) || 0) / 1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function paint() {
  playerViewport.beforePaint();
  animations.beforePaint();
  root.innerHTML = !session ? homeMarkup() : session.role === 'host' ? teacherMarkup() : studentMarkup();
  refreshClock();
  animations.afterPaint(room, session?.role);
  playerViewport.afterPaint(room, session?.role);
}
function refreshClock() {
  for (const el of document.querySelectorAll('[data-countdown]')) {
    if (!room) continue;
    el.textContent = formatTime(room.status==='paused'?room.remainingMs:room.endsAt-Date.now());
  }
}
function send(data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) { toast('Connection lost. Reconnecting…'); return false; }
  socket.send(JSON.stringify(data)); return true;
}
function connect() {
  if (!session) return;
  clearTimeout(reconnectTimer);
  if (socket) { socket.onclose = null; try {socket.close();} catch {} }
  const protocol = location.protocol === 'https:'?'wss:':'ws:';
  const connection = new WebSocket(`${protocol}//${location.host}/api/room/${session.pin}/socket`);
  socket = connection;
  connection.onopen = () => { if (socket === connection && session) send({ type:'auth', role:session.role, token:session.token, playerId:session.playerId }); };
  connection.onmessage = event => {
    if (socket !== connection || !session) return;
    let msg; try {msg = JSON.parse(event.data);} catch {return;}
    if (msg.type==='state') { room=msg; awaitingResponse=false; paint(); }
    else if (msg.type==='error') { awaitingResponse=false; toast(msg.error); paint(); }
    else if (msg.type==='notice') toast(msg.message);
  };
  connection.onclose = () => { if (session && socket === connection) {reconnectTimer = setTimeout(connect, 1800);} };
  connection.onerror = () => {}; // onclose handles retries.
}
function resyncRoom() {
  if (!session || document.hidden) return;
  if (socket?.readyState === WebSocket.OPEN) send({type:'sync'});
  else if (!socket || socket.readyState === WebSocket.CLOSED) connect();
}
window.addEventListener('online', resyncRoom);
window.addEventListener('pageshow', resyncRoom);
document.addEventListener('visibilitychange', resyncRoom);
function storeSession(value) {
  session = value;
  if (value) sessionStorage.setItem('quizdock-session',JSON.stringify(value));
  else sessionStorage.removeItem('quizdock-session');
}
function leaveRoom() {
  if (socket) {socket.onclose=null;try {socket.close();} catch {} socket=null;}
  clearTimeout(reconnectTimer); room=null; awaitingResponse=false; storeSession(null);
  if (location.search) history.replaceState({},'',location.pathname);
  paint();
}
async function loadFile(file) {
  if (!file) return;
  if (file.size > 200_000) {toast('CSV files must be smaller than 200 KB.');return;}
  try {const content=await file.text();draft.questions=importCsv(content);draft.source=file.name;paint();toast(`${draft.questions.length} questions imported!`);} catch(err){toast(err.message);}
}
async function post(path, data) {
  let resp;
  try { resp=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}); }
  catch {throw new Error('Cannot reach the game server. Check your connection.');}
  const body=await resp.json().catch(()=>({error:'Unexpected server response.'}));
  if (!resp.ok) throw new Error(body.error||'Request failed.');
  return body;
}
async function createRoom() {
  roundSetupKey = null; nextMode = null;
  if (!draft.questions.length) {toast('Import some questions first.');return;}
  try {
    const info=await post('/api/create',{title:draft.title,mode:draft.mode,questions:draft.questions});
    storeSession({role:'host',pin:info.pin,token:info.hostToken});
    room=null;paint();connect();toast('Room created! Share the game PIN.');
  } catch(err){toast(err.message);}
}
async function joinRoom(pin,name) {
  try {
    const info=await post(`/api/room/${pin}/join`,{name});
    storeSession({role:'student',pin,token:info.playerToken,playerId:info.playerId});
    room=null;paint();connect();
  } catch(err){toast(err.message);}
}
function download(name,content,type='text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF',content],{type});
  const url = URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function exportResults() {
  if (!room || session.role!=='host') return;
  const csv = [['Rank','Name','Correct','Attempted','Accuracy %','Score','Mode'],...room.players.map((p,i)=> [i+1,p.name,p.correct,p.answered,p.answered?Math.round(p.correct/p.answered*100):0,p.score,room.mode])]
    .map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
  download(`quizdock-${room.pin}-results.csv`,csv);
}
async function copyText(text) {
  try {await navigator.clipboard.writeText(text);toast('Copied to clipboard!');}
  catch {prompt('Copy this:',text);}
}
document.addEventListener('change', e => {
  if (e.target.id==='csv-file') loadFile(e.target.files?.[0]);
  if (e.target.id==='next-mode') nextMode=e.target.value;
  if (e.target.id==='duration') draft.minutes=Number(e.target.value);
  if (e.target.id==='game-title') draft.title=e.target.value.trim().slice(0,70) || 'Classroom challenge';
});
document.addEventListener('input',e => {
  if (e.target.id==='next-mode') nextMode=e.target.value;
  if (e.target.id==='duration') draft.minutes=Number(e.target.value);
  if (e.target.id==='game-title') draft.title=e.target.value.slice(0,70);
});
document.addEventListener('submit',e => {
  if (e.target.id==='join-form') {
    e.preventDefault(); const pin=$('#join-pin').value.trim(),name=$('#join-name').value.trim();
    if (!/^\d{6}$/.test(pin)) {toast('Enter a six-digit game PIN.');return;}
    joinRoom(pin,name);
  }
});
document.addEventListener('click',e => {
  const button=e.target.closest('[data-action]');if(!button || button.disabled)return;
  const action=button.dataset.action;
  if(action==='focus-join'||action==='focus-create') {$('#'+(action==='focus-join'?'join-section':'create-section'))?.scrollIntoView({behavior:'smooth'}); if(action==='focus-join')setTimeout(()=>$('#join-pin')?.focus({preventScroll:true}),300);}
  else if(action==='mode') {draft.mode=button.dataset.mode;paint();}
  else if(action==='template') download('QuizDock_CSV_Template.csv',TEMPLATE);
  else if(action==='demo') {draft.questions=importCsv(DEMO);draft.source='Demo Spanish vocabulary · 12 questions';paint();toast('Demo questions loaded.');}
  else if(action==='create') createRoom();
  else if(action==='leave') {if(confirm('Leave this room? The active game will continue for other players.'))leaveRoom();}
  else if(action==='copy-pin')copyText(room.pin);
  else if(action==='copy-link')copyText(`${location.origin}/?join=${room.pin}`);
  else if(action==='export')exportResults();
  else if(action==='round-csv'&&session?.role==='host'&&room?.cardReport)download(`QuizDock-round-${room.cardReport.id}.csv`,reportCSV(room.cardReport));
  else if(action==='start') {
    // Read the visible controls at click time, including native mobile selects.
    const selectedMode = $('#next-mode')?.value || nextMode || room.mode;
    const selectedMinutes = Number($('#duration')?.value || draft.minutes);
    nextMode = selectedMode; draft.minutes = selectedMinutes;
    send({type:'start',minutes:selectedMinutes,mode:selectedMode});
  }
  else if(action==='pause'||action==='resume')send({type:action});
  else if(action==='end') {if(confirm('End the game for all players?'))send({type:'end'});}
  else if(action==='answer') {awaitingResponse=true;send({type:'answer',key:button.dataset.key,choice:Number(button.dataset.choice)});paint();}
  else if(action==='chest')send({type:'chest',index:Number(button.dataset.index)});
  else if(action==='next')send({type:'next'});
  else if(action==='upgrade')send({type:'upgrade'});
});
document.addEventListener('dragover',e=>{if(e.target.closest('#dropzone')){e.preventDefault();e.target.closest('#dropzone').classList.add('drag');}});
document.addEventListener('dragleave',e=>{e.target.closest('#dropzone')?.classList.remove('drag');});
document.addEventListener('drop',e=>{const zone=e.target.closest('#dropzone');if(zone){e.preventDefault();zone.classList.remove('drag');loadFile(e.dataTransfer?.files?.[0]);}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.id==='dropzone'){e.preventDefault();$('#csv-file').click();}});
try {
  const stored=sessionStorage.getItem('quizdock-session');
  if(stored){const parsed=JSON.parse(stored);if(parsed?.token && /^\d{6}$/.test(parsed.pin) && ['host','student'].includes(parsed.role))session=parsed;}
} catch {sessionStorage.removeItem('quizdock-session');}
paint();
if(session)connect();
setInterval(()=>{refreshClock();if(socket?.readyState===WebSocket.OPEN)send({type:'ping'});},5000);
setInterval(refreshClock,500);