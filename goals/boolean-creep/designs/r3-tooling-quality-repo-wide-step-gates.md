# Instance

- id: `r3-tooling-quality-repo-wide-step-gates`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:780`
- symbol: `shouldRunRepoWideSteps`
- members: `shouldRunRepoWideSteps`, `shouldRunLintRepoWideSteps`
- evidence: E4 at `Tasks.ts:780-782` — lint-wide is enabled only when none of
  `--affected`, `--filter*`, or `--since*` is present, while the general
  repo-wide steps exclude only filters/since. Lint-wide therefore implies
  general repo-wide, and the fourth boolean pair is unreachable.

# Current shape

Two private predicates repeatedly scan the same caller-visible Turbo arguments.
General check extras run for unscoped and affected invocations, while root lint
policy runs only for unscoped invocations. An explicit filter or since scope
disables both. This three-way command scope is flattened into two enablement
bits and interpreted at five reader sites.

# Cardinality gap

Four boolean pairs are representable and three modes are legal:
`unscoped` enables both families, `affected` enables only the general repo-wide
checks, and `explicit-scope` enables neither. General false with lint true is
impossible.

# Target schema

Define a private named `QualityRepoWideStepMode` LiteralKit with `unscoped`,
`affected`, and `explicit-scope`, using the narrow
`@beep/schema/LiteralKit` import. Classify caller-visible args once with explicit
`--filter*`/`--since*` precedence, then exact `--affected`, then unscoped. Add a
single derived membership decision over this owner: general repo-wide steps run
unless the mode is `explicit-scope`; lint-wide policy runs only for `unscoped`.
Do not store new booleans or confuse this domain with coverage scope or the
independently handled lint-fix intent.

# Migration inventory

- `Quality/Tasks.ts:573-578,780-782` — replace
  `isExplicitTurboScopeArg`, `isExplicitTurboAffectedOrScopeArg`, and both
  should-run predicates with the named literal owner/classifier. Preserve exact
  prefix matching for `--filter` and `--since` and exact matching for
  `--affected`.
- `Quality/Tasks.ts:837-841` — update the ownership comment: the implicit labs
  exclude is still appended after classification and must never turn an
  unscoped or affected caller invocation into `explicit-scope`.
- `Quality/Tasks.ts:2227-2244` — classify once in `rootCheckSteps` and use the
  same mode for all three `check:tsgo:*` optional steps.
- `Quality/Tasks.ts:2490-2501` — make `rootLintPolicySteps` consume the mode
  while preserving the independent `fix` short circuit.
- `Quality/Tasks.ts:2503-2537` — classify the final caller-visible lint args
  once for the direct runner and preserve the current single-step versus
  concurrent group behavior.
- `test/quality-tasks.test.ts:2080-2107,2235-2308,5145-5211,
  5332-5434` — retain current check/lint/labs assertions and add the
  full mode/precedence matrix through `rootQualityStepsForTesting`.
- Source/barrel search found no external consumer of the private predicates;
  existing exported task planners and command interfaces do not change.

# Guard-deletion accounting

Delete both should-run boolean helpers, the affected-or-scope boolean helper,
their repeated `A.some` scans and negations, the three repeated general checks,
and the two repeated lint-wide negated guards. One literal classification per
planner path owns the implication; any enablement boolean passed to
`optionalQualityTaskStep` is a one-expression projection from that literal.

# Encoded-side impact

None. The literal is private derived state. CLI arguments, conflict errors,
Turbo argv ordering, labs exclusion placement, step labels, command grouping,
fix behavior, dry JSON output, and exit semantics remain byte-compatible.

# Test impact

Table-test check and lint planning for no scope, `--affected`, `--filter=...`,
`--since=...`, affected plus filter, affected plus since, and both filter and
since. Prove the three tsgo extras survive affected mode, all repo-wide extras
drop for explicit scope, lint policy runs only unscoped, lint fix never adds
policy, and the generated labs exclude does not affect classification. Retain
exact step labels/argv assertions and the hosted concurrency execution test.
Run focused quality-task tests and full `@beep/repo-cli` package verification
with the required patch changeset.

# Risk and sequencing

Land in Tier 1E. Explicit filter/since must dominate `--affected` when combined,
and classification must occur before repository-owned filters are appended.
The coverage selection and lint-fix domains remain independent.
