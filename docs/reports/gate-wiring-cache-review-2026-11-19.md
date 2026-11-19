# Cache review for the gate wiring (2026-11-19)

Branch `feat/gate-report-wiring` (gate-report-core P3 and P4). Reviewer: Claude Fable 5.2 (goal
driver).

`bun run beep cache audit` reports 1,794 blocking findings: `configuration-drift` on 213 subjects
(the root and 212 packages) and `unreviewed-expansion` on the eight tasks of the new
`@beep/repo-gate-vitest` package.

## Cause

Three changes, all deliberate.

1. **The generated package check.** The scripts writer changed the `check` script of every
   non-infra package from the probe followed by the compiler script to `beep-cli gate run check`,
   one slim entry that probes, runs the same compiler script, writes the check record and prints
   the gate console. A package's scripts digest is part of every task's configuration, so every
   task of every rewritten package drifts, cached or not. The compiler script itself (`beep:check`)
   is unchanged.
2. **Task outputs and dependencies.** In `turbo.json`, `test` declares `.beep/gates/test/**` and
   `check` declares `.beep/gates/check/**` as outputs, so a cache hit restores the gate record and
   its log. `test` depends on `@beep/repo-gate-vitest#transit` and `check` on
   `@beep/repo-gate-record#transit`, so the code that writes a cached record is in the task hash.
   The inputs of both tasks already exclude `.beep/**`, so a record never feeds its own hash.
3. **A new package.** `@beep/repo-gate-vitest` was created with `bun run beep create-package`; its
   tasks are new subjects with the generated test-kit scripts.

The policy fingerprint writer also regenerated the input lists of its seal tasks for the new
sources.

## What a cache hit now does

A hit on `test` or `check` restores the record and log beside the Turbo log. The console is
rendered from the restored record, which keeps its original run id, and is byte-identical to the
miss that wrote it (checked with `cmp` on `@beep/glob` for both tasks).

## Decision

Record all 215 subjects (the 214 above and `@beep/eyecite`, whose tasks are not cached and so drift without a blocking row). No task's command semantics, environment entries or cache flags change
beyond the three items above, and no qualification is granted.
