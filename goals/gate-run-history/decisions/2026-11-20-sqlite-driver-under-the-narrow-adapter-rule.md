---
title: "The history store is the gate-run library's one driver dependency, loaded by dynamic import"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Move the store into its own tooling library that owns the driver edge."
---

@beep/repo-gate-run depends on @beep/sqlite for the history store only, as a narrowly scoped operational adapter, the same edge @beep/agent-memory-store holds. The store module is a separate entry that loads the driver with a dynamic import, as the memory store does, so the rest of the library still loads under Node and the Vitest adapter's import graph never reaches bun:sqlite. A boundary test asserts both.
