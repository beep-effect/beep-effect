---
title: Docgen abandons a turbo step that outlives its budget and retries it once
date: 2026-11-26
reversal: Run each docgen turbo step with a plain runToExit and drop the budgets, the retry and the force-kill escalation.
governs:
  - src/commands/Docgen/internal/Local.ts#DocgenStepBudget
  - src/commands/Docgen/internal/Local.ts#scopedDocgenStepBudget
  - src/commands/Docgen/internal/Local.ts#fullDocgenStepBudget
  - src/commands/Docgen/internal/Local.ts#docgenStepForceKillAfter
  - src/commands/Docgen/internal/Local.ts#runStepWithStallWatchdog
  - src/commands/Docgen/internal/Local.ts#runFullDocgen
enforcedBy: []
---

Each docgen turbo step runs under a first-attempt budget; a step that outlives it is abandoned and retried once under a retry budget, and abandoning escalates to a forced kill 20 seconds after the group signal.
Reason: on the hosted fleet turbo has finished every task, printed its summary and then never exited (run 31991634069: 2m8s of work, then the whole 60-minute lane budget). The stall is mid-program, so the forced-exit teardowns in the bins cannot reach it. By then every output is on disk and in `.turbo/cache`, so the retry is a full cache hit that costs seconds.
Budgets: scoped 15 then 10 minutes, about 7x the observed fleet runtime; full 45 then 30 minutes, because a cold full proof legitimately runs for tens of minutes and killing honest work is worse than the stall.
Without the force kill, closing the child's scope waits unbounded on a child that ignores SIGTERM, and the budgets would reclaim nothing.
Rejected: waiting on turbo's exit, which turns the stall into a lost 60-minute lane.
Accepted limit: the stall has not reproduced off-runner (the same zero-cache command exits locally in 108s), so this is containment, not a root-cause fix.
