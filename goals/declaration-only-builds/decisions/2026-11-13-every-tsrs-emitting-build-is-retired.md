---
title: "Every tsrs-emitting generated build becomes declaration-only, three apps included"
date: 2026-11-13
lane: "feat/declaration-only-build"
reversal: "Add a JavaScriptBuildOverride row for the manifest in the scripts policy and run the package-scripts writer; that package emits JavaScript again."
---

The scripts policy only seeds a missing implementation value and never touches extra keys, so regenerating could not migrate anything. PR 2 adds a retirement rule: retired script names (`babel`) that the lint rejects and the writer removes, and retired `beep:build` values with their replacement.

The retired values are the Babel build, the bare `tsrs -p tsconfig.json` build that 13 packages used, and the codegen-prefixed Babel build of `@beep/repo-configs`. They are retired for every managed kind, not only library, tool, ecosystem and infra, because three apps carried the library build: `apps/architecture-lab-proof` and `apps/practice-gateway` called `bun run babel`, so dropping the key alone would have broken them, and `apps/practice-kg-mcp` used the bare build. All three run from `src` (their `bin` entries point there) and nothing reads their `dist` JavaScript. 182 manifests changed.

A package that needs JavaScript keeps it through `javaScriptBuildOverrides`, a named per-package list that starts empty. The search for readers of `dist/*.js` across manifests, CI lane code, workflows, Vitest and Vite configs, docgen and Dockerfiles found none, so the Exception Ledger stays empty. The hosted gate on PR 2 is the proof.
