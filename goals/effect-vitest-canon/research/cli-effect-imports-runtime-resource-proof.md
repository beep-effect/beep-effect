# Effect-import rule test runtime and resource migration

The 22 current runPromise boundaries now use public it.effect. A serial public
it.layer fixture owns the existing NodeServices and FsUtils services, with a
five-second hook timeout. Each Effect case uses a fresh TestConsole.make and
the existing temporaryWorkingDirectory constructor from test support. The
local Layer.build/provideScopedLayer and cwd program wrappers are removed.
All 23 registrations, original options and 140 audited assertion trees are
preserved, with zero exclusions. The instrumented runner import remains.

All 22 old cwd wrapper uses were the complete program apart from the sole
service-provider stage. The public test scope therefore owns the cwd lifetime.
The shared constructor registers directory cleanup before changing cwd and
restores cwd before removing the directory. Extracted actual-constructor
controls pass on Node and Bun after success, body failure, interruption and an
injected chdir defect. They prove cwd restoration and directory removal. This
also removes the old local wrapper's acquisition gap before release was
registered. No production source changes are needed.

The final uninstrumented suite passes 23 tests on each runtime with no failures,
skips or temporary residue. Before/after reports have identical test names and
stable source hashes. Node records 4.321 -> 4.672 seconds and Bun records
2.318 -> 2.569 seconds. Dedicated TMPDIR roots are used consistently and cleaned
by the harness; workstation load and pressure are retained. These observations
do not establish a causal performance change.

An actual-suite probe observes all 22 console constructions, rejects duplicate
identities and checks the exact count. All 24 probe cases pass on each runtime
with zero temporary residue. The probe is removed and the original source
is byte-checked afterward. Actual generated type diagnostics are empty with
exit zero. The root ratchet passes across 1,217 files with 3,164 findings,
zero introduced and 1,858 resolved against the unchanged baseline.

Historical runtime mappings match exact original line/evidence and unique
current test titles. The two removed helpers also retain exact occurrence
fingerprints and evidence from the older census. The native-platform judgment
remains open. Ledger attribution will use the source commit. Full CLI package
verification will cover this batch and the packet-core migration together;
that grouped proof remains pending.
