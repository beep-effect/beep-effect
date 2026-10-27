# Run the typecheck and build gates on the Effect-patched tsrs

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Replace tsc-rs with the Effect-patched tsrs that @effect/tsgo 0.59.0 ships, so one compiler gates TypeScript errors and every Effect rule, and the standalone Effect Diagnostics lane can fold into Check.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/tsrs-gates/GOAL.md
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

PR 1 (#2260, ready, final a36dfffa74) swapped the gates; hosted Heavy / Check 3m36s and Heavy / Build 2m23s on tsrs. PR 2 (`feat/tsrs-gates-fold`, stacked on PR 1) folds the standalone Effect Diagnostics lane into Check.

## Latest Evidence

- `research/measurements-2026-10-26.md`: the Effect-patched tsrs (tsrs
  0.20.0-ts7.1.0-beta from `@effect/tsgo` 0.59.0) matches tsc-rs 0.8.0's
  diagnostics on all 181 check projects and infra's `-b` build at lower wall
  time, and knows all eleven standalone-profile rules (tsc-rs printed eleven
  TS377134 warnings).
- `research/cache-baseline-review-2026-10-26.md`: the reviewed re-record of the
  cache-qualification baseline for the compiler-word and root-manifest change.

## Notes

- Upstream: Effect-TS/tsgo PR #901 (merged 2026-10-24) is the 1:1 Rust port of
  the language service on oxc-project/tsrs; `@effect/tsgo` 0.59.0 (2026-10-26)
  ships the build and the `effect-tsgo tsrs` proxy. `tsrs` (npm, oxc-project) is
  a different project from `tsc-rs` (npm, pingdotgg/ts-rust) that ran the gates
  from 2026-10-14.
- The packaged tsrs build exists for linux-x64, linux-arm64 and darwin-arm64;
  `prepare` fails on win32 and darwin-x64 until upstream ships those.
- PR 2 folds `standards/effect-diagnostics.profile.json` into
  `tsconfig.base.json` and the copied profiles, flips the three
  `ignoreEffect*InTscExitCode` flags to false, and deletes the standalone lane
  (CLI command, CI lane, final-check gate, hosted matrix job). The full check
  graph passed with every rule gating on 2026-10-27. Ruleset 10240248 drops the
  `Heavy / Effect Diagnostics` required context at PR 2's merge.
