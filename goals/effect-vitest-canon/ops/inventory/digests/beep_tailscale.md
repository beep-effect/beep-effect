# @beep/tailscale — P1 four-lens digest

Audited 2 files completely. Root accepted the source inventory after strict validation and hash checks.
All rows remain open judgments. P2 requires Benjamin’s acknowledgement of complete P1.

| Lens | Rows | Actionable | Coverage only |
|---|---:|---:|---:|
| resource | 2 | 0 | 2 |
| flake | 2 | 0 | 2 |
| property | 2 | 1 | 1 |
| observability | 2 | 1 | 1 |

Severity: info 6, minor 2.

Top files (all files; fewer than ten):

- `packages/drivers/tailscale/test/Tailscale.equivalence.test.ts`: 4 rows.
- `packages/drivers/tailscale/test/tailscale.test.ts`: 4 rows.

All process-facing tests use in-memory ChildProcessSpawner layers. mockSpawnerLayer returns Layer.succeed and makeHandle values with deterministic streams/exit codes and no-op kill/unref (tailscale.test.ts:33-80). SpawnFailureLayer is another pure stub. StatusTimeoutLayer combines a new TestClock with a never-finishing in-memory exitCode. No Tailscale daemon, OS child, socket or filesystem is acquired by these tests. Thus the five EV014 factory-call candidates need pure-stub provenance judgment; they do not justify a container-style hook budget. No MemoryFileSystem or new external fixture framework is needed.

The clock test forks readTailscaleStatus, yields, advances its clock and joins the child. The file has one timeout case in that named layer block and independent named layer contexts elsewhere. Shared Vitest defaults are concurrent, but this topology alone does not demonstrate a race; nor is single-case topology a blanket EV015 exemption. Keep the scanner judgment for Root, preserve the deterministic timeout subject, and never add an unconditional shared-clock reset or convert to live. Source inspection found no separate flake root cause; no process or timing test was run here.

The generated-test opportunity is the status filter: current examples preserve one valid Tailnet address while filtering IPv6/non-tailnet strings. A bounded property over production TailnetIpv4Address/TailscaleStatusJson can check exact retained order and duplicates in mixed arrays, keeping all four IPv4 literals and malformed JSON/type controls. It must not reimplement the regex as its oracle. This is a coverage opportunity, not a demonstrated parser defect; arbitrary derivation must remain constrained by the production schemas and explicit environment-max floors.

Runtime errors are already carefully structured: tests preserve original spawn cause identity, code/length fields, and negative checks that command/stderr/token text is absent. Keep those operands and polarities. Future D7 adoption should add case/phase context to the parallel stdout/stderr/exit wait without dumping raw causes or arguments. The public @beep/test-utils/Vitest surface preserves tester modes; do not import the source-only test factory. The equivalence file's five synchronous cases intentionally ignore opaque causes and preserve differences in command/timeout fields; no additional resource or watchdog work is indicated there.

P2 order: confirm pure-stub and clock ownership judgments; preserve Option payloads and every error/redaction assertion when applying assertion helpers; add the generated status-filter law; make flake changes only for reproduced causes; adopt safe instrumentation last. No network or process acquisition, skip, retry or timeout change is proposed.

## Retained timing and hosted evidence

Root accepted this configured Node baseline: 19 registered/passed tests, command 4.020402s, reporter span 3661.568ms. Every assigned source test file is represented; none of these packages is a configured subset or failed attempt. Node22.22.3/Bun1.4.2/Vitest4.1.11, CI=true, BEEP_FC_SEED=20260708; the recorded timing attempt had no BEEP_FC_NUM_RUNS override. Worker pool forks, file parallelism true, max concurrency 5, concurrent sequence default true and isolation true. These settings are capacity/configuration, not proof of simultaneous execution.

File reporter durations:

- `packages/drivers/tailscale/test/Tailscale.equivalence.test.ts`: 1.644ms / 5 tests.
- `packages/drivers/tailscale/test/tailscale.test.ts`: 14.568ms / 14 tests.

Host context: maximum load1 19.599; minimum available memory 75.515GiB; sampled max avg10 PSI {'cpu': 0.94, 'memory': 0.0, 'io': 0.45}. Values are retained, not subtracted from duration or used to infer a CI speedup. No new timing was collected.

Hosted history maps 5 observations across 2 jobs to this package; categories {'coverage-ratchet': 5}. These are coverage-ratchet observations, not test-failure or unique-flake counts. Zero mapped observations does not prove absence of failures. The global 527 failed-run collection retains 21 unavailable logs and one unresolved downloaded cause; full causal attribution is false. No current test flake is established here.

- Historical evidence: [dated hosted job](https://github.com/beep-effect/beep-effect/actions/runs/32719153529/job/97406665477), head `87d3479f21f440c32582ce2e67093bdad4fb9569`, 2026-08-24T10:54:45Z.
- Historical evidence: [dated hosted job](https://github.com/beep-effect/beep-effect/actions/runs/32724996724/job/97424172288), head `992c6980bb8c79381fefe1765312113cce929e34`, 2026-08-24T12:02:54Z.

Root verified source bounds and retained input/output hashes. Complete proposed
findings are in the four lens JSONL files; source snippets were not executed. Current Vitest4.1.11 remains outside rc113's declared Vitest5 peer range, with the retained tested-cohort qualification. Neither the passing timing baseline nor this static audit is package, coverage, race-freedom or phase acceptance.

The [baseline](../timings/baseline/beep_tailscale.json) and
[timing context](../timings/context/baseline/beep_tailscale.json) retain the measured cohort.
