---
title: "Completion verifies after the merge, without the pre-merge job timing rule"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Restore the readiness-job timing check in Goals/Completion.ts readinessRecoveryRefusal."
---

Operator ruling 2026-11-12. `goals completion refresh` re-derives readiness from the merged head at any later time. A readiness job that had not finished before the merge no longer makes a final unverifiable.
