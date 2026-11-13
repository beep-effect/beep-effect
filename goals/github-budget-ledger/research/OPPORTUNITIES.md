# GitHub ledger implementation friction

## 2026-11-13: Credential-lane acceptance conflicts

While implementing the independent review fixes, the positive live reset match within five seconds in D2 merged credentials that review reproductions 2 and 5 expected to stay separate. The exact requested PID fallback also groups two physical GraphQL credentials in the retained replay: one process reports both T20 reset times (20:58:48 and 20:59:50). A fresh report under this rule returns 10,347+ instead of the independent 1,176..1,216 bound. A resource-aware merge rule and an explicit policy for old multi-credential processes would have prevented the conflicting acceptance gates. No secret values are needed to reproduce this.


Resolved by orchestrator amendments D2a/D2b: isolate known GraphQL credentials, infer sub-lanes within unknown groups without busy-to-idle adoption, and disclose inferred fleet totals. The acceptance reproductions remain regression tests; the fresh archive replay verifies the revised rule.


## 2026-11-13: Cross-epoch inferred-group merge bridge

Applying D2a/D2b passes the exact review regressions and restores replay T20/T21 to 1,176+/1,221+, but T22/T23 remain 22,836+/41,302+. The latest-ended-tail fallback can assign different successor windows to different processes after a reset. Whole-group co-observation merging then connects these inconsistent successor assignments and retroactively merges distinct earlier windows. A merge-consistency condition across overlapping inferred epochs would prevent that bridge; the current decision does not specify one. Evidence is the fresh ledger-report replay and a read-only per-group reset trace.


## 2026-11-13: D2c resolves the cross-epoch bridge

The orchestrator removed reset continuation for fingerprint-free observations. Unknown readings now form key-wide reset instances, separately for idle and busy observations. Instance-based hourly baselines also count the first reading when the window began inside the hour and flag partial first windows. An independent python3 -I implementation importing no repository code matches all four core and GraphQL replay hours; GraphQL is 1,176+/1,204+/1,539+/2,130+, with no remaining numerical mismatch. The previous proposed consistency guard is unnecessary under this replacement rule.


## 2026-11-13: One token reads two GraphQL windows; the per-credential premise was a coincidence

Two hours after #3200 merged, the live report showed 108,330+ GraphQL points for T05 and 184,766+ for T06, against a 5,000-point window. The raw rows of one `yeet monitor` process show one fingerprint and one operation alternating between resets 15 seconds apart (one window rising 16 to 3,390, the other 35 to 938), so the reducer again read every switch as a reset. The 11-12 replay that "proved" per-credential windows had no fingerprints, so the PID-to-credential split it relied on could not distinguish credentials from concurrent windows. Two things would have caught it before merge: replaying the first post-deploy hour of fingerprinted rows, and a guard that fails any hourly GraphQL total above the limit times the number of observed windows. D2f now treats every GraphQL lane as a reset-scoped instance; an independent per-window computation matches the fixed report (T05 3,192, T06 4,529).
