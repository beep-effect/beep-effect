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

P0 Research, not started. First action: PR 1 (baseline and proof harness, no
behaviour change), per [`PLAN.md`](./PLAN.md).

## Latest Evidence

Not started.

## Notes

- The numbers this packet starts from were taken at load average 59 to 63.
  Re-measure before quoting them as a baseline.
- The check-once step is conditional on PR 1's census result and is the first
  thing cut.
- PR 2 invalidates every build cache entry once. Land it when the merge queue
  is quiet.
