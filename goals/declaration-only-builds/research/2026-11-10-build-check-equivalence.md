# Build versus check diagnostics: the equivalence proof

Packet: `goals/declaration-only-builds`. Written 2026-11-10; the sweep ran on
2026-11-12. This note answers the question PR 3 depends on: does a package's
build (`tsrs -p tsconfig.json`) report the same diagnostics as its own-source
check (`tsrs -p tsconfig.check.json`), cold, with warm incremental state and
after a Turbo cache restore, with `TSRS_FAST` unset and `1`?

## Result

Yes. Every comparison matched.

| `TSRS_FAST` | Pass | Packages | Comparisons | Identical | Different |
| --- | --- | --- | --- | --- | --- |
| unset | clean | 182 | 546 | 546 | 0 |
| unset | seeded | 182 | 910 | 910 | 0 |
| `1` | clean | 182 | 546 | 546 | 0 |
| `1` | seeded | 182 | 910 | 910 | 0 |

2,912 comparisons, none different, no ineffective probe. Rows:
[`2026-11-12-build-check-equivalence.tsv`](./2026-11-12-build-check-equivalence.tsv).

Check-once survives this test. PR 3 may go ahead, for the packages whose check
program is the build program (see the asymmetries below).

## Method

The sweep is a mode of the check-program census, added in PR 1:

```sh
bun run beep quality check-census --build-equivalence --initial-state restored [--seed]
```

- Run on 2026-11-12 on `main` @ d1c7c6cb63f plus PR 1's changes, as one
  admission job, compiler `7.1.0-beta+effect-tsgo.0.68.0` (`tsrs` 0.24.0).
  Load average 70 to 129.
- Selection: the 182 workspace packages whose `beep:build` runs
  `tsrs -p tsconfig.json` and that have a `tsconfig.check.json` and a `src`
  directory.
- Before each of the four sweeps every package `dist` was deleted and
  `bun run build` restored it from the Turbo cache (199 of 201 build tasks
  cached; `@beep/eyecite` and `@beep/repo-configs` set `cache: false` and were
  built fresh). The restore ran with `TSRS_FAST` unset, as CI builds do.
- Both programs run as `tsrs -p <config> --pretty false` in the package
  directory. Two runs are identical when their exit codes and their sorted
  output lines are equal.
- Clean pass, three comparisons per package: the check against the build on
  the restored state, a second warm build, and a cold build after `dist` is
  removed. All 1,092: exit 0 and no output from both programs.
- Seeded pass, five comparisons per package. A probe file with a TS2322 and a
  floating Effect is written into `src`. The seeded check is compared with the
  build on the restored state, a warm retry and a cold build: exit 2 and the
  same two diagnostics from both programs, in every package. The probe is then
  removed and a fresh check is compared with a warm build that starts from the
  failing incremental state and with a cold build: exit 0 from both.

What this does and does not show:

- A warm or cache-restored build never hid an error the check reported, and
  never kept reporting one after the source was fixed. That was the hazard
  named in the exploration's rabbit holes.
- The Effect diagnostic travels with the build program in every state and
  under both `TSRS_FAST` settings.
- It is one probe per package, in the package's own source. It does not
  enumerate every diagnostic the compiler can raise. From PR 3 on, the census
  mode is the standing check that the two programs still agree.

## Why check configs set `rootDir` to the repository root

`SPEC.md` asks for this before a check is folded into a build.

- #731 (6bc0accde99, 2026-08-16) introduced `tsconfig.check.json`. Its overlays
  dropped `references`, so a check program pulled upstream packages in as
  source. Upstream `src` files are only legal program members when `rootDir`
  covers them, hence `rootDir` at the repository root.
- #1058 (e7b7d03e61b, 2026-09-09) put `references` back in every check overlay,
  so upstream packages resolve through `dist/*.d.ts` again. `rootDir` stayed at
  the repository root.

