# Instance

- id: `r3-tooling-quality-root-audit-head-kind`
- source: `05405bf322da0ca7eb88b8bb402145081e8fded6`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:280`
- symbol: `parseRootAuditSelection.headKind`
- members: `isRootAuditMode`, `isGithubCheckMode`
- evidence: E2 at `Tasks.ts:322-348` — after removing one leading passthrough
  delimiter, the non-empty parser consumes a `RootAuditMode`, otherwise retains
  a legacy `GithubCheckMode`, otherwise retains the head as a package-audit
  argument. The canonical literal domains are disjoint, so there is no
  combined-true parse arm.

# Current shape

Two schema-derived guards classify the same argv head. Their ordered branches
implement three payload-preserving actions: an explicit root mode is removed
from the remaining args; a legacy GitHub check mode selects `github` and stays
in the args; any other token selects `packages` and also stays in the args.
This is one parse-head kind expressed through sibling boolean questions.

`stripPassthroughDelimiter` runs before this classification. Therefore a
leading `--` is parser syntax and is removed; the token after it, if any, is
the classified head.

# Cardinality gap

Four guard pairs are representable, while three parse-head states are legal:
`root-audit-mode`, `github-check-mode`, and `package-argument`. The live
`RootAuditMode.Options` are `packages | github`; the live
`GithubCheckMode.Options` are `cheap-gates | quality | review-fix |
repo-sanity | secrets | security | sast | nix | pre-push`. Their intersection
is empty, so combined true is impossible.

# Target schema

Define a private annotated `RootAuditHeadKind` `LiteralKit` with the three
kinds. Model its three payload-bearing members as private `S.Class` schemas,
then assemble them with `RootAuditHeadKind.mapMembers(Tuple.evolve(...))` and
`S.toTaggedUnion("kind")`:

- `root-audit-mode` carries `mode: RootAuditMode`;
- `github-check-mode` carries `mode: GithubCheckMode`;
- `package-argument` carries `argument: S.String`.

This repository-preferred LiteralKit/member-class form reuses the canonical
mode schemas, keeps the discriminator and payloads schema-owned, and avoids
duplicate literal lists. One classifier uses schema-derived membership against `RootAuditMode`
and `GithubCheckMode` and constructs exactly one case. Match the resulting
union with its schema-derived exhaustive matcher in
`parseRootAuditSelection`, preserving the current strip/retain behavior. Do
not widen or merge either public mode domain.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:8-29` — add the
  standard `$RepoCliId` import from `@beep/identity/packages`, the narrow
  `LiteralKit` import, and `Tuple` to the existing `@beep/utils` import. Add a
  file-local `$RepoCliId.create("commands/Quality/Tasks")` composer for the
  private schemas; `Tasks.ts` currently has none. No dependency is added.
- `Tasks.ts:243-246` — keep private `RootAuditSelectionState` exactly as
  `{ mode: RootAuditMode; args: ReadonlyArray<string> }`; define the private
  head kind/union nearby.
- `Tasks.ts:277-291` — remove the top-level `isRootAuditMode` and
  `isGithubCheckMode` constants after the classifier becomes the sole owner of
  raw-head membership. Retain the unrelated schema-derived guards.
- `Tasks.ts:293-299` — preserve the leading passthrough-delimiter normalizer
  byte-for-byte.
- `Tasks.ts:322-348` — preserve empty/default handling, classify the normalized
  non-empty head once, and exhaustively match the three cases. Explicit
  `packages`/`github` heads are consumed; legacy GitHub modes and package args
  retain their heads.
- `Tasks.ts:2627-2645` — `rootAuditSteps` remains the sole reader of the parsed
  result and must emit the same Turbo or nested repo-CLI step, labels, default
  `pre-push`, and args.
- `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:209-245,
  520-569` and
  `packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:14-58` —
  retain the canonical `RootAuditMode` and `GithubCheckMode` owners, types,
  option order, and exports.
- `packages/tooling/tool/cli/src/commands/Quality/index.ts:49-56` and
  `src/test/Quality.test-kit.ts:57` — preserve the public barrels; the head
  union is private to `Tasks.ts`.
- `packages/tooling/tool/cli/test/quality-tasks.test.ts:536-644` — extend the
  existing root-audit planning seam for every head kind and delimiter case.

Live search found no other reader of `parseRootAuditSelection` or
`RootAuditSelectionState`.

# Guard-deletion accounting

Delete the two top-level guard constants and the two ordered boolean branches
from `parseRootAuditSelection`. The classifier still uses guards derived from
the two canonical schemas, but it immediately converts their result into one
`RootAuditHead` case; no pair of booleans is stored, returned, or re-read. The
schema-derived exhaustive union match owns the three parse actions.

Retain `selection.mode === "packages"` in `rootAuditSteps`: it branches over
the honest two-value public output domain and is not one of the replaced
sibling guards. Retain `stripPassthroughDelimiter` because delimiter removal
is a separate argv-boundary rule.

# Encoded-side impact

None. The tagged head is private derived argv state and is never encoded.
`QualityTaskInvocation`, `RootAuditMode`, `GithubCheckMode`, command-line
syntax, delimiter behavior, Turbo args, nested `quality github-checks` args,
labels, defaults, option order, console output, and planner results remain
unchanged.

# Test impact

Table-test empty args, both explicit root modes, every
`GithubCheckMode.Options` member, an unrecognized positional head, and an
unrecognized flag head. Cover `--` alone and `--` followed by each head kind;
assert that the delimiter itself is removed, explicit root modes are stripped,
and legacy/ordinary heads are retained. Compare final `QualityTaskStep` label,
command, args, and cwd. Retain the explicit-versus-legacy `repo-sanity` parity
test and add a schema-owner assertion that the two canonical option sets remain
disjoint.

Run the focused quality-task test file and full `@beep/repo-cli` package
verification with the required patch changeset when this design is applied.

# Risk and sequencing

Land in Tier 1E. The payload behavior is the compatibility boundary: explicit
root modes are consumed, while legacy GitHub modes and ordinary package args
remain in delegated argv. Leading `--` normalization must stay before head
classification. No dependency, public schema, barrel, or CLI change is
required.
