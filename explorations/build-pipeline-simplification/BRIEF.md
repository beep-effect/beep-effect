# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

169 library packages build with `tsrs -p tsconfig.json && bun run babel`. That
writes JavaScript, JavaScript maps, declarations and declaration maps into
`dist`, then rewrites the JavaScript to add `__PURE__` markers. Only the
declarations have a reader: apps, tests and the compiled binaries resolve
`exports` to `src`, and project references read `dist/*.d.ts`.

Two costs follow, and the move to `tsrs` made both stand out:

- The Babel pass now costs more than the compile on `@beep/schema` (0.64 s
  against 0.27 s, best of six). Its output goes to files nothing bundles.
- `beep:check` starts by running `tsrs -p tsconfig.check.json`, which is the
  build's program with emit turned off (197 of 199 configs). A full run
  type-checks each package's `src` twice.

Why now: six verification goals are chasing wall time and memory on the box and
in hosted CI, and this is build work that produces nothing anyone reads.

The packet opened as "which bundler". That question is closed
([`DECISIONS.md`](./DECISIONS.md) Q1): none. What is left is making the
compiler do less.

## Appetite

Small: one goal, three PRs, about a week of lane time. Every step is a
generated-script policy edit plus `bun run beep lint package-scripts --write`,
and each is reversed the same way. Work that does not fit is cut, not extended.
The check-once step is conditional and is the first thing cut.

## Solution Sketch

```text
today    build:  tsrs emit (js, js.map, d.ts, d.ts.map)  ->  babel (annotate js)
         check:  tsrs --noEmit on the same program       ->  check:tests ...

target   build:  tsrs emit (d.ts, d.ts.map)
         check:  [the package's own build]               ->  check:tests ...
```

Three PRs, in order:

1. **Baseline and proof harness.** No behaviour change. Record repo-wide build
   time with and without the Babel step, and the size of `dist` going into the
   Turbo cache. Use the existing check-program census
   (`beep quality check-census`, which already counts the files a check program
   shares with its build program) to compare build and check diagnostics for
   every package: cold, with warm incremental state, and after a Turbo cache
   restore. Land the three stale findings (DECISIONS Q9).
2. **Declaration-only build.** Remove the Babel step and the `babel` script key
   from the generated defaults for the four package kinds and from the two
   package scaffolds, and set the base tsconfig to emit declarations only. The
   PR's full hosted gate is the proof that nothing reads `dist/*.js`: Vercel
   builds, docgen's example compile, integration tests, Storybook and the
   binary builds all run there. A package that turns out to need JavaScript
   keeps it through a named per-package override, not a repo-wide retreat.
3. **Check once.** Only if PR 1 showed identical diagnostics in all three
   states. The package's own-source check is satisfied by its build; the rest
   of the `beep:check` chain (tests, scripts, stories, type tests) is untouched.
   The census baseline gates the equivalence from then on.

Ownership stays where it is: the generated-scripts policy in
`@beep/repo-cli-kit`, the Turbo task graph in `turbo.json`, and the contract
test in `@beep/repo-cli`. No new package.

## Rabbit Holes

- **A hidden reader of `dist/*.js`.** The census of manifests found none, but
  that is a grep, not a run. Integration tests depend on `^build` and could be
  executing built JavaScript somewhere. PR 2's hosted gate decides; the patch is
  a named override for that package.
- **Incremental builds hiding diagnostics.** If the build is the check, a warm
  tsbuildinfo or a restored cache entry must report the same errors as a cold
  run. `tsrs` is a beta port. PR 1 tests this before PR 3 depends on it.
- **The `TSRS_FAST=1` preset.** The quality runner sets it for checks; generated
  build scripts do not. Diagnostics must match under both before the two passes
  are merged.
- **`rootDir` in the check config.** Check configs set `rootDir` to the repo
  root and build configs to `src`. Find out why before folding one into the
  other.
- **Turbo graph change.** Adding an own-`build` edge to `check` changes what a
  filtered run executes. `verification-route` and `route-soundness-repair` own
  affected-routing; tell them before PR 3.
- **Dangling `publishConfig.exports`.** They point at `dist/*.js`, which will no
  longer exist. Every package is `private: true` and the Release Lane is
  dormant, so this is accepted; a publish lane re-enables JavaScript emit for
  the member it activates.
- **Baselines move under sibling goals.** `local-proof-under-ten`,
  `hosted-setup-tax`, `heavy-pool-diet` and `certainty-scorecard` measure wall
  time that this changes. Announce each merge to them.
- **Babel dependencies.** Remove `@babel/cli`, `@babel/core` and
  `babel-plugin-annotate-pure-calls` from the catalog only if nothing else uses
  them (`babel-plugin-react-compiler` stays).

## No-Gos

- No bundler for library builds, and no `bun build` outside the binary lanes.
- No tsdown lane, no publishable tier, no manifest projection. That is designed
  at Release Lane activation.
- No new build-kit package.
- No source-resolved checking and no removal of project references (measured
  and rejected, DECISIONS Q7).
- No `isolatedDeclarations` adoption.
- No SchemaCompiler work.
- No app bundle or start-up work (queued in `explorations/INBOX.md`).
- No change to framework app builds (`next build`, `vite build`) or to the nine
  apps that already build without emit.
