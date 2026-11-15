# Eight distinct game experiences

Expected release: `classroom-release-2026-11-15.1` (0.7.0).

Prepared against main 092d5b2 (all other remote branches are already merged; no open PRs). This continues the existing application and its question/result screens.

A correct answer supplies dependable progress and opens a small decision on the result screen. The question keeps its four large answers, natural scrolling and current grading. Game decisions never count as answer attempts or assignment progress, and they do not directly mint account reward points or raffle tickets. Existing completed-round reward and ranking rules remain. Cosmetics remain cosmetic. New round state is optional/versioned: existing live rooms finish with their original rules, and new rounds start the deeper rules.

| Mode | Main decision | Source of surprise | Continuing goal |
| --- | --- | --- | --- |
| Treasure | Bank safely, explore for a growing haul, or take a corsair chance | Stored chest outcomes, bounded raids and occasional jackpots | Protect a vault while extending expeditions |
| Fishing | Select reef, deep water or luminous shallows for the next cast | Species, weather, rare discoveries and a guaranteed discovery after dry spells | Complete a collection and improve the biggest catch |
| Battle | Strike, guard or build charge | Rival defenses, counterattacks and arena conditions | Read defenses and time a charged strike; no elimination |
| Factory | Build complementary stations or fulfill an order | Market demand, different recipes and order offers | Make parts flow through a production chain and grow net worth |
| Sky Rally | Glide to charge, take the ring route or spend boost on a dive | Changing winds, route odds and bounded drafting assistance | Read the forecast and choose a line that suits the selected plane |
| Crystal Keep | Attack, build a tower or repair | Enemy types, boss waves and changing attack intentions | Keep the shared crystal alive and clear waves together |

Treasure's protected vault is part of the round total. Banking resets its expedition multiplier; exploring increases it. Raids affect only an opponent's exposed haul, have a strict cap, and cannot repeatedly hit a student while they are answering. A risky chest retains a minimum payout, and a storm cannot erase a large balance.

Fishing's catches become named species with distinct art and collection progress. Waters trade weight against discovery probability. Weather changes by casts, rather than an extra reflex timer. Repeats advance a discovery guarantee. Every correct answer still catches something. Rods retain the existing in-game upgrade path.

Battle pays accuracy points immediately, then offers a tactical move. Guard absorbs a limited hit and can counter; charge improves a future strike. Rival selection stays bounded by current progress and protects a player from repeated hits between their answers. Knockouts reset health and never stop questions. Solo players get a training payoff.

Factory starts with a press. Cell labs and assemblers create complementary resources on correct answers, and orders consume real inventory. Purchases contribute their cost to asset value, so investing does not arbitrarily drop net worth. Existing passive machines require bounded fuel from correct answers in new rounds. A free Continue option never spends cash automatically.

Rally keeps all three existing planes and role benefits. Gliding stores boost, rings trade consistent progress for a larger bonus, and a dive spends stored boost. Weather is visible before choosing the next route. All correct answers retain their base distance; a failed optional route changes the bonus. Drafting assistance is modest and capped.

Keep adds a shared crystal, enemies, towers and boss waves. Correct answers contribute according to the guardian role and earn separate building supplies. Building or repairing never spends contribution score. Enemy responses take broad participation into account and include a progress fallback. A destroyed crystal enters a recoverable last stand; students keep answering.

Choices are server-owned and restored on reconnect. A pending choice has a unique round-scoped ID; retries cannot pay, build or attack twice. Next applies a documented free/default choice where needed, preserving older clients and quick play. Pause, end, new rounds and stale messages retain their existing server guards. Hidden outcomes never appear in student snapshots. Existing account records, bindings and storage migrations stay intact.

Animation should communicate the resulting state: coins entering a vault, an actual species being revealed, shields absorbing a strike, stations producing parts, a selected plane changing its racing line, and a shared enemy/tower responding. Big milestone announcements stay distinct from everyday feedback. Motion preferences, sound controls and hidden-tab suspension remain available.

Validation will cover real server actions, choice replay/ordering, privacy, capped effects, partial/reconnected rounds, all mode transitions, pause/end behavior, player-count scaling, grading/wallet preservation, mobile/fullscreen scrolling, mode-specific visuals and deterministic balance simulations. Commit, merge, deployment and live verification will be recorded separately after implementation.


## Vocabulary modes added after the six-mode design

The six original modes retain their multiple-choice questions. Word Forge uses shuffled per-player vocabulary, hangman-style letter slots, an optional Spanish letter keyboard, six clue-ink mistakes and a typed whole-word submission. Correct words forge a five-star constellation. Letter guesses affect the game bonus and are not graded attempts. Full-word submissions use the existing strict-accent/Unicode answer normalizer and accepted alternatives. A completed or wrong submission shows the accepted answer, then advances normally.

Sketch Relay requires two connected students. The artist rotates each 60-second word; the class gets a five-second reveal before the next word. The private canonical answer is sent only to the artist and host until reveal. Classmates type whole-word guesses, and letter clues appear at 15-second intervals (capped to avoid revealing most of the word). Full-word guesses count as typed attempts; strokes, clues and artist bonuses do not. Artists earn a capped drawing bonus while questions/reports retain separate correctness counts. Guess IDs and stroke IDs prevent duplicate effects.

Sketch uses validated vector strokes with a fixed palette, brush sizes, normalized coordinates and finite per-word ink. Strokes persist before acknowledgement and broadcast as small deltas; full history is sent only on authentication/sync. Artist-only control, stale word/epoch checks, pause timers, reconnect history, an artist-disconnect grace period, teacher clear/skip and account-erasure cleanup are covered by server tests. Client updates preserve the canvas and text input during classmates' activity. Touch drawing captures gestures only on the artist canvas; the surrounding document remains scrollable.

Typed reports retain exact totals without pretending typed answers selected a multiple-choice option. New typed-correct/incorrect and hinted-attempt fields default to zero for historical reports, and report validation and CSV export reconcile typed and choice totals. Raw typed guesses are not stored in reports.

Nine original 16-bar chip scores now include Ink Beneath the Stars (Word Forge) and Paper Kites Parade (Sketch Relay). Existing music and motion controls remain available.

Deterministic policy simulations in tools/simulate-mode-balance.mjs exercise 300 rounds per strategy across the six original modes. These are core-rule balance checks, not a network or school-device benchmark. Rival defenses, meaningful production investment, wind-dependent racing lines, species collections, bounded exposed-haul raids and recoverable cooperative waves provide different decisions. Cosmetic purchases keep their existing rules.

Feature branches run verification through their pull request; pushes to main also verify the released tree. This avoids duplicate push/PR browser failure notifications for the same feature commit.

Local release validation passed: 253 Node tests, 392 browser assertions (including 46 deep mode/drawing checks and 28 teacher Google checks), original-score offline rendering, deterministic strategy simulations, source syntax, whitespace checks and Wrangler dry-run. The current production release remains separate until merge/deployment verification is recorded in the PR.
