---
title: Labs runs its full glob, and Storybook answers its affected shape with one Turbo dry run
date: 2026-11-26
reversal: Run Labs with --affected, and gate Storybook on a workflow path profile.
governs:
  - src/commands/Ci/CiLane.ts#ciLaneStepsForTesting
  - src/commands/Ci/CiLane.ts#runCiLane
  - src/commands/Ci/CiLane.ts#ciLaneDispatchStep
enforcedBy: []
---

Labs (lab-apps-lifecycle P2, ratified row 10) is one bundled Turbo invocation over the labs glob with deliberately no `--affected`: its contract runs the full labs set, even though the pinned clients intersect the affected set with positive filters. The workflow path gate scopes pull requests, while push and local replays want the full set. check.yml runs `ci lane labs --summarize` over the full set, so local replay omits the affected shape too and passes `--summarize`, which folds the lab check, lint and test task hashes into the lane digest (TTC ruling 58).

Storybook (quality-lane audit D13, revised for PR #1054 review) is one positively filtered build, the browser test run, then the static-artifact proof storybook.yml uploads. A path profile cannot see the workspace graph, so a change under packages/foundation/modeling/* that reached @beep/ui and its stories used to skip the lane. Turbo owns that graph: `--affected` intersected with the positive filter selects @beep/storybook#storybook:build exactly when its dependency closure (or a global input) changed against TURBO_SCM_BASE. That dry-run probe answers the affected shape once, then the lane runs whole, so the execution argv carries no `--affected`; storybook.yml keeps only the goals_only gate, so pull request and local replays skip the same change sets.

check.yml gives every Turbo-backed matrix lane `--summarize` as well as the affected shape. It only writes gitignored `.turbo/runs/*.json` receipts, so the local replay passes it too and the dispatched argv stays identical to the hosted one.

Rejected: an affected Labs run (misses the lane's full-set contract); a Storybook path profile (the skipped transitive changes above).
