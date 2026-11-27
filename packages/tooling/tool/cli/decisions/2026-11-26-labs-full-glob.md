---
title: the Labs lane runs the full labs glob in CI and in local replay
date: 2026-11-26
reversal: Follow the reversal in goals/time-to-certainty/research/decisions.md Ruling 58.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
  - src/commands/Ci/CiLane.ts#ciLocalLaneFlags
enforcedBy: []
---

Anchor for goals/time-to-certainty/research/decisions.md Ruling 58 and goals/lab-apps-lifecycle P2 ratified row 10, which record the one bundled labs invocation with no `--affected` and its `--summarize` local replay.

The lane takes no `--affected` even though the pinned clients intersect the affected set with
positive filters; its contract is the full labs set.
