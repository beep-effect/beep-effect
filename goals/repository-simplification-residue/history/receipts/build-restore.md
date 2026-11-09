# #1874 generated-build incremental output restoration: record

Lane `residue-build-restore`, branch `fix/residue-build-restore` off `main`
`4ff36bacc8`, 2026-10-18. Route: ruling S39/S41, a Claude-originated residue lane
worked by a `claude-opus-5-5` child. Source evidence: the
[G storage handoff](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/handoffs/rsc-g-storage-2026-10-09.md)
and its
[output-health attribution](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-5-cache.md#output-health-attribution-and-clean-cache-rerun).

## Representative set

The G fixture's two packages: `@beep/types`
(`packages/foundation/primitive/types`) and `@beep/fc-runs`
(`packages/tooling/test-kit/fc-runs`). Both are leaf packages whose `build` script is
the generated `bun run beep:build` → `tsc-rs -p tsconfig.json && bun run babel`, the
same arrangement as every other emitting workspace package. Together they emit 28
public files: `.js`, `.js.map`, `.d.ts` and `.d.ts.map` for each source module.

A resolved-config survey (`tsc-rs -p <build tsconfig> --showConfig`) over all 158
workspace build scripts found one layout: `outDir ./dist`, incremental state at
`./node_modules/.tmp/tsconfig.tsbuildinfo`, emitting. The only exception was
`@beep/drivers-duckdb`, which already keeps its state at `dist/tsconfig.tsbuildinfo`.
App builds either run `vite`/`next` or check with `incremental: false`.

## Method

Lane-private scripts under `.beep/build-restore/` (gitignored):

- `manifest.sh` writes a sorted `sha256sum` line for every file under each package's
  `dist`, excluding `*.tsbuildinfo`. It prints the file count and the SHA-256 of the
  manifest text (the "aggregate"), and records separately where incremental state
  exists.
- `build.sh` runs the real build path,
  `bunx turbo run build --filter=@beep/types --filter=@beep/fc-runs --cache=local:rw --summarize --no-daemon`,
  under `beep-heavy`. It sets `TURBO_CACHE_DIR` to a lane-local `.beep/build-restore/cache`
  and unsets every remote-cache variable, so no shared or remote cache is read or
  written. It reads each task's hash and cache status from the run summary.
- `clean.sh` removes any of: `dist`, the incremental state, the package `.turbo`, the
  lane cache.
- `probe.sh` appends one exported, documented constant to `fc-runs/src/FastCheckRuns.ts`
  (it changes `FastCheckRuns.d.ts`, `.js` and both maps) and restores the original
  bytes afterwards.

Scenarios:

- (a) cold: clear `dist`, the incremental state, the package `.turbo` and the lane
  cache, then build.
- (b) warm: clear `dist` and the incremental state but keep the cache, then build
  (restore).
- (c) changed input: from a consistent (a) state apply the probe, then build. C0 is a
  fresh cold build of the changed input.
- (d) dist-only clean, cache evicted: clear `dist` and the cache and keep the
  incremental state, then build.
- (e) dist-only clean plus changed input (the G defect): from a consistent state clear
  `dist` only, apply the probe and build. Then clear the outputs and restore that
  cache entry.

## Results before the fix

Task hashes: fc-runs `5023918bb8b85356` (changed input `b6f4df412688efc9`), types
`19d2b11faa29c431`.

| Scenario | Cache | Exit | Files | Aggregate SHA-256 |
| --- | --- | --- | ---: | --- |
| (a) cold | both MISS | 0 | 28 | `be47258dbe54d50d478a59ecfbb7873a0e77ab2f2aa67a00de68db83a4bc7d8e` |
| (b) warm | both HIT | 0 | 28 | same as (a) |
| (c) changed input | fc-runs MISS, types HIT | 0 | 28 | `5f40f16aa2b3bc85384efd819cc25e5139b379081a46353189354b6bcda98c61` |
| C0 fresh cold, changed | both MISS | 0 | 28 | same as (c) |
| (d) dist-only, evicted | both MISS | 2 | 0 | empty |
| (e) dist-only, changed | fc-runs MISS, types HIT | **0** | **27** | `4601f299fd8843e7baebaa432423287851bd0d66e3d256ded832e30c6179e8cf` |
| (e) restored from cache | both HIT | 0 | **27** | same as (e) |

(a), (b) and (c) pass from a consistent starting state. Turbo restores
`dist/**` together with `**/node_modules/.tmp/*.tsbuildinfo`, so a restore never
splits outputs from state. The two dist-only cases fail:

- (d) `tsc-rs -p` sees an up-to-date `tsbuildinfo` and emits nothing. Babel then
  fails with `dist does not exist`. This failure is loud.
- (e) reproduces the G finding exactly, and it is silent. `tsc-rs` re-emits only what
  the incremental state says changed. The public `fc-runs/dist/index.d.ts` is missing,
  yet the task exits 0, and Turbo caches the 27-file artifact. A later warm restore of
  that hash reproduces the incomplete artifact, so the stale state poisons the cache.
  Before the fix, only a manual clear of `node_modules/.tmp` repaired it.

## Root cause

Non-build-mode `tsc -p` reads its incremental state and never checks that the outputs
the state describes still exist. The base tsconfig kept that state in
`node_modules/.tmp/`, outside `outDir`. A clean that removes `dist` alone leaves the
state behind. That covers `rm -rf dist`, a harness fixture, and a CI or Vercel cache
that restores `node_modules` but not `dist`. The next uncached build then trusts state
whose outputs are gone. The Vercel failure recorded in
[goals/todox-marketing-site/PLAN.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/todox-marketing-site/PLAN.md) (P3, "`babel: dist does not exist`") is the same
class. `apps/todox/vercel.json` purges those files before its build to work around it.

## Fix

One line in `tsconfig.base.json`:

```jsonc
"tsBuildInfoFile": "${configDir}/dist/tsconfig.tsbuildinfo",
```

The incremental state now lives inside `outDir`, so any clean that removes the whole
`dist` directory (or the state file itself) also clears it. That is the case the G
cold fixture and the reproduction above exercise. The fix does not cover deleting
individual files inside `dist`: removing, say, `dist/index.d.ts` keeps
`dist/tsconfig.tsbuildinfo`, and a non-build `tsc -p` then re-emits nothing for
unchanged inputs. Build mode does not close it either: with `incremental` and
`composite` on, `tsc -b` judges up-to-date status from the buildinfo alone, so it
also re-emits nothing after a per-file delete. That case stays out of scope; recovering
from it needs a whole-`dist` clean. `turbo.json` is unchanged: its
`dist/**` build output already covers the new location. The
`**/node_modules/.tmp/*.tsbuildinfo` glob stays for the Storybook and drizzle configs
that set their own state file. `tsconfig.base.json` is a global Turbo input, so every
build hash changes once, and no artifact cached under the old layout is reused. Babel's
`--out-dir dist` pass compiles only script extensions and leaves the `.tsbuildinfo`
alone. Every `@beep` package is private, so the file never reaches a published
tarball. `@beep/drivers-duckdb` already used this layout and is unaffected.

Rejected alternatives:

- A guard in the generated `beep:build` script ("clear state when `dist` is missing").
  It touches about 140 generated manifests and overlaps the exploration's proposed
  build-kit, while covering the same whole-`dist` case as the one-line tsconfig change
  (neither covers a partly deleted `dist`).
- Switching to `tsc -b`. That changes the compiler arrangement, which this lane must
  preserve.
- New Turbo output declarations. State was already declared, so no output change
  could fix a clean that runs outside Turbo.

## Results after the fix

Task hashes: fc-runs `17b879f880c03389` (changed input `338d83c487daee7e`), types
`6c8b348006aef457`. In every run the state is at `dist/tsconfig.tsbuildinfo` and
absent from `node_modules/.tmp`.

| Scenario | Cache | Exit | Files | Aggregate SHA-256 |
| --- | --- | --- | ---: | --- |
| (a) cold | both MISS | 0 | 28 | `be47258dbe54d50d478a59ecfbb7873a0e77ab2f2aa67a00de68db83a4bc7d8e` |
| (b) warm | both HIT | 0 | 28 | same as (a) |
| (c) changed input | fc-runs MISS, types HIT | 0 | 28 | `5f40f16aa2b3bc85384efd819cc25e5139b379081a46353189354b6bcda98c61` |
| C0 fresh cold, changed | both MISS | 0 | 28 | same as (c) |
| (d) dist-only, evicted | both MISS | 0 | 28 | same as (a) |
| (e) dist-only, changed | fc-runs MISS, types HIT | 0 | 28 | same as (c) |
| (e) restored from cache | both HIT | 0 | 28 | same as (c) |

The public output bytes are identical before and after the fix: (a) equals the pre-fix
(a), and C0 equals the pre-fix C0. Only the state's location moved. The expected (c)
delta against (a) is exactly the four `FastCheckRuns` files (`.d.ts`, `.d.ts.map`,
`.js`, `.js.map`). The `@beep/types` hash is unchanged across the probe, so its HIT is
correct.

## Regression check

`packages/tooling/tool/cli/test/build-turbo-outputs.test.ts`, in the CLI's existing
Turbo task-contract test family (`*-turbo-inputs.test.ts`):

- The static contract: the base `tsBuildInfoFile` lies under the base `outDir`, and
  the cached `build` task declares that `outDir` as an output.
- A behavioral check: a temporary package extending the real `tsconfig.base.json` is
  compiled with `tsc-rs -p`. The test then removes `dist` alone, compiles again, and
  requires the identical output listing, including `index.d.ts`.

Both tests pass with the fix. Both fail against the `main` base tsconfig: the first on
the location, the second because the rebuild emits nothing.

## Coordination with build-pipeline-simplification

The exploration (`explorations/build-pipeline-simplification/`, read-only here) owns
the bundler-vs-tsgo question and a proposed build-kit that would "manage tsbuildinfo
coherence". This lane changes none of its files, no generated package script, no
compiler choice (`effect-tsgo`/`tsc-rs` emit plus Babel are unchanged), no Turbo
task contract and no explicit override. The one shared file touched is the emit-layout
setting in `tsconfig.base.json`, which its RESEARCH table marks "Reuse". The change is
a correctness fix underneath any later build-kit. It removes the need for a purge
step, and a build-kit can keep or move the location. `apps/todox/vercel.json`'s purge
of `node_modules/.tmp/*.tsbuildinfo` is now redundant but harmless. It is an
explicit app override, so it is left in place for its owner.

## Route and model evidence

Worker: Claude Code Agent child, model `claude-opus-5-5` (S39/S41 Claude chain, step 1).
No fallback route was used. Builds and package-verify ran under `beep-heavy`. Turbo
used only the lane-local cache, with no remote cache, token or shared-cache write.

## Reversal

Revert the PR. Restoring the old `tsBuildInfoFile` changes the global Turbo input
again, so no artifact from either layout is restored into the other. Any leftover
`dist/tsconfig.tsbuildinfo` is removed by the next dist clean, and a stray state file
is ignored by `*.tsbuildinfo` in `.gitignore`.
