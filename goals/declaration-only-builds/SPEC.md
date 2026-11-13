# Declaration-Only Builds Spec

## Objective

Library package builds emit declarations and declaration maps, and nothing
else. The Babel `annotate-pure-calls` pass and JavaScript emit leave the
generated `beep:build` script, because only `dist/*.d.ts` has a reader. If the
check-program census proves that a package's build and its own-source check
report the same diagnostics, that source is type-checked once per run instead
of twice.

Shaped in [`explorations/build-pipeline-simplification`](../../explorations/build-pipeline-simplification/README.md):
[`BRIEF.md`](../../explorations/build-pipeline-simplification/BRIEF.md) is the
pitch, [`DECISIONS.md`](../../explorations/build-pipeline-simplification/DECISIONS.md)
the rulings, and
[Experiment 3](../../explorations/build-pipeline-simplification/research/experiments/2026-11-10-reverification-and-check-sweep.md)
the measurements this spec quotes.

## Non-Goals

- No bundler for library builds, and no `bun build` outside the binary lanes
  that already use it.
- No tsdown lane, publishable tier, or manifest projection. A publish lane is
  designed at Release Lane activation
  (`standards/architecture/14-ecosystem-packages.md`).
- No new build-kit package.
- No source-resolved checking and no removal of project references. Measured
  and rejected: 2.3x wall and 1.46x memory per project.
- No `isolatedDeclarations` adoption.
- No SchemaCompiler work; that stays with the `effect-schema-parity` DEFER
  ruling.
- No app bundle or start-up work; that is queued in `explorations/INBOX.md`.
- No change to framework app builds (`next build`, `vite build`) or to the
  apps whose build is already a no-emit check.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts`
  and `PackageScriptsPolicy.ts`: the generated `beep:build` and `beep:check`
  defaults for the `library`, `tool`, `ecosystem` and `infra` kinds.
- Every workspace `package.json` scripts block, through
  `bun run beep lint package-scripts --write` only.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`
  and `packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts`:
  the scaffolds that write a `babel` script key.
- `tsconfig.base.json`: emit settings (read only; the flag goes on the build
  command).
- `turbo.json`: the `build` outputs and, for the check-once step, the `check`
  task's dependencies.
- `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts` and
  `CheckCensusGate.ts`, with `standards/check-census.regression-baseline.jsonc`.
- `packages/tooling/tool/cli/test/build-turbo-outputs.test.ts`: the build
  output contract.
- `packages/ecosystem/effect-drizzle/test/bundle-build.ts` and its size probe.
- `docs/runbooks/typescript-toolchain.md` and the root catalog's Babel entries.

## Constraints

- Three PRs, in the order of `PLAN.md`. The check-once step is conditional and
  is the first thing cut. Work that does not fit is cut, not extended.
- Scripts blocks are generated. Change the policy, then regenerate; never
  hand-edit a manifest's task-facing keys.
- The Effect diagnostics gate must not weaken. Every package's source is still
  type-checked by the Effect-patched `tsrs` on every run that checks it.
- Declaration maps stay. Go-to-source depends on `dist/*.d.ts.map`.
- A package that turns out to need emitted JavaScript keeps it through a named
  per-package override recorded in the Exception Ledger. One hidden reader is
  not a reason to restore JavaScript emit repo-wide.
- The check-once step ships only if build and check diagnostics are identical
  cold, with warm incremental state, and after a Turbo cache restore, with
  `TSRS_FAST` both unset and `1`. Any difference drops the step; record why in
  a decision file.
- Understand why check configs set `rootDir` to the repo root before folding a
  check into a build.
- Adding a `build` edge to `check` changes what a filtered run executes.
  `goals/verification-route` and `goals/route-soundness-repair` own
  affected-routing: agree the change with them through the orchestrator first.
- The declaration-only PR changes every generated manifest and the `build`
  task outputs, so it invalidates every build cache entry once: land it when
  the merge queue is quiet. `tsconfig.base.json` does not change (decision
  `2026-11-13-declaration-only-flag-on-the-build-command`).
- Wall-time baselines move under `goals/local-proof-under-ten`,
  `goals/hosted-setup-tax`, `goals/heavy-pool-diet` and
  `goals/certainty-scorecard`. Tell them before and after each behaviour-changing
  merge.
- `publishConfig.exports` will point at JavaScript that no longer exists. That
  is accepted while every package is `private: true`; do not rewrite those
  blocks here.
- Remove a Babel catalog entry only when `bun run beep quality catalog-usage`
  shows it has no other consumer. `babel-plugin-react-compiler` stays.

