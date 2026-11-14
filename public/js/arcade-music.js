// Original QuizDock compositions: square-wave lead, triangle bass and chip pulses.
// Notes are MIDI pitches; 0 is a rest. No recordings, libraries or network requests.
export const CHIP_TUNES = {
 lobby:{bpm:108,lead:[72,0,76,79,74,0,71,67,72,76,79,83,81,0,79,76,74,77,81,84,83,79,76,0,74,71,67,71,72,0,0,0],bass:[48,48,43,43,45,45,47,43]},
 treasure:{bpm:116,lead:[76,79,83,0,81,79,74,0,76,0,72,76,79,83,86,0,84,81,77,0,79,76,72,0,74,77,81,79,76,72,0,0],bass:[48,48,45,45,41,41,43,43]},
 fishing:{bpm:96,lead:[74,0,78,81,83,0,81,78,76,0,73,69,71,73,76,0,74,78,81,85,83,81,78,0,76,73,69,73,74,0,0,0],bass:[50,50,47,47,43,43,45,45]},
 battle:{bpm:132,lead:[64,67,71,76,0,74,71,67,66,69,72,78,0,76,72,69,67,71,74,79,78,74,71,0,66,69,71,66,64,0,64,0],bass:[40,40,42,42,43,43,47,47]},
 factory:{bpm:120,lead:[67,0,72,0,74,76,79,76,67,0,71,0,74,77,79,77,69,0,72,76,81,79,76,72,67,71,74,77,76,72,0,0],bass:[36,43,40,43,41,48,43,43]},
 rally:{bpm:128,lead:[79,83,86,0,88,86,83,79,81,84,88,0,86,84,81,76,79,83,86,91,90,86,83,79,78,81,84,86,83,79,0,0],bass:[43,43,45,45,40,40,42,42]},
 keep:{bpm:102,lead:[69,76,81,0,79,76,72,0,71,78,83,0,81,78,74,0,72,79,84,83,81,79,76,0,71,74,78,76,69,0,0,0],bass:[45,45,47,47,48,48,40,40]}
};
const pitch = note => 440 * 2 ** ((note - 69) / 12);

