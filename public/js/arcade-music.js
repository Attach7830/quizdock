import {CHIP_TUNES} from './chip-score.js';
import {createChipSynth} from './chip-synth.js';
export {CHIP_TUNES} from './chip-score.js';

export function createArcadeMusic({view = window, doc = document} = {}) {
 let enabled = true, volume = .3, active = false, status = 'lobby', mode = 'treasure';
 let audio = null, master = null, synth = null, timer = null, step = 0, nextAt = 0, disposed = false;
 let layers;const cues = new Set();
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
  synth?.stop();nextAt = 0;
 }

 function schedule() {
  if (!playing()) return;
  const score = tune(), tick = 15 / score.bpm;
  // A suspended/background tab never queues missed bars on its return.
  if (nextAt < audio.currentTime) nextAt = audio.currentTime + .025;
  while (nextAt < audio.currentTime + .18) {
   synth.play(score,step,nextAt,layers);
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
    audio = new Audio(); master = audio.createGain(); master.gain.value = volume * .4; master.connect(audio.destination); synth = createChipSynth(audio,master);
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
  if (master) master.gain.setTargetAtTime(volume * .4, audio.currentTime, .02);
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
  controls: () => `<div class="music-controls" role="group" aria-label="Original 8-bit RPG music"><button type="button" class="btn ghost small" data-music="toggle" aria-pressed="${enabled}" aria-label="${!enabled?'Turn on 8-bit music':playing()?'Mute 8-bit music':'Play 8-bit music'}">${label()}</button><label>Volume<input data-music="volume" aria-label="Music volume" type="range" min="0" max="100" value="${Math.round(volume * 100)}"></label></div>`,
  enter(next = {}) {
   const adventure=next.expedition,state=adventure?.state,boss=state?.boss||state?.ship||state?.obstacle||state?.guardian;layers=adventure?(boss?.phase===3||adventure.cinema&&adventure.tick-(adventure.cinema.tick??-100)<4?3:boss?.phase===2||adventure.tick>=10?2:1):undefined;
   const nextMode = next.mode || mode, nextStatus = next.status || 'lobby';
   const nextTune=CHIP_TUNES[nextStatus==='lobby'?'lobby':nextMode]||CHIP_TUNES.lobby;
   if (tune() !== nextTune) { stopVoices(); step = 0; }
   mode = nextMode; status = nextStatus; active = true; reconcile();
  },
  cue(correct,key) { if(cues.has(key))return;cues.add(key);if(cues.size>100)cues.delete(cues.values().next().value);if(playing())synth.cue(correct,tune(),audio.currentTime+.015); },
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
