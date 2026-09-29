# Packet-core runtime and temporary-resource migration

All 23 current runPromise boundaries now use public it.effect. One serial
public it.layer fixture owns the existing NodeServices and PacketEventStore
service, with a 20-second hook timeout. All original 20-second test options,
28 registrations and 144 audited assertion trees are preserved, with no
assertion exclusions. The instrumented test-runner import remains intact.

The store captures filesystem, path and crypto services; each operation reads
its stream from the supplied locator. The two cases calling store.append
retain live time because their native journal locks perform wall-clock age
comparisons and bounded lock-retry sleeps. Digest, fold, read and projection
cases use the standard test clock. This remains native fixture integration
coverage and does not claim Memory filesystem promotion.

Six temporary-directory allocations now use makeTempDirectoryScoped under the
public test scope. Four redundant success-only removals are gone; the removal
of an event file under test remains. The unchanged baseline passes 28 tests on
each runtime but leaks two directories per run. Both final uninstrumented runs
pass all 28 tests with zero temporary residue. Each run uses its own TMPDIR
under the private task cache; the harness removes only its own temporary root.

Actual-suite controls inject failure or self-interruption immediately after
the first allocation in each of the four resource-owning cases. All four
Node/Bun by failure/interruption combinations produce exactly the four expected
failed tests and 24 passing sibling tests, with zero temporary residue. The
successful suite covers all six allocation sites. The temporary probes are
removed and the restored source is byte-checked before committing.

Before/after reports have identical full test names and stable source hashes.
Node records 3.670 -> 3.820 seconds and Bun records 1.867 -> 1.917 seconds.
Load and pressure are retained; the baseline overlapped the previous batch's
package proof. These observations do not establish a causal performance change.
Actual generated type diagnostics have exit zero and empty output.

The root ratchet passes across 1,217 files with 3,188 findings, zero introduced
and 1,834 resolved against the unchanged baseline. Historical lineage
reconciliation and full CLI package proof for this batch remain pending.
