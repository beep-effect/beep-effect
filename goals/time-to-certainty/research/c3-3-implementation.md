# C3.3 implementation results

## Stage A

Implemented the package-local scanner on `ttc/c3-3-laws-task`. No git writes or graft commands
ran. Stage B task registration, fleet runs, policy-plan rewiring, and packet lifecycle changes
were not started.

### Decisions and rejected alternatives

1. Added `LawsPackageScope`, `LawsPackageFinding`, and `LawsPackageReport` before the worker;
   `LawsPackageLaw` is a LiteralKit. Scope records the package, repository root, actual config
   path, and selected laws. Reports retain per-law counts, diagnostic text, advisory status,
   strict failure, and the actual project source-file count. All four schemas have fast-check
   round-trip coverage using `S.toArbitrary` and `effect/testing`.
2. Extended `TsMorphProjectInspectionRequest` with `loadTsconfigFiles`, whose constructor and
   decoding default is true, and an explicit `packageSyntax` factory selecting the tsconfig
   entrypoint, `mode: syntax`, `referencePolicy: workspaceOnly`, and false preload. The project
   pool separates ordinary and explicit-file projects. The existing root-scoped project
   options and default remain unchanged. Rejected changing the global root default or reusing
   a preloaded project for the package request. A fixture deliberately includes an unrelated
   root file in its package config: ordinary inspection sees three files, package inspection
   sees exactly its two discovered files, and returning to the package pool still sees two.
3. Provided a `LawScanProject` service around the package worker. Terse-effect, native-runtime,
   and the shared frozen-grant-set/effect-fn scan scaffolding reuse it; absent that service,
   their existing project acquisition paths remain. Package-test-imports reuses the existing
   source-root ownership walker and module-specifier detector on the shared SourceFiles,
   reading every package manifest without creating a second project. Rejected copying the
   detectors, retaining subprocesses, or changing the root law commands.
4. Preserved the package TS/TSX expansion from amendment 6, including files outside src/test,
   with artifact and declaration exclusions. Each detector retains its diagnostic exclusions;
   ecosystem exclusion applies to terse-effect/native-runtime, and tests remain excluded from
   those four syntax laws but included in package-test-imports. Terse-effect stays advisory;
   other laws retain their existing strict-failure policy, including native-runtime warnings.
   The CLI uses `lint laws:` prefixes and fails at the first failing report row. The scanner
   collects every selected law's result in one process/project. Empty packages skip the four
   syntax laws but still perform package-test-import ownership discovery. Non-packages paths
   omit that law and explain why.
5. **Explicit contract deviation requiring Fable's ruling before landing:** the brief assumes
   a package-root `tsconfig.test.json`, but repo-cli, todox, ciops, and infra do not have one.
   The resolver prefers it when present, otherwise uses that package's `tsconfig.json` solely
   for compiler options with config preload disabled, adding the full package TS/TSX surface
   explicitly. The actual selected path is recorded in `LawsPackageScope`. An asynchronous
   question offered this fallback or creating missing overlays; no answer was received during
   this launch. The fallback is implemented and tested, but is not represented as an approved
   amendment. Rejected falling back to the repository root, creating a fleet of unrequested
   config files, or silently omitting package tests.
6. Kept the deprecated-API code, `Quality/Tasks.ts`, ESLint configs, Turbo task declarations,
   workspace manifests, and root commands unchanged. The structure-only fingerprint writer
   and check remain the canonical declaration proof; no content digest or task registration
   was introduced.

### Stage A — files

- goals/time-to-certainty/research/c3-3-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts
- packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts
- packages/tooling/tool/cli/src/commands/Laws/LawsPackage.model.ts
- packages/tooling/tool/cli/src/commands/Laws/LawsPackage.ts
- packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts
- packages/tooling/tool/cli/src/commands/Laws/index.ts
- packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts
- packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts
- packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts
- packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts
- packages/tooling/tool/cli/test/laws-package.test.ts
- packages/tooling/tool/cli/test/lint-workers.test.ts

### Verification commands and exit codes

