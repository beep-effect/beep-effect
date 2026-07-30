# Effect Child-Process Hardening

## Status

Lifecycle: `active`

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

P3 in progress — implementation is isolated on
`feat/effect-child-process-hardening` from the latest `origin/main`; refreshed
local verification is green and publication is underway.

## Latest Evidence

[`research/2026-07-30-verification.md`](./research/2026-07-30-verification.md)
records the completed local proof and attributes the concurrent branch-wide
failures. [`research/2026-07-29-inventory.md`](./research/2026-07-29-inventory.md)
retains the source-backed pre-change baseline.

## Notes

- Native `Bun.spawn` and `node:child_process` consumers are outside this goal.
- Do not add a repo-wide child-process facade.
- Preserve unrelated worktree changes. Publication was separately authorized
  on 2026-07-30.
