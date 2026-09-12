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


## Stage B2

Implemented only Amendment 1, marker-literal parity. **The marker defect is fixed,
but Stage B2 activation acceptance remains blocked:** the cold/warm fleet reruns
fail in untouched `@beep/schema` tests. No Stage C–E work, git writes, graft commands,
Node verification launches, or network operations ran.

### Decisions and rejected alternatives

1. Added `doctestSourceMarker`, composed from two strings at runtime, and
   `doctestFenceInfo(name)` in the existing `DoctestSource.ts`. Both have Details,
   Gotchas, and examples whose output does not spell the marker. Exposed them through
   the existing documented test-kit export so examples and tests use an exported path.
2. Replaced marker literals in exactly the five named sources. The schema's example
   calls the fence helper; package generation and vocabulary templates render the same
   fence text as before. The analyzer retains its existing single/double-quote title
   handling and uses the marker constant, avoiding a change to its quoting semantics.
   Package-script derivation still uses the identical literal predicate at runtime.
3. Extended the Stage B discovery test: for each live owner, scan all source TS/TSX
   files, including excluded paths, and require a marked fence whenever marker text
   occurs. Kept owner config/discovery/setup-input checks intact. Added an in-process
   synthetic `resolveConfig` fixture: both files match includeSource, but only the
   marked example matches Vitest's literal predicate. It also asserts exact helper output.
   Tests use runtime-neutral APIs; the existing owner-resolution child-process strategy
   remains unchanged. Node execution remains Fable-owned, not claimed here.
4. Rejected selector replacement, additional excludes, pass-with-no-tests, empty tests,
   unrelated schema fixes, increased timeouts, and changing concurrency. The amendment
   does not authorize runtime/schema repairs to force the fleet green.
5. Explicitly typed the existing discovery helper's `active` parameter as a required boolean after
   stored test-typecheck diagnostics exposed its inferred-any condition. No behavior change. The final Biome pass removed the redundant default-parameter
   annotation; made the argument required and passed `true` explicitly to retain
   the type while satisfying both tools. Final verification is recorded below.
6. Ran the exact Stage B command shape with a fresh cache, then its warm counterpart.
   Both failed on schema, so repeated once using a second fresh cache. Preserve all
   failed evidence; none of these timings establish a passing migration.

### Stage B2 — files

Modified (no source files created or deleted):

- `packages/tooling/tool/cli/src/internal/jsdoc/DoctestSource.ts`
- `packages/tooling/tool/cli/src/test/Docgen.test-kit.ts`
- `packages/tooling/tool/cli/src/commands/Docgen/Doctest.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts`
- `packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts`
- `packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityExportBlock.ts`
- `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/VocabTerms.ts`
- `packages/tooling/tool/cli/test/doctest-lane.test.ts`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

The fingerprint writer rewrote byte-identical `standards/policy-tools.fingerprint.json`
(no diff). No workspace manifest changed. Disposable scripts and logs are under
`/tmp/ttc-stage-b2/`; generated build/typecheck artifacts, `.turbo/runs/` summaries,
and `.beep/c3-456-stage-b2-doctest{,-retry}-cache` are verification artifacts, not
source handoff files, and must not be staged.

### Verification commands and exit codes

