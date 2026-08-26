# P1 Lane B implementation report

Date: 2026-08-25

Branch: `feat/identity-iri-fibered`

Scope: identity RDF binding, dataset-backed registry layer, SHACL projection,
and bounded-validator end-to-end proof

## Outcome

Lane B is implemented. `@beep/semantic-web` now exposes an exact, explicit
identity-to-RDF binding; a dataset-backed test/development
`IdentityRegistry` layer; and a policy projection into the existing bounded
SHACL contract. The epistemic-server proof passes both the conforming dataset
and required-fiber removal cases without widening the validator.

No commit, stage, stash, checkout, rebase, dependency install, or other git
state mutation was performed. Lane A's uncommitted identity and repo-utils
work was treated as read-only.

## Files touched by Lane B

- `.changeset/fibered-identities-resolve.md`
  - Added the `@beep/semantic-web` minor bump and Lane B summary to Lane A's
    existing changeset.
- `packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts`
  - Added the annotated binding schema, composer-derived default predicates,
    typed errors, and exact encode/decode codec.
- `packages/foundation/capability/semantic-web/src/identity/IdentityRegistryDataset.ts`
  - Added the dataset-backed development/test Layer, delegating decoded
    entries to `IdentityRegistry.layerLocal`.
- `packages/foundation/capability/semantic-web/src/identity/IdentityShaclProjection.ts`
  - Added the annotated policy schema and target-node SHACL projection.
- `packages/foundation/capability/semantic-web/src/identity/index.ts`
  - Added the documented identity surface barrel.
- `packages/foundation/capability/semantic-web/src/index.ts`
  - Exported the identity surface in the package's documented block style.
- `packages/foundation/capability/semantic-web/README.md`
  - Added the identity binding/projection to the package surface and consumer
    example.
- `packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts`
  - Added exact and schema-arbitrary round trips, typed unmapped-fiber
    failures, three-address registry lookup/miss coverage, and request/mock
    service integration.
- `packages/foundation/capability/semantic-web/vitest.config.ts`
  - Selected the threads pool to avoid this environment's forks-worker
    pre-import timeout.
- `packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts`
  - Added the live bounded-validator conforming and removed-fiber proof.
- `packages/epistemic/server/vitest.config.ts`
  - Selected the threads pool for the same worker-startup failure.
- `goals/identity-iri-fibered/research/OPPORTUNITIES.md`
  - Recorded the required public-safe friction receipt for that failure.
- `goals/identity-iri-fibered/history/p1-lane-b-report.md`
  - This report.

## Implementation notes

### Exact codec

- Every identity subject is `makeNamedNode(entry.iri)`.
- Identifier, CURIE, and mapped fibers are `xsd:string` literals made through
  the RDF package constructors.
- Default identifier and CURIE paths are the `.iri` projections of
  `$SemanticWebId.create("identity/identifier")` and
  `$SemanticWebId.create("identity/curie")`; there is no IRI interpolation.
- Encoding an unmapped entry fiber fails with `IdentityFiberPathError`.
- Decoding requires named-node subjects, exactly one identifier, exactly one
  CURIE, no duplicate mapped fiber, plain string literals, and no unknown
  predicates. Structural failures use `IdentityDatasetDecodeError`.
- Subject first-occurrence order and each entry's complete fiber record are
  preserved by a round trip.

### Registry and policy projection

- `layerDataset` decodes once via `datasetToEntries` and passes the result to
  `IdentityRegistry.layerLocal`, preserving Lane A's conflict and lookup
  semantics.
- Every projected node shape targets the entry IRI. Identifier and CURIE
  properties each have `minCount: 1`, `maxCount: 1`, and their exact literal
  `hasValue`. Every required policy fiber contributes its bound path with
  `minCount: 1`.
- Projection fails with `IdentityFiberPathError` before producing shapes when
  a required fiber path is not bound.

## End-to-end evidence

The test uses the live exported `BoundedShaclValidationServiceLive` Layer.
With the full codec-produced dataset, validation returns `conforms: true` and
zero violations. The test then removes the sole quad whose predicate is
`$EpistemicServerId.create("identity/fibers/display-name").iri`. Validation
returns `conforms: false` and contains a result with severity `violation` and
a path exactly equivalent to that required-fiber predicate.

The live bounded validator therefore handled `targetNode`, literal
`hasValue`, cardinality, and the required-fiber `minCount` used by this
projection. No validator limitation or source widening was required.

## Verification ledger

