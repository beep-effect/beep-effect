# Legacy PGlite readiness cleanup

The compatibility fixture now constructs its legacy PGlite instance in acquisition
and waits for readiness in the protected use phase. This registers the existing
close callback before readiness can fail. SQL, compatibility subjects, assertions,
explicit close/reopen points, and test deadlines remain unchanged.

A controlled readiness-step failure after real legacy engine initialization
reproduced the lifetime gap: the old helper invoked its close callback zero times,
while the corrected helper invoked it once. The temporary probe failed before the
repair and passed afterward; the probe and injected failure were removed. This
control does not claim a spontaneous engine initialization failure was reproduced.

Node and Bun each pass all 30 enabled integration tests. The Desktop package audit
and Docgen pass (15.0 and 13.9 seconds respectively). Schema-first lint and the
Effect/Vitest ratchet pass, with zero introduced findings. Opt-in scenarios that
register no tests are not credited as executed integration coverage.

The resource ledger will be reconciled with the continuing Desktop batch after
the implementation commit exists.
