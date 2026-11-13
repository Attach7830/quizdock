# Upgrade scope and status

## GitHub source update

GitHub editing is working again. The prepared source update is being reviewed on `feature/teacher-library-round-reports`, not released on `main`. The normal source files are editable in GitHub; no generated installer is required.

## Included

Teacher-only verified email sign-in; private saved lists; on-site card editing and valid-change autosave; CSV/TSV/pasted columns/colon/semicolon/JSON imports; optional prompt image URLs; persistent per-round card reports and CSV/JSON exports. The original four game modes and existing animation assets are retained.

## Release blocker

New game creation in this version requires a verified teacher session. Configure `TEACHER_EMAILS`, `EMAIL_FROM`, and `RESEND_API_KEY` in the runtime environment, validate live email sign-in in a test deployment, and complete the smoke tests in `TEACHER_TOOLS_SETUP.md` before classroom release. No API-key values belong in the repository.

## Requested work not delivered by this update

- Verified student email accounts and collected roster names; teacher-created classes and linked student homepages.
- Weekly raffle using first-place winners or weighted first/second/third place tickets.
- Typed graded practice assignments with time, card-count and accuracy thresholds, autosaved progress, due-week lists, and contextual accent entry.
- Solo flashcard practice.
- Teacher-selectable late entry and time-versus-score ending conditions. Existing live rooms allow late entry, but the requested per-game toggle is not added here.
- Character customization, earned cosmetic currency and skin purchases.
- Additional game modes with selectable player strengths and weaknesses.
- The more elaborate animation/artwork upgrade discussed after the first animation release.

These items remain backlog, not hidden features or deployed functionality. The included card reports currently distinguish player sessions, not verified student accounts.