Root cwd unless marked CLI cwd (`packages/tooling/tool/cli`). Log redirects are
`/tmp/ttc-stage-b2/<name>.log`; the commands below are otherwise exact.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bunx --bun biome check --write packages/tooling/tool/cli/src/internal/jsdoc/DoctestSource.ts packages/tooling/tool/cli/src/test/Docgen.test-kit.ts packages/tooling/tool/cli/src/commands/Docgen/Doctest.schemas.ts packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityExportBlock.ts packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/VocabTerms.ts packages/tooling/tool/cli/test/doctest-lane.test.ts` | 0 | 8 files checked; formatting/import ordering repaired. Final full pass exposed the annotation conflict documented above. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/internal/jsdoc/DoctestSource.ts packages/tooling/tool/cli/src/test/Docgen.test-kit.ts packages/tooling/tool/cli/src/commands/Docgen/Doctest.schemas.ts packages/tooling/tool/cli/src/commands/Docgen/internal/Doctest.ts packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityExportBlock.ts packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/VocabTerms.ts` | 0 | Zero diagnostics. |
| `bun run beep lint policy-fingerprint --write` | 0 | Written; byte-identical. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests; zero drift. |
| `bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 0 on all three runs | 34/34 each time. First stored verdict failed; final stored verdict clean after boolean annotation. |
| `python3 /tmp/ttc-stage-b2/verdict.py` | 0 | Final stored repo-cli test-typecheck exit 0, empty diagnostics. Earlier inline read-back exited 1 and exposed the condition diagnostic. |
| `bunx --bun vitest run test/doctest-lane.test.ts test/doctest.test.ts test/package-scripts.policy.test.ts --pool=threads` | 0 | CLI cwd: 3 suites, 33 tests, 87.45 s. Annotation-only repair followed this run; final typecheck and fleet run use the annotated source. |
| `bunx --bun vitest run test/doctest-lane.test.ts --pool=threads` | 0 | CLI cwd, final required-argument repair: 4/4 tests, 68.77 s. |
| `python3 /tmp/ttc-stage-b2/measure.py` | 0 | Reads all four summaries; checks cold/warm hash identity within each pair. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification. |

Final formatting and stored-verdict read-back after the required-argument repair:
`bunx --bun biome check --write packages/tooling/tool/cli/test/doctest-lane.test.ts`
exited 0 with no fixes; the third filtered Turbo run exited 0, and
`python3 /tmp/ttc-stage-b2/verdict.py` exited 0 with empty stored diagnostics.

### Cold/warm rerun measurements

Cold means an empty local Turbo task cache, not cold filesystem/module caches.
Remote cache is disabled. No other verification command ran concurrently with a
measurement. All 27 owner hashes match within each pair. The final explicit-argument test-only
repair changes repo-cli's test-input hash; these summaries are attempt-specific
evidence, not a final-source cache receipt. Task lifetime is Turbo
execution start through end; it is not separately instrumented pure boot time.

| Attempt | Exact command | Exit | Wall | Success | HIT | Lifetime p50 / max |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| cold | `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b2-doctest-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 40.63 s | 26/27 | 0/27 | 3.353 / 39.312 s |
| warm | `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b2-doctest-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 38.83 s | 26/27 | 26/27 | 0.000 / 38.712 s |
| cold-retry | `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b2-doctest-retry-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 39.11 s | 26/27 | 0/27 | 3.013 / 38.290 s |
| warm-retry | `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b2-doctest-retry-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 37.34 s | 26/27 | 26/27 | 0.000 / 37.226 s |

cold slowest: **@beep/schema**, 39.312 s (exit 1), **@beep/repo-cli**, 11.998 s (exit 0).

cold-retry slowest: **@beep/schema**, 38.290 s (exit 1), **@beep/nlp-processing**, 9.738 s (exit 0).

Attempt summaries:

- cold: `.turbo/runs/3JChtEcBenvKmusyRjDTqBaq73W.json`.
- warm: `.turbo/runs/3JChzohqVcrmW6EM6AnwBnwiosx.json`.
- cold-retry: `.turbo/runs/3JCi5atgcqDB59zQgbbF99uPYEB.json`.
- warm-retry: `.turbo/runs/3JCiB4jK7tKTJjdVPjNbapKo75o.json`.

Schema warning, one full line verbatim from the first cold log (as requested):

```text
@beep/schema:doctest: [vitest-pool]: Timeout terminating threads worker for test files ~/…/ttc-c3-456/packages/foundation/modeling/schema/src/ReferrerPolicy/ReferrerPolicy.schema.ts.
```

The warning coexists with exit 1 in these attempts, but the reported test failures
are 30,000 ms assertion timeouts. This does not isolate a causal exit-code effect
from the warning itself; Stage B's warning-only success is not reproduced here.
The first cold and warm each report 12 failed and 351 passed schema assertions.
Repo-cli's six real doctest files pass all 14 assertions and warm-replay successfully.

### Blockers and residual for Stage C

**27/27 successful cold and 27/27 HIT warm are not met.** The five-file marker blocker
is resolved; the remaining blocker is repeatable schema test timeouts on this Bun
thread runtime. Schema source/config was not edited in B2, but the exact cause is
unproven, so this is not labeled a confirmed environment-only failure. Do not activate
or claim a passing migration based on repo-cli's success or the parity fixture alone.
Fable must investigate that runtime failure and obtain the required passing pair
before activation. Full logs preserve all timeout and shutdown diagnostics.

Fable retains `CI=true TMPDIR=/tmp bun run beep quality package-verify @beep/repo-cli`,
`bun run docgen:local`, scoped Node coverage, and hosted verification, per the explicit
lane split. No package-verify, docgen, Node coverage, or hosted success is claimed.
The compatibility `--mode` flag and strict selector remain as Stage B specified.
Stage C remains only the brief's root-task registrations, proofs/input fixtures, and
Turbo hash documentation. No Stage C registrations or Stage D consumer changes ran.
Stop after Stage B2.

## Stage B3

Implemented only Amendment 2 (ruling 34): package doctests run on Node.
No git writes, graft commands, changeset, or Stage C–E work ran.

### Decisions and rejected alternatives

1. Changed all six package-kind `beep:doctest` implementation defaults to
   `BEEP_VITEST_DOCTEST=1 bunx vitest run`. Ordinary test defaults are preserved.
2. The initial canonical generator run exited 0 but wrote zero manifests: existing
   implementation keys are intentionally preserved by `seedImplementation`. Removed
   only the exact legacy doctest implementation from the 27 owners, then reran
   `bun run beep lint package-scripts --write`: 142 manifests, zero drift, 27 written.
   Parsed before/after manifests prove that only the doctest implementation values
   changed. The writer additionally reordered existing script keys in observability
   and identity. Rejected widening generator ownership or adding a permanent migration
   policy for this one-time runtime change. Recorded the friction when discovered.
3. Removed the doctest-only thread-pool override and its comment from the shared
   Vitest configuration; strict discovery, marker parity, and the rest of the
   doctest branch remain. The discovery test now pins the default fork pool and
   the Node script for every owner. The policy test and non-workspace fixture
   manifest use the new script; the fixture is edited directly, not generated.
4. Rejected changing assertion timeouts, schema examples, concurrency, the selector,
   or pass-with-no-tests. Retained the exact Stage B outer Bun/Turbo command: the
   generated inner Vitest launcher is the amended Node command.

### Stage B3 — files

Modified source, configuration, fixture, and report paths (no deletions or new
production files):

- `packages/foundation/capability/api-transport/package.json`
- `packages/foundation/capability/chalk/package.json`
- `packages/foundation/capability/colors/package.json`
- `packages/foundation/capability/file-processing/package.json`
- `packages/foundation/capability/langextract/package.json`
- `packages/foundation/capability/mcp-kit/package.json`
- `packages/foundation/capability/nlp-processing/package.json`
- `packages/foundation/capability/observability/package.json`
- `packages/foundation/capability/semantic-web/package.json`
- `packages/foundation/modeling/html/package.json`
- `packages/foundation/modeling/identity/package.json`
- `packages/foundation/modeling/lexical/package.json`
- `packages/foundation/modeling/md/package.json`
- `packages/foundation/modeling/nlp/package.json`
- `packages/foundation/modeling/ontology/package.json`
- `packages/foundation/modeling/pandoc-ast/package.json`
- `packages/foundation/modeling/provenance/package.json`
- `packages/foundation/modeling/rdf/package.json`
- `packages/foundation/modeling/schema/package.json`
- `packages/foundation/modeling/skill-contract/package.json`
- `packages/foundation/modeling/utils/package.json`
- `packages/foundation/primitive/data/package.json`
- `packages/foundation/primitive/types/package.json`
- `packages/foundation/ui-system/dock/package.json`
- `packages/foundation/ui-system/editor/package.json`
- `packages/foundation/ui-system/ui/package.json`
- `packages/tooling/tool/cli/package.json`
- `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts`
- `packages/tooling/tool/cli/test/doctest-lane.test.ts`
- `packages/tooling/tool/cli/test/package-scripts.policy.test.ts`
- `packages/tooling/tool/cli/test/fixtures/doctest-lane/package/package.json`
- `vitest.shared.ts`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

The fingerprint writer also rewrote byte-identical
`standards/policy-tools.fingerprint.json` (no diff). Disposable evidence lives in
`/tmp/ttc-stage-b3/`: named verification logs, `owners.txt`, `dry-run.json`,
`dry-run.stderr`, `measure.py`, `measurements.json`, and `report-draft.md`.
Generated build/typecheck artifacts, package `.turbo/` logs, `.turbo/runs/`
summary files, the default local Turbo cache, and
`.beep/c3-456-stage-b3-doctest-cache/` are verification artifacts, not handoff
source files; do not stage them.

### Verification commands and exit codes

Root cwd unless marked CLI cwd (`packages/tooling/tool/cli`). Command output was
redirected to `/tmp/ttc-stage-b3/<name>.log` unless noted. No separate Node
verification suite, coverage, package-verify, or docgen run is claimed: the
amendment's lane split leaves those with Fable. The amended package-script
fixture and required fleet launches are the only attempted Node doctest runs.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bun run beep lint package-scripts --write` | 0, twice | First: zero written; after removing exact legacy implementation keys: 27 written, 142 manifests, zero drift. |
| `bunx --bun biome check --write packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts packages/tooling/tool/cli/test/doctest-lane.test.ts packages/tooling/tool/cli/test/package-scripts.policy.test.ts packages/tooling/tool/cli/test/fixtures/doctest-lane/package/package.json vitest.shared.ts` | 0 | Five files checked; no fixes. |
| `bun run beep lint policy-fingerprint --write` | 0 | Written, byte-identical. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drift. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts` | 0 | No diagnostics. |
| `bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 0 | 34/34 successful, zero cached, 22.876 s. |
| `python3 /tmp/ttc-stage-b2/verdict.py` | 0 | Reads current repo-cli stored test-typecheck verdict: exit 0, empty diagnostics. This reuses only the prior helper, not prior verification evidence. |
| `bunx --bun tsgo -p tsconfig.configs.json --noEmit` | 0 | Config typecheck clean. |
| `bunx --bun vitest run test/doctest-lane.test.ts test/package-scripts.policy.test.ts --pool=threads` (CLI cwd) | 1 | 11 passed, one failed, 196.60 s. Discovery, parity, include overrides and policy checks pass; real package-script fixture times out at 90,000 ms. |
| `bunx --bun turbo run doctest --dry-run=json --cache=local:rw` | 0 | Production graph resolves. |
| `test ! -e .beep/c3-456-stage-b3-doctest-cache` | 0 | Fresh cache absent before cold run. |
| `python3 /tmp/ttc-stage-b3/measure.py` | 1 | Captures partial summaries and checks matching completed-task hashes; deliberately fails required 27-task acceptance assertion. Not a successful fleet validation. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace check, also rerun after report append. |
| `bun --version` / `node --version` | 0 / 0 | Outer shell: Bun 1.4.2, Node v24.20.0. Does not prove child runtime. |

A read-only Python comparison against `git show HEAD:<manifest>` also checked all
27 parsed manifests: changing only the old doctest value to the new value yields
exact equality. Ordinary test scripts and all non-script values are preserved.