The two test files are `test/laws-package.test.ts` and `test/lint-workers.test.ts`, run from
`packages/tooling/tool/cli`. `<touched TS>` means the twelve TypeScript paths above. Tests use
scoped fixtures, platform services, no Bun globals, and no Git-writing fixture commands.
The executable worker test spawns the real CLI against a package fixture; the in-process
command test proves no law subprocess is requested and a finding produces failure.

| Command | Exit | Result |
| --- | --- | --- |
| `bun run beep architecture` | 0 | Read-only command index before creating the Laws modules. |
| `bunx biome check --write <touched TS>` | 0 | Final formatting pass. Initial test pass found unused imports, subsequently removed. |
| `bunx biome check <touched TS>` | 0 | Twelve files, no fixes, final 1,021 ms. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 1, 0 | Hoisted the new scope factory's compiled decoder; final pass has no diagnostics. |
| `bunx --no-install vitest run --pool=threads <touched tests>` | 0 | Both files, 25/25 tests, final 30.08 s. |
| `bunx --bun vitest run --pool=threads <touched tests>` | 1, 0, 0 | Initial live fixture lacked a tsconfig; supplied its explicit fixture overlay. Final 25/25, 20.47 s. |
| `bun run beep lint schema-first` | 0, 0 | Final inventory has no missing/stale entries, candidates, or advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0, 0 | Final saved report `exitStatus: 0`; nine inherited-adjacent nonblocking findings, zero introduced. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0, 0 | Final saved report `exitStatus: 0`, zero findings. |
| `bun run beep lint policy-fingerprint --write` | 0 | Repeated after CLI source edits; declaration and Turbo inputs remain byte-identical to the starting tree. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current declaration and materialized inputs. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx --no-install tsgo -p /tmp/c3-3-focused.json --pretty false` | 1 | Environment: the Node wrapper's child spawn returned EPERM. |
| `bunx --bun --no-install tsgo -p /tmp/c3-3-focused.json --pretty false` | 1, 0 | Final source-resolving check is clean. Intermediate introduced annotation, literal helper, unused-import, test Effect-boundary, and nested-layer diagnostics were repaired. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace check. |
| `bun run beep laws <law> --check [--advisory] --include <package files>` | 0 for all 12 | Final root-command parity: four laws on each of identity, schema, and repo-cli; all diagnostic counts remain zero. |
| `cmp turbo.json /tmp/c3-3-turbo-before.json` | 0 | Turbo configuration is byte-identical to the initial tree. |

The focused tsgo config extends the actual CLI config, includes the two touched test files
and their source imports, removes project references, and sets no-emit/non-composite/
non-incremental options, repository rootDir, and local Node/Bun type roots. It is supporting
proof, not canonical package verification. Node and Bun test runs were concurrent with each
other, so their wall times are test evidence rather than comparable performance benchmarks.

### Measurements

Each before/after worker probe ran from the repository root with `/usr/bin/time -f
'wall=%e maxRSS=%M exit=%x' bun run beep lint laws --package <directory>`. Measurements were
sequential, with final after probes separated from the test/check fan-out. RSS is GNU time's
maximum resident set size in KiB, not aggregate RSS across concurrent processes. All six
worker probes exited 0. The brief's historical identity baseline was 14.3 s / approximately
1.0 GB; the table uses the fresh baseline from this launch instead.

| Package | Before wall | After wall | Before max RSS (KiB) | After max RSS (KiB) | After project files |
| --- | ---: | ---: | ---: | ---: | ---: |
| `@beep/identity` | 12.76 s | 2.69 s | 1,027,272 | 1,065,364 | 21 |
| `@beep/schema` | 13.91 s | 3.59 s | 1,302,316 | 1,521,936 | 349 |
| `@beep/repo-cli` | 21.49 s | 8.35 s | 2,825,780 | 3,911,464 | 746 |

Wall reductions are 78.9%, 74.2%, and 61.1%; RSS increases are 3.7%, 16.9%, and 38.4%.
This is a wall-time improvement, not a memory improvement. The shared package project holds
test source alongside production source, and the existing CLI boot/import cost remains.
No fleet concurrency change, cache-hit claim, hosted timing, or whole-proof speedup follows
from these three samples. The synthetic negative fixture proves the source boundary directly:
exactly two package files, no imported dependency file, and no unrelated root preload.

All three baseline workers reported zero terse, native-runtime, frozen-grant-set, and
effect-fn diagnostics; their final package workers report the same zero findings. The
one-violation-per-law fixture separately exercises nonzero results and failure/advisory policy.

The final direct root-command comparison executed all four root laws on the same discovered
package surfaces (21, 349, and 746 files respectively), with `--check` and terse-effect's
`--advisory`. All twelve commands exited 0 and all touched/warning/error/violation counts
were zero, matching the package reports. Full ephemeral logs are under `/tmp/c3-3-parity-*`;
this paragraph preserves the outcome without depending on those temporary files.

### Blockers, baseline notes, and verification split

The missing package-root test-overlay assumption remains a design-contract blocker, described
in decision 5. The implementation uses the documented package-config fallback; no user reply
ratified it in this launch. Fable must accept that amendment or replace it with explicit
package-root test overlays before calling the implementation an exact match to the brief.
All requested sandbox checks pass; no sandbox check failure is being waived.

Fable owns `bun run beep quality package-verify @beep/repo-cli`,
`bun run beep quality package-verify @beep/repo-utils`, Node coverage/ratchet, docgen acceptance,
and the hosted lane. This lane did not run or claim those checks. The required baseline-row
notes for new source modules are:

| New source row (CLI-relative) | Coverage handoff |
| --- | --- |
| `src/commands/Laws/LawsPackage.model.ts` | Four schema round trips exercise constructors and codecs. Fable must measure and establish the coverage row; 100% coverage has not been claimed. |
| `src/commands/Laws/LawsPackage.ts` | Fixtures cover the five detectors, explicit/no-preload scope, missing overlay, lab/app/infra inventory, ecosystem exclusions, root-owned TSX, empty package, and command failure. Fable must measure branch coverage, including malformed/missing configuration and platform failures, before establishing the row. |

Existing rows for the Laws facade/scanners, lint command, package-test-import detector, and
TSMorph model/service also require Fable's coverage evaluation. No coverage baseline or
exemption file was edited. The missing local Effect symlink was handled by reading the parent
checkout's canonical reference; it was not installed or rewired. The reference checkout and
installed Effect snapshot differ on arbitrary derivation, so the explicitly required
`S.toArbitrary` was additionally verified against the installed snapshot source and exercised
on both runtimes.

No git write command, protected-path edit, manifest rewrite, package-task registration,
policy-plan change, or Stage B work was performed. The named files and this results section
are the handoff. Stop after Stage A.

## Stage B

Implemented Stage B only on `ttc/c3-3-laws-task`, starting from the clean committed Stage A
worktree. Read the full brief and its Amendment 1: the package-config fallback is now ratified,
so Stage A's earlier overlay-contract blocker is resolved. No git writes or graft commands ran.
The task declarations, hash fixtures, and package fleet proof are complete. The prescribed root
residual has a verified command-contract blocker; Stage B is not a fully green activation proof.

### Decisions and rejected alternatives

1. Registered `lint:laws` with all ten §2.1 inputs verbatim and in table order, `cache: true`,
   `outputs: []`, and only `//#lint:policy-fingerprint` in `dependsOn`. A direct table-to-JSON
   comparison confirms the exact ordered list. Rejected build/transit edges for a syntax task,
   a copied checker closure, broader source globs, and changes to Turbo global inputs.
