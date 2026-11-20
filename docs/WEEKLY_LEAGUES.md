# Weekly leagues

Open **Arcade → Leagues** as a student or teacher. Each class has its own standings and eight tiers: Bronze, Silver, Gold, Sapphire, Emerald, Amethyst, Obsidian and Diamond. Students enter a week's standings with their first learning activity. Classmates see display names and owned avatar accessories; the league response excludes account IDs and email addresses.

## Earning XP

| Activity | Weekly league XP |
| --- | ---: |
| Correct graded answer | 10 |
| Other graded answer attempt | 2 |
| Flashcard review: I know this or Practice again | 2 |
| Earned random event, validated game choice, letter clue, or drawing contribution | 3 |
| Adventure milestone: room, discovery, combo, delivery, checkpoint, boss or quest | 10 |

Typed assignments, assignment Word Forge and independent typed answers count when graded. Crossword drafts stay ungraded: XP is issued only after a whole-grid check. Rechecking unchanged wrong entries cannot farm attempts or XP. Flashcard reviews validate the class, shared list, card, pace and a unique receipt; client-supplied totals do not create XP. Flip cards do not earn Jolly Ranchers.

New class and solo rounds save XP during play, typically within 15 seconds, including rounds with Adventure disabled. Leaving early retains the activity already earned. Server room counters identify meaningful actions; changing menus, picking an outfit or repeating a network request does not create activity. Drawing credit is once per artist and word, rather than once per stroke. Game score and spendable character points keep their existing rules.

The room records class-local weekly activity buckets as actions occur. A cumulative per-student round receipt banks only the unseen increments, so duplicate, delayed and out-of-order reports cannot pay twice. An old week's report cannot add XP to the new week. A game spanning midnight Monday can credit each week's own activity. Final round settlement does not reissue activity already banked. Games already running before this update retain their prior finish-only XP accounting.

## Weekly reset and movement

Weeks run from Monday at midnight to the following Monday at midnight in the class's IANA timezone. Server calendar calculations handle daylight-saving changes. A league read or a new scored answer settles an ended week inside the existing storage transaction; no scheduler or browser timer is required for correctness. An open league page refreshes at the countdown boundary and polls standings periodically.

Only students with positive XP enter that tier's active field. With at least five active students, the top 20% (rounded up) advance one tier, and the bottom 20% (rounded down, at least one) move down one tier. Equal XP shares a competition rank. Tied promotion places advance together; a tie spanning the lower cutoff stays above demotion. Bronze cannot demote, and Diamond cannot promote further. With fewer than five active students, 100 XP earns a promotion and nobody demotes. A week without XP keeps the student's tier.

Weekly XP and correct-answer totals reset to zero. The tier, lifetime counts of active weeks/promotions/first-place finishes, and twelve recent personal results remain saved. Returning after a long absence settles only the last played week; skipped weeks do not cause repeated promotions or demotions.

Teachers can pause leagues for an individual class. Saved XP remains until reset, but XP earning and tier movement stop while paused. Changing this setting first settles any ended week under the previous setting. Re-enabling after a paused deadline therefore cannot retroactively promote an old result.

## Data and grading

League state uses `league-state:<class>:current` and `league-player:<class>:<student>`, with idempotency receipts at `league-game:<class>:<student>:<round>`. It does not modify assignment grades, focus timers, candy policies, character currency, or lifetime expedition statistics. Existing source records and question snapshots are retained.

Switching classes selects the student's own tier in the new class; refreshing standings keeps the current tier filter.

Cached standings clear when the account changes or the selected class is no longer linked. A failed refresh offers a retry and cannot leave another account's or a revoked class's standings on screen.

Signed class backups include league records. Each class's league records restore as a group, so an old backup cannot insert stale weekly XP alongside newer standings. Personal exports include only the requesting student's league records. Scoped erasure removes that class's league profile and game receipts, retention honors the last learning activity and trims old history, and erasure tombstones prevent old backups or room reports from recreating removed progress.

## Verification

Server coverage includes ownership, private standings, typed and crossword receipts, all hosted modes, solo completion, ties, DST boundaries, simultaneous rollover, paused weeks, long absences, Diamond, backups, retention and erasure. Browser coverage uses isolated test accounts for league navigation, an actual Word Forge round banking before completion, with no second payout on finish, automatic countdown refresh, accessories, class switching, teacher controls and desktop/phone layouts. Production verification uses public health, delivered asset hashes, unauthenticated read-route checks and a synthetic read-only league preview; it does not edit real student records.
