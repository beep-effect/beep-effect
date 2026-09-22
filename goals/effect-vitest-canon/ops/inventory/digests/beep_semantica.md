# @beep/semantica — P1 source-only digest

Root-reviewed P1 inventory; P2 remains gated.

17 complete census files (15 tests, two support), 68 rows: 22 reviews / 46 coverage.

| Lens | Rows |
| --- | ---: |
| resource | 17 |
| flake | 17 |
| property | 17 |
| observability | 17 |

Severity: 46 info, 22 minor.


Top ten files by review count:

- `apps/labs/semantica/test/C0Input.test.ts`: 3 review rows; lines 1–377.
- `apps/labs/semantica/test/Canary.test.ts`: 3 review rows; lines 1–176.
- `apps/labs/semantica/test/C0Slice.test.ts`: 2 review rows; lines 1–250.
- `apps/labs/semantica/test/Fixtures.test.ts`: 2 review rows; lines 1–365.
- `apps/labs/semantica/test/Gold.test.ts`: 2 review rows; lines 1–565.
- `apps/labs/semantica/test/GoldSource.test.ts`: 2 review rows; lines 1–297.
- `apps/labs/semantica/test/ProviderCache.test.ts`: 2 review rows; lines 1–790.
- `apps/labs/semantica/test/Schema.test.ts`: 2 review rows; lines 1–1449.
- `apps/labs/semantica/test/Extractor.test.ts`: 1 review rows; lines 1–429.
- `apps/labs/semantica/test/Ledger.test.ts`: 1 review rows; lines 1–91.

RuntimeLayer builds infrastructure, input services, canaries, an in-memory native DuckDB vector service and Oxigraph RDF composition. Several narrow config/input checks therefore acquire more than their stated subject needs; no isolated rebuild cost was measured. The scoped wrapper builds once per call, not once per package. F1/PDF artifact checks and cache locks retain real disk/PID/mTime/rename behavior. LedgerLive nests PGlite under the run/mode directory, so database finalization must precede temporary-root cleanup. Gold/model extraction tests inject typed services; replay has exact call counts or a poison provider. Neither proves actual external API operation. Native projection and Bun/EYE subprocess tests remain separate integration subjects. MemoryFS cannot by itself prove native locking, SQL persistence, process termination or oracle behavior. ProviderCache installs a fresh TestClock per wrapper build; sharing it in a suite would require renewed ownership review.

Review proposals:

