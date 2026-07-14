# Lint Advisory Hardening

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make root lint advisory output actionable by eliminating the current nonfatal
backlog, hardening false-positive-prone checks, and promoting root lint
warnings/advisories to failures in local and PR quality paths.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lint-advisory-hardening/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - completed historical execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`tasks/tasks.jsonc`](./tasks/tasks.jsonc) - completed implementation queue.
6. [`research/`](./research/) - supporting inventories.
7. [`history/`](./history/) - evidence and closeouts.

## Current Phase

P3 Close reconciled. The implementation already shipped: `beep lint policy`,
the dedicated CI lane, hardened checkers, and the zeroed advisory inventory are
present at HEAD. This packet's closure rides the portfolio-consolidation PR;
that PR's own verify lane is the final P2 evidence before the external driver
applies the completed-retained status flip.

## Latest Evidence

[`research/current-lint-advisory-inventory.md`](./research/current-lint-advisory-inventory.md)

Closeout reflection:
[`history/reflections/2026-07-14-codex.md`](./history/reflections/2026-07-14-codex.md)

## Notes

- V1 scope is root `bun run lint` policy only.
- Fallow advisory lanes are related future work and intentionally out of scope.
- PR CI needs a dedicated unscoped policy lane because affected lint skips
  repo-wide policy checks.
