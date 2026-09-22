# @beep/law-practice-server P1 digest

Root-reviewed P1 source inventory; all rows remain open and P2 remains gated.

Ten complete census files were read: nine tests and one support module, 4,341 lines. The 41 open judgment rows comprise five minor review items and 36 info coverage-only rows. One review is native-boundary guidance, not an independent defect. Each file has all four lenses.

| Lens | Review | Coverage | Total |
| --- | ---: | ---: | ---: |
| resource | 1 | 9 | 10 |
| flake | 0 | 10 | 10 |
| property | 4 | 7 | 11 |
| observability | 0 | 10 | 10 |

Review items:

- `packages/law-practice/server/test/LegalPositionRecord.pglite.test.ts:438` — L-PROP-04: The frame-keyed ordering claim is not proved by a singleton exercise per distinct frame, and this ordering block does not assert correction order. Add at least two exercises and two corrections for the same frame with IDs opposed to heap insertion order; retain all current assertions, tenant scopes and forced sequential scans. This is a proof gap, not a demonstrated repository bug; any generated version must preserve the domain references and explicit run floor.
- `packages/law-practice/server/test/LegalPositionRecord.test.ts:329` — L-PROP-03: The literal arbitrary runs:10 bypasses fcRuns environment floor and seed routing. Preserve at least ten trials, the production LegalPositionRelator schema, maxLength(12), empty-array domain, exact per-organization sorted IDs and fresh repository per trial; use arbitrary:fcRuns(10). If replacing Effect.runSync, return the same program from it.effect.prop without inventing new payloads.
- `packages/law-practice/server/test/PracticeKg.projections.test.ts:344` — L-RES-04: The fixture creates real DuckDB/PgLite files, symlinks and scoped directories; later assertions reject linked inputs and inspect native SQL/DDL. Keep that native subject. Review whole-test NodeServices ownership separately from short database connection scopes that must close before reopening or comparing dumps. Do not blindly share mutable bundles, hoist failure mutations, or replace the filesystem with MemoryFileSystem; preserve two independent builds and every security negative.
- `packages/law-practice/server/test/PracticeKg.projections.test.ts:456` — L-PROP-04: The property titled generates schema-valid fixture source rows only generates S.String and checks isString; it cannot detect a broken FixtureSourceRow schema or codec. Retain that assertion if retained as a string smoke test, and add a meaningful fixture-source JSON encode/decode law over the actual FixtureSourceRow domain with explicit fcRuns(10) or higher. Keep all existing native bundle, DDL, UTF-8, byte-limit, symlink and exact source-span assertions.
- `packages/law-practice/server/test/PracticeKg.projections.test.ts:460` — L-PROP-03: The current string property hardcodes runs:10 and omits the environment seed/floor. Preserve at least ten trials and route options through arbitrary:fcRuns(10), including any additional FixtureSourceRow codec law. This floor defect is independent of the vacuous fixture-row title; do not suppress either or replace native integration assertions.

Top ten files by finding count, including coverage (ties by path):

- `packages/law-practice/server/test/PracticeKg.projections.test.ts`: 5 rows; 3 review items.
- `packages/law-practice/server/test/CandorPromotionGate.test.ts`: 4 rows; 0 review items.
- `packages/law-practice/server/test/CandorRecord.pglite.test.ts`: 4 rows; 0 review items.
- `packages/law-practice/server/test/CandorRecord.test.ts`: 4 rows; 0 review items.
- `packages/law-practice/server/test/CompetencyQuestions.test.ts`: 4 rows; 0 review items.
- `packages/law-practice/server/test/LawPracticeServer.test.ts`: 4 rows; 0 review items.
- `packages/law-practice/server/test/LegalPositionRecord.pglite.test.ts`: 4 rows; 1 review items.
- `packages/law-practice/server/test/LegalPositionRecord.test.ts`: 4 rows; 1 review items.
- `packages/law-practice/server/test/TaggedError.equivalence.test.ts`: 4 rows; 0 review items.
- `packages/law-practice/server/test/fixture.ts`: 4 rows; 0 review items.

