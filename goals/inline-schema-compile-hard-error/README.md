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

P2 verification is complete; P3 review and P4 closeout are in progress. The
implementation and package-proof identity repair are merged. The new full
local proof and all package verification passed. Closure still requires
publication of the final receipts and a terminal Yeet monitor verdict. The
final publication path awaits operator direction after PR #1028 merged before closeout.

## Latest Evidence

- The predecessor's 2,931 findings reproduce exactly. The opening tree had
  3,087 findings across 566 files and 105 ownership families; all +156 drift is
  attributed in [`research/opening-census.md`](./research/opening-census.md).
- The generator owner was updated first. All 3,087 opening findings reconcile
  to zero. Later mainline additions were also hoisted, including 20 repo-cli
  findings and the 67-call reconciliation across seven ownership families on
  2026-09-08. The refreshed
  [`residual census`](./research/residual-census.json) reports zero findings on
  the merged implementation, and `beep/no-inline-schema-compile` is an error.
- The [v2 package matrix](./research/package-verification.json) passed all 106
  owners in a clean worktree at `02d88af51c`, with committed tree
  `786d98065f3a3628599a4691e0314b5fb004bff3`. Its owner inventory has no missing,
  extra, or duplicate entries. The earlier local-settings failure is excluded
  from acceptance, as is the legacy report without committed-tree identity.
  Supplemental canonical verification for `@beep/freshbooks` and `@beep/effect-drizzle`
  covers the two additional owners found in the shipped implementation diff.
  Fresh HTML regeneration has no tracked diff; the lint-rule suite passes all
  66 tests.
- [PR #1019](https://github.com/beep-effect/beep-effect/pull/1019) shipped the
  migration. [PR #1022](https://github.com/beep-effect/beep-effect/pull/1022)
  shipped recursive schema-literal classification and complete environment
  proof hashing. All five review threads across those PRs are resolved.
- Full `bun run beep yeet verify --merged` passed all 33 reported lanes in
  43 minutes 35 seconds. The PR #1022 head, local preview, and squash merge
  share Git tree `6a9533d44b007cb26959789f22d7fa7768dc7615`. Hosted checks are
  green. [`research/closeout-evidence.md`](./research/closeout-evidence.md)
  records the commits, commands, results, and review links.
- The new PR #1028 merged-preview proof also passed: full tier, 34 reported
  lanes, recorded execution time 37 minutes 2 seconds. The preview and reviewed
  head share tree `786d98065f3a3628599a4691e0314b5fb004bff3`. Affected-package
  steps select no tasks for this goal-only diff; the separate owner matrix
  supplies the required package-level coverage.
- [PR #1028](https://github.com/beep-effect/beep-effect/pull/1028) shipped the
  proof-runner repair and retained the
  [reflection](./history/reflections/2026-09-08-codex.md). Its required hosted
  checks passed, but it merged before local verification finished. Three of
  its four review threads are resolved; the package-evidence thread remains
  open. The lifecycle remains active until final evidence and publication
  satisfy the remaining gates.

## Notes

This packet owns the repository-wide cleanup and hard-error promotion that was
explicitly excluded from `schema-utils-selective-codec-statics`.
