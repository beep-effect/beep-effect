# C3.2 implementation results

## Stage A

Implemented Stage A only on `ttc/c3-2-eslint-package-tasks`. The checkout was clean at entry.
No git write commands were run, including in the temporary fixtures. No Stage B package task,
production package dependency edge, shard retirement, lane rewrite, or packet-state flip was
started. The existing `lint:policy-fingerprint` step id and `beep:preflight` writer remain intact.

### Decisions and rejected alternatives

1. Kept `PolicyToolsFingerprint` at `policy-tools-fingerprint/v1`, with only `schemaVersion`
   and `inputs`. Added `PolicyFingerprintTurboConfiguration`, a minimal `S.Struct` JSON boundary
   over the root task's inputs, reusing the fingerprint's input field. The two existing Turbo
   input proof files each have private task-specific schemas, so neither is a reusable writer
   schema. Rejected widening or exporting their coverage/tsgo-only boundaries.
2. Defined the policy service contract after the schema and before the computation/writer work.
   A local `Context.Service` captures filesystem, path, and workspace discovery services; its
   `check` and `write` members are lazy Effect values with `PackageScriptsPolicyError` failures.
   Rejected adding a new source module for this small existing-command extension, or exposing
   filesystem requirements from the service members. Existing source-only test exports expose
   the new configuration schema for reuse by proof tests.
3. Closure discovery still follows transitive workspace `dependencies`. Every member now
   contributes its normalized `<dir>/src/**` and `<dir>/package.json`. The computation adds
   root `package.json`, all nine existing root configs, and the fingerprint file; it sorts and
   deduplicates the final list. Rejected `**/package.json`, broad package source globs, and
   committed content digests, as required by ruling 29.
4. The writer first decodes the Turbo slice, locates the array through the already-installed
   `jsonc-parser`, and splices exactly that token range. It formats the replacement with the
   existing schema-backed JSON serializer and six-space continuation indentation appropriate
   to this root task. It prepares both outputs before writing either one, so malformed Turbo
   configuration cannot overwrite the declaration. Rejected whole-file serialization and the
   shared JSONC modification helper because this contract requires preserving every byte
   outside one array. The fixture asserts exact preservation of those other bytes, including
   intentionally compact unrelated task formatting.
5. `--check` compares decoded declarations, so harmless whitespace still passes. It reports
   `standards/policy-tools.fingerprint.json`, `turbo.json tasks["//#lint:policy-fingerprint"].inputs`,
   or both when those surfaces drift. Missing/malformed declarations fail. The writer requires
   the registered task and an array-valued inputs field; it does not invent other Turbo task
   configuration. Rejected silently repairing missing task registrations or rewriting fields
   outside the Stage A-owned array.
6. Registered only `//#lint:policy-fingerprint` with `cache: true`, `outputs: []`, and the
   generated inputs. Its root script is exactly `beep-cli lint policy-fingerprint --check`;
   it never invokes Turbo. The production package-task edges wait for Stage B.
7. Added a runtime-agnostic Turbo fixture using NodeServices and the existing Effect StepExec
   process API, with the repository's `node_modules/.bin/turbo`, a bounded process timeout,
   local-only cache posture, and no git initialization. The fixture's consumer `lint:jsdoc`
   depends on the root task. It proves a helper source edit changes the consumer hash, unrelated
   source and manifest edits leave it stable, and restoring the helper source restores the hash.
   Additional assertions prove closure manifest edits invalidate and restoring them restores
   the hash. Rejected mock hashes, Bun-only process APIs, and adding production Stage B tasks
   merely to test the edge.

### Stage A — files

- goals/time-to-certainty/research/c3-2-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- package.json
- packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts
- packages/tooling/tool/cli/src/test/PackageScripts.test-kit.ts
- packages/tooling/tool/cli/test/lint-workers.test.ts
- packages/tooling/tool/cli/test/package-scripts.policy.test.ts
- packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts
- standards/policy-tools.fingerprint.json
- turbo.json

### Verification commands and exit codes

The touched test set is `test/lint-workers.test.ts`, `test/package-scripts.policy.test.ts`,
and `test/policy-fingerprint-turbo-inputs.test.ts`. Vitest commands below run from
`packages/tooling/tool/cli`. Test command logs are ephemeral under `/tmp/c3-2-stage-a-*`;
this file retains the outcomes needed for handoff.

