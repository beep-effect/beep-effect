# effect/String migration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move native String method calls to effect/String so @effect/tsgo 0.55+ can arm preferEffectString at error

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-string-migration/GOAL.md
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

Implementation waves 1–7 are merged, including the arming PR [#2027](https://github.com/beep-effect/beep-effect/pull/2027).
The packet remains active: its original completion proposal does not have verified
merge-time readiness. The [fresh closeout PR #2318](https://github.com/beep-effect/beep-effect/pull/2318)
is requalifying the current Check graph and will supply its exact-head Yeet verdict. The original
2026-10-22 reflection is retained as historical implementation evidence; the
[2026-10-28 reflection](history/reflections/2026-10-28-codex.md) records the
completion audit.

## Latest Evidence

### Completion audit, 2026-10-28

At closeout base `d3c684edea26987cea6384b296d86960b0bb5d1a`, the catalog pins
`@effect/tsgo` 0.59.0. The installed Effect-patched tsrs identifies that build.
`preferEffectString` is `error` in the root map and all four copied profiles.
The rule-map audit and reflection validation passed in the owning clone; they
will be rerun on the final closeout head. A fresh repo-wide Check remains required.

`bun run beep goals completion refresh --slug effect-string-migration`
returned `unsatisfied` for #2027. GitHub's merge-push rule suite
`4660857638`
recorded a required-status-check bypass; required checks were still pending at
merge. The declared local Yeet verdict was unavailable. These historical facts
are retained, not waived or relabelled as a passing completion gate.

The [hosted diagnostics job](https://github.com/beep-effect/beep-effect/actions/runs/39760243138/job/119763331111)
on accepted head `5249b167984da46755522915418cc2a34cd7c3aa` checked 375 projects
and 90,238 file visits. It reported only seven `preferEffectArray` findings and
zero `preferEffectString` findings. This proves the historical String census,
not current repo-wide Check or pre-merge readiness.

### Historical implementation census

Zero-site census, 2026-10-22, on the wave 7 branch at `fe7bc21218`: main at
`b7c85da54c` (#2026, the last site wave) plus the final epistemics fix, with
`@effect/tsgo` 0.55.0 installed and `preferEffectString` at error.
the retired quality effect-diagnostics command (--concurrency 4) checked 375 projects
(90,238 file visits) and reported 0 `preferEffectString`. The only findings
left are 7 inherited `preferEffectArray` sites in
`packages/drivers/duckdb/test/shared/SqlEventLogServerUnencryptedStorageTest.ts`
(#1962).

Earlier censuses: `research/census-2026-10-21.md` (1,413 sites before the
effected promotions) and `research/census-2026-10-22.md` (1,730 remaining
after them).

## Notes

Spun out of the `@effect/tsgo` 0.54.1 bump (branch `chore/effect-tsgo-055`),
which held the pin below 0.55 until wave 7 (#2027) armed the rule.
