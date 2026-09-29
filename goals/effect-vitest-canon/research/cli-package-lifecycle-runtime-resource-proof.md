# Package lifecycle runtime and resource migration

The create-package, create-package-lab and delete-package suites migrate
17, 10 and 13 current runPromise boundaries to public it.effect. Each file has
one serial public service fixture with a 30-second hook timeout. Original
registration options and all 62 expanded registrations remain. The audit
preserves 321 assertion trees with no exclusions: 147 create, 113 lab and
61 delete, including custom expectation helpers. The two block-bodied delete
callbacks retain their local spawned arrays and terminal return structure.

Create fixtures reuse the existing scope-owned temporaryWorkingDirectory,
then create `.git` after cwd restoration and directory cleanup are registered.
Both original helpers reproduced directory leaks on chdir and mkdir failures,
and mkdir failures left cwd changed. Actual repaired-constructor controls pass
on Node and Bun after success, body failure, interruption, chdir failure and
mkdir failure, restoring cwd and removing each directory. Controls restore
and remove their own intentionally leaked baseline resources.

Delete tests use a scoped temporary directory or the existing cwd constructor.
Stable NodeServices, FsUtils and TSMorph services belong to the public fixture.
The per-case fake spawners and non-CI configuration remain explicit service
overrides. Original explicit console boundaries are preserved, with fresh
console defaults for Effect registrations. The narrower withBunShim environment
wrapper remains unchanged. All resource uses are terminal in their callbacks,
including through the named bootstrap helpers.

All 62 uninstrumented tests pass on Node and Bun, with identical file/name
multiplicities, stable source hashes and no temporary residue. Dedicated TMPDIR
roots are used consistently. Actual-suite cleanup probes inject failure or
self-interruption after resource acquisition in all 39 resource-owning cases.
Each Node/Bun by failure/interruption run has exactly the expected 39 failed
cases, 23 passing siblings, the expected injection messages, and zero residue.
The successful suite covers the complete uninstrumented programs.

Console probes instrument all 61 constructor sites across the three files,
reject duplicate identities and check a per-file minimum witness. All 65
probe cases pass on both runtimes with zero temporary residue. Probe changes
are removed and all three restored files are byte-checked before commit.
Actual generated type diagnostics have exit zero and empty output.

Node timing is 12.084 -> 16.849 seconds; Bun is 6.224 -> 8.583 seconds.
These samples are slower, and workstation load, pressure and concurrent work
are recorded. They do not establish a causal regression or improvement.
OPPORTUNITIES.md records a controlled-comparison follow-up. The command trees
have no direct clock/sleep/timeout calls, and all actual native subprocess,
fixture and property tests pass using the standard test clock; no blanket
live-clock override was added.

The root ratchet passes across 1,217 files with 3,118 findings, zero introduced
and 1,904 resolved against the unchanged baseline. One unchanged withBunShim
finding is hidden after nesting under the public fixture; its historical
judgment remains open. Therefore the net detector reduction of 46 represents
40 runtime boundaries, five removed wrappers and one recognition gap, not
46 resolved inventory items. Native-platform judgments also remain open.

Historical runtime and prior property migration mappings are prepared, but
ledger updates still need the source commit. Full CLI package proof for this
three-file cohort remains pending. The earlier grouped packet-core and
import-rule proof passed separately at source 05440996f6.
