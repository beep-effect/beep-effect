# Inline Schema Compiler Hard Error

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Eliminate the remaining inline Schema compiler calls and promote
`beep(no-inline-schema-compile)` from warning to error.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/inline-schema-compile-hard-error/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - opening evidence and
   provenance.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started.

## Latest Evidence

- The predecessor census closed with 2,931 remaining
  `beep(no-inline-schema-compile)` findings, down from its 2,935 opening
  baseline.
- The predecessor left no warning on a touched line and removed its named
  `ProvRdf.ts` inline compiler.
- The packet was compiled from the repository's `standard-delivery` bootstrap
  archetype on 2026-08-30 with no conflicts.

## Notes

This packet owns the repository-wide cleanup and hard-error promotion that was
explicitly excluded from `schema-utils-selective-codec-statics`.
