# Main Verdict Every Commit

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver the prerequisites for a per-commit main verdict and raise the interim verdict rate without regressing
pull-request latency: forbid agent cancels of main runs, land a throughput layout for main push runs with a
published merge-timestamp replay, and re-dispatch missing verdicts. The per-commit verdict itself arrives as the
merge-group run under the gated `merge-queue-activation` candidate (operator ruling `verdict-placement`, D28).

Goal 3 of 6 from [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md);
requires [`certainty-scorecard`](../certainty-scorecard/README.md) (`ci/certainty-scorecard`) for its numbers,
provides `ci/main-verdict`: the landed throughput layout, which `merge-queue-activation` waits on; the published
merge-timestamp replay (D28); and the interim main verdict rate after the layout and re-dispatch.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/main-verdict-every-commit/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — complete 2026-11-13: slice 1 (the main cancel ban, HOST-01 a, #3111) landed 2026-11-10 and its command
guard (#3140) 2026-11-12; the scorecard field census, the re-run API facts and the pre-ban verdict read are recorded.
P1 is held under SPEC "Stop Conditions": `beep ci certainty` (#3118) reports the main verdict rate but not PR
first-wave pickup p95, heavy-wait p95, jobs per run or the main cancel actor, and no certainty-scorecard slice
builds them.

## Latest Evidence

- 2026-11-13: P0 facts. Decision `scorecard-field-census`: `CiCertaintyMainStat` and `CiCertaintyMainRow` carry
  the main verdict rate; pickup p95, heavy-wait p95, jobs per run, the cancel actor and the heavy identity per
  verdict are missing (`CI_CERTAINTY_NOT_COVERED`). Decision `rerun-api-cancelled-push-runs`: the re-run
  endpoint documents no conclusion restriction; whether a re-run re-enters the shared main group is
  undocumented, so re-dispatch stays idle-only. History note `2026-11-13-pre-ban-main-verdict-rate`: the
  2026-11-03..10 main verdict rate is 24.7% (70 of 283 non-docs commits; 213 cancelled), read after #3168 made
  the main listing read first; the earlier read was refused before that fix.
- 2026-11-13: two measured days of Check runs filed as
  [`research/2026-11-13-check-run-queue-day-measure.md`](./research/2026-11-13-check-run-queue-day-measure.md)
  (decision `check-run-queue-measurements`): hosted peak 60 on all three days, 70 hosted jobs and 44 test
  shards per full run, main pushes cancelled 14 of 20 and 11 of 20, almost all before their first job.
- 2026-11-12: #3140 enforces the ban in `yeet gh checks cancel-queued` and the merge gate (checkpoint
  `cancel-guard-in-commands`).
- 2026-11-10: slice 1 (#3111) adds the ban to the AGENTS.md Inherited-reds bullet and the orchestrate skill's
  Red check and Queue starved rows; its start date anchors the before/after verdict reads and the first
  zero-agent-cancel window (checkpoint `cancel-ban-start-anchor`).

## Notes

- Slice 1 landed 2026-11-10: no agent cancels a `refs/heads/main` run, queued or running. Slice 2 (the replay)
  waits on the scorecard fields it lacks: PR first-wave pickup p95, heavy-wait p95, per-run job counts and the
  main cancel actor (decision `scorecard-field-census`).
- Of HOST-01 only slice 1 (the cancel ban) has landed: the top-level `concurrency` block of
  `.github/workflows/check.yml` still groups main pushes per ref, and the `test-plan` job's `Publish partition
  plan` step still allocates every partition on a push.
- Order: cancel ban, then (with scorecard numbers) the merge-timestamp replay and the main throughput layout,
  then re-dispatch. No per-SHA concurrency groups here: that stage moved to `merge-queue-activation` in
  [`explorations/github-merge-queue`](../../explorations/github-merge-queue/README.md) (decision
  `per-sha-verdict-handed-to-merge-queue`). The 95% bar's remaining gap is recorded as that candidate's.
- Every workflow slice touches `.github/workflows/`: the orchestrator's App token cannot merge it, so the owner
  merges with the workflow-scoped user token pinned to the head SHA, and each slice names its revert.
