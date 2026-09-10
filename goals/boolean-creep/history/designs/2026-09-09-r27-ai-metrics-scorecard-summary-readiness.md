# Instance

- id: `ai-metrics-scorecard-summary-readiness`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:820`
- symbol: `AgentEffectivenessScorecardSummary`
- members: `completionReady`, `taskCount`, `labelCount`, `benchmarkRunCount`
- evidence: E4 at `scorecard.ts:1055-1115,1234-1280` supplies label/task and ready/positive implications; E1/E2 at `agent-effectiveness.ts:783-813,2035-2052,2698-2764` preserves readiness as its own copied trust judgment, including false/111.

# Current shape

The exported summary schema repeats the persisted Scorecard readiness bit and three counts beside identity, score, coverage gaps, and window fields (`agent-effectiveness.ts:780-838`). `ScorecardSummaryRow` decodes the SQL aliases at 2035-2052; `buildAiMetricsSection` reads the latest row and copies every field into the summary at 2698-2742. The summary is nested through `AgentEffectivenessAiMetricsSection.latestScorecard` and encoded in doctor JSON by `AgentEffectivenessDoctorReport.encodeJsonEffect` (`agent-effectiveness.ts:1087-1109,4332-4345`). Readiness warnings, telemetry, and Phoenix dataset rows read it at 2754-2764, 3032-3050, and 3391-3412.

# Cardinality gap

The summary has the same 16 coarse tuples and six supported states: benchmark-only false/001, tasks-unlabelled false/100, tasks-unlabelled-with-benchmarks false/101, labelled-without-benchmarks false/110, complete-untrusted false/111, and complete-ready true/111. The last pair preserves readiness as the scorecard's own trust judgment (`agent-effectiveness.ts:783-793`) rather than recomputing it from counts.

The weekly config-ID union emits no row for an empty window. The legacy migration fixture creates only `scorecard_id`; added numeric columns remain NULL and fail `ScorecardSummaryRow`'s finite-number decoder. Therefore 000 is not a summary value. An empty query result becomes `latestScorecard: None`/JSON null; a row with NULL or invalid counts fails `ScorecardSummaryRow.decodeRowsEffect` through the existing typed error path and is not normalized to None.

# Target schema

Reuse the Scorecard readiness case owner introduced by `ai-metrics-scorecard-readiness`; do not define a second six-literal vocabulary. Model `AgentEffectivenessScorecardSummary` as six annotated cases discriminated by the same `readiness` literal, including distinct `complete-untrusted` and `complete-ready` 111 arms and exact nonnegative count payloads. Expose a derived ready guard for consumers.

Keep private legacy encoded schemas for both `ScorecardSummaryRow` and the public summary JSON shape. Decode SQL/JSON through a fallible transform that accepts the six supported rows without recomputing readiness and preserves the distinction between an empty row array (`None`/JSON null) and a typed row-decode failure. Encode the exact old object with `completionReady` and three numeric count fields.

# Migration inventory

- `agent-effectiveness.ts:780-838` — replace the parallel summary fields with the shared readiness cases and compatibility codec; preserve public naming and documentation semantics.
- `agent-effectiveness.ts:856-892,1087-1109` — retain `latestScorecard` Option-from-null and doctor JSON nesting.
- `agent-effectiveness.ts:2035-2052` — keep SQL aliases and decode the legacy row shape before classifying it.
- `agent-effectiveness.ts:2698-2764` — construct the matching summary case and derive warnings without re-correlating four fields.
- `agent-effectiveness.ts:3032-3050,3391-3412` — derive telemetry and outcome-dataset readiness from the case; keep all names and values.
- `agent-effectiveness.ts:4332-4345` and command writers — preserve doctor JSON encoding and output/error order.
- `test/agent-effectiveness.test.ts:74-124`, `test/agent-effectiveness-laws.test.ts:20-55`, and command JSON tests — update decoded expectations and add SQL/JSON compatibility coverage.

# Guard-deletion accounting

Delete the decoded summary `completionReady` field, the direct copy at `agent-effectiveness.ts:2732`, and boolean branches at 2759, 3046, and 3404-3407. Replace them with the shared case guard. Keep latest-scorecard Option checks for an empty result set and keep row-decode failures in the typed error channel. Keep count checks that produce the distinct `no_labels` and `no_benchmark_runs` warnings.

# Encoded-side impact

Tier 2 SQL-reader and JSON compatibility. For all six supported cases, seed the existing SQL column names and values, decode through `ScorecardSummaryRow`, build the doctor report, and compare old/new canonical doctor JSON. Preserve `completionReady`, all count keys, null for missing latest scorecard, key order, coverage gaps, and window values. The existing task-only fixture at `test/agent-effectiveness.test.ts:74-124` proves 100 carry-through; add both 111 judgments and the remaining three incomplete-evidence cases. Assert NULL numeric migration rows fail decoding rather than becoming 000. Reject the ten incoherent rows at the boundary with the existing typed agent-effectiveness failure mapping.

# Test impact

Cover six supported SQL-to-summary-to-JSON rows, ten invalid rows, exact counts, false/111 preservation, and NULL-count rejection rather than 000. Retain invalid coverage-gaps fallback, readiness warning order, telemetry attribute names, outcome-dataset values, required-null Option encoding, and doctor command JSON tests.

# Risk and sequencing

Implement serially after `ai-metrics-scorecard-readiness` so this design reuses its readiness owner and codec laws. Do not recompute false/111, admit 000, or alter the database query, latest-row ordering, doctor version, warning precedence, coverage gaps, or annotation datasets.
