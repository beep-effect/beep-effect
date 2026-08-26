# P1 Lane A implementation report

Date: 2026-08-25  
Branch: `feat/identity-iri-fibered`  
Scope: design sections 1-3 only

## Outcome

Lane A is implemented. `@beep/identity` now exports the discrete `Fibered` kit and the exact
three-address `IdentityRegistry` contract with its local immutable layer. `JSDocTagDefinition.make`
now constructs its schema through a single-point `Fibered` while retaining its overloads,
`dual(2, ...)`, annotation key, synchronous throw-on-invalid behavior, and all existing call sites.
The pre-migration golden remains green without recomputing its fingerprints.

No files under `packages/foundation/capability/semantic-web/**` or `packages/epistemic/**` were
edited. `packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts`, `bun.lock`, and git state were not
modified by this lane. The checkout already contained unrelated changes to `bun.lock` and goal
packet files when work began; they were preserved.

## Files touched

- `.changeset/fibered-identities-resolve.md`
- `packages/foundation/modeling/identity/src/Fibered.ts`
- `packages/foundation/modeling/identity/src/IdentityRegistry.ts`
- `packages/foundation/modeling/identity/src/index.ts`
- `packages/foundation/modeling/identity/test/Fibered.test.ts`
- `packages/foundation/modeling/identity/test/IdentityRegistry.test.ts`
- `packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagDefinition.model.ts`
- `packages/tooling/library/repo-utils/test/JSDocTagDefinition.golden.test.ts`
- `packages/tooling/library/repo-utils/test/__golden__/jsdoc-tag-fingerprints.json`
- `packages/tooling/library/repo-utils/vitest.config.ts`
- `goals/identity-iri-fibered/history/p1-lane-a-report.md`

## Implementation notes

### Fibered

- `Fibered.make` accepts a finite `S.Literals` base, a total point-to-schema record, and one encoded
  section value per point.
- Construction decodes each section value once and attaches that same decoded object under the
  configured annotation key. The default key is `fiberedSection`, with the matching Effect Schema
  annotation augmentation.
- Members and decoded metadata are indexed in immutable `effect/HashMap` values. The public
  `members` record, member union, display map, projection, and pullback operations are built from
  those indexes.
- Pullbacks preserve input order and reuse member and metadata references without decoding again.
- Tests cover every law in design section 1.2, including randomized restriction composition and
  compile-time exclusions/totality.

### IdentityRegistry

- `IdentityRef`, `IdentityEntry`, both tagged errors, `IdentityRegistryShape`, the service, and
  `layerLocal` match the designed exact-dereference surface.
- `IdentityEntry.fromComposer` accepts only a bound `IdentityComposer` and copies its literal
  `identifier`, `iri`, and `curie` projections; it performs no string interpolation.
- `layerLocal` builds immutable identity, IRI, and CURIE indexes once, rejects duplicate keys during
  layer construction, and resolves with one selected `HashMap` lookup.
- Tests cover all three address forms, missing references, each conflict kind, bound-composer
  projection, the unbound type error, and the `Fibered.project` to registry-fibers bridge.

### JSDoc golden and migration

- The harness contains a verbatim copy of the old `make` body as `legacyMake`.
- It fingerprints all 113 exported JSDoc tag cases using the schema AST string, encoded metadata,
  field keys, and a deterministic arbitrary-sample decode/encode round trip. It also compares the
  current and legacy implementations directly for `param`, `returns`, `deprecated`, and `example`.
- The golden payload was generated while production `make` was unmodified. After migration, the
  snapshot data was not regenerated. Biome subsequently changed JSON whitespace only; no
  fingerprints were recomputed.
- Production `make` retains the exact public overload signature and `dual(2, ...)`. A small
  `effect/Record` singleton constructor keeps computed generic keys precise enough for the total
  `Fibered` input type.
- The optional `member` hook was **not needed**. The default thin member produced identical AST,
  metadata, fields, and round-trip fingerprints for all 113 cases.
- There are zero edits to the 113 construction sites in `JSDoc.ts`.

## Proof record

### Golden runs

