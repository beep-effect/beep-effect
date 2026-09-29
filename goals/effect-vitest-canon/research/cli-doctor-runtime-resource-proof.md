# Goals doctor runtime and fixture ownership

Source commit: `6be36921fe`.

Four command tests now use the instrumented Effect runner under one public
`it.layer` with a twenty-second hook budget. Each callback acquires the existing
`temporaryWorkingDirectory` effect directly. That helper is also the resource
used by the removed `withTempWorkingDirectory` wrapper; the runner now owns its
scope. The two pure classification tests remain unchanged.

All twelve assertion trees, six test names and body options are preserved.
Focused final runs with CI enabled pass all six tests on Node (6.92 seconds)
and Bun (3.43 seconds). Actual test-type diagnostics are empty with exit code
zero. The root ratchet reports 1,218 files, 2,857 findings, zero introduced and
2,175 resolved; no baseline refresh was used.

Full CLI package verification is running. Four historical runtime findings
remain open until that proof is collected. The native platform provenance row
also remains open for its independent resource judgment. No hosted readiness
or broader goal completion is claimed.
