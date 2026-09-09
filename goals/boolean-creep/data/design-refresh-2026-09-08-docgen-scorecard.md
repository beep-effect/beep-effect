# Boolean-creep design refresh: Docgen and Scorecard

Source reviewed: `7440cb8c4302ce64b87860069a464bafbf65f576`
Corpus `origin/main`: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

This handoff records the bounded P2 source audit for seven canonical designs. It does not perform formal P3 review or modify source, tests, inventory, status, dependencies, generated files, or git state.

## Scorecard findings

### `ai-metrics-scorecard-readiness`

`Scorecard` declares `[completionReady,taskCount,labelCount,benchmarkRunCount]` at `packages/tooling/library/ai-metrics/src/models.ts:1023-1039`. Task aggregation starts from tasks and left-joins labels at `scorecard.ts:1055-1086`, proving label-positive => task-positive (E4). Benchmarks are independently aggregated at 1089-1115. The weekly producer computes readiness as all three counts positive at 1234-1242 and writes that value at 1263-1280 (E4).

The exported constructor supplies compatibility counterevidence (E1), rather than exclusive-write qualification: `models.ts:997-1019` supplies task 10, labels 6, and benchmarks 4 while omitting `completionReady`; `BoolKeyDefaultFalse` supplies false at construction and when decoding a missing key. Therefore false/111 must remain distinct from weekly-produced true/111. DuckDB's false default and NULL backfill at `derived-storage.ts:438-460` also preserve readiness independently of numeric counts.

The exact supported table is 16 representable / 6 legal:

| tasks | labels | benchmarks | readiness | disposition |
| ---: | ---: | ---: | --- | --- |
| 0 | 0 | >0 | false | benchmark-only |
| >0 | 0 | 0 | false | tasks-unlabelled |
| >0 | 0 | >0 | false | tasks-unlabelled-with-benchmarks |
| >0 | >0 | 0 | false | labelled-without-benchmarks |
| >0 | >0 | >0 | false | complete-untrusted |
| >0 | >0 | >0 | true | complete-ready |

The former draft's 000 state was inferred only from zero-accepting count fields. Weekly generation iterates the union of observed task/benchmark config IDs at `scorecard.ts:1433-1455` and emits no row when the union is empty. The legacy fixture at `test/ingest.test.ts:1741-1773` creates only `scorecard_id`; migrated numeric columns remain NULL, so it is not a valid numeric 000 Scorecard. No writer, fixture, documentation, or semantic reader supports 000.

The corrected design uses one six-value `ScorecardReadinessKind` owner. It preserves exact numeric counts and all neighboring payloads, the documented constructor/missing-key false default, explicit serialized booleans, DuckDB columns, SQL bind values, Markdown, weekly JSON, and property order. A live schema probe of the documented omitted-readiness 111 constructor returned decoded false and an encoded object with its own `completionReady: false` key. Schema-derived arbitrary tests use the six cases and cannot regenerate the ten unsupported tuples.

### `ai-metrics-scorecard-summary-readiness`

`AgentEffectivenessScorecardSummary` repeats the cluster at `agent-effectiveness.ts:820-838`. `ScorecardSummaryRow` decodes raw persisted aliases at 2035-2052, and `buildAiMetricsSection` copies all four values at 2698-2742. The summary documentation at 783-793 calls readiness the scorecard's own trust judgment and tells callers to check it before interpreting the score (E1/E2). Warnings, telemetry, and Phoenix dataset rows read the raw judgment at 2754-2764, 3032-3050, and 3391-3412.

The summary therefore reuses the same 16/6 owner, including separate complete-untrusted false/111 and complete-ready true/111 cases. It must not recompute a persisted false/111 row as ready. An empty query result becomes `latestScorecard: None`/JSON null. NULL or invalid numeric rows fail `ScorecardSummaryRow.decodeRowsEffect` through the existing typed error path; they are never normalized to None or 000. The design preserves SQL aliases, exact counts/readiness, warning order, telemetry names, dataset values, doctor JSON fields/order, and the existing typed decode/encoding errors.

## Docgen findings

### `docgen-generation-outcome`

`DocgenGenerationResult` at `Docgen.schemas.ts:392-404` exposes eight combinations of success, error presence, and module-count presence. Its three writers at `internal/RunDocgen.ts:71-115` support only success-with-count and failure-with-error. `Docgen.render.ts:113-129` partitions on success and then reads the matching payload. `output` is independently optional on both arms. The Tier 1 design uses a two-case internal union, deletes optional payload fallbacks, and preserves logging, failure counts, and process error recovery. There is no encoded surface.

### `docgen-subject-collection-outcome`

