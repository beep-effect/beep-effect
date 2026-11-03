# Instance

- id: `tmpfs-dangling-stub-disposition`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts:387`
- symbol: `discoverDanglingWorktreeStub`
- members: `shape.classified`, `contentsAreExact`
- evidence: E4 at `TmpfsReap.ts:387-394` — contents are inspected only after
  shape classification, so the writer produces wrong-shape, classified with
  wrong contents, or classified with exact contents; unclassified/exact is
  unreachable.

# Current shape

Dangling-stub discovery first classifies the `.git` target and missing parent
repository, then conditionally checks whether the candidate directory contains
only a small regular non-symlink `.git` file. Two booleans select the candidate
classification and skip reason. This local pair precedes the broader
`DiscoveredCandidate`/`ApplyOutcome` lifecycle.

# Cardinality gap

Four pairs are representable and three discovery dispositions are legal:
`wrong-shape`, `wrong-contents`, and `exact`.

# Target schema

Define a private `DanglingStubDisposition` LiteralKit with `wrong-shape`,
`wrong-contents`, and `exact`. Classify in two stages: a non-classified shape
immediately becomes wrong-shape without reading directory contents; a
classified shape calls `danglingStubContentsAreExact` once and becomes exact
or wrong-contents. Match that disposition when constructing the candidate.
Wrong-shape preserves `danglingStubShape`'s exact reason, wrong-contents maps to
the existing `contents-present` reason, and exact is classified with no reason.
Do not absorb the separate candidate-classification/application model owned by
`r2-tooling-tmpfs-reap-classified-reaped`.

# Migration inventory

- `TmpfsReap.ts:18-39` — reuse the existing `LiteralKit` import and define the
  private disposition beside the other private finite domains; no barrel or
  schema-role export is required.
- `TmpfsReap.ts:235-246` — retain `danglingStubShape` and its reason priority
  (`gitdir-target-exists`, `parent-repo-present`, `wrong-shape`); its separate
  candidate classification is input to this local disposition.
- `TmpfsReap.ts:248-268` — retain the exact-contents predicate: one `.git`
  entry, no symlink, regular file, and at most 4096 bytes. Read/stat errors
  continue failing closed to false.
- `TmpfsReap.ts:373-397` — replace the qualified boolean and correlated
  construction ternaries with one disposition and exhaustive match. Preserve
  `gitDir`, `parentRepo`, missing-stat derivation, candidate fields, and order.
- `TmpfsReap.ts:452-465` and `977-1009` — both initial discovery and
  immediately-before-removal rediscovery use the migrated function; preserve
  liveness/age revalidation and exact warning
  `dangling-stub eligibility changed before removal.`
- `TmpfsReap.ts:844-891` — no weakening of the independent second exact-
  contents check, non-recursive `.git` removal, guarded `rmdir`, raced-content
  warnings, or optional empty-parent cleanup.
- `test/tmpfs-reap.test.ts:450-610,616-810` — preserve wrong-shape,
  contents-present, symlink race, eligibility race, removal failure, and raced
  content coverage. Report rendering remains covered by
  `test/quality-tmpfs-render.test.ts`.
- Whole-source search found no other writer/reader of the private local pair.

# Guard-deletion accounting

Delete the local `contentsAreExact` boolean, the
`shape.classified ? ... : false` qualifier, `shape.classified &&
contentsAreExact`, and `shape.classified && !contentsAreExact`. A single
disposition match owns these three branches. Keep the earlier shape model and
the later candidate classified/reaped model because they carry independent
reasons and lifecycle state.

# Encoded-side impact

None. The disposition is private and derived during discovery. Public
`TmpfsReapReport` candidate order, action, skip reason, counts, reclaimed
bytes, roots, timestamps, warnings, and JSON remain exactly unchanged.

# Test impact

Cover each disposition via report output: malformed/present parent shape keeps
its exact shape reason, a structurally eligible directory with extra or raced
contents reports `contents-present`, and an exact stub proceeds to ordinary
safety/liveness/age planning. Retain fail-closed read/stat/symlink tests,
immediate rediscovery, the second exact-content check, non-recursive removal,
and classified-kept/classified-reaped coverage from the sibling design. Run
the focused tmpfs-reap and render suites plus package verification when
implemented.

# Risk and sequencing

Coordinate in Tier 1E with `r2-tooling-tmpfs-reap-classified-reaped`, but keep
the models separate. The critical invariants are lazy content inspection after
shape success and repeated fail-closed eligibility checks before deletion; the
literal refactor must not reduce either.
