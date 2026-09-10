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
