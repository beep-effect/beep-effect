# Model-First Standard

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Amend the architecture standard to the model-first four-package slice, retarget beep architecture to it, and enforce the grammar with checkers under a ratchet.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/model-first-standard/GOAL.md
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

P1 Implement — step 1 (doctrine) written and in review; step 2 (scaffolder) next.

## Latest Evidence

2026-11-18: the doctrine amendment to `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md` (entry 2026-11-18), the glossary and chapters 01, 10 and 13. Decisions and checkpoints are under [`decisions/`](./decisions/).

## Notes

Graduated 2026-11-17 from `explorations/model-first-slices` with `effect-cluster-host` and `authority-context` (D66). The
doctrine pull request comes first: the other two goals cite it. This goal supersedes
`goals/slice-topology-audit` (D65) and inherits two things from it: the doctrine rows that
`explorations/v3-consistency-audit` deferred to its first phase (read that packet's `DECISIONS.md`,
"deferred rows", and settle each against the four-package shape), and the dependent packet
`goals/canonical-proof-reconciliation`, which now waits on this goal.
