# Instance

- id: `ai-metrics-scorecard-readiness`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/models.ts:1023`
- symbol: `Scorecard`
- members: `completionReady`, `taskCount`, `labelCount`, `benchmarkRunCount`
- evidence: E4 at `scorecard.ts:1055-1115,1234-1280` — labels imply tasks and ready implies all three positive in weekly production; E1 at `models.ts:997-1019` is the documented/defaulted false/111 compatibility counterexample to an iff readiness claim.

# Current shape

`Scorecard` is an exported class schema for weekly or config-impact review. It stores three nonnegative counts and a default-false readiness bit beside scores, weights, coverage gaps, ids, and window bounds (`models.ts:994-1043`). The weekly writer derives the bit at `scorecard.ts:1263-1280`, persists all four values in DuckDB at 1287-1335, renders them in Markdown at 1340-1369, and nests the scorecard in the weekly JSON document written at 1428-1490.

The weekly config-ID union at `scorecard.ts:1433-1455` emits no Scorecard when both aggregate sets are empty, so 000 has no producer. Nonnegative count schemas alone do not establish an empty Scorecard contract. The supported constructor-only state is false/111: the documented `Scorecard.make` example at `models.ts:997-1019` supplies task 10, labels 6, and benchmarks 4 while omitting `completionReady`; `BoolKeyDefaultFalse` gives that decoded value false.

# Cardinality gap

Treat each count as zero or positive. The boolean plus three presence axes represent 16 coarse tuples. Six are legitimate:

| kind | tasks | labels | benchmarks | completionReady |
| --- | --- | --- | --- | --- |
| `complete-untrusted` | >0 | >0 | >0 | false |
| `benchmark-only` | 0 | 0 | >0 | false |
| `tasks-unlabelled` | >0 | 0 | 0 | false |
| `tasks-unlabelled-with-benchmarks` | >0 | 0 | >0 | false |
| `labelled-without-benchmarks` | >0 | >0 | 0 | false |
| `complete-ready` | >0 | >0 | >0 | true |

The task aggregate starts from tasks and left-joins labels (`scorecard.ts:1055-1086`), so labels cannot be positive when tasks are zero. Benchmark aggregation is independent (`scorecard.ts:1089-1115`). Weekly readiness is true only for 111 (`scorecard.ts:1234-1242`), while the documented default makes false/111 independently legal. Exact numeric counts remain payload. The other ten tuples, including 000, have no supported constructor, writer, fixture, or semantic reader.

# Target schema

Add an annotated `ScorecardReadinessKind` LiteralKit with the six literals above and build six `S.Class` cases combined through `S.toTaggedUnion("readiness")`. Each case retains the exact count payload and uses zero/positive schemas appropriate to the case. Keep all score, weight, coverage, id, and window fields common. Remove `completionReady` from decoded state and expose a derived `scorecardIsCompletionReady` guard matching only `complete-ready`.

Use a private encoded Scorecard schema with the current field names, defaults, order, and types. A fallible `S.decodeTo` transform classifies the six supported tuples, verifies the readiness bit, rejects label-without-task and mismatched readiness tuples, and encodes the exact inverse.

# Migration inventory

- `models.ts:994-1043` — introduce the six-case readiness model and compatibility transform while preserving the public `Scorecard` schema name and neighboring payload.
- `scorecard.ts:1192-1242` — replace the parallel count/readiness calculation with one case classifier; keep coverage-gap computation separate because coverage includes independent model-call, tool, and cost evidence.
- `scorecard.ts:1244-1285` — construct one readiness arm while preserving all score calculations and row-id inputs.
- `scorecard.ts:1287-1369` — bind the same SQL columns and render the same table values, deriving the boolean from the case.
- `scorecard.ts:1428-1490` — preserve config-id union, concurrency, persisted writes, report JSON, and empty-report behavior.
- `test/ingest.test.ts:1080-1130,1740-1790` and scorecard schema tests — migrate decoded assertions and add the corrected compatibility table, including both 111 judgments and excluding 000.

# Guard-deletion accounting

Delete the stored decoded `completionReady`, its local at `scorecard.ts:1267`, and direct boolean writes. Replace reader checks with the derived ready-case guard. Retain the three numeric counts because consumers display and diagnose them. Retain `coverageGapsFor`; it contains independent coverage facts and is not equivalent to readiness.

# Encoded-side impact

Tier 2 persisted and JSON compatibility. Keep DuckDB columns `task_count`, `label_count`, `benchmark_run_count`, and `completion_ready`, including the existing false backfill at `derived-storage.ts:430-460`. For exact-count payloads in all six cases, compare old/new canonical `encode(decode(payload))`, including property order and the documented omitted-readiness 111 constructor becoming decoded false and serialized with the existing `completionReady` behavior. Preserve missing-key decode default false, explicit booleans, SQL bind values, and weekly JSON bytes. Reject the other ten tuples, including 000 and true with incomplete counts.

# Test impact

Add the six corrected codec rows, ten invalid rows, exact counts, and direct proof of documented omitted-readiness false/111. Keep weekly task-only, benchmark-only, mixed-ready, empty-report/no-row, Markdown, JSON privacy, stable-ID, and readiness default/backfill tests; assert the legacy fixture's NULL numeric columns do not decode as 000. Assert SQL writes and JSON encoding preserve the old boolean and count keys.

# Risk and sequencing

Land after the AI-metrics Tier 1 work as a single Tier 2 Scorecard codec change. The main risk is conflating readiness with coverage gaps; preserve independent coverage calculation and payload. Preserve false/111 as distinct from ready/111; do not admit 000 from permissive count fields or change SQL schema, report version, scoring, defaults, or config-ID discovery.
