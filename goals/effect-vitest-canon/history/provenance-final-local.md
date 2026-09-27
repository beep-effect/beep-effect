# Provenance final local evidence

All 22 tests pass on Node and Bun. Final Node duration is 3.799903692 seconds;
Bun duration is 1.628867961 seconds. Both runs record stable source hashes,
runtime versions, limits, load, and pressure. These measurements do not prove
a speedup: workload instrumentation and workstation load differ from baseline.

The shared pure Crypto layer has an explicit five-second hook budget, matching
the existing Crypto suite convention. It acquires no external handle. This
resolved the EV014 candidate exposed by the final detector scan.

Full package verification passed: audit 6.6 seconds and docgen 3.3 seconds.
The final package detector emits no findings. Exactly 19 Provenance baseline
rows were removed; all 8017 unrelated raw records are preserved. Historical
ledger IDs remain, with anchors reconciled to current files. The five-lens
validator reports valid and complete, with zero missing files. The 19 resolved findings credit signed implementation commit
41f44a6455ae8d5c19be18165d0401991e8a6209. Local evidence does not establish hosted readiness or goal completion.

Final timings were refreshed after correcting the runner dependency to
workspace:^. The previous full proof failed Syncpack on workspace:*; that
specific gate and the full package proof passed after the correction. A fresh
full proof remains required.
