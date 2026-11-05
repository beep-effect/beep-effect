# Unicode storage, set probing and string ordering quality repair

PR #2511, 2026-11-02. Native Unicode preparation separates bounded validation,
JavaScript projection, source-point measurement and byte encoding. The native
buffer copy remains before the first validation yield; canonical width and
UTF-16 ceilings are checked before projection. Supplementary and lone surrogate
source points retain their existing storage, projection and yield intervals.
The private text measurement tuple is schema-derived and annotated.

Set insertion separates one-bucket decisions from perturbation/linear probing.
Cached-hash equality still precedes object identity and reflected comparison;
entry limits, growth thresholds, work charges and encounter order are unchanged.
Python string ordering shares point-width and unequal-point ordering helpers,
retaining exact code-point ordering and prefix behavior.

All three changed modules have zero scoped complexity findings. Server source/test
type checking, focused Oxlint and native-runtime checks pass. Four focused Unicode,
composition, native-input and cleaner-value suites passed 21 tests. Six Unicode,
set, Python-hash, resource-hash and dictionary suites passed 20 tests. The divergence
ledger is regenerated after formatting. No safety limits, expected oracle values,
parity obligations or qualification gates are weakened. Full hosted CI remains
pending and no full native replay was run locally.
