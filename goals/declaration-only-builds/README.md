# Declaration-Only Builds

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Library package builds emit declarations and declaration maps only: the Babel
`annotate-pure-calls` pass and JavaScript emit leave the generated build
script, and each package's source is type-checked once per run if the
check-program census proves build and check agree. Graduated from
[`explorations/build-pipeline-simplification`](../../explorations/build-pipeline-simplification/README.md)
on 2026-11-10.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/declaration-only-builds/GOAL.md
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

P0 Research, in progress. PR 1 (baseline and proof harness, no behaviour
change) is open. Next: PR 2, the declaration-only build, per
[`PLAN.md`](./PLAN.md).

## Latest Evidence

- [`research/2026-11-10-build-baseline.md`](./research/2026-11-10-build-baseline.md):
  across 181 emitting packages the compile takes 52.2 s serial and the Babel
  pass 66.4 s; JavaScript and its maps are 84.0 MB of a 228.6 MB `dist` total.
  A declarations-only compile is no faster than a full emit.
- [`research/2026-11-10-build-check-equivalence.md`](./research/2026-11-10-build-check-equivalence.md):
  2,912 build-versus-check comparisons over 182 packages, all identical, from
  a cache restore, warm and cold, with `TSRS_FAST` unset and `1`. Check-once
  is kept for the 180 packages whose check program is the build program.

## Notes

- Both measurements ran at load average 60 to 130. Ratios hold better than
  seconds; PR 2 re-measures with the same script.
- The check-once step survived PR 1's census. It is still the first thing
  cut if the appetite runs out.
- PR 2 invalidates every build cache entry once, and carries the stale
  `node_modules/.tmp` tsbuildinfo glob removal for that reason. Land it when
  the merge queue is quiet.
