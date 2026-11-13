# Player fullscreen and next-game room reuse

## Teacher workflow

End the current game or let its timer expire. The teacher controls then show **Next game · same room**. Choose any of the four existing game types, choose a duration, and click **Start next game**. Keeping the current type simply replays that mode.

The PIN, connected sockets, player IDs/names and authentication tokens stay the same. Each round resets game scores and upgrades, has a fresh round ID, and keeps its original card report. The previous report must successfully archive before a new round can discard its in-room state. Changing mode while a round is playing or paused is rejected; end it first. Old answer keys cannot score in a later round.

This update reuses the **same question set**. It does not add changing question lists between rounds, student accounts, rewards currency, or the other pending feature batch. Rooms still have their existing 12-hour lifetime.

## Player layout

The active player screen fills the current viewport in normal browser mode and supports an explicit **Fullscreen** button. It requests fullscreen on the stable document element, so ordinary score updates and round switches do not remove the fullscreen target. Exit fullscreen or Esc returns to the fitted window layout; leaving the room exits fullscreen opened by this feature.

Fullscreen requires a user click and browser support. When unavailable, the button explains the fitted-window fallback. There is no forced orientation, keyboard lock, or disabled browser zoom. The layout accounts for safe-area insets and changing browser chrome. On small or short screens, **Stats** opens a focus-managed panel with scores, upgrades and the leaderboard. Teacher pages retain their normal layout.

Normal short prompts and all four answer buttons fit in the tested layouts. Long questions, large content, or accessibility zoom may need scrolling **inside the question panel** rather than cutting content off or shrinking text. Each question change resets that panel's scroll; score-update repaints preserve it.

## Validation performed locally

- 73 Node tests passed: the 65 prepared teacher-tools tests plus 8 new room-reuse tests. The new tests cover all 16 game-type pairings, teacher-only control, stale answer rejection, reconnecting with the existing player identity and failed-archive protection.
- 497 offline Chromium assertions passed, using real browser modules/styles and mocked WebSocket state. Nine viewport sizes from 320x568 to 1920x1080, all four modes, lobby/playing/paused/finished, native Chromium fullscreen, denied/unsupported fallback, statistics focus handling, long text, outcome buttons and next-game selector retention.
- Syntax checks passed for the changed JavaScript.
- Browser test: `python test/player-layout.browser.py` with Python Playwright and Chromium installed. It loads local source into an offline document and writes screenshots/results to a sibling `checks` folder. It does not connect to the production site.
- Existing animation assets and login-recovery code are unchanged. The separate animation unit tests and latest login-recovery unit tests were not rerun in this local checkout. The 73 count is not the entire combined repository suite.
- Not verified: deployed Cloudflare runtime, real mobile Safari/Firefox, full-class load, or production end-to-end multiplayer. No new secrets, migrations or build settings are needed.