### Cold/warm rerun measurements

Cold means an absent local Turbo cache, not cold filesystem/module caches. Remote
cache is disabled. No verification ran concurrently with either measured attempt;
the warm attempt uses the same cache and unchanged task inputs as cold. The exact
outer command is retained as required. The warm attempt is a repeated invocation,
not a successful cache-replay measurement, because the cold run cached no successes.

| Attempt | Exact command | Exit | Wall | Turbo wall | Successful / launched | HIT | Max RSS (KiB) |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: |
| cold | `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b3-doctest-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 60.62 s | 60.510 s | 0 / 4 | 0 / 4 | 523,828 |
| warm | `TURBO_CACHE_DIR="$PWD/.beep/c3-456-stage-b3-doctest-cache" /usr/bin/time -f 'wall=%e maxRSS=%M exit=%x' bunx --bun turbo run doctest --concurrency=4 --summarize --cache=local:rw` | 1 | 60.52 s | 60.475 s | 0 / 4 | 0 / 4 | 524,204 |

Both attempts launched **@beep/types, @beep/identity, @beep/utils, @beep/data**.
All four log fork-startup errors before assertions. Turbo stops on the first
reported failure and records a complete execution interval only for @beep/types:
**60.256 s cold**, **60.264 s warm**, exit 1, MISS, same hash. The other three
launched tasks have no execution intervals in the summaries. Thus the completed
sample p50/max is 60.256/60.256 s cold and 60.264/60.264 s warm (**n=1 each**).
**Fleet lifetime p50/max and the two slowest packages are unavailable**; ranking
four startup failures from one recorded interval would fabricate measurement.
The remaining 23 owners, including schema, were not reached. No schema shutdown
warning result is available in B3. GNU time RSS is the timed command's maximum
RSS measurement, not summed concurrent worker RSS.

Attempt summaries:

- cold: `.turbo/runs/3JCjfbK7DFbJLXDAW0UGHL2QAZu.json`.
- warm: `.turbo/runs/3JCjoSKvsrm41cpBYJSSGHYTl1B.json`.

Minimal diagnostic shared by both attempts:

```text
[vitest-pool-runner]: Timeout waiting for worker to respond
```

The exact-command logs identify a temporary `/tmp/bun-node-…/bun` launcher.
Read-only inspection of that same directory finds both `bun` and `node` symlinked
to the installed Bun 1.4.2 binary. This supports the inference that the outer
`bunx --bun` launch can retain Bun substitution for the inner `bunx vitest run`.
The worker's runtime was not directly instrumented, so neither confirmed Node
execution nor a confirmed environment-only failure is claimed. Fable's direct
Node schema result in Amendment 2 is external evidence, not reproduced by this
exact-command attempt. No alternate measurement command was substituted.

### Blockers and residual for Stage C

**Stage B3 source changes are implemented; activation acceptance is blocked.**
The required 27/27 successful cold and 27/27 HIT warm are not met, and the real
package-script fixture also fails. Fable must reconcile the mandated outer
`bunx --bun turbo` command with the Node-runtime requirement, validate the complete
launch path, and obtain a passing exact agreed cold/warm pair. Any change to the
outer measurement command or CI launcher policy needs an explicit follow-up scope;
this lane does not silently widen Stage B3 or relax its tests.

Fable retains package handoff verification (including the 27 manifest owners),
`CI=true TMPDIR=/tmp bun run beep quality package-verify @beep/repo-cli`,
`bun run docgen:local`, scoped Node coverage, and hosted verification. The strict
selector, parity test, discovery test, compatibility `--mode` flag, ordinary test
scripts, and Stage C–E responsibilities remain as specified in the brief.
Stage C residual is the remaining root task registrations, proof/input/affected
fixtures, and Turbo hash documentation, after resolving the activation blocker.
No Stage C registration or Stage D consumer change was made. Stop after Stage B3.

### Orchestrator verdict on Stage B3 (Fable, outside the sandbox)

The lane's fleet runs failed only because its mandated `bunx --bun` launcher installs Bun's
`node` shim for the whole process tree, so the Node doctest scripts ran on Bun again. The CI lane
launches `bunx turbo` and package scripts run through `bun run`, neither of which installs the
shim. Fable ran the exact pair without `--bun` from a fresh `TURBO_CACHE_DIR`:

| Attempt | Summary | Turbo wall | Tasks | Successful | HIT | Lifetime p50 / max | Two slowest |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| cold | `.turbo/runs/3JCkNZQUJ1YQQRevyz15nJdJnHE.json` | 103.6 s | 27 | 27 | 0 | 10.57 s / 37.82 s | @beep/repo-cli 37.8 s, @beep/skill-contract 21.8 s |
| warm | `.turbo/runs/3JCkNae7JjGF8PUMnxxivtjl1L5.json` | 0.12 s | 27 | 27 | 27 | replay | — |

`bunx vitest run test/doctest-lane.test.ts test/package-scripts.policy.test.ts` on Node: 2 files,
12 tests, exit 0. The activation acceptance (27/27 cold, 27/27 HIT warm) is met on Node.

## Stage C

Implemented only **C3.5 root task registration**. Read the complete lane brief,
its amendments, the Stage A–B3 record including Fable's successful Node verdict,
and the table/rulings and implementation precedents named by the brief. Entry
checkout was clean. No Git writes or graft commands ran. Stage D consumers,
`beep:preflight`, workflow routes, packet lifecycle, and the prior doctest work
were not changed. Applied the schema-first and Effect-first skills.

### Decisions and rejected alternatives

1. Registered **37 additional root tasks**, yielding **40 root tasks** from all
   §2.2 root rows, including expansion of the five Fallow advisory rows. Added
   33 new root scripts and changed `lint:oxlint` to exactly
   `oxlint --quiet --disable-nested-config`. The existing `changeset:status`,
   `config-sync:check`, and `topo-sort` scripts gained registrations without
   script changes. `knip` remains `knip-bun`; `knip:check` invokes the ratchet.
   All newly registered script text matches the table after expansion of its
   explicit ellipses/placeholders. The three previously registered rows retain
   their existing `beep-cli` script spelling and exact definitions; the Stage C
   instruction targets rows not yet registered. Rejected rewriting these prior
   stages or routing consumers ahead of Stage D.
2. Copied every concrete input list in table order. Expanded `same corpus` to
   the semantic-delta corpus, `as audit` to the audit inputs (including the pilot
   inventory; no dead-code regression baseline), and typos to its four prefix
   inputs plus all **34** current `files.extend-exclude` entries, each prefixed
   with `!`. Knip's `root tool configs` shorthand is explicit:
   `*.config.{ts,js,mjs,cjs}`, `vitest*.ts`, `vitest.aliases.generated.json`,
   `bunfig.toml`, `biome.jsonc`, `.oxlintrc.json`, `.fallowrc.jsonc`, `tsdoc.json`,
   `syncpack.config.ts`. These supplement the row's other inputs and the existing
   fingerprint closure. Rejected `$TURBO_DEFAULT$`, copied CLI source closures,
   incidental broadening, and treating explanatory prose such as `docgen.srcDir`
   as an input. A read-only table audit confirms the final ordered lists.
3. All **35 CLI-backed dependent root tasks** declare exactly
   `dependsOn: ["//#lint:policy-fingerprint"]`, including the indirect
   `repo-sanity:versions` worker. The fingerprint itself has no self-edge; direct
   oxlint, typos, syncpack, and sherif have no CLI dependency. All D2 rows and the
   binary walkers remain non-reusable: **18 cache:false**, **22 cache:true** in
   total. No D14 binary walk certification was attempted or claimed; oxlint's
   ambient target-existence reads keep it non-reusable. Rejected enabling reuse
   merely because a hash fixture passes.
4. Preserved the marked environment/output contract: semantic-delta passes
   `GITHUB_EVENT_PATH` through without hashing it; all seven Fallow envelopes
   hash/forward `BEEP_PROOF_BASE` and declare their exact JSON/raw artifacts;
   JSDoc inventory declares `.beep/ci/jsdoc-documentation.inventory.*`.
   All remaining task-local env/pass-through fields are absent and outputs are
   empty. Existing Turbo globals and every package-task definition are unchanged.
5. Extended the existing `TurboConfigProofTaskName` LiteralKit with all 40 root
   IDs and the three previously missing package-policy task names. Retained the
   existing default proof selection: callers can explicitly request any new
   root ID. No new production module, public export, service, consumer, or
   coverage-baseline row was introduced.
6. Added a schema-decoded fixture that loads **every live root task** from
   `turbo.json`, retains the production globals, flags, scripts, inputs, and
   dependency edges, and invokes the actual Turbo binary against a synthetic
   workspace. Independent named file probes cover every root row. It also pins
   task-domain membership, script presence, CLI dependency edges, D2 cache flags,
   env/pass-through fields, and outputs. The negative-closure test mutates a
   real fingerprint input omitted from each task's direct input set. Roadmap's
   whole-tree declaration already includes all candidate tool reads; the test
   explicitly requires that sole exception and verifies its hash changes too.
   No input widening was needed after these probes. Rejected mock hashes,
   JSON-text-only assertions, cumulative mutations, and a misleading claim that
   these fixtures certify binary walker semantics or non-file state.
7. Authored the ruling-27 `--affected` test in the same suite. It initializes and
   commits **only its disposable synthetic fixture**, then checks clean selection,
   each row's declared-input edit, and a non-input edit. **Did not execute it**:
   this lane forbids all Git writes, including synthetic Git setup. The Bun
   command selects only the two no-Git hash cases by test name. This is an explicit
   acceptance blocker for Fable, not a skipped-green full-suite claim. No permanent
   test skip or environment gate was added.
8. Added the policy hash-reading documentation, root ID convention, local/hosted
   target summary counts with the retained legacy eslint exception, per-attempt
   freshness requirements, D2 provenance limits, and the requested hosted-script
   task rule. Documented that Stage D still connects the consumers. Rejected
   claiming the registered tasks already supply current consumer summaries.

### Stage C — files

Modified:

- `package.json`
- `turbo.json`
- `packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts`
- `standards/turbo-remote-cache.md`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

Created:

- `packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`

Deleted: none. The fingerprint generator also rewrote byte-identical
`standards/policy-tools.fingerprint.json` (no diff); its Turbo input list remains
unchanged. No workspace manifest changed. Disposable helpers, logs, and dry-run
JSON live under `/tmp/ttc-stage-c/` (`register.py`, `probes.json`, `audit.py`,
`verdict.py`, `dry-run.sh`, `verify-dry-run.py`, and named logs/JSON). The scoped
synthetic workspaces are removed by their filesystem scopes. Dependency build
outputs, generated verification artifacts, package `.turbo/` logs/verdicts, and
local cache entries are not handoff source files and must not be staged.

### Verification commands and exit codes

Root cwd unless marked **CLI cwd** (`packages/tooling/tool/cli`). Log redirections
are `/tmp/ttc-stage-c/<name>.log`; command arguments below are otherwise exact.
The shell regex uses plain pipes; the table escapes them only for Markdown.
No Node-runtime task execution, doctest fleet measurement, remote-cache operation,
package-verify, docgen, coverage, or hosted result is claimed by this lane.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bunx --bun biome check --write package.json turbo.json packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts` | 0 on all four passes | Four files; initial passes formatted edits, final pass has no remaining formatting issue. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts` | 0 | Zero warnings/diagnostics on touched source. |
| `bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 0, 0 | Both 34/34; final 12.665 s, zero cache hits. Initial outer success masked the fixture error-channel diagnostics in the collecting test task; see read-back. |
| `python3 /tmp/ttc-stage-c/verdict.py` | 0 | Final stored repo-cli test verdict: exit 0, empty diagnostics. Initial read-back (inline Python) exposed exit 1 with six `effect(anyUnknownInErrorContext)` diagnostics; fixed by preserving generic error/environment parameters. |
| `bunx --bun vitest run test/root-tasks-turbo-inputs.test.ts --pool=threads -t 'hashes declared\|closes tool'` (**CLI cwd**) | 1, 0, 0 | First: direct-input case passed; closure candidate selection failed on roadmap's whole-tree inputs. Final: 2 passed, 1 deliberately unselected Git fixture; 9.30 s total, 3.95 s tests. |
| `bun run beep lint policy-fingerprint --write` | 0 | Written, fingerprint declaration/input list unchanged. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drift, zero writes. Root scripts are outside the workspace writer's domain; no scripts-schema change requires a fleet rewrite. |
| `python3 /tmp/ttc-stage-c/audit.py` | 0 on both runs | All 40 table root rows accounted for; 37 new scripts/input lists match, three existing rows unchanged. Also proves all package tasks, globals, and existing scripts except oxlint unchanged, including `beep:preflight`. |
| `zsh /tmp/ttc-stage-c/dry-run.sh` | 0 | Runs the exact 40-target production Turbo dry run reproduced below. |
| `python3 /tmp/ttc-stage-c/verify-dry-run.py` | 0 | 40 executable root nodes, 35 fingerprint edges, command/cache equality with production registrations, 40 distinct hashes. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification, including final report. |

