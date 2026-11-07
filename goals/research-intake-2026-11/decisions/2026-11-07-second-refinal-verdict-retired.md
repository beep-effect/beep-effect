---
title: "second goals-only re-final: the #2904 gating verdict was retired with its lane"
date: 2026-11-07
kind: checkpoint
pullRequest: 2904
reversal: "Point proposedCloseout.finalPullRequest back at #2904 and drop this checkpoint"
---

#2904 merged on a merge-ready until-ready monitor (job 08aa6339) at eedcff79d9, but its lane was retired with `yeet sweep --retire` before `goals completion refresh` ran. The gating yeet verdict and the monitor's canonical status.json lived only in that lane's ignored yeet runs directory, so the refresh cannot read a head-bound verdict and reports unknown. This second re-final becomes the final pull request, with #2892 and #2904 as supporting. Its lane stays in place until the refresh prints verified.

Recovery for this re-final: record the full until-ready monitor job UUID outside the PR (the orchestrator thread and the PR's final comment), let that job print merge-ready before the merge, and after the merge run `bun run beep goals completion refresh --slug research-intake-2026-11 --readiness-job <uuid>` from this retained lane until it prints verified.
