# Copied tests that did not pass in the lab

After the verbatim copy (step 1) and the test-side layout fixes, 47 copied tests failed in 8
modules: 42 bound to the upstream environment and 5 other. Every one is now resolved, as of
2026-10-09, after the review round 1 fix wave and the operator rulings of that day (see the
operator revision block of `scratchpad/EFFECTED_PORT_GOAL.md`). Every copied test that is still
in the tree passes in every module; one cli test file was removed by ruling (below).

## Resolutions

| Module | Recorded | Resolution |
| --- | --- | --- |
| cli | 15 failed (13 environment, 2 other) | `declarations.test.ts` (the rolled-up `.d.ts` and API Extractor gates) removed by the 2026-10-09 "Build tools" ruling: it needs a bundler the lab does not have. The snapshot serializer is registered through the shared vitest config, as upstream's root config does (effected#909). `boundary.test.ts`'s self-reference case is retargeted to the lab's relative type-only reference (D9). The CliStdin, live-exit and the two other boundary cases pass on lab source. |
| engine | 1 (environment) | A vitest global setup (`scratchpad/test/engine/build.setup.ts`) emits `dist/dev/pkg` with tsgo before the suite, where upstream runs `build:dev` first. |
| github | 2 (environment) | The reachability manifest cases read the module's upstream `package.json`, kept as a data file in the module directory. |
| github-actions | 5 failed (7 environment, 3 other) | The upstream `package.json` is kept as a module data file; `ambientReads.test.ts` loads TypeScript 7's scanner through its installed alias; the reachability edge lists are retargeted to the lab's import graph (D9). |
| memfs | 1 (environment) | The shared vitest config sets `TMPDIR=/tmp` for memfs: the copyFile-from-a-directory errno case needs tmpfs semantics (btrfs copies an empty directory). |
| sbom | 3 (environment) | The upstream `package.json` is kept as a module data file; the SBOM-half reachability case is retargeted to the vendored spdx module (D9). |
| workspaces | 15 (environment) | Retargeted from upstream's pnpm monorepo to this Bun repository (D9, operator ruling): fixtures, sibling packages, layering policy and lockfile. Running against the real repository exposed two upstream bugs, fixed with regression tests: top-level Bun `catalog`/`catalogs` were ignored, and nested `bun.lock` override records were rejected. |

Each retarget and fix is recorded as a deviation on the module's ledger row and in its README
Port notes.

## Current totals

| Module | Tests |
| --- | --- |
| cli | 1647 passed |
| engine | 61 passed |
| github | 454 passed |
| github-actions | 712 passed |
| memfs | 569 passed, 21 skipped (upstream's own skips) |
| sbom | 130 passed |
| workspaces | 1079 passed, 1 skipped (upstream's own skip) |
