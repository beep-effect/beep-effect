---
title: Service methods resolve Repo per call, not once at layer construction
date: 2026-11-26
reversal: Read Repo once in each service's layer and close every method over the captured coordinate, giving methods R = never.
governs:
  - src/GitBranch.ts#make
  - src/CodeScanning.ts#make
enforcedBy: []
---

Every method reads `Repo` from its own context on each call; only the `GitHubClient` is resolved when the layer is built.
Reason: the repository is the one dependency that is not stable, since one program may loop over many target repositories. A coordinate captured at construction would make a scoped `Repo.provide(other)` silently do nothing, because the method would already hold the repository it was built with.
The cost is one context read per call.
Rejected: capturing `Repo` at construction, the house pattern for a stable dependency, which removes `Repo` from each method's `R` but breaks scoped overrides.
