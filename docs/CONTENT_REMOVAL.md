# Removing student content

Teachers can choose **Assignments → Remove from students** on a posted assignment. Confirming removes it from student assignment lists and the homepage and blocks direct practice access. Submitted grades, answer attempts, focused time, personal crossword layouts, letters and study history remain stored. Teachers can still open submission reports, see live crossword counts and export grades.

Enable **Show removed assignments** to see recovery cards, then choose **Restore for students**. Unfinished work resumes with the same puzzle and saved letters; recorded grades retain their original requirements. Restore an assignment before editing its settings. Removal is separate from the optional retention policy: it cannot restore work erased by retention or account deletion.

For independent study, open **Arcade → Classes → Roster & access → Shared study lists**. Each list has **Remove from students** and **Restore for students** controls. These affect only that class's shared snapshot. The teacher's private source list, other classes, posted assignment snapshots and students' existing study records remain intact. A shared snapshot can be restored even after its private source was deleted. Sharing the private list again publishes the latest saved revision.

Both actions require the owning teacher's authenticated session and class ownership. Version checks reject stale tabs; duplicate retries do not repeat writes. Assignment and shared-list indexes change atomically with their records. Backup restoration never overwrites a newer visibility state.

## Demo unit

Download [QuizDock-Demo-Unit-Ropa-Gramatica-Cultura.csv](../public/examples/QuizDock-Demo-Unit-Ropa-Gramatica-Cultura.csv), also available from **My lists → Import cards**. The UTF-8 file contains 30 Spanish prompt/answer pairs: 12 vocabulary, 10 grammar and 8 culture, with optional hints and examples. It contains no student data.

1. Create a list in **My lists**, import the CSV and save the list.
2. Create an assignment using that list and choose the class and deadline.
3. Set **Crossword Mode: words this week** to **12** (the deck supports up to 30).
4. Students open the assignment and choose **Crossword Mode** to choose 2D or 3D and receive their own saved, connected puzzle.

## Validation

Server checks cover teacher authorization, all removed practice/solo entry points, retained grades and work, restore, stale and duplicate requests, private source deletion, per-class sharing and signed backup conflicts. Browser checks import the actual demo CSV, complete a 12-word 3D assignment, remove and restore content, export retained grades, and reach controls through ordinary phone dialog scrolling. All browser accounts and submissions are synthetic.