| Command | Exit | Result |
| --- | --- | --- |
| `bunx --no-install biome check --write <touched TS/JSON files>` | 0 | Initial formatting: eight files checked, three fixed. Subsequent small formatting passes also exited 0. |
| `bunx biome check <touched TS/JSON files>` | 0 | Final eight-file check: 1,240 ms, no fixes. Files are the five TypeScript and three JSON paths listed above. |
| `bunx --bun vitest run --pool=threads <touched test set>` | 1, then 0 | First run: 24 passed, one introduced timeout-option error. After repair: 25/25 passed. Final full Bun run: three files, 25 tests passed in 36.84 s. |
| `bunx --bun vitest run --pool=threads --maxWorkers=1 test/policy-fingerprint-turbo-inputs.test.ts` | 1 | Supplemental probe started before the timeout repair; same introduced error, one passed and one failed. |
| `bunx --no-install vitest run --pool=threads test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Node portability probe: two tests passed in 10.33 s. |
| `bunx --no-install vitest run --pool=threads <touched test set>` | 0 | Node full touched suite: three files, 25 tests passed in 58.52 s. |
| `bunx --no-install vitest run --pool=threads <touched test set> -t fingerprint` | 0 | Final Node fingerprint rerun after service and preservation-assertion edits: three passed, 22 skipped, 15.76 s. |
| `bun run beep lint policy-fingerprint --write` | 0 | Generated both tracked files; repeated after source edits. Two final sequential writes each exited 0. |
| `cmp standards/policy-tools.fingerprint.json /tmp/c3-2-stage-a-fingerprint-before.json` | 0 | Byte-identical after repeated writer runs, including final sequential pair. |
| `cmp turbo.json /tmp/c3-2-stage-a-turbo-before.json` | 0 | Byte-identical after repeated writer runs, including final sequential pair. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current declaration and materialization. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx turbo run '//#lint:policy-fingerprint' --dry-run=json` | 0 | Installed Turbo 2.10.12 resolves one cached root task and its exact nonrecursive command. |
| `bunx oxlint --quiet --disable-nested-config <five touched TS files>` | 0 | No diagnostics. |
| `bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.check.json --pretty false` | 1 | Supplemental canonical-config attempt: upstream `dist` outputs absent (TS6305), with cascading diagnostics; not accepted as type proof. |
| `bunx --bun --no-install tsgo -p /tmp/c3-2-stage-a-tests.tsconfig.json --pretty false` | 1, 1, then 0 | Source-resolving focused configuration found two `effect(lazyEffect)` errors, then two `effect(effectFnIife)` errors in the repair. Both corrected; final run has no diagnostics. |
| `git --no-optional-locks diff --check` | 0 | No whitespace errors. Read-only git operation. |

The final Vitest runs used an external `timeout --signal=INT --kill-after=5s` watchdog of
90 seconds for the full suites and 60 seconds for the focused Node run; none hit the watchdog.
The temporary typecheck config extends the real CLI tsconfig, includes exactly the three
listed tests and their imports, removes project references, uses the existing
TestTsgoSyntheticConfig no-emit/non-composite options, sets the repository rootDir, and resolves
Node/Bun type roots from this checkout. It does not replace canonical package verification.

### Measurements

- Declaration: **73 sorted unique inputs**, up from 42; **31 workspace members**, each with a
  source glob and its manifest; nine existing root configs; root manifest; fingerprint file.
- Fingerprint artifact: **3,401 bytes**. `turbo.json`: **12,526 bytes** after materialization.
- Final root dry run: **one task**, **79 resolved input entries** including global inputs,
  **1,357 matched files**, and **zero dependencies**. The root command is exactly
  `beep-cli lint policy-fingerprint --check`.
- Hash fixture: seven real dry runs cover baseline, unrelated source, unrelated manifest,
  closure source, source restoration, closure manifest, and manifest restoration. Both
  changed-closure cases invalidate, both unrelated cases preserve, and both restores recover
  the original consumer hash. The consumer's dependencies include `//#lint:policy-fingerprint`.
- Final Bun touched suite: **25/25**, 36.84 s wall time, 28.82 s reported test time.
  Node full suite: **25/25**, 58.52 s wall time, 42.62 s reported test time.
- Production `lint:deprecated-apis` and `lint:jsdoc` task counts and cold/warm hit ratios are
  deliberately not measured in Stage A; those tasks do not exist yet. No whole-proof or
  remote-cache performance claim is made.

### Blockers and verification split

No Stage A implementation blocker remains. The real Turbo fixture ran successfully on both
runtimes, so no skipped hash proof needs delegation. Initial timeout and service-shape mistakes
were introduced, corrected, and recorded in `OPPORTUNITIES.md`; they are not environment-only
waivers. The missing local Effect link was resolved by reading the parent checkout's canonical
`.repos/effect` reference without changing wiring.

The root dry run reported remote cache unavailable and fell back to the shared worktree cache;
this does not establish remote-cache availability. The fixture explicitly uses local cache.

Fable still owns the brief's canonical acceptance checks: `CI=true TMPDIR=/tmp bun run beep
quality package-verify @beep/repo-cli`, `bun run docgen:local` (root package/Turbo changes may
require its full-proof route), Node coverage for touched sources, and `bun run beep lint policy`.
No coverage baseline was edited and no new source module was added. Coverage must still be
checked for the changed existing Lint command and test-kit rows; the focused passing tests are
not a ratchet verdict. No package manifest was changed besides the authorized root script.

The Stage B dry runs for package `lint:jsdoc` and `lint:deprecated-apis` are deferred with those
registrations. Stage A ends here; do not begin Stage B from this handoff.

## Stage B

Implemented Stage B only on `ttc/c3-2-eslint-package-tasks`, starting from the clean committed
Stage A tree. No git write commands ran. The only manifest edit is the authorized root script;
all workspace manifests retain the C3.1 stamped scripts. Stage C has not begun.

### Decisions and rejected alternatives

1. Added the three Turbo declarations with the verbatim §2 input lists: 16 entries for
   `lint:deprecated-apis`, eight for `lint:jsdoc`, nine for `//#lint:jsdoc:root`. All cache with
   empty outputs. Deprecated APIs declares `NODE_OPTIONS` and depends on `^transit` plus
   `//#lint:policy-fingerprint`; both JSDoc tasks depend only on the fingerprint task.
   Rejected adding build edges, copying the fingerprint closure into consumers, or changing
   global inputs. The existing `transit` definition remains intact.
