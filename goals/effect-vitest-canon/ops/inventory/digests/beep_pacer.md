# @beep/pacer — P1 four-lens digest

Audited 2 files completely. Root accepted the source inventory after strict validation and hash checks.
All rows remain open judgments. P2 requires Benjamin’s acknowledgement of complete P1.

| Lens | Rows | Actionable | Coverage only |
|---|---:|---:|---:|
| resource | 3 | 2 | 1 |
| flake | 2 | 0 | 2 |
| property | 3 | 2 | 1 |
| observability | 2 | 1 | 1 |

Severity: info 5, major 3, minor 2.

Top files (all files; fewer than ten):

- `packages/drivers/pacer/test/Pacer.test.ts`: 6 rows.
- `packages/drivers/pacer/test/Pacer.equivalence.test.ts`: 4 rows.

The 14 named layer blocks intentionally select different deterministic HTTP scenarios. makePacerLayer composes auth, scoped session and PCL layers (Pacer.layer.ts:44-49). Session acquisition logs in and allocates tokenRef; its finalizer reads the latest token, awaits logout and ignores/logs logout errors (PacerAuth.service.ts:177-195). The mock transport is Layer.succeed, but that does not make the complete session composite pure. makePacerMockHttpClient constructs the case pages before returning the layer (Pacer.mock.ts:577-586); sharing unlike scenarios would change behavior. The dedicated observer Refs have separate one-case blocks, so no current cross-test contention was identified from those Refs alone. Rebuild costs are structural, not measured per-layer costs.

The logout-finalizer case deliberately completes an inner layer scope before checking count 1 and the rotated token. EV002/EV003 cannot be removed by moving that session into a suite-wide scope. A separate resource gap is cancellation: existing batch tests prove success and typed-failure cleanup, while PclClient.service.ts:286-295 uses Effect.result followed by cleanup. Pinned Effect.ts:2245-2249 says interruption and defects escape Result. Add a controlled interruption-after-report-creation witness in P2; no runtime reproduction was run here. If it fails, production lifetime repair needs separate Root scope approval; do not weaken the existing cleanup assertions.

The two error-mapping properties at lines 125 and 136 omit arbitrary options. rc113's native runner defaults to 100 runs and independently resolves a seed; it does not consult BEEP_FC_NUM_RUNS/BEEP_FC_SEED. Preserve every current input and assertion and use the existing fcRuns() options to honor the PR 400 and nightly floors. The nearby round-trip property already passes fcRuns(). The four fixed 24-value round-trip samples retain their seeds 1001-1004; EV001 migration must not erase them or conflate fixed examples with generated floor proof.

MemoryFileSystem is not a candidate: these tests consume a deterministic HTTP service, not a filesystem. Safe observability adoption should mark auth, page iteration, batch polling and cleanup phases without revealing tokens, bodies or credentials. Existing auth logs already mark session acquisition/release; extra tracing must add actual phase information rather than duplicate those messages.

P2 order: resolve the deliberate inner session boundary and cancellation witness; preserve existing plain-value assertions and typed error operands; supply property options; evaluate any reproduced flake root cause without retries; finally adopt public instrumented it with safe phase metadata. No timeout or floor relaxation is proposed.

## Retained timing and hosted evidence

Root accepted this configured Node baseline: 23 registered/passed tests, command 4.571541s, reporter span 4216.229ms. Every assigned source test file is represented; none of these packages is a configured subset or failed attempt. Node22.22.3/Bun1.4.2/Vitest4.1.11, CI=true, BEEP_FC_SEED=20260708; the recorded timing attempt had no BEEP_FC_NUM_RUNS override. Worker pool forks, file parallelism true, max concurrency 5, concurrent sequence default true and isolation true. These settings are capacity/configuration, not proof of simultaneous execution.

File reporter durations:

- `packages/drivers/pacer/test/Pacer.equivalence.test.ts`: 0.958ms / 1 tests.
- `packages/drivers/pacer/test/Pacer.test.ts`: 349.229ms / 22 tests.

Host context: maximum load1 21.344; minimum available memory 75.346GiB; sampled max avg10 PSI {'cpu': 1.4, 'memory': 0.0, 'io': 0.33}. Values are retained, not subtracted from duration or used to infer a CI speedup. No new timing was collected.

Hosted history maps 5 observations across 2 jobs to this package; categories {'coverage-ratchet': 5}. These are coverage-ratchet observations, not test-failure or unique-flake counts. Zero mapped observations does not prove absence of failures. The global 527 failed-run collection retains 21 unavailable logs and one unresolved downloaded cause; full causal attribution is false. No current test flake is established here.

- Historical evidence: [dated hosted job](https://github.com/beep-effect/beep-effect/actions/runs/32719153529/job/97406665477), head `87d3479f21f440c32582ce2e67093bdad4fb9569`, 2026-08-24T10:54:45Z.
- Historical evidence: [dated hosted job](https://github.com/beep-effect/beep-effect/actions/runs/33746737220/job/100621131987), head `011c166ba736d8817400bf013b0f5fac598f4d14`, 2026-09-03T10:53:39Z.

Root verified source bounds and retained input/output hashes. Complete proposed
findings are in the four lens JSONL files; source snippets were not executed. Current Vitest4.1.11 remains outside rc113's declared Vitest5 peer range, with the retained tested-cohort qualification. Neither the passing timing baseline nor this static audit is package, coverage, race-freedom or phase acceptance.

The [baseline](../timings/baseline/beep_pacer.json) and
[timing context](../timings/context/baseline/beep_pacer.json) retain the measured cohort.
