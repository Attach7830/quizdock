# QuizDock — Classroom Arcade

Bring your own CSV and host a classroom multiplayer quiz. Four original prototype modes: Treasure Quest, Fishing Frenzy, Battle Arena, and Factory Tycoon.

## Repository status

The application source is included in this repository. No manual file or folder upload is needed. Source upload does **not** publish a website: connect this repository to Cloudflare using the steps below.

This is a prototype, not a production-audited classroom service. Local automated checks cover CSV imports, scoring, and simulated room behavior; they do not establish live Cloudflare reliability or full-class load capacity.

## Deploy entirely in your browser

No Node.js installation, terminal, or npm commands are needed on your Windows computer.

1. Open https://dash.cloudflare.com/ and go to **Workers & Pages → Create application → GitHub**.
2. Authorize Cloudflare to access **Attach7830/quizdock**, then select that repository.
3. Use these project settings:

| Setting | Value |
| --- | --- |
| Worker name | `quizdock-classroom-arcade` |
| Production branch | `main` |
| Root directory | Repository root (`/`) |
| Build command | Leave blank |
| Deploy command | `npx wrangler deploy` |

4. Click **Save and Deploy**. The deploy command runs on Cloudflare, not on your computer.
5. When deployment succeeds, open the Worker URL shown by Cloudflare.

The Worker name must match `name` in `wrangler.jsonc`. Choose the **Worker/GitHub** route, not a static Pages upload: the multiplayer backend requires a Worker and Durable Objects.

Cloudflare documentation:
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## First test after deployment

Open the site as teacher, load the demo or a CSV, and create a room. Open a second browser or private window, join with the room PIN and a test nickname, and start the game from the teacher tab. Check answering, scores, pause/resume, and ending the game. Repeat for each mode before trying a class.

## Features and limits

- Imports Blooket-style and Gimkit-style multiple-choice CSVs, plus two-column vocabulary files.
- Four game modes share the uploaded question bank.
- Nickname-only joining with six-digit PINs; up to 45 players per room is the configured limit, not a load-tested guarantee.
- Host controls: start, pause, resume, end, replay, and CSV result export.
- Server-side answer checking with private per-session host/student tokens.
- Room data is scheduled for deletion after 12 hours. There is no persistent public question library.

## Prototype precautions

There is no teacher account system yet: anyone who can reach the site can create a room. The host token protects an existing room's teacher controls; it does not restrict who can create new rooms. Abuse prevention, broader security review, and school approval are needed before wider use. Use test nicknames rather than students' full names during evaluation.

## Project layout

- `public/`: website, styles, browser app, and CSV importer.
- `src/`: Cloudflare Worker, Durable Object room handlers, and game rules.
- `test/`: automated tests including a simulated Durable Object runtime.
- `wrangler.jsonc`: Worker, static asset, and Durable Object configuration.
- `sample-spanish-vocab.csv`: a small file for testing imports.

## Optional local development

With Node.js 22 or newer installed:

```sh
npm install
npm test
npm run check
npm run dev
```

Local testing is optional; the browser-only deployment path above does not require installing these tools on your PC.