2. Registered `//#lint:native-runtime:roots` with the two prescribed root TS/TSX globs and four
   allowlist sources (the allowlist JSONC, both named eslint files, and generated snapshot),
   `cache: true`, empty outputs, and the fingerprint dependency. Added the root script exactly
   as prescribed: `beep-cli laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology`.
   The root manifest is outside the workspace scripts writer's domain, matching C3.2's root
   residual precedent; no generated workspace scripts were hand-edited or rewritten.
3. **Verified brief conflict:** native-runtime accepts `--include`, not `--include-prefix`.
   C3.1 amendment 6 already documents that distinction. The exact direct command and the real
   registered Turbo task both exit 1 with `Unrecognized flag: --include-prefix`. Preserved the
   explicitly required script and recorded the blocker immediately in `OPPORTUNITIES.md`.
   Rejected silently substituting `--include` with directory arguments (it expects source-file
   paths), running a wider root sweep, or extending the root law command outside this Stage B
   registration/fixture scope. Fable must ratify a working residual invocation or a scoped
   prefix-expansion implementation before activation.
4. Added the requested separate `laws-turbo-inputs.test.ts`. Schema classes describe task
   declarations and real Turbo summaries before the fixture helpers; compiled JSON codecs,
   schema-derived equivalence/arbitraries, NodeServices, FsUtilsLive, and StepExec follow the
   existing fingerprint fixture idiom. The fixture loads the production declarations rather
   than testing only a copy of the desired configuration. No production source module,
   service, test-only source export, or coverage-baseline row was added.
