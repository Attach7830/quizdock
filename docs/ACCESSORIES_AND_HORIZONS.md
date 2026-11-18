# Accessories and adventure horizons · 0.11.0

The existing wardrobe now contains **100 original accessories**, up from 20: 84 shop items and 16 expedition rewards. All original item IDs and prices, thirteen base characters, owned items and outfits remain valid. The same vector paths render portraits, rosters, leaderboards and live canvas characters.

Shop prices start at 10 character points. New props include a concerned frog, spaghetti, a snorkeling tuba, an emotional support brick, a carry-on volcano, suspicious pigeons, a duck event horizon and an empty display case called Billion Point Nothing. The Million Point Stick and Billion Point Party Hat keep their exact prices; the new Trillion Point Top Hat costs 1,000,000,000,000. These are intentionally extravagant novelty trophies. Quest rewards offer a separate route to special accessories through actual play.

Search, slot filters, owned items, affordable items, quest rewards and million-point trophies make the larger catalog navigable. Price and name sorting do not change ownership. A student can save one shop item as a savings target; its account-backed meter uses the existing wallet. Setting or clearing a target spends nothing. Buying the target clears it. Previewing any accessory, including a locked reward, remains free and cannot grant ownership.

## Forty-eight milestones

The wardrobe and class island share a quest book with eight paths, six milestones per path and a preview of the next three goals. Every milestone has a named badge. Sixteen specified milestones automatically add an accessory to the account without spending currency or changing the equipped outfit.

| Path | Milestones | Accessory rewards |
| --- | --- | --- |
| Correct answers | 25; 100; 500; 2,500; 10,000; 100,000 | Paper dragon at 500; library castle at 100,000 |
| Finished expeditions | 5; 20; 50; 200; 500; 2,000 | Bookshelf wings at 50; wandering island at 2,000 |
| Team contributions | 10; 50; 100; 500; 2,000; 10,000 | Kindness lantern at 100; duck council scepter at 10,000 |
| Discoveries | 12; 40; 100; 500; 1,500; 5,000 | Fireflies at 100; miniature universes at 5,000 |
| Courier rescues | 5; 20; 50; 250; 1,000; 10,000 | Courier cape at 50; cloud train at 10,000 |
| Accurate rounds | 5; 10; 25; 100; 300; 1,000 | Pixel spectacles at 25; all-seeing toast at 1,000 |
| Personal bests improved | 3; 5; 10; 50; 150; 500 | Second wind at 10; revision phoenix at 500 |
| Personal quests | 3; 10; 25; 100; 500; 2,500 | Quest snail at 25; cosmic goose at 2,500 |

An accurate round requires at least five submitted answers and at least 90% correctness. Personal quests are the repeatable Adventure quests, with their completion checked in the room server. Their persistent count starts with this release because older passports did not retain it. Other existing passport totals count immediately. Twelve collection books span budget props, themed outfits and the longest journeys.

## Persistence, privacy and existing rules

`JourneyService` derives totals from the signed-in student's server-written expedition passports across their enrolled classes. Archived and inactive class memberships retain their saved contribution until the teacher erases or expires that data. Goals have no daily streak or quest deadline. They are independent of the semester reset used for Jolly Ranchers. They are not a promise that records survive an explicit deletion or retention policy.

Finished teacher-hosted and private solo expedition rounds contribute. Flashcards and assignment practice retain their own progress and do not advance these expedition goals. Finished-round receipts prevent duplicate increments; account and member erasure markers reject stale outboxes. No browser-supplied totals, prices or reward IDs can unlock an accessory. Existing passports need no destructive migration. New quest accessories are reconciled on a finished report and on account home, including retroactive milestones.

Unlocked items are ordinary account ownership. They remain available when a class is archived or its progress is erased; full account deletion removes the account and inventory. Personal exports include the existing passport records, earned inventory and saved savings target. Class backups keep class passports and receipts; they cannot overwrite a global wallet or wardrobe. Journey responses contain aggregate counters, not other students' data or archived class details.

Grading, assignment focus time, shuffled card order, character-point earning limits and Jolly Rancher eligibility are unchanged. The wardrobe and quest book use ordinary page scrolling; live games keep their existing contained viewport.

## Verification

Server checks cover combined existing progress, retroactive unlocks, duplicate reports, concurrent exact-price purchases, quest bypass attempts, saved targets, exports and scoped erasure. Browser checks use isolated fake classroom accounts to cross a milestone in a real Word Forge round, wear the unlocked reward, exercise catalog controls and check phone layouts. All 100 accessories are parsed by the actual canvas API; the 80 new designs are checked against portrait bounds and rendered in a contact sheet. Production health and asset checks are recorded separately from local tests and CI.
