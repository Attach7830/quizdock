# QuizDock — Classroom Arcade

Bring your own questions and host a classroom multiplayer quiz. Four original prototype modes: Treasure Quest, Fishing Frenzy, Battle Arena, and Factory Tycoon.

## Teacher-tools update: review branch

This branch adds a private teacher question library, optional prompt images, and persistent per-card round reports. It contains ordinary editable source files, not a build-time installer.

**Do not deploy this update to production before configuring teacher email sign-in.** New game creation requires a verified teacher session. Without the runtime configuration described in [TEACHER_TOOLS_SETUP.md](TEACHER_TOOLS_SETUP.md), a teacher cannot create new games in this version.

The update is staged on `feature/teacher-library-round-reports`. Pushing this branch is not confirmation that the production website has changed. The existing production branch is `main`.

## Included in this update

- Teacher email sign-in with one-time codes and a server-controlled email allowlist.
- Private saved lists with card editing, additions, removal, duplication, reordering, and valid-change autosave. Revision conflicts do not silently overwrite another edit.
- Imports from CSV, TSV or pasted spreadsheet columns, `term:definition` text, semicolon-separated files, and JSON backups. Preview errors before appending or replacing cards.
- Optional public image URLs with image descriptions and a failed-image message. Direct image uploads are not included.
- Server-owned per-round card results: attempts, correct and incorrect counts, first-attempt accuracy, original answer-choice distribution, and distinct player sessions.
- A separate report for each replay, with frozen question/answer snapshots. Completed reports persist outside the temporary room and export to CSV or JSON.
- Existing game modes and animation assets are retained.

Students still join by nickname and PIN. A nickname is not a verified student identity. Reconnecting the same session does not create a new respondent; joining again as a different session does.

## Deploying this branch after configuration and review

See [TEACHER_TOOLS_SETUP.md](TEACHER_TOOLS_SETUP.md) for the prerequisites and release checks. The source-based deployment command is:

```sh
npx wrangler deploy
```

Do not run the earlier `quizdock-teacher-tools-update.cjs` installer on top of this branch. Its work is already represented by the committed source files.

`wrangler.jsonc` names the Worker `quizdock`, uses `src/library-worker.js`, preserves the `ROOMS` binding and its `v1` migration, and adds `TEACHER_LIBRARY` with migration `v2-teacher-library`.

## Development checks

With Node.js 22 or newer:

```sh
npm install
npm test
npm run check
```

Tests simulate Durable Object storage and sockets; they are not live Cloudflare tests. See [docs/VALIDATION.md](docs/VALIDATION.md) for what was checked and what remains unverified.

## Scope and prototype limits

This is not the complete requested student platform. Student accounts/classes, graded assignments, solo flashcards, weekly raffles, cosmetic purchases, additional game modes, advanced animation work, and configurable late-entry/score-ending rules remain outside this update. See [docs/UPGRADE_STATUS.md](docs/UPGRADE_STATUS.md).

The configured room limit is 45 players, not a load-tested guarantee. Do not enter real student information during evaluation. Live email delivery, production deployment, full-class load testing, and a broader security review remain release checks.
