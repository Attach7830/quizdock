// Decorative, client-only effects. Server snapshots remain the source of truth.
const SCORE = { treasure: 'coins', fishing: 'score', battle: 'score', factory: 'cash' };
const LABELS = {
  treasure: ['Treasure cove', 'Answer correctly, then choose a chest.'],
  fishing: ['At the fishing hole', 'A correct answer reels in a fish.'],
  battle: ['Battle arena', 'Answer correctly to launch an attack.'],
  factory: ['On the factory floor', 'Answer questions to fund your machines.']
};

// Pure transition detection: heartbeats and other players' answers do not replay rewards.
export function animationEvents(previous, next) {
  if (!previous || !next || previous.pin !== next.pin || previous.mode !== next.mode) return [];
  const events = [];
  if (next.status === 'finished' && previous.status !== 'finished') return [{ type: 'finish' }];
  if (next.status !== 'playing') return events;
  if (previous.startedAt !== next.startedAt || previous.status === 'lobby' || previous.status === 'finished') {
    return [{ type: 'start' }];
  }
  const a = previous.me, b = next.me;
  if (!a || !b || a.id !== b.id) return events;
  if (b.answered > a.answered && b.feedback) {
    events.push({ type: b.feedback.correct ? 'correct' : 'incorrect' });
  }
  if (a.pendingChests && !b.pendingChests && b.feedback?.correct) events.push({ type: 'chest' });
  if (b.rodLevel > a.rodLevel || b.machineLevel > a.machineLevel) events.push({ type: 'upgrade' });
  if (next.mode === 'battle' && b.hp !== a.hp && b.answered === a.answered) events.push({ type: 'hit' });
  const key = SCORE[next.mode];
  const delta = Number(b[key] ?? 0) - Number(a[key] ?? 0);
  if (delta) events.push({ type: 'score', delta });
  if (a.question && b.question && a.question.key !== b.question.key) events.push({ type: 'question' });
  return events;
}

const ART = {
  treasure: `<div class="scene-halo"></div><div class="scene-island"></div><div class="scene-chest"><div class="scene-lid"><i></i></div><div class="scene-box"><i></i></div></div><span class="scene-star star-a">✦</span><span class="scene-star star-b">✧</span>`,
  fishing: `<div class="scene-sun"></div><div class="scene-water"></div><div class="scene-water water-back"></div><div class="scene-line"><i></i></div><div class="scene-ripple"></div><div class="scene-fish"><i></i></div><span class="scene-reeds">╱╱</span>`,
  battle: `<div class="arena-floor"></div><div class="arena-fighter fighter-you"><i></i><b>YOU</b></div><div class="arena-fighter fighter-rival"><i></i><b>RIVAL</b></div><div class="arena-orb"></div><div class="arena-impact"></div>`,
  factory: `<div class="factory-smoke"></div><div class="factory-machine"><div class="factory-chimney"></div><div class="factory-light"></div><div class="factory-gear gear-a">⚙</div><div class="factory-gear gear-b">⚙</div></div><div class="factory-belt"></div><div class="factory-crate crate-a"></div><div class="factory-crate crate-b"></div>`
};
const fmt = n => Math.abs(n).toLocaleString('en-US');

