# C3.2b implementation results

## Stage A

Implemented the sweep switch on `ttc/c3-2b-typed-programs`, starting from
`a7a86832a453a1152e5974e4eedbdd3ac8760c0b`. The required configuration selects `shards`.
Stage A does not enable the per-package full sweep or retire the shard program.

### Decisions and rejected alternatives

1. Added `PolicySweepProgram = LiteralKit(["shards", "turbo"])` and the annotated
   `LintPolicySweeps` class before wiring runtime behavior. The version is required and literal;
   the program has no decoding default. Rejected optional fields and malformed-file fallbacks.
2. Located the existing JSONC boundary: `internal/cli/Jsonc.ts` re-exports
   `decodeJsoncTextAs` from `@beep/schema/Jsonc`. The module-level
   `decodeLintPolicySweeps = decodeJsoncTextAs(LintPolicySweeps)` uses that helper instead of
   strict `S.fromJsonString`, accepting comments and trailing commas without stripping comments
   by hand. `readLintPolicySweeps` maps both file-read and decode failures to
   `QualityTaskConfigurationError`, including the file path and cause in its message.
3. `runRootLintPolicyTaskInternal` reads the file once, before changed-file discovery or step
   execution, and passes the decoded selection to
   `rootRepoLintPolicySteps(repoRoot, files, base, sweeps)`. The builder never consults CI:
   undefined base plus `shards` yields the existing `repoCliStep`; undefined base plus `turbo`
   yields the existing full-scope Turbo step; a supplied base always yields affected Turbo.
   The caller retains responsibility for folding CI into full scope. Docs lint retains its
   existing full/affected behavior. Rejected changing scope from inside the planner.
4. The standalone command reads the same required file for non-package execution. Explicit
   full scope or CI uses its program; local affected execution keeps the caller base.
   `runRootDeprecatedApisTask` accepts an omitted base to reuse the full Turbo step.
   Package workers and shard implementation remain unchanged. Pure testing plans retain an
   explicit shard selection when no test override is provided; the legacy aggregate root lint
   plan delegates through the standalone command, which validates the file at execution.
   This is not a runtime fallback for an unreadable file.
5. Added the sweep file to the fingerprint generator's existing `rootConfigs`, since it is a
   root configuration read by the policy checker. Ran `beep lint policy-fingerprint --write`
   to regenerate both the structural fingerprint and `//#lint:policy-fingerprint.inputs`.
   A real Turbo dry-run fixture changes the sweep selection and checks that a dependent
   policy-task hash changes, then restores the file and checks the original hash returns.
   Rejected hand-editing generated input lists or changing `^transit` in Stage A.
6. Reused `policyTurboStep` / `policyTurboScmBase` for planner assertions. Covered full shard
   and Turbo selection, unchanged affected scope, full/CI standalone Turbo routing, JSONC
   comments/trailing commas, missing files, invalid syntax, missing fields, wrong version,
   invalid program, and standalone failure before process execution. Existing command
   fixtures now declare a `bun.lock` root marker and the required config; worker filesystem
   mocks preserve real root discovery. No git setup is needed for these fixture repairs.
7. Used the parent checkout's existing Effect reference because this worktree lacks
   `.repos/effect`; checked Schema and Effect APIs there without provisioning a symlink.
   Applied the schema-first and Effect-first skills. No graft commands, git write commands,
   new source-role files, or sibling C3.3 changes were made.

### Stage A — files

