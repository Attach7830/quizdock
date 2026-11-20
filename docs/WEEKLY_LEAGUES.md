# Weekly leagues

Open **Arcade → Leagues** as a student or teacher. Each class has its own standings and eight tiers: Bronze, Silver, Gold, Sapphire, Emerald, Amethyst, Obsidian and Diamond. Students enter a week's standings with their first correct answer. Classmates see display names and owned avatar accessories; the league response excludes account IDs and email addresses.

## Earning XP

Each correct answer earns 10 league XP. Graded typed assignments, assignment Word Forge, solved Crossword Mode clues and independent typed practice count immediately. Class and solo games bank their correct-answer XP when a round finishes, including games with Adventure disabled. Game score, luck, item prices and avatar ownership do not affect XP. Flipping flashcards earns no XP.

The existing server grading and answer receipts settle typed XP once. Hosted rounds use the existing outcome settlement, and solo rounds save an XP settlement marker in the existing study-game receipt. Retries and reconnects do not bank a round twice. A delayed report for an already-closed week cannot change its results or add its XP to the new week.

## Weekly reset and movement

Weeks run from Monday at midnight to the following Monday at midnight in the class's IANA timezone. Server calendar calculations handle daylight-saving changes. A league read or a new scored answer settles an ended week inside the existing storage transaction; no scheduler or browser timer is required for correctness. An open league page refreshes at the countdown boundary and polls standings periodically.

Only students with positive XP enter that tier's active field. With at least five active students, the top 20% (rounded up) advance one tier, and the bottom 20% (rounded down, at least one) move down one tier. Equal XP shares a competition rank. Tied promotion places advance together; a tie spanning the lower cutoff stays above demotion. Bronze cannot demote, and Diamond cannot promote further. With fewer than five active students, 100 XP earns a promotion and nobody demotes. A week without XP keeps the student's tier.

Weekly XP and correct-answer totals reset to zero. The tier, lifetime counts of active weeks/promotions/first-place finishes, and twelve recent personal results remain saved. Returning after a long absence settles only the last played week; skipped weeks do not cause repeated promotions or demotions.

Teachers can pause leagues for an individual class. Saved XP remains until reset, but XP earning and tier movement stop while paused. Changing this setting first settles any ended week under the previous setting. Re-enabling after a paused deadline therefore cannot retroactively promote an old result.

## Data and grading

League state uses `league-state:<class>:current` and `league-player:<class>:<student>`. It does not modify assignment grades, focus timers, candy policies, character currency, or lifetime expedition statistics. Existing source records and question snapshots are retained.

Signed class backups include league records. Each class's league records restore as a group, so an old backup cannot insert stale weekly XP alongside newer standings. Personal exports include only the requesting student's league record. Scoped erasure removes that class's league profile, retention honors the last learning activity and trims old history, and erasure tombstones prevent old backups or room reports from recreating removed progress.

## Verification

Server coverage includes ownership, private standings, typed and crossword receipts, all hosted modes, solo completion, ties, DST boundaries, simultaneous rollover, paused weeks, long absences, Diamond, backups, retention and erasure. Browser coverage uses isolated test accounts for league navigation, an actual finished Word Forge round, automatic countdown refresh, accessories, class switching, teacher controls and desktop/phone layouts. Production verification uses public health, delivered asset hashes, unauthenticated read-route checks and a synthetic read-only league preview; it does not edit real student records.
