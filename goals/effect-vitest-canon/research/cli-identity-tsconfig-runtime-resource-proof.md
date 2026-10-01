# Identity-registry and tsconfig resource proof

Source commit 058e59a474 migrates 26 runtime boundaries across two existing
inventory files. The instrumented tester remains imported from @beep/test-runner.
Both files use serial public it.layer fixtures with 20-second hook timeouts;
all original test options and the tsconfig property's 25 runs remain intact.
Each callback receives a fresh console, including each property invocation.
No Memory filesystem promotion is claimed.

All 28 resource-owning callbacks have terminal resource lifetimes. Identity
lint reuses temporaryWorkingDirectory. Tsconfig's temporaryRepository uses
that constructor before creating .git, registering cleanup before either
fallible setup action can leak the directory. The original helper leaked its
directory on mkdir and chdir failure, reproduced on Node and Bun. Applied
constructor controls now pass success, body failure, interruption, mkdir
failure and chdir failure with cwd restored and directory removed. The sixth
control confirms cleanup failure remains visible as a failed Exit; its
intentional residue is removed by the harness. The shared constructor's
orDie finalizer makes this failure a defect rather than a typed release error.

All 29 original tests pass on Node and Bun before and after, with identical
registration multiplicities, stable source hashes and zero temporary residue.
Parsed assertion trees preserve 40 identity and 61 tsconfig assertions,
101 total with zero exclusions. The actual generated package test-typecheck
artifact contains empty output and exit zero.

Applied-suite failure and interruption probes cover all 28 resource-owning
cases on each runtime: exactly 28 expected failures and one passing property,
with the injected messages checked and no temporary residue. Console probes
pass all 31 tests on each runtime. They verify unique service identities,
exactly 14 for identity lint and at least 39 for tsconfig's 14 ordinary Effect
callbacks plus 25 property runs. Probe edits were restored byte-for-byte
before committing, and the commit hook made no source changes.

The timing audit follows discovery, planning and rendering. Tsconfig JSON
formatting reaches renderBiomeJson and a native Biome child process, but not
StepExec's Effect-clock deadlines. The installed shared Node spawner uses
native Date.now/setTimeout to bound process-group cleanup. Identity lint uses
filesystem/glob/ts-morph operations. No callback in this batch needs a live
Effect-clock override. This source audit does not claim a descendant-process
stress test.

Matching whole-command timings are Node 10.831 -> 10.732 seconds and Bun
6.275 -> 7.026 seconds. Dedicated TMPDIR isolation, runtime versions, source
hashes, load and pressure are retained. Baseline overlapped the preceding
package proof and after runs overlapped focused checks; these are observations,
not a controlled causal performance comparison.

The root ratchet passes across 1,217 files: 3,039 findings, zero introduced,
1,983 resolved against the unchanged baseline. Actual before/after detection
removes 26 runtime findings and one wrapper finding. Three native-platform
judgments remain open. Exact historical line/evidence/title matching closes
26 current runtime rows; the wrapper matches occurrence and evidence despite
its line shift. Two property rows were already fixed by b1aa7e320c and retain
that attribution. No new ledger rows were added.

Strict validation passes for all 3,495 CLI rows and 687 schema rows. CLI totals
are 1,805 fixed, 12 exceptions and 1,678 open. The full grouped CLI package
proof passed against source 058e59a474: audit 686.2 seconds and docgen 25.6
seconds, exit zero. Goal-wide acceptance remains incomplete.
