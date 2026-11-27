---
title: the Storybook lane answers its affected shape with one Turbo dry run, then runs whole
date: 2026-11-26
reversal: Gate Storybook on a storybook.yml path profile and drop the dry-run probe.
governs:
  - src/commands/Ci/CiLane.ts#CI_LANE_DESCRIPTORS
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
  - src/commands/Ci/CiLane.ts#storybookAffectedProbeArgs
  - src/commands/Ci/CiLane.ts#runCiStepLane
  - src/commands/Ci/CiLane.ts#ciLocalLaneFlags
enforcedBy: []
---

The Storybook lane is one positively filtered build, the browser test run, then the static-artifact proof storybook.yml uploads; storybook.yml keeps only the goals_only gate, the Playwright browser cache and the artifact upload.
A path profile cannot see the workspace graph, so a change under packages/foundation/modeling/* that reaches @beep/ui and its stories would skip the lane.
`--affected` intersected with the positive filter selects @beep/storybook#storybook:build exactly when its dependency closure (or a global input) changed against TURBO_SCM_BASE.
That dry-run probe answers the affected shape once, then the lane runs whole, so the execution argv carries no `--affected`, and pull request and local replays skip the same change sets.

Rejected: a workflow path profile, which skips transitive workspace changes.
