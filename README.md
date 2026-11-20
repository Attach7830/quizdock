# QuizDock · classroom beta

Release 0.13.1 resets the league filter to the student's own tier when switching classes, including after viewing an empty higher tier.

Release 0.13.0 adds weekly class leagues under **Arcade → Leagues**: eight tiers, server-scored XP, Monday resets in the class timezone, promotions, protected ties and saved weekly results. See [weekly league rules and data behavior](docs/WEEKLY_LEAGUES.md).

Release 0.12.1 adds **Edit assignment** to teacher assignment cards and submission reports. Teachers can revise titles, class-local deadlines, practice requirements and Crossword Mode counts while preserving saved work and recorded grades. See [assignment editing](docs/ASSIGNMENT_EDITING.md).

Release 0.12.0 adds 300 collectible fish with six rarity tiers, clearer game guides and next-move hints, a visible relic-building Word Forge with automatic typing focus, and teacher-enabled graded crossword alternatives. The rarest base characters now cost 50,000–250,000 character points. See [fish, forging and crosswords](docs/FISH_FORGE_AND_CROSSWORDS.md).

Release 0.11.1 lists current-semester upcoming and overdue assignments together on the student homepage. New late submissions earn half credit, with the earned percentage shown in student receipts, teacher reports and grade exports. The initial semester runs August 10–December 18, 2026; teachers can edit dates per class. Existing submissions keep their recorded grades. See [semester assignments](docs/SEMESTER_ASSIGNMENTS.md).

