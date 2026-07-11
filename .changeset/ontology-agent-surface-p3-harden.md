---
"@beep/ontology-server": patch
"@beep/ontology-use-cases": patch
---

Harden the ontology real-engine suites for closeout: the stale-CAS test now
proves the rejected subject is absent via a post-refusal Oxigraph SELECT, and
heavy real-engine tests carry explicit 120-second timeouts for slow CI
runners.
