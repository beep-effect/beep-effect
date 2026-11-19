---
title: "The Vitest adapter is a new test kit, @beep/repo-gate-vitest, loaded lazily and registered by specifier"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Remove the adapter from the shared Vitest config and delete the test kit."
---

A module of `@beep/test-runner` was rejected: that package has no runtime dependency on schema or identity so foundation tests can adopt it, 152 manifests depend on it, and the adapter would create dev-dependency cycles through `@beep/identity`. The adapter is its own test kit at tooling/test-kit/repo-gate-vitest and depends on the model, the record library, Effect and `@effect/platform-node` only. Rules: the registered reporter module has no workspace import at top level; it loads the implementation when Vitest starts and on any failure prints one stderr line, turns itself off and leaves the exit code alone. The root devDependencies name it, and the shared config appends it after the spread of Vitest's own default reporters, so the agent and GitHub reporters stay. It registers only outside doctest and deep property-sweep runs, which share the config but must not overwrite the test record. The `test` task depends on the adapter's transit task, as it does for `@beep/utils`, so the code that writes a cached record is in the hash. An import-boundary test proves no `bun:` module is reachable.
