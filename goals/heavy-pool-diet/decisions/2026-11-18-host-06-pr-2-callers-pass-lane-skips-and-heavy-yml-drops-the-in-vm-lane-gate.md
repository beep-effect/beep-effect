---
title: "HOST-06 PR 2: callers pass lane_skips and heavy.yml drops the in-VM lane gate"
date: 2026-11-18
kind: checkpoint
lane: "perf/heavy-pool-diet-retire-migration-names"
reversal: "Revert this PR's squash commit: the callers stop passing lane_skips and heavy.yml decides goals-only and Docgen in the VM again"
---

PLAN slice 6, the second of the two `heavy.yml` PRs. Slice 3 (#3302, f12ebdb207) merged on 2026-11-18 and `main` resolves it: Check run 44235892259 on f12ebdb207 called `heavy.yml@main` at f12ebdb207, started Check, Docgen, Doctest and Build together, and created Lint Policy at 04:22:15Z, the moment Docgen (the last of its `needs`) completed.

Slice 3 kept no migration job name. Its design call added the `lane_skips` input and renamed no job, so every lane job kept its literal name. The transitional surface it left was the decision, not a name: callers exposed `lane_skips` without passing it, and the in-VM `Determine lane execution` step stayed the decider for goals-only and Docgen. This slice retires that surface.

- `check.yml` and `heavy-admit.yml` pass `lane_skips: ${{ needs.admission.outputs.lane_skips }}` to `heavy.yml@main`.
- `heavy.yml` drops the `Determine lane execution` step, every `steps.lane-gate.outputs.should_run` step guard and the `Skip lane` step from the shared lane steps (`verify`, `check`, `docgen`, `doctest`, `build`). Each branch of that step is now decided at job level: `inputs.admitted` (already in every job `if`), the pull request route skip (job level since #3302), and goals-only and Docgen (Heavy Admission's `lane_skips`). On a push, the in-VM change profile was always the full profile, so it never skipped, and `decideHeavyLaneSkips` returns nothing for a push either. The behaviour is the same on every event.
- `route_receipt` and `lane_skips` stay declared on `heavy.yml`. Both callers run on `pull_request` events from the pull request's merge commit, so any run after this merges carries the new caller. A run whose workflow file predates this PR (a re-run of an old attempt, or a conflicted pull request with no fresh merge commit) still passes `route_receipt` and not `lane_skips`: removing the input would make that run invalid, and the missing `lane_skips` only makes its goals-only or Docgen-irrelevant lanes run instead of skip. That costs runner time, never a missing check.

No job is renamed or removed, so the ruleset parity ledger (`ci-runner-security.test.ts`, every required `Heavy / *` context in `standards/branch-protection-contexts.json` mapping to one literal-named job) is unchanged, and none of ruleset 10240248's 15 required contexts changes. The tests that pinned the in-VM gate now pin its absence, and both callers' `lane_skips` wiring.
