# 3D Crossword Mode

Teachers enable Crossword Mode with a word count on an assignment. New puzzles form one connected 3D grid, with words crossing Across, Down and Depth. Students drag to rotate the cube, click a square to type, or select a clue. Focus word shows interior entries through the other cubes. A Layers view offers conventional direct typing and depth navigation. Clue numbering follows the traditional top-to-bottom, left-to-right order; Across and Down can share a starting number. Saved entry identities remain stable across assignment edits. Classmates receive independently generated layouts, with duplicate-layout checks where the word set offers alternatives. The saved puzzle belongs to that student and weekly assignment (the class-local due week); reopening on another device or after Monday resumes it. A new weekly assignment gets its own puzzle. Existing older puzzles and work retain their saved layout.

Arrow keys move through squares; Space cycles Across/Down/Depth at a crossing. Page Up / Down changes depth. Tab or Enter selects the next clue, with Shift going backward. Backspace/Delete, whole-word paste, Spanish accent buttons and Alt + Up work in the grid. Escape leaves the grid for page controls. The Keys & help button explains these controls. Clues collapse into a picker on phones, while the grid can pan internally or use Fit / zoom controls. Very short software-keyboard windows retain ordinary scrolling.

A teacher word count must fit the deck’s largest group of answers connected by shared letters. A deck without enough shared letters receives a validation message instead of separate word islands. Generation uses bounded randomized 3D placement; exact word count, consistent crossings and connectivity are tested across many seeds.

## Fullscreen

Fullscreen shows only the grid, current highlighted clue and small navigation/exit controls. The whole-puzzle check appears when required entries are filled. Browser fullscreen is used when available; a focused view provides the same interface on phones without that API. Escape or Exit fullscreen returns to the assignment. Letters continue saving in both views.

## Autosave and recovery

Letters save to the student's existing assignment practice record after a short typing debounce. Saves use the active practice lease, assignment revision, puzzle ID, optimistic draft revision and a unique mutation receipt. Crossing entries must agree; validated correct words cannot be overwritten. Network retries reuse the same mutation before sending subsequent edits.

A local device copy retains unsynced letters. Reopening merges nonconflicting local and account changes. If two devices changed the same square differently, students choose which copy to use; neither is silently discarded. Leaving the mode captures the draft and attempts a final save. Logout and account deletion clear local crossword drafts. Older puzzles and solved words upgrade in place, with compatible local per-word drafts retained. No new database migration or account replacement is required.

## Checking and teacher view

Student entries have no correctness colors, correct-word counts or answer-dependent XP while drafting. All required words must be filled before Check whole puzzle can grade them. The check reveals results together, saves correct words and lets the student repair the remaining entries. Unchanged wrong checks cannot duplicate attempts. Submit crossword for credit remains an explicit final action and uses the existing deadline and half-credit policy. Typed practice and Word Forge keep their existing feedback behavior.

Teacher assignment reports privately calculate live correct/filled totals from saved drafts and refresh every five seconds while open. These assessments are never persisted in the student record or returned by student status/draft APIs, personal exports or standings. Grade exports continue to use checked attempts and submitted grades. Existing submission snapshots, typed work, focused time and prior XP remain intact.

## Validation

Server tests cover draft privacy, atomic validation, crossings, incomplete checks, idempotency, stale revisions/leases, protected solved words, legacy migration and explicit credit. Browser checks exercise direct typing, deferred feedback, teacher polling, reload, offline and lost-response recovery, fullscreen with and without its native API, assignment edits, accent words, large puzzles and desktop/phone layouts. The Lists theme change is exercised with existing editing, imports, saved-list concurrency, and ordinary mobile scrolling.
