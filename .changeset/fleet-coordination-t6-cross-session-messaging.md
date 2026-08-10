---
{}
---

docs(explorations): record T6 — cross-session messaging kills T3 §4.4 and
proposes moving rung 1's liveness probe onto the session registry as rung 1.5.
Research-only; no package surface changes. The shipped mirror still scans
`/proc/<pid>/cwd`; the registry probe is an open proposal awaiting operator go.
