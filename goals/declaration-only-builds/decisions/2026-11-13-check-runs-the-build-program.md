---
title: "Check once: the check runs the build program after the package's own build"
date: 2026-11-13
lane: "feat/check-once"
reversal: "Restore the no-emit check as the first step of the generated check script through the retirement table, and remove the own-build edge from the Turbo check task."
---

Two shapes were measured on `main` after PR 2 (182 packages, serial, fastest of three). Dropping the own-source step and relying on a Turbo edge saves 35.4 s; running the build program as the first step, on the incremental state the package's own build just wrote, saves 15.7 s, because a warm unchanged build costs about 108 ms a package.

PR 3 takes the second. The first leaves `bun run check`, run directly in a package, checking only what its tests import: a false green in a common loop, for a saving that is a few seconds of wall time either way. With the second, a direct run still checks every source file, and `check` also reports declaration-emit diagnostics that only the build saw before.

Scope, agreed with the owner of `goals/route-soundness-repair` through the orchestrator on 2026-11-13: the root Turbo `check` task gains the package's own `build`; every package whose build is not the declaration-only command (eight bundler apps, the no-emit packages) keeps the old graph through an explicit override, and a contract test enumerates them. `@beep/effect-drizzle` and `@beep/markdown` keep the no-emit step because their check program is wider than their build program. Equivalence is proven by file set as well as by diagnostics.

Evidence: `goals/declaration-only-builds/research/2026-11-13-check-once-cost.md`.