2. Added root `lint:jsdoc:root: beep-cli lint jsdoc --root-only`. Rejected a Turbo-invoking root
   task script and another fleet manifest rewrite. Existing workers, shard execution, eslint
   caches, quality steps, CI routes, lane identities, and packet lifecycle remain as before;
   their migration belongs to Stage C or later.
3. Defined `PolicyTaskDefinition` as an annotated schema class before the new fixture helpers,
   with a minimal configuration boundary and a module-level decoder. Reused Stage A's
   `FingerprintRunSummary`, file writers, platform layer, and existing StepExec process/service
   contract. No new runtime service is needed for configuration registration and test fixture
   orchestration. Rejected widening the production fingerprint-writer schema to own unrelated
   task fields, adding a source-only test export, or copying the older Bun-only proof runners.
   The older coverage and tsgo configuration schemas are private task-specific boundaries.
4. Extended the existing Stage A test file rather than adding a duplicate fixture module.
   Literal expectations pin the reviewed table contract; the real fixture loads the production
   task definitions through the schema, including the existing `transit` definition. Thus the
   behavioral proof exercises the registrations actually shipped. The fixture has separate
   consumer, typed dependency, checker/helper closure, repo-configs, unrelated package, and
   root-owned source surfaces. Rejected mock hashes and a fixture that only duplicates the
   desired configuration without reading the repository configuration.
5. Every mutation is followed by restoration and an exact baseline comparison. Ten mutations
   cover consumer source, root source, unrelated source, dependency source, a root
   `tsconfig.proof.json` outside the fingerprint's named tsconfigs, eslint config, tsdoc config,
   both repo-configs eslint trees, and a checker helper outside the explicit task input lists.
   The last case proves all three fingerprint edges independently of direct config inputs.
   Dependency source changes only the typed task; consumer source changes both package tasks;
   root source changes only the residual task; unrelated source changes none. All five shared
   checker/config mutations change all three tasks. Rejected cumulative edits, which could
   mask a missing edge with a previous invalidation.
6. Used NodeServices and StepExec on both test runtimes, sequential suites, bounded process
   timeouts, and local-only fixture cache settings. No git repository was initialized in a
   fixture. Live smokes use identity as a small package. After the first live run reported
   read-only shared-cache writes, the second used a writable temporary cache directory.
   Rejected treating successful execution as proof of warm or remote-cache performance.

### Stage B — files

- goals/time-to-certainty/research/c3-2-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- package.json
- packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts
- turbo.json

### Verification commands and exit codes

Vitest commands run from `packages/tooling/tool/cli`. All other commands run at the worktree
root. Ephemeral logs and dry-run JSON are under `/tmp/c3-2-stage-b-*`; durable outcomes follow.

| Command | Exit | Result |
| --- | --- | --- |
| Table-to-literal authoring script | 1, then 0 | Initial count assertion caught explanatory backticks in the root input column before Turbo was edited; corrected extraction yields 16/8/9 literal inputs. |
| `bunx --no-install biome check --write turbo.json package.json packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Three checked, two formatted. |
| `bunx --no-install biome check turbo.json package.json packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Three checked, no fixes, 1,061 ms. |
| `bunx --bun vitest run --pool=threads test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Four tests passed, 7.81 s; includes existing Stage A proofs and both new Stage B tests. |
| `bunx --no-install vitest run --pool=threads test/policy-fingerprint-turbo-inputs.test.ts` | 0 | Node: four tests passed, 11.98 s. |
| `bun run beep lint policy-fingerprint --check` | 0 | `policy-fingerprint: current`; neither declaration nor materialized fingerprint inputs changed. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx turbo run lint:jsdoc --filter=@beep/schema --dry-run=json` | 0 | Expected cached task, empty outputs, fingerprint dependency; counts below. |
| `bunx turbo run lint:deprecated-apis --filter=@beep/identity --dry-run=json` | 0 | Expected cached task, empty outputs, `NODE_OPTIONS`, transit and fingerprint dependencies. |
| `bunx turbo run '//#lint:jsdoc:root' --dry-run=json` | 0 | Expected root worker script, empty outputs, fingerprint dependency. |
| `bunx turbo run lint:jsdoc --filter=@beep/identity --cache=local:rw` | 0 | Two successful executable tasks, 10.73 s; cache-write warning qualified below. |
| `bunx turbo run lint:deprecated-apis --filter=@beep/identity --cache=local:rw --cache-dir=/tmp/c3-2-stage-b-turbo-cache` | 0 | Two successful executable tasks, 31.525 s; zero cached. |
| `bunx --bun --no-install tsgo -p /tmp/c3-2-stage-b-tests.tsconfig.json --pretty false` | 0 | No diagnostics; focused source-resolving test configuration described below. |
| `bunx oxlint --quiet --disable-nested-config packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` | 0 | No diagnostics. |
| `git --no-optional-locks diff --check` | 0 | No whitespace errors; read-only git operation. |

Vitest commands used an external 210-second `timeout --signal=INT --kill-after=5s` watchdog;
live tasks used 120 seconds. None hit the watchdog. The new fixture has a 180-second test
budget and 20-second per-process timeout. The focused typecheck copies the successful Stage A
source-resolving config, includes only the touched test and its imports, extends the real CLI
config, removes project references, and retains the existing synthetic no-emit/non-composite
compiler posture with workspace rootDir and local Node/Bun type roots. It is supplemental
proof, not canonical package verification.

### Measurements

Installed Turbo: **2.10.12**. Resolved input counts include the six global input entries;
matched-file counts are `tasks[].inputs` entries for that target, not its dependency closure.

