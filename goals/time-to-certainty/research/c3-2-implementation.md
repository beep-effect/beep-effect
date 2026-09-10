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