export function createGameAnimations() {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true;
  try { enabled = localStorage.getItem('quizdock-motion') !== 'off'; } catch { /* optional preference */ }
  let stage = null, mode = null, previous = null, current = null, role = null;
  let idle = [], focus = null, ranks = new Map();
  const active = new Set();
  const moving = () => enabled && !media.matches && !document.hidden;
  const running = () => moving() && current?.status === 'playing';
  const find = selector => stage?.querySelector(selector);

  function animate(el, frames, options = {}) {
    if (!el?.animate || !moving()) return null;
    const animation = el.animate(frames, { duration: 650, easing: 'cubic-bezier(.2,.8,.25,1)', ...options });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }
  function clearMotion() {
    for (const a of active) a.cancel();
    active.clear(); idle = [];
    stage?.querySelectorAll('.scene-particle, .scene-score').forEach(el => el.remove());
  }
  function updatePreference() {
    const button = find('.motion-toggle');
    if (button) {
      button.textContent = media.matches ? 'Reduced motion' : `Motion: ${enabled ? 'on' : 'off'}`;
      button.setAttribute('aria-pressed', String(enabled && !media.matches));
      button.disabled = media.matches;
      button.title = media.matches ? 'Following your device’s reduced-motion setting.' : 'Turn decorative game animations on or off.';
    }
    if (!moving()) clearMotion();
    syncIdle();
  }
  function syncIdle() {
    if (!stage) return;
    // Factory motion represents machines the player has actually purchased.
    if (mode === 'factory' && current?.me?.machineLevel > 0 && running() && !idle.length) {
      idle = ['.gear-a', '.gear-b'].map((selector, i) => animate(find(selector), [
        { transform: 'rotate(0deg)' }, { transform: `rotate(${i ? -360 : 360}deg)` }
      ], { duration: i ? 4800 : 6400, iterations: Infinity, easing: 'linear' })).filter(Boolean);
    }
    for (const a of active) {
      if (!running()) a.pause();
      else if (a.playState === 'paused') a.play();
    }
  }
  function mount(state) {
    const target = document.querySelector('.student-layout > section.card');
    if (!target || !state?.me) return;
    if (!stage || mode !== state.mode) {
      clearMotion();
      mode = state.mode;
      stage = document.createElement('section');
      stage.className = 'game-scene';
      stage.dataset.mode = mode;
      stage.setAttribute('aria-label', 'Game animation');
      stage.innerHTML = `<div class="scene-toolbar"><span class="scene-kicker"></span><button type="button" class="motion-toggle" aria-label="Decorative game animations"></button></div><div class="scene-world" aria-hidden="true">${ART[mode] || ''}</div><p class="scene-caption" role="status" aria-live="polite" aria-atomic="true"></p>`;
      find('.scene-kicker').textContent = (LABELS[mode] || LABELS.treasure)[0];
      find('.scene-caption').textContent = (LABELS[mode] || LABELS.treasure)[1];
      find('.motion-toggle').addEventListener('click', () => {
        enabled = !enabled;
        try { localStorage.setItem('quizdock-motion', enabled ? 'on' : 'off'); } catch { /* optional */ }
        updatePreference();
      });
    }
    target.prepend(stage);
    stage.dataset.status = state.status;
    updatePreference();
  }
  function caption(text) {
    const el = find('.scene-caption');
    if (el && el.textContent !== text) el.textContent = text;
  }
  function burst(symbol = '●', count = 10, origin = 50) {
    if (!running()) return;
    const world = find('.scene-world');
    // Keep each effect bounded, even during rapid snapshots or leaderboard updates.
    world.querySelectorAll('.scene-particle').forEach(el => el.remove());
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'scene-particle'; el.textContent = symbol;
      el.style.left = `${origin}%`; el.style.setProperty('--particle-hue', String(i % 4));
      world.append(el);
      const x = (i - (count - 1) / 2) * 18;
      const a = animate(el, [
        { transform: 'translate(-50%, 0) scale(.4)', opacity: 0 },
        { transform: `translate(calc(-50% + ${x * .5}px), -50px) scale(1)`, opacity: 1, offset: .35 },
        { transform: `translate(calc(-50% + ${x}px), 30px) scale(.6) rotate(${i * 45}deg)`, opacity: 0 }
      ], { duration: 850 + (i % 3) * 70 });
      if (a) a.finished.then(() => el.remove(), () => el.remove()); else el.remove();
    }
  }
  function score(delta) {
    if (!running()) return;
    find('.scene-score')?.remove();
    const el = document.createElement('span');
    el.className = `scene-score ${delta < 0 ? 'score-spent' : ''}`;
    el.textContent = `${delta > 0 ? '+' : '−'}${mode === 'factory' ? '$' : ''}${fmt(delta)}${mode === 'treasure' ? ' coins' : ''}`;
    find('.scene-world').append(el);
    const a = animate(el, [
      { transform: 'translate(-50%, 8px) scale(.8)', opacity: 0 },
      { transform: 'translate(-50%, -7px) scale(1.06)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%, -25px) scale(1)', opacity: 0 }
    ], { duration: 1300 });
    if (a) a.finished.then(() => el.remove(), () => el.remove()); else el.remove();
  }
  function reward(type) {
    if (type === 'chest') {
      animate(find('.scene-lid'), [
        { transform: 'translateY(0) rotate(0)' },
        { transform: 'translateY(-28px) rotate(-16deg)', offset: .4 },
        { transform: 'translateY(-24px) rotate(-12deg)', offset: .8 },
        { transform: 'translateY(0) rotate(0)' }
      ], { duration: 1100 });
      burst('●');
    } else if (mode === 'treasure') {
      animate(find('.scene-chest'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-5deg)', offset: .25 }, { transform: 'rotate(5deg)', offset: .5 }, { transform: 'rotate(0)' }]);
    } else if (mode === 'fishing') {
      animate(find('.scene-fish'), [
        { transform: 'translate(-50%, 55px) rotate(-25deg)', opacity: 0 },
        { transform: 'translate(-50%, -48px) rotate(12deg)', opacity: 1, offset: .4 },
        { transform: 'translate(-50%, -32px) rotate(20deg)', opacity: 1, offset: .65 },
        { transform: 'translate(-50%, 55px) rotate(40deg)', opacity: 0 }
      ], { duration: 1200 });
      animate(find('.scene-ripple'), [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(.8)', opacity: .8, offset: .25 }, { transform: 'scale(2)', opacity: 0 }], { duration: 1000 });
      animate(find('.scene-line'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-30px)', offset: .4 }, { transform: 'translateY(0)' }], { duration: 1200 });
    } else if (mode === 'battle') {
      const distance = find('.scene-world').clientWidth * .48;
      animate(find('.arena-orb'), [{ transform: 'translateX(0) scale(.5)', opacity: 0 }, { transform: 'translateX(0) scale(1)', opacity: 1, offset: .1 }, { transform: `translateX(${distance}px) scale(.7)`, opacity: 1, offset: .8 }, { transform: `translateX(${distance}px) scale(2)`, opacity: 0 }], { duration: 550 });
      animate(find('.fighter-rival'), [{ transform: 'translateX(0)' }, { transform: 'translateX(9px) rotate(5deg)', offset: .5 }, { transform: 'translateX(0)' }], { delay: 350, duration: 320 });
      animate(find('.arena-impact'), [{ transform: 'scale(.1)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 0 }], { delay: 350, duration: 450 });
    } else if (mode === 'factory') {
      for (const selector of ['.crate-a', '.crate-b']) animate(find(selector), [
        { transform: 'translateX(-16px)', opacity: 0 }, { transform: 'translateX(10px)', opacity: 1, offset: .25 }, { transform: 'translateX(85px)', opacity: 0 }
      ], { duration: 1150, delay: selector === '.crate-b' ? 200 : 0 });
      animate(find('.factory-smoke'), [{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: 'translateY(-15px) scale(1)', opacity: .6, offset: .4 }, { transform: 'translateY(-32px) scale(1.4)', opacity: 0 }]);
    }
  }
  function effect(event, state) {
    if (event.type === 'score') { score(event.delta); return; }
    if (event.type === 'question') {
      caption(LABELS[mode][1]);
      animate(document.querySelector('.quiz-title'), [{ opacity: .4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 });
    } else if (event.type === 'correct' || event.type === 'chest') {
      caption(state.me.feedback.reward);
      reward(event.type);
      animate(document.querySelector('.feedback.good'), [{ opacity: .6 }, { opacity: 1 }], { duration: 200 });
    } else if (event.type === 'incorrect') {
      caption('Keep going — the correct answer is shown below.');
      animate(document.querySelector('.feedback.bad'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)', offset: .3 }, { transform: 'translateX(3px)', offset: .6 }, { transform: 'translateX(0)' }], { duration: 220 });
    } else if (event.type === 'upgrade') {
      caption(mode === 'factory' ? `Machine level ${state.me.machineLevel} is now working!` : `Rod upgraded to level ${state.me.rodLevel}!`);
      burst('✦', 8);
      animate(find(mode === 'factory' ? '.factory-machine' : '.scene-line'), [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: .5 }, { transform: 'scale(1)' }]);
    } else if (event.type === 'hit') {
      caption('You were hit! Keep answering to fight back.');
      animate(find('.fighter-you'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)', offset: .4 }, { transform: 'translateX(0)' }], { duration: 300 });
    } else if (event.type === 'start') caption('Game on! Your first question is ready.');
  }
  media.addEventListener('change', updatePreference);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearMotion(); else syncIdle(); });
  return {
    beforePaint() {
      ranks = new Map([...document.querySelectorAll('[data-player-id]')].map(el => [el.dataset.playerId, el.getBoundingClientRect().top]));
      const el = document.activeElement;
      focus = el?.matches('[data-action], .motion-toggle') ? { action: el.dataset.action, choice: el.dataset.choice, index: el.dataset.index, motion: el.classList.contains('motion-toggle') } : null;
      // Retain the same DOM and Animation objects across the app's snapshot repaint.
      stage?.remove();
    },
    afterPaint(state, sessionRole) {
      current = state; role = sessionRole;
      const events = animationEvents(previous, state);
      const sameRound = previous && state && previous.pin === state.pin && previous.mode === state.mode && previous.startedAt === state.startedAt;
      if (!sameRound || state?.status !== 'playing') clearMotion();
      if (role === 'student' && state?.me) {
        mount(state);
        if (!sameRound) caption(LABELS[mode][1]);
        if (state.status === 'paused') caption('Paused by your teacher.');
        else if (state.status === 'finished') caption('Round complete! Check your final score below.');
        else if (state.status === 'lobby') caption('Ready when your teacher is.');
        else {
          if (previous?.status === 'paused') caption(state.me.feedback?.reward || LABELS[mode][1]);
          for (const event of events) effect(event, state);
        }
        syncIdle();
      } else { clearMotion(); stage?.remove(); stage = null; mode = null; }
      // Subtle leaderboard movement, never a speculative score change.
      if (moving() && sameRound && state?.status === 'playing') {
        for (const row of document.querySelectorAll('[data-player-id]')) {
          const old = ranks.get(row.dataset.playerId), distance = old - row.getBoundingClientRect().top;
          if (Number.isFinite(distance) && Math.abs(distance) > 1 && Math.abs(distance) < 600) animate(row, [{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], { duration: 280 });
        }
      }
      if (focus && !events.some(e => ['question', 'start', 'finish'].includes(e.type))) {
        const target = focus.motion ? find('.motion-toggle') : [...document.querySelectorAll('[data-action]')].find(el => el.dataset.action === focus.action && el.dataset.choice === focus.choice && el.dataset.index === focus.index);
        if (target && !target.disabled) target.focus({ preventScroll: true });
      }
      previous = state;
    }
  };
}