| Target task | Declared inputs | Resolved inputs | Matched files | Dependency task ids | Total dry-run tasks |
| --- | ---: | ---: | ---: | --- | ---: |
| `@beep/schema#lint:jsdoc` | 8 | 14 | 910 | `//#lint:policy-fingerprint` | 2 |
| `@beep/identity#lint:deprecated-apis` | 16 | 22 | 653 | `//#lint:policy-fingerprint`, `@beep/types#transit` | 4 |
| `//#lint:jsdoc:root` | 9 | 15 | 906 | `//#lint:policy-fingerprint` | 2 |

- The Stage B hash fixture performs **21 real dry runs** per runtime: one baseline plus ten
  mutation/restoration pairs, each inspecting all three policy targets and their fingerprint
  edges. Together with Stage A's seven dry runs, the full test file performs **28 per runtime**.
- Typed-dependency evidence includes `@fixture/dependency#transit` in the consumer's resolved
  dependencies. Its source edit invalidates deprecated APIs while preserving both JSDoc hashes.
- Bun: four tests, **7.81 s** total, **1.64 s** reported test time. Node: four tests,
  **11.98 s** total, **2.30 s** reported test time.
- Identity JSDoc smoke: **2/2 successful**, **0/2 cached**, **10.73 s**. Identity deprecated
  APIs smoke: **2/2 successful**, **0/2 cached**, **31.525 s**. These executable task totals
  include the fingerprint gate; virtual transit nodes explain the larger typed dry-run count.
- No fleet scheduling, hosted before/after, warm hit ratio, or remote-cache claim is made in
  Stage B. Those are Stage D measurements. The fingerprint remains at 73 declared inputs.

### Blockers, friction, and verification split

No Stage B implementation or hash-proof blocker remains. Both runtimes and both live package
workers executed successfully in this sandbox, exceeding the brief's Bun-only fallback.
Fable still owns canonical `CI=true TMPDIR=/tmp bun run beep quality package-verify
@beep/repo-cli`, `bun run docgen:local`, Node coverage, and `bun run beep lint policy` acceptance.
No new source module or coverage-baseline row was added.

Two tool limitations are recorded in `OPPORTUNITIES.md`: the first Graft read query automatically
refreshed the ignored graph, conflicting with the brief's no-touch rule for `graft/`; further
Graft calls were avoided and the cache was left alone. The JSDoc live smoke emitted
`IO error: Read-only file system (os error 30)` on shared-cache writes while completing both
workers successfully. The deprecated-API smoke uses a writable temporary cache and has no such
warning. These are explicit limitations, not permission changes or git writes.

The results file is the Stage B handoff. Stop here; do not start Stage C from this launch.

## Stage C

Implemented Stage C only on `ttc/c3-2-eslint-package-tasks`, starting from the clean committed
Stage A/B tree. Read the Stage A/B results, the full brief, its ordered references, the current
step/worker boundaries, and the parent checkout's Effect reference (the local link is absent).
No Graft command or Git write ran, including inside fixtures. Stage D has not begun.

### Decisions and rejected alternatives

1. Moved the existing Check concurrency LiteralKit (`2`, `3`) into `Quality.schemas.ts`, then
   derived the private policy domain from those options plus `4`, before implementing its
   consumer. The existing option-decoder boundary accepts `2`, `3`, or `4`; missing, empty, or
   invalid values fall back to `4`. CiLane imports the unchanged Check domain and retains its
   existing local/hosted defaults and accepted overrides. Rejected widening Check to four,
   accepting arbitrary fleet concurrency, or duplicating its accepted overrides in another list.
2. Reused the existing schema-backed `QualityTaskStep` plan and the existing
   `ChildProcessSpawner` Context.Service / StepExec execution contract. No new process service,
   source module, or wire shape is needed. The shared `policyLintTurboStep` delegates to
   `turboStep` and therefore `turboRunArgs`, preserving the existing local/remote-cache posture.
   Rejected direct process spawning and a second cache or secret-session wrapper.
3. Replaced only the two Stage C policy subprocesses: `lint:deprecated-apis` targets that
   package task; `lint:jsdoc` targets both `lint:jsdoc` and `//#lint:jsdoc:root`. Both use bounded
   concurrency, `--continue=dependencies-successful`, and `--summarize`. Their step labels,
   capture timeouts, and positions in the existing plan remain intact. Neither gets the labs
   exclusion filter. Rejected implementing the later C3.5 whole-policy invocation regrouping
   or changing GithubChecks, IssueClassification, or WaveOrder identities.
4. Added `--base` (default `origin/main`) to `beep lint policy` and the standalone
   `beep lint deprecated-apis` wrapper. Local policy uses the same caller base for its existing
   changed-file collector and both Turbo steps. Local non-full Turbo runs get `--affected`
   and a child-local `env.TURBO_SCM_BASE`; full and CI plans get neither. Hosted `lint-policy`
   already invokes `beep lint policy --full` and keeps doing so. The existing aggregate root
   lint route retains its full policy plan. Rejected changing ambient `TURBO_SCM_BASE`, adding
   a filter-union trick for the root task, or applying hosted affected selection.
5. The standalone deprecated-API command now executes the same `deprecatedApisTurboStep`
   builder through the existing quality runner, including its cache posture and typed failure
   handling. Package mode still directly invokes ESLint. Root `lint:deprecated-apis` is exactly
   `bunx turbo run lint:deprecated-apis`, as required; no `//#lint:deprecated-apis` task exists.
   Rejected keeping the old shard wrapper behind the root script or registering a recursive
   Turbo root task. The Quality barrel exports the shared runner for the Lint command.