With references kept, the wider `rootDir` matters in one case only: a workspace
import that the package's `references` do not cover. The check program then
reads that dependency's source and accepts it. The build program, with
`rootDir` at `src`, rejects the same file with TS6059. The build is the
stricter of the two, and `bun run beep tsconfig-sync` keeps references in step
with manifest dependencies, so the case does not occur on `main` (every build
passes). Folding the check into the build loses nothing here: a missing
reference becomes a build error instead of a silent source-resolved check.

## Known asymmetries, by construction

- **Declaration-emit diagnostics are build-only.** TS4023, TS2742 and their
  relatives are raised while writing `.d.ts`, which a `noEmit` program never
  does. The build already gates on them through `^build`.
- **Two check configs add `scripts` to `include`**: `@beep/effect-drizzle`
  and `@beep/markdown`. For those packages the check program is a superset of
  the build program, so their build cannot serve their check. They matched in
  the sweep only because their `scripts` are clean and the probe sits in
  `src`. PR 3 leaves their own-source check in place.

## Cross-package incremental case

The seeded sweep changes a package's own source. The classic stale-state hazard
is the other direction: an upstream declaration changes while the downstream
package still holds incremental state from before.

Pair: `@beep/api-transport` (upstream) and `@beep/ecfr` (downstream, imports
`makeApiTransport`). Steps, run in place with `TSRS_FAST` unset and again with
`TSRS_FAST=1`:

1. Build `@beep/ecfr` warm and clean: exit 0.
2. Rename the upstream export and build `@beep/api-transport`: exit 0 (the
   barrel re-exports with `export *`).
3. Build `@beep/ecfr` on its pre-change incremental state: exit 2, seven
   diagnostics (TS2724 on the import, two TS2375, and four Effect diagnostics:
   two `anyUnknownInErrorContext`, two `missingLayerContext`).
4. Build `@beep/ecfr` again with nothing changed: the same seven, exit 2. A
   retry does not go green.
5. Check `@beep/ecfr`: the same seven, exit 2.
6. Remove `dist` and build `@beep/ecfr` cold: the same seven, exit 2.
7. Revert upstream, build it, then build and check `@beep/ecfr` from the
   failing incremental state: both exit 0.

Every step matched under both `TSRS_FAST` settings. The Effect diagnostics
travel with the build program in each state, so the Effect gate does not
weaken when the build is the pass that runs.

## The stale `node_modules/.tmp` tsbuildinfo glob

`turbo.json` `build.outputs` still lists `**/node_modules/.tmp/*.tsbuildinfo`,
the incremental-state location before #1874.

- No package writes there. `tsconfig.base.json` sets `tsBuildInfoFile` to
  `${configDir}/dist/tsconfig.tsbuildinfo` and no package build config points
  it outside `dist`. The remaining users of that directory are not package
  `build` tasks: the root `tsconfig.json` and `tsconfig.packages.json`, five
  `tsconfig.stories.json` files (`beep:check:stories`), and
  `packages/_internal/db-admin/tsconfig.drizzle.json`.
- The glob still does harm. A fresh worktree built from cache on 2026-11-10
  ended with `node_modules/.tmp/tsconfig.tsbuildinfo` in three packages
  (`@beep/fc-runs`, `@beep/types`, `@beep/test-runner`). Each file names
  compiler `7.1.0-dev+effect-tsgo.0.51.1`; the installed compiler is
  `7.1.0-beta+effect-tsgo.0.67.5`. They are residue that some checkout had on
  disk when it populated the cache entry, captured by the glob and restored
  into every checkout since.
- Removing the glob changes the hash of every generic `build` task, because
  Turbo hashes a task's `outputs`. Measured on `@beep/api-transport#build`:
  `88125a686fd34b63` with the glob, `1d0ce7463b38978d` without. `bun run beep
  cache audit` reports 188 `#build` subjects as configuration drift.

So the removal is correct and it costs one repo-wide build cache invalidation.
PR 2 already pays that cost through `tsconfig.base.json`. The removal rides
PR 2 (decision `2026-11-10-tmp-glob-rides-pr-2`), so the repo rebuilds from
cold once, not twice.