All exit codes below are terminal process exit codes; none was masked through
`tail` or `tee`.

| Command | Exit | Evidence / attribution |
| --- | ---: | --- |
| `bun run beep architecture` | 0 | Required architecture routing completed before adding the identity concept directory. |
| `cd packages/foundation/capability/semantic-web && bun run check` (first pass) | 1 | Introduced issues: Effect dual-form rule and the live SHACL constructor's `Option<NonNegativeInt>` fields. Fixed in Lane B. |
| `cd packages/foundation/capability/semantic-web && bun run lint` (first pass) | 1 | Introduced mechanical import/format findings. Fixed with the package formatter. |
| `cd packages/foundation/capability/semantic-web && bun run lint:fix` | 0 | Applied only mechanical formatting/import organization in the Lane B package. |
| `cd packages/epistemic/server && bun run lint` (first pass) | 1 | Introduced mechanical formatting findings in the new proof/config. |
| `cd packages/epistemic/server && bun run lint:fix` | 0 | Applied only mechanical formatting/import organization in the Lane B server files. |
| `cd packages/foundation/capability/semantic-web && bun run test` | 0 | 3 files, 15 tests passed, including the 40-run schema-arbitrary codec property. |
| `cd packages/foundation/capability/semantic-web && bun run check` | 0 | Package source TypeScript/Effect checks passed. |
| `cd packages/foundation/capability/semantic-web && bun run lint` | 0 | 16 files checked; no fixes required. |
| `cd packages/epistemic/server && bun run test` | 0 | 6 files, 32 tests passed, including the new bounded-validator e2e proof. |
| `cd packages/epistemic/server && bun run check` | 0 | Source and test TypeScript/Effect checks passed. |
| `cd packages/epistemic/server && bun run lint` | 0 | 42 files checked; no fixes required. |
| `bun run docgen:local` | 1 | Preflight stopped before doc compilation because the inherited Lane A working tree includes a dirty `bun.lock`; it prescribed the full command. No JSDoc diagnostic ran in this attempt. |
| `bun run docgen:local --full` | 0 | Full substitute passed 127/127 tasks; changed-package examples included semantic-web (47), epistemic-server (31), identity (208), and repo-utils (614). |
| `bun run check` (first pass) | 1 | Main 234-task check and all 95 Effect rules passed; the test-only sweep found four introduced diagnostics in the new semantic-web test. Fixed in Lane B. |
| `bun run check` (final pass) | 0 | 234/234 main tasks, all 95 Effect rules, the 874-file/129-package test sweep, and the tsgo smoke test passed. |
| `git diff --check` | 0 | No whitespace errors in the tracked diff. |

Before the pool settings were added, focused semantic-web and
epistemic-server Vitest invocations each exited 1 after 60 seconds with
`[vitest-pool]: Failed to start forks worker` and
`Timeout waiting for worker to respond`, before importing a test file. The
same focused proofs exited 0 under the package-local threads pool. The full
canonical package commands above are the final authoritative proofs.

## Design-to-live-API deviations

1. The design calls the server Layer `BoundedShaclValidatorLive`; the live
   barrel and sibling tests export `BoundedShaclValidationServiceLive`
   (`packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:81`).
   The proof uses that live symbol.
2. The live `ShaclPropertyShape.make` contract requires optional fields as
   `Option` values and count values as `NonNegativeInt`. The projection uses
   `Option.some(NonNegativeInt.make(1))` and `Option.some(...)`; the emitted
   contract values are exactly the designed min/max/hasValue constraints.
3. The Effect language-service dual-form rule applies to the two-argument
   binding constructors. `layerDataset` and `projectShapes` therefore expose
   dual overloads while retaining the required
   `layerDataset(binding, dataset)` and `projectShapes(binding, policy)(entries)`
   call forms.
4. Both affected packages select Vitest's threads pool because the inherited
   forks pool consistently timed out before test import in this environment.
   This changes test execution machinery only.

## Lane A API requests

None. Lane B was implementable against the live `IdentityEntry`,
`IdentityRegistry`, composer, and RDF APIs without changing read-only Lane A
files.

## Open gaps for the operator

- The literal requested `bun run docgen:local` command remains preflight-
  blocked while the inherited `bun.lock` modification is present. The
  prescribed full form passed and compiled every example.
- Publication, staging, commit creation, hosted checks, and merge readiness
  remain intentionally unperformed for the Yeet operator.
- There is no bounded-validator behavior gap for the Lane B projection.
