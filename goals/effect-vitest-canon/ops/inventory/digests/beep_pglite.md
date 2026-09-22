# @beep/pglite — P1 four-lens digest

Audited 3 files completely. Root accepted the source inventory after strict validation and hash checks.
All rows remain open judgments. P2 requires Benjamin’s acknowledgement of complete P1.

| Lens | Rows | Actionable | Coverage only |
|---|---:|---:|---:|
| resource | 3 | 2 | 1 |
| flake | 3 | 0 | 3 |
| property | 3 | 1 | 2 |
| observability | 3 | 2 | 1 |

Severity: info 7, minor 5.

Top files (all files; fewer than ten):

- `packages/drivers/pglite/test/Pglite.equivalence.test.ts`: 4 rows.
- `packages/drivers/pglite/test/PgliteClient.test.ts`: 4 rows.
- `packages/drivers/pglite/test/integration/PgliteClient.persistent.test.ts`: 4 rows.

This is a native in-process SQL adapter, not a mock server or container. PgliteClient.service.ts:94-97 delegates to @effect/sql-pglite; makeLayer (126-132) publishes the same native client under PGlite, generic SqlClient and PgClient tags. PgliteTestLayer is makeLayer({}), not a second fixture framework. The installed adapter's make (165-184) constructs PGlite, awaits waitReady and registers pg.close on scope release. Source topology implies five native client builds across the successful cohort: one explicit lifecycle probe, one shared in-memory block for two tests, two clients at one persistent dataDir, and one Drizzle client. This is a code-path count, not acquisition profiling. Retained file durations combine other work and do not measure per-build cost.

The manual Scope.make in PgliteClient.test.ts:43 has only a later normal-path Scope.close. A managed explicit-scope boundary should provide fallback finalization while retaining the early close and failed SELECT 1 witness. This review did not inject acquisition failure or prove an observed leak. Sharing the client at suite level would remove the lifecycle subject and is not the remedy. The shared in-memory block's SQL writer and alias-identity reader do not assert each other's database state; global concurrent defaults alone are not evidence of a race.

Persistence is an affirmative native boundary. The first test creates a unique scoped temp directory, writes through one complete client lifetime, reopens the same dataDir through another, then checks durable hello. The Drizzle test has a separate temp directory and preserves beta:1 before alpha:2. Native PGlite uses its own filesystem internally; Effect MemoryFileSystem is not a drop-in storage backend here. Resolve EV010/EV002/EV003 by separating shared outer Node services from deliberate inner database close/reopen lifetimes. Keep temp directory cleanup outside both database scopes. Existing package hookTimeout is 30000ms; EV014's missing inline option is not proof that acquisition is currently unbounded, and the lifecycle case's 90000ms body setting must remain unchanged.

The round-trip arbitrary filters every Some(cause) out. Production PgliteError models an optional Defect payload (Pglite.errors.ts:49-60), so cause-bearing codec behavior is untested by that property. Keep the None property and fcRuns(50), add constrained production-schema Some cases and compare codec stability/retained fields. Do not confuse opaque-cause exclusion from declared-field equivalence with permission to drop cause payload from serialization tests. The separate equivalence file correctly proves that differing cause text is not identity.

P2 order: managed explicit scope and native-boundary preservation; keep the early-close Failure witness and exact SQL/tag-identity assertions; extend cause-bearing properties without reducing floors; diagnose only actual native initialization/cleanup failures; adopt instrumented it with acquisition/close/reopen/query phase labels. No MemoryFS substitution, database acquisition, failure replay, configuration change or P2 edit happened in this audit.

## Retained timing and hosted evidence

Root accepted this configured Node baseline: 8 registered/passed tests, command 5.415944s, reporter span 5037.509ms. Every assigned source test file is represented; none of these packages is a configured subset or failed attempt. Node22.22.3/Bun1.4.2/Vitest4.1.11, CI=true, BEEP_FC_SEED=20260708; the recorded timing attempt had no BEEP_FC_NUM_RUNS override. Worker pool forks, file parallelism true, max concurrency 5, concurrent sequence default true and isolation true. These settings are capacity/configuration, not proof of simultaneous execution.

File reporter durations:

- `packages/drivers/pglite/test/Pglite.equivalence.test.ts`: 1.059ms / 1 tests.
- `packages/drivers/pglite/test/PgliteClient.test.ts`: 1199.615ms / 5 tests.
- `packages/drivers/pglite/test/integration/PgliteClient.persistent.test.ts`: 1413.509ms / 2 tests.

Host context: maximum load1 20.435; minimum available memory 73.638GiB; sampled max avg10 PSI {'cpu': 1.27, 'memory': 0.0, 'io': 0.45}. Values are retained, not subtracted from duration or used to infer a CI speedup. No new timing was collected.

Hosted history maps 0 observations across 0 jobs to this package; categories {}. These are coverage-ratchet observations, not test-failure or unique-flake counts. Zero mapped observations does not prove absence of failures. The global 527 failed-run collection retains 21 unavailable logs and one unresolved downloaded cause; full causal attribution is false. No current test flake is established here.


Root verified source bounds and retained input/output hashes. Complete proposed
findings are in the four lens JSONL files; source snippets were not executed. Current Vitest4.1.11 remains outside rc113's declared Vitest5 peer range, with the retained tested-cohort qualification. Neither the passing timing baseline nor this static audit is package, coverage, race-freedom or phase acceptance.

The [baseline](../timings/baseline/beep_pglite.json) and
[timing context](../timings/context/baseline/beep_pglite.json) retain the measured cohort.