6. Deleted the 28-shard list, runner/loop, concurrency/cache constants, cache-location helper,
   four shard tests, and their fixture code. Kept the established 8192 MiB worker heap. Labs
   retain unmatched-pattern tolerance in package mode through the existing schema-derived
   `isLabsWorkspaceDir` guard; a neighboring `apps/labsx` path does not qualify. Rejected
   tolerating unmatched patterns globally or narrowing root `tsconfig.json`; that file is
   byte-unchanged. The live ciops lab worker passes on both test runtimes.
7. Retained the existing full command tests and moved replacement execution assertions into
   `lint-workers.test.ts`, where the typed process mock and runtime-agnostic platform layer
   already exist. Added local/full/CI plan tests, custom-base isolation, default/valid/invalid
   concurrency cases, wrapper failure propagation, lab-only tolerance, and a real lab smoke.
   Rejected adding a duplicate fixture module or running Git-writing quality fixtures under
   this launch's no-Git-write contract.
8. Regenerated the fingerprint after the final CLI edits. The declaration and Turbo
   materialization both compare byte-identical with their Stage C entry copies. Rejected
   hand-editing the declaration or treating source content changes as declaration drift.

### Stage C — files

- goals/time-to-certainty/research/c3-2-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- package.json
- packages/tooling/tool/cli/src/commands/Ci/CiLane.ts
- packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts
- packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts
- packages/tooling/tool/cli/src/commands/Quality/Tasks.ts
- packages/tooling/tool/cli/src/commands/Quality/index.ts
- packages/tooling/tool/cli/test/lint-command.test.ts
- packages/tooling/tool/cli/test/lint-workers.test.ts
- packages/tooling/tool/cli/test/quality-tasks.test.ts

### Verification commands and exit codes

Vitest commands run from `packages/tooling/tool/cli`; other commands run from the worktree
root. Logs and dry-run JSON are ephemeral `/tmp/c3-2-stage-c-*` files. The eight touched
TypeScript paths and root `package.json` are the nine-file Biome set; oxlint uses the eight
TypeScript paths. The results below are the durable verification record.

| Command | Exit | Result |
| --- | --- | --- |
| `bunx --no-install biome check --write <nine touched TS/JSON files>` | 1, then 0 | First pass found three unused imports left after shard-fixture deletion. Removed them. Subsequent formatting passes passed. |
| `bunx --no-install biome check <nine touched TS/JSON files>` | 0 | Final check: nine files, 1,157 ms, no fixes. |
| `bunx --bun vitest run --pool=threads test/lint-workers.test.ts test/lint-command.test.ts` | 1 | Initial run: 18 passed, 54 failed. One introduced predicate defect; 53 inherited cwd-changing command fixtures cannot run in threads. |
| `bunx --bun vitest run --pool=threads test/lint-workers.test.ts` | 0 | After repair: 18/18. After custom-base assertion: 19/19. Final post-typecheck-repair run: 19/19, 31.21 s. |
| `bunx --no-install vitest run --pool=threads test/lint-workers.test.ts` | 0 | Final Node worker suite: 19/19, 40.08 s, including real laws/docs/deprecated workers and ciops lab smoke. |
| `bunx --no-install vitest run --pool=forks --maxWorkers=1 test/lint-command.test.ts` | 0 | Full Node command suite: 54/54, 17.92 s. No Git-writing fixtures in this file. |
| `bunx --bun vitest run --pool=threads test/quality-tasks.test.ts -t '<policy plan selection>'` | 1 | Initial selection: five passed, one failed, 199 skipped. The override test exposed the Config/helper versus existing Bun.env test-boundary mismatch; fixed by reusing CiLane's exact option-decoding boundary. |
| `bunx --bun vitest run --pool=threads test/quality-tasks.test.ts test/lint-command.test.ts test/ci-lane.test.ts -t '<final selection below>'` | 0 | Ten passed, 328 skipped, three files, 15.56 s. Includes all six policy-plan cases, the pure lint detector, and three unchanged Check-concurrency cases. |
| `bunx --bun --no-install tsgo -p /tmp/c3-2-stage-c-tests.tsconfig.json --pretty false` | 1, 1, 0, 1, 0 | Final focused typecheck is clean. Intermediate failures and their fixes are attributed below. |
| `bunx oxlint --quiet --disable-nested-config <eight touched TS files>` | 0 | Both passes, including final post-repair pass, produced no diagnostics. |
| `bun run beep lint policy-fingerprint --write` | 0 | Both runs passed; the second follows every CLI source edit. |
| `cmp standards/policy-tools.fingerprint.json /tmp/c3-2-stage-c-fingerprint-before.json` | 0 | Byte-identical after both writer runs. |
| `cmp turbo.json /tmp/c3-2-stage-c-turbo-before.json` | 0 | Byte-identical after both writer runs. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current declaration and materialized inputs. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx turbo run lint:jsdoc --filter=@beep/schema --dry-run=json` | 0 | Expected cached package task and fingerprint dependency. |
| `bunx turbo run lint:deprecated-apis --filter=@beep/identity --dry-run=json` | 0 | Expected cached typed package task, transit/fingerprint dependencies, and worker script. |
| `bun run lint:deprecated-apis -- --filter=@beep/identity --dry-run=json` | 0 | New root wrapper resolves the same four-node graph, with no recursive deprecated-API root task. |
| `git --no-optional-locks diff --check` | 0 | No whitespace errors; read-only Git operation. |

Final selection is the literal regex:

```text
plans repo-wide root lint|scopes policy Turbo|bounds policy Turbo|passes changed TypeScript files|omits empty changed-scope|tooling schema-first lint detectors|uses the local PR-shape check concurrency|uses the hosted PR-shape check concurrency|lowers Check to c2
```

The source-resolving focused tsgo config copies Stage B's synthetic posture, includes exactly
the three touched test files and their imports, extends the real CLI config, removes project
references, and keeps no-emit/non-composite options, the workspace rootDir, and local Node/Bun
type roots. It is supporting evidence, not canonical package verification. The initial
predicate, overload, environment-boundary, direct process.env-in-Effect test reads, and
Effect.fn default-parameter diagnostics were introduced and corrected. Biome removed primitive
annotations on defaulted parameters; the runner now requires the two arguments its CLI caller
already supplies. Friction was recorded as encountered in `OPPORTUNITIES.md`.

Tests used external `timeout --signal=INT --kill-after=5s` watchdogs of 90–150 seconds; none
expired. No arbitrary tests were skipped inside the worker or full Node command suites.
The quality-file selection is required by the no-Git-write boundary, not a claim that its full
205-test suite passed.

### Measurements

- Deprecated-API shard inventory: **28 to zero**. Dedicated ESLint cache flags/paths in the
  retired command and tests: **zero remaining**. Worker heap: **8192 MiB**, unchanged.
- Policy worker limit: **4 by default**; tested overrides **2, 3, 4**; missing/empty/invalid
  values including `8` fall back to **4**. Check's local **3** / hosted **2** defaults and
  its override **2** tests remain green.
- Both policy labels survive unchanged. JSDoc's single step now has **two explicit task
  targets**; deprecated APIs has **one**. Each invocation requests a Turbo summary.
- Schema JSDoc dry run: **2 graph tasks**, **14 resolved inputs**, **910 matched files**;
  dependency `//#lint:policy-fingerprint`.
