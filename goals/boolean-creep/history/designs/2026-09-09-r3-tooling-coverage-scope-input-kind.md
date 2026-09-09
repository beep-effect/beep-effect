# Instance

- id: `r3-tooling-coverage-scope-input-kind`
- file:line:
  `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:539`
- symbol: `fullReasonForFile.inputKind`
- members: `isGlobalCoverageInput`, `isCoverageNoopInput`
- evidence: E2 at `CoverageScope.ts:577-608` — the reader returns immediately
  for a global input and later returns `None` for a coverage-noop input, with
  no combined-true arm. The exact-file/prefix tables are disjoint, and the
  standards-document predicate cannot match the non-Markdown standards
  baseline in the global table.

# Current shape

Two private boolean functions classify the same changed path as a global
coverage input or an inert input. `fullReasonForFile` consumes them in an
ordered decision with two intentional exceptions between the branches: lab
workspaces are inert, and specific repository fixtures under otherwise inert
goal prefixes route to their configured owner. The domain is one changed-path
policy kind, while the current booleans leave the impossible combined state in
the reader's control flow.

# Cardinality gap

Four global/noop pairs are representable, while three policy states are legal:
`global`, `noop`, and `owner-routed`. The current exact-file and prefix tables
are disjoint. `isStandardsDocument` covers only `standards/**/*.md`, whereas
the global standards entry is
`standards/coverage.regression-baseline.jsonc`.

# Target schema

Define a private named `CoverageChangedPathKind` LiteralKit with `global`,
`noop`, and `owner-routed`. One classifier evaluates the global tables first,
then the noop tables plus `isStandardsDocument`, and returns `owner-routed`
otherwise. Compute that literal once in `fullReasonForFile` and match it
exhaustively while preserving the existing lab and repository-fixture
overrides in their current precedence positions.

# Migration inventory

- `CoverageScope.ts:8-18` — add the narrow LiteralKit import alongside the
  existing `@beep/schema` import or use the package's canonical narrow subpath;
  no dependency or public barrel change is needed.
- `CoverageScope.ts:24-66` — retain the baseline path and all full, noop, and
  repository-fixture policy tables byte-for-byte.
- `CoverageScope.ts:539-556` — retain `isStandardsDocument`, replace the two
  sibling boolean classifiers with one finite-domain classifier, and keep the
  current exact-file/prefix helpers.
- `CoverageScope.ts:558-575` — retain repository-fixture lookup and owner
  availability logic unchanged.
- `CoverageScope.ts:577-608` — compute one changed-path kind. Preserve this
  exact precedence: global reason; lab no-op; repository fixture owner/no-op
  or unavailable-owner reason; ordinary noop; owner/package fallback. A goal
  fixture must continue overriding the broader `goals/` noop prefix.
- `CoverageScope.ts:760-1070` — public `changedCoverageOwners`,
  `planCoverageAffectedScope`, `planCoverageAffectedScopeWithBaseline`, and
  `planWorkspaceCoverageAffectedScope` retain their existing schemas, dual
  call forms, sorting, reason strings, and exports through
  `src/test/Quality.test-kit.ts`.
- `test/quality-tasks.test.ts:3093-3720,4380-4420` — extend the existing
  affected-coverage planner tables and exact result assertions.

# Guard-deletion accounting

Delete `isGlobalCoverageInput`, `isCoverageNoopInput`, and the two separated
boolean branches over those predicates in `fullReasonForFile`. One
`CoverageChangedPathKind` classifier owns their mutual exclusion, and an
exhaustive match owns the ordinary global/noop/owner-routed dispatch. Preserve
the independent lab and configured-fixture guards because they are explicit
precedence exceptions, not projections of the replaced pair.

# Encoded-side impact

None. The literal is private derived path-policy state. `CoverageAffectedScope`
tags and fields, full-reason strings, selected package names, dependent names,
sorting, baseline-row semantics, command output, and persisted coverage
artifacts remain byte-compatible.

# Test impact

Table-test every exact full file and representative full prefix, every exact
noop file and noop prefix, Markdown versus non-Markdown standards paths,
unknown paths, owner source and manifest paths, lab paths, and both configured
repository-fixture forms. Prove that fixtures under `goals/` still select their
owner or force the existing unavailable-owner reason before ordinary noop
classification. Retain baseline special-case, direct/dependent selection,
deduplication, and sorted-reason assertions. Run the focused quality-task tests
and full `@beep/repo-cli` package verification with the required patch
changeset.

# Risk and sequencing

Land in Tier 1E. The repository-fixture override is the critical invariant:
classifying a goal path as noop must not bypass its configured package owner.
No policy table, coverage breadth decision, or public scope shape changes in
this refactor.