- `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts` — sweep domain and class.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — module-level decoder, required
  reader, explicit planner contract, and full Turbo task support.
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` — standalone selection and
  fingerprint root-config registration.
- `packages/tooling/tool/cli/test/quality-tasks.test.ts` — scope/program and JSONC/error tests;
  required config in the existing full-policy runtime fixture.
- `packages/tooling/tool/cli/test/lint-workers.test.ts` — standalone switch/error coverage and
  root-discovery mock repair.
- `packages/tooling/tool/cli/test/lint-command.test.ts` — required shard fixture configuration
  and a non-git root marker.
- `packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` — declared-input and
  dependent-hash regression for the sweep file.
- `standards/lint-policy.sweeps.jsonc` — new versioned configuration, `deprecatedApis: "shards"`.
- `standards/policy-tools.fingerprint.json` — generated structural input addition.
- `turbo.json` — generated root fingerprint input addition, Biome formatted.
- `goals/time-to-certainty/research/OPPORTUNITIES.md` — immediate fixture/root-reference receipt.
- `goals/time-to-certainty/research/c3-2b-implementation.md` — this Stage A handoff.

### Verification commands and exit codes

Vitest commands run from `packages/tooling/tool/cli`; other commands run from the repository
root. `<touched>` means the ten changed TypeScript/JSON/JSONC files listed above;
`<touched TS>` means the three source and four test files. Local command logs are under
`/tmp/c3-2b-stage-a/`; they are disposable evidence, not tracked artifacts.

| Command | Exit | Result |
| --- | ---: | --- |
| `bun run beep lint policy-fingerprint --write` | 0 | Generated both fingerprint input lists. |
| `bunx biome check <touched>` | 0 | Ten files checked, no fixes in final check. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 0 | Seven TypeScript files, no diagnostics. |
| `bunx --no-install vitest run --pool=forks --maxWorkers=1 test/lint-command.test.ts` | 0 | 58 tests passed; 11.86 s. Initial exit 1: four introduced fixture-root failures, repaired. |
| `bunx --no-install vitest run --pool=threads test/lint-workers.test.ts test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Final run: 28 tests passed in 40.87 s, including the sweep hash regression. Initial exit 1: two introduced mock-root failures, repaired. |
| `bunx --bun vitest run --pool=threads test/quality-tasks.test.ts -t 'policy Turbo\|plans repo-wide root lint\|deprecated\|sweep'` | 0 | Six selected tests passed, 201 skipped; 3.67 s. Git-writing tests were not selected. |
| `bun run beep lint schema-first` | 0 | 90 live/tracked entries; no missing/stale entries or reported advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0 | Final `.beep/fallow/audit.check.json`: `exitStatus: 0`, `status: "ok"`, zero findings. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0 | Final `.beep/fallow/health.check.json`: `exitStatus: 0`, `status: "ok"`, zero findings. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.c3-2b-stage-a.tmp.json` | 0 | Final source-resolving config covers all four touched tests and imports; no diagnostics. |
| `git diff --check` (read-only) | 0 | No whitespace errors. |

The disposable tsgo config extends the CLI's `tsconfig.json`, sets `references: []`,
`exclude: []`, includes the four touched test paths, sets the repository as `rootDir`, and
uses `composite/declaration/declarationMap/emitDeclarationOnly/incremental/sourceMap: false`,
`noEmit: true`, and `types: ["node", "bun"]`. It is removed after verification. This resolves
workspace source without requiring upstream `dist` artifacts and emits no build outputs.

### Measurements

Stage A measures correctness only. It does not measure or claim cheaper typed programs.
The unchanged hosted reference from C3.2 round 3 is **538.3 s** for 28 deprecated-API shards
inside a **632 s** Lint Policy lane; the C3.2b brief's acceptance budget is **538 s**.
The earlier per-package run completed only 52 of 141 tasks at the 15-minute cap.
Those are inherited packet measurements, not new Stage A runs. The switch stays `shards`.

### Blockers and verification split

No unresolved Stage A implementation or sandbox-verification blockers. All required sandbox
commands completed with exit 0 after the documented fixture repairs. The final selected
test total is 92 passing tests (58 command, 28 worker/fingerprint, six policy-plan/config).

Fable owns full `package-verify @beep/repo-cli`, Node coverage, and the hosted lane per the
brief. The rest of `quality-tasks.test.ts` includes git-writing fixtures and was deliberately
not run. Stages B, C, and D were not started: no overlay-based worker, dependency-edge change,
benchmark fleet, hosted switch, or shard retirement was performed. Stop after Stage A.

## Stage B

Implemented the overlay-based package worker on `ttc/c3-2b-typed-programs`, starting from
Stage A commit `8297127a7b`. The required sweep selection remains `shards`.
The local implementation checks pass; the measurement and blocker sections below distinguish
that result from fleet acceptance. No Stage C or D work is included.

### Decisions and rejected alternatives

1. Reused Effect's typed `Config.option(Config.string("BEEP_ESLINT_PROJECT"))` boundary in
   the ESLint configuration module. A nonempty value becomes a trimmed comma-separated project
   list. `parserOptions` selects `project` for that list and otherwise retains the existing
   project-service object, including every `allowDefaultProject` glob, `defaultProject`, and
   match-count limit. `tsconfigRootDir` and the unsupported-version setting stay common.
   Empty is the worker's explicit project-service selection. Rejected scattered `process.env`
   reads and a second copy of the project-service defaults. The ESLint module is the synchronous
   configuration entrypoint; it reads the typed configuration once when the process loads it.
2. Defined the package contract before wiring execution: both named overlays must exist and
   parse; TypeScript resolves their inherited `include`, `exclude`, and `files` lists; their
   union partitions the package's TS/TSX files. `ts.getParsedCommandLineOfConfigFile` from the
   existing `ts-morph` dependency resolves the lists without constructing a typed program.
   A `HashSet` owns membership. Discovery includes dot-directories, so `.storybook` roots are
   not lost. ESLint retains ownership of its existing ignore rules; `--no-warn-ignored` prevents
   explicit ignored filenames from adding warnings that directory-based linting did not emit.
   Rejected hardcoded `src`/`test` prefixes and directory-only project invocations, which lose
   exclusions or send unclaimed files into an explicit project.
3. Missing overlays and malformed configurations raise the existing `LintFileDiscoveryError`
   with the package/config path before ESLint starts. TypeScript diagnostic 18003 (an empty
   input list) is allowed during discovery; an empty package selection succeeds only for labs.
   Rejected silently substituting `test/tsconfig.json`, generating missing overlays in the
   worker, and skipping packages without the required files. The missing-file path is a typed
   error, not the silent `CliReportedExit` sentinel used after a child has already printed.
4. `runEslintPass` keeps the existing heap-cap handling, root cwd/config, and child exit handling.
   The overlay pass sets the two repo-relative paths in `BEEP_ESLINT_PROJECT`; the residual
   pass explicitly clears that value, including an inherited caller override. Both passes run
   even if the first reports diagnostics, and either failure fails the package. Empty passes
   do not spawn ESLint. `runDeprecatedApiPackage` owns one package; `runEslintWorker` dispatches
   profiles and iterates packages serially. Rejected suppressing the residual pass after an
   overlay failure and changing shard execution. The docs worker keeps its existing argv and
   clears the project variable harmlessly at the same child boundary.
5. Changed only the dependency edge of `lint:deprecated-apis` to
   `["^build", "//#lint:policy-fingerprint"]`; its inputs, env declaration, cache flag, and
   outputs remain unchanged. Updated the pinned table expectation and real Turbo fixture to
   use the build task and a dependency-owned build script. The fixture still proves an upstream
   source edit changes the consumer's lint hash, then restores the original hash. Rejected
   retaining `^transit` when the typed program requires upstream declarations.
6. Added worker coverage for resolved overlay membership, excluded fixtures, dot-directory and
   script residuals, inherited project clearing, either pass failing, both missing overlays,
   malformed overlays, and empty lab/non-lab behavior. The real deprecation fixture diagnoses
   one deprecated call in each pass. Its inherited child output is retained in a scoped file
   because the test's pipe capture returned empty text despite the direct reproduction emitting
   both diagnostics. The real ciops test now asserts the required missing-overlay failure.
7. Read the parent checkout's existing `.repos/effect` reference for Effect v4 APIs because this
   worktree lacks that symlink. Corrected the initial Array predicate/partition API assumptions
   against that source and the focused compiler. Applied the Effect-first, schema-first,
   Turborepo, and Unslop skills. No new source-role file or domain record was needed. No graft,
   git write, sibling C3.3, protected-path, manifest-script, or sweep-selection edit was made.

### Stage B — files

- `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts` — typed
  project-list configuration and the explicit-project/project-service selection.
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` — required overlay discovery,
  package partitioning, two-pass execution, and loud configuration errors.
