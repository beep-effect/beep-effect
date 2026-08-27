# Quality Review/Fix Loop — 2026-08-27

## Baseline

- Baseline commit: `7503098fcbb57cfaf71738f92e88480056fbae76`
- Base: `origin/main`
- Lab audit: green (build, typecheck, two test files, six tests, lint)
- Cheap gates: 12/12 green after generated config, Effect import, schema-first, Knip, and
  fallow repairs
- Unrelated `.codex/` work: excluded from the commit and every fixer surface
- Full Yeet: deferred while the shared proof coordinator is owned by other checkouts

## Round 1 panel

All ten required read-only roles reviewed the same committed baseline:

1. Quality Gate Reviewer
2. Architecture Boundary Reviewer
3. Schema And Domain Reviewer
4. Effect Law Reviewer
5. Error Boundary Reviewer
6. Testing Reviewer
7. Observability Reviewer
8. Documentation And API Reviewer
9. Reuse And Duplication Reviewer
10. Evolution And Deprecation Reviewer

## Deduplicated inventory

| Inventory | Source findings | Blocking | Fix group | Status |
| --- | --- | --- | --- | --- |
| `META-001` declared dependency graph | `ARCH-R1-001`, `QG-R1-001`, `REUSE-R1-001` | yes | package metadata/generated config | fixed; round 2 pending |
| `DOC-001` generated identity example | `DAPI-R1-001` | yes | identity generator | fixed; round 2 pending |
| `SCHEMA-001` persisted integrity and exact cardinalities | `LEJ-SCHEMA-R1-001`, `002`, `005`; `LEJ-TEST-R1-001` | yes | bundle/fixture schemas | fixed; round 2 pending |
| `RULE-001` canonical rule semantics | `LEJ-SCHEMA-R1-003`; `LEJ-TEST-R1-004` | yes | ontology/rules/tests | fixed; round 2 pending |
| `TIME-001` semantic dates and shared timestamp reuse | `LEJ-SCHEMA-R1-004`, `REUSE-R1-002` | yes | ontology schemas/tests | fixed; round 2 pending |
| `REPLAY-001` committed recording integrity/offline test | `LEJ-TEST-R1-002`; provider part of `LEJ-SCHEMA-R1-001` | yes | replay schemas/tests | fixed; round 2 pending |
| `FS-001` transactional bundle publication | `EB-R1-001`, `LEJ-TEST-R1-003` | yes, P0 | server/filesystem tests | fixed; round 2 pending |
| `ERROR-001` closed, cause-preserving errors | `EB-R1-002`, `EFFECT-R1-001`, `002`, `005`; `LEJ-OBS-R1-002` | yes | domain and server boundaries | fixed; round 2 pending |
| `EFFECT-001` Option and explicit DB sequencing | `EFFECT-R1-003`, `004` | yes | projections | fixed; round 2 pending |
| `OBS-001` workflow spans and safe attributes | `LEJ-OBS-R1-001`, `002`, `003` | yes | domain/server boundaries | fixed; round 2 pending |
| `EVOL-001` frozen/versioned recording and bundle contracts | `LEJ-EVOL-R1-001`, `003` | yes | provider/bundle/docs | fixed; round 2 pending |
| `RETENTION-001` enforceable 2026-09-30 disposition | `LEJ-EVOL-R1-002` | yes | retention boundary/runbook | fixed; round 2 pending |
| `DOC-002` accurate private-module and operator docs | `DAPI-R1-002`, `003` | yes | lab source/README | fixed; round 2 pending |
| `PROOF-001` final docgen and exact-tree Yeet | `QG-R1-002` | yes | repository proof | queued |
| `CLEANUP-001` prebuilt provider matcher | `EFFECT-R1-006` | no | provider server | backlog |

No blocker was rejected or waived. Duplicates were merged by their shared acceptance surface.

## Fixer ownership

- Metadata/API fixer: lab manifest, generated project graph/lock, identity generator/test/output.
- Schema/domain fixer: domain schemas, rules, projections, replay, fixture-manifest schema, and
  `Bundle.test.ts`.
- Server/boundary fixer: server entrypoints, fixture generator, operator README, and a separate
  durable-builder integration test.

The next round reruns focused acceptance, the green baseline, and the same ten-role panel. The
loop closes only at zero required findings, followed by full Yeet and hosted merge-readiness.

## Round 1 fix integration

- The lab audit passed with production build, typecheck, three test files, 19 tests, and lint.
- Transactional builder tests cover existing-root preservation, same/nested-root rejection,
  staging cleanup, byte-identical fresh builds, cutoff refusal, and reviewed retention extension.
- Persisted provider, receipt, and projection metadata now carry explicit schema and contract
  revisions; the projection sidecar binds both durable stores to the bundle identity.
- Two final-evidence rebuilds returned identity
  `5ed5639e9ce9cd090cdb253f975e5bc9ee18ddea2de5dc3d9d7f857f33b57cf6` and byte-identical
  bundle, receipt, projection metadata, and mutable-ledger JSON.
- `docgen:local` correctly reported that this global-input change requires the full docgen proof;
  that proof remains part of `PROOF-001`, not a waiver.
- The schema-first gate initially exposed missing schema-derived arbitrary coverage after the
  codec suite grew. A focused retention-authorization round-trip property closed it; the rerun
  reported zero missing/stale entries and zero schema-first advisories.

## Round 2 inventory