`PackageSubjectCandidateResult` at `quality/Quality.subjects.ts:847-859` uses the shared three-value package status but writes only completed/false/null and partial/true/message at 906-954. Failure remains in the Effect channel and becomes a package-report failure later. This gives 12 representable and two legal outcomes. The Tier 1 design reuses the existing status owner for its completed and partial discriminators while retaining a separate collector union and partial candidates. The post-collection budget check remains because time may expire during finalization.

### `docgen-worker-packet-review`

`PacketCandidate` at `QualityWorkerEval.ts:530-540` stores `review: Option<pass | warn | fail>` and derives `isFail` from it at 693-731, giving eight representable and four legal pairs. The Tier 1 design models none/pass/warn/fail explicitly, derives failure priority from the case, and preserves the comparator and package-stratified selection at `quality/Quality.service.ts:55-78` and `QualityWorkerEval.ts:752-785`. The internal candidate shape is not emitted in worker JSON.

### `docgen-quality-package-outcome`

`DocgenQualityPackageReport` at `quality/Quality.schemas.ts:486-502` has 12 status/timedOut/error-presence tuples. `analyzePackageQuality` writes exactly completed/false/null, partial/true/message, and failed/false/message at `Quality.service.ts:267-309`. The enclosing report is JSON-encoded, printed or written, then decoded by saved-report worker eval (`Quality.schemas.ts:557-571`, `Quality.render.ts:55-56`, `Docgen.command.ts:760-818`, `QualityWorkerEval.ts:38,1129-1159`).

The Tier 2 design keeps the shared `DocgenQualityPackageStatus` LiteralKit and creates a separate three-case report compatibility schema. It preserves schema version 2, every encoded property name/value/null, property order, pretty output, stdout/file behavior, and check-after-emission precedence. It does not merge this model with the two-case subject collector.

### `docgen-runpod-cleanup-outcome`

`DocgenQualityWorkerRunpodEvalCleanup` at `QualityWorkerRunpodEval.ts:170-183` has 36 combinations once error null/string is included: keepPod × three delete statuses × three stop statuses × error presence. The legal five are kept/both-skipped/null and the four independent completed/failed stop-delete pairs; error is null only when kept or both operations complete. `cleanupRunpodPod` calls stop first and delete second even when stop fails, then joins synthetic error messages in that order (`QualityWorkerRunpodEval.ts:739-797`). `cleanupSkipped(false)` is only the internal pre-acquisition Ref sentinel and has the same encoded fields as the both-failed case; it adds no sixth state.

The Tier 2 design uses five cases behind an exact legacy JSON transform. It preserves both independent operations, stop-before-delete order, delete-after-stop-failure behavior, cleanup-first recommendation precedence at 966-980, the enclosing wrapper version and fields, and stable JSON output at 1190-1300. Tests use only fake Runpod services and synthetic errors; no remote call or real credential is needed.

## Sequence and compatibility proof

The serial application order is:

1. Tier 1: `docgen-generation-outcome`.
2. Tier 1: `docgen-subject-collection-outcome`.
3. Tier 1: `docgen-worker-packet-review`.
4. Tier 2: `docgen-quality-package-outcome`.
5. Tier 2: `docgen-runpod-cleanup-outcome`.
6. Tier 2: `ai-metrics-scorecard-readiness`.
7. Tier 2: `ai-metrics-scorecard-summary-readiness`, reusing the Scorecard owner.

Each Tier 2 design requires whole-object old/new canonical `encode(decode(payload))` comparisons over every legitimate case, including neighboring payload and property order. The Scorecard designs additionally compare SQL bind/read values; the package report verifies saved quality-report decoding; cleanup verifies full wrapper JSON. Incoherent legacy tuples are rejected because no current writer, fixture, or documented consumer assigns them meaning.

The raw `exampleOnlyVoidsResult` / `exampleHasObservableResult` item is excluded: `Quality.rubric.ts:50-68` defines separately callable predicates rather than sibling boolean values in one carrier.

## Files written

- `goals/boolean-creep/designs/ai-metrics-scorecard-readiness.md`
- `goals/boolean-creep/designs/ai-metrics-scorecard-summary-readiness.md`
- `goals/boolean-creep/designs/docgen-generation-outcome.md`
- `goals/boolean-creep/designs/docgen-quality-package-outcome.md`
- `goals/boolean-creep/designs/docgen-subject-collection-outcome.md`
- `goals/boolean-creep/designs/docgen-runpod-cleanup-outcome.md`
- `goals/boolean-creep/designs/docgen-worker-packet-review.md`
- `goals/boolean-creep/data/design-refresh-2026-09-08-docgen-scorecard.md`

## Verification

All seven owned designs contain the required current-shape, cardinality, target-schema, migration-inventory, guard-deletion, encoded-impact, test-impact, and risk sections. `git diff --check` passes for the owned files.

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed after canonical admission with `design coverage OK: 149 qualified ids`.
