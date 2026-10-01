# Architecture operation-plan fixture qualification

The candidate is applied after merging main at `65fb90dbb0`. Campaign rows
remain open until the new full package proof and source commit exist.

The candidate removes the local provider clone and 28 provider invocations,
using 14 public instrumented runner layer registrations. It preserves native
NodeServices and CommandTestLayer, all 17 test names and all 82 complete
assertion expressions. The private fixture anchors import.meta.url to the
original source location so accepted-file comparisons use the actual checkout.

The existing helper allocates unscoped roots and many tests remove them only
after successful work. The revised helper registers release during allocation
using acquireRelease and removes recursively with force; other removal errors
remain visible via orDie. This keeps deliberate early removal in the tests.
A direct makeTempDirectoryScoped experiment failed 11 cases on both runtimes
because its finalizer did not accept roots already removed by the test. The
corrected candidate passes all 17 cases on Node (2.79 seconds) and Bun
(1.40 seconds), and its private type project passes.

An injected failure immediately after allocation proves cleanup independently
of successful test bodies. The control observes the intended failure and
asserts the allocated root is absent after scope closure. It passes on Node
(4.48 seconds) and Bun (2.76 seconds). Private hashes and logs bind these results
to the candidate; none substitutes for the forthcoming applied package proof.

The final combined applied architecture/runner suite passes 42 tests on Node
(6.38 seconds) and Bun (3.78 seconds). Root test types and full package proof
are tracked separately; baseline reconciliation preserves historical rows.

Final applied root test types and the detector ratchet pass with zero new
findings. Full package proof passes: audit 760.8 seconds and docgen 25.0
seconds. Campaign reconciliation will bind fixes to the source commit.
