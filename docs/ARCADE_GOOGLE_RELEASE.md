# Prepared arcade and Google update

Base inspected: main `f05b5a142b5f96f7ec3668798dd61a68dd72c87f`. At inspection, `feature/arcade-music-events-shuffle` pointed at that same commit; every other remote feature/release branch was already an ancestor of main. No unfinished divergent implementation was discarded.

Expected new release identifier: `classroom-release-2026-11-14.2`.

## Behavior

- Student Google sign-in collects the verified account email and display name without typed names. Active class invitation links let students self-enroll without a teacher roster entry. See `GOOGLE_SIGN_IN.md` for required runtime configuration and account linking behavior.
- Seven original synthesized chip compositions (lobby plus six game modes) use square/triangle voices with no downloaded audio. Host setup and game joining request music; browser autoplay rules can require a Play music tap. Mute and volume persist locally. Pause, hidden tabs and leaving stop note scheduling; replay/mode changes reuse one audio context.
- Solo flashcards use Fisher–Yates shuffled passes. Each pass covers every card once, automatically reshuffles at the boundary and avoids immediately repeating the last card. Previous, reverse, flip and manual reshuffle remain available. Saved indexes still reference the original card, and confidence marks still reference card IDs. No assignment grade or reward currency is created by solo study.
- Three distinct events per mode: comet/echo/compass; shoal/pearl/tide; shield/meteors/drone; gears/airship/blueprint; slipstream/rings/cloud bounce; aurora/roots/crystal orbit. The server rolls after two successful actions and guarantees a surprise by the fourth; the same event kind cannot occur twice in a row. Treasure rolls after a chest is resolved. Events add bounded in-round score, health or catch bonuses, with text notices for host and player and original contained canvas effects. They do not add correct answers, alter accuracy, write typed grades or directly mint account currency. End-of-round podium placement still follows actual game scores, including bonuses.
- Repeated answer/chest messages cannot grant events twice. Reconnect/sync does not replay completed effects. Next rounds clear event state. Motion controls, reduced-motion stills, hidden-tab suspension, scene collapse and natural mobile scrolling remain. Student erasure also removes their latest event identity from the active room.

## Validation and status

Run `npm run verify`, `python tools/run-browser-tests.py`, and `npx wrangler deploy --dry-run`. The browser runner starts fresh fake-data TLS harnesses; its Google stub signs real test RSA credentials and never contacts real student accounts. Browser checks include joining through Google, class invitations, full shuffled passes, all 18 effect drawings, all six authoritative game event paths and existing long-question/mobile scrolling checks.

The original 161 Node tests passed before changes. Final run counts and exact commit/PR status belong in the PR and handoff, not inferred from this prepared document. The nonpublishing bundle is not a deployment. No production storage was modified by local checks. Live Google consent/sign-in, physical phones and actual school-network load still require the checklist in `LIVE_ACCEPTANCE.md`.