| Phase | Command | Exit | Summary |
| --- | --- | ---: | --- |
| Before migration | `cd packages/tooling/library/repo-utils && bunx --bun vitest run test/JSDocTagDefinition.golden.test.ts --pool=threads` | 0 | 1 file, 2 tests passed; production `make` still had its old body; 2.04 s |
| After migration | `cd packages/tooling/library/repo-utils && bunx --bun vitest run test/JSDocTagDefinition.golden.test.ts --pool=threads` | 0 | 1 file, 2 tests passed against the unchanged golden; final run 1.77 s |

### Required package and repository gates

| Command | Exit | Summary |
| --- | ---: | --- |
| `cd packages/foundation/modeling/identity && bun run test` | 0 | 12 files, 103 tests passed |
| `cd packages/foundation/modeling/identity && bun run check` | 0 | package TSGo passed |
| `cd packages/foundation/modeling/identity && bun run lint` | 0 | 25 files checked, no fixes |
| `cd packages/tooling/library/repo-utils && bun run test` | 0 | 20 files, 221 tests passed |
| `cd packages/tooling/library/repo-utils && bun run check` | 0 | package TSGo passed |
| `cd packages/tooling/library/repo-utils && bun run lint` | 0 | 111 files checked, no fixes |
| `bun run docgen:local` | 1 | Refused before compilation because the pre-existing dirty `bun.lock` requires full docgen |
| `bun run docgen:local --full` | 0 | 127/127 tasks passed; identity compiled 208 examples and repo-utils compiled 614 |
| `bun run check` | 0 | 234/234 package tasks; 95 Effect rules enforced; 872 test files passed TSGo; smoke passed |

### Supporting and corrective runs

- `bun run beep architecture` exited 0 and printed the architecture command surface before the new
  concept files were created.
- Focused `Fibered.test.ts` and `IdentityRegistry.test.ts` runs each exited 0 with 8 tests.
- The first identity lint run exposed formatting, member ordering, and constant-condition issues in
  the new tests. They were fixed; the final package lint above is green.
- Bun's default Vitest fork pool timed out before registering even the existing JSDoc model test:
  `[vitest-pool]: Failed to start forks worker ... Timeout waiting for worker to respond`. The same
  tests passed immediately with the thread pool, so repo-utils now selects `pool: "threads"` in its
  package-local Vitest config. The exact required `bun run test` command then passed all 221 tests.
- The first root `bun run check` reached its test-only TSGo lane and exited 1 with 11 Effect
  diagnostics plus ordinary test typing errors in the three new tests. The tests were corrected to
  use finite number schemas, typed decoders, scoped Layer contexts, precisely typed fast-check
  inputs, Effect-compatible synchronous tests, and the required synchronous schema constraint. A
  targeted synthetic-config check passed for both affected packages, and the full root command was
  rerun to the exit-0 result above.

## Design/API deviations

1. `Fibered` constrains `Section` to `S.Top & S.ConstraintDecoder<unknown>` rather than unconstrained
   `S.Top`. In Effect v4 rc.111, the required synchronous `S.decodeResult` API accepts only a
   `ConstraintDecoder<unknown>` with no decoding services. This is the smallest type-level narrowing
   that makes the designed synchronous, throw-on-invalid construction honest.
2. The service identifier is `@beep/identity/IdentityRegistry`, not the design text's duplicated
   `@beep/identity/IdentityRegistry/IdentityRegistry`. The live Effect language service rejects the
   latter with TS377049 and requires the shorter deterministic key for this class name.
3. The JSDoc migration uses `effect/Record` to construct singleton records instead of generic
   computed-property object literals. TypeScript widens the latter to a string index and loses the
   total point key. This changes neither runtime data nor the designed public signature.
4. The `member` hook remains available in `Fibered`, but the JSDoc migration does not use it because
   the default member passed the full unchanged golden.

The package-local Vitest thread-pool selection is a test-runner compatibility adjustment, not a
runtime or public-contract deviation.

## Open gaps and operator handoff

- Lane B remains wholly open: dataset codecs/layer, SHACL projection, semantic-web tests, and the
  epistemic end-to-end proof were intentionally untouched.
- The operator still owns Yeet repair/verify/publish/monitor, review-thread closeout, and the same-PR
  packet lifecycle/reflection work.
- No commit, stage, stash, checkout, rebase, push, or other git-state mutation was performed.