Exact production dry-run invocation (stdout saved as `dry-run.json`, stderr as
`dry-run.stderr`, under `/tmp/ttc-stage-c/`):

```sh
bunx --bun turbo run '//#lint:jsdoc:root' '//#lint:policy-fingerprint' '//#lint:native-runtime:roots' '//#lint:package-scripts' '//#knowledge:semantic-delta' '//#knowledge:refs-check' '//#lint:schema-first' '//#lint:identity-registry' '//#lint:effect-imports' '//#lint:tsgo-rules' '//#lint:oxlint' '//#lint:allowlist' '//#lint:jsdoc-module-tags' '//#goals:doctor' '//#lint:roadmap-refs' '//#lint:judge-rubric' '//#lint:typos' '//#knip:check' '//#fallow:audit:check' '//#fallow:health:advisory' '//#fallow:boundaries:advisory' '//#fallow:flags:advisory' '//#fallow:security:advisory' '//#fallow:fix-preview:advisory' '//#jsdoc:inventory:check' '//#changeset:status' '//#lint:circular' '//#lint:effect-imports-markdown' '//#lint:ecosystem-polarity' '//#goals:index-check' '//#lint:reflection-artifacts' '//#fallow:dead-code:check' '//#config-sync:check' '//#repo-sanity:changeset-graph' '//#repo-sanity:syncpack' '//#repo-sanity:sherif' '//#repo-sanity:versions' '//#repo-sanity:bun-audit' '//#fallow:boundaries:config-check' '//#topo-sort' --dry-run=json --cache=local:rw
```

### Dry-run fixture results and measurements

