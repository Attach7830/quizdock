# Semester assignments on the student homepage · 0.11.1

The student homepage now has one assignment section containing unfinished upcoming and overdue work from the current semester. Cards are ordered by due date, with overdue work first. They show the class, due date, normal completion requirements, saved progress and a direct practice button. Overdue cards explicitly offer half credit (50%). Submitted work leaves this to-do list; the separate Assignments workspace keeps earlier and future work available.

The initial semester is **August 10 through December 18, 2026**, as supplied by the teacher. Teachers can change each class's start and end under **Arcade → Classes → Semester dates**. The filter uses assignment due dates and whole calendar dates in the class timezone, including the full final day. Archived assignments, future publication timestamps, unlinked classes and work outside the current semester do not appear in the homepage section. The class semester must contain today's date to be current.

Legacy classes get these initial defaults without rewriting stored records. New classes save their initial assignment semester. Generic defaults for later terms are January 1–June 30 or August 1–December 31; teachers can set their actual school calendar. Assignment semester dates are independent of the Jolly Rancher points period: changing them does not reset rewards, alter assignment due dates or change submitted grades.

## Late credit

New submissions earn 100% completion credit at or before the exact due timestamp and 50% afterward. Both Typed practice and Solo Word Forge still require all configured time, card-count and accuracy thresholds. The server records the credit percentage when the student submits. Client-supplied percentages cannot override it, retries return the original credit, and the answer accuracy remains a separate measurement.

The practice due-date line and guide explain the late rule. New submission receipts display the earned percentage; teacher submission tables and grade CSV files include it. The CSV appends `Credit %` to the existing columns, retaining their previous positions.

Previously submitted work is preserved. Older records without an explicit credit percentage display a dash in the new teacher column and an empty CSV cell; the application does not retroactively assign or reduce their grade. Existing stored percentages, if present, are retained. Backups and personal exports keep the existing assignment and practice records, including the new field.

Homepage practice shortcuts open the dedicated Assignments workspace. Existing student data, question snapshots, shuffled passes, answer checking, focus-based active time, candy eligibility and character-point rules are unchanged. Homepage and teacher pages retain ordinary vertical scrolling; the graded practice viewport retains its existing compact layout.

## Verification

Server tests cover timezone and semester boundaries, combined homepage ordering, submitted/archived/other-semester exclusions, exact due-time credit, immutable retries, forged percentages, old records, CSV values, export preservation and teacher-only settings. Browser checks exercise editable dates, phone layouts, homepage navigation, actual on-time and late submissions in both practice formats, teacher reports and a downloaded grade CSV, using isolated fake accounts. Production checks are recorded separately from local verification and CI.
