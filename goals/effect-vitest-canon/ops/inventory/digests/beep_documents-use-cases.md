# @beep/documents-use-cases four-lens digest

Eight files exercise public input/error models, RPC identities, service injection and local repository-port fixtures. DmsMirror, availability and VaultSyncEngine are scripted Context values; deliberate unavailable methods are not real Box failures. Direct provideService supplies these pure values without an acquired layer. Repository factories each own an array/id counter and are invoked inside a case. Keep their per-case ownership. No vault file, Box API, credential, SQL connection, native filesystem or worker is opened. MemoryFS is unnecessary for these model/port tests. No resource rebuild timing is available.

The local fakes implement cursor upsert, conflict dedupe/review, item tracking and queue recovery themselves. Those behavioral tests cannot certify a production database adapter; real schemas and Context identity are the production boundaries actually exercised here. Two narrower domain-law gaps remain useful within that limited subject: cursor tests use only one workspace/provider pair despite the documented pair key; recovery has only one matching leased row despite its documented workspace/status selection. Add excluded/mixed controls with valid schemas, exact identities and count, preserving every existing assertion. These findings do not request a database launch or assert a production tenant-isolation failure.

SyncItem duplicate/update guards are chosen at method call time in the fake, while successful mutations run in Effect.sync. Current tests call and yield sequentially; they do not prove safety of prebuilt concurrent effects. That limitation alone is not evidence of an observed flake. SyncConflict distinguishes real-event dedupe from absent event IDs. Error equivalence includes changed-field controls but some change multiple fields together; it is not exhaustive independent field sensitivity. All fcRuns(10) laws retain actual input schemas, env floor/seed and shrinking. Preserve public error messages, forceProbe default false/true, four exact RPC identities and projected Option operands. No test was run by this audit.

| Lens | Rows |
| --- | ---: |
| resource | 8 |
| flake | 8 |
| property | 8 |
| observability | 8 |

Severity: 30 info, 2 minor. 2 review items and 30 coverage-only rows.

Retained accepted Node baseline: 37 cases across 8 test files; reporter span 4834.030029296875 ms; whole command 5.215724256000158 seconds. Every assigned test file is represented. Node22.22.3/Bun1.4.2/Vitest4.1.11. No timing was rerun or accepted by this lane. A pass does not prove absence of races, coverage or full package proof.

## Top ten files by row count

- packages/documents/use-cases/test/Document.errors.test.ts: 4 rows; 0 review items.
- packages/documents/use-cases/test/FilingDecision.test.ts: 4 rows; 0 review items.
- packages/documents/use-cases/test/Sync.test.ts: 4 rows; 0 review items.
- packages/documents/use-cases/test/SyncConflict.test.ts: 4 rows; 0 review items.
- packages/documents/use-cases/test/SyncCursor.test.ts: 4 rows; 1 review items.
- packages/documents/use-cases/test/SyncItem.test.ts: 4 rows; 0 review items.
- packages/documents/use-cases/test/SyncOperation.test.ts: 4 rows; 1 review items.
- packages/documents/use-cases/test/TaggedError.equivalence.test.ts: 4 rows; 0 review items.

## Top ten files by retained reporter duration

- packages/documents/use-cases/test/Sync.test.ts: 35.07861328125 ms; 12 tests.
- packages/documents/use-cases/test/SyncConflict.test.ts: 18.21484375 ms; 4 tests.
- packages/documents/use-cases/test/SyncItem.test.ts: 16.020263671875 ms; 5 tests.
- packages/documents/use-cases/test/SyncOperation.test.ts: 15.3076171875 ms; 5 tests.
- packages/documents/use-cases/test/SyncCursor.test.ts: 12.60791015625 ms; 4 tests.
- packages/documents/use-cases/test/FilingDecision.test.ts: 7.46875 ms; 2 tests.
- packages/documents/use-cases/test/TaggedError.equivalence.test.ts: 2.80078125 ms; 4 tests.
- packages/documents/use-cases/test/Document.errors.test.ts: 1.030029296875 ms; 1 tests.

## Review items

- L-PROP-01 / minor, packages/documents/use-cases/test/SyncCursor.test.ts:108-119: The documented port keys cursors by workspace/provider (repository.ts140-141), but both upserts and lookup use only the same pair. A singleton fake ignoring workspace can pass every current cursor case. Retain all assertions and add a second valid workspace with a distinct position, verifying separate identities and both positions after updating one. Keep this a local port-contract control; it does not establish live database isolation or authorize a provider call.
- L-PROP-01 / minor, packages/documents/use-cases/test/SyncOperation.test.ts:185-203: Recovery is documented to change leased operations only in the requested mirror (repository.ts360-364). The test has one leased row and no excluded row; requeue-all can pass. Retain count/id assertions and add leased-other-workspace plus non-leased controls, asserting only matching leased ids change and the exact count. Reuse valid schemas/current floor. The fake is the current subject; no actual database or worker-recovery proof is claimed.

Hosted history: 0 mapped observations across 0 jobs, categories {}. Zero mapped observations is not proof of zero historical failures. Global 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Full retained context/config, source-bound report provenance and slowest cases are retained in the public timing context and hosted history summary. Shared config reports forks/isolate, file parallelism and sequence concurrent; fresh mutable fixtures must remain case-local. Durations overlap and do not measure layer rebuild costs.

After separate P2 authorization: Preserve fresh per-case port fakes, add distinct workspace/provider cursor identities and excluded workspace/status recovery controls, and retain exact ids/counts and 10-run laws. These witnesses do not certify an unexecuted database adapter. Preserve all original operands, assertions and replay options; no timeout increase or generic MemoryFS replacement is justified.

Root-reviewed P1 inventory; P2 remains gated.

Recovery provenance: original supervisor exit 143 remains preserved. A separate recovery obtained fresh successful validation and outer exit 0; the original result was not relabeled.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