5. Seventeen isolated mutations each restore the exact baseline before the next edge is
   tested. Consumer source/test/manifest/overlay, the extra root tsconfig, and upstream and
   unrelated package manifests invalidate only the package task. Both residual roots invalidate
   only the root task. The allowlist JSONC, two rule files, and generated snapshot invalidate
   both tasks while leaving the fingerprint hash stable: the synthetic repo-configs package
   deliberately lies outside the fixture CLI closure, so that closure cannot mask a missing
   direct input. A helper source inside the CLI closure separately invalidates the fingerprint
   and both dependents. Upstream source, unrelated package source, and unrelated root source
   change none of the three hashes. Rejected cumulative mutations and mock hashes. Fixtures
   create no git repository and use no git-writing subprocesses or Bun runtime globals.
6. Used the exact requested fleet command. Its first run passed but emitted read-only
   default-cache warnings and overlapped verification. Recorded that friction and retained it
   as a smoke measurement. The isolated measured pair uses a fresh writable cache selected by
   `TURBO_CACHE_DIR="$PWD/.beep/c3-3-stage-b-cache"`; all task/concurrency/cache-policy flags stay
   exactly as requested. No cache was deleted, no remote cache was used, and no other verification
   ran alongside the measured pair. Both measured runs have identical task hashes and no cache
   write warning. The initial smoke warms filesystem/module caches; “cold” here means an empty
   Turbo task cache, not a cold machine.
7. Kept `Quality/Tasks.ts`, deprecated-API code, eslint configs, every workspace manifest,
   fingerprint declaration, Stage A production source, and packet lifecycle unchanged. No
   policy-plan switch or `beep:policy` retirement was attempted.

### Stage B — files

- goals/time-to-certainty/research/c3-3-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- package.json
- turbo.json
- packages/tooling/tool/cli/test/laws-turbo-inputs.test.ts

### Verification commands and exit codes

Vitest ran from `packages/tooling/tool/cli`; other commands ran from the worktree root.
`<touched>` is `package.json`, `turbo.json`, and the new fixture; `<touched TS>` is that fixture.
Logs are ephemeral `/tmp/c3-3-b-*.log`; the results and summary identities below retain the proof.