- Identity deprecated-API dry run: **4 graph tasks**, **22 resolved inputs**, **653 matched
  files**; dependencies `//#lint:policy-fingerprint` and `@beep/types#transit`.
- Fingerprint: **73 declared inputs**, byte-identical. `turbo.json` and root `tsconfig.json`
  have no Stage C diff. Workspace manifests have no Stage C diff.
- Final Bun workers: **19/19**, **31.21 s** (26.98 s reported tests). Node workers:
  **19/19**, **40.08 s** (33.00 s tests). Full Node command tests: **54/54**, **17.92 s**.
  Selected Bun plan/regression tests: **10/10 selected**, **15.56 s**.
- No Stage D cold/warm fleet run, hosted comparison, per-task hit-ratio claim, or whole-proof
  speed claim was made. These tests establish routing and worker execution, not cache economics.

### Blockers, verification split, and stopping point

No Stage C implementation blocker remains. The required Bun thread-pool attempt exposed
inherited cwd-changing command fixtures; the complete file passes under Node forks. The
quality file contains Git init/add/commit fixtures and was deliberately not run in full.
Fable still owns canonical `CI=true TMPDIR=/tmp bun run beep quality package-verify
@beep/repo-cli`, `bun run docgen:local`, Node coverage/ratchet for the touched sources,
`bun run beep lint policy`, and full quality-file acceptance. No coverage baseline or
new source-module row was added. Remote-cache credentials/availability were not established
by the dry runs, and no secret operation was needed for these checks.

The results file and its named paths are the handoff. Temporary worker source fixtures were
cleaned by their scopes; no untracked files remain. No Git writes, workspace manifest rewrite,
protected-path edits, PLAN/packet-state flips, or Stage D work occurred. Stop after Stage C.

## Stage D

Orchestrator-owned (no lane): before/after accounting per §7.1(4), the PLAN ticks, and the
publish. Measured on 2026-09-09/10 with Turbo 2.10.12.

### Before (hosted, shard runner)

`Heavy / Lint Policy` on `main` pushes, last five green runs before this PR: 598, 598, 610, 620,
629 s wall (p50 610 s). Inside job 102712770178 (620 s): `lint:deprecated-apis` (28 shards,
concurrency 4) **523.5 s**; `lint:jsdoc` (`eslint . --max-warnings=0`) **73.9 s**.

### After (local worktree, concurrency 4, `--cache=local:rw`, 16-core workstation)

| Run | Tasks | Cached | Wall |
| --- | ---: | ---: | ---: |
| cold `turbo run lint:deprecated-apis lint:jsdoc //#lint:jsdoc:root` | 277 | 0 | 12 m 50 s |
| warm, same command, unchanged tree | 277 | 277 | 0.455 s |

Cold task-seconds: `lint:deprecated-apis` 140 tasks, 2,387 s (p50 16.8 s, max 55.4 s for
`@beep/repo-cli`); `lint:jsdoc` 135 tasks, 677 s (p50 4.9 s, max 10.4 s); `//#lint:jsdoc:root`
1.9 s; `//#lint:policy-fingerprint` 1.9 s; 3,068 task-seconds in total, 277/277 successful.

### Reading

- The cold per-package typed sweep costs more wall than the 28-shard runner at the same
  concurrency (770 s local versus 523 s hosted, on different machines): every package pays the
  typescript-eslint project-service start instead of 28 shards sharing it. C3.6 measures this
  on the hosted runner; the honest expectation is a slower first cold run after merge.
