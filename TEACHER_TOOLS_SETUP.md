# QuizDock deployment settings

The classroom release is ordinary editable source. The previous `.cjs` installers are obsolete.

## Cloudflare

Worker: `quizdock`. Repository: `Attach7830/quizdock`. Production branch: `main`. Root: `/`. Build command: blank. Deploy command: `npx wrangler deploy`. No local Windows installation is required for the Git-connected deployment.

Keep the existing runtime secrets in **Settings → Variables and Secrets**, not build-only variables:

| Name | Purpose |
| --- | --- |
| `TEACHER_EMAILS` | Comma-separated authorized teacher email addresses. |
| `EMAIL_FROM` | Verified Resend sender, matching its authorized sending domain. |
| `RESEND_API_KEY` | Private sending key; never commit it or paste it in chat. |

Existing teacher/library storage and the `QuizRoom`/`TeacherLibrary` class migrations are unchanged. Do not delete namespaces or rotate unrelated keys to troubleshoot.

## First visit after deployment

Open `/api/health` and verify the release identifier in `docs/RELEASE_2026_11_14.md`. Reload teacher and student tabs once, between games. Teacher sign-in is on `/`; saved lists remain at `/library.html`, reports at `/reports.html`, live games at `/play.html`, and data controls at `/data.html`.

Use designated test accounts before importing real students. Create a class, optionally restrict its email domain, and add a roster or share the invitation code. Students must verify their email. Closing code enrollment does not remove existing rostered members.

No extra runtime secret is required for this release. The optional `STUDENT_EMAIL_DAILY_LIMIT` environment value controls the app's daily student-mail cap (default 500, bounded from 100 to 1,000). This does not change the email provider's own account quota.

Follow `docs/LIVE_ACCEPTANCE.md` for the actual-device and email tests. Automatic retention is disabled until explicitly enabled; see `docs/DATA_AND_RECOVERY.md`.

## Build and monitoring

GitHub Actions verifies source and tests, runs simulated browser checks, and performs a nonpublishing Wrangler bundle. Scheduled public health checks run twice daily after the workflow reaches the default branch. These checks do not sign in, send email, or prove that the app works on a physical phone.

Cloudflare deployment documentation: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
Runtime secrets documentation: https://developers.cloudflare.com/workers/configuration/secrets/
