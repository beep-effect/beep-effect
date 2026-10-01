# Quality command dispatch fixture ownership

Source commit: `ccfa1913f2`.

Eight command tests now use instrumented `it.effect` callbacks under a shared
public `it.layer` with a ten-second hook budget. Each test acquires its own
TestConsole. The two process fakes retain local recording arrays and their
original success or failure handles. The scheduler temporary directory is
owned by the test runner scope.

All 26 assertion trees and eight test names/options are preserved. Ordinary
runs pass eight tests on Node (3.50 seconds) and Bun (1.83 seconds). Actual
test-type diagnostics are empty with exit code zero. The root ratchet reports
1,218 files, 2,849 findings, zero introduced and 2,183 resolved.

Temporary instrumentation passes on Node (3.67 seconds) and Bun (3.75 seconds):
eight distinct console identities, empty log/error buffers at each body entry,
two distinct process-spawner services and recording arrays, and removal of the
scheduler directory after scope closure. The instrumentation was removed and
assertion parity was rechecked before the source commit.

Full CLI package verification is running. Eight historical runtime rows remain
open until that result is collected. Their identities are retained, including
the failure-before-OSV row whose assertion migration in `8140304195` explains
its changed occurrence hash. Native platform provenance remains an independent
open judgment. No hosted readiness or overall goal completion is claimed.