| Command | Exit | Result |
| --- | --- | --- |
| `bunx biome check --write <touched>` | 0 | Formatted Turbo and the new fixture. |
| `bunx biome check <touched>` | 0 | Final three-file check, 942 ms, no fixes. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 0 | No diagnostics. |
| `bunx --no-install vitest run --pool=threads test/laws-turbo-inputs.test.ts` | 0 | Node: 3/3 tests, 7.15 s. |
| `bunx --bun vitest run --pool=threads test/laws-turbo-inputs.test.ts` | 0 | Bun: 3/3 tests, 5.07 s. |
| `bunx --bun --no-install tsgo -p /tmp/c3-3-b-focused.json --pretty false` | 0 | Source-resolving focused test check, no diagnostics. |
| `bun run beep lint schema-first` | 0 | No new inventory drift, candidates, or advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0 | Saved `.beep/fallow/audit.check.json` has `exitStatus: 0`; nine inherited-adjacent nonblocking findings, zero introduced. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0 | Saved `.beep/fallow/health.check.json` has `exitStatus: 0`, zero findings. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current; no CLI source edits required regeneration. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| Exact ordered comparison of §2.1 row against `lint:laws.inputs` | 0 | Ten entries, identical. |
| `bunx turbo run //#lint:native-runtime:roots --dry-run=json --cache=local:rw` | 0 | Resolves the exact prescribed script and fingerprint dependency. |
| `bun run beep laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology` | 1 | Brief/CLI contract conflict: unsupported `--include-prefix`. |
| `bunx turbo run //#lint:native-runtime:roots --summarize --cache=local:rw` with writable cache env | 1 | Same unsupported flag through the registered task; fingerprint hits, residual fails. |
| Requested fleet command, default cache smoke | 0 | 141/141 successful, no hits; read-only cache warnings. |
| Requested fleet command, isolated writable-cache cold | 0 | 141/141 successful, 0 cached. |
| Same command and tree, writable-cache warm | 0 | 141/141 cache hits. All 141 task hashes match the cold run. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification. |

The focused tsgo config extends the actual CLI config, includes only the new test and its
source imports, removes project references, sets no-emit/non-composite/non-incremental,
uses the repository rootDir, and resolves the local Node/Bun type roots. It is supporting
proof, not package verification. Node and Bun tests ran concurrently with the smoke fleet;
their durations are functional verification evidence, not isolated benchmarks. Tests do not
change cwd or mutate CI environment state, avoiding the earlier sticky-runtime failure mode.

### Measurements

Exact fleet command for all three runs:

```sh
bunx turbo run lint:laws --concurrency=4 --continue=dependencies-successful --summarize --cache=local:rw
```

The measured cold and warm invocations prefix that command with
`TURBO_CACHE_DIR="$PWD/.beep/c3-3-stage-b-cache"`. Turbo 2.10.12 confirms remote caching is disabled.
142 packages are in scope; 140 own executable law tasks, plus the fingerprint task.
`@beep/scratchpad` and `@beep/tsgo-shim` have no package `lint:laws` task. The separate root
residual is not included by the fleet command and is not counted as a success here.

| Run | Tasks successful or replayed | Cached | Turbo wall | Package-task p50 | Package-task max | Package task-seconds | Total task-seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Default-cache smoke, verification overlap | 141/141 | 0/141 | 88.088 s | 2.131 s | 8.900 s | 340.593 s | 342.386 s |
| Isolated task-cache cold | 141/141 | 0/141 | 86.228 s | 2.120 s | 9.318 s | 333.067 s | 334.817 s |
| Same-tree warm | 141/141 | 141/141 | 0.405 s | 0.000 s | 0.001 s | 0.004 s | 0.004 s |

Both cold maxima are `@beep/repo-cli#lint:laws`. The isolated fingerprint takes 1.750 s;
all-task p50 is 2.119 s and max is 9.318 s. Durations are each task's execution end minus start
from that invocation's summary; task-seconds sum those durations. Warm per-task durations
measure cache replay bookkeeping, not scanner execution. The warm summary records zero newly
executed successes and 141 cached tasks; every task has `cache.status: HIT`, and Turbo prints
141 successful including replay. Every cold task has execution exit code zero.

| Invocation | Summary relative to this checkout |
| --- | --- |
| Default-cache smoke | `.turbo/runs/3J84B9aIfT2k1cndzahdUI1a6iX.json` |
| Isolated cold | `.turbo/runs/3J84NiR7vmhwpTFdzW7gpvRj3Cr.json` |
| Warm | `.turbo/runs/3J84OFjebHQiWREs2H3SKSJIeMe.json` |
| Root residual execution, failed | `.turbo/runs/3J84QJctJ6UwO6YcZaD0pCcmRBW.json` |

