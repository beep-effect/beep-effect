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

Waves 1–6f merged (2,991 sites across #1968, #1976, #1983, #1987, #1993, #2008, #2001, #2015, #2026, #2012, #2011, #2013, #2018, #2014, #2010); wave 7 (#2027) migrates the last site, pins `@effect/tsgo` 0.55.0 and arms `preferEffectString` at error, proven by the zero-site census on its branch (see Latest Evidence). Closeout reflection: `history/reflections/2026-10-22-claude.md`.

## Latest Evidence

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
