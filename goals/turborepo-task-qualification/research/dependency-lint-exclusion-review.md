# Exclude newly selected dependency lint results from pilot reuse

The identity lint computation now selects @beep/fc-runs#lint and
@beep/test-runner#lint in addition to @beep/types#lint. Preserve these edges.
The two new tasks inherit cache: true and have no accepted qualification
receipts for the local-linux-x64-bun1.4.2 profile and qualification-v2 epoch.

Set only those two package-local lint tasks to cache: false. Record each tuple
as excluded with this reviewed basis. This is a conservative prerequisite for
fresh dependency observations, not a finding that either task has demonstrated
unsafe reuse. It activates no reuse and grants no runtime qualification.

The fixture repair must copy these dependency packages into the experiment,
keep their source read-only, provide separate writable task-log directories,
and include their source trees in before/after immutability checks. Retain the
complete native selection; do not remove edges or use --only.

Before applying, re-read the ledger revision and verify both entries are still
unassessed. Apply transitions sequentially using the resulting revision. Bind
this basis to the tracked path below only after copying its exact bytes there.
Regenerate the reviewed configuration baseline with the canonical command.

Before runtime evidence, synchronize installed dependencies to the frozen
lockfile and verify Turbo 2.11.3. The diagnostic plan from the merged repair
checkout was produced by stale installed Turbo 2.11.2 and is not exact-version
qualification evidence. Re-run the native plan after synchronization and assert
all four lint tasks remain selected, with all three dependency caches disabled.
Run package-verify for both touched packages. Refresh activation, toolchain,
dependency materialization and isolated-root receipts before the pilot matrix.