The table's five hosted steps total **109 s = 33 + 27 + 19 + 16 + 14**. The local isolated
package fleet wall is 22.772 s (20.9%) below that reference, and unchanged task-cache replay is
0.405 s. This is not a same-machine speedup or full-sweep parity claim: the hosted baseline
uses another machine and includes root coverage missing from the prescribed package-only
measurement. Local cold aggregate work is 334.817 task-seconds at concurrency four. No fresh
hosted measurement, remote-cache hit ratio, whole-proof improvement, or residual success is
claimed. Resolving the residual blocker and measuring the combined hosted invocation remain
necessary before activation.

### Precise follow-up, blockers, and verification split

After C3.3 and C3.2b land, **`rootRepoLintPolicySteps` replaces the five `scopedLawStep`s with
`turbo run lint:laws //#lint:native-runtime:roots` (affected locally, full hosted), behind the
sweep switch C3.2b introduces (`standards/lint-policy.sweeps.jsonc`, key `laws`), and
`beep:policy` retires from the two manifests and the scripts schema.** This lane does not make
that switch. The unsupported residual flag must be resolved by a ratified command amendment
or prefix-expansion implementation before the switch can be enabled.

The root residual command is the sole verified activation blocker. Hash fixtures, the package
fleet, and all requested static/sandbox checks pass; the failing root execution is not waived
or described as an environment-only failure. The default-cache restriction was resolved for
measurements with the lane-local cache. Both friction receipts are in `OPPORTUNITIES.md`.

Fable owns `bun run beep quality package-verify @beep/repo-cli`, Node coverage/ratchet, and the
hosted lane. Repo-utils is untouched in Stage B; its Stage A acceptance remains Fable-owned.
No new source module or coverage baseline was created. No Git writes, protected-path edits,
workspace script rewrite, policy-plan edits, packet-state changes, or later-stage work occurred.
Stop after Stage B.

## Stage C

Implemented only Amendment 2026-09-10 (2) on `ttc/c3-3-laws-task`, starting from the clean,
committed Stage A/B worktree. The root residual's unsupported-flag blocker is resolved: its
actual root script and registered Turbo task now pass, and the same-tree warm task replays.
No git writes or graft commands ran.

### Decisions and rejected alternatives

1. Added `includePrefix` to `NoNativeRuntimeCommandOptions`, with constructor/decoding default
   `""`, and wired `includePrefix: includePrefixFlag` beside `include`. Parsing uses the exact
   `parseExcludePaths` helper already used by effect-imports, preserving comma splitting,
   trimming, and empty-token removal. Added defaulted `includePrefixes` to the existing runtime
   options schema before implementing its consumer. Rejected another parser or new source module.
2. Expanded each directory prefix to `<prefix>/**/*.{ts,tsx}`, removing trailing slashes, then
   unioned and deduplicated those globs with explicit `--include` files. The absent scope keeps
   the existing default globs. An empty directory prefix means a supplied directory with no
   matching sources; it scans zero files, rather than falling back to the default corpus.
   The default empty prefix string remains an absent prefix scope, matching effect-imports.
   Rejected treating `--include` files as directory prefixes or making prefixes select the
   full root corpus.
3. Reused native-runtime's existing `sourceFileGlobs` project path and diagnostic exclusions.
   The project factory reads root compiler options by value and adds only matched files, so
   no tsconfig corpus preload is introduced. Existing artifact, declaration, test, ecosystem,
   and caller exclusions remain; the docs-negative glob also applies to scoped scans. No
   detector, allowlist, shared package-project behavior, or project-factory rewrite was needed.
4. Added four real CLI fixture tests in a separate runtime-agnostic test file. They cover
   whitespace/comma parsing, multiple prefixes, trailing slashes, TSX, an outside clean file,
   an outside violation and neighboring-prefix sentinel, artifact/declaration/test/docs
   exclusions, an overlapping file/prefix union, an empty directory, explicit-file scope, and
   caller exclusion. Scanned-file counts prove the broad fixture tsconfig did not preload
   outside sources; overlapping scopes report each source once. Fixtures use NodeServices,
   scoped temporary directories, and StepExec child cwd, without ambient cwd/CI mutation,
   Bun globals, mocks of scanning, or Git-writing setup.
