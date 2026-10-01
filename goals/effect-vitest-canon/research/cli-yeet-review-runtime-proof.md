# Yeet review-fixes runtime and resource proof

The suite now uses the public instrumented serial PlatformLayer fixture.
Thirteen runtime registrations become it.effect/it.effect.each, preserving the
parameterized data, title template, all 14 expanded cases and 42 assertion trees.
Each case receives a fresh TestConsole. Six native proof/admission cases retain
live clocks; the eight path-normalization cases retain the test clock.

Both callback resource wrappers are removed. The test scope owns its temporary
directory and coordinator lock, acquired in that order and released in reverse.
The coordinator's runtime-root override and memory values remain case-local:
50/128 GiB for weighted admission and 6/8 GiB for the fallback scenario. Direct
service provision replaces stateless memory and noop-filesystem layer wrappers.
Cleanup failures become visible defects rather than being discarded.

Applied evidence:

- All 14 tests pass on Node and Bun; registration multiplicities match the
  original reports, source hashes stay stable and isolated TMPDIRs remain empty.
- The actual package test-type artifact has empty output and exitCode 0.
  Root Oxlint and the Effect Vitest ratchet pass. The latter scans 1,217 files,
  reports 2,948 findings, zero introduced and 2,074 resolved against the
  unchanged baseline. This batch removes 13 runtime and two wrapper findings;
  the native-filesystem review remains open.
- Failure and interruption probes at all six directory acquisitions each yield
  exactly six intended failures and eight passes on both runtimes, with no
  temporary residue.
- Console probes pass 15 cases on each runtime and observe 14 unique consoles.
  Clock probes pass 15 cases and observe six advancing real clocks.
- Coordinator failure/interruption probes write lock markers and yield exactly
  three intended failures plus 12 passes on each runtime. A finalizer registered
  before lock acquisition checks that the lock is gone while the parent
  directory still exists. All three checks run; afterEach independently checks
  lock absence. Directory removal therefore cannot mask a broken lock release.
- All mutation probes restore the exact original source bytes and reject
  unexpected assertion failures.

Observed whole-command times are Node 10.134 -> 10.132 seconds and Bun
7.576 -> 7.877 seconds. Private receipts retain runtime versions, source hashes,
load and pressure. Concurrent checks prevent causal performance claims.

Historical line/evidence/title matching uniquely identifies all 13 runtime
rows; wrapper reconciliation must use the two original occurrence fingerprints.
Full grouped package verification passed: `bun run beep quality package-verify
@beep/repo-cli` exited zero, with audit 702.1 seconds and docgen 20.0 seconds.
This does not establish goal-wide completion or hosted merge readiness.

Source commit: `8410b6eb98924f2913a5cd3edd5ea720c134f88d`.
Reconciliation closes exactly 15 historical rows, adds none and preserves all
unrelated rows. Strict validation passes for all 3,495 CLI and 687 schema rows.
CLI status counts are 1,896 fixed, 12 exceptions and 1,587 open. The grouped
package proof passed with the source unchanged.
