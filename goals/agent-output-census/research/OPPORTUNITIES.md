# Friction receipts: agent-output-census

Recorded while building the goal (2026-11-19).

1. **A stopped implementer cannot be resumed, and its uncommitted work is left with no owner.**
   Doing: building P1 to P3 through one Opus implementer while the orchestrator gathered
   reference numbers. Evidence: the parent session restarted and the implementer's run stopped.
   A resume message was refused with "was stopped and won't be resumed". Seven census files,
   about 4,600 lines, sat uncommitted in the lane. The orchestrator then had to review and finish
   them without the implementer's notes. Prevention: an implementer brief asks for a local
   checkpoint commit after each passing slice. A background build runs as a `delegate_task` child
   that survives the parent session.
2. **Figures in an audit that no saved script produced cannot be reproduced.** Doing: AC4 row by
   row. Evidence:
   - These audit figures were never computed by a surviving script: the 104 compaction
     boundaries, 701 TS6305 lines, 3,206 test verdict lines and "about 6%" of Yeet output in
     gate-table repeats.
   - Every counting variant over the reference capture misses all four.
   - Each became a decision file instead of a match.

   Prevention: an audit cites a number only when a saved script printed it, and names the script
   beside the table.
3. **A capture that truncates its input changes what is measured, and nothing records it.**
   Doing: attributing the filter-habit rows. Evidence: the reference's verification capture cut
   each command at 600 characters, and nearly half the Yeet and test commands reached the cut. The
   audit's pipe-habit shares were 3 to 28 points low, while its unfiltered share, computed on the
   whole command, was right. Prevention: a capture that truncates a field also stores the
   field's full length, so a later pass can count the truncated rows.
4. **Modification-time selection cannot be rebuilt on a corpus that has grown since.** Doing:
   the files-scanned row. Evidence: the reference's 342 files were "modified inside the window" at
   its run time. A day later, 870 files qualified, because the harness appends untimestamped
   records to old transcripts. Prevention: the census selects on record timestamps and keeps
   modification time as a pre-filter only (decision
   `files-scanned-counts-files-touching-the-window`).