## Acceptance Criteria

Baseline and proof harness (PR 1, no behaviour change):

- [x] `research/` holds a repo-wide baseline measured under one admission job:
      per-package build wall with and without the Babel step, and `dist` bytes
      split into JavaScript plus maps and declarations plus maps.
- [x] `research/` holds the build-versus-check diagnostics comparison for every
      emitting package in the three states and both `TSRS_FAST` settings named
      in Constraints, produced through the check-program census.
- [x] The effect-drizzle bundle probe asserts that the expected export is
      present and that the bundle imports, not only a size floor, and its
      comment no longer blames `Bun.build 1.3.14`.

Declaration-only build (PR 2):

- [x] `turbo.json` `build.outputs` no longer lists the
      `node_modules/.tmp` tsbuildinfo glob, or the package that still writes
      there is named in the Exception Ledger. Moved here from PR 1: removing
      it changes every build task hash (decision
      `2026-11-10-tmp-glob-rides-pr-2`).

- [x] No generated `beep:build` runs Babel and no workspace manifest or
      scaffold carries a `babel` script key; `bun run beep lint package-scripts`
      passes.
- [x] After a clean `bun run build`, no library package's `dist` holds `*.js`
      or `*.js.map` outside Exception Ledger rows, and every `exports` subpath
      has its `.d.ts` and `.d.ts.map`. The build output contract test asserts
      both.
- [x] The PR's hosted gate is green on its head, or each red is attributed as
      inherited. This run is the proof that nothing reads `dist/*.js`.
- [x] `docs/runbooks/typescript-toolchain.md` describes the new `beep:build`.
- [x] `research/` holds the after numbers, measured the same way as the
      baseline.

Check once (PR 3, conditional):

- [x] Either the package's own-source check is served by its build with the
      census baseline gating the equivalence, or a decision file records the
      difference that cut the step.

Throughout:

- [x] The sibling goals named in Constraints were told before and after each
      behaviour-changing merge.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Generated scripts | `bun run beep lint package-scripts` | Passes |
