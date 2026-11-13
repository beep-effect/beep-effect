---
title: "Required checks bind to the newest run at the merged head; a bypass is not itself a red"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Restore both notAfter bounds in goalRequiredCheckFacts, the early unsatisfied for activeRed/recoveredRed, and success-only counting."
---

Agent decision (`research/design-pr-a.md` DN-1, DN-2, DN-3).

- DN-1: `goals completion refresh` binds each required context to the newest run on the accepted head at the time it runs. Both bounds in `goalRequiredCheckFacts` go: started before the merge and completed before the merge. A run still in progress reads as `pending`, which is a transient unknown. Basis: D-after, and D-hand (a final the operator merged while Heavy checks were still running must verify once they finish). #2755 and #2756 show that the started-before bound matters, because Test Unit first ran after the merge. #3132 is not evidence: every required run completed before its merge.
- DN-2: a failed `required_status_checks` evaluation in the merge-push rule suite (a bypass) is not a red by itself. The reds are the required contexts that are not green at the head. The verdict records `ruleSuiteBypassed`. The rule suite still decides which contexts were required.
- DN-3: `skipped` and `neutral` count as success, matching GitHub's own rule-suite evaluation on #3112, #3027 and #3132.

Reverse: restore both `notAfter` bounds, restore the early `unsatisfied` for `activeRed` and `recoveredRed`, and narrow `successful` to `success`.