- **L-RES-01** `C0Input.test.ts:126` (minor, confidence 0.95): The input tests build RuntimeLayer for parser/catalog/chunker work; its full composition also provides native in-memory DuckDB, RDF and canary services. Review a minimal input-service suite layer and preserve scoped acquisition, real F1 bytes/PDF parsing and Crypto. No measured speedup is claimed. ParserRetryLive itself is Layer.succeed, so returning that parser from its short scope does not demonstrate a scoped-resource escape.
- **L-PROP-03** `C0Input.test.ts:369` (minor, confidence 0.95): The generated Unicode slice-back law uses raw runs:30 without shared floor/seed handling. Preserve at least 30 trials, the filtered nonblank domain, all fixed heading/sentence cases and the actual Canonicalizer/Chunker context; use native arbitrary options with fcRuns. Do not reduce to schema membership.
- **L-OBS-01** `C0Input.test.ts:371` (minor, confidence 0.95): The generated check exposes only its _tag then Passed, losing the returned counterexample/replay details. Preserve the Unicode conjunction and 30-run floor through pinned property diagnostics; distinguish fixture setup failures from generated-law failures.
- **L-PROP-03** `C0Slice.test.ts:58` (minor, confidence 0.95): RuntimeMode generation omits options; preserve the pinned native default 100 runs and apply fcRuns floor/seed options. Keep the separate exact live/replay report digest, six-call oracle, all nine fixture outcomes and missing-cache/missing-gold failures unchanged.
- **L-OBS-01** `C0Slice.test.ts:58` (minor, confidence 0.95): The RuntimeMode check keeps only Passed and omits native counterexample/replay context. Preserve the actual schema predicate and 100-run default floor in named property diagnostics. The separate live-to-replay test already provides exact report, telemetry and call-count evidence.
- **L-RES-01** `Canary.test.ts:37` (minor, confidence 0.95): Config assertions acquire the entire RuntimeLayer, which includes DuckDB/RDF/canary composition. Consider a minimal config layer for value assertions while retaining a separate full-runtime build conformance case. Command routing tests still need their exact command environment and injected workflows; do not infer purity from RuntimeLayer name or share mutable database state blindly.
- **L-PROP-03** `Canary.test.ts:135` (minor, confidence 0.95): The paired CanaryStage/CanaryOptions membership check uses raw runs:25. Preserve at least 25 cases and exact option round trips while threading shared fcRuns floor/seed. Routing stubs prove the selected workflow was reached, not correctness of every forwarded option; preserve that coverage limit.
- **L-OBS-01** `Canary.test.ts:137` (minor, confidence 0.95): Only the generated result tag survives; retain native failure/replay context and identify both Stage and Options inputs. Keep explicit typed routing failures and exact wire round trips; do not invent full Cause values.
- **L-PROP-04** `Extractor.test.ts:249` (minor, confidence 0.95): The repeated-endpoint test compares O.map(relation, ...) with O.all(subject, object).map(O.some). Both can be None if no relation exists and an expected-position endpoint is absent, even with two unrelated entity claims and no degradation. Assert relation, subject and object presence first, then preserve exact endpoint IDs/positions and the existing equality and entity count. Production groundRelation constructs all three from evidence-local anchors; this is a regression-oracle gap, not a demonstrated production failure.
- **L-PROP-03** `Fixtures.test.ts:201` (minor, confidence 0.95): FixtureMediaType generation uses raw runs:12. Preserve the 12-run minimum and shared seed/floor options, together with unsorted/duplicate/hash/path negatives and all three byte-identical PDF fixtures. Do not replace independent artifact oracles with schema self-validity.
- **L-OBS-01** `Fixtures.test.ts:203` (minor, confidence 0.95): The media-type property discards native result detail by checking only Passed. Keep replay/counterexample context in its own named property; preserve typed ManifestDrift/F1Drift identities and exact colliding fixture IDs in the other cases.
- **L-PROP-03** `Gold.test.ts:234` (minor, confidence 0.95): CorpusPaperId generation uses raw runs:20. Preserve at least 20 trials with shared fcRuns floor/seed; keep exact 18-job, 41-total/33-accepted, partial-rerun, mixed-proposer and quote-anchor negative controls unchanged.
- **L-OBS-01** `Gold.test.ts:235` (minor, confidence 0.95): The paper-ID property reduces the native result to Passed. Retain counterexample/replay formatting without weakening exact gold-generation failure reasons. Committed 21/377 verified-label evidence is artifact consistency, not independent model accuracy proof.
- **L-PROP-03** `GoldSource.test.ts:114` (minor, confidence 0.95): Gold-source paper-ID generation uses raw runs:20 without shared floor/seed plumbing. Preserve 20 minimum and exact selected-file equality plus read-failed/stale-reference/digest-failed negatives; use fcRuns native options.
- **L-OBS-01** `GoldSource.test.ts:115` (minor, confidence 0.95): The generated ID check retains only Passed; retain native counterexample/replay details. Other gold-source tests already name and assert the precise failure reason, so do not collapse those to generic failure.
- **L-PROP-04** `Ledger.test.ts:85` (minor, confidence 0.95): The conflicting-row test asserts the error but never rereads the row. A regression that overwrites committed data before failing could pass. After the same failed append, read the snapshot and assert the original invalid-utf8 outcome/event identity remains unchanged, preserving the conflicting-row error and both append operands. No new runtime failure is claimed.
- **L-RES-04** `Projection.test.ts:96` (minor, confidence 0.95): Preserve actual DuckDB in-memory SQL and Oxigraph SPARQL engines as projection subjects, with scoped connection ownership. These are not interchangeable with MemoryFS or a mocked query service. Embedding cache behavior separately uses injected provider/cache refs and a poison replay provider; share only proven immutable outer dependencies, retaining per-test model/vector isolation.
- **L-FLAKE-02** `ProviderCache.test.ts:79` (minor, confidence 0.85): The clock helper advances four seconds then gives native I/O a live 10 ms wait, up to 100 polls; callers also sleep live 10 ms before advancing. Replace only unexplained scheduling slack with observable contender/winner or filesystem progress barriers while preserving real lock I/O, the seven-retry production window, fresh TestClock, fork/join and timeout-vs-success assertions. Existing Deferred-coordinated reclaim tests show a suitable seam. The historical timeout is not proof these current waits caused it; no retries, larger timeouts or fake native filesystem proof.
- **L-OBS-01** `ProviderCache.test.ts:84` (minor, confidence 0.95): If the bounded contender wait fails it reports only not settled after 100 advances. Preserve the live watchdog and attach scenario/last completed filesystem phase/retry progress without dumping response or credential data. The retained historical timeout named this test but not the blocked operation; causal reproduction remains absent. Do not advance TestClock for the watchdog.
- **L-OBS-03** `Reasoning.test.ts:142` (minor, confidence 0.95): The runtime child completes provideServices and its scoped ledger finalizers before emitting projection-state-committed and SIGKILL. Describe this as post-close committed-state recovery; do not call it a crash during open transaction or unflushed database recovery. Preserve all current assertions and native kill semantics. Any stronger crash window needs separately authorized instrumentation, not an assertion deletion.
- **L-PROP-03** `Schema.test.ts:606` (minor, confidence 0.95): The representative DocumentId/DegradedKind/MetricName property uses raw runs:25. Preserve at least 25 cases with shared floor/seed options. Keep the extensive independent wrong-digest, endpoint, model, subset, metric-coordinate, document-coverage and width negatives, plus schema-defined equivalence; do not replace them with self-membership.
- **L-OBS-01** `Schema.test.ts:608` (minor, confidence 0.95): The representative property preserves only Passed; retain native counterexample/replay context. The roundTrip helper also serves many schemas, so retain schema/case identity when adopting diagnostics and preserve its declared equivalence alternative rather than force raw structural equality.

