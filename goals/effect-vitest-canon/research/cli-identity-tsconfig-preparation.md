# Identity-registry and tsconfig migration preparation

This is an unapplied draft for two existing-inventory files. Package source
remains unchanged while the preceding grouped CLI proof runs.

The 29-case baseline passes on Node and Bun with stable source and no temporary
residue. Whole-command observations are Node 10.831 seconds and Bun 6.275
seconds. Dedicated temporary roots and load/pressure receipts are retained;
the concurrent package proof prevents a controlled performance comparison.

The identity-registry file has 14 whole-callback runPromise boundaries and
14 terminal cwd wrappers/providers. Its draft preserves every LINT_TIMEOUT
argument, uses a serial public testLayer fixture with a 20-second hook timeout,
reuses the existing scoped cwd constructor and gives each callback a fresh
console. The shared layer no longer owns the console.

The tsconfig file has 12 current runtime boundaries, two existing Effect cases
registered through an alias, and one Effect property with 25 runs. Its draft
preserves test options and the property floor, normalizes the alias so both
cases use the public fixture's bound tester, and provides fresh consoles to
all 15 callbacks. All 14 repo-wrapper uses are terminal, including the two
single-yield generator callbacks. The serial public TestLayer fixture uses a
20-second hook timeout.

The original tsconfig helper allocates its directory before fallible .git
creation and chdir, before cleanup registration. Extracted original controls
reproduce a directory leak for each failure on Node and Bun; cwd remains
unchanged, and the control removes its own leaked directory. The draft uses
the existing cleanup-safe cwd constructor and creates .git afterward.
Extracted draft controls pass success, body failure, interruption, mkdir
failure and chdir failure on both runtimes, restoring cwd and removing the
directory. The existing constructor treats cleanup errors as defects rather
than the old helper's typed release errors; visible test failure must remain
verified after application.

Parsed assertion trees are unchanged: 40 identity-registry and 61 tsconfig,
101 total with zero exclusions, including custom assertion helpers and
assert.deepStrictEqual. The preview removes 26 runtime findings and one
resource-wrapper finding without introducing any. Three native-platform
judgments remain. Direct command-module searches find no native capture or
Effect timer calls, but this is not a completed transitive timing audit.
No live-clock override is drafted.

Historical line/evidence/title mappings identify all 26 current runtime rows.
Two additional tsconfig property rows were already fixed by b1aa7e320c;
source history proves that transition. Preserve their original attribution.
No inventory status has changed during this preparation.

After the active package proof finishes, apply with source-hash guards and
run the matching 29-case Node/Bun cohort, actual type diagnostics, root ratchet,
assertion preservation, actual-suite cleanup and fresh-console probes. Then
commit the source, reconcile historical rows and run one grouped package proof.
Do not substitute these private controls for applied-suite verification.

The transitive timing audit followed workspace discovery, dependency indexing,
config planning/rendering and identity registration. Tsconfig rendering reaches
renderBiomeJson, which launches Biome directly through ChildProcess. It does
not use StepExec's Effect-clock capture deadlines. The installed shared Node
spawner bounds process-group cleanup through native Date.now/setTimeout in
awaitProcessExit; these continue advancing under TestClock. Identity lint uses
filesystem, glob and ts-morph operations without an Effect-clock deadline.
No live-clock override is needed for these two callback families. This is a
source-path audit, not a process-descendant stress test.
