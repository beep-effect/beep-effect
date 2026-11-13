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

P1 Implement, in progress. PR 1 (#3178, baseline and proof harness) is merged.
PR 2, the declaration-only build, is open. Next: PR 3 (check once) once its
Turbo edge is agreed with `goals/route-soundness-repair`, per
[`PLAN.md`](./PLAN.md).

## Latest Evidence

- [`research/2026-11-13-build-after.md`](./research/2026-11-13-build-after.md):
  before and after, back to back on one machine state. Serial build work of
  181 packages falls from 80.9 s to 32.9 s (59%); `dist` shrinks from 232.5 MB
  to 147.9 MB (36%); the compile itself is unchanged.
- [`research/2026-11-10-build-check-equivalence.md`](./research/2026-11-10-build-check-equivalence.md):
  2,912 build-versus-check comparisons over 182 packages, all identical, from
  a cache restore, warm and cold, with `TSRS_FAST` unset and `1`. Check-once
  is kept for the 180 packages whose check program is the build program.
- [`research/2026-11-10-build-baseline.md`](./research/2026-11-10-build-baseline.md):
  the first baseline, taken at higher load on an older compiler.

## Notes

- The declaration-only flag sits on the generated build command, not in
  `tsconfig.base.json`: the base option would break 404 no-emit overlays
  (TS5069).
- A package that needs JavaScript keeps it through `javaScriptBuildOverrides`
  in the scripts policy. The list is empty and so is the Exception Ledger.
- PR 2 invalidates every build cache entry once. Land it when the merge queue
  is quiet.
- The check-once step survived PR 1's census. It is still the first thing
  cut if the appetite runs out.
