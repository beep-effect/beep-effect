# Heavy Pool Diet

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Cut heavy-pool occupancy and the admission chain on code PRs without reducing proof depth: Lint Policy drops
its duplicate JSDoc chain and runs the knowledge doctor abreast, required heavy lanes start first, heavy route
skips are decided before a Spot VM boots, and Heavy Admission runs from a closure-pinned CI binary kept current
by reviewed pin-bump PRs. Graduated 2026-11-09 from
[`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md) (MAP goal 4,
rulings D5, D11 and D19).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/heavy-pool-diet/GOAL.md
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

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

- Already landed: LINT-01 (`noResolve` JSDoc inventory) and all five LINT-04 checker families, both in #3019
  (027664ba178). Open #3041 carries LINT-02 slice 1 (knowledge doctor abreast of the medium graph); it is not
  landed until it merges. Per D26 the goal keeps their unpaid gate items (two missing LINT-01
  fixtures plus noResolve parity, the LINT-04 per-family checks, the LINT-02 A/B) and their scorecard readings.
- First slice: `ci: delete the dead coverage-rollout probe` (PERIH-01 slice 1, S). It removes the probe,
  `legacy_integration`, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion.
  COVE-08 (`route-soundness-repair`) owns making the Coverage Regression name a literal. Whichever of the two
  lands second deletes `legacy_coverage` (set to 'false' meanwhile) and merges `main` first. The PERIH-11 closure-digest
  release trigger and the first, additive HOST-06 PR can open beside it.
- Order: LINT-05 after #3041 merges (both edit the Lint Policy task lists in
  `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`). The CI binary chain is closure-digest trigger,
  then reviewed pin-bump PRs (PERIH-11), then base-ref patterns (PERIH-10, owned by `route-soundness-repair`),
  then the binary admission switch. Each binary change is three PRs (CLI, pin bump, workflow switch); each
  `.github/workflows/heavy.yml` change is two, because `.github/workflows/check.yml` calls it at `@main`.
- HOST-08 waits for the Test Unit layout owned by `ci-lane-economics` to reach steady state; it changed
  again in #3043 and #3046, and its ROUT-01 dependency is met (#3030).
- HOST-06 is this goal's job-removing lever; since D28 its consumers are `merge-group-parity` and the gated
  `merge-queue-activation` in `explorations/github-merge-queue` (parity waits on this goal merging; activation
  waits on parity).
- The capacity question (a cap above 2, a larger runner class) is money and is not this goal's to open: the
  certainty scorecard's post-diet heavy-queue p95 goes to the operator.
- At most three open PRs across the packet.
