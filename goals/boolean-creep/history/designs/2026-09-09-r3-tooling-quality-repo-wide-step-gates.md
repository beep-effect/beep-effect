# Instance

- id: `r3-tooling-quality-repo-wide-step-gates`
- source: `05405bf322da0ca7eb88b8bb402145081e8fded6`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:779`
- symbol: `shouldRunRepoWideSteps`
- members: `shouldRunRepoWideSteps`, `shouldRunLintRepoWideSteps`
- evidence: E4 at `Tasks.ts:779-781` — lint-wide is enabled only when none of
  `--affected`, `--filter*`, or `--since*` is present, while general repo-wide
  checks exclude only `--filter*`/`--since*`. Lint-wide therefore implies
  general repo-wide, so `(repoWide: false, lintWide: true)` is unreachable.

# Current shape

Two private boolean projections repeatedly scan the same caller-visible Turbo
arguments. General check extras run for unscoped and affected invocations,
while root lint policy runs only for unscoped invocations. An explicit filter
or since scope disables both. This three-way command scope is flattened into
two enablement bits and interpreted at five expressions: three tsgo-step gates
in `rootCheckSteps`, the planned lint-policy gate, and the direct lint runner's
concurrency gate.

The lower-level `isExplicitTurboScopeArg` and
`isExplicitTurboAffectedOrScopeArg` predicates are shared infrastructure, not
owned by this instance. They also serve workspace task filtering, coverage
planning/validation, integration-test planning, and other Turbo-argument
parsers.

# Cardinality gap

Four boolean pairs are representable and three modes are legal:
`unscoped` enables both families, `affected` enables only the general repo-wide
checks, and `explicit-scope` enables neither. General false with lint true is
impossible. When `--affected` is combined with `--filter*` or `--since*`, the
explicit scope takes precedence and the mode is `explicit-scope`.

# Target schema

Define a private annotated `QualityRepoWideStepMode` `LiteralKit` with
`unscoped`, `affected`, and `explicit-scope`, using the narrow
`@beep/schema/LiteralKit` import. Add the standard Tasks-local identity
composer, `$RepoCliId.create("commands/Quality/Tasks")`, and use it to annotate
the literal owner. Add one
classifier over caller-visible args. It checks `isExplicitTurboScopeArg`
first, exact `--affected` second, and returns `unscoped` otherwise.

Match the mode exhaustively where step families differ. General repo-wide
check steps are present for `unscoped` and `affected`; lint policy is present
only for `unscoped`. Do not add stored enablement booleans or duplicate the
existing filter/since/affected recognizers. Keep coverage scope, workspace-task
scope, test-lane scope, and lint-fix intent as their existing independent
domains.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:8-29` — add the
  standard `$RepoCliId` import from `@beep/identity/packages`, the narrow
  `LiteralKit` import, and a file-local
  `$RepoCliId.create("commands/Quality/Tasks")` composer. `Tasks.ts` currently
  has no identity composer; the new private schema requires one for its
  annotation.
- `Tasks.ts:529-540,572-576,596-605,624-629,653-675,2988-3031` — retain
  `isExplicitTurboScopeArg` and `isExplicitTurboAffectedOrScopeArg` and all of
  their non-instance consumers. They remain the canonical Turbo-argument
  recognizers.
- `Tasks.ts:779-781` — replace only `shouldRunRepoWideSteps` and
  `shouldRunLintRepoWideSteps` with the literal owner and classifier.
- `Tasks.ts:834-840` — update the ownership comment to name the new classifier.
  Classification still occurs before `turboRunArgs` appends the repository-owned
  labs exclusion at `Tasks.ts:854-892`.
- `Tasks.ts:2315-2332` — classify `args` once in `rootCheckSteps`; match the
  mode once to select either the three tsgo extras or an empty list, rather than
  scanning once per optional step.
- `Tasks.ts:2578-2595` — make `rootLintPolicySteps` consume the already-derived
  mode (plus the independent `fix` value). `rootLintSteps` derives the mode
  from caller-visible lint args before building the Turbo step.
- `Tasks.ts:2598-2625` — in the direct runner, derive the mode once from
  `strippedLintArgs` and use it after the changed-file lint-fix early return to
  choose a single lint step or the hosted-concurrency lint group. Do not
  classify final `turboRunArgs`; it contains generated cache, concurrency, and
  labs arguments.
- `Tasks.ts:2655-2697` and `src/test/Quality.test-kit.ts:57` — preserve the
  existing planner/testing exports and invocation schema. The new mode remains
  private.
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:2250-2277,
  2468-2473,2506-2541,5461-5473,5565-5619` — extend the existing check, lint,
  and labs-exclusion planning seams with the precedence matrix.

Live source and barrel searches found no external consumers of either
`shouldRun*` projection. The shared lower-level Turbo-scope predicates have
multiple consumers and must not be deleted.

# Guard-deletion accounting

Delete both `shouldRun*` boolean projection helpers, their five call
expressions, the three repeated `A.some(args, isExplicitTurboScopeArg)` scans
performed by the tsgo gates, and the two repeated
`A.some(args, isExplicitTurboAffectedOrScopeArg)` scans performed by lint
policy. One literal classification per planner/runtime path owns the
implication, and exhaustive matching selects the whole step family.

Retain `isExplicitTurboScopeArg`, `isExplicitTurboAffectedOrScopeArg`, and
their uses at `Tasks.ts:534,602,629,671,3001`; deleting them would change
unrelated coverage, workspace, and integration behavior. The independent
`fix` guards and the changed-file lint-fix early return also remain.

# Encoded-side impact

None. The literal is private derived state. CLI arguments, conflict errors,
Turbo argv ordering, labs exclusion placement, step labels, policy-step order,
planner output, direct-runner grouping/concurrency, fix behavior, dry JSON
output, and exit semantics remain byte-compatible.

# Test impact

Table-test check and lint planning for no scope, `--affected`, `--filter=...`,
`--since=...`, affected plus filter, affected plus since, and filter plus since.
Prove the three tsgo extras survive `affected`, all repo-wide extras drop for
`explicit-scope`, lint policy runs only for `unscoped`, and lint fix never adds
policy. Preserve exact step labels, argv, policy ordering, and the hosted
concurrency execution test. Retain the labs tests proving the generated exclude
is present without affecting classification.

Run the focused quality-task test file and full `@beep/repo-cli` package
verification with the required patch changeset when this design is applied.

# Risk and sequencing

Land in Tier 1E. Explicit filter/since must dominate `--affected` when combined,
and classification must occur on caller-visible args before repository-owned
arguments are appended. The planner and direct runner are separate execution
paths and both must use the same classifier. No dependency, public schema,
barrel, or command-surface change is required.
