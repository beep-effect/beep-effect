# Frozen-grant and lab deletion runtime/resource proof

Both suites use public serial fixtures and return Effects through the
instrumented tester. Frozen-grant uses the shared scoped cwd constructor for
ten cases. Labs uses six per-case temporary directories and four cwd resources.
All 20 Effect callbacks receive fresh consoles; command output assertions are
preserved. Default test clocks are retained following the exercised-path audit
in cli-frozen-labs-preparation.md. Plain synchronous cases remain plain.

Applied verification:

- 32 tests pass on Node and Bun, with stable source hashes and zero temporary
  residue. All 87 assertion trees (34 frozen-grant, 53 labs), registration title
  multiplicities and per-test options remain unchanged.
- Actual package test-type artifact has empty output and exitCode 0.
- Root Oxlint passes. Root Effect Vitest ratchet passes over 1,217 files with
  2,963 findings, zero introduced and 2,059 resolved against the unchanged
  baseline. Both EV010 platform reviews remain open.
- Actual-suite failure and interruption probes each produce exactly 20 intended
  failures and 12 plain-case passes on each runtime. Every case checks cwd
  restoration and every subprocess leaves its dedicated temporary root empty.
- Console probes pass 34 cases on each runtime, proving ten distinct console
  instances per file, including the command tests that inspect captured output.
- The current lab directory constructor passes direct success, body-failure,
  interruption and cleanup-failure controls on both runtimes. Cleanup defects
  remain visible; the harness removes intentionally retained residue afterward.
- Every mutation probe restores original source bytes. An initial harness-only
  error-string mismatch was corrected before the complete successful rerun.

Observed whole-command times are Node 6.825 -> 6.826 seconds and Bun
3.269 -> 3.520 seconds. Private receipts retain source hashes, runtime versions,
load and pressure. Concurrent proof/check activity prevents causal performance
claims from these samples.

Historical line/evidence/title maps identify 20 runtime rows uniquely. Four
wrapper rows match original occurrence fingerprints and evidence exactly.
Reconciliation must preserve native-platform judgments and all unrelated rows.
Full grouped package verification passed after the source commit:
`bun run beep quality package-verify @beep/repo-cli` exited zero, with audit
653.8 seconds and docgen 19.0 seconds.

Source commit: `db2d0656838de0ac848a1965350a90452683ebfa`. Reconciliation closes
exactly 24 historical rows (20 runtime, four wrappers), adds none, and preserves
all unrelated findings. Strict validation passes for all 3,495 CLI and 687
schema rows. CLI counts are 1,881 fixed, 12 exceptions and 1,602 open.
The full grouped package proof passed; this does not imply goal-wide acceptance.
