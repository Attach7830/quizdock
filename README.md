# QuizDock — Classroom Arcade

Cloudflare-ready classroom quiz game with four modes: Treasure Quest, Fishing Frenzy, Battle Arena, Factory Tycoon.

## Deployment status

This repository contains the initial Cloudflare Worker configuration. The application is **not ready to deploy** until the source folders `public/` and `src/` are uploaded. Do not attempt to deploy a configuration-only repository.

## Finish uploading (no terminal needed)

1. On Windows, open the folder where you extracted **QuizDock-Website.zip**.
2. Open the nested `quizdock` folder (containing `package.json`).
3. In GitHub, click **Add file → Upload files**.
4. Drag the folders **public**, **src**, and **test** into the GitHub page, plus `sample-spanish-vocab.csv`. Confirm their paths are `public/index.html`, `public/js/app.js`, `src/worker.js`, etc., **not** `quizdock/public/...`.
5. Click **Commit changes**. Existing `package.json`, `wrangler.jsonc`, and `.gitignore` have already been added.

## Deploy using Cloudflare's website

1. Sign in at https://dash.cloudflare.com/ and open **Workers & Pages → Create application**.
2. Choose **GitHub** and select `Attach7830/quizdock`.
3. Make the Worker name **quizdock-classroom-arcade** (matching `wrangler.jsonc`).
4. Select branch **main**; root directory **/**.
5. Build command: leave empty. Deploy command: `npx wrangler deploy`.
6. Choose **Save and Deploy**. Cloudflare installs the Node dependencies and deploys the Worker. No Node.js installation is needed on your Windows PC.
7. Test the generated `workers.dev` address with two browsers before using it in class.

## Notes

- Students join using a PIN, without accounts.
- CSV uploads support Blooket/Gimkit multiple-choice formats and two-column vocab files.
- Do not collect students' full names or other personal data while the prototype remains unaudited.
- If a deployment fails, check **Workers & Pages → quizdock-classroom-arcade → Builds** for the exact error.

## Local development (optional)

```
npm install
npm test
npm run dev
```
