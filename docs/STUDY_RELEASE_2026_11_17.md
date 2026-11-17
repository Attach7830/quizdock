# Student screens and independent study

The existing application, Cloudflare Worker, Durable Object bindings and migration names are retained. Existing accounts, card IDs, grading records, character purchases and class membership are not migrated or replaced.

## Student game screens

All eight live modes use a viewport-sized student shell. Questions, strategic decisions and Next stay on screen in portrait and landscape. Results give the remaining space to the animated scene. Extra controls are in Menu; Keys stays available. Long questions and answers have explicit, keyboard-accessible reading pages instead of shrinking all text. Full strategy descriptions and collections are available in Field guide. Software-keyboard layouts keep typed submission available.

## Hotkeys

Open Keys on any main page, including Assignments and flashcards. Edit a key, combination (`Ctrl+Enter`) or two-key sequence (`G A`), then Save hotkeys. Empty entries disable an action. Duplicates and common browser-reserved combinations are rejected. Restore defaults clears saved overrides. Preferences save in this browser. Single-letter shortcuts never intercept text entry. Native Enter still submits a typed answer, and shortcuts never submit an entire assignment or buy anything.

## Categories and solo play

An optional `Category` column works in CSV, TSV and semicolon-delimited imports; JSON uses `category`. Values are Grammar, Vocabulary or Culture (case insensitive). For example:

```csv
Prompt,Answer,Category
hablar,to speak,Vocabulary
él habló,he spoke,Grammar
capital de España,Madrid,Culture
```

Uncategorized legacy cards remain valid. Independent study and solo-game pickers offer All categories plus categories present in the shared list. Assignment snapshots are always unfiltered.

Solo games use the existing seven compatible engines in private account-bound rooms, with student start/pause/resume/end/replay controls. Sketch Relay requires classmates. Solo games do not publish a class live room, issue raffle tickets, or award character currency.

In Assignments, choose Solo Word Forge as an alternative to ordinary typed practice. It uses the same shuffled assignment, server grading, accents policy, active-time requirements and explicit final Submit. Letter clues do not count as attempts. Neither assignment presentation earns candy.

The assignment timer display updates once per second between server heartbeats. Only focused, connected activity is eligible; the server bounds all saved time. Closing a focused interval sends a final bounded heartbeat, and the Submit button still uses saved requirements.

## Jolly Ranchers

Only completed independent typed answers count, including private solo Word Forge. Both correct and incorrect final typed attempts count as completed practice. Blank input, letter clues, flips, confidence marks, multiple-choice games and assigned homework do not count.

Each class starts at 100 completed typed questions per Jolly Rancher. Teachers edit the threshold and semester end under Jolly Ranchers. The requested initial semester ends December 18, 2026, in the class timezone; remaining points stop carrying after that date. A newly earned award expires exactly 30 days after earning, including across the semester boundary. Existing earned awards keep their expiry when settings change. A changed semester date starts a new points period; a threshold change uses remaining points on the next typed answer.

Only the class owner can mark a reward claimed. A claim request is idempotent; expired or already claimed awards cannot be redeemed again. Balances, claims and completed-answer receipts save server-side. Backups and erasure include the added records; old signed backups cannot overwrite a newer claim or revive erased student rewards.

## Validation and release status

`npm run verify`, the existing browser suites, `single-screen-browser-checks.py`, `study-features-browser-checks.py`, teacher Google browser checks, and a nonpublishing Wrangler bundle cover the release. All test accounts are fake. Production account sign-in, physical devices and inbox delivery are separate from these checks. The pull request records the actual commit, merge, deployment and live verification results.
