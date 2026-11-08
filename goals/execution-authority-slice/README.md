# Execution Authority Slice

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give agent execution authority its own slice, then link each ontology Session
change to the decision that authorized it. Graduated from
[`explorations/execution-authority-home`](../../explorations/execution-authority-home/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/execution-authority-slice/GOAL.md
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

P1 Implement: the move (P1 of the SPEC acceptance) is in review; the `authorizedBy`
link (P2 acceptance) follows in its own PR.

## Latest Evidence

[`research/p1-move-evidence.md`](./research/p1-move-evidence.md): pre-move and post-move
observable-state recordings are identical once the declared prefix rename is mapped. A seeded
PGlite ledger migrates forward with its chain verifying, and the down-migration restores the
old names.

## Notes

- The proposal page that settled the design:
  https://claude.ai/artifact/44aEsMW1rTg1B7iRABvnRM (private to the operator).
- Next after P1 merges: open the epistemic slice direction grill (A: the claim
  store every slice writes to; B: split into reusable infrastructure).
