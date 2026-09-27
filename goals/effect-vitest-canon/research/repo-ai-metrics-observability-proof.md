# AI metrics native property diagnostics

Sixteen direct property registrations now use the native Effect Vitest property
APIs. Their domains, codec operations, predicates, names and run options remain
unchanged. Existing setup locals retain lexical isolation; in particular, the
raw-event codec keeps its original encodable domain. The mechanical flight-record
generation law retains `fcRuns(1000)`.

The ingest round-trip helper now checks one generated value. Twelve separately
named native properties provide its original independent laws and their original
8- or 12-run floors. The oracle remains `Equal.equals(decoded, value) ||
law.equivalent(decoded, value)`. The existing test keeps its three concrete wire
encoding assertions. The local AgentSession membership helper becomes a native
12-run property, and all fifteen scorecard schema table cases keep their original
rendered names and 12-run options. No manual check-result or runSync wrapper
remains in the package tests.

A conservation audit across all 28 test files retains 1,232 assertion expressions,
excluding the replaced `Passed` wrappers, and verifies the ingest equivalence
disjunction. Temporary inversions make all twelve ingest properties fail, plus
the writer allowlist round-trip and each of the two sequence-break codec laws.
All fifteen failures expose a shrunk input and native Replay metadata with seed
20260708. The original domains and floors were used; no discard-budget workaround
or generator narrowing was introduced. All mutations were restored.

The newer harness-ledger file also received a complete package-local human
review. Its resources are in-memory values and hashing effects, its UTC dates
and Random seed are fixed, and no sleep, external process, live provider or
global environment mutation is present. Existing codec, malformed-value,
optional-field, budget-boundary, staleness and warm-restart assertions remain.
Its fingerprint test claimed every part affected the id but varied only effort
and session hash. Model and baseline-hash witnesses now complete that claim.
Independent production mutations that ignore either field fail the revised
named test and pass its original version. Production files were restored.
The three independent schema domains retain native 25-run property coverage.

Full package verification under the 400-run/seed-20260708 override passes audit
(13.5 s) and docgen (4.7 s); root Oxlint passes. Runner integration, residual
mechanical adjudication, final timing and inventory reconciliation remain before
this package can be counted complete.
