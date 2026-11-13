# GitHub ledger implementation friction

## 2026-11-13: Credential-lane acceptance conflicts

While implementing the independent review fixes, the positive live reset match within five seconds in D2 merged credentials that review reproductions 2 and 5 expected to stay separate. The exact requested PID fallback also groups two physical GraphQL credentials in the retained replay: one process reports both T20 reset times (20:58:48 and 20:59:50). A fresh report under this rule returns 10,347+ instead of the independent 1,176..1,216 bound. A resource-aware merge rule and an explicit policy for old multi-credential processes would have prevented the conflicting acceptance gates. No secret values are needed to reproduce this.


Resolved by orchestrator amendments D2a/D2b: isolate known GraphQL credentials, infer sub-lanes within unknown groups without busy-to-idle adoption, and disclose inferred fleet totals. The acceptance reproductions remain regression tests; the fresh archive replay verifies the revised rule.


## 2026-11-13: Cross-epoch inferred-group merge bridge

Applying D2a/D2b passes the exact review regressions and restores replay T20/T21 to 1,176+/1,221+, but T22/T23 remain 22,836+/41,302+. The latest-ended-tail fallback can assign different successor windows to different processes after a reset. Whole-group co-observation merging then connects these inconsistent successor assignments and retroactively merges distinct earlier windows. A merge-consistency condition across overlapping inferred epochs would prevent that bridge; the current decision does not specify one. Evidence is the fresh ledger-report replay and a read-only per-group reset trace.


## 2026-11-13: D2c resolves the cross-epoch bridge

The orchestrator removed reset continuation for fingerprint-free observations. Unknown readings now form key-wide reset instances, separately for idle and busy observations. Instance-based hourly baselines also count the first reading when the window began inside the hour and flag partial first windows. An independent python3 -I implementation importing no repository code matches all four core and GraphQL replay hours; GraphQL is 1,176+/1,204+/1,539+/2,130+, with no remaining numerical mismatch. The previous proposed consistency guard is unnecessary under this replacement rule.
