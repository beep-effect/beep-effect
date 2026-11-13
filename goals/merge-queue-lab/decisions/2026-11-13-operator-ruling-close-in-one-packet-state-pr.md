---
title: "Operator ruling: close the goal in one packet-state PR without the earlier finals' readiness receipts"
date: 2026-11-13
lane: "docs/merge-queue-lab-closeout"
reversal: "Run goals set-status merge-queue-lab active, which turns the closeout record back into a proposal; delete that proposal if the goal reopens for work"
---

Final #3112 merged five seconds after its ready flip (2026-11-10 07:33:53Z), and re-final #3146 was flipped ready at 2026-11-13 00:29:31Z and merged at 00:52:37Z, inside its review window. Neither until-ready monitor recorded merge-ready, so `goals completion refresh --slug merge-queue-lab --readiness-job 267213f0-bdea-4f6e-942c-27dea16293f5` reads unknown. A second re-final, #3162, was opened and is closed unmerged.

Asked on 2026-11-13 how the goal should close, the operator chose "Rule it closed": one PR sets completed-retained with this decision file, #3162 closes unmerged, and goals doctor keeps one advisory for the missing receipt. The operator confirmed the early merges were his own hand-merges to keep the queue moving.

So this PR is both the final PR and the packet-state PR (the one-PR closeout route). It removes the proposal, sets completed-retained, marks P3 complete and records the closeout with itself as the final pull request.

Evidence that the work itself is complete: the driver PR #3072 and findings PR #3112 are merged, every Observations row has a finding in `research/findings.md`, the go verdict is in `decisions/2026-11-10-verdict-go.md` and `explorations/github-merge-queue/DECISIONS.md`, synthetic PRs are closed, and the reflection is in `history/reflections/2026-11-10-claude.md`.
