# Step-capture lifetime and filesystem review

The migration preserves 22 test registrations, all 54 assertion expressions,
and the embedded Bun subprocess program. Nineteen whole-test or dynamic helper
providers become public layer registrations and eight explicit short scopes.
The short scopes retain their original completion and interruption boundaries;
they must close before the kill/unref assertions, rather than at test teardown.

Eleven original live cases use `excludeTestServices: true`. The callback supplied
by the installed Effect Vitest layer API has `effect`, not `live`; excluding test
services preserves the live clock. Nine unchanged TestClock advances drive fake
child fibers and assert timeout, grace-period, or cleanup results. Fake handles,
Refs, Deferreds and temporary paths remain per-test allocations. The fixed shared
layers contain only platform service factories.

The two physical nested-child loops retain their finite 2,000-iteration readiness and
300-iteration death bounds with 10ms live polling intervals. The other sleep is the simulated external watchdog
failure driven by TestClock. No readiness condition or timeout was weakened.

A private replacement of all standalone Node filesystem layers with Memory
filesystem passed 17 tests and failed five admission cases. Those cases invoke a
real shell to publish workload records even with a mocked main child; virtual
paths cannot serve that native writer. The bounded quality-step timeout case
passes with Memory filesystem and is promoted. Native admission and actual child
process cases remain native.

Applied-source Node: 22 PASS, 8.81 seconds. Applied-source Bun: 22 PASS, 4.75
seconds. Authoritative root test types pass. The reviewed ratchet passes with zero introduced findings. Full CLI package
verification passed: audit 959.6 seconds, docgen 23.9 seconds. No campaign finding is closed from these results
alone. The ratchet adds 39 reviewed records: eight short scopes, nineteen layer
registrations, nine controlled clock advances and three intentional sleeps.
Historical baseline records remain intact.