5. Regenerated the structure-only fingerprint after the CLI edits. The declaration and
   `turbo.json` remain byte-identical to the committed Stage B versions. Rejected a content
   digest or handwritten hash/config update. Used a fresh lane-local writable Turbo cache
   for the isolated cold/warm pair, with remote caching disabled and no concurrent checks.
6. An extra legacy regression run exposed its existing thread-pool incompatibility:
   `native-runtime.test.ts` changes cwd. Recorded the failure in `OPPORTUNITIES.md`, then
   verified all nine cases with Node forks. Bun forks failed to start a worker; the new
   command tests pass under the brief's required Node and Bun thread pools. Rejected changing
   the unrelated legacy helper or calling the failed worker start a passing test run.

### Stage C — files

- goals/time-to-certainty/research/c3-3-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts
- packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts
- packages/tooling/tool/cli/test/native-runtime-prefix.test.ts

### Verification commands and exit codes

Vitest commands run from `packages/tooling/tool/cli`; other commands run from the worktree root.
`<touched TS>` is the two source files and new test listed above. `<prefix + package tests>`
means `test/native-runtime-prefix.test.ts test/laws-package.test.ts`. Ephemeral logs use
`/tmp/c3-3-c-*.log`; outcomes and Turbo summary identities are retained here.

| Command | Exit | Result |
| --- | --- | --- |
| `bunx biome check --write <touched TS>` | 0 | Formatted the scanner and new fixture. |
| `bunx biome check <touched TS>` | 0 | Three files, no fixes, 973 ms. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 0 | No diagnostics. |
| `bunx --no-install vitest run --pool=threads <prefix + package tests> test/native-runtime.test.ts` | 1 | 13 pass; nine legacy tests fail before scanning because `process.chdir()` is unsupported in workers. |
| `bunx --bun vitest run --pool=threads <prefix + package tests> test/native-runtime.test.ts` | 1 | Same attribution: 13 pass, nine legacy cwd failures. |
| `bunx --no-install vitest run --pool=threads <prefix + package tests>` | 0 | Node: 13/13, 18.57 s. |
| `bunx --bun vitest run --pool=threads <prefix + package tests>` | 0 | Bun: 13/13, 14.59 s. |
| `bunx --no-install vitest run --pool=forks test/native-runtime.test.ts` | 0 | Legacy Node regressions: 9/9, 6.33 s. |
| `bunx --bun vitest run --pool=forks test/native-runtime.test.ts` | 1 | Optional legacy check: no tests executed; worker-start timeout, 60.02 s. |
| `bunx --bun --no-install tsgo -p /tmp/c3-3-c-focused.json --pretty false` | 0 | Source-resolving check over new/related tests and touched source; no diagnostics. |
| `bun run beep lint schema-first` | 0 | No missing/stale entries, candidates, or advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0 | Saved `exitStatus: 0`, zero introduced, nine inherited-adjacent findings. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0 | Saved `exitStatus: 0`, zero findings. |
| `bun run beep lint policy-fingerprint --write` | 0 | Regenerated; declaration and Turbo materialization unchanged. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bun run lint:native-runtime:roots` | 0 | 482 scanned files, zero touched, warnings, or errors; two allowlisted violations. |
| `bunx turbo run //#lint:native-runtime:roots --summarize --cache=local:rw` with writable cache | 0 | Cold: 2/2 successful, 0/2 cached, 4.830 s. |
| Same Turbo command and tree | 0 | Warm: 2/2 successful by replay, 2/2 cached, 0.061 s. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification. |

The focused tsgo config extends the real CLI config with source/test includes, no project
references, no emit/composite/incremental output, repository rootDir, and local Node/Bun type
roots. It is supporting proof, not package verification. Test runs overlapped each other and
some static checks; their durations are functional evidence, not performance comparisons.

### Measurements

The direct root script, wrapped by `/usr/bin/time -f 'wall=%e maxRSS=%M exit=%x'`, took **3.81 s**
and **1,153,392 KiB** maximum RSS, exit 0. It reported 482 scanned files, zero warnings/errors,
two allowlisted violations, and 27 unused allowlist entries (informational for this subset).

Both isolated Turbo invocations used:

```sh
TURBO_CACHE_DIR="$PWD/.beep/c3-3-stage-c-cache" bunx turbo run //#lint:native-runtime:roots --summarize --cache=local:rw
```

“Cold” means an empty task cache, not a cold machine; the direct scan already warmed filesystem
and module caches. Turbo 2.10.12 reported remote caching disabled, with no cache-write warnings.

| Run | Tasks successful or replayed | Cached | Turbo wall | Residual task | Fingerprint task | Total task-seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Task-cache cold | 2/2 | 0/2 | 4.830 s | 3.018 s | 1.753 s | 4.771 s |
| Same-tree warm | 2/2 | 2/2 | 0.061 s | 0.000 s | 0.001 s | 0.001 s |

| Invocation | Summary relative to this checkout |
| --- | --- |
| Cold | `.turbo/runs/3J85TELuQ9Vvx2Ayx6D14oINJ3j.json` |
| Warm | `.turbo/runs/3J85V6xN6RUN8WffgkL45kohR8b.json` |

Both summaries have the same residual hash `fd5771d31da9885e` and fingerprint hash
`50e1822197e4de32`. Cold tasks have execution exit zero and `MISS`; warm tasks have `HIT`.
Warm durations measure replay bookkeeping. These are local residual-only measurements,
not a new fleet, hosted, or whole-proof speedup claim.

### Blockers, coverage handoff, and verification split

No Stage C implementation blocker remains. The previously unsupported residual flag now
executes successfully in the actual registered command. Required sandbox checks pass. The
optional legacy Bun forks check remains an attributed environment/worker-start limitation;
Node ran that suite successfully, and both required runtimes ran the new prefix tests.

Fable owns `bun run beep quality package-verify @beep/repo-cli`, Node coverage/ratchet, docgen
acceptance, and the hosted lane. Repo-utils is untouched in Stage C. No new source module or
coverage baseline row was introduced; the existing `Laws.command.ts` and `NoNativeRuntime.ts`
rows need Fable's coverage evaluation, including the new prefix/default/union branches. The
missing worktree-local Effect reference symlink was handled by reading the parent checkout's
canonical reference, without installing or rewiring it.

`Quality/Tasks.ts`, deprecated-API code, eslint configs, workspace manifests, Turbo declarations,
and packet lifecycle remain untouched. The previously named follow-up remains Fable-owned:
`rootRepoLintPolicySteps` replaces the five `scopedLawStep`s with
`turbo run lint:laws //#lint:native-runtime:roots` (affected locally, full hosted), behind
`standards/lint-policy.sweeps.jsonc` key `laws`, and `beep:policy` retires from the two manifests
and scripts schema after C3.3 and C3.2b land. This lane does not make that switch.
Stop after Stage C.

## Orchestrator closeout (PR #1082)

Hosted rounds on the C3.3 PR, attributed:

1. Docgen metadata ratchet on the Laws barrel and docs-profile eslint warnings — introduced,
   fixed by documenting every export line in Biome's order and routing examples through the
   exported `@beep/repo-cli/test/Laws` kit.
2. Coverage Regression: seven regressed rows on `Laws.command.ts`, `TSMorph.model.ts` and
   `TSMorph.service.ts` — introduced. The ratchet measures each package with its own suite, so
   repo-utils code exercised only by repo-cli tests counts as uncovered, and a guard that runs
   only inside a spawned CLI child is never instrumented. Fixed by three tests: the
   `packageSyntax` request path and the explicit-file project pool in the repo-utils suite, the
   decoded `loadTsconfigFiles` default, and the prefix guard run in-process through
   `Command.runWith`. Full-suite rows on the branch: model 81.58 / 92.31 / 91.74, service
   branches 73.28, `Laws.command.ts` 44.44 / 37.73 / 45.45 / 44.44 — every row above its floor.
3. Local `yeet verify` storybook chunk failures with the hosted Storybook lane green —
   environment-only.

Five review threads were answered and resolved through `yeet reply`. The follow-up named in
Stage C (plan switch behind sweeps key `laws`, `beep:policy` retirement) starts after #1082
and #1083 merge.