| Fixture/probe | Result | Limit |
| --- | --- | --- |
| Declared-input mutation, every root task | **40/40** change hash; each probe file is present in that task's resolved input map. | Synthetic dry run; does not execute the checker. |
| Non-input mutation, every root task | **40/40** hashes stay stable on `.beep/c3-fixture-excluded.bin`; file is absent from each resolved input map. | Deliberately outside the declared and exercised tool closure. |
| Negative tool-closure mutation | **34/34** CLI dependents with an outside-direct-input candidate change hash through D15; fingerprint hash changes too. | Candidates are actual fingerprint tool inputs; no claim about Git/clock/network state. |
| Whole-tree tool-read mutation | Roadmap's hash changes; the fixture pins it as the sole task with every candidate already directly declared. | This is direct coverage, not evidence of an omitted edge. |
| Exact restoration | Final direct-input suite returns the original task summaries; every mutation restores bytes before the next probe. | No cumulative-edit masking. |
| Ruling-27 affected selection | **Authored, not run** (one unselected test). | Requires Git writes; Fable-owned acceptance blocker. |
| Binary walk fixture | **Not attempted.** Oxlint, typos, knip stay `cache:false`. | Hash and config tests do not certify the actual tool walks. |
| Production graph | **40/40** root nodes resolve; **549,603** matched input entries summed across tasks, 40 distinct task hashes. | Entry count is not unique files; shared inputs recur across tasks. |

The production dry run used local-cache posture only. No cold/warm checker
execution, cache-hit economics, Node-runtime conclusion, or whole-proof speed
claim follows from these graph/hash results. The supplied Bun-node shim warning
remains binding: Fable must run Node-backed verification outside this launch path.

### Blockers and residual for Stage D

**Stage C registrations and no-Git verification are complete; ruling-27 acceptance
is pending the unexecuted Git fixture.** Fable should run, from the CLI directory:

```sh
bunx vitest run test/root-tasks-turbo-inputs.test.ts --pool=threads
```

This full Node run must pass all three tests, including the synthetic Git base and
`--affected` mutations; none of that acceptance is inferred from the two Bun tests.
Fable also retains `CI=true TMPDIR=/tmp bun run beep quality package-verify
@beep/repo-cli`, `bun run docgen:local`, scoped Node coverage/ratchet for the existing
proof module, commit/publish, and hosted verification. Before a live checkout
`--affected` probe, Fable commits the Turbo declarations as required by the brief.

Stage D remains precisely the consumer migration: `Quality/Tasks.ts`'s D10 plan
and aggregate sequencing, `GithubChecks.ts` routes, `CiLane.ts` knip/Fallow/JSDoc
steps with base forwarding and envelope checks, and root `beep:preflight`.
The live Stage A note still applies: `scopedRepoCliStep` has both effect-imports
and ecosystem-polarity consumers until that migration. Preserve ruling-31 hosted
eslint sweep behavior, D2 unfiltered execution, lane identities, and fresh inventory
before the JSDoc compare. Wave seed task-ID notes and artifact readers remain with
the later stage specified by the brief; no Stage D or E implementation was started.
Stop after Stage C.

## Stage C2

Executed **only Amendment 3: selectors, Git exclusions, and affected fixtures**.
Read the brief in full and the Stage C record. Entry checkout was clean. No graft
commands or checkout Git writes ran; synthetic Git initialization, staging,
commits, branch creation, and loose-object writes occurred only inside scoped
`/tmp/root-tasks-turbo-*` fixtures. No Stage D/E migration was started.
Applied the Effect-first skill for test implementation and Yeet skill for the
required inbox acknowledgement.

### Decisions and rejected alternatives

1. Added `!.git/**` and `!**/.git/**` to both whole-tree root input lists:
   `//#lint:roadmap-refs` and `//#lint:typos`. Typos has config prefixes before
   `**/*`, so checking only the first input would miss it. Preserved all other
   root/package task configuration and cache flags. No binary walker was promoted
   to reusable cache status.
2. Changed the laws residual to bare `lint:native-runtime:roots` in both scopes,
   avoiding a redundant scope branch for equivalent full-scope behavior. Changed
   the affected JSDoc residual to bare `lint:jsdoc:root`. Full JSDoc remains the
   existing eslint sweep. Updated the laws argv pin and added an explicit affected
   JSDoc assertion that requires the bare name and rejects the qualified selector.
3. Retained the production-derived 40-row configuration fixture and its original
   direct-input/non-input and fingerprint-closure hash tests. All Git fixtures
   now commit configuration, create `base` at the first commit, then commit only
   a README change; `git status --porcelain` proves the resulting working tree
   is clean. Dry runs use `TURBO_SCM_BASE=base`, `TURBO_SCM_HEAD=HEAD`.
4. README remains an input of the two whole-tree rows. The exact clean affected
   set is therefore `//#lint:roadmap-refs`, `//#lint:typos`, and their shared
   `//#lint:policy-fingerprint` prerequisite. Removing README from production
   inputs solely to force an empty fixture result would weaken their contract.
   A non-input edit adds no task to this baseline; requesting the other bare
   names returns an empty result.
5. Each of the 40 declared-input edits is asserted with exact task-set equality
   both when requesting that row alone and when requesting that row plus the two
   whole-tree rows, including dependency edges. This avoids the old weak
   `toContain` assertion and prevents the shared prerequisite from masking a
   row's own selection. An all-40 request cannot generally select only one row:
   production rows intentionally overlap (Fallow rows share `.fallow/plugins`,
   for example). Isolated requests preserve the amendment's per-row proof without
   inventing disjoint production inputs.
6. Added F-A regression evidence: for the same non-input mutation, all 40 explicit
   `//#` selectors return all 40 tasks under `--affected`, while bare names retain
   filtering. Added F-B evidence: compute a blob ID, prove its object path absent,
   write it with `git hash-object -w`, prove the path exists, add nested Git
   metadata, then require all 40 hashes unchanged and no Git paths in any input
   map. No mock hashes, permanent skips, or narrowed test-name invocation remain.
7. Appended the F-A/F-B amendment to `c3-turbo-facts.md`; left the lane table,
   rulings, plan and lifecycle edits to Fable. Regenerated the policy fingerprint;
   the output was byte-identical, with no tracked fingerprint diff. No scripts
   schema changed, so package-scripts required only its check.
8. Triaged the pre-existing required P0 audit row. Its capsule contains command
   and exit 1 but no diagnostic cause. Acknowledged exactly once as `wontfix`
   with explicit deferral to Fable's Amendment 3 package-verify/Node ownership.
   This is a scoped deferral, not a repair, waiver, or environment-only claim.
   Recorded that friction and the shared-cache sandbox warning immediately in
   `OPPORTUNITIES.md`.

### Stage C2 — files

Modified handoff source/documentation files:

