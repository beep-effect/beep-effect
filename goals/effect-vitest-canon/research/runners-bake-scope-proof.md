# Runner bake fixture and property migration

Applied after main merge `65fb90dbb0`; full package proof and a source commit
remain pending, so campaign findings are not yet closed.

Static platform providers move into 12 public instrumented layer registrations.
Console-only providers yield to the runner's test console. Seven dynamic
service instances keep short scopes and their per-test Ref, scripted spawner
and filesystem overrides. RunnersService captures its dependency context at
construction. Native checkout reads, crypto and shell bootstrap stay native;
scripted AWS responses do not prove live cloud behavior. The temp-root helper
retains per-invocation acquireUseRelease with visible removal failures.

The report property now uses it.effect.prop with the same BakeReport schema,
encoder, decoder and strict equality predicate. fcRuns(100) preserves the native
Arbitrary default floor and permits an environment-raised depth. All 25 test
names and 111 other assertion expressions remain structurally identical. A
400-run seeded check passes; an inverted-equality control fails after one case
and nine shrinks, demonstrating assertion failure propagation.

Private Node/Bun suites pass before application. The final combined applied
architecture/runner suite passes 42 tests on Node (6.38 seconds) and Bun
(3.78 seconds). One whole-callback scope was removed after detector review;
the seven short service scopes remain. Newly fingerprinted wrapper/scope
candidates are reviewed individually, preserving unmatched historical records.
Full package verification passes: audit 760.8 seconds and docgen 25.0 seconds.

Final applied root test types and the detector ratchet pass with zero new
findings. Full package proof passes: audit 760.8 seconds and docgen 25.0
seconds. Campaign reconciliation will bind fixes to the source commit.
