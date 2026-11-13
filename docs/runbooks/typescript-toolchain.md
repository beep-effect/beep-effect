# TypeScript toolchain: which compiler runs where

Use this runbook when a tool, an editor, or a dependency bump asks "which
TypeScript is this repo on?" The root uses TypeScript 7 under two names; the only classic
TypeScript 6 API left is the copy ts-morph bundles and infra's nested Pulumi compiler. The Effect compiler patches both the native Go binary and the installed tsrs
binary; the Effect-patched tsrs is the build/check gate.

## Installed compilers

| Package (catalog) | Version | Role |
| --- | --- | --- |
| `typescript` | `^7.0.2` | Native TypeScript 7 package; no classic `lib/typescript.js` API. |
| `@typescript/native` | `npm:typescript@^7.0.2` | The same TypeScript 7 package under the retained alias, used by patching and unstable API consumers. Alias consolidation is a separate follow-up. |
| `@effect/tsgo` (pins its seven `@effect/tsgo-<platform>` packages exactly) | `0.67.5` | The Effect language service build of TypeScript 7. Editors and the tsgo-only quality lanes use this reviewed pin. Since 0.59.0 the platform packages also ship the Effect build of one `tsrs` version each, so the `tsrs` pin moves with this one. |
| `tsrs` + seven `@tsrs/<platform>` optional packages | `0.23.0-ts7.1.0-beta` | The Rust port of the TypeScript 7 compiler ([oxc-project/tsrs](https://github.com/oxc-project/tsrs)); the version tag names the TypeScript it ports (`7.1.0-beta`). `effect-tsgo patch --tsrs` replaces the installed `@tsrs/<platform>` binary with the Effect build of that exact tsrs version, which `@effect/tsgo` 0.67.5 ships for linux-x64, linux-arm64, darwin-arm64, darwin-x64 and win32-x64 (Effect-TS/tsgo #901, the 1:1 Rust port of the language service). Runs generated library `beep:build`, `beep:check` and `beep:check:tests` gates, the root `check:configs`, and infra's `-b` check. Framework apps retain their own build commands. |

The root `prepare` script (`effect-tsgo unpatch --tsrs && bun run beep toolchain prune-tsgo-backups && effect-tsgo patch --tsrs`)
copies the Effect binaries over the native package's Go binary and over the
`@tsrs/<platform>` binary, keeping the stock ones beside them as `tsc.original`
and `tsrs.original`. After install, both of these print
`Version 7.0.2+effect-tsgo.0.67.5`:

```text
node_modules/.bin/tsc      -> @typescript/native/bin/tsc  (patched Go binary)
node_modules/.bin/tsgo     -> tools/tsgo-shim/tsgo.js     (execs the Effect artifact directly)
```

Docgen's example compile, `beep quality test-tsgo`, the Effect smoke canary,
rule-parity tools and the editors use the Go Effect compiler; the gates use the
Effect-patched tsrs, and both enforce the same reviewed rule set (below).
The shim bypasses the patch on purpose: a preserved
`.original` backup can make a newer patcher mistake an older Effect compiler for
the current one (`tools/tsgo-shim/tsgo.js`).

The typecheck and build gates run on the Effect-patched `tsrs` (adopted in
`goals/tsrs-gates`, which succeeded the tsc-rs gates of 2026-10-14), which
prints `Version 7.1.0-beta+effect-tsgo.0.67.5 (tsrs 0.23.0-ts7.1.0-beta, …)`:

```text
node_modules/.bin/tsrs     -> tsrs/bin/tsrs  (tsrs's JS launcher; execs the patched @tsrs/<platform>/tsrs)
```

`beep:build` (`tsrs -p tsconfig.json --emitDeclarationOnly`), `beep:check`
(led by that build command in a declaration-only package, by
`tsrs -p tsconfig.check.json` elsewhere; see [Check once](#check-once-the-check-leads-with-the-build)),
`beep:check:tests` (`tsrs -p tsconfig.test.json --noEmit`), the root
`check:configs` and infra's `tsrs -b tsconfig.json` all run the Rust compiler. Measured on 2026-10-26
against tsc-rs 0.8.0 ([goals/tsrs-gates/research/measurements-2026-10-26.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/tsrs-gates/research/measurements-2026-10-26.md)):
identical diagnostics on all 181 check projects and infra's `-b` build, serial
wall 21.3 s against 26.4 s at a higher peak RSS per project, and every rule of
the standalone profile known to the compiler (tsc-rs printed eleven TS377134
unknown-rule warnings). The 2026-10-13 tsc-rs measurement against the Go
compiler (3.7× faster at half the RSS) is in `goals/tsc-rs-gates`. Rules of the road:

- The bin is tsrs's own JavaScript launcher (`bin/tsrs` imports `lib/tsrs.js`),
  with no postinstall; it costs about 20 ms per run. The `effect-tsgo tsrs`
  proxy command that 0.59.0 added runs the same Effect build without patching,
  but its Node start-up costs about 160 ms per invocation, so the generated
  scripts call the patched `tsrs` bin directly.
- The quality runner enables the qualified fast preset through `TSRS_FAST=1`;
  explicit `TSRS_FAST=0` restores reference behavior. Generated scripts do not
  hard-code `--fast`. See [Compiler performance defaults](#compiler-performance-defaults)
  for the tsrs measurements and diagnostic limitations. If invoking the flag
  manually with build mode, place it after `-b`: `tsrs -b --fast`.
- A failing `tsrs` exits 2, not 1. Yeet's issue parser keys on the
  diagnostic text, so the code does not matter to the gates.
- `tsrs --version` prints the `+effect-tsgo.<version>` suffix and the installed
  tsrs version; a stock `Version 7.1.0-beta (tsrs …)` means the patcher found no
  Effect build for that tsrs version. The `.bin/tsc` ↔ `.bin/tsgo` version
  equality test covers the Go binary; `EffectTsgoEffectFnPolicy.test.ts`
  verifies that the tsrs identity matches both catalog pins, that both an Effect-only
  finding and a TypeScript error fail tsrs.

### Declaration-only library builds

The generated `beep:build` of the library, tool, ecosystem and infra kinds is
`tsrs -p tsconfig.json --emitDeclarationOnly` (`DECLARATION_ONLY_BUILD_COMMAND`
in `@beep/repo-cli-kit/package-scripts/PackageScripts.schemas`). It type-checks
the package's `tsconfig.json` program, Effect rules included, and writes only
`.d.ts` and `.d.ts.map` files plus `dist/tsconfig.tsbuildinfo`. No `*.js` or
`*.js.map` lands in `dist`: workspace consumers, tests and binaries resolve
`exports` to `src`, so the declaration is the only `dist` artifact anything
reads, and declaration maps keep go-to-source working.

- Babel is gone. The `annotate-pure-calls` pass and the `babel` script key
  retired from every scripts block, and `@babel/cli`, `@babel/core` and
  `babel-plugin-annotate-pure-calls` left the root catalog. The policy rejects a
  `babel` script key (`retired-script`) and a `beep:build` that still holds a
  retired value (`retired-impl`: the Babel build, a plain JavaScript-emitting
  `tsrs -p tsconfig.json`, or the codegen-first Babel build);
  `bun run beep lint package-scripts --write` repairs both.
- The flag is on the command, not in `tsconfig.base.json`: the no-emit overlays
  (`tsconfig.check.json`, `tsconfig.test.json`) extend the base config with
  `declaration: false` and `composite: false`, and `emitDeclarationOnly` there
  fails them with TS5069.
- `publishConfig.exports` still points at `dist/*.js`. That is accepted while
  every package is `private: true`; a publish lane designs its own output at
  Release Lane activation.
- A package with a real reader of its `dist/*.js` keeps JavaScript through a
  named override: add a `JavaScriptBuildOverride` row (manifest path and the
  reader) to `javaScriptBuildOverrides` in `PackageScripts.schemas.ts`, set the
  package's `beep:build` to `tsrs -p tsconfig.json`, record the row in the owning
  goal's Exception Ledger, and run `bun run beep lint package-scripts`.
  `--write` leaves an overridden `beep:build` as written. The list is empty.
- `packages/tooling/tool/cli/test/build-turbo-outputs.test.ts` holds the
  contract: no generated or workspace `beep:build` runs Babel or emits
  JavaScript outside an override, and a fixture built with the generated command
  has a `.d.ts` and `.d.ts.map` for every `exports` subpath and no JavaScript.

### Check once: the check leads with the build

A declaration-only package type-checks its own source once per Turbo run. Its
generated `beep:check` leads with the build program instead of the separate
no-emit program; every later segment stays as written:

```text
before: tsrs -p tsconfig.check.json && bun run beep:check:tests
after:  tsrs -p tsconfig.json --emitDeclarationOnly && bun run beep:check:tests
```

- The root `turbo.json` `check` task depends on `["^build", "build"]`: the
  package's own `build` runs first, so the check's first step finds the
  incremental state that build just wrote and is a no-op of about 100 ms on an
  unchanged package. A direct `bun run check` in the package, outside Turbo,
  still type-checks every source file, because the step is the full build
  program, not a skipped one.
- The scripts policy owns the rewrite. `retiredCheckSegments` in
  `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts`
  retires a leading `tsrs -p tsconfig.check.json` for every package whose
  `beep:build` runs `DECLARATION_ONLY_BUILD_COMMAND`;
  `bun run beep lint package-scripts` reports the old value as `retired-impl`
  and `--write` replaces that program text only. Extra compiler flags on the
  first segment are carried over in the same order: `@beep/repo-cli`'s check
  opens with
  `tsrs -p tsconfig.json --emitDeclarationOnly --checkerCostCache source.tsrs-cost-cache`
  (see [Compiler performance defaults](#compiler-performance-defaults)); the
  cost cache does not disturb the build's incremental state.
- `ownSourceCheckOverrides` (same file) keeps the no-emit check first for a
  declaration-only package whose check program is wider than its build program.
  Two rows today: `@beep/effect-drizzle` and `@beep/markdown` add `scripts` to
  their `tsconfig.check.json` `include`.
- Every other package with a `check` (the bundler apps, the no-emit apps and
  labs whose `beep:build` is `tsrs -p tsconfig.check.json`, and infra) keeps the
  old graph through its own `turbo.json`: `tasks.check.dependsOn` lists
  `^build` and not `build`, without `$TURBO_EXTENDS$`. Otherwise `check` would
  run a whole `next build` or `vite build` first. The scripts lint reports a
  missing override as a `derivation-conflict` on `check`, and
  `bun run beep create-package` emits it for service, runtime-proof, Next.js,
  Vite and Tauri apps.
- The Turbo `check` task still declares `outputs: []`, although its first step
  can write `dist` and `dist/tsconfig.tsbuildinfo`. That is intended: the
  own-build edge already ran `build` in the same invocation, so under Turbo the
  step writes nothing, and a `check` cache hit restores nothing because there is
  nothing to restore.
- A direct `bun run check` or `bun run beep:check` on a clean tree emits
  declarations into `dist` as a side effect, because its first step is the
  build. A read-only checkout, or a worker-profile lane that expects `check` to
  write nothing, notices this.
- `tsconfig.check.json` stays. The two override packages still run it, the
  check-program census (`bun run beep quality check-census`) measures every
  check overlay, the build-equivalence census below compares it with the build
  program, and editors and tools that open a package's check config keep working.
- The contract is the "check once" block of
  `packages/tooling/tool/cli/test/build-turbo-outputs.test.ts`, derived from the
  live manifests and `turbo.json` files: no package whose build is not
  declaration-only depends on its own build or had its check rewritten, every
  declaration-only check leads with the build program (its own flags allowed)
  unless overridden, and
  each `tsconfig.check.json` the build serves adds nothing to the build program
  (it extends the package's own build config, declares no `include`, `files`
  or `exclude`,
  keeps the build's `references`, and sets only emit options). The packages
  whose check config does add something are exactly `ownSourceCheckOverrides`.

### Updating tsrs and @effect/tsgo

`bun run deps:update` considers both catalog entries for their published npm
`latest` versions. Syncpack's existing default `minimumReleaseAge` is 1440
minutes (24 hours), so a just-published compiler release waits for that window
like other dependencies. Neither `@effect/tsgo` nor `tsrs` is excluded by the hold
ledger. The former `effect-tsgo-tsrs-lockstep` hold was retired at the
operator's request on 2026-11-03.

`@effect/tsgo` ships patched tsrs builds listed in
`node_modules/@effect/tsgo-<platform>/lib/upstream.json` (`tags.tsrs.latest`
and `components.tsrs`). The installed tsrs version must have a matching build;
`effect-tsgo patch --tsrs` only patches versions that the release ships.

After updating:

1. Run `bun install`; `prepare` patches both binaries. Check
   `node_modules/.bin/tsrs --version`: it must include
   `+effect-tsgo.<installed version> (tsrs <installed tsrs version>, …)`.
   If npm's latest tsrs is ahead of the builds shipped by `@effect/tsgo`, use
   the tsrs version in that release's upstream metadata before proceeding.
2. Update the table above when either compiler version changes. Recheck the
   rules of the road and known problems.
3. Run `bun run check` and `bun run check:configs`, fixing new TypeScript and
   Effect findings at their source. The three `ignoreEffect*InTscExitCode`
   flags are false, so Effect errors fail these gates.
4. Run `bunx vitest run test/EffectTsgoEffectFnPolicy.test.ts` from
   `packages/tooling/policy-pack/repo-configs`. The tests compare the actual
   compiler identity with the catalog, reject an unpatched or mismatched tsrs,
   check update eligibility, and exercise the root rule map and exit-code policy.
   They do not freeze the catalog to one historical release.
5. A bump that adds rules follows the procedure under "Effect rules gate
   through Check": update the root severity map and copied profiles, keep
   the declared-off ledger explicit, and use the full check graph as the census.

## Type-aware Oxlint on tsrs

The installed `@effect/tsgo` 0.67.5 ships the Effect build of tsrs
`0.23.0-ts7.1.0-beta`, including its type-aware lint backend. There are two
separate integrations:

- `effect-tsgo patch --tsrs` patches the installed compiler binary. This is
  what this repository's `prepare` runs; it does not enable the Oxlint plugin.
- `effect-tsgo --tsrs-lint oxlint <args>` runs the installed Oxlint with the
  Effect native binding and Effect-patched Rust lint backend, without patching
  Oxlint on disk. Effect lint rules also require `plugins: ["effecttsgo"]`,
  type-aware mode, and explicit `effecttsgo/<rule>` severities or a preset.
  `effect-tsgo patch --oxlint` is the separate on-disk Oxlint integration.

For the existing standard TypeScript deprecated-API rule, the patched tsrs
launcher can be selected directly for an isolated comparison:

```sh
OXLINT_TSGOLINT_PATH="$PWD/node_modules/.bin/tsrs-lint" \
  node_modules/.bin/oxlint --config .oxlintrc.deprecated-apis.jsonc \
  --disable-nested-config --threads=4 packages/tooling/library/repo-utils
```

Use `tsrs-lint`, not `tsrs`: Oxlint appends `headless`, and the launcher adds
`--lint`. To run an Effect-enabled Oxlint profile, use the proxy above so the
Oxlint binding recognizes the Effect plugin as well as selecting the backend.
See [the Effect Oxlint setup](https://github.com/Effect-TS/tsgo/blob/main/docs/README.md)
and [the pinned tsrs lint documentation](https://github.com/oxc-project/tsrs/blob/ed745c993a1310daa5e6866b101d2e48818b351d/tools/tsgolint/README.md).

### Qualification status

A 2026-11-05 local probe of `@beep/repo-utils` checked 111 files with
`typescript/no-deprecated`. After one warm-up per backend, five alternating
runs with four workers and `TSRS_FAST=0` had median wall times of 2.35 seconds
(stock tsgolint 7.0.2005) and 0.90 seconds (Effect-patched tsrs 0.22.0), with
median maximum RSS of 3.41 GiB and 1.88 GiB respectively. Both returned zero
findings and exit 0. Separate deprecated-API and Effect `global-console`
positive controls produced matching diagnostic records and failing exits.
These are bounded local measurements, not full-repository or hosted CI proof.
A separate end-to-end worker probe included CLI startup and the coverage guard:
one warm-up followed by three alternating rounds at four workers measured
3.02 seconds for Go and 1.76 seconds for Rust (42% less time), with median
maximum RSS of 3.79 GiB and 1.90 GiB. All eight runs passed. The backend-only
and complete-command samples are separate measurements.

The default deprecated-API worker now selects the installed patched `tsrs-lint`
launcher directly. Alongside the lint, it asks Oxlint for its exact selected
files (`--debug=files`) and uses `tsrs/async` config parsing to prove TypeScript
file ownership. The proof and the lint run concurrently, so the proof's serial
segment (1.35-1.58 seconds on the full sweep) leaves the critical path. A proof
failure fails fast: it interrupts the running lint, whose process group the
spawner's scoped release reaps, and it outranks any lint exit code. Config
parsing handles extends, include/exclude and solution references; parsed
membership is cached within the invocation. A failed or truncated file
inventory, invalid config, or orphan TypeScript input fails the gate.
Composite-reference traversal is conservative where the API does not expose the
backend's pruning predicate. The full `packages`, `apps`, `infra` sweep passed
this guard and lint. `BEEP_LINT_TSGOLINT=true` restores the old Go backend and
its debug-summary guard for comparison or rollback.

`lint deprecated-apis --full` runs as three sequential Oxlint processes, named in
`LintDeprecatedApis.schemas.ts`: `foundation-tooling` (`packages/foundation`,
`packages/tooling`), `drivers-apps` (`packages/drivers`, `apps`) and
`remainder` (`infra` and `packages` with `--ignore-pattern` for the claimed
families, so a new family lands there). tsrs-lint keeps every program it builds
until it exits: 261 programs grew one process's resident set monotonically to
26.9-27.4 GiB at four threads and still 25.7 GiB at one thread. The partitions
peaked at 11.5, 10.9 and 8.5 GiB. A 2026-11-09 workstation measurement with a
load average of 50-110 put the four-thread command at 11.3-11.4 GiB against
26.4-27.2 GiB (22.3 GiB in a run that swapped). Wall and CPU time did not improve reliably. Four of five
partitioned runs took 56-64 s and 132-158 CPU-s, against 61-65 s and
153-154 CPU-s for the two comparable single-process runs. The fifth took 90 s
and 193 CPU-s at load 108 with 28 GiB available, and one partitioned run used
more CPU than either comparable single run. Each mode had one heavily
contended run (the single-process one swapped: 165 s, 209 CPU-s). Wall time on
the hosted 4-vCPU runner has not been measured, and sequential partitions may
lose parallel overlap there. `TSRS_MAX_MEMORY`, `TSRS_MEM_SPLIT` and `TSRS_FAST=1` did not lower the
lint peak. The proof inventories each partition beside the single-run
selection. It fails if a partition selects nothing, if two partitions overlap,
or if their union differs from the single-run inventory, and then proves
ownership of that inventory. Every partition runs even after one fails, so the
command still reports the complete set of findings. `--package` and `--target`
remain single-process runs.

Keep Effect compiler diagnostics enabled: they already gate through Check,
including the repository's explicit severity map. The upgrade adds the new
`matchToResultOrOption` rule at error severity to every copied profile (146
rules: 141 errors and five explicitly off). Effect-enabled Oxlint presets
must not silently replace that map or duplicate the same rules in both gates.

### Compiler performance defaults

The quality runner supplies `TSRS_FAST=1` to direct and secret-session-wrapped
Turbo processes, preserving an explicit `TSRS_FAST=0`. Turbo hashes and passes
this setting, so reference-mode and fast-mode task results cannot share a
cache key. Standalone compiler invocations and editors retain their existing
settings. The lint worker explicitly uses `TSRS_FAST=0`: fast mode was slower
on the measured lint workload.

The CLI's owned `beep:check` implementation gives its large source and test
projects separate `--checkerCostCache` files. These machine-local
`*.tsrs-cost-cache` files are gitignored and excluded from build artifacts;
they can be deleted to reset scheduling history. They help repeated fast-mode
checks, including checks whose incremental compilation is disabled. Keep
separate files for different projects. The generated public task bindings
remain managed by `beep lint package-scripts --write`.

Local qualification on 2026-11-05 (shared workstation; these are not hosted CI
speedup promises):

| Probe | Reference | Selected configuration | Result |
| --- | --- | --- | --- |
| Six compiler projects, sum of per-project median wall times, three cold-incremental rounds | 8.48 s | Fast, automatic checkers: 3.78 s | 55% less time; all exits and diagnostics matched |
| CLI source, four warm scheduling-cache rounds, cold incremental state | Fast without cost cache: 1.35 s | With per-project cost cache: 1.16 s | About 14% less time |
| CLI tests, same protocol | Fast without cost cache: 1.92 s | With per-project cost cache: 1.66 s | About 14% less time |
| Direct Rust lint launcher versus Effect proxy, five rounds | Proxy: 1.03 s | Direct: 0.91 s | Avoids proxy startup for the existing standard rule |
| Six-project parallel compiler batch, three rounds | Fixed four checkers: 4.24–4.34 s | Automatic checkers: 2.19–2.27 s | Keep automatic checker sizing |

Parallel batch widths of two, four and eight were effectively tied with
automatic checker sizing. Keep the existing host-aware Turbo admission and
concurrency profiles; this sample does not justify widening the entire build
graph. Fast mode passed all 342 repository build/check tasks and the Effect
smoke canary. A controlled emission comparison produced identical bytes for
4,524 JS, declaration and map files across the CLI, schema and GitHub Actions
packages. Upstream documents check-order-sensitive diagnostic cases, so retain
the reference-mode rollback when investigating a compiler regression.

`TSRS_FAST=1 oxlint --type-aware --type-check` was also tested. It checks the
programs reached by lint, including intentionally invalid compiler fixtures,
and does not match Beep's separate source, test, script, configuration and
build scopes. On the repo-utils sample it took about 8.3 seconds and reported
fixture errors, versus about 0.9 seconds for lint alone. It is not enabled.
Do not remove the separate compiler gate based on this option.

Memory targets (`--maxMemory`) recycle checker state in exchange for more CPU;
they are capacity controls, not unconditional speed improvements. The existing
quality admission controls remain responsible for host memory pressure. The
fast preset already enables the qualified lazy-member, declaration-parsing,
checker-cache and scheduling optimizations; experimental overrides remain at
upstream defaults. See [tsrs performance options](https://github.com/oxc-project/tsrs/blob/ed745c993a1310daa5e6866b101d2e48818b351d/docs/USAGE.md#performance-options)
and [persistent scheduling history](https://github.com/oxc-project/tsrs/blob/ed745c993a1310daa5e6866b101d2e48818b351d/notes/perf-balance.md).

### Build and check program equivalence

Before [check once](#check-once-the-check-leads-with-the-build), a library
package type-checked its `src` twice per run: `beep:build`
(`tsrs -p tsconfig.json --emitDeclarationOnly`, declarations and incremental,
build info in `dist/tsconfig.tsbuildinfo`) and `beep:check`
(`tsrs -p tsconfig.check.json`, `noEmit`, not incremental). The build serves as
the check only while the two programs report the same diagnostics and hold the
same package files. The check census is the standing proof:

```bash
bun run beep quality check-census --build-equivalence [--seed] \
  [--initial-state restored|warm] [--filter <text>] \
  [--equivalence-output-json <path>]
```

The mode runs alone: no overlay census, no baseline gate. It selects every
workspace package with `tsconfig.json`, `tsconfig.check.json`, a `src`
directory, and a `beep:build` with an `&&` segment equal to the generated
`tsrs -p tsconfig.json --emitDeclarationOnly`; no-emit builds
(`tsrs -p tsconfig.check.json`), framework builds and JavaScript-emit overrides
are skipped, and a selection with no package fails. The check runs as
`tsrs -p tsconfig.check.json --pretty false` and the build as the generated
invocation, `tsrs -p tsconfig.json --emitDeclarationOnly --pretty false`, both
from the package directory with the caller's environment, so `TSRS_FAST`
reaches the compiler and the report records its literal value (or `unset`). Two runs are identical when their exit codes and
their sorted, trimmed, non-empty output lines are equal; a failing compiler is
data, not a command failure.

- The clean pass compares one check run with the build as found (labelled by
  `--initial-state`, default `warm`), a second build when that label is
  `restored`, and a cold build after the outDir is removed.
- `--seed` writes `src/__census_probe.ts` (a TS2322 and a floating Effect),
  compares the as-found, warm-retry and cold builds with the seeded check,
  removes the probe, then compares a recovered warm build and a cold clean build
  with a fresh clean check. A seeded check that exits 0 or prints no
  `error TS` line marks the row `probeEffective: false`, which fails the run.
  Its finalizer removes the probe and, unless the pass finished its cold clean
  rebuild, the outDir, so no `__census_probe.*` output survives a failure or
  an interruption.
- `restored` is only a label the caller declares: run the Turbo cache restore
  first (for example `bunx turbo run build --filter=<package>`), then pass
  `--initial-state restored`. The census cannot observe where the state came
  from.
- Builds run in place, strictly one package at a time, because a cold step
  deletes an outDir that downstream programs read. Every outDir is resolved
  through the `extends` chain and must lie strictly inside its package, or the
  run refuses before any compiler starts. Run it on a built tree you are not
  using for anything else meanwhile.

- Before either pass, both programs run with `--listFilesOnly`. Each row
  records `checkOnlyFiles`, the files inside the package directory that the
  check program lists and the build program does not (relative to the package,
  sorted), and `servedByBuild`, whether the package's `beep:check` leads with
  the build program (its own flags allowed). The summary counts `widerChecks` (rows with a non-empty list) and
  `servedWiderChecks` (those whose check the build serves); a non-zero
  `servedWiderChecks` fails the run, because that package's own-source check no
  longer covers every file it used to.

The report (`check-census-build-equivalence/v2`, default
`.beep/quality/check-census-build-equivalence.json`) is written before a
difference, an ineffective probe or a served wider check fails the command;
differing comparisons print both programs' lines and every wider check prints
the files it adds.

## Binary paths (Linux x64)

Verified at 0.67.5. Substitute the platform triple on other machines.

- `node_modules/@effect/tsgo-linux-x64/lib/tsc` is the latest TypeScript (7.0.2)
  Effect artifact. Since 0.52 it is shipped once in `lib`, not duplicated under
  `artifacts/typescript/7.0.2`. Other upstream versions remain under
  `artifacts/typescript/<version>/tsc`.
- `effect-tsgo get-exe-path` and the `tsgo` shim resolve the correct binary from
  installed upstream metadata. Avoid hardcoding an artifact-version directory.
- `node_modules/@typescript/typescript-linux-x64/lib/tsc` is the patched native
  binary; `tsc.original` beside it remains the stock TypeScript backup.
- `node_modules/@tsrs/linux-x64-gnu/tsrs` is the patched Rust binary;
  `tsrs.original` beside it is the stock tsrs backup. The Effect build it was
  copied from is `node_modules/@effect/tsgo-linux-x64/artifacts/tsrs/<tsrs version>/tsrs`,
  shipped with its `lib.*.d.ts` files beside it (the tsrs build loads them from
  disk, matching upstream's `noembed` packaging).

## Effect rules gate through Check

Every Effect rule gates inside the compiler: the three
`ignoreEffect*InTscExitCode` options are **false** in `tsconfig.base.json` and
every copied compiler profile, so `tsrs` in `beep:build`, `beep:check` and
`beep:check:*` (and `tsgo` in the test-tsgo lanes) fails on an Effect error the
same way it fails on a TypeScript error. `Heavy / Check` is the Effect-rule
gate; there is no separate diagnostics job. A policy fixture in
`@beep/repo-configs` proves an Effect-only finding fails `tsrs`, an empty-project
canary proves the root map produces no unknown-rule warnings, and
`beep quality tsgo-rules` checks that every installed rule is configured, that
the copied profiles match the root map exactly (effect-drizzle's former
`missedPipeableOpportunity` exception was retired 2026-10-31), and that the
documented plugin options are explicit.

The root map in `tsconfig.base.json` holds all 146 active rules of the installed
`@effect/tsgo` (141 errors, five declared off: `apiStabilityLeak`,
`experimentalApiUsage`, `unstableApiUsage`, `preferBarrelImport`,
`preferNamespaceImport`). `preferBarrelImport` stays off because Effect barrel
imports violate the module-path law. `preferNamespaceImport` stays off because
the rule has no named-import allowlist: with `effect` in
`namespaceImportPackages` it reports every `pipe`, `flow`, `identity`, `dual`
and `constant` named import from `effect/Function` that the code law requires
(2026-10-31 census: 6422 reports in 1998 files, 5125 from `effect/Function`,
the other 1297 in 112 files mostly in `@beep/effect-drizzle`). Enabling it needs
an upstream allowlist option or a change to that law.

### Namespace-import replacement qualification

On 2026-11-05, isolated fixtures were checked with both installed compilers:
`tsgo` reported `7.0.2+effect-tsgo.0.67.1`, and `tsrs` reported
`7.1.0-beta+effect-tsgo.0.67.1 (tsrs 0.21.0-ts7.1.0-beta, ...)`.
Only `preferNamespaceImport` was enabled in the fixture profile, with
`namespaceImportPackages: ["effect"]` and Effect errors included in the exit
code. The same fixtures were checked with `laws effect-imports --candidate
--check --json`, using its code, JSDoc, and Markdown modes as appropriate.

| Fixture | Compiler diagnostic | Existing import law |
| --- | --- | --- |
| Named import from the root barrel | TS377146 | Rejects |
| Named import from a nested barrel | TS377146 | Rejects |
| Namespace import from the root barrel | None; exit 0 | Rejects |
| Namespace import from a nested barrel | None; exit 0 | Rejects |
| Named re-export from the root barrel | None; exit 0 | Rejects |
| Namespace re-export from the root barrel | None; exit 0 | Rejects |
| Type-level reference through the root barrel | None; exit 0 | Rejects |
| Root barrel import inside a JSDoc fence | None; exit 0 | Rejects |
| Root barrel import inside a Markdown fence | Outside the compiler input | Rejects |
| Named `pipe` import from `effect/Function` | TS377146 | Permits |
| Namespace import from `effect/Effect` | None; exit 0 | Permits |

Both compilers produced the same diagnostic findings. For a reported error,
`tsgo` exited 1 and `tsrs` exited 2. The fixtures demonstrate that this
diagnostic cannot replace the existing import law at these versions. Keep
the law and its documentation checks. Enabling the diagnostic separately
requires resolving the Function import policy and migrating its consumers;
it does not qualify deletion of the law.

History: from 2026-10-14 to `goals/tsrs-gates` PR 2 (2026-10-27) the newest
rules ran in a standalone `Heavy / Effect Diagnostics` job
(`goals/effect-rules-diagnostics-lane`), because the gate compiler then was
tsc-rs with an older rule set compiled in. That job needed an 8-vCPU runner, a
19 GiB cgroup and 20 to 25 minutes per PR; the Effect-patched tsrs runs the same
rules inside the four-minute `Heavy / Check`. A bump that adds rules must
update the complete root severity map and the copied profiles, keep the
declared-off ledger explicit, remove retired plugin options, and run the full
check graph as the census.

## New compiler option values

`beep tsconfig-sync` decodes every tsconfig it reads through
`@beep/tsconfig/TsconfigJson`, whose `target`, `module`, `moduleResolution`,
`jsx`, `newLine`, `moduleDetection`, `lib` and `ignoreDeprecations` fields are
closed vocabularies in
`packages/foundation/modeling/tsconfig/src/CompilerOptions.ts`. Before a
tsconfig adopts a value a TypeScript bump introduces (a new `target`, an
`esnext.*` lib), add it to the matching literal set in the same PR. Otherwise
the sync, and with it `create-package` and the cheap gates, fails with
`Failed to parse JSONC in "<file>"` naming the field. Decision record:
[goals/effected-promotion/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/effected-promotion/SPEC.md) (3-A7 row).

## Programmatic access

Run sync API consumers with Node: the upstream transport requires Node private
stdio handles and currently cannot run under Bun. Native-parser tests therefore
run on Node after the remaining Bun test suite.

First-party compiler tools use `TsNativeApi` from `@beep/repo-utils/TsNativeApi`.
Provide `TsNativeApi.layer(TsNativeConfig.make({ cwd, tsconfig }))` with platform
filesystem/path/child-process services at the entrypoint (for example,
`NodeServices.layer`). The layer owns one Go API process
and closes it when its scope ends. Its default executable is the installed
`@effect/tsgo` artifact; `executable` accepts an explicit override.

Call `program(tsconfig)` or `sourceFile(path)` inside `Effect.scoped`; native
handles remain valid only within that scope. `parseSource(fileName, text)` uses
a distinct virtual path per parse for syntax controls and research walkers.
Walk nodes with `node.forEachChild` and guards from
`@typescript/native/unstable/ast`. `diagnostics(tsconfig)` returns detached,
schema-decoded diagnostics. Binary resolution, protocol and missing-file
failures have typed errors. These unstable API calls are validated against the
installed package declarations and require review when upgrading TypeScript.
The programmatic API uses the Go compiler; check/build gates remain on the
Effect-patched tsrs.

## What still needs TS6

- **infra/Pulumi:** Pulumi's nodejs runtime loads the classic compiler API at
  deploy time (ts-node registration and the closure serializer) and declares a
  `< 7` TypeScript peer. The requirement stays inside `infra/`: infra pins its
  own nested `typescript: ^6.0.3`, and every infra `Pulumi.yaml` preloads
  `infra/pulumi-typescript6.cjs` through `runtime.options.nodeargs`, which
  resolves `typescript` to that nested copy (the hoisted `@pulumi/pulumi` would
  otherwise find the root TypeScript 7). A local file-backend `pulumi preview`
  logs "Found typescript version 6.0.3 at infra/node_modules/typescript". The
  ghaRunners SDK build uses the same nested compiler through
  `infra:prepare-gha-runners`. A narrowly scoped syncpack version group permits
  only this package/dependency divergence. Remove the preload once Pulumi's
  nodejs runtime supports TypeScript 7. An Alchemy migration was considered and
  rejected (`explorations/pulumi-to-alchemy`).
- **Classic API scripts:** the schema-opaque goal codemod/fixup use the
  TypeScript 6 `ts` namespace that ts-morph bundles (`import { ts } from
  "ts-morph"`), so no classic `typescript` package is declared at the root.
  Microsoft's `@typescript/typescript6` bridge and the scratchpad JSDoc census
  that imported it were removed on 2026-11-09.
- **Frozen ontology replay:** reproducing the frozen 2026-08-29
  `beep-ci-operational-ontology` TypeScript adapter needs a 6.x `typescript`
  (for example in a scratch install); preserve its bytes and digest.

Effect-drizzle stays on exact tstyche `8.0.0-beta.0`. Its hosted matrix is
`5.9.3 || 6.0.3`, both exact; explicit targets load compilers from tstyche's
own store and do not load root `typescript`. TypeScript 7 coverage is on demand:

```sh
bun run --cwd packages/ecosystem/effect-drizzle beep:type-test --target next
```

On 2026-10-14 `next` resolved to `7.1.0-dev.20261014.1` and all 78 assertions
passed. It stays out of hosted checks because it moves daily; the beta excludes
7.0 (including 7.0.2) and refuses exact prerelease targets. Add an accepted exact
7.1 beta/stable to the hosted matrix when available. See
`goals/ts7-tstyche8-type-tests` for the lane-C ruling and migration evidence.
Commitlint loads its config through jiti; ts-morph vendors its compiler.
Deprecated API scanning uses Oxlint with the patched `tsrs-lint` worker by default;
`BEEP_LINT_TSGOLINT=true` restores the bundled Go worker for rollback.

Circular dependency lint uses oxlint’s native `import/no-cycle` rule on the two
tooling source roots. It ignores type-only cycles and requires a positive checked
file count. Madge and its classic compiler parser stack are removed.

Next's build-time type checks use `experimental.useTypeScriptCli: true` in
oip-web and todox. This avoids loading the absent classic `lib/typescript.js`;
Next's native-preview auto-detection does not recognize our native alias.

## Editors

WebStorm's **Languages & Frameworks > TypeScript** picker only lists packages
named `typescript` that carry `lib/tsserver.js`. Native TypeScript 7 has no
`tsserver.js`. The old root 6.0.3 picker entry is gone on purpose. Choose
JetBrains' bundled **TypeScript 7 (Native)** service for plain TS diagnostics
and the Effect plugin’s language server for Effect diagnostics.

Effect diagnostics come from the Effect JetBrains plugin's language server,
which launches the native binary with `--lsp --stdio`. Point its **Binary mode**
at `MANUAL` with the `lib/tsc` path above, never at the
`effect-tsgo` CLI wrapper. `MANUAL` keeps the editor on the catalog's exact
`@effect/tsgo` version; `LATEST` pulls whatever npm tags latest, which can run
ahead of the repo. The plugin setting is stored in the machine-local
`.idea/effect.intellij.xml`, which `beep worktree new` copies into sibling
worktrees (`standards/git-worktrees.md`). A `MANUAL` path is absolute, so a
copied file still points at the source worktree's `node_modules`; re-point it
per worktree if the worktrees drift in `@effect/tsgo` version.

Documentation lint uses repo-owned oxlint plugins. Both lint lanes use oxlint;
ESLint and its TypeScript parser were removed in TS7 exit lane B2.
