# P4 docs-side closeout

Date: 2026-07-14

## Retained outcome

P0 (CI-lane inversion) and P1 (property-law lane), shipped through merged PRs
#321–#336, are the retained packet deliverable. P2 and P3 are recorded
`wont_fix` deferrals in `ops/progress.json` and `tasks/tasks.jsonc` until CI
round-trips measurably bottleneck delivery (median PR requires more than one
CI round).

## Verification Matrix evidence pointer

- P0 lane fidelity, local verdict parity, and single-sourced lane inventory:
  [`p0-parity-evidence.md`](./p0-parity-evidence.md).
- P1 property catch, run floors, fixed-seed PR lane, and nightly sweep:
  [`p1-property-lane-evidence.md`](./p1-property-lane-evidence.md).
- Dogfood rounds, including root-cause and local-catch evidence for PRs that
  required more than one CI round: [`../ops/progress.json`](../ops/progress.json).
- Required reflection:
  [`reflections/2026-07-14-codex.md`](./reflections/2026-07-14-codex.md).

The Verification Matrix rows owned by deferred P2/P3 work are not claimed as
green; their terminal disposition is the recorded deferral, not implementation.

## Property-lane required-check non-flip

The property lane remains non-required. The P4 admin flip in the original
Definition of Done was not executed and is recorded `wont_fix` until the same
CI-bottleneck trigger is met. This closeout does not claim that ruleset
10240248 includes the property-lane context.
