# Live acceptance checklist

Use only designated test accounts until school approval. None of these live outcomes should be inferred from automated local tests.

- [ ] Cloudflare deploy succeeds from the source release, using `npx wrangler deploy`.
- [ ] `GET /api/health` reports `classroom-release-2026-11-14.2` with `ok: true`.
- [ ] Teacher receives one sign-in email and the code works; unauthorized teachers cannot host.
- [ ] Two Google test students open a class invitation link, sign in with Google and join without typing a name or being pre-rostered. Confirm their Google names and verified emails in the roster. An unrelated account cannot view its assignments or join its games.
- [ ] Save, reload and edit a list. Import a real-format test CSV and view a prompt image.
- [ ] Start a class game, join two devices, answer, disconnect/reconnect, then switch through modes with the same PIN. Confirm distinct saved reports.
- [ ] Try late-entry allowed and blocked. Existing players can reconnect either way. Try a time ending and target-score ending.
- [ ] On the actual phone: portrait/landscape, expanded/collapsed browser controls, fullscreen fallback, long prompts and images, feedback/Next/chest buttons, Stats drawer and the on-screen keyboard. Nothing should be unreachable. Natural scrolling is intentional.
- [ ] Create typed assignments with attempts vs distinct-card thresholds. Check strict/optional accents, reload midway, temporary offline state, explicit submission and late submission. Confirm teacher CSV output.
- [ ] Original chip music starts after a host/join gesture (or a Play music tap if autoplay is blocked). Test mute, volume, background tab, pause/resume and same-PIN mode changes.
- [ ] Trigger events in all six modes. Confirm matching text and distinct animations, reduced-motion stills, and no replay on reconnect.
- [ ] Solo flashcards shuffle on opening and after a full pass without repeats inside a pass; marks stay attached to the right cards. Solo flashcards remain ungraded. Rewards issue once after a finished game; buying a skin deducts only once. Test raffle first-only and 3/2/1 weighting.
- [ ] Export a test workspace, preview restoration, confirm it does not overwrite newer edits. Preview retention without enabling it. Test class erasure on test accounts only.
- [ ] Run a real classroom-size trial on school Wi-Fi, then review Cloudflare errors and report persistence. The simulated 45-player test does not establish network latency/capacity.
- [ ] School privacy/security review and the chosen data-retention policy are approved before real student records are collected.

Report a remaining mobile issue with screen orientation, browser, whether the keyboard is open, release identifier and a screenshot with student details hidden. A physical-device issue is not considered closed merely because Chromium viewport tests pass.
