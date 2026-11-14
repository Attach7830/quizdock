# QuizDock · classroom beta

An independently written classroom quiz arcade. Teacher-owned question lists, six live game modes, class-linked student accounts, typed practice, and ungraded solo flashcards.

## Release 0.4.0 (prepared)

The actual source files are in this repository. **No build-time installer is required.** Keep Cloudflare’s deploy command as `npx wrangler deploy` and the production branch as `main`. Worker name: `quizdock`. Existing SQLite Durable Object bindings and migration names are preserved.

This update adds Google student sign-in, shareable self-enrollment links, original chip music, shuffled solo passes and 18 animated game events. Configure `GOOGLE_CLIENT_ID` before releasing; see `docs/GOOGLE_SIGN_IN.md` and `docs/ARCADE_GOOGLE_RELEASE.md`.

The release integrates the prepared classroom beta with the newer mobile natural-scrolling behavior. Small screens do not force long questions into a fixed-height panel. Animation scenes use a contained canvas; students can hide the scene and open Stats separately.

## Runtime configuration

Keep these values in the quizdock Worker’s runtime Variables and Secrets, not in GitHub or build-only variables:

- `GOOGLE_CLIENT_ID`: Google Web application OAuth client ID for student sign-in (public identifier, not a client secret).
- `TEACHER_EMAILS`: comma-separated teacher allowlist.
- `EMAIL_FROM`: the sender authorized by your email provider.
- `RESEND_API_KEY`: a sending key stored as a secret.

Existing values continue to be used. New teachers do not gain access merely by typing an email. Student access requires a verified email and a class invitation or roster entry. Restrict a class’s email domain and close/rotate its join code as appropriate.

## Pages

- `/`: teacher/student sign-in and classroom home.
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
# Read-only deployed-site check:
npm run health
```

`tools/dev-harness.mjs` is a fake-data local test server, never imported by the Worker. GitHub Actions runs tests and a nonpublishing Wrangler bundle. Public health checks are read-only and run twice daily once the workflow is on the default branch; account notification settings control any GitHub alerts.

See `docs/RELEASE_2026_11_14.md`, `docs/DATA_AND_RECOVERY.md`, and `docs/LIVE_ACCEPTANCE.md`. Local checks do not certify physical phones, school email delivery, production capacity or regulatory compliance. Obtain school approval before collecting real student records.
