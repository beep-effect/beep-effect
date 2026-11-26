---
title: The package's tests run in declaration order because the integration fixtures are staged
date: 2026-11-26
reversal: Delete stagedFixtureOrder from vitest.config.ts so the shared config's concurrent tests apply again, after making each staged integration case build its own fixture.
governs:
  - vitest.config.ts#stagedFixtureOrder
  - test/integration/GitSurface.int.test.ts#FixtureBLayer
enforcedBy: []
---

The integration fixtures are staged: fixture B's cases vendor a submodule, then fetch, pin, narrow and clone it, each case reading the state the one before it left. The commonDir block's prunable case runs last because it removes the linked worktree's directory, which the commonDir cases before it still read. The suite therefore runs its tests sequentially, in the order they are declared.
Rejected: the shared `vitest.shared.ts` default of concurrent tests, which races those stages against each other.
Rejected: one fresh fixture per case, which would rebuild the repository and its submodule for every stage of the chain.
