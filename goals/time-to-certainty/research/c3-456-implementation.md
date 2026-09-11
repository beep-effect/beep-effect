# C3.3 follow-up + C3.4 + C3.5 + C3.6 — implementation record (one PR)

Branch `ttc/c3-4-5-6-turbo-tasks` from `origin/main` at `662823dd96` (2026-09-11). Brief:
`c3-456-brief.md`. One `## Stage <X>` section per Codex lane launch, appended by the lane; Fable
adds the orchestrator verdicts and the hosted rounds.

## Stage A

Implemented only the C3.3 follow-up: hard-switch the laws plan and retire `beep:policy`.
The live checkout HEAD is `bd6caa2fc1bb70557a0dadbe4e37216593a71e09` on
`ttc/c3-4-5-6-turbo-tasks`; the introduction above records the branch's earlier creation base.
The checkout was clean at entry. No git writes or graft commands ran. Stages B–E were not started.

### Decisions and rejected alternatives

1. Reused `policyLintTurboStep`, the helper used by affected JSDoc, with label `lint:laws`
   and tasks `lint:laws //#lint:native-runtime:roots`. A supplied base selects `--affected`
   and child-local `TURBO_SCM_BASE`; no base selects full scope. Both retain the existing
   cache resolver, four-worker default/Check overrides, `--continue=dependencies-successful`,
   `--summarize`, timeout, and no labs exclusion. The planner never reads CI to choose scope.
   No `laws` sweep key was introduced; deprecated-API and JSDoc program selection is unchanged.
2. The supplied economic rationale is the earlier fleet cold **86.228 s**, versus **109 s**
   for the five hosted steps, and **0.405 s** warm. This supports the requested hard switch;
   ruling 30's expensive per-package typed-program reason does not apply to these syntax laws.
   Precision correction from reading the original record: the 141/141 fleet measurement was
   package laws plus fingerprint, not the root residual. C3.3 Stage C separately proved the
   repaired residual at 4.830 s cold and 0.061 s warm (2/2 tasks). These are historical local
   measurements, not a combined hosted benchmark or a whole-proof speedup claim.
3. Deleted the four migrated law steps, the package-test-imports step, `scopedLawStep`, and
   its now-unused package-test-import path predicate. Expanded the remaining effect-imports
   call directly to `scopedRepoCliStep`, preserving its exact command and source predicate.
   **Live-contract discrepancy:** ecosystem-polarity also uses `scopedRepoCliStep`. Kept that
   consumer unchanged, because removing or unscoping it would violate the requirement that
   no other step change. The helper therefore has two consumers until Stage D, not one.
   `LINT_POLICY_STEP_CONCURRENCY` remains. Rejected premature Stage D routing or a duplicate
   helper solely to satisfy the stale consumer count.
4. `beep:policy` was already absent from `TaskScriptName` and `ImplScriptName`; removed its
   remaining four schema audit-default references and both writer entries. Audit chains now
   call `bun run lint:laws` at the old policy hop, preserving package-test-import checking
   through the new package worker. Removed the writer's two obsolete path arguments and
   updated every call site. Rejected retaining a dead alias or silently dropping the audit
   check. No new domain model, service, source module, or coverage-baseline row was needed.
5. The generator deliberately preserves existing free-tier audit text and unknown extras.
   Accordingly, explicitly retired `beep:policy` in the two authorized manifests and replaced
   their audit hop, then ran the canonical generator. It reported 142 manifests, zero drift,
   **zero additional writes**. Final manifest diff is exactly freshbooks and box-provisioning:
   each loses the old script and replaces `bun run beep:policy` with `bun run lint:laws` in
   `beep:audit`; no other manifest changed. Rejected changing generic free-tier preservation
   semantics to implement a two-manifest migration.
6. Tests pin the complete 29-to-25 label transition, exact new argv in local/full scopes,
   base propagation, no labs filter, sweep independence, and absence of all five old labels.
   Existing scoped tests now pin effect-imports and preserve ecosystem-polarity. Scaffold
   tests pin complete literal blocks and audit text. The policy tests run in-process;
   selected tests avoid the quality suite's git-writing fixtures and create-package's
   inherited cwd-changing fixtures. Existing architecture tests still contain Bun helpers;
   this lane added no Bun-only test APIs. Node suite/coverage validation remains Fable-owned.