- `turbo.json`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`
- `goals/time-to-certainty/research/c3-turbo-facts.md`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

Created/deleted handoff files: none. Generated
`standards/policy-tools.fingerprint.json` was rewritten byte-identically.
The ignored acknowledgement receipt is
`.beep/inbox/acks/local-shard-2c38e6923e66`; verification also produced ignored
package `.turbo` results/logs and dependency build outputs. Temporary verification
log: `/tmp/ttc-stage-c2-typecheck.log`; cache: `/tmp/ttc-stage-c2-turbo-cache`.
Scoped synthetic repositories are removed at scope exit. Do not stage these
local verification artifacts or the inbox receipt.

### Verification commands and exit codes

Root cwd unless marked **CLI cwd** (`packages/tooling/tool/cli`). These are Bun
lane results, not Node-runtime, package-audit, docgen, coverage or hosted proof.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bunx --bun biome check --write turbo.json packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts` | 0 on three passes | Initial two passes formatted the fixture; final pass clean. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | 0 | Zero warnings/diagnostics on touched production source. |
| `bunx --bun vitest run test/root-tasks-turbo-inputs.test.ts --pool=threads` (**CLI cwd**) | 0, 0 | Full suite: 5/5 both times. Final strengthened suite 10.76 s total, 6.84 s tests; all 40 direct-input and hash rows covered, real Git affected and metadata probes executed. |
| `bunx --bun vitest run test/quality-tasks.test.ts --pool=threads` (**CLI cwd**) | 0 | 208/208, 5.87 s total. Printed TS2589 snippets belong to test fixtures for error classification; no failed test or real xai/ui build occurred in this suite. |
| `bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 0 | 34/34, 11.543 s; shared-cache writes warned about read-only filesystem. Stored package-test verdict exit 0, empty diagnostics. |
| `TURBO_CACHE_DIR=/tmp/ttc-stage-c2-turbo-cache bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw > /tmp/ttc-stage-c2-typecheck.log 2>&1` | 0 | Final source/test state: 34/34, 11.51 s, no cache hits. Writable cache removes the warning. |
| `cat packages/tooling/tool/cli/.turbo/package-test-typecheck-result.json` | 0 on both reads | `test-tsgo-package-result/v1`, `@beep/repo-cli`, `exitCode: 0`, `output: ""`; collecting outer command did not hide diagnostics. |
| `bun run beep lint policy-fingerprint --write` | 0 | Written; no tracked diff. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, 0 drifting, 0 written. |
| `bun run beep yeet inbox list --json --unacked` | 0 on both reads | Initial read identified inherited audit row; final read has no unacknowledged entries. |
| `bun run beep yeet inbox ack local-shard-2c38e6923e66 --wontfix --reason "Deferred to Fable: Stage C2 Amendment 3 explicitly assigns package-verify and Node suite to the orchestrator. Capsule records audit exit 1 without diagnostic cause; this lane makes no checkout git writes and does not claim the audit repaired."` | 0 | One explicit scoped-deferral acknowledgement. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification, repeated after final report. |

### Blockers and residual for Stage D

**Stage C2 implementation and its complete Bun fixture suite are complete.**
No synthetic-Git execution blocker remains. Fable retains the unchanged lane
split: rerun the Node root-task suite, `CI=true TMPDIR=/tmp bun run beep quality
package-verify @beep/repo-cli`, `bun run docgen:local`, scoped Node coverage/ratchet,
and commit/publish/hosted verification. The inherited package audit remains
unproved despite its acknowledged inbox state; diagnose its real failing step
when running the orchestrator verification. No merge-ready or whole-proof claim
is made here.

Stage D retains all consumer migration work listed in the Stage C handoff:
D10 plan/aggregate sequencing, `GithubChecks.ts`, `CiLane.ts`, root preflight,
wave notes and artifact-reader handling. Every affected root invocation must
use **bare names**; `//#` remains the registration/dependency/summary/ledger ID
syntax. Preserve D2 unfiltered runs, lane identities, hosted JSDoc sweep behavior,
and fresh inventory before comparison. Stop after Stage C2.

## Stage D

Executed only C3.5 consumer work. Read the brief and Amendments 1–3, the preceding
Stage A–C2 implementation record, and the consumer/D10 contracts. The checkout
was clean at entry. No checkout git writes or graft commands ran. Synthetic Git
writes occurred only inside the existing scoped system-temp root-task fixtures.
No Stage E ledger/economics implementation, publication, commit, or merge ran.
Applied the Effect-first skill. The implementable consumer migration and Bun
verification are finished; the registration/census discrepancies below remain
explicit residuals, not silently weakened checks.

### Decisions and rejected alternatives

1. Replaced the independent policy subprocess fan-out with D10's ordered plan.
   Local: cheap affected tasks; medium affected tasks; unfiltered state/binary
   tasks; bounded affected deprecated APIs; then CLI aggregates. Every affected
   selector is **bare**, including both root residuals, as required by F-A.
   Every policy Turbo invocation has `--continue=dependencies-successful`,
   `--summarize`, the existing cache-plan resolution and secret-session wrapper,
   and the existing four-worker default/Check concurrency overrides. No labs
   exclusion is applied. Scope comes from the caller's base; the planner does
   not read CI or use the supplied compatibility file list to prune checks.
2. Cheap tasks are the known short file-based policy checks plus both generated
   gates. Identity-registry, circular, and effect-imports stay with the medium
   work because the table records 22/18/12 seconds. The state group contains
   semantic-delta, refs-check, jsdoc-module-tags, goals doctor, fresh JSDoc
   inventory, and the uncertified oxlint/typos walkers. Rejected putting oxlint
   into an affected group merely because it is cheap: its row explicitly
   requires unfiltered execution. No D2 or binary-walker cache flag changed.
3. Full/hosted combines medium and state tasks, keeps the root
   `eslint . --max-warnings=0` JSDoc sweep, and uses the deprecated-API shard
   worker when `sweeps.deprecatedApis === "shards"`. Consequently the live
   default produces **two Turbo summaries plus two legacy worker steps**;
   selecting the full Turbo deprecated sweep produces three summaries plus the
   root JSDoc worker. Local policy produces four summaries. Rejected replacing
   the measured hosted programs merely to obtain three literal Turbo processes;
   rulings 30–31 and the Stage C handoff expressly preserve them.
4. Retired `LINT_POLICY_STEP_CONCURRENCY`, `scopedRepoCliStep`, both remaining
   predicates, and the obsolete root-lint fan-out constant. `scopedLawStep` was
   already absent. Root `lint` also runs its aggregate and policy steps in
   order, retaining aggregate failures while running the policy diagnostics.
   Local policy stops after a red cheap phase. Hosted policy collects nonzero
   results through the remaining phases. A failed inventory-containing phase
   suppresses the ratchet comparison; an unrelated failure in that phase also
   suppresses it conservatively rather than risking a stale artifact. Tests
   execute all four combinations of local/full and cheap/inventory-phase red
   in-process and assert the exact scheduled command sequence and retained red.
5. **Live census:** the pre-D policy has 25 labels, not the table's stale 26.
   `lint:tsconfig-overlay` has no Stage C task. Kept that existing CLI check,
   the package-test-typecheck inventory, and the requested test-tsgo aggregate;
   added the fresh-inventory task and the CLI JSDoc comparison. No check from
   the actual 25-label policy was removed. Rejected inventing a 26th historical
   check, dropping overlay coverage, or registering an unreviewed Stage C task.
6. Root `beep:preflight` is now exactly the six requested generators
   (tsconfig-sync, Fallow boundaries write, JSDoc inventory, schema-first write,
   package-scripts write, fingerprint write), followed by local `beep lint policy`.
   This removes the old standalone preflight repo-sanity/Knip/ratchet dispatches;
   test-tsgo and a fresh ratchet now live in policy. Repo Sanity and Knip remain
   in their existing hosted/pre-push consumers. The policy equality proof below
   is **not** a claim that the new preflight includes every former standalone
   preflight lane. No scripts-schema change was needed; the root orchestration
   script is explicitly owned by this stage.
7. GitHub Knip, config-sync, effect-imports, schema-first, allowlist, goals doctor,
   goals index, Fallow audit/dead-code, and boundaries config-check now invoke
   the registered bare task with `--summarize`. The cache arguments use the
   shared cache-plan resolver; local collector posture stays local. Fallow
   audit/dead-code explicitly forward `BEEP_PROOF_BASE=origin/main`, matching
   the existing local CI replay base. Lane IDs/labels and tiers are unchanged.
   There is no remaining standalone cheap tsgo-rules route in this checkout;
   its policy owner now invokes the task. No duplicate lane was introduced.
8. CI Knip and fresh JSDoc inventory use the same registered tasks and existing
   CI cache resolver. JSDoc retains explicit `--inventory` reuse; default
   inventory and comparison execute as a dependency chain, so failed inventory
   cannot trigger comparison through the general collect-all step runner.
   Added an in-process regression proving only the failed inventory task runs.
   Hosted `lint-policy` remains `beep lint policy --full`.