Release 0.11.0 expanded the avatar wardrobe to 100 original accessories and introduced 48 adventure milestones with 16 exclusive rewards. See [accessories and horizons](docs/ACCESSORIES_AND_HORIZONS.md). The public [About page](https://srtw.win/about) introduces the existing eight game worlds; [the expedition guide](docs/EXPEDITIONS.md) covers their mechanics.

An independently written classroom quiz arcade. Teacher-owned question lists, eight live game modes, seven private solo games, typed assignments, independent practice, and class-linked student accounts.

## Current release

The actual source files are in this repository. **No build-time installer is required.** Keep Cloudflare’s deploy command as `npx wrangler deploy` and the production branch as `main`. Worker name: `quizdock`. Existing SQLite Durable Object bindings and migration names are preserved.

This release fits student live games and graded practice into the available viewport, including questions, roles, rewards, strategy choices, pause and finished states. Long teacher-authored questions and answers have an explicit paginated reading view. The compact menu holds stats, volume and animation settings. Teacher pages, assignment lists and ordinary solo study retain normal document scrolling. Very short software-keyboard views retain natural practice scrolling.

Desktop Treasure Quest chest choices occupy a full-width row with large labels and at least 160-pixel-tall buttons when the window is at least 960 by 560 pixels. Short windows and phones retain compact choices so the complete game fits on screen.

Word Forge assignment practice keeps the prompt, typed answer and actions in a compact screen at 100% zoom. Letter clues keep whole words together, count only letters, and show punctuation separately; a letter panel and full prompt/feedback readers retain longer content. Google sign-in uses its official button without the white iframe surround.

Avatar wardrobe offers 100 original accessories across hats, face, held items, back items and auras. Previewing is free; server-checked purchases use character points and save ownership and equipped slots to the existing account. Sixteen accessories unlock from account-wide expedition milestones without spending points. All thirteen base-character IDs and existing purchases are preserved. The original eight prices remain; Epic and Legendary base prices were raised in 0.12.0. Shop prices range from 10 to 1,000,000,000,000 character points, including the original Million Point Stick and Billion Point Party Hat. All outfits are cosmetic, and the current daily earning limit is unchanged. Saved outfits appear in live games, leaderboards and class rosters, survive replay and are included in personal account exports.

The Keys guide supports editable hotkeys with collision checks and Restore defaults. Shortcuts work in flashcards, independent typing and assignments; they pause while typing except for an explicitly assigned modified Check shortcut. Practice time requires focused, active intervals, with blur/focus boundaries checked by server heartbeats.

CSV/TSV imports and JSON cards accept an optional Category (`Grammar`, `Vocabulary`, `Culture`). The editor and exports preserve it. Category filters apply to independent study and solo games; assignments always keep their full snapshot. Existing uncategorized cards remain available under All categories.

Students can launch seven existing games privately from a shared list. Sketch Relay requires classmates. Solo Word Forge is also an assignment presentation: final typed answers use the same grading, full card set, time and submission requirements. Letter clues do not count as answers.

Extra independent typed answers, including private solo Word Forge, earn Jolly Ranchers. Flip flashcards, multiple choice and homework never earn candy. Default: 100 completed typed questions per reward, with a teacher-editable threshold. Each reward expires exactly 30 days after earning; unspent points reset after December 18, 2026 in the class timezone. Teachers can set the next semester date and mark individual claims. Retries cannot duplicate earnings or claims. Balances, claims and expiry records are included in account exports, private backups and scoped erasure. See `docs/STUDY_RELEASE_2026_11_17.md`.

Release 0.7.1 accepts individual semicolon-separated meanings in typed answers, shuffles card passes in every study/game format, and adds keyboard navigation with a Keys guide. Graded work has its own top-level Assignments tab. New verified Servite Google Workspace students can sign in before enrollment, then enter a class code; their Google name fills the roster. Existing accounts, grading history, class access checks and drafts are retained. See `docs/PRACTICE_NAVIGATION_RELEASE.md`.

Release 0.7.0 gave the original six modes distinct strategy and adds Word Forge spelling puzzles plus Sketch Relay, where one student draws privately assigned vocabulary while classmates guess with letter clues. Those six modes retain multiple choice; the two vocabulary modes use their own layouts. New round state preserves existing live rooms, grades and account records. See `docs/DISTINCT_MODE_GAMEPLAY.md`.

The primary domain is `https://srtw.win`; its custom-domain binding is deployed with the existing Worker. The sender is `QuizDock <no-reply@srtw.win>` through the existing Resend connection. Provider verification and Google-origin setup were confirmed by the owner; deployment and delivery checks are separate. See `docs/SRTW_DOMAIN.md`.

Previous updates added large, one-shot event announcements with actual rewards, bigger game animations, five new original purchasable characters and upgraded art for the existing eight. That release used a lower-two-thirds mobile grid; release 0.8.0 replaces it with a grid that fits the remaining viewport, including fullscreen. See `docs/EVENTS_CHARACTERS_MOBILE.md`.

Previous updates separate large answer tiles from animated game-result screens, give each Sky Rally role its own aircraft, add typed solo flashcard practice, and replace the short music loops with original 16-bar RPG chip themes. Google student and authorized teacher sign-in, shareable self-enrollment links, shuffled solo passes and all 18 arcade events remain. See `docs/PLAYER_EXPERIENCE.md`. Configure `GOOGLE_CLIENT_ID` before releasing; see `docs/GOOGLE_SIGN_IN.md` and `docs/ARCADE_GOOGLE_RELEASE.md`.

Live student scenes use a contained canvas and keep the next action visible. Optional rules and long content use accessible reading pages. Other student and teacher pages keep their document scrolling.

## Runtime configuration

Keep these values in the quizdock Worker’s runtime Variables and Secrets, not in GitHub or build-only variables:

- `GOOGLE_CLIENT_ID`: Google Web application OAuth client ID for student and authorized teacher sign-in (public identifier, not a client secret).
- `TEACHER_EMAILS`: comma-separated teacher allowlist.
- `EMAIL_FROM`: the sender authorized by your email provider.
- `RESEND_API_KEY`: a sending key stored as a secret.

Existing values continue to be used. New teachers do not gain access merely by typing an email. Verified `servitehs.org` Google Workspace accounts can sign in before enrollment. Class access still requires a class invitation/code or active roster membership. Existing students retain their Google sign-in and records. Restrict a class’s email domain and close/rotate its join code as appropriate.

## Pages

- `/`: teacher/student sign-in, Arcade, class enrollment and solo study.
- `/?view=assignments`: the separate Assignments workspace and graded practice.
- `/play.html`: live games and guest PIN joining.
- `/library.html`: private saved-list editor and imports.
- `/reports.html`: archived per-card round reports.
- `/data.html`: backups, retention, scoped deletion and release diagnostics.

## Important behavior

Typed assignments are distinct from ungraded flashcards. Teachers can require answer attempts or distinct cards; all accepted attempts affect accuracy. Active time is a bounded activity estimate, not proof of attention. Checked answers save on the server. Unsubmitted text drafts are local to the browser tab.

Game score, persistent character currency, Jolly Rancher study points, and raffle tickets are different quantities. Private solo games do not enter class raffles or award character currency. Skins are cosmetic. Replays preserve the PIN and player identity, reset round scores, and archive a separate report. A score-based game still has the teacher’s chosen safety timeout.

## Validation and operations

```sh
npm run verify
# With Python Playwright/Chromium and OpenSSL installed:
python tools/run-browser-tests.py
python tools/teacher-google-browser.py
# Read-only deployed-site check:
npm run health
```

`tools/dev-harness.mjs` is a fake-data local test server, never imported by the Worker. GitHub Actions runs tests and a nonpublishing Wrangler bundle. Public health checks are read-only and run twice daily once the workflow is on the default branch; account notification settings control any GitHub alerts.

See `docs/RELEASE_2026_11_14.md`, `docs/DATA_AND_RECOVERY.md`, and `docs/LIVE_ACCEPTANCE.md`. Local checks do not certify physical phones, school email delivery, production capacity or regulatory compliance. Obtain school approval before collecting real student records.
