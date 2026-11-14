# Validation index

Prepared update: `ARCADE_GOOGLE_RELEASE.md`. Previous release: `RELEASE_2026_11_14.md`.

Run `npm run verify` for source syntax and repository Node tests. Run `python tools/run-browser-tests.py` for isolated fake-data browser checks. The latter requires Python Playwright, Chromium and OpenSSL; screenshots/results are written under gitignored `checks/`.

Historical validation files describe older releases, not the current production rollout. Distinguish mocked storage/email and local browser checks from live Cloudflare, school inbox, physical-device and full-class tests. CI bundles the Worker without publishing; `/api/health` reports the deployed release. Consult `LIVE_ACCEPTANCE.md` for manual checks that still require real devices/accounts.
