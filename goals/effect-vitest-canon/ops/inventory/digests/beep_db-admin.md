# @beep/db-admin — P1 source audit

Root-reviewed and accepted P1 source inventory. P2 remains gated.

All 10 assigned files were read completely in the original audit and reused only after current hash equality. 40 rows: 3 minor review proposals and 37 info coverage rows. All are open judgments.

| Lens | Review | Coverage | Total |
| --- | ---: | ---: | ---: |
| resource | 0 | 10 | 10 |
| flake | 1 | 9 | 10 |
| property | 0 | 10 | 10 |
| observability | 2 | 8 | 10 |

Review proposals:

- `packages/_internal/db-admin/test/ArchitectureLabMigrationTarget.test.ts:73` — L-OBS-01: The local property projects checkEffect to _tag, losing formatted counterexample and replay details when it fails. During EV007 registration migration preserve target encode/decode equality and fcRuns(25), and expose the native complete failure rather than just Passed versus Falsified.
- `packages/_internal/db-admin/test/integration/EpistemicExecutionLedgerMigration.pglite.test.ts:133` — L-FLAKE-07: The decisionRows SELECT has no ORDER BY, but the test later requires sequence [0,1]. Source-level determinism risk, not a reproduced flake: order by seq before the exact assertion (or explicitly canonicalize for a set law), preserving both decisions, outcome count and final append-only denial. Never rely on insertion/physical row order or add retries.
- `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts:150` — L-OBS-01: The schema law keeps only the native check _tag. Preserve the PatentCitationEvent guard and fcRuns(25), but retain formatted falsification/replay detail when moving this law to a named property registration. Keep SQL denial diagnostics and the separate migration probes unchanged.

Top files by human-row count (ties sorted by path; these are review coverage counts, not defect counts):

- `packages/_internal/db-admin/test/ArchitectureLabMigrationTarget.test.ts`: 4 rows; 1 review proposals.
- `packages/_internal/db-admin/test/index.test.ts`: 4 rows; 0 review proposals.
- `packages/_internal/db-admin/test/integration/ArchitectureLabMigration.pglite.test.ts`: 4 rows; 0 review proposals.
- `packages/_internal/db-admin/test/integration/DocumentsSyncMigration.pglite.test.ts`: 4 rows; 0 review proposals.
- `packages/_internal/db-admin/test/integration/EpistemicContradictionMigration.pglite.test.ts`: 4 rows; 0 review proposals.
- `packages/_internal/db-admin/test/integration/EpistemicEdgeMigration.pglite.test.ts`: 4 rows; 0 review proposals.
- `packages/_internal/db-admin/test/integration/EpistemicExecutionLedgerMigration.pglite.test.ts`: 4 rows; 1 review proposals.
- `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`: 4 rows; 1 review proposals.
- `packages/_internal/db-admin/test/integration/LawPracticeLegalPositionMigration.pglite.test.ts`: 4 rows; 0 review proposals.
- `packages/_internal/db-admin/test/migrate-on-boot.pglite.test.ts`: 4 rows; 0 review proposals.

Migration proofs explicitly create fresh in-process PgLite layers with bundled btree_gist. Candor and Legal Position rebuilds isolate deliberate failed SQL sessions; merging those lifetimes would change the subject. Migrate-on-boot intentionally executes both boots in one database. Keep native constraints, triggers, lineage and full journal rows; MemoryFileSystem cannot prove them. Hook/body budgets and property floors are unchanged. The retained baseline places Candor at 5.306 seconds and Legal Position at 2.733 seconds per file; it does not isolate layer construction cost or prove an optimization benefit.

Retained first-attempt Node baseline: 22 passed registrations; whole command 13.221890 seconds, exit 0. All assigned files are represented according to the context receipt. Reporter SHA256 `95cbfbaccbec235b16a95f146093ddf230bdfc1dd9aa99f48b20cca5b78195e0`. Node 22.22.3, Bun 1.4.2, Vitest 4.1.11; rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198. This is one recorded run, not absence of races, package compiler/coverage proof, supported-peer proof or external-provider execution. No timing was rerun.

Hosted evidence contains one coverage-ratchet observation: job 102749878919, run 34438997453, 2026-09-10, head bb078d815af12a29f48ef76c83837c8719f59c25, functions 0 < 60. It is not a failed test or proven flake; introduced/inherited attribution remains unproven.

Campaign limits: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failed cohorts (CIops, Effect Drizzle, QA Capture). Hosted history covers 527 failed runs with 21 unavailable logs and one unresolved cause. Observations are not unique flakes; production coverage locations are not test failures. Graph-3d browser execution is outside its configured Node cohort.

Proposed P2 order remains scope, assertions, property, flake, observability. First preserve the native boundaries and fixture lifetimes above, then review existing detector candidates without dropping operands or inventing tagged payloads. Apply the specific property controls/floors before ordering and diagnostic improvements. P2 is unauthorized; native-provider runtime behavior, rare failures, coverage completeness and measured optimization benefit remain outside this source audit.

Root verified the sealed artifacts, current inputs and full source receipts, then passed combined strict inventory validation. Full P1 completeness, Grok review and Benjamin’s acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
