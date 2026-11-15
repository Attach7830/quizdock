# Validation index

Current update: `PRACTICE_NAVIGATION_RELEASE.md`. Previous updates: `DISTINCT_MODE_GAMEPLAY.md`, `SRTW_DOMAIN.md`, and `EVENTS_CHARACTERS_MOBILE.md`. Earlier features: `PLAYER_EXPERIENCE.md` and `ARCADE_GOOGLE_RELEASE.md`.

Run `npm run verify` for source syntax and repository Node tests. Run `python tools/run-browser-tests.py` for isolated fake-data browser checks. Run `python tools/teacher-google-browser.py` for the separate teacher Google entry-point checks. The browser suites require Python Playwright, Chromium and OpenSSL; screenshots/results are written under gitignored `checks/`.

Historical validation files describe older releases, not the current production rollout. Distinguish mocked storage/email and local browser checks from live Cloudflare, school inbox, physical-device and full-class tests. CI bundles the Worker without publishing; `/api/health` reports the deployed release. Consult `LIVE_ACCEPTANCE.md` for manual checks that still require real devices/accounts.
