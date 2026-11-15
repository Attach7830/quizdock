# QuizDock · classroom beta

An independently written classroom quiz arcade. Teacher-owned question lists, eight live game modes, class-linked student accounts, typed practice, and ungraded solo flashcards.

## Release 0.7.1

The actual source files are in this repository. **No build-time installer is required.** Keep Cloudflare’s deploy command as `npx wrangler deploy` and the production branch as `main`. Worker name: `quizdock`. Existing SQLite Durable Object bindings and migration names are preserved.

This update accepts individual semicolon-separated meanings in typed answers, shuffles card passes in every study/game format, and adds keyboard navigation with a Keys guide. Graded work has its own top-level Assignments tab. New verified Servite Google Workspace students can sign in before enrollment, then enter a class code; their Google name fills the roster. Existing accounts, grading history, class access checks and drafts are retained. See `docs/PRACTICE_NAVIGATION_RELEASE.md`.

Release 0.7.0 gave the original six modes distinct strategy and adds Word Forge spelling puzzles plus Sketch Relay, where one student draws privately assigned vocabulary while classmates guess with letter clues. Those six modes retain multiple choice; the two vocabulary modes use their own layouts. New round state preserves existing live rooms, grades and account records. See `docs/DISTINCT_MODE_GAMEPLAY.md`.

The primary domain is `https://srtw.win`; its custom-domain binding is deployed with the existing Worker. The sender is `QuizDock <no-reply@srtw.win>` through the existing Resend connection. Provider verification and Google-origin setup were confirmed by the owner; deployment and delivery checks are separate. See `docs/SRTW_DOMAIN.md`.

Previous updates added large, one-shot event announcements with actual rewards, bigger game animations, five new original purchasable characters and upgraded art for the existing eight. On mobile, four answer tiles occupy the lower two-thirds of the viewport when the prompt fits, including fullscreen; longer content stays scrollable. See `docs/EVENTS_CHARACTERS_MOBILE.md`.

Previous updates separate large answer tiles from animated game-result screens, give each Sky Rally role its own aircraft, add typed solo flashcard practice, and replace the short music loops with original 16-bar RPG chip themes. Google student and authorized teacher sign-in, shareable self-enrollment links, shuffled solo passes and all 18 arcade events remain. See `docs/PLAYER_EXPERIENCE.md`. Configure `GOOGLE_CLIENT_ID` before releasing; see `docs/GOOGLE_SIGN_IN.md` and `docs/ARCADE_GOOGLE_RELEASE.md`.

The release integrates the prepared classroom beta with the newer mobile natural-scrolling behavior. Small screens do not force long questions into a fixed-height panel. Animation scenes use a contained canvas; students can hide the scene and open Stats separately.

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

Game score, persistent reward points, and raffle tickets are different quantities. Skins are cosmetic. Replays preserve the PIN and player identity, reset round scores, and archive a separate report. A score-based game still has the teacher’s chosen safety timeout.

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