export function createArcadeMusic({view = window, doc = document} = {}) {
 let enabled = true, volume = .3, active = false, status = 'lobby', mode = 'treasure';
 let audio = null, master = null, timer = null, step = 0, nextAt = 0, disposed = false;
 const voices = new Set();
 try { enabled = view.localStorage.getItem('qd-music') !== 'off';
  const saved = view.localStorage.getItem('qd-music-volume');
  if (saved !== null && Number.isFinite(+saved)) volume = Math.max(0, Math.min(1, +saved));
 } catch { /* Browser storage is optional. */ }
 const allowed = () => !disposed && active && enabled && volume > 0 && !doc.hidden && status !== 'paused';
 const playing = () => allowed() && audio?.state === 'running';
 const tune = () => CHIP_TUNES[status === 'lobby' ? 'lobby' : mode] || CHIP_TUNES.lobby;
 function label() { return !enabled ? 'Music off' : status === 'paused' ? 'Music paused' : !active || playing() ? 'Music on' : 'Play music'; }
 function refresh() {
  for (const button of doc.querySelectorAll('[data-music="toggle"]')) {
   button.textContent = label(); button.setAttribute('aria-pressed', String(enabled));
   button.setAttribute('aria-label', !enabled ? 'Turn on 8-bit music' : playing() ? 'Mute 8-bit music' : 'Play 8-bit music');
  }
 }
 function stopVoices() {
  if (timer !== null) { view.clearInterval(timer); timer = null; }
  for (const voice of voices) { try { voice.stop(); voice.disconnect(); } catch {} }
  voices.clear(); nextAt = 0;
 }
 function tone(note, at, duration, type, level) {
  if (!note) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(pitch(note), at);
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .008);
  gain.gain.setValueAtTime(level, at + duration * .65);
  gain.gain.linearRampToValueAtTime(0, at + duration);
  oscillator.connect(gain); gain.connect(master); voices.add(oscillator);
  oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(at); oscillator.stop(at + duration + .01);
 }
 function schedule() {
  if (!playing()) return;
  const score = tune(), tick = 30 / score.bpm;
  // A suspended/background tab never queues missed bars on its return.
  if (nextAt < audio.currentTime) nextAt = audio.currentTime + .025;
  while (nextAt < audio.currentTime + .18) {
   const i = step % score.lead.length, bass = score.bass[Math.floor(i / 4)];
   tone(score.lead[i], nextAt, tick * .78, 'square', .16);
   if (i % 2 === 0) tone(bass, nextAt, tick * 1.45, 'triangle', .25);
   if (i % 4 === 3) tone(bass + 19, nextAt, tick * .4, 'square', .06);
   tone(i % 4 === 0 ? 31 : i % 2 ? 78 : 0, nextAt, .025, 'triangle', .065);
   nextAt += tick; step++;
  }
 }
 function run() {
  if (!playing()) { refresh(); return; }
  if (timer === null) { nextAt = audio.currentTime + .025; schedule(); timer = view.setInterval(schedule, 60); }
  refresh();
 }
 function start() {
  if (!allowed()) { refresh(); return; }
  try {
   if (!audio) {
    const Audio = view.AudioContext || view.webkitAudioContext;
    if (!Audio) { refresh(); return; }
    audio = new Audio(); master = audio.createGain(); master.gain.value = volume * .2; master.connect(audio.destination);
    audio.onstatechange = () => { if (audio.state !== 'running') stopVoices(); run(); };
   }
   if (audio.state === 'running') run();
   else Promise.resolve(audio.resume()).then(() => { if (allowed()) run(); else stopVoices(); }).catch(refresh);
  } catch { refresh(); }
 }
 function reconcile() {
  if (!allowed()) { stopVoices(); if (audio?.state === 'running') Promise.resolve(audio.suspend()).catch(() => {}); refresh(); }
  else start();
 }
 function toggle() {
  // An autoplay-blocked context needs a Play action, not a mute action.
  if (enabled && allowed() && audio?.state !== 'running') { start(); return; }
  enabled = !enabled;
  try { view.localStorage.setItem('qd-music', enabled ? 'on' : 'off'); } catch {}
  reconcile();
 }
 function gesture(event) {
  if (event.target.closest?.('[data-music]')) return;
  if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
  if (allowed()) start();
 }
 function click(event) { if (event.target.closest?.('[data-music="toggle"]')) toggle(); }
 function input(event) {
  if (event.target.dataset.music !== 'volume') return;
  volume = Math.max(0, Math.min(1, Number(event.target.value) / 100));
  if (master) master.gain.setTargetAtTime(volume * .2, audio.currentTime, .02);
  try { view.localStorage.setItem('qd-music-volume', String(volume)); } catch {}
  for (const slider of doc.querySelectorAll('[data-music="volume"]')) slider.value = Math.round(volume * 100);
  reconcile();
 }
 const visibility = () => reconcile();
 const pagehide = () => { stopVoices(); if (audio?.state === 'running') Promise.resolve(audio.suspend()).catch(() => {}); };
 doc.addEventListener('pointerdown', gesture); doc.addEventListener('keydown', gesture);
 doc.addEventListener('click', click); doc.addEventListener('input', input);
 doc.addEventListener('visibilitychange', visibility); view.addEventListener('pagehide', pagehide); view.addEventListener('pageshow', visibility);
 return {
  controls: () => `<div class="music-controls" role="group" aria-label="Original 8-bit music"><button type="button" class="btn ghost small" data-music="toggle" aria-pressed="${enabled}" aria-label="${!enabled?'Turn on 8-bit music':playing()?'Mute 8-bit music':'Play 8-bit music'}">${label()}</button><label>Volume<input data-music="volume" aria-label="Music volume" type="range" min="0" max="100" value="${Math.round(volume * 100)}"></label></div>`,
  enter(next = {}) {
   const nextMode = next.mode || mode, nextStatus = next.status || 'lobby';
   if (mode !== nextMode || status !== nextStatus) { stopVoices(); step = 0; }
   mode = nextMode; status = nextStatus; active = true; reconcile();
  },
  stop() { active = false; reconcile(); },
  dispose() {
   disposed = true; stopVoices();
   doc.removeEventListener('pointerdown', gesture); doc.removeEventListener('keydown', gesture);
   doc.removeEventListener('click', click); doc.removeEventListener('input', input);
   doc.removeEventListener('visibilitychange', visibility); view.removeEventListener('pagehide', pagehide); view.removeEventListener('pageshow', visibility);
   if (audio) { audio.onstatechange = null; Promise.resolve(audio.close()).catch(() => {}); }
  }
 };
}
