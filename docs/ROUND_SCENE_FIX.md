# Student round transitions and mobile scene clipping

## Findings
The prior mobile viewport CSS reduced the scene window to 90px while leaving the chest at its original size. The chest lid was already above the clipping window at rest, and opening it made this worse. This was reproduced with the production source in an offline Chromium document.

The prior source switched the scene correctly when given an updated mode snapshot locally, so the exact cause of the reported production mode-switch failure was not independently reproduced. The main player heading displayed only the unchanged question-set title, and small-screen users could not see the mode name in the hidden sidebar. This patch makes round identity explicit and strengthens reconnection/selection handling rather than claiming a proven server defect.

## Changes
- Rebuild the animation scene whenever PIN, round number, start time or mode changes. Keep it during ordinary score and question repaints.
- Display the current game name prominently, retain the question-set title below it, and show a brief new-round notification. Close the statistics drawer on a new round.
- Read the teacher's visible mode and duration controls at Start click time; also track input events from native controls.
- Ignore messages from replaced WebSockets. Resynchronize on online/pageshow/visibility events.
- Fit an entire 160px design canvas into the measured animation window, preserving space for the opening lid. The mobile window is 118px instead of 90px. ResizeObserver keeps scaling correct through orientation/viewport changes.
- Version the modified player imports and stylesheet. Refresh teacher and student pages once after deploying to load this release. Subsequent round switches do not require a refresh or new PIN.

No backend rules, authentication, room IDs, data storage, questions or scoring were changed. Existing room/report behavior remains in place.

## Validation
- 30 animation/transition unit tests passed, including all 16 game-mode pairings.
- 345 offline Chromium assertions passed with teacher and student pages driven through the actual QuizRoom implementation using the repository's in-memory Cloudflare adapter. Checks include mode selection, same-mode replay, scene rebuilding, identity/PIN retention, no rejoin, heartbeat stability, drawer reset, motion preference, obsolete-socket rejection and online synchronization.
- Chest bounds were checked at 11 positions through its opening animation on seven viewports from 320x568 to 1366x768, including landscape phones.
- Changed JavaScript syntax checks passed. Tested frontend contents were matched against the uploaded Git blob hashes.
- Not verified: live Cloudflare rollout, production WebSocket behavior, native iOS/Firefox browsers, or full-class load. No real email or student data was used.

Reproduce with `node --test test/animations.test.js` and `python test/round-scene.browser.py`. The browser test requires Python Playwright and Chromium; CHROMIUM_PATH can select an executable. Native fullscreen is not part of these new checks.
