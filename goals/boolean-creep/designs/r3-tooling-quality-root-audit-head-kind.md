# Instance

- id: `r3-tooling-quality-root-audit-head-kind`
- file:line:
  `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:281`
- symbol: `parseRootAuditSelection.headKind`
- members: `isRootAuditMode`, `isGithubCheckMode`
- evidence: E2 at `Tasks.ts:323-346` — the non-empty argv parser first
  consumes a `RootAuditMode`, otherwise recognizes a legacy
  `GithubCheckMode`, otherwise treats the token as a package-audit argument.
  The two named literal domains are disjoint and there is no combined-true
  parse arm.

# Current shape

Two schema-derived guards classify the same argv head. Their ordered
`if`/`if` reader implements three different payload-preserving parse actions:
an explicit root mode is removed from the remaining args, a legacy GitHub
check mode selects `github` and remains in the args, and any other token selects
`packages` and also remains in the args. This is one parse-head kind expressed
as sibling booleans.

# Cardinality gap

Four guard pairs are representable, while three parse-head states are legal:
`root-audit-mode`, `github-check-mode`, and `package-argument`. The live
`RootAuditMode` values (`packages`, `github`) do not overlap any live
`GithubCheckMode` value, so combined true is impossible.

# Target schema

Define a private named `RootAuditHead` tagged union, using the existing
LiteralKit infrastructure, with cases
`root-audit-mode { mode: RootAuditMode }`,
`github-check-mode { mode: GithubCheckMode }`, and
`package-argument { argument: string }`. One classifier reuses the live
`RootAuditMode` and `GithubCheckMode` owners and carries the narrowed head in
its case. `parseRootAuditSelection` matches the union exhaustively and applies
the current tail/retained-head behavior. Do not create duplicate literal lists
or widen either public mode domain.

# Migration inventory

- `Tasks.ts:8-25` — add the narrow `@beep/schema/LiteralKit` import alongside
  the existing schema imports; repo-CLI already declares the dependency and a
  private parser model does not need a new exported identity surface.
- `Tasks.ts:90-110` — retain imports of the canonical `RootAuditMode` and
  `GithubCheckMode` schemas and types from their current owners.
- `Tasks.ts:244-247` — keep the public output `RootAuditSelectionState` shape
  (`mode`, `args`) unchanged; add the private tagged head model nearby.
- `Tasks.ts:281-292` — remove the two sibling guard constants after the
  classifier consumes the owners directly.
- `Tasks.ts:323-346` — preserve empty/default handling, classify the non-empty
  head once, and exhaustively match the three tagged cases. Preserve explicit
  `packages`/`github` stripping and legacy GitHub-mode retention exactly.
- `Tasks.ts:2539-2557` — `rootAuditSteps` remains the sole reader of the parsed
  result and must emit the same Turbo or nested repo-CLI step, labels, default
  `pre-push`, and args.
- `Quality.schemas.ts:216-245`,
  `internal/repo-run/RepoRun.proofs.ts:17-58`, and
  `src/test/Quality.test-kit.ts` retain the current public mode owners and
  exports. The private head union is not exported.
- `test/quality-tasks.test.ts:505-623` is the focused command-planning test
  seam.

# Guard-deletion accounting

Delete `isRootAuditMode`, `isGithubCheckMode`, and the two ordered boolean
branches in `parseRootAuditSelection`. A single `RootAuditHead` constructor
owns the disjoint raw-token classification, and one exhaustive tagged-union
match owns the three parse actions. The downstream `selection.mode ===
"packages"` branch remains because it reads the honest public output domain,
not the replaced sibling booleans.

# Encoded-side impact

None. The tagged head is private derived argv state. `QualityTaskInvocation`,
`RootAuditMode`, `GithubCheckMode`, command-line syntax, Turbo args, nested
`quality github-checks` args, labels, defaults, and console output remain
unchanged.

# Test impact

Table-test empty args, both explicit root modes, every `GithubCheckMode`, an
unrecognized positional/flag head, and the leading `--` passthrough delimiter.
Assert exact mode selection and whether the head is stripped or retained by
comparing the final `QualityTaskStep` command, args, label, and cwd. Retain the
explicit-versus-legacy `repo-sanity` parity test and add collision proof that
the two canonical mode option sets remain disjoint. Run focused quality-task
tests and full `@beep/repo-cli` package verification with the required patch
changeset.

# Risk and sequencing

Land in Tier 1E. The payload behavior is the compatibility boundary: explicit
root modes are consumed, while legacy GitHub modes and ordinary package args
remain in the delegated argv. Do not consolidate or rename the two existing
public mode domains in this campaign.