| No Babel script keys | `rg -l '"babel":' -g package.json packages apps` | No workspace manifest listed |
| Build output contract | `bunx vitest run packages/tooling/tool/cli/test/build-turbo-outputs.test.ts` | Passes |
| Check census | `bun run beep quality check-census` | Passes against the committed baseline |
| Catalog consumers | `bun run beep quality catalog-usage` | Passes |
| Touched packages | `bun run beep quality package-verify @beep/repo-cli @beep/repo-cli-kit` | Passes |
| Hosted gate | The PR's required checks | Green, or reds attributed as inherited |
| Packet launcher size | `test "$(wc -m < goals/declaration-only-builds/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/declaration-only-builds/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/declaration-only-builds` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add declaration-only-builds --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug declaration-only-builds`; add a `kind: decision` file there, never edit this block._

### Appetite: one goal, three PRs, about a week, 2026-11-10

Baseline and proof harness, then the declaration-only build, then check once. Every step is a generated-script policy edit plus regeneration. Work that does not fit is cut, not extended, and check once is cut first. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q8).

Reverse: Supersede with a decision that names a new bound and what it buys.

### Builds emit declarations only; check once is conditional on census equivalence, 2026-11-10

Project references stay. The build emits `.d.ts` and `.d.ts.map` only. 197 of 199 `tsconfig.check.json` files differ from the build config only in emit options, so the first command of `beep:check` repeats the build's type-check. If the check-program census shows identical diagnostics cold, with warm incremental state and after a cache restore, with `TSRS_FAST` unset and `1`, the own-source check is served by the build. Any difference drops that half and the goal ships declarations only. Rejected: leaving JavaScript emit in place, and leaving the double type-check without testing it. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q7).

Reverse: Restore the emit settings and policy values, then regenerate scripts; drop the check-once edge independently if it alone misbehaves.

### No build-kit package; the generated-scripts policy owns the change, 2026-11-10

Changes go through the generated `beep:build` and `beep:check` defaults in `@beep/repo-cli-kit` and the Turbo task-contract test in `@beep/repo-cli`. The stale-tsbuildinfo incident that motivated a build-kit was fixed by #1874 with an emit-layout change and a contract test. Agent call.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q3).

Reverse: Create the package with bun run beep create-package once a publish lane exists for it to own.

### No bundler for library builds; the Effect-patched tsrs stays the emitter, 2026-11-10

Library packages keep compiler emit. `bun build` emits no `.d.ts` and has no per-module output, and the declaration is the only artifact anything reads from `dist`. No bundler measured faster than plain emit on `@beep/schema`; tsdown was about 2x slower and skipped type-checking. `bun build --compile` stays in the binary lanes that already use it. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q1).

Reverse: Reopen the exploration at decompose when Bun ships declaration emit and per-module output, or the repo adopts isolatedDeclarations.

### No publishable tier and no tsdown lane until Release Lane activation, 2026-11-10

`publishConfig.access: "public"` is a dormant template setting per `standards/architecture/14-ecosystem-packages.md`, carried by 172 of 210 workspace manifests, none of which has `private: false`. It is not a tier predicate, and no package publishes. A publish lane (manifest projection, attw/publint, pure annotations and JavaScript in the shipped output) belongs to Release Lane activation. Agent call from doctrine.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q2).

Reverse: Reopen the exploration at decompose when an ecosystem member is activated under the Release Lane; design the publish lane for that member then.

### Remove the Babel annotate-pure-calls pass repo-wide, proven by the declaration-only PR's hosted gate, 2026-11-10

The `__PURE__` markers go into `dist/*.js`, which nothing bundles: apps, tests and binaries resolve `exports` to `src`, and the effect-drizzle bundle probe aliases to `src` and relies on markers hand-written in source. On `@beep/schema` the pass cost more than the compile (0.64 s against 0.27 s, best of six). The operator asked for removal after a full-gate proof; that proof is the hosted gate on the PR that removes JavaScript emit, so both land together. The pass returns inside a publish lane at Release Lane activation. Rejected: keeping it for `packages/ecosystem/*` only, and keeping it everywhere to mirror Effect. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q4).

Reverse: Restore the script values in the policy and run bun run beep lint package-scripts --write.

### Source-resolved checking (no dist, no project references) is rejected, 2026-11-10

Measured across all 199 check projects: 187 pass from source, at a median 2.3x wall and 1.46x memory per project (87.4 s against 31.9 s serial; peak 4.0 GB against 2.5 GB). One consumer failed inside a dependency's source because that source was checked under the consumer's compiler options. The cost lands on the per-package check every lane runs most, and #1874 already removed the incident that motivated it. Operator ruling.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q7).

Reverse: Re-run the exploration's Experiment 3; reopen at decompose if the per-project wall ratio falls under about 1.3x or stale-dist failures recur.

### Three stale findings land in the first PR, 2026-11-10

The `Bun.build 1.3.14` comment in the effect-drizzle bundle probe (retired by Experiment 1 on 2026-10-09), the probe's floor-only size check (a 98-byte invalid stub passes a floor, so add presence and import-validity assertions), and the pre-#1874 `node_modules/.tmp` tsbuildinfo glob in `turbo.json` `build.outputs` if no package still writes there. Agent call under the fix-where-found rule.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q9).

Reverse: Revert the PR.

### The stale tsbuildinfo glob is removed in PR 2, not PR 1, 2026-11-10

Turbo hashes a task's `outputs`, so removing the `node_modules/.tmp` tsbuildinfo glob from `turbo.json` `build.outputs` changes the hash of every generic `build` task. Measured on `@beep/api-transport#build`: `88125a686fd34b63` with the glob, `1d0ce7463b38978d` without; `bun run beep cache audit` reports 188 `#build` subjects as configuration drift. PR 1 is meant to change no behaviour and PR 2 already invalidates every build cache entry through `tsconfig.base.json`, so the removal moves to PR 2 and the repo rebuilds from cold once, not twice. The glob is confirmed stale: no package build writes there, and it restores three compiler-0.51.1 tsbuildinfo files into every fresh checkout. This amends "Three stale findings land in the first PR" for the glob only; the two effect-drizzle findings stay in PR 1.

Evidence: `goals/declaration-only-builds/research/2026-11-10-build-check-equivalence.md`.

Lane chore/declaration-only-builds-baseline

Reverse: Remove the glob in a PR of its own and re-record the cache qualification baseline there.

### Check-once survives the census; PR 3 goes ahead for 180 packages, 2026-11-13

The census build-equivalence mode compared each emitting package's build with its own-source check in 2,912 runs: 182 packages, a clean pass and a seeded pass, from a Turbo cache restore, a warm retry and a cold build, with `TSRS_FAST` unset and `1`. Every comparison matched and every probe was effective. A warm or restored build never hid an error the check reported and never kept one after the fix. The cross-package case (an upstream export renamed under stale downstream incremental state) matched too.

So PR 3 is kept. Its scope is the 180 packages whose check program is the build program. `@beep/effect-drizzle` and `@beep/markdown` add `scripts` to their check config, so their check is wider than their build and stays. Declaration-emit diagnostics remain build-only, which makes the build the stricter of the two.

PR 3 still needs the Turbo `check` to own-`build` edge agreed with `goals/verification-route` and `goals/route-soundness-repair`, and it is still the first thing cut if the appetite runs out.

Evidence: `goals/declaration-only-builds/research/2026-11-10-build-check-equivalence.md`.

Lane chore/declaration-only-builds-baseline

Reverse: Record a decision that cuts PR 3 and leave the own-source check in every generated check script; the census mode stays as a diagnostic.

### Check once: the check runs the build program after the package's own build, 2026-11-13

Two shapes were measured on `main` after PR 2 (182 packages, serial, fastest of three). Dropping the own-source step and relying on a Turbo edge saves 35.4 s; running the build program as the first step, on the incremental state the package's own build just wrote, saves 15.7 s, because a warm unchanged build costs about 108 ms a package.

PR 3 takes the second. The first leaves `bun run check`, run directly in a package, checking only what its tests import: a false green in a common loop, for a saving that is a few seconds of wall time either way. With the second, a direct run still checks every source file, and `check` also reports declaration-emit diagnostics that only the build saw before.

Scope, agreed with the owner of `goals/route-soundness-repair` through the orchestrator on 2026-11-13: the root Turbo `check` task gains the package's own `build`; every package whose build is not the declaration-only command (eight bundler apps, the no-emit packages) keeps the old graph through an explicit override, and a contract test enumerates them. `@beep/effect-drizzle` and `@beep/markdown` keep the no-emit step because their check program is wider than their build program. Equivalence is proven by file set as well as by diagnostics.

Evidence: `goals/declaration-only-builds/research/2026-11-13-check-once-cost.md`.

Lane feat/check-once

Reverse: Restore the no-emit check as the first step of the generated check script through the retirement table, and remove the own-build edge from the Turbo check task.

### Declaration-only is set on the generated build command, not in the base tsconfig, 2026-11-13

The plan was to make `tsconfig.base.json` emit declarations only. `emitDeclarationOnly` needs `declaration` or `composite`, and 404 tracked overlays turn both off (200 `tsconfig.check.json`, 177 `tsconfig.test.json`, 12 `tsconfig.scripts.json`, 5 `tsconfig.stories.json` and ten others). Each would fail with TS5069 the moment the base set the option. Measured: `tsrs -p tsconfig.check.json --emitDeclarationOnly` in `@beep/types` prints TS5069.

So the generated `beep:build` for the four emitting kinds becomes `tsrs -p tsconfig.json --emitDeclarationOnly` and the base config stays as it is. The blast radius is the four policy rows and the manifests they generate. One exported constant in `@beep/repo-cli-kit` carries the command, and the census build-equivalence mode reads it, so nothing else invokes the build program with different emit flags.

Consequence for the plan: PR 2 no longer changes a global Turbo input. It still invalidates every build cache entry once, because every manifest and the `build` task outputs change.

Lane feat/declaration-only-build

Reverse: Move the flag into the base config and add an explicit opt-out to every no-emit overlay through the overlay generators.

### Every tsrs-emitting generated build becomes declaration-only, three apps included, 2026-11-13

The scripts policy only seeds a missing implementation value and never touches extra keys, so regenerating could not migrate anything. PR 2 adds a retirement rule: retired script names (`babel`) that the lint rejects and the writer removes, and retired `beep:build` values with their replacement.

The retired values are the Babel build, the bare `tsrs -p tsconfig.json` build that 13 packages used, and the codegen-prefixed Babel build of `@beep/repo-configs`. They are retired for every managed kind, not only library, tool, ecosystem and infra, because three apps carried the library build: `apps/architecture-lab-proof` and `apps/practice-gateway` called `bun run babel`, so dropping the key alone would have broken them, and `apps/practice-kg-mcp` used the bare build. All three run from `src` (their `bin` entries point there) and nothing reads their `dist` JavaScript. 182 manifests changed.

A package that needs JavaScript keeps it through `javaScriptBuildOverrides`, a named per-package list that starts empty. The search for readers of `dist/*.js` across manifests, CI lane code, workflows, Vitest and Vite configs, docgen and Dockerfiles found none, so the Exception Ledger stays empty. The hosted gate on PR 2 is the proof.

Lane feat/declaration-only-build

Reverse: Add a JavaScriptBuildOverride row for the manifest in the scripts policy and run the package-scripts writer; that package emits JavaScript again.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
