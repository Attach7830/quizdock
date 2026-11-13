// Player-only presentation. Fullscreen never reconnects a player or changes game state.
export function createPlayerViewport(notify = () => {}) {
  const doc = document, html = doc.documentElement;
  const compact = matchMedia('(max-width: 900px), (max-height: 600px)');
  let active = false, statsOpen = false, ownedFullscreen = false, pending = false;
  let previousQuestion = null, previousRound = null, rememberedFocus = null;
  let questionScroll = 0, statsScroll = 0;
  const find = selector => doc.querySelector(selector);
  const fullscreenElement = () => doc.fullscreenElement || doc.webkitFullscreenElement;
  const nativeSupported = () => (html.requestFullscreen && doc.fullscreenEnabled !== false) || (html.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false);
  const visibleControls = panel => [...panel.querySelectorAll('button:not(:disabled), a[href], input, select, [tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[inert]'));

  function resize() {
    // Keep zoom available. Reflow for browser chrome/keyboard only, not pinch zoom.
    if (!window.visualViewport || Math.abs(window.visualViewport.scale - 1) < .01) {
      html.style.setProperty('--player-height', `${window.visualViewport?.height || window.innerHeight}px`);
    }
    if (!compact.matches) statsOpen = false;
    syncPanels();
  }
  function syncFullscreen() {
    if (!fullscreenElement()) ownedFullscreen = false;
    const button = find('[data-player-action="fullscreen"]');
    if (!button) return;
    const full = !!fullscreenElement();
    button.textContent = full ? 'Exit fullscreen' : nativeSupported() ? 'Fullscreen' : 'Screen fit';
    button.setAttribute('aria-pressed', String(full));
    button.title = full ? 'Leave fullscreen (or press Esc)' : nativeSupported() ? 'Fill the screen' : 'This browser uses the fitted window layout';
    button.disabled = pending;
  }
  async function exitFullscreen() {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (fullscreenElement() && exit) await exit.call(doc);
  }
  async function toggleFullscreen() {
    if (!active || pending) return;
    if (!nativeSupported() && !fullscreenElement()) {
      notify('This browser does not support fullscreen here. The game still fits the available window.');
      return;
    }
    pending = true;
    try {
      if (fullscreenElement()) await exitFullscreen();
      else {
        // Request on the stable document element, directly inside the user's click.
        const request = html.requestFullscreen || html.webkitRequestFullscreen;
        await request.call(html);
        ownedFullscreen = true;
        if (!active) await exitFullscreen();
      }
    } catch {
      notify('Fullscreen is unavailable or was blocked. You can continue in the fitted window.');
    } finally { pending = false; syncFullscreen(); resize(); }
  }
  function syncPanels() {
    const panel = find('#player-stats'), modal = active && compact.matches && statsOpen;
    const button = find('[data-player-action="stats"]'), scrim = find('.player-scrim');
    if (button) button.setAttribute('aria-expanded', String(modal));
    if (scrim) scrim.hidden = !modal;
    if (panel) {
      const hidden = active && compact.matches && !modal;
      panel.hidden = hidden; panel.inert = hidden;
      panel.classList.toggle('is-open', modal);
      if (modal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
    }
    for (const el of doc.querySelectorAll('.player-toolbar, .player-heading, .player-question-card')) el.inert = modal;
  }
  function setStats(open) {
    statsOpen = !!open;
    syncPanels();
    const target = statsOpen ? find('#player-stats [data-player-action="close-stats"]') : find('[data-player-action="stats"]');
    target?.focus({preventScroll: true});
  }
  doc.addEventListener('click', event => {
    if (!active) return;
    const button = event.target.closest?.('[data-player-action]');
    if (!button || button.disabled) return;
    if (button.dataset.playerAction === 'fullscreen') void toggleFullscreen();
    else if (button.dataset.playerAction === 'stats') setStats(true);
    else if (button.dataset.playerAction === 'close-stats') setStats(false);
  });
  doc.addEventListener('keydown', event => {
    if (!active || !statsOpen || !compact.matches) return;
    if (event.key === 'Escape') { event.preventDefault(); setStats(false); }
    if (event.key === 'Tab') {
      const panel = find('#player-stats'), controls = panel ? visibleControls(panel) : [];
      if (!controls.length) { event.preventDefault(); panel?.focus(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (doc.activeElement === first || !controls.includes(doc.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (doc.activeElement === last || !controls.includes(doc.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });
  doc.addEventListener('fullscreenchange', () => { syncFullscreen(); resize(); });
  doc.addEventListener('webkitfullscreenchange', () => { syncFullscreen(); resize(); });
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  compact.addEventListener('change', resize);
  resize();
  return {
    beforePaint() {
      questionScroll = find('.question-scroll')?.scrollTop || 0;
      statsScroll = find('#player-stats')?.scrollTop || 0;
      const el = doc.activeElement;
      rememberedFocus = el && el !== doc.body ? {id: el.id, player: el.dataset.playerAction, action: el.dataset.action, choice: el.dataset.choice, index: el.dataset.index} : null;
    },
    afterPaint(state, role) {
      const wasActive = active;
      active = role === 'student';
      html.classList.toggle('player-mode', active);
      doc.body.classList.toggle('player-mode', active);
      const round = active && state ? `${state.pin}:${state.startedAt || 0}:${state.mode}` : null;
      const question = active && state ? `${round}:${state.me?.question?.key || state.status}` : null;
      const sameQuestion = question === previousQuestion;
      if (!active || round !== previousRound) statsOpen = false;
      if (wasActive && !active && ownedFullscreen) void exitFullscreen().catch(() => {});
      syncPanels(); syncFullscreen(); resize();
      const area = find('.question-scroll'), panel = find('#player-stats');
      if (area) area.scrollTop = sameQuestion ? questionScroll : 0;
      if (panel) panel.scrollTop = statsScroll;
      if (rememberedFocus) {
        const f = rememberedFocus;
        const target = f.id ? doc.getElementById(f.id) : [...doc.querySelectorAll('[data-player-action], [data-action]')].find(el => f.player ? el.dataset.playerAction === f.player : f.action && el.dataset.action === f.action && el.dataset.choice === f.choice && el.dataset.index === f.index);
        if (target && !target.disabled && !target.closest('[inert]') && target.getClientRects().length && (sameQuestion || !active || f.player)) target.focus({preventScroll: true});
      }
      if (active && statsOpen && panel && !panel.contains(doc.activeElement)) panel.querySelector('button')?.focus({preventScroll: true});
      previousQuestion = question; previousRound = round;
    }
  };
}
