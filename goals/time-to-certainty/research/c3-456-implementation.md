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