The Quality Gate, Architecture Boundary, and Schema And Domain roles reviewed exact commit
`0ce27feb5078d4c2ecd5c31246670e0a5d0e3f16`. No finding was rejected or waived. Their
deduplicated required inventory is:

| Inventory | Source findings | Fix group | Status |
| --- | --- | --- | --- |
| `ARCH-001` driver-neutral app-local topology | `ARCH-R2-001` | module topology and imports | fixed; rereview pending |
| `RETENTION-002` durable effective authority | `ARCH-R2-002`, `LEJ-SCHEMA-R2-005` | retention schema, mutable metadata, builder tests | fixed; rereview pending |
| `FS-002` crash-consistent two-root publication contract | `ARCH-R2-003` | publication protocol and recovery tests | fixed; rereview pending |
| `DEAD-001` introduced unused schema exports | `QG-R2-001` | schema/API cleanup | fixed; rereview pending |
| `COMPLEXITY-001` bundle closure predicates | `QG-R2-002` | named invariant predicates and tests | fixed; rereview pending |
| `RULE-002` exact rule-case/projection contract | `LEJ-SCHEMA-R2-001` | bundle rule contract | fixed; rereview pending |
| `RULE-003` matched-assembly compatibility proof | `LEJ-SCHEMA-R2-002` | ontology/rule evaluator | fixed; rereview pending |
| `PROVIDER-002` closed recording provenance and label semantics | `LEJ-SCHEMA-R2-003` | provider schema/verifier | fixed; rereview pending |
| `FIXTURE-002` closed manifest identity graph | `LEJ-SCHEMA-R2-004` | manifest schema/verifier | fixed; rereview pending |
| `PROOF-001` full docgen and exact-tree Yeet | `QG-R2-003` | repository proof | queued after fixes |

The remaining seven panel roles will review the same settled fix commit. Any new required
finding reopens the loop; full proof remains an acceptance step, never a waiver.

### Schema/domain fixer proof

- Lab check, all three test files and 19 tests, and lab lint passed.
- Knip passed with `current=3 baseline=3 introduced=0`.
- Fallow dead-code passed with zero findings.
- Fallow audit passed with zero introduced findings; its sole finding is the existing
  non-blocking provider-smoke duplication attributed `inherited-adjacent`.
- Negative tests now reject rule/source/projection swizzles, incompatible or unproven matched
  assemblies, wrong provider documents and label values, manifest identity/hash/reference
  drift, and retention records that do not extend both their authorization date and the cutoff.

### Architecture fixer proof

- `bun run beep architecture` passed before the new app-local role paths were created.
- Driver-backed projections moved to `src/runtime`; normalization, rule evaluation, replay, and
  provider-recording verification moved to `src/workflows`; domain retains schemas and pure
  invariants.
- The lab audit passed with 28 Biome files and the same three test files/19 tests.
- Scans found zero driver, SQL, Layer, compression, or fixture imports under `src/domain`, and
  zero stale imports from the four former domain workflow paths.

### Filesystem/retention fixer proof

- Both final children are now staged beneath one builder-owned container and become visible by
  exactly one `rename(staging.container, publicationRoot)` operation.
- Existing publication roots are preserved; invalid roots and failed stages create no final
  publication and leave no builder-owned staging path.
- The mutable root persists a schema-decoded `retention-metadata.json` containing the effective
  date and every reviewed-authority field, while the immutable bundle excludes that authority.
- Tests reject builds on the fixed cutoff without authority and on an extension's effective
  disposition date; the reviewed extension case validates every persisted field.
- Focused builder tests passed 10/10. The lab audit passed with three files/21 tests and 28
  Biome files. `git diff --check` passed.
- Two post-fix fresh publications produced final identity
  `1474d1899f44511b3a363d3a4e1b1927cf2462cb9ee8685e994ba7f747851f91`; all five persisted
  JSON contracts were byte-identical across rebuilds with provider/network availability false.

## Round 3 inventory

The fresh panel began against exact commit `a5b195645a55b29e8621f974e162063370ca7dbf`.
Architecture reported zero required findings. Schema/domain and quality reported five required
findings; none was rejected or waived:

| Inventory | Source finding | Status |
| --- | --- | --- |
| `RULE-004` DTI standard/family compatibility | `LEJ-SCHEMA-R3-001` | fixed; rereview pending |
| `RULE-005` complete governing-source semantics | `LEJ-SCHEMA-R3-002` | fixed; rereview pending |
| `FIXTURE-003` exact frozen extraction rows | `LEJ-SCHEMA-R3-003` | fixed; rereview pending |
| `IMPORT-001` root Effect `Order` import | `QG-R3-001` | fixed; rereview pending |
| `PROPERTY-001` mutable-retention arbitrary coverage | `QG-R3-002` | fixed; rereview pending |

All other bounded quality checks passed. Full docgen and exact-tree Yeet remain queued acceptance
steps, not implementation waivers.

### Round 3 fixer proof

- The lab audit passed with production build, typecheck, three files/22 tests, and lint.
- Effect-import and schema-first gates passed with every touched/advisory counter at zero.
- Knip and Fallow dead-code passed with no introduced findings; Fallow audit retained only its
  inherited-adjacent nonblocking provider-smoke duplication.
- Mutation tests now reject DTI standard swizzles, same-ID changes to governing URL/revision/
  evidence/title/research path, and coherent manifest offset/quote/value drift.
- The mutable-retention schema exposes a correlated `S.toArbitrary` generator and round-trip
  property proof. `git diff --check` passed.
