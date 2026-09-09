# Inline Schema Compiler Hard Error

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Eliminate the remaining inline Schema compiler calls and promote
`beep(no-inline-schema-compile)` from warning to error.

## Launch

Retained launcher for provenance; this completed packet is not an execution queue:

```text
/goal follow the instructions in goals/inline-schema-compile-hard-error/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - completed execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - opening evidence and
   provenance.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

This closeout changeset completes P0 through P4 and retains the packet as
implementation and verification history. The compiler migration, hard-error
promotion, review corrections, and all 108 package-owner verifications are
complete. The final lifecycle update and validated reflection are included
together, resolving the missing packet-state change identified in
[PR #1042's P1](https://github.com/beep-effect/beep-effect/pull/1042#discussion_r3966538923).

The operator authorized this successor on 2026-09-09 after #1042 merged
before its packet update. It is published from
`codex/inline-schema-lifecycle-closeout`. The completed-retained state is the
state this PR will land, not a claim that its own publication has already
passed. Merging remains held until its final head passes canonical local and
hosted verification, all review comments are addressed, and Yeet reports
`merge-ready: yes`. Final-head receipts and thread resolutions belong to that
PR and Yeet's run artifacts; the historical receipts below keep their original
identities. The agent will not merge the PR.

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
  The primary matrix explicitly links their
  [structured canonical receipts](./research/package-verification-supplemental.json).
  The receipt test decodes both report formats and checks all 108 owners,
  matching heads, and complete successful audit/docgen steps.
  Its expected owners come from the independent
  [implementation-diff inventory](./research/implementation-owner-inventory.json),
  captured from all files in merged PRs #1019, #1022, and #1028.
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
  checks passed, but it merged before local verification finished. All four
  review threads are resolved; the final
  [package-evidence reply](https://github.com/beep-effect/beep-effect/pull/1028#discussion_r3964829818)
  links the pushed receipts. The packet remained active after that merge
  because publication and terminal monitoring were still outstanding.
- The [September 9 reflection](./history/reflections/2026-09-09-codex.md)
  supplements the earlier account with the completed proofs, the full owner
  inventory, and the remaining publication gate.
- The full Yeet publication of `59bba09125` passed all 67 reported lanes,
  including all 23 local CI-parity stages, and pushed that commit. The reusable
  proof state and lane receipts pin its correct identity despite the verdict
  header retaining the invocation's starting SHA. The closeout audit records
  the tested merge preview and the receipt-consistency limitation.
- PR #1042 merged with head `bba3d0aa8b` before its packet-state update. All 23
  CI-parity stages later passed on preview `6d62d85e73`, but the outer publish
  exited 1 after detecting the agent's new incident notes. The
  [closeout audit](./research/closeout-evidence.md) separates the passing
  checker evidence from the failed publication and the packet-closeout P1.
  This successor includes the missing lifecycle and phase-state correction
  before publication; it does not relabel the failed run as successful.

## Notes

This packet owns the repository-wide cleanup and hard-error promotion that was
explicitly excluded from `schema-utils-selective-codec-statics`.
