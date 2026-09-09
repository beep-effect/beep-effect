# P0.5 publication base and runtime

Status: worktree prepared; conformance and promotion pending.

A fresh fetch resolved origin/main to 663904610cce2a38c06b0619a8c414646b69361c.
The cached b24f7a93d9 tree had matched the goal starting tree, but the refreshed
base contains 639 changed paths. The scratchpad memfs implementation and its
MemoryFileSystem test are unchanged; test-utils changed only SqlTest.test.ts.
Effect, Effect Vitest and both platform packages remain pinned to rc.112.
Main now pins Bun 1.4.2; the P0.5 publication worktree uses that runtime, while
historical P0a-P0e receipts remain truthful about their Bun 1.4.1 execution.

The separate sibling worktree effect-vitest-filesystem uses branch
codex/effect-vitest-filesystem, created directly at refreshed origin/main.
The canonical worktree new command has no base-ref option and builds
worktree add arguments without a starting ref. Direct git worktree add was
used to select the exact publication base without changing the original or
goal branch. No commit, push, PR or merge has occurred.

This PR cut owns the public FileSystemConformance helper and, only after
conformance, the promoted core engine and tests. It uses public @effect/vitest
and does not carry the unratified P0e runner or goal tooling. The primary goal
packet remains in effect-vitest-canon; root will reconcile main and refresh
its census/proofs before P0g. Scratchpad deletion remains unapproved.

Frozen installation completed successfully with a clean publication worktree.
Root then moved the unchanged @effect/vitest catalog dependency from dev to
runtime dependencies for the public helper. The regenerated lock diff is only
that declaration move; no dependency version changed. The conformance lane
owns only its helper and two platform test files, and its report stays in the
primary goal packet. Architecture factory help has no existing test-kit helper
route; the requested flat helper entrypoint is retained.
