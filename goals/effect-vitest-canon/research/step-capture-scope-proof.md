# Step-capture lifetime and filesystem review

The runner-migration proof below applies to source commit `cd91ae37a1`.

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

## Subsequent semantic hardening

The two tee cases now assert joined parent stdout independently of captured
output. A private tee-disabled control fails both new stdout assertions while
the original capture assertions still pass. The spies pass writes through and
restore themselves at scope exit.

Four temporary allocations use the existing makeTempDirectoryScoped primitive,
which installs cleanup immediately and surfaces removal errors. Two short
acquireUseRelease brackets retain their original boundaries and use orDie for
cleanup failure. Private post-suite probes observed all six roots and confirmed
they were absent on both Node and Bun (22 tests passed on each).

Applied hardening: Node 22 PASS in 4.67 seconds, Bun 22 PASS in 3.50 seconds.
The subsequent import-only correction routes vi through Effect Vitest's public
entry point. Root test types and the ratchet pass. Full package verification of
the hardened source passes: audit 1,107.5 seconds and docgen 41.2 seconds.
This later proof covers the stdout oracles and cleanup hardening. The 39 reviewed baseline IDs and dispositions are
preserved while their current source metadata is refreshed.

## Campaign dispositions

Source repair `96da5fb036` supports ten fixed findings: eight historical provider
wrappers and the cleanup and tee-oracle findings. Eleven reviewed exceptions
retain eight native live-clock cases, two native resource imports and the
TestClock-driven watchdog sleep. Historical IDs, evidence and replacement
guidance remain unchanged. The two physical polling-loop findings and the two
no-findings lens records remain open for final file closeout; the readiness
budget issue remains recorded in OPPORTUNITIES.md.