- The win is reuse, which the shard runner never had: an unchanged tree replays all 277 tasks in
  under a second, a local `beep lint policy` selects only affected packages through `--affected`,
  and a checker or config edit reruns exactly the tasks whose inputs or fingerprint edge changed
  (Stage A/B fixtures). Hosted PR runs read the remote cache; the per-task hit ratio on the first
  and second hosted runs after merge is C3.6's number, not claimed here.
- Coverage of the sweep is unchanged: 140 `lint:deprecated-apis` owners (labs included through
  the worker's lab tolerance), 135 `lint:jsdoc` owners (the docs profile ignores labs), and the
  root residual for root-owned files.

### Hosted round 1 (PR #1079, head f3132f000f, job 102722219371, beep-ec2-heavy)

- `lint:jsdoc` (135 package tasks + the root residual, concurrency 4): **728 s**, 137/137
  successful, the fingerprint task already cached from the sibling invocation. Before: 73.9 s.
- `lint:deprecated-apis` (140 package tasks, concurrency 4): the step's 15-minute capture cap
  elapsed with **52 of 141 tasks** finished; Turbo received the kill signal, flushed
  `Tasks: 52 successful, 141 total` and exited 0 inside the kill grace, and the step was
  recorded as done. Two consequences: the capture helper let a deadline-hit child pass (fixed in
  this PR, regression test with a real trap-and-exit child), and the hosted cold sweep projects
  to roughly **40 minutes** at concurrency 4 against 523.5 s for the 28 shards. Per-package typed
  linting rebuilds the transitive source closure per package (every workspace export resolves to
  `src`), which the shard runner amortized over 28 programs; the heavy runner's 8 vCPUs also host
  the concurrent jsdoc workers and the other policy steps.
- Reading: the reuse mechanism is proven (fingerprint edge, `--affected`, warm replay in under a
  second) but the cold per-package cost is 4× the shard runner on the hosted runner, and cold
  recurs whenever the CLI closure changes. This contradicts D6's cost assumption and needs a
  ruling before the lane can be called good: keep the hosted full-scope sweep on the shard
  program (D6 amended), or make the per-package typed program cheap (reference-keeping check
  overlays from #1058 with `^build` declarations instead of the project service's source
  fallback), or raise the step budget and accept the wall. Options are in the PR thread.
- Outcome: ruling 30 (2026-09-10) took the first option; Stage E below implements it and C3.2b
  (table row 2b) owns the cheap per-package program.

### Stage D — files

- goals/time-to-certainty/research/c3-2-implementation.md
- goals/time-to-certainty/PLAN.md (C3.1 and C3.2 ticked)

## Stage E

Implemented ruling 30 only, on `ttc/c3-2-eslint-package-tasks`, starting from clean
`1363559f11`. Read the full brief, ruling 30, D6 revision 6, and the prior implementation
results including Stage C, Stage D, and Hosted round 1. No git writes or graft commands ran.
The results below are the Stage E handoff; no later stage was started.

### Decisions and rejected alternatives

1. Reused the existing schema-backed `QualityTaskStep`, `PolicyLintConcurrency`, command flags,
   and Effect process/service contract. This restoration needs no new production schema,
   service, exported symbol, or source module. Narrowed `runRootDeprecatedApisTask` to its
   caller-base argument and updated its documented example before routing the command to it.
   Rejected a second task model, process service, or exported CI helper.
2. Restored the deprecated-API shard constants, cache-location helper, and both runner functions
   byte-for-byte from `11b3889dd9^`. This includes all 28 shards, concurrency four, the content
   cache, 8192 MiB heap, subtree explanation, missing-shard handling, failure propagation,
   and labs-only unmatched-pattern tolerance. Rejected retaining the cold per-package sweep
   for full/hosted scope or increasing the step budget.
3. Standalone package mode retains the existing worker and lab tolerance. Without `--package`,
   `--full` or CI selects the shard program; otherwise the command delegates to the affected
   Turbo step with the caller base. CI is read through the existing Effect Config boundary.
   Restored the root script to `beep-cli lint deprecated-apis`. Rejected a root Turbo wrapper
   that would bypass the scope decision.
4. Full policy plans (undefined base) and CI plans (even with a base) use exactly
   `lint deprecated-apis --full` through `repoCliStep` and `eslint . --max-warnings=0` through
   `bunxStep`. Scoped local plans keep the Stage C Turbo builders. Existing LPT positions,
   lane labels, 15-minute capture timeouts, concurrency domain, cache posture, and full-state
   log line remain intact. Rejected changes to Turbo registrations, fingerprint inputs,
   lane identities, or the typed-program strategy reserved for C3.2b.
5. Restored all four shard regressions with explicit `--full`. Named their Effect programs to
   keep test wrappers trivial and avoid immediate-invocation diagnostics. Worker regressions
   prove local affected routing and child-local `TURBO_SCM_BASE`, explicit full shard routing,
   CI shard routing without `--full`, profile/heap arguments, failure propagation, and the
   existing package lab tolerance and live workers. Full/CI shard worker mocks supply a scoped
   filesystem service because this suite runs from the CLI package; the four restored command
   fixtures retain real filesystem and process execution. Rejected changing process cwd in a
   thread worker or changing production relative-path behavior to accommodate a test.
6. Reused `policyTurboStep` and `policyTurboScmBase` for full/scoped/CI plan assertions. Kept the
   prescribed quality-test name selection because the rest of the file contains git-writing
   fixtures. Rejected running that whole file under this lane's no-git-write contract.
7. Investigated P0 `local-shard-22de8c5adf48`: its saved cheap-gates log identified the fingerprint
   boundary schema and property-test findings already fixed by `4819a259ef`. Acknowledged it
   once with that fix SHA; current schema-first passes and the inbox has zero unacknowledged
   rows. Rejected attributing a code finding as environment-only or making a new commit.

### Stage E — files

- goals/time-to-certainty/research/c3-2-implementation.md
- goals/time-to-certainty/research/OPPORTUNITIES.md
- package.json
- packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts
- packages/tooling/tool/cli/src/commands/Quality/Tasks.ts
- packages/tooling/tool/cli/test/lint-command.test.ts
- packages/tooling/tool/cli/test/lint-workers.test.ts
- packages/tooling/tool/cli/test/quality-tasks.test.ts

### Verification commands and exit codes

Vitest commands ran from `packages/tooling/tool/cli`; other commands ran from the worktree
root. `<touched>` below is the five TypeScript paths plus root `package.json` in the file list;
`<touched TS>` is those five TypeScript paths. Markdown is the results/receipt surface.
Ephemeral detailed logs are `/tmp/c3-2-stage-e-*.log`.

| Command | Exit | Result |
| --- | --- | --- |
| `bunx biome check --write <touched>` | 0 | Initial and post-repair formatting passes. |
| `bunx biome check <touched>` | 0 | Six files checked, no fixes, 1,235 ms. |
| `bunx oxlint --quiet --disable-nested-config <touched TS>` | 0 | Initial and final checks, no diagnostics. |
| `bunx --no-install vitest run --pool=forks --maxWorkers=1 test/lint-command.test.ts` | 0, 0 | 58/58 both runs; final 12.64 s. Restored four regressions pass. |
| `bunx --no-install vitest run --pool=threads test/lint-workers.test.ts` | 1, 0 | Initial 19 passed, two new shard mock assertions failed because package-relative shards were absent; scoped filesystem mock repaired. Final 21/21, 35.96 s. |
| `bunx --bun vitest run --pool=threads test/quality-tasks.test.ts -t 'policy Turbo\|plans repo-wide root lint\|deprecated'` | 0 | Four selected passed, 201 skipped, 4.22 s. The shell regex uses plain pipes; backslashes here only escape Markdown table separators. |
| `bun run beep lint schema-first` | 0, 0 | Initial and post-repair checks pass; no new findings. |
| `bun run beep quality fallow audit --check --base origin/main --quiet` | 0, 0 | Initial and post-repair checks; `.beep/fallow/audit.check.json` has `exitStatus: 0`, zero findings. |
| `bun run beep quality fallow health --check --base origin/main --quiet` | 0, 0 | Initial and post-repair checks; `.beep/fallow/health.check.json` has `exitStatus: 0`, zero findings. |
| `bun run beep lint policy-fingerprint --check` | 0 | Declaration and materialized inputs current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drifting, zero written. |
| `bunx --bun --no-install tsgo -p /tmp/c3-2-stage-c-tests.tsconfig.json --pretty false` | 1, 0 | Four introduced `effect(effectFnIife)` diagnostics corrected with named Effect test programs. Final focused source-resolving check has no diagnostics. |
| Python comparison of restored constants/helpers/runners against `git show 11b3889dd9^` output | 0 | Both restored source blocks match byte-for-byte. |
| `bun run beep yeet inbox ack local-shard-22de8c5adf48 --fix-sha 4819a259ef` | 0 | Existing schema-fix commit attached to the P0 row; ignored local ack receipt only. |
| `bun run beep yeet inbox list --unacked` | 0 | Zero unacknowledged rows. |
| `git diff --check` | 0 | Read-only whitespace verification. |

The reused temporary tsgo configuration includes exactly the three touched test files and
imports, extends the actual CLI tsconfig, resolves workspace source, removes project references,
and uses no-emit/non-composite options plus this checkout's Node/Bun type roots. It does not
replace canonical package verification. No test fixture initialized, staged, or committed git.

### Measurements and remaining verification

- Full/hosted inventory restored from zero to **28 shards**, with **four concurrent workers**
  and **28 distinct content-cache locations** proven by the fixture. Missing labs yields 27
  invocations; only labs receives unmatched-pattern tolerance.
- Local policy retains **one deprecated-API task target** and **two JSDoc task targets**, affected
  scope, child-local base, summaries, and bounded concurrency. Full/hosted plans use the two
  legacy command shapes and retain every step's **900,000 ms** capture timeout.
- Final selected tests: **83 passed** across the three runs (58 command, 21 workers, four plan).
  The 201 unselected quality tests were not run; no full-suite claim is made.
- `turbo.json`, the fingerprint declaration, workspace manifests, root `tsconfig.json`, packet
  lifecycle, and all protected paths have no Stage E edits. No new source module or coverage
  baseline was created. Friction receipts were appended when the test issues were identified.
- No fresh hosted/cold/warm timing or cache-hit measurement was attempted. Stage D's recorded
  measurements motivate the ruling; this stage proves routing/restoration, not a new speedup.

No sandbox implementation blocker remains. Per the Stage E brief, Fable owns package-verify,
Node coverage/ratchet, and the hosted lane; those have not been run or claimed green here.
The existing command and Tasks source coverage rows must still be evaluated by that coverage
run. All requested sandbox checks now pass. Stop after Stage E.
