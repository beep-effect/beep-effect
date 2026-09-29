# Terse-effect and package-verification migration preparation

This checkpoint prepares two files from the existing inventory while the
QA-helper full package proof runs. Neither draft is applied. No baseline or
ledger row changes are included in this preparation.

The baseline cohort has 35 cases: 16 terse-effect and 19 package-verification
cases. All pass on Node and Bun, with stable source hashes and zero temporary
residue. Whole-command observations are Node 8.228 seconds and Bun 4.371
seconds. Dedicated temporary roots, workstation load and pressure are recorded.
The concurrent package proof prevents a controlled performance comparison.

Both files already use the instrumented test runner; the drafts preserve that
import. The proposed serial public fixtures have explicit five-second hook
timeouts. Each file migrates 16 whole-callback runPromise boundaries and gives
its 16 Effect callbacks a fresh console. Synchronous tests remain synchronous.

All 16 terse-effect wrappers are whole-body resources apart from their sole
NodeTestLayer provider. The draft reuses the existing temporaryWorkingDirectory
constructor directly under the test scope, removes the wrapper import, and
moves platform services into the public fixture. Extracted current-constructor
controls on Node and Bun verify success, body failure, interruption and chdir
failure: cwd is restored and the allocated directory is removed in every case.

All 13 package-verification directory wrappers are whole-body resources. The
draft replaces the helper with acquireRelease using its original acquisition
and release effects, preserving recursive cleanup and failure propagation.
The wrapper's platform provider and the separate command provider move to the
public fixture. Extracted draft-constructor controls pass on Node and Bun for
success, body failure, interruption and cleanup failure. The latter remains a
failed Exit, and the control harness removes its intentional residue.

Parsed syntax-tree comparison preserves 99 terse-effect assertion trees and
49 package-verification assertion trees with zero exclusions. This includes
local assertion-helper calls. The detector preview removes 16 runtime findings
from terse-effect and 16 runtime findings plus one wrapper finding from package
verification. It introduces none and retains the native-filesystem judgment.

Applied Node/Bun suites, actual-suite cleanup and console probes, typechecking,
root ratchet, historical-row reconciliation and grouped full package proof
remain required after application. Do not treat this preparation as a completed
migration or a full package proof.

The transitive timing audit finds native drain/reap sleeps in runCaptured's
capturePipeDeadline, including calls without an explicit timeout. The draft now
retains TestClock.withLive in the nine package-verification cases reaching that
boundary. Three of those also produce native elapsed-duration reports. Other
callbacks keep the test clock. Both drafts still preserve all 148 assertion
trees, introduce no detector findings, and map all 32 historical runtime rows
by original line/evidence and registration title. Row status remains unchanged.

The same audit identifies one correction in the previously migrated QA helper
suite: its native Git provenance case reaches runCaptured. A separate private
draft adds live-clock protection only there. Include this correction in the
next grouped proof after the current QA-helper proof is terminal. The expanded
baseline is 75 cases across all three files; every case passes on both runtimes
with stable source and zero residue. Whole-command observations are Node
11.985 seconds and Bun 6.025 seconds under concurrent package-proof load.
Retain the earlier 35-case baseline separately; compare the applied three-file
cohort with the matching 75-case baseline.
