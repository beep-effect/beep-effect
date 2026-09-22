---
{}
---

No release: reviewer follow-ups on resolved review threads now gate a merge, `yeet reply`
answers them, and every read-first Yeet surface replays the PR comment stream it missed.

A thread the author resolved can receive another reviewer comment afterwards; "unresolved"
accounting never showed it. Each thread is now classified from its full comment chain by
structure alone — never from comment prose — into `unresolved`, `resolved-answered`,
`resolved-follow-up` or `resolved-acknowledged`. Unresolved and follow-up threads are
outstanding: `merge-ready`'s `threads-resolved` criterion counts both, closeout blocks the
new `review-follow-ups` gate and raises one `pr-review` issue per thread, the watch mode
reports the new transitions, and `yeet status --remote` prints `review follow-ups: N`. A
bot's confirmation after the author resolved a thread is `resolved-acknowledged`: printed
and counted as `review acknowledgements`, never gating. An unknown PR author or resolver
reads as answered, so unknown is still never a named blocker.

`yeet reply` routes on the same state: an unresolved thread is posted and resolved, a
follow-up thread is posted with resolve forced off so an already-closed thread is not
re-resolved, and answered or acknowledged threads stay `stale`. The status thread query is
now a cursor loop, so the "additional review threads omitted after the first 100" sentinel
is gone and the gate reads real counts on a large PR.

`yeet status --remote`, `yeet closeout` and the monitor's first cycle now replay review
comments, issue comments and review bodies newer than a durable cursor, so a reboot no
longer loses what arrived while nothing was watching. The cursor artifact moves to
`yeet-monitor-comments/v2` with a review-body cursor, migrates a v1 record from the earlier
of its two cursors, and merges monotonically. A truncated fetch is salvaged and advances
only to the rows decoded; a failed read leaves the cursor untouched. Review bodies are
parsed for structural markers only — CodeRabbit's actionable, nitpick and outside-diff
counts, Greptile's confidence and new-finding triplet — and reported through the always
passing `review-advisories` gate; advisories never block a merge.