The in-memory repositories allocate fresh Ref stores per block; the legal-position property allocates per trial. CompetencyQuestions seeds one repository and the actual policy per block, then performs read-only retrieval. Preserve the never-compute legal-judgment boundary, attributed interpreters, void attempts and effective-but-violative cases. The extraction server uses local LanguageModel fixtures despite its allow-remote configuration; this is not external-provider proof.

The two SQL files build separate migrated PgLite/Drizzle layers and isolated unmigrated failure databases. Preserve actual serial IDs, schema mappings, tenant filters and forced heap ordering. Candor's query-plan test loads 10,000 rows per table and checks the tenant index under ANALYZE. No measured optimization supports replacing that with mocks or smaller fixtures. The legal-position ordering gap is specifically the singleton frame-keyed exercise/correction proof, not the existing tenant-wide ordering proof.

PracticeKg builds real DuckDB/PgLite bundles and scoped native directories. Symlink rejection, regular-file checks, byte bounds, UTF-8, DDL and reopen/dump behavior make MemoryFileSystem substitution unsafe for this combined subject. Its withDuckDb and provideScopedLayer calls require review of actual close-before-reopen ordering; consolidating every resource into one shared suite could change semantics. Preserve separate first/second builds, mutable failure fixtures, strict dump equality and exact source-span assertions. No temporary volume demand or native replacement is approved here.

Retained first-attempt Node timing: 17.07128805 seconds for the complete command, exit 0; 72 registrations comprise 71 passed and one skipped. All nine census test files are represented; fixture.ts is source support, not a registration. The real workstation-corpus case is opt-in, so its registration is not evidence of execution. Raw reporter SHA256 f7589ddd37b03ccc0454b23f313214f82a30e77bd8d7d2848ecad12efb65a8c7. Reported file spans: PracticeKg 9326.362 ms, Candor PgLite 6347.460 ms, LegalPosition PgLite 3139.542 ms. These file spans overlap and are not additive rebuild costs; no per-acquisition cost was measured. Context retains host load/pressure and makes no normalization.

Hosted evidence contains eight mapped observations over two earlier jobs. Five assertion failures in the August 27 job concern LawPracticeServer source grounding, missing-versus-unaligned reasons, distinction labels and the KG zero-claims outcome. They are not five unique flakes. Three August 29 production coverage-ratchet observations concern PracticeKg.claims.ts: functions 95.45 < 100, lines 97.16 < 98.83, statements 97.19 < 98.85. Those production paths are not test failures. Exact heads, job URLs, diagnostic lines and Node 24.20.0 evidence are retained in the [hosted history summary](../hosted-history-summary.json); this audit does not claim their causal relationship to current bytes.

The campaign completed 139 first attempts: 132 full-file-representation baselines, four configured subsets and three failed cohorts (CIops, Effect Drizzle, QA Capture). Current timing uses Node 22.22.3/Bun 1.4.2/Vitest 4.1.11 with rc113. Hosted scope contains 527 failed runs, 21 unavailable logs and one unresolved cause. A passing baseline establishes neither package/coverage proof nor absence of rare races or provider failures. No collection was rerun and no service, database or container was acquired here.

Proposed P2 order remains scope, assertions, property, flake, observability. First preserve native lifetimes and fresh mutable stores; then migrate tagged candidates without changing payloads, Causes, matcher polarity or D5 plain-value assertions. Address the two floor/seed sites and the fixture-row/order proof gaps without lowering trial counts or deleting current assertions. Keep history attribution and optional-corpus limits explicit. P2 requires full P1 completeness, Grok review and Benjamin’s acknowledgement. Root accepted this inventory after source/artifact verification and combined strict validation; no source remediation was performed.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
