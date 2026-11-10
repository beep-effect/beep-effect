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

P0 Research — in progress: slice 1 (the main cancel ban, HOST-01 a) landed 2026-11-10; the remaining P0 facts and slice 2 wait on the certainty scorecard's numbers.

## Latest Evidence

- 2026-11-10: slice 1 `docs(agents): never cancel refs/heads/main runs` adds the ban to the AGENTS.md
  Inherited-reds bullet and the orchestrate skill's Red check and Queue starved rows. No scorecard is on `main`
  yet, so the ban's start date is recorded as the anchor for the before/after verdict reads and the first
  zero-agent-cancel window (checkpoint `cancel-ban-start-anchor`).

## Notes

- Slice 1 landed 2026-11-10: no agent cancels a `refs/heads/main` run, queued or running. Slice 2 (the replay)
  waits on the scorecard's main verdict rate, per-run job counts, PR first-wave pickup and heavy wait.
- Of HOST-01 only slice 1 (the cancel ban) has landed; at c90929b1ff1 (decision `host-01-open-push-runs-still-full`):
  `.github/workflows/check.yml` lines 12 to 14 still group main pushes per ref, and a push still allocates
  every partition.
- Order: cancel ban, then (with scorecard numbers) the merge-timestamp replay and the main throughput layout,
  then re-dispatch. No per-SHA concurrency groups here: that stage moved to `merge-queue-activation` in
  [`explorations/github-merge-queue`](../../explorations/github-merge-queue/README.md) (decision
  `per-sha-verdict-handed-to-merge-queue`). The 95% bar's remaining gap is recorded as that candidate's.
- Every workflow slice touches `.github/workflows/`: the orchestrator's App token cannot merge it, so the owner
  merges with the workflow-scoped user token pinned to the head SHA, and each slice names its revert.
