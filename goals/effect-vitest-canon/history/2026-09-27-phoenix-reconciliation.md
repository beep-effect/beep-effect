# Phoenix ledger reconciliation

## P2 reconciliation — 2026-09-27

The two admitted files now have 16 unique ledger rows: eight historical detector
findings and two actionable human findings fixed, plus six bounded no-findings
reviews. Every original finding ID is retained with its phase fix commit. The
current scan has no Phoenix detector finding. All eight original root entries
are removed; the other 7,732 root objects and 683 unrelated ledger files are
preserved. Strict decoding covers all eight file/lens pairs.

Five isolated native layer blocks replace the scoped provider wrapper. Four
Boolean assertions use canonical helpers. Twenty-two named synchronous native
properties retain the complete schema table, encoded stability oracle and
fcRuns(5). The empty-selector case now proves zero SDK calls, with a controlled
mutation demonstrating that oracle fails on a call. The two declared-field
equivalence cases retain their original operation and defect semantics.

Both suites use the public instrumented runner. Trace-off/on and controlled
failure probes passed. Shuffled execution passed; no retry was added. Package
verification passed audit (6.7 seconds) and docgen (3.0 seconds). The final Node
and Bun runs each passed 30 cases; the deep property run passed at 400 runs and
seed 20260708.

| Observation | Registered cases | Whole command seconds |
| --- | ---: | ---: |
| Frozen Node baseline | 9 | 6.221590 |
| Current-runtime pre-edit Node | 9 | 4.020440 |
| Final Node | 30 | 4.170338 |
| Final Bun | 30 | 2.067963 |

The case increase exposes the original 22 bundled laws individually. Timing is
one observation per phase, with source hashes and workstation load/pressure
recorded. Different runtimes, concurrency and registration shapes prevent a
causal performance claim. Hosted CI and review remain pending until publication
and canonical readiness proof.
