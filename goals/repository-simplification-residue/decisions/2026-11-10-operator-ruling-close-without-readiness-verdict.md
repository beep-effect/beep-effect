---
title: "Operator ruling: close without the Yeet readiness verdict"
date: 2026-11-10
lane: "docs/residue-adopt-completed-retained"
pullRequest: 3094
reversal: "Set the yeet-verdict acceptance ref back to gating, restore proposedCloseout #3094, drop retentionReason, set the lifecycle back to active, and open a re-final held for merge-ready"
---

Both goal-final PRs merged from an operator account before their until-ready monitor recorded readiness: #3073 at 06:11:14Z with its review window open until 06:18:21Z, and the goals-only re-final #3094 at 06:33:32Z, 5.5 minutes after its ready flip. Neither went through `yeet merge-gate`. `goals completion refresh --slug repository-simplification-residue --readiness-job 89ac5f6d-5a5d-491c-91fc-5b10d40f0e9d` reported #3094 `unknown`: hosted required checks verified (15 green required contexts at accepted head 091ee20b85 before merge, complete rule-suite inventory), and the gating yeet-verdict was unknown because no monitor recorded readiness. #3073 had the same shape at 3d04e08cef.

On 2026-11-10 the operator ruled the goal closed without the readiness verdict evidence (fleet ruling `residue-closed-without-verdict`), instead of a third re-final. This packet-state PR therefore removes `proposedCloseout`, keeps the yeet-verdict ref as a non-gating historical record, and adopts `completed-retained` through `goals set-status`; #3094 stays the final pull request in `completionGate.pullRequests`. It writes no `closeout` record, because the manifest schema reserves that record for closeouts with verified gating Yeet readiness, which this ruling waives. The gating evidence is the hosted required checks at the accepted head; `goals completion refresh` then reported #3094 verified on that evidence, with the review-window sub-claim unsatisfied and merge-ready unknown. The ruling waives only the readiness proof for this packet: it does not change the completion gate for any other goal, and the fifteen acceptances and the reconciliation in #3073 are unchanged.
