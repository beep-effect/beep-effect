---
title: "Compiled CI binary is a slim bin-ci entry, not the full CLI"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli"
reversal: "Compile src/bin-main.ts with native externals and fix its eager DuckDB load"
---

Probe 2026-11-06: `bun build --compile src/bin-main.ts` bundles 6687 modules (163 MB) and dies at start with `Cannot find module '@duckdb/node-api'`; even the full `ci` group drags in vite. A probe entry holding only `CiOperational` bundles 672 modules (110 MB) and starts in about 0.15 s. So `src/bin-ci.ts` registers a root `beep` with a `ci` group of the pre-toolchain commands (change-profile, runner-resources, prune-apt, patterns, job-env); the same command values are registered in the full `ci` group, so `beep ci <x>` is byte-identical in both.