9. **Fallow contract discrepancy:** live CI and the promoted matrix require
   blocking health and `health.check.json`; the task table/Stage C expose only
   `fallow:health:advisory`. Preserved the blocking health CLI worker. Migrated
   audit, dead-code and the four actual advisory consumers to their tasks, with
   the caller base forwarded through `BEEP_PROOF_BASE`. Kept one task invocation
   per sublane, the existing per-sublane status accounting, deferred blocking
   exit, envelope existence/validation, and artifact names. Rejected demoting
   health or collapsing all sublanes into one exit code that loses their status
   rows. Therefore the table's seven-task bundled Fallow command is not claimed
   as implemented; its health census requires Fable's disposition first.
10. The `quality:jsdoc-ratchet:committed` cheap lane remains its distinct CLI
    comparison of committed inventory, an aggregate rather than a registered
    scanner task. Routing it through the full hosted dispatcher would make two
    unchanged IDs run the same command, violating ruling 28. Kept the original
    uniqueness test intact instead of adding an exemption. The hosted/pre-push
    JSDoc scanner is task-backed. No root task for the committed compare exists.
11. Added `taskIds` comments beside the migrated wave seed rows without changing
    their IDs, ordering measurements, schema, or historical provenance. The
    policy note explicitly calls out legacy workers without hashes, and health
    has no task ID. Inspected `Planner.ts`: its Fallow feedback still reads
    `--from .beep/fallow`; no edit was needed because artifact locations remain.
    Rejected Stage E ledger schema/hash ingestion work in this lane.

### Stage D — files

Modified handoff files (every changed source/document path):

- `package.json`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts`
- `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `packages/tooling/tool/cli/test/ci-lane.test.ts`
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/c3-456-implementation.md`

Created/deleted handoff files: none. The fingerprint writer also rewrote
`standards/policy-tools.fingerprint.json` and `turbo.json` byte-identically;
neither has a diff. No workspace package manifest or generated scripts schema changed.
Verification produced ignored dependency build outputs and package `.turbo`
results, including `packages/tooling/tool/cli/.turbo/package-test-typecheck-result.json`.
These outputs must not be staged.

Disposable files under `/tmp/ttc-stage-d/`: `edit.py`, `consumers.py`, `tests.py`,
`fix-tests.py`, `runtime-tests.py`; `typecheck.log`, `typecheck-final.log`,
`typecheck-third.log`, `typecheck-acceptance.log`; `tests.log`, `tests-second.log`,
`tests-final.log`, `tests-acceptance.log`; `eslint.log`, `eslint-final.log`,
`eslint-acceptance.log`; `fingerprint-write.log`, `fingerprint-check.log`,
`scripts-check.log`, `dry-run.json`, `dry-run.stderr`; and `turbo-cache/`.
Scoped synthetic repositories are removed by the test fixture finalizers.

### Before/after check-coverage proof

`quality-tasks.test.ts` pins the **literal** pre-D set of 25 labels:

```text
lint:deprecated-apis       knowledge:semantic-delta  knowledge:refs-check
lint:schema-first          lint:laws                 lint:jsdoc
lint:identity-registry     lint:circular             lint:effect-imports
lint:effect-imports-markdown                         lint:package-test-typecheck
lint:tsconfig-overlay      lint:tsgo-rules           lint:oxlint
lint:ecosystem-polarity     lint:allowlist            lint:jsdoc-module-tags
goals:doctor               goals:index-check         lint:reflection-artifacts
lint:roadmap-refs           lint:judge-rubric         lint:package-scripts
lint:policy-fingerprint    lint:typos
```

For local and full plans the test extracts each Turbo argv's bare task names,
adds the remaining CLI step labels, deduplicates, and requires exact sorted-set
agreement with that historical set after these explicitly enumerated expansions:

| Expansion/addition | Treatment in equality |
| --- | --- |
| `lint:native-runtime:roots` | Residual already covered by the old `lint:laws` label. |
| `lint:jsdoc:root` (local) | Residual already covered by the old `lint:jsdoc` label. |
| `jsdoc:inventory:check` | New fresh-inventory prerequisite. |
| `quality:test-tsgo` | Requested aggregate moved from preflight. |
| `ci:jsdoc-ratchet:ratchet` | Requested comparison moved from preflight. |

Thus **before label set = after policy task set + retained aggregates**, with
residual tasks normalized to their old covering label and the three new checks
listed separately. A second assertion rejects any unexplained new name. Local
has 30 distinct names before normalization, full 29 because full JSDoc remains
one root ESLint label. This is an executable equality, not a count-only test.
The adjacent argv test pins every phase's ordered task list, bare selectors,
no labs filter, caller base, unfiltered state group, explicit sweep selection,
and CLI compare path. The general lane-identity test still requires that no
command runs under multiple lane IDs.

### Verification commands and exit codes

Root cwd unless marked **CLI cwd** (`packages/tooling/tool/cli`). All Vitest,
ESLint and Turbo launchers here use `--bun`; **these are Bun-lane observations**.
The node shim reaches descendants, so no result below independently certifies
Node execution. Fable's Stage B3 Node verdict is prior orchestrator evidence,
not a Node rerun in this stage. Redirected logs are the files listed above.

| Exact command | Exit | Result |
| --- | ---: | --- |
| `bunx --bun biome check --write packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts packages/tooling/tool/cli/src/commands/Ci/CiLane.ts packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts package.json` | 0 | Initial source formatting. |
| `bunx --bun biome check --write packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/ci-lane.test.ts` | 0 | Test formatting. |
| `bunx --bun biome check --write packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/src/commands/Ci/CiLane.ts packages/tooling/tool/cli/test/quality-tasks.test.ts` | 0 | Intermediate formatting after repairs. |
| `bunx --bun biome check --write packages/tooling/tool/cli/test/quality-tasks.test.ts` | 0 | New execution test formatting. |
| `bunx --bun biome check --write packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts packages/tooling/tool/cli/src/commands/Ci/CiLane.ts packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/ci-lane.test.ts package.json` | 0 | Final seven-file pass; import formatting only after acceptance tests. |
| `TURBO_CACHE_DIR=/tmp/ttc-stage-d/turbo-cache bunx --bun turbo run check package-test-typecheck --filter=@beep/repo-cli --cache=local:rw` | 1 initially; 0 on three subsequent runs | Initial introduced missing predicate import/output-row property fixed. First outer-zero rerun still stored two test pipe-style diagnostics; fixed rather than treating outer success as proof. Final 34/34, 32 hits, 10.508 s. |
| `cat packages/tooling/tool/cli/.turbo/package-test-typecheck-result.json` | 0 | Final stored verdict: `exitCode: 0`, `output: ""`; inspected after final typecheck. |
| `bunx --bun eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs packages/tooling/tool/cli/src/commands/Quality/Tasks.ts packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts packages/tooling/tool/cli/src/commands/Ci/CiLane.ts packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts` | 0 on all three runs | Final source has zero diagnostics/warnings. |
| `bunx --bun vitest run test/quality-tasks.test.ts test/ci-lane.test.ts --pool=threads` (**CLI cwd**) | 1 | Initial 12 failures: introduced missing predicate/old argv expectations and the inherited unreadable-inventory `process.chdir()` thread-worker case. Introduced failures repaired. |
| `bunx --bun vitest run test/quality-tasks.test.ts test/ci-lane.test.ts --pool=threads -t '^(?!.*maps an unreadable workspace inventory)'` (**CLI cwd**) | 0 twice | First 269 pass/1 excluded. Final **271 pass/1 excluded**, 10.38 s, including new execution and inventory-failure tests. Complete quality suite; only the named CI cwd case is excluded. |
| `bunx --bun vitest run test/quality-tasks.test.ts test/ci-lane.test.ts test/root-tasks-turbo-inputs.test.ts --pool=threads -t '^(?!.*maps an unreadable workspace inventory)'` (**CLI cwd**) | 0 | 275 pass/1 excluded before the final CI dependency test was added; all five root-task fixtures executed, including F-A, F-B and all 40 production root rows. Together with the final consumer run: 276 distinct passing tests. |
| `bun run beep lint policy-fingerprint --write` | 0 | Written; generated files byte-identical. |
| `bun run beep lint policy-fingerprint --check` | 0 | Current. |
| `bun run beep lint package-scripts --check` | 0 | 142 manifests, zero drift, zero writes. |
| `git --no-optional-locks diff --check` | 0 | Read-only whitespace verification. |

Exact combined full-scope **dry-run** command (exit **0**):

```sh
TURBO_CACHE_DIR=/tmp/ttc-stage-d/turbo-cache bunx --bun turbo run lint:package-scripts lint:policy-fingerprint lint:tsgo-rules lint:ecosystem-polarity lint:allowlist goals:index-check lint:reflection-artifacts lint:roadmap-refs lint:judge-rubric lint:laws lint:native-runtime:roots lint:schema-first lint:identity-registry lint:circular lint:effect-imports lint:effect-imports-markdown lint:jsdoc lint:jsdoc:root knowledge:semantic-delta knowledge:refs-check lint:jsdoc-module-tags goals:doctor lint:oxlint lint:typos jsdoc:inventory:check lint:deprecated-apis knip:check config-sync:check fallow:audit:check fallow:dead-code:check fallow:boundaries:advisory fallow:flags:advisory fallow:security:advisory fallow:fix-preview:advisory fallow:boundaries:config-check --concurrency=4 --continue=dependencies-successful --summarize --cache=local:rw --dry-run=json
```

The dry-run resolves **569 graph nodes, 447 executable commands and 32 root task
IDs**. This deliberately combines selectors to verify registration/resolution;
it is not the runtime D10 scheduling command or a successful checker execution.
The affected-selection proof uses only the synthetic fixture; no checkout
commit was made to enable a live affected experiment. Test output's TS2589
snippets are intentional classifier-fixture text, not failing real dependency
builds. No full policy execution, cold/warm consumer benchmark, hosted result,
package audit, docgen, or Node coverage is claimed from these checks.

### Blockers and precise residual for Stage E / Fable

- No introduced static/type/test failure remains in the lane-owned checks.
  The one excluded CI cwd fixture and Node-runtime validation belong to Fable's
  verification split; `bunx --bun` cannot settle its actual Node behavior.
- The fully task-backed Fallow requirement cannot match the current registered
  task table while retaining blocking health. Fable must authorize/register and
  fixture-prove `fallow:health:check`, or explicitly revise the promotion contract.
  Until then health remains direct and has no task hash. The four existing
  advisory consumers remain advisory; none was promoted/demoted by this lane.
- The unregistered tsconfig-overlay check and committed-inventory JSDoc comparison
  remain direct aggregates. Ruling-28 identity is preserved. The table's bundled
  Fallow invocation and universal three-summary description must be reconciled
  with the live per-sublane accounting and retained hosted sweep exception before
  claiming literal table parity. These discrepancies were recorded in the ledger.
- Fable owns `CI=true TMPDIR=/tmp bun run beep quality package-verify @beep/repo-cli`,
  `bun run docgen:local`, Node suites and scoped coverage/ratchet, the inherited
  audit investigation, commit/publish and hosted checks. Filtered checks above
  do not substitute for those gates. No merge-ready or whole-packet completion
  claim is made.
- Stage E is still only ledger per-attempt task-hash ingestion and economics.
  Account for four local policy summaries, two/three hosted summaries depending
  on the explicit deprecated sweep, non-Turbo legacy/aggregate steps, per-sublane
  Fallow summaries, non-reusable state tasks, failed inventory skips, and the
  retained direct health row. Keep skipped/missing/failed/uncacheable distinct.
  Freshness comes from the attempt's own summaries, never the dry-run output.
  Stage D supplies no new cold/warm checker timings; do not use test/typecheck
  durations as savings or a whole-proof denominator. PLAN, decisions, table,
  lifecycle and publication remain Fable-owned. **Stop after Stage D.**

## Stage D verdict and Stage E (Fable, 2026-09-12; the Codex pool was exhausted until 2026-09-17)

Stage D gates: Node suites green; the live local `beep lint policy` executed the D10 plan end to end
(cheap 9/9, medium 283/283, state 7/8, typed 141/141, 1,208 s wall with the whole fleet affected
because `turbo.json` changed). Three corrections followed, all made by the orchestrator:

1. `lint:oxlint` was the one state red: a real `no-inline-schema-compile` finding in the Stage C
   fixture (`S.is(...)` in a loop), hoisted to module scope.
2. The package handoff failed on tests that pin the check-route argv: the lane had hardcoded
   `ci: false` in `rootTaskLane`, which would also have forced local-only caching on hosted runs;
   the routes now resolve the cache posture from `CI` like every other Turbo lane.
3. The fail-fast policy test could not take its local branch under `CI=true` because the policy
   task called the sticky `isCi()` itself (C3.2 lesson): the `lint policy` command now reads `CI`
   through `Config` and passes the effective scope; the task never reads the environment.
   `lint-workers.test.ts` finds the deprecated-API step by label instead of index.

Stage E (Amendment 4):

- `//#fallow:health:check` registered (script, task row cloned from audit with the health
  artifacts, proof id, fixture rows, CI health consumer on the task, wave note, table revision 8).
