# Fish, forging and crossword assignments

Release 0.12.0 extends the existing application, accounts and modes. It uses the same Cloudflare Worker and Durable Object bindings. There is no data reset or destructive migration.

## A collection of 300 fish

There are 100 species in each water: 40 Common, 28 Uncommon, 16 Rare, 10 Epic, 4 Legendary and 2 Mythic. The original twelve species keep their IDs and artwork. All 300 species have distinct original SVG/canvas artwork. Fish have six tiers with these baseline catch probabilities:

| Tier | Chance per cast |
| --- | ---: |
| Common | 65% |
| Uncommon | 25% |
| Rare | 8% |
| Epic | 1.8% |
| Legendary | 0.195% |
| Mythic | 0.005% — about 1 in 20,000 |

The server draws a rarity, then one of the species in that water and tier. Shallows, moon tides and habitat/migration/luck bonuses shift non-Mythic probabilities. Mythic weight always remains 50 tickets per million. Each water has two equally weighted Mythics; a particular Mythic is about 1 in 40,000 casts in its water. Every draw is independent, with no guarantee after a certain number of casts. Discovery assistance only chooses unseen species inside an already-rolled non-Mythic tier. The class boss still awards the existing Legendary Leviathan Koi, so it cannot award a Mythic on demand.

Every species also has a prismatic shiny variant, with an independent 1 in 8,192 roll on a random catch. These have original flowing fins, crystal crests, orbiting halos and star markings, shared between SVG and canvas. The roll is separate from rarity: a Mythic shiny is possible but extraordinarily scarce. Journal filters keep shiny counts and best weights separate, and only owned shinies can be placed in an aquarium. Retries cannot duplicate them.

Both correct-answer catches and optional habitat casts use this selection policy. Existing weight, score, collection-bonus and account currency policies remain. Catch tiers appear in the reward and journal. The journal has combined search, water, rarity and ownership filters, with 24 species per page. The game result stays compact. Saved profiles accept all 300 known IDs rather than truncating a round to 32 fish. Per-round idempotency, class membership, privacy erasure and retention checks remain in place. Live rooms retain personal-best ghosts without copying lifetime fish collections into every player record.

## Clearer games and a visible forge

Every mode has a one-click How to play guide: goal, three-step loop, first strategy, controls, optional activities and a round-score/saved-points explanation. Result hints disclose automatic Next actions, such as a Battle Arena strike, and explain when a selected water or route applies to the next answer. Treasure's Corsair explanation reflects its current positive base reward and bounded repair cost; its balance was not changed.

Word Forge makes each correct typed answer one of five visible crafting strikes: Shape, Temper, Engrave, Enchant and Awaken. Five correct answers complete a relic, with a forge/anvil/hammer scene, sparks and the existing constellation bonus. There are twelve recipe names, six original silhouettes and advancing ranks. Assignment forging is visual and uses the existing answer progress; no grade or candy rule changes come from relic animations. Reduced-motion preferences are respected.

The main typed screen has no alphabet grid. Letter clues open an explained panel containing all 33 Spanish letters and accented vowels. The field receives focus on each new hosted or solo Word Forge prompt and when returning from clues. Existing assignment text entry already receives focus; the new crossword uses it too. Full prompt readers and short-screen adaptations preserve input access.

Word Forge Adventure shows one selected, explained helper. Changing the helper is optional. The automatic constellation boss and recipe rewards sit in a separate collapsed section explaining remaining health, automatic damage and round-only rewards. The crossword helper explains that it fills from correct main-game answers; it is different from the new graded crossword option below.

## Crossword as an alternative assignment completion route

In **Assignments → New assignment**, the teacher can set **Crossword alternative: words this week (0 = off)** to 1–40. Set the count when posting that week's assignment. Zero retains ordinary typed/Word Forge requirements. Existing posted assignments and submitted grades keep their rules.

The form explicitly states that solving all crossword clues replaces the typed time/card/accuracy minimums for that assignment. Typed practice and Solo Word Forge remain available against the same assignment record. The student chooses Crossword, solves every required clue, then explicitly selects Submit crossword for credit. Half credit for a late submission applies to every completion method. Reports and CSV identify crossword completion, with answer counts and accuracy still reported separately.

The server chooses the exact required number of distinct words from the assignment's full, immutable deck snapshot, using the deck prompts as clues. There are no independent-study category filters. Eligible first accepted answers contain 2–32 letters; spaces and punctuation are omitted, and the first semicolon-separated meaning defines that clue's grid spelling. The answer must fit those squares. Accents follow the assignment policy; ñ remains distinct. An excessive requested count is rejected before publication with the eligible-word count.

Words connect where possible; answers that cannot cross form separate areas. The generator retries deferred words and compares randomized layouts. It never silently reduces the required clue count. Students select a square or clue menu, type a full answer, and check it. Solved words reveal crossing letters. The compact overview, readable selected-clue panel and full-clue reader allow phone use without scrolling through a large list of clues. Enter checks the word; after a correct word, the Next shortcut selects an unsolved clue and focuses its input.

Each student receives one saved puzzle per assignment. Reloading or switching formats resumes that puzzle; it does not reroll the clues. Layout references are stored with private progress, while answer spellings stay in the private assignment snapshot. Unsolved responses do not include solution strings. Grade changes are server checked, use the existing active-tab lease, reject fabricated completion totals and settle duplicate answer/submission requests once. Assignment crossword work earns no Jolly Ranchers or avatar currency.

## Rare character prices

| Base character | New character-point price |
| --- | ---: |
| Stormwing Ace | 7,500 |
| Frostblade Knight | 10,000 |
| Nebula Mage | 50,000 |
| Sunforge Sentinel | 100,000 |
| Nightfall Kitsune | 250,000 |

Already-owned characters remain owned and free to equip. The server enforces catalog prices; client-supplied prices cannot discount a purchase. The original eight affordable bases, accessory catalog, daily earning cap and candy balances are unchanged.

## Verification scope

Automated server tests cover weighted rarity boundaries, discovery assistance, both real catch paths, all-species persistence, duplicate receipts, owned-character preservation, exact crossword size, crossing consistency, saved puzzles, access/lease checks, typed-route alternatives and late credit. Browser checks use fake local accounts for real purchases, typing, puzzle completion and teacher reports; all 300 fish render through SVG and canvas. The viewport suite exercises all live game phases and assignment layouts. Production verification is read-only public health, delivered asset hashes and public-module presentation checks; it creates no real student work, purchases, emails or grades.