7. Updated `lint policy` help to describe affected/full laws routing. The inspected
   `standards/turbo-remote-cache.md` does not enumerate the retired five steps, so it needs
   no Stage A edit; the Stage C hash-reading documentation remains deferred. Historical
   implementation receipts were preserved. Applied schema-first and Effect-first skills.
   The parent Effect reference reports rc.112 while installed Effect reports rc.113;
   inspected installed rc.113 Array declarations as well. No new Effect API was introduced.
   Regenerating the structure-only fingerprint left both its declaration and Turbo config
   unchanged, as expected for this CLI-content-only closure change.

### Stage A — files

Every tracked path touched (none created or deleted):

- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`
- `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts`
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`
- `packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `packages/tooling/tool/cli/test/create-package.test.ts`
- `packages/tooling/tool/cli/test/architecture-operation-plan.test.ts`
- `packages/drivers/freshbooks/package.json`
- `packages/drivers/box-provisioning/package.json`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

The fingerprint generator also wrote byte-identical `standards/policy-tools.fingerprint.json`
and `turbo.json`; neither has a diff. Verification generated ignored build/cache output and
scratch logs under `/tmp/ttc-stage-a/` and `.beep/c3-456-stage-a-cache/`; these are not handoff
source files and are not to be staged.

### Before and after policy labels

Full plan before, in order (29):

```text
lint:deprecated-apis
knowledge:semantic-delta
knowledge:refs-check
lint:schema-first
lint:terse-effect
lint:jsdoc
lint:native-runtime
lint:identity-registry
lint:frozen-grant-set
lint:circular
lint:effect-fn
lint:package-test-imports
lint:effect-imports
lint:effect-imports-markdown
lint:package-test-typecheck
lint:tsconfig-overlay
lint:tsgo-rules
lint:oxlint
lint:ecosystem-polarity
lint:allowlist
lint:jsdoc-module-tags
goals:doctor
goals:index-check
lint:reflection-artifacts
lint:roadmap-refs
lint:judge-rubric
lint:package-scripts
lint:policy-fingerprint
lint:typos
```

Full plan after, in order (25):

```text
lint:deprecated-apis
knowledge:semantic-delta
knowledge:refs-check
lint:schema-first
lint:laws
lint:jsdoc
lint:identity-registry
lint:circular
lint:effect-imports
lint:effect-imports-markdown
lint:package-test-typecheck
lint:tsconfig-overlay
lint:tsgo-rules
lint:oxlint
lint:ecosystem-polarity
lint:allowlist
lint:jsdoc-module-tags
goals:doctor
goals:index-check
lint:reflection-artifacts
lint:roadmap-refs
lint:judge-rubric
lint:package-scripts
lint:policy-fingerprint
lint:typos
```

Local plans retain the existing file-based omission of effect-imports/ecosystem-polarity.
The laws step remains in the plan even for docs-only files; Turbo owns its affected selection.
An additional before/after source comparison removed just the migrated expressions, expanded
only the old effect-imports wrapper, and compared the remaining plan ignoring whitespace:
identical, including order, command arguments, timeout, and sweep branches.

### Verification commands and exit codes

Commands below ran from the repository root unless marked CLI cwd
(`packages/tooling/tool/cli`). `--bun` selects the authorized Bun launcher; no separate Node
Vitest or coverage run was requested by this lane. Turbo probes and the policy run use local
cache only. Logs are disposable `/tmp/ttc-stage-a/*.log`.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bun run beep lint package-scripts --write` | 0 | 142 manifests, 0 drifting, 0 written after the explicit free-tier migration. |
| `bun run beep lint policy-fingerprint --write` | 0 | Written; no declaration or Turbo diff. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drift. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bunx --bun biome check --write packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/create-package.test.ts packages/tooling/tool/cli/test/architecture-operation-plan.test.ts packages/drivers/freshbooks/package.json packages/drivers/box-provisioning/package.json` | 0 | Ten files, formatted three. |
| `bunx --bun biome check --write packages/tooling/tool/cli/test/create-package.test.ts packages/tooling/tool/cli/test/architecture-operation-plan.test.ts` | 0 | Final whitespace cleanup check, no further fixes. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts` | 0 | Zero diagnostics. |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-a-cache" bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --filter=@beep/freshbooks --filter=@beep/box-provisioning --cache=local:rw` | 0 | 39/39 tasks, no hits, 16.973 s. Includes required dependency builds. |
| `bunx --bun vitest run test/quality-tasks.test.ts test/create-package.test.ts --pool=threads -t 'plans repo-wide root lint\|policy Turbo\|full deprecated sweep\|hard-switches policy laws\|remaining scoped policy checks\|omits empty changed-scope policy steps\|create-package script writers'` (CLI cwd) | 0 | 10 selected pass, 218 skipped, 5.27 s. Pipes are Markdown-escaped only; shell regex used plain pipes. |
| `bunx --bun vitest run test/architecture-operation-plan.test.ts --pool=threads` (CLI cwd) | 0 | Full file: 17/17, 2.16 s. |
| `bunx --bun vitest run test/laws-turbo-inputs.test.ts --pool=threads` (CLI cwd) | 0 | Existing real Turbo hash fixtures: 3/3, 4.84 s; no git fixture setup. |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-a-cache" bunx --bun turbo run lint:laws "//#lint:native-runtime:roots" --concurrency=4 --continue=dependencies-successful --summarize --cache=local:rw --dry-run=json` | 0 | Full plan resolves law tasks, root residual, and fingerprint dependency. |
| `TURBO_SCM_BASE=origin/main TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-a-cache" bunx --bun turbo run lint:laws "//#lint:native-runtime:roots" --concurrency=4 --continue=dependencies-successful --summarize --affected --cache=local:rw --dry-run=json` | 0 | Affected plan resolves the same fleet because CLI closure inputs changed. |
| `python3 /tmp/ttc-stage-a/compare-plan.py` | 0 | Remaining plan expressions unchanged after the precise normalization described above. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification. |
| `bun run beep lint policy --help` | 0 | Help describes affected/local and full/CI laws routing. |

### Measurements

The two dry runs each enumerate 144 graph nodes: 140 executable package law tasks, the root
residual, the fingerprint dependency, and two `<NONEXISTENT>` package tasks (scratchpad and
tsgo-shim). The latter are not executed checks. CLI closure edits select the fleet even in
local affected scope; this dry run is not a docs-only selectivity proof. The combined laws
step in the requested policy run succeeded in **88.724 s**, including the root residual.
This run overlaps the existing policy checks and is not an isolated cold/warm benchmark.
No new hosted performance or cache-hit ratio is claimed. The 30 passing tests and 39 passing
Turbo check/build tasks are correctness evidence; test/check timings above overlap other
verification and are not controlled performance comparisons.

### Requested affected-policy execution

Exact command (local-only cache and explicit local scope):

```sh
CI=false TURBO_CACHE=local:rw TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-a-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bun run beep lint policy
```

The command reported `scope=changed (14 files)` and emitted:

```text
[beep-cli] lint:laws: bunx turbo run lint:laws //#lint:native-runtime:roots --cache=local:rw --concurrency=4 --continue=dependencies-successful --summarize --affected
```

**Exit 0**, wall **573.75 s**, GNU time maximum RSS **14,133,680 KiB** (maximum reported
by the timed process tree, not a sum of concurrent workers). Every selected policy step
completed successfully. The unchanged deprecated-API step was the long pole at 572.023 s;
JSDoc took 165.351 s. The run printed inherited nonblocking goals advisories and two Markdown
parser warnings; neither failed its step. No code was changed to suppress those diagnostics.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `CI=false TURBO_CACHE=local:rw TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-a-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bun run beep lint policy` | 0 | Complete affected battery passed, 573.75 s. Run exactly once. |

The actual laws summary is `.turbo/runs/3JCbf6qtA5hXmDKC9pY9y1cfTvb.json`:
142/142 tasks successful, 1 cached (fingerprint), Turbo wall 88.670 s. Read-back found exit 0
for all 142 recorded tasks, no unproven task. The root residual is a MISS with exit 0,
hash `2b7bf18df1a5a0a7`; the fingerprint is a HIT with exit 0, hash `de182c8a5929ff8f`.
The other invocation summaries are `.turbo/runs/3JCcYGhxTcktiBuu81d63avPqVF.json`
(deprecated APIs: 141/141 successful, zero cached) and
`.turbo/runs/3JCbsMZgV8OuKFsQgjbE21W1RmW.json` (JSDoc: 137/137 successful, one cached).
These are this attempt's local summaries, not prior-run receipts or hosted evidence.

### Blockers and precise residual for Stage B

No Stage A implementation or sandbox-verification blocker remains. The complete requested
policy command passed. Two brief/live differences are explicitly resolved here: the retained
scoped helper has the existing ecosystem-polarity consumer, and the scripts generator made no
additional writes because existing free-tier values require the authorized explicit migration.

Fable owns `CI=true TMPDIR=/tmp bun run beep quality package-verify @beep/repo-cli`,
`bun run docgen:local`, Node coverage and full applicable suites, plus
`bun run beep quality package-verify @beep/freshbooks --quick` and
`bun run beep quality package-verify @beep/box-provisioning --quick` for the scripts-only
manifest edits. The lane's filtered checks do not substitute for those handoff gates.
No new source file or baseline row was added; Fable should measure the existing modified CLI
rows in-process with the package suite. No hosted result is claimed.

After Fable accepts Stage A, Stage B is exactly C3.4 in the brief: register/verify the doctest
package task and discovery, migrate the owner include overrides, retain the compatibility
`--mode` no-op until main's workflow changes, retire the root config/resolver, add the hash
fixture, and measure cold/warm fleet behavior. No part of that work was started here.
Stage D still owns final root-task routing, both remaining scoped-helper consumers, and
`LINT_POLICY_STEP_CONCURRENCY` retirement. Stop after Stage A.

## Stage B

Implemented only C3.4, on the Stage A branch at HEAD
`8fd301387c1881ba2f848dac3aeb349961f2f021`. The checkout was clean at entry.
No git writes, graft commands, Node verification launches, network operations, or
Stages C–E work ran. **Stage B is not activation-ready:** the strict fleet task
exposes five literal-marker false positives in repo-cli. Static verification and
the migrated regression tests pass; a passing cold fleet and all-HIT warm fleet
remain blocked as detailed below.

### Decisions and rejected alternatives

1. Registered `doctest` with the ten §2.1 inputs verbatim and in their prescribed
   order, plus `$TURBO_ROOT$/packages/tooling/tool/cli/test/global-cleanup.ts`.
   The extra file is a resolved `globalSetup`, rather than `setupFiles`, but is
   just as much a runtime input. The current owners otherwise inherit root
   `vitest.setup.ts`. The discovery test checks each owner's resolved setup and
   global setup paths against **that task's** expanded Turbo input map. The task
   has `dependsOn: ["^transit"]`, `env: ["BEEP_VITEST_DOCTEST"]`, `cache: true`,
   and `outputs: []`. No fingerprint edge is added to this non-CLI worker.
2. Live census is **27 owners**, not the brief's estimated 28. A root dry run has
   253 graph nodes, including transit and non-executable task nodes, but exactly
   27 executable doctest commands. Package presence stays generated and unchanged;
   the gate reports 142 manifests and zero drift. The fixture already had both
   `doctest` and `beep:doctest` scripts, so it needed no manifest edit.
3. Exported `vitestDoctestActive` and made the ten named package include overrides
   conditional, plus the additional inheriting `infra` override. Coverage include
   lists are a different selector and remain intact. Scratchpad's nested
   effect-ontology config has no package manifest; packet codemod configs are not
   workspace owners. Storybook's bypassing config remains untouched. Strengthened
   the existing policy fixture to prove that a marked Storybook bypass emits a
   derivation conflict and stamps neither doctest script.
4. Reused `directTurboArgs` and `runQualityTaskStreamingStepGroup`, which wraps
   Turbo steps in the existing remote-cache secret session. The unchanged label
   is `ci:doctest`; argv is `turbo run doctest <cache posture> --concurrency=4
   --summarize`. No affected, caller filter, labs exclusion, or SCM-base env is
   forwarded. Every legacy mode, including `none`, has exactly this plan. Deleted
   the bespoke file/dependent/deleted-manifest resolver and exported Vitest-step
   helper, and retired resolver-only test/mock machinery. Docgen/Fallow execution
   tests keep their shared mock, renamed to reflect its remaining role.
5. **Main-workflow compatibility:** the runner group admits `heavy.yml@main`, so
   the current PR will still receive `ci lane doctest --mode affected|full` from
   main. The flag remains accepted and is ignored for doctest, with a one-line
   deprecation note in help and descriptor notes. The workflow loses its entire
   doctest mode/input gate and doctest mode arguments, and marks Doctest as using
   Turbo for cache setup. The workflow edit takes effect after merge. The existing
   goals-only gate and Docgen's mode behavior remain. The local replay also stops
   manufacturing obsolete doctest mode/base flags. Rejected deleting the CLI flag
   now, applying affected selection, or retaining two doctest implementations.
6. Removed root `vitest.docs.ts`, its root script, and the fixture's duplicate
   config/reference. Kept `@effect/doctest` as a root devDependency. The fixture
   executes its real package script, without a pool override, and passes both
   assertions. Added `doctest` to the existing Turbo proof task domain and default
   proof list. No new production source module, service, schema family, or coverage
   baseline row was introduced.
7. The discovery fixture uses Vitest's public `resolveConfig` in a fresh Bun
   process per config, then the resolved includeSource/exclude lists and marker
   predicate; it does not execute owner tests. An initial in-worker env mutation
   retained a startup snapshot. Fresh processes match package startup and pass for
   all owners, including strict no-tests behavior under the coverage-report flag.
   The eleven override configs also resolve correctly in ordinary and doctest mode.
   Test code uses runtime-neutral platform services and no new `Bun.*` APIs.
8. **Necessary runtime adjustment discovered by the exact command:** the first
   cold run failed before assertions with Bun's fork-worker startup handshake
   timeout. Selected `pool: "threads"` only in the shared doctest branch; ordinary
   test pool defaults remain. This is covered by config resolution and the real
   package-script fixture. Rejected a fixture-only pool workaround, a manifest
   fleet rewrite, a Node substitution forbidden by this lane, or an increased
   timeout. Thread-worker shutdown warnings remain observable on schema's cold
   run; schema nevertheless passes all 120 files and 363 assertions with exit 0.
9. The real hash fixture consumes the production task and transit declarations in
   a synthetic non-git workspace. It proves source, test, setup, package config,
   tsconfig, shared config/setup/aliases, shared utils source, global cleanup, and
   upstream transit-source mutations change the consumer hash; root/package docs
   and unrelated package source edits leave it stable. Every restoration returns
   the original hash, and changing the declared doctest env changes it. No git
   fixture setup or affected-selection probe ran.
10. The strict fleet discovers five repo-cli files containing marker strings or
    generated-template text but no executable test suite. This is a real red,
    not an environment failure. Nonempty owner discovery passes yet cannot prove
    that every selected file contains an assertion. Kept the ratified selector and
    `passWithNoTests: false`; rejected silent exclusions, vacuous tests, enabling
    pass-with-no-tests, or unrelated domain/example edits. The decision needed to
    resolve that selector/strictness conflict is listed under blockers.

### Stage B — files

Modified:

- `.github/workflows/heavy.yml`
- `apps/labs/api-docs/vitest.config.ts`
- `apps/labs/ciops/vitest.config.ts`
- `apps/labs/lejeune-bolt-workbench/vitest.config.ts`
- `apps/labs/semantica/vitest.config.ts`
- `apps/labs/trustgraph-workbench/vitest.config.ts`
- `apps/oip-web/vitest.config.ts`
- `apps/practice-kg-mcp/vitest.config.ts`
- `apps/professional-desktop/vitest.config.ts`
- `apps/todox/vitest.config.ts`
- `infra/vitest.config.ts`
- `package.json`
- `packages/drivers/duckdb/vitest.config.ts`
- `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts`
- `packages/tooling/tool/cli/test/ci-lane.test.ts`
- `packages/tooling/tool/cli/test/ci-runner-security.test.ts`
- `packages/tooling/tool/cli/test/doctest-lane.test.ts`
- `packages/tooling/tool/cli/test/fixtures/doctest-lane/package/tsconfig.json`
- `packages/tooling/tool/cli/test/package-scripts.policy.test.ts`
- `turbo.json`
- `vitest.shared.ts`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

Created:

- `packages/tooling/tool/cli/test/doctest-turbo-inputs.test.ts`

Deleted:

- `vitest.docs.ts`
- `packages/tooling/tool/cli/test/fixtures/doctest-lane/package/vitest.docs.ts`

The fingerprint writer also rewrote byte-identical
`standards/policy-tools.fingerprint.json`; it has no diff. No workspace manifest
changed. Disposable, untracked verification material is under `/tmp/ttc-stage-b/`
(`edit.py`, `tests.py`, `measure.py`, `verify-artifacts.py`, `measurements.json`,
`dry-run.json`, `dry-run.stderr`, and the named `.log` files below). Generated
build/typecheck artifacts, `.turbo/runs/` summaries, and caches under
`.beep/c3-456-stage-b-cache`, `.beep/c3-456-stage-b-doctest-cache`,
`.beep/c3-456-stage-b-doctest-threads-cache`, and the default local Turbo cache
are not source handoff files and must not be staged.

### Verification commands and exit codes

Commands ran from the repo root unless marked **CLI cwd**
(`packages/tooling/tool/cli`). `--bun` selects the authorized Bun launcher.
Pipes inside test-name regexes below are Markdown-escaped only; the actual shell
regex used plain pipes. Log redirection went to `/tmp/ttc-stage-b/<name>.log`.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bun run beep lint policy-fingerprint --write` | 0 | Ran after CLI changes and again at finalization; fingerprint inputs unchanged. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current, including final rerun. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drift; no scripts-schema change required `--write`. |
| `bunx --bun biome check --write vitest.shared.ts turbo.json package.json apps/{todox,professional-desktop,practice-kg-mcp,oip-web}/vitest.config.ts apps/labs/{trustgraph-workbench,semantica,lejeune-bolt-workbench,ciops,api-docs}/vitest.config.ts infra/vitest.config.ts packages/drivers/duckdb/vitest.config.ts packages/tooling/tool/cli/src/commands/Ci/CiLane.ts packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts packages/tooling/tool/cli/test/{ci-lane,ci-runner-security,doctest-lane,doctest-turbo-inputs,package-scripts.policy}.test.ts packages/tooling/tool/cli/test/fixtures/doctest-lane/package/tsconfig.json` | 0 final; 1 during edits | Final `format-clean.log`: 22 files, one formatting fix. Earlier passes caught introduced unused imports and a JSDoc glob terminating its comment; all repaired. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/commands/Ci/CiLane.ts packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts` | 0 | Zero diagnostics, final rerun included. |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b-cache" bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 0 | Initial 34/34 task execution proof, 11.468 s. |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b-cache" bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --filter=@beep/duckdb --filter=@beep/infra --filter=@beep/todox --filter=@beep/professional-desktop --filter=@beep/practice-kg-mcp --filter=@beep/oip-web --filter=@beep/trustgraph-workbench --filter=@beep/semantica --filter=@beep/lejeune-bolt-workbench --filter=@beep/ciops --filter=@beep/api-docs --cache=local:rw` | 0 | 126 tasks, 32 cached, 19.768 s. At this point the collecting CLI test-typecheck artifact still contained introduced test errors; outer success did not prove those tests typechecked. |
| `bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 0 | After repairing test diagnostics: 34/34, 11.387 s, CLI stored verdict exit 0 and empty output. |
| `python3 /tmp/ttc-stage-b/verify-artifacts.py` | 0 | Read back all 12 touched workspaces' stored test-typecheck artifacts: exit 0, empty diagnostics for every one. |
| `bunx --bun tsgo -p tsconfig.configs.json --noEmit` | 0 | Root config typecheck, including the shared and package configs. |
| `bunx --bun tsgo -p packages/tooling/tool/cli/test/tsconfig.json --noEmit` | 2 | Diagnostic detour: inherited TS6059 from test config's source-only rootDir. Canonical synthetic-config worker plus artifact read-back above is green. |
| `bunx --bun vitest run test/ci-lane.test.ts --pool=threads` (**CLI cwd**) | 1 | 64 passed; one untouched unreadable-inventory test calls `process.chdir()`, unsupported in a thread worker. |
| `bunx --bun vitest run test/ci-lane.test.ts --pool=threads -t '^(?!.*maps an unreadable workspace inventory)'` (**CLI cwd**) | 0 | 64 pass, one inherited process-cwd case skipped. |
| `bunx --bun vitest run test/ci-runner-security.test.ts --pool=threads -t 'runs full Doctest\|retires the root Doctest\|preserves the requested PR lane'` (**CLI cwd**) | 0 | Three pass; 17 unselected. Avoids the suite's unrelated git-writing fixtures. |
| `bunx --bun vitest run test/doctest-lane.test.ts test/doctest-turbo-inputs.test.ts test/package-scripts.policy.test.ts --pool=threads` (**CLI cwd**) | 1 | Initial iteration: ten pass, two discovery failures (workspace row shape and stale in-worker config snapshot), both repaired. Hash and policy suites pass. |
| `bunx --bun vitest run test/doctest-lane.test.ts test/doctest-turbo-inputs.test.ts test/package-scripts.policy.test.ts test/ci-lane.test.ts test/ci-runner-security.test.ts --pool=threads -t '^(?!.*maps an unreadable workspace inventory)(?!.*CI runner security).*\|runs full Doctest\|retires the root Doctest\|preserves the requested PR lane'` (**CLI cwd**) | 1 | 78 pass, 18 skipped; introduced missing variable while strengthening input-map assertion failed discovery. Repaired and rerun below. |
| `bunx --bun vitest run test/doctest-lane.test.ts --pool=threads` (**CLI cwd**) | 0 final | Final strengthened suite: 3/3, 67.69 s. Resolves all owners and both modes for all eleven overrides; runs the real fixture package script. Earlier fresh-process version also passed 3/3 in 118.10 s. Together with the preceding unaffected suite results, 79 distinct selected tests pass. |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b-cache" bunx --bun turbo run doctest --dry-run=json --cache=local:rw` | 0 | Final production graph: 27 executable owner tasks, 253 total graph nodes. |
| `bun run beep ci lane doctest --help` | 0 | Accepts all four legacy modes and documents the doctest no-op. |
| `python3 /tmp/ttc-stage-b/measure.py` | 0 | Validates cold/warm summary data and matching hashes for all 27 owners; 26 warm HITs have exit 0. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace check. |

The very first root-cwd `bunx --bun vitest run test/doctest-lane.test.ts --pool=threads`
ran from the wrong cwd and exited 1; the first CLI-cwd attempt also exited 1,
with the introduced JSDoc parse error. These are failed setup attempts, not passing tests. No separate Node suites, coverage,
package-verify, or docgen claim is made. Those remain Fable-owned by the lane split.

### R1 measurements

Each attempt uses the exact fleet task at concurrency four, with remote cache
access disabled. Cold means an empty **Turbo task cache**, not a cold machine;
prior config/fixture checks warmed filesystem/module caches. No other verification
command ran concurrently with the successful-execution cold/warm pair. The two
attempts used identical task inputs; all 27 hashes match across their summaries.
Later strengthening of the regression tests changes repo-cli's test input hash;
this pair is attempt-specific evidence, not a claim of a final all-green proof.

| Exact command | Exit | Wall | Turbo wall | Successful / tasks | Hits |
| --- | ---: | ---: | ---: | ---: | ---: |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b-doctest-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 60.58 s | 60.524 s | 0 / 5 attempted | 0 |
| `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b-doctest-threads-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` (cold) | 1 | 37.58 s | 37.534 s | 26 / 27 | 0 |
| Same exact command and cache (warm) | 1 | 9.42 s | 9.374 s | 26 / 27, including replays | 26 / 27 |

First attempt: default forks never reached assertions. Thread-pool cold attempt:
2,570 assertions pass across the fleet, but repo-cli's five empty suites make the
lane red. Warm: every previous success is a HIT with exit 0; repo-cli is a MISS
with exit 1, never cached as success. **The required all-HIT warm result is not met.**

Per-package boot/run **lifetime** (Turbo execution start through exit), over all
27 cold attempts: **p50 3.382 s, max 34.490 s**. A separate startup/teardown proxy,
task lifetime minus Vitest's reported duration, has **p50 0.390 s, max 2.394 s**.
That residual includes process launch, config loading and final cleanup; it is not
an independently instrumented pure-boot latency. Warm cached task execution
intervals are zero in the summaries; the sole re-executed repo-cli task is 9.297 s.

The two slowest packages are **@beep/schema, 34.490 s** (Vitest 34.13 s, exit 0)
and **@beep/nlp-processing, 12.954 s** (Vitest 10.56 s, exit 0). Repo-cli is third
at 10.902 s, exit 1. GNU time maximum RSS is 11,258,324 KiB cold and 1,460,740 KiB
warm; these are the timed process-tree maximum measurements, not summed worker RSS.
No hosted improvement or whole-proof denominator is claimed against the historical
82-second affected-lane baseline.

Attempt summaries:

- Fork-startup failure: `.turbo/runs/3JCfluFzOqXPAfezvhNHoOkwPzR.json`.
- Cold thread fleet: `.turbo/runs/3JCfu4ManKQjf5VArwBvVZhK3x6.json`.
- Warm thread fleet: `.turbo/runs/3JCg3F08gq6ufyx5IVnHLZnSHQL.json`.

### Blockers and precise residual for Stage C

**Do not activate or describe this as a passing migration yet.** Repo-cli's six
real doctest files pass all 14 assertions, but these five marker-bearing sources
have no suite under the required strict setting:

- `packages/tooling/tool/cli/src/commands/Docgen/Doctest.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts`
- `packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts`
- `packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityExportBlock.ts`
- `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/VocabTerms.ts`

Fable must resolve the contract conflict before activation: authorize a shared
semantic selector for the worker and scripts derivation, with literal/template
negative fixtures, or authorize real executable doctest examples in those files.
Then rerun the exact cold/warm pair and require all 27 successful/all HIT. Retaining
strictness and reporting the blocker is intentional; a discovery smoke alone is
not proof of an executable suite. Also assess the observed schema thread-shutdown
warnings on the actual hosted runtime.

Fable retains full `CI=true TMPDIR=/tmp bun run beep quality package-verify
@beep/repo-cli`, `bun run docgen:local`, scoped Node coverage, the process-isolated
CI test, and hosted Doctest with main's still-present mode argument. Run applicable
package handoff checks for the eleven config-only workspaces as well; the lane's
filtered check/test-typecheck run and config proof are supporting evidence.

Stage C remains only the root-task registration work in the brief: register the
remaining table rows, extend root-task proofs and input/affected fixtures, and
write the Turbo hash documentation. This lane made no Stage C registrations or
Stage D consumer changes. Keep doctest's compatibility flag until the admitted
main workflow no longer needs it; do not remove it as incidental Stage C cleanup.
Stop after Stage B.
