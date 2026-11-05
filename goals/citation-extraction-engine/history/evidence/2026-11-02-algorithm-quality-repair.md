# Literal cleaner and dictionary quality repair

PR #2511, 2026-11-02. This wave repairs the remaining large literal-cleaner and
runtime-dictionary functions without changing the source observation corpus.

Dictionary lookup now distinguishes match, missing, continue and key-change
restart through a private annotated schema. Exact-text capture still occurs
once before retrying with the caller's original hash. Epoch and stored-key
checks still follow rich comparison. Probing and comparison charges retain their
order. Native and JavaScript string readers share explicit length/advance helpers.

Literal cleaning separates XML declaration scanning, run consumption, range
selection and native-point encoding. Output reservations precede materialization;
supplementary-point selections are validated before output allocation. Both
native passes retain their original yield interval and point order. XML newline
and terminator handling, underscore run lengths and source allocation categories
are retained. No safety ceiling or timeout changes in this wave.

Focused dictionary/reentrancy/Unicode/set tests passed nine tests; literal cleaner,
Unicode composition and pipeline tests passed 27 tests. Source/test type checking,
Oxlint and native-runtime checks pass. Scoped complexity checks report zero findings
for both production modules. The canonical schema catalog and identity profile
writers ran, and the divergence ledger was regenerated after source formatting.
No native child corpus or broad package build was run locally. Hosted CI remains
the full proof gate; this work grants no target parity or semantic waiver.
