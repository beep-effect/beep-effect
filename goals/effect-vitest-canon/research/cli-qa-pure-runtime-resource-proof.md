# QA helper runtime and resource proof

The qa-pure suite migrates 15 whole-callback runPromise boundaries to public
it.effect. A serial public PlatformLayer fixture owns stable platform services.
The single provenance case and the dry-run case use nested public fixtures for
SpawnerLayer and DryRunLayer, respectively. All fixture hooks have an explicit
five-second timeout. Plain synchronous cases remain plain synchronous cases.

The temporary-directory callback wrapper is removed. Its 13 uses are terminal
within their test callbacks and now consume a scoped constructor. The dry-run
case's separate resource also uses acquireRelease in the public test scope.
Both retain their original directory prefix, recursive cleanup and orDie
cleanup-failure behavior. Six body-level providers are removed, in addition
to the provider in the deleted wrapper. Every one of the 22 Effect callbacks
receives a fresh TestConsole. No blanket live-clock override is introduced.
Native filesystem and subprocess integration remain native; this is not a
Memory filesystem promotion.

All 40 original tests pass before and after on Node and Bun with identical
file/name multiplicities, stable source hashes and zero temporary residue.
The 106 assertion trees are identical, with no exclusions. Actual generated
test type diagnostics have exit zero and empty output.

Extracted actual-constructor controls pass success, body failure, interruption
and cleanup failure on both runtimes. Cleanup failures remain visible and the
control harness removes its own intentional residue. Actual-suite probes inject
failure or self-interruption after both acquisition sites, covering all 14
resource-owning test cases. Each of the four runs reports precisely 14 expected
failures, 26 passing siblings, the expected failure reasons and zero residue.
The console probe instruments all 22 constructor sites and verifies distinct
identities; all 41 probe cases pass on both runtimes. All probe edits are
restored and byte-checked.

Whole-command timings are Node 3.520 -> 3.770 seconds and Bun 1.667 -> 1.967
seconds. Dedicated temporary roots are used consistently, with load and
pressure receipts retained. These are slightly slower observations, not proof
of a causal regression or improvement. The after cohort overlapped typecheck
and ratchet work; before and after load conditions were not controlled.

The root ratchet passes across 1,217 files with 3,099 findings, zero introduced
and 1,923 resolved against the unchanged baseline. The final file detector
retains its native-filesystem judgment. Historical source matching identifies
15 runtime rows and three provider rows by exact original line/evidence and
registration title. The deleted wrapper also matches its exact occurrence
and evidence. All 19 historical rows are fixed by source commit 812b73e0c5;
no new rows were needed. The native-filesystem judgment remains open.
The CLI ledger has 3,495 unique rows: 1,743 fixed, 12 exceptions and 1,740 open.
Strict validation passes for all CLI rows and all 687 schema rows.
Full CLI package proof passed against source 812b73e0c5: audit 674.9 seconds
and docgen 24.1 seconds, with package source unchanged throughout the run.
A subsequent transitive audit identified the Git provenance case's native
capture cleanup timers. Its planned live-clock correction is tracked in the
grouped CLI preparation and OPPORTUNITIES.md; this proof does not establish
that the inherited-writer deadline path was exercised. The correction requires
fresh focused verification and the next grouped package proof.


The native Git clock correction is applied in 0509e81669. All 75 tests in the
expanded grouped cohort pass on Node/Bun, and actual-suite clock probes verify
advancement inside the corrected callback on both runtimes. See the grouped
terse-effect/package-verification proof for the pending full package run and
its exact scope. This does not claim an escaped-descendant stress test.
