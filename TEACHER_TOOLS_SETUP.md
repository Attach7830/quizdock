# Teacher tools — configuration and release checklist

## Current release state

The source update is on `feature/teacher-library-round-reports`, separate from `main`. It is prepared for review, not a claim that production has been deployed or verified. There is no need to upload individual folders or use the earlier single-file installer.

This version requires teacher authentication for all new game creation, including games created from a CSV on the arcade homepage. Configure email delivery and test it before releasing to a class.

## Required runtime configuration

Configure these names in the Cloudflare Worker environment that will run the update. They must be available to the running Worker, not only to its build process.

| Name | Purpose |
| --- | --- |
| `TEACHER_EMAILS` | A comma-separated allowlist of teacher email addresses. Use the address at which you will receive sign-in codes. |
| `EMAIL_FROM` | The sender address used by Resend, such as `QuizDock <quizdock@your-domain.example>`. It must be authorized to send through your Resend account. |
| `RESEND_API_KEY` | The private Resend API key used by the Worker to send sign-in emails. Store as a secret. |

Do not paste API keys or sign-in codes into a chat, commit them to GitHub, or place them in public JavaScript. This update does not include real secret values. The tests contain dummy values only.

The code sends a six-digit email code, checks it on the server, and creates a Secure, HttpOnly, SameSite=Lax session cookie. Merely typing an email address does not authorize a teacher. Removing an email from the configured allowlist invalidates its access checks on subsequent requests.

Students still use nickname-and-PIN joining. This release does not add student email accounts.

## Source-based deployment

The branch contains the source files directly. After configuration and review, the deployment command remains:

```sh
npx wrangler deploy
```

Do not use `node quizdock-teacher-tools-update.cjs && npx wrangler deploy` with this branch. That installer was a fallback for when GitHub writes were unavailable; applying it again is unnecessary and may stop on already-updated files.

The checked-in configuration uses Worker name `quizdock`, entry point `src/library-worker.js`, the existing `ROOMS` / `QuizRoom` Durable Object, and the new `TEACHER_LIBRARY` / `TeacherLibrary` Durable Object. Migration `v1` is preserved; `v2-teacher-library` adds the new class. Do not delete the original migration or manually rename its class.

Do not change the production branch to this feature branch merely to inspect the files. Use a separately configured test deployment for live validation when available. A preview environment needs its own appropriate runtime configuration. No production or preview deployment was initiated as part of the source upload.

## Required checks before classroom use

1. Open `/library.html` in the test deployment. Confirm a configured, authorized teacher can request and use an email code. Verify an unauthorized account cannot access saved lists or reports. Never publish screenshots of codes or session cookies.
2. Create a list, add cards, save it, reload, and confirm persistence. Try CSV import and pasted two-column text. Inspect rejected rows rather than silently discarding them. Test an optional HTTPS image and its description.
3. Create a game from the saved list. Join from a separate private browser window using a test nickname. Submit both correct and incorrect answers, replay a card, and confirm counts on the host's card report.
4. End the round and open `/reports.html`. Confirm the frozen prompt/answer snapshot and exported card results. Start another round and verify that the first report remains separate.
5. Test pause/resume, reconnecting, and all four existing game modes. Test mobile layouts and simultaneous students before using actual classroom data.

These are release checks, not statements that the tests have already been completed on Cloudflare.

## How lists and reports behave

Lists can hold up to 250 cards, within a 100 KB serialized-content limit. Empty lists can be saved as drafts but cannot launch games. For prompt/answer pairs, live-game distractors come from other distinct answers in the same list. A single pair therefore needs explicit choices or another distinct answer before it can be used in a live game.

Valid editor changes autosave. Invalid or unsynced drafts are kept locally when browser storage permits. Conflicting revisions require an explicit reload or saving as a new list. JSON exports preserve accepted alternatives; native XLSX files are not imported directly.

Every round receives its own identifier. Reports distinguish repeated attempts from distinct player sessions and retain the original answer options despite shuffled on-screen choices. Unanswered cards have no accuracy value. Editing or deleting the source list does not rewrite historical report snapshots.

Active reports are archived periodically and on completion. Failed archival is retried from saved room state. Starting a replay is blocked if the previous completed report has not yet been archived. Finished reports can be deleted from the reports page; this does not delete the source list.

Temporary game rooms have a 12-hour lifetime. Saved lists and archived reports are stored separately and do not disappear with normal room expiry. They need an appropriate retention/deletion policy before wider use.

## Remaining limitations

Reports count game sessions rather than verified student identities across devices or new nicknames. The 45-player room cap is a configured limit, not evidence of full-class load capacity. Live email delivery and production deployment are unverified. This release is a prototype and is not a compliance or security certification.