Retained Root baseline: 131 registered tests, zero failed, exit 0; 12.319039444 whole-command seconds. All 15 test files are represented in the reporter. The two support entrypoints are fully source-audited and invoked by the reasoning source, but are not separate reporter registrations. Reporter SHA256 5548f16b9f3930ab52bf214e7de453b1fb5720945cf263981182db2b8988fd02. Recorded runtime Node22.22.3/Bun1.4.2/Vitest4.1.11. This lane did not execute tests; success counts alone do not independently prove every native child path or provider request.

One retained historical observation in one job: ProviderCache “fails with a lock wait timeout after the live-lock retry window expires,” August 26, 2026, timed out in 30000ms ([job](https://github.com/beep-effect/beep-effect/actions/runs/33008568153/job/98308604289)). Historical head 0b429e32e08138dee6d139c0764472d535a6bf05 and Node24.19.0 differ from current baseline. The current test uses a TestClock/live-I/O bridge; no reproduction or causal equivalence is established. Do not mark the historical failure fixed or call it a proven flake.

Timing collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. CIops, Effect Drizzle and QA Capture remain failed. Hosted evidence covers 527 failed runs, 21 unavailable logs and one unresolved cause. Observations are not unique flakes; coverage-path observations are not named test failures. A passing run does not prove full package proof, browser execution, live provider execution or absence of rare failures. No timing/history collection was rerun.

Original strict validation was interrupted during a host filesystem wait and remains preserved as failed evidence. Fresh post-reboot public decoder/encoder validation passed all 68 unchanged rows. Root's combined strict validation also passed with no input drift; metadata checks do not substitute for that proof.

P2 order remains scope → assertions → property → flake → observability. Preserve native subjects while narrowing unrelated layer acquisition; add positive relation presence and post-conflict persistence oracles without deleting original assertions; preserve all property floors and invalid-boundary cases; replace unexplained clock/I/O scheduling slack only with evidenced events; retain property replay and scenario phase context. No retries, longer timeouts, lower thresholds, assertion deletion or P2 migration is authorized.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; 100-entry graph. Vitest4 is a recorded runtime, not a supported-peer claim. Remaining uncertainty: native execution/reproduction, historical causality and actual performance effects. The crash child closes the scoped ledger before SIGKILL, so its proof is post-close committed-state persistence.

Root accepted these P1 rows after full report/digest review, source and artifact verification, and combined strict validation. Full P1 completeness, Grok review and Benjamin acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