- Per-lane Turbo digests: `Quality/internal/TurboLaneDigest.ts` decodes the attempt's own
  `.turbo/runs` summaries (freshness = `execution.startTime` at or after the lane step's start),
  folds the bare-named tasks' hashes into a SHA-256 over sorted `taskId=hash` lines, refuses a digest
  when any folded task failed, and `collectQualityTaskLaneRuns` records it as the lane run's
  `inputDigest`; the verdict carries it and `yeet status` prints a `lane digests:` block.
- `research/c3-456-economics.md` records the pre-merge hosted baseline (recent-runs census; the
  bounded census fails closed on a required-check ruleset drift, receipt recorded) and the local
  cold/warm numbers; the post-merge accounting is owed as a closeout receipt.
- PLAN C3.3–C3.6 ticked; `lint:tsconfig-overlay` and the committed-inventory JSDoc compare stay
  CLI aggregates without a task hash.

Package-handoff rounds on the complete tree (the environment with a live 1Password session, which
no direct run reproduces): the policy tests compare spawned commands through a key that drops the
secret-session prefix, `--cache=` tokens and the CI-only `--force`, compare labels without the
` (op run)` suffix, and ignore session probes; and one runtime defect surfaced and was fixed — the
fresh-inventory guard in `runPolicySteps` compared the resolved label, so under a live session a
failed inventory phase did not suppress the JSDoc ratchet compare (it now records failed planned
labels).

### Hosted round 1 (PR #1102, head 8643596f31)

Yeet's local cheap gates and the hosted lanes agreed on the introduced reds: a changeset for the 34
product workspaces the doctest scripts and vitest configs touch; the cache-policy census overflowing
its 64 MiB capture (bound raised to 512 MiB; receipt); knip's `typos` binary from the new root script
(ignored in `knip.jsonc`); the effect-vitest inventory rows for the new and edited test files; four
fallow complexity findings (the Stage C fixture builder, `runPolicySteps`, the fail-fast test body and
the doctest discovery test — each split into helpers); and `Heavy / Doctest` timing out the first
example of nine files under 4-way contention (doctest `testTimeout` 120 s, `maxWorkers: 2`; receipt).
Environment-only: the openclaw reviewer failed before reviewing (Codex usage limits, not a required
context), `Test Unit (unit-a)` hit the known test-utils watchdog flake, and the goals index and
explorations atlas are git-ignored local projections rewritten in place.
