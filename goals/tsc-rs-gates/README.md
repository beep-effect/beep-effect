# Run the typecheck and build gates on tsc-rs

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move beep-effect's typecheck and build gates from the Effect-patched tsgo to tsc-rs (pingdotgg/ts-rust), keeping @effect/tsgo for editors; measured 3.7x faster at half the peak RSS with identical diagnostics on 2026-10-13.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/tsc-rs-gates/GOAL.md
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

Closed (completed-retained, 2026-10-14): P0 Research (PR #1670), P1 Implement and P2 Verify (PR #1675, hosted timings recorded), P3 Yeet (#1675 driven to mergeable under S11), P4 Close (`history/reflections/2026-10-14-claude.md`).

## Latest Evidence

- `research/measurements-2026-10-13.md`: tsc-rs 0.6.0 vs tsgo, 3.7× geomean faster on the check projects at half the peak RSS, identical diagnostics on 283 of 284 projects.
- The eleven upstream TypeScript 7.1-dev diagnostics (10 TS7031, 1 TS5088) are fixed in `@beep/repo-cli` and `@beep/utils` and verified green under tsgo 0.51.1, tsc-rs 0.6.0 and stock `typescript@7.1.0-dev.20261008.1` (PR #1670).
- P1 (this packet's swap PR): `tsc-rs` 0.6.0 pinned in the root catalog and held with `@effect/tsgo` in `syncpack.config.ts`; 151 manifests' `beep:build`/`beep:check`/`beep:check:tests` (+ scripts/stories/examples variants), the root `check:configs` and infra's `-b` build run `tsc-rs`; scaffold defaults, the typecheck-coverage parser and the single-project-emit law know `tsc-rs`; runbook rewritten.

## Notes

- Hosted `Heavy / Check` on the swap PR (#1675, head 5fbfa91c3c): the turbo `check` graph passed 265/265 on tsc-rs in 2m14.9s (tsgo baseline 7m39s); the job's one red is the Effect-compiler lane `quality:test-tsgo`, which still spawns `node_modules/.bin/tsgo` and reports `test/drawings-review.test.ts(388,37) TS2339: Property 'pipe' does not exist on type 'MarkupNote'`, a test that #1674 rewrote on main after this packet's merge-base (inherited; `MarkupNote.make(...)` returns the plain class instance, which is not Pipeable).
- `@effect/tsgo` and `tsc-rs` must move together: tsc-rs compiles a fixed Effect rule set in, and 0.51.1 fails the `tsgo-rules` gate on unknown severity keys, so 0.52 rules cannot be pre-registered.
- `--fast` must follow `-b`; a wrapper that prepends it breaks `tsc-rs -b`. Failure exit code is 2.
