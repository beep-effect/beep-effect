# Effect Child-Process Hardening

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make every in-scope `effect/unstable/process` consumer own its process lifetime,
stdio, exit status, timeout escalation, and platform layer explicitly while
restoring the repo CLI's existing `StepExec` / `GitExec` boundary.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-child-process-hardening/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/2026-07-29-inventory.md`](./research/2026-07-29-inventory.md) -
   pre-change inventory and audit findings.
6. [`research/SOURCES.md`](./research/SOURCES.md) - source and provenance ledger.

## Current Phase

Complete. P0 through P4 are done. The implementation is rebased onto current
`origin/main` and is delivered by
[PR #509](https://github.com/beep-effect/beep-effect/pull/509). The full local
Yeet proof is green; the hosted implementation-head matrix is green after
retrying one unrelated five-second test timeout.

## Latest Evidence

[`research/2026-07-30-verification.md`](./research/2026-07-30-verification.md)
records the clean-worktree local proof, publication, hosted retry attribution,
and current-main rebase. [`research/2026-07-29-inventory.md`](./research/2026-07-29-inventory.md)
retains the source-backed pre-change baseline.

## Notes

- Native `Bun.spawn` and `node:child_process` consumers are outside this goal.
- Do not add a repo-wide child-process facade.
- The unrelated shared checkout was preserved. Publication was separately
  authorized on 2026-07-30 and completed from the isolated feature worktree.
