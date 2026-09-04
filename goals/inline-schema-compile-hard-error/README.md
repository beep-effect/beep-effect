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

P2 Verify — in progress.

## Latest Evidence

- The predecessor's 2,931 findings reproduce exactly; current opening `HEAD`
  contained 3,087 findings across 566 files and 105 ownership families, with
  the +156 drift fully attributed.
- The generator owner was updated first, 3,087 findings reconcile to zero, and
  `research/residual-census.json` records the empty repository-wide result on
  the current post-merge implementation head.
- `beep/no-inline-schema-compile` is configured as an error. Focused policy,
  assertion, and manually migrated package tests are green. The 106-package
  owner matrix is green, and the post-merge `@beep/repo-cli` family was
  reverified after its newly introduced compilers were hoisted. The isolated
  1,000-file test-TSGo gate and `@beep/html` generated-output check are green.
  Exact-head Yeet verification remains in progress.

## Notes

This packet owns the repository-wide cleanup and hard-error promotion that was
explicitly excluded from `schema-utils-selective-codec-statics`.
