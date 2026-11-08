---
title: "third goals-only re-final: #2912 merged before its readiness monitor ran"
date: 2026-11-08
kind: checkpoint
pullRequest: 2912
reversal: "Point proposedCloseout.finalPullRequest back at #2912 and drop this checkpoint"
---

#2912 was merged by hand at 2026-11-07T23:57:08Z at 556416d5f1, inside its review window and before final-check or an until-ready monitor finished on that head. Its required checks verify, but the gating yeet verdict has no merge-ready result and no monitor job exists to recover one, so `goals completion refresh --slug research-intake-2026-11` stays unknown. This re-final becomes the final pull request, with #2892, #2904 and #2912 as supporting. Recovery: record the full until-ready monitor job UUID in the orchestrator thread and the PR's final comment, merge only after that job prints merge-ready, then run the refresh with that UUID as the readiness job from this retained lane until it prints verified.