- `packages/tooling/tool/cli/test/lint-workers.test.ts` — package-contract and real diagnostic
  regressions, missing-overlay integration behavior, and retained fixture output.
- `packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` — pinned `^build`
  dependency and upstream-source hash fixture.
- `turbo.json` — the deprecated-API task's `^build` edge, Biome formatted.
- `goals/time-to-certainty/research/OPPORTUNITIES.md` — missing-overlay, fixture-output, and
  introduced-complexity receipts.
- `goals/time-to-certainty/research/c3-2b-implementation.md` — this Stage B handoff.

### Verification commands and exit codes

Vitest commands run from `packages/tooling/tool/cli`; other commands run from the repository
root. `<touched TS>` is the four TypeScript files above; `<touched>` adds `turbo.json`.
Disposable command logs, JSON diagnostics, argv manifests, and measurements are under
`/tmp/c3-2b-stage-b/`. They are local evidence, not tracked artifacts.

| Command | Exit | Result |
| --- | ---: | --- |
| `bunx biome check <touched>` | 0 | Five files; final formatting check clean. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 0 | Four TypeScript files; no diagnostics. |
| `bunx --no-install vitest run --pool=forks --maxWorkers=1 test/lint-command.test.ts` | 0 | 58 tests passed. |
| `bunx --no-install vitest run --pool=threads test/lint-workers.test.ts test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Final 34 tests passed in 39.96 s. |
| `bunx --bun vitest run --pool=threads test/quality-tasks.test.ts -t 'policy Turbo\|plans repo-wide root lint\|deprecated\|sweep'` | 0 | Six selected tests passed; 201 skipped. No git-writing fixture selected. |
| `bun run beep lint schema-first` | 0 | No schema-first violations or advisories. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0 | Final envelope: `exitStatus: 0`, `status: "ok"`, zero findings. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0 | Final envelope: `exitStatus: 0`, `status: "ok"`, zero findings. |
| `bun run beep lint policy-fingerprint --check` | 0 | Existing structural fingerprint remains current. |
| `bun run beep lint package-scripts --check` | 0 | No manifest script drift. |
| `bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.c3-2b-stage-b.tmp.json` | 0 | Source-resolving focused proof over both touched tests and the ESLint config. |
| `git diff --check` (read-only) | 0 | No whitespace errors. |
| `bunx turbo run build --filter=@beep/identity...` | 0 | Two upstream-inclusive build tasks successful. |
| `bunx turbo run build --filter=@beep/schema...` | 0 | Six upstream-inclusive build tasks successful. |
| `bunx turbo run build --filter=@beep/repo-cli...` | 0 | Final 33 tasks successful, 0 cached, 6.718 s; upstream declarations available. |
| ESLint `--print-config` with and without the project list | 0 | Explicit project list versus the unchanged project-service settings confirmed. |
| `diff -u <before.normalized.json> <after.normalized.json>` for identity and schema | 0 | Full ESLint JSON results equal after sorting by file path. |

The temporary tsgo config extends the CLI config with `references: []`, `exclude: []`, repository
`rootDir`, both touched tests plus the ESLint config in `include`, `types: ["node", "bun"]`,
`noEmit: true`, and composite/declaration/declarationMap/emitDeclarationOnly/incremental/sourceMap
all false. It was removed before fleet measurement; scoped live-test fixtures were also gone.
The selected passing test total is **98**.

Initial nonzero verification exits were introduced and repaired: wrong Array v4 API assumptions
(first worker probe and repo-cli build); package-cwd assertions from an accidental root Vitest
invocation; the old live-lab success expectation; missing-error reporting and captured fixture
output; focused compiler `unnecessaryFailYieldableError` diagnostics; and Fallow cognitive
complexity 9 against 8 after preserving empty-package parity. The final package operation split
removed the complexity finding without a suppression. Those failed attempts are not reused as proof.

### Local measurements

Measurements use GNU `/usr/bin/time -f 'wall=%e rss_kb=%M exit=%x'`. The before process runs
`node_modules/.bin/eslint --config eslint.config.mjs <package-dir> --format json` with
`BEEP_ESLINT_PROFILE=deprecated-apis`, `BEEP_ESLINT_PROJECT` empty, and the 8192 MiB Node heap cap.
The after processes use the worker's resolved file partition, `--no-warn-ignored --format json`,
and the two-overlay project list followed by the empty-project residual pass. Direct ESLint
measurements isolate parser cost; their wall times exclude CLI discovery/startup. The fleet
measurements include that worker overhead. These are local samples, not a hosted budget proof.

The prescribed Turbo build commands above produced upstream `dist` before measurement. Each
package's before, overlay, and residual subprocesses run serially. After wall is the sum of its
passes; after max RSS is their maximum, not their sum. The repeated final sample is:

| Package | Before wall | Before max RSS (KiB) | Overlay wall / RSS (KiB) | Residual wall / RSS (KiB) | Combined after wall / max RSS (KiB) | JSON parity |
| --- | ---: | ---: | --- | --- | --- | --- |
| `@beep/identity` | 13.35 s | 3,616,680 | 5.31 s / 1,111,248 | 11.88 s / 3,106,452 | 17.19 s / 3,106,452 | Equal, 21 files, zero diagnostics. |
| `@beep/schema` | 19.74 s | 4,402,388 | 9.61 s / 2,338,412 | 12.33 s / 3,077,992 | 21.94 s / 3,077,992 | Equal, 349 files, zero diagnostics. |
| `@beep/repo-cli` | 49.27 s | 7,737,928 | Blocked: no `tsconfig.test.json`. | Not run. | No successful after measurement. | Unproven. |

The required repo-cli worker attempt exits **1** in **1.76 s**, max RSS **511,660 KiB**, and names
`packages/tooling/tool/cli/tsconfig.test.json`. That is a configuration failure including CLI
startup, not an improved lint result. Its existing `test/tsconfig.json` was not substituted.
The first pre-edit baseline samples were 13.59 s, 17.50 s, and 49.34 s respectively; the table
uses the repeated comparison, not a mix of the fastest runs.

Identity and schema use less peak memory, but the required residual pass makes their combined
wall times slower than project service alone. The overlay-only time is not the package cost.
The full-JSON diffs compare every returned result field, with ordering normalized by file path.
Positive deprecation diagnostics in both passes are separately proven by the executed fixture.

For both identity and schema, the sole residual file is the package's `vitest.config.ts`.
It is outside the two overlay root lists but covered by the previous directory lint. That
single-file project-service pass costs 11.88 s and 12.33 s respectively. Dropping it would
make the timing look better by reducing the required lint coverage.

### Fleet measurements

Both invocations use exactly:

```sh
bunx turbo run lint:deprecated-apis --concurrency=4 --continue=dependencies-successful --summarize --cache=local:rw
```

Turbo 2.10.12 selected 142 workspaces and executed 252 tasks: 140 deprecated-API lint tasks,
111 upstream builds, and the root policy-fingerprint task. No source or task configuration
changed between invocations. The local cache was not cleared or relocated. Turbo reported
`Remote caching disabled (by flags), using shared worktree cache`.

Cold completed with exit **1** in **668.865 s** (11 m 8.865 s), **239 successful / 252 total**,
**0 cached / 252 total**. All 111 builds and the fingerprint succeeded; 127 lint tasks succeeded
and 13 lint tasks failed for the missing overlays listed below. No task was skipped. The cold
summary is `.turbo/runs/3J85TPJdYyqVTsnrJ9j9zBsIiVs.json`.

Cold lint-only accounting over all 140 attempted package tasks, including the 13 failures:
**2,594.384 task-seconds**, **p50 19.5905 s**, **max 33.448 s (`@beep/ui`)**. Upstream builds
add **51.075 task-seconds** and the fingerprint **1.851 s**, for **2,647.310 task-seconds** over
all 252 tasks. These denominators are separate from the prior Stage D's 140 lint tasks.

Against Stage D's **2,387 task-seconds / 140 successful lint tasks**, even this incomplete
successful sweep spends **207.384 more task-seconds (8.69%)**. Its p50 is also above Stage D's
16.8 s. The smaller maximum (33.448 s versus 55.4 s) is not evidence that the largest old
package became cheaper: repo-cli fails before linting. This run does not meet the performance
or complete-coverage acceptance condition, and a local wall time does not satisfy ruling 30's
hosted gate.

The requested warm invocation completed with exit **1** in **672.125 s** (11 m 12.125 s),
**239 successful / 252 total**, **0 cached / 252 total**, and the same 13 failures. Its summary
is `.turbo/runs/3J86pqa2BsJ2UlDw62hyFI0CHF9.json`. Lint-only accounting is **2,600.105 task-seconds**,
**p50 19.698 s**, **max 30.665 s (`@beep/ui`)** over all 140 attempts. Builds contribute
**36.303 task-seconds**, the fingerprint **1.870 s**, and all tasks **2,638.278 task-seconds**.
These times come from each summary's `execution.endTime - execution.startTime`; per-task
statistics use the same fields on task rows. All 252 task rows have an exit code in both runs.

| Invocation | Exit | Tasks successful / total | Cached / total | Turbo wall | Lint task-seconds | Lint p50 / max |
| --- | ---: | --- | --- | --- | ---: | --- |
| Cold | 1 | 239 / 252 | 0 / 252 | 11 m 8.865 s | 2,594.384 | 19.5905 / 33.448 s |
| Warm attempt, unchanged source/config | 1 | 239 / 252 | 0 / 252 | 11 m 12.125 s | 2,600.105 | 19.698 / 30.665 s |

The second invocation did **not** establish warm cache reuse. Two distinct facts explain why
it cannot be treated as a normal warmed-cache measurement:

- Turbo's shared cache is the parent checkout's `.turbo/cache`, outside this managed lane's
  writable roots; `os.access(path, os.W_OK)` returns false. Completed cold task artifacts were
  absent there, and the same fingerprint/types/fc-runs/obs-build hashes missed again. No
  cache-write error appeared in the cold log. The lane neither changed cache permissions nor
  replaced the requested command with a different cache location.
- **82 lint task hashes changed** between summaries even though authored source and task
  configuration were unchanged. All **3,103 differing input entries** are package-owned
  `dist/` files; all 111 build hashes and the fingerprint hash stayed the same. The inherited
  broad lint inputs include build output, so adding `^build` exposes generated-output churn.
  Identity changes only `dist/packages.js`; UI changes 270 declaration/JavaScript entries.
  Stage B requires inputs unchanged, so no new output exclusions were added. The other 170
  task hashes stayed the same but also missed cache; the write-access problem is independent.

### Parser reference census

After the timed runs, inspected the installed parser and executed its exported `createProgram`
helper with the same overlays. The CLI path in
`node_modules/@typescript-eslint/typescript-estree/dist/parser.js` uses
`createProgramFromConfigFile`; `create-program/useProvidedPrograms.js` calls
`ts.createProgram(parsed.fileNames, parsed.options, host)` without `parsed.projectReferences`.
The installed CLI inference recognizes the worker's ESLint executable path; no
`TSESTREE_SINGLE_RUN` override is present. This census exited 0 and is retained in
`/tmp/c3-2b-stage-b/program-census.jsonl`.

| Package / overlay | References in parsed config | References on parser program | Upstream workspace source files | Upstream workspace dist files |
| --- | ---: | ---: | ---: | ---: |
| identity / check | 1 | 0 | 5 | 0 |
| identity / test | 0 | 0 | 5 | 0 |
| schema / check | 5 | 0 | 65 | 0 |
| schema / test | 0 | 0 | 74 | 0 |

Thus the required builds succeeded, but declaration consumption is **not** established; this
CLI program path demonstrably loads upstream sources. The check overlay's reference list alone
is insufficient for this parser API. A custom reference-aware program would change the brief's
explicit `parserOptions.project` contract and was not silently substituted.

### Blockers and verification split

Stage B implementation verification is green, but **Stage B acceptance is not complete**:

1. **Missing required overlays:** all 13 failing packages lack `tsconfig.test.json`:
   `@beep/infra`, `@beep/lint-rules`, `@beep/repo-configs`, `@beep/repo-cli`, `@beep/oip-web`,
   `@beep/professional-desktop`, `@beep/storybook`, `@beep/api-docs`, `@beep/ciops`,
   `@beep/lejeune-bolt-workbench`, `@beep/semantica`, `@beep/trustgraph-workbench`, and
   `@beep/todox`. Infra also lacks `tsconfig.check.json`, which is its first reported failure.
   These absences predate Stage B; their loud failure is the required new worker behavior.
   Repo-cli after-mode diagnostics and performance parity remain unproven.
2. **Typed-program design:** the specified parser's CLI helper drops project references;
   local complete package timings include an expensive required residual pass. Neither local
   package comparison improves combined wall time, and the incomplete fleet exceeds the prior
   complete lint task-seconds. No cheap full-sweep claim is supported.
3. **Reuse measurement:** the shared cache is not writable from this lane, and the unchanged
   input contract hashes generated dist files. A writable cache alone does not resolve the 82
   generated-output hash changes. A genuine warm-reuse proof is still outstanding.

The missing-overlay/typed-program/input-contract decisions belong to the orchestrator; this
lane preserved the specified contract rather than manufacturing a green run with fallbacks,
extra configs, skipped packages, dropped residual files, or altered inputs. The cache-directory
limitation is environment-only. Every observed fleet lint failure was a missing-overlay error;
all upstream build tasks succeeded in both runs.

Fable owns full `package-verify` for the touched `@beep/repo-cli` and `@beep/repo-configs`
packages, Node coverage, and the hosted lane. None was claimed by this lane. The rest of the
quality-tasks suite contains git-writing fixtures and was not run. No hosted measurement,
switch flip, shard/cache retirement, or Stage C protocol was performed. No git write or graft
command ran. Stop after Stage B.

### Orchestrator verdict (2026-09-10)

Stage B is a negative result and its code does not land. Three measured facts decide it: the
typescript-eslint CLI program path (`createProgramFromConfigFile` → `ts.createProgram` without
`projectReferences`) never consumes the check overlay's referenced declarations, so the
"declarations via `^build`" premise of row 2b is false for this parser; the residual
project-service pass that keeps coverage equal to the shards costs the whole root corpus again
(11.9 s and 12.3 s for one `vitest.config.ts` each), so complete per-package cost is higher than
before (identity 13.4 → 17.2 s, schema 19.7 → 21.9 s); and the fleet cold run spent 2,594 lint
task-seconds against 2,387 with the project service while 13 packages have no test overlay at
all. Under ruling 30 the hosted shard program and the root `eslint .` stay. What lands from
C3.2b is Stage A (the versioned sweep switch, which the C3.3 plan switch and any future hosted
measurement need) and this record. A future attempt must change the program factory, not the
overlay: a reference-aware program (or a shared typed server across packages) is the only path
that could make per-package typed lint cheaper than 28 shards, and it must exclude `dist/**`
from the lint inputs before any `^build` edge is added.
