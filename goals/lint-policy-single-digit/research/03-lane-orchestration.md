# Lint Policy lane orchestration report

## 1. TL;DR

Recommendation, in order:

1. **Do not expect a concurrency-only change to fix today's lane.** An ideal LPT (longest-processing-time-first) schedule built from the 25 measured isolated step times is still **975.2s at concurrency 2, 4, 6, or 8** while `lint:deprecated-apis` remains 975.2s. The observed lane was 1124s, so scheduling alone can recover at most the non-modelled ~149s tail/contention; it cannot make the required suite single-digit minutes. Timing source: `BRIEF.md:8-46`.
2. **After deprecated APIs reaches ~120s, raise the ordinary-step capacity to 4, with resource classes.** The ideal LPT lane falls from **342.2s at c=2 to 197.3s at c=4**; c=6 and c=8 remain 197.3s because `lint:docgen` becomes the long pole. That is a modelled **144.9s (42%) lane saving**. Do not use an unweighted global `concurrency=8` yet.
3. **Move deprecated APIs to a separate required matrix job only for ownership and fast feedback, not critical-path speed.** It lets the other 24 checks report in **197.3s modelled at c=4**, versus waiting 16+ minutes, but merge readiness still waits on the 975s job. Keep the existing `Lint Policy` context name for the core job and add `Deprecated APIs`; atomically add the latter to the ruleset. Splitting without requiring the new context weakens the gate.
4. **Consolidate the 197s metadata check into the already-required Docgen lane, but do not simply delete its contract.** Full/scoped Docgen generation validates descriptions/examples/version, while `docgen check` additionally requires normalized `@category` and inspects re-exports/file overviews. Make the Docgen lane run the same metadata analyzer on its selected packages (or teach generation's checker the missing category rules), then remove `lint:docgen` from Lint Policy. With deprecated APIs separate and docgen removed, the remaining core LPT is **92.3s at c=4**, **78.1s at c=6/8**.
5. **Batch pure-TypeScript policy effects in-process as a second-stage optimization.** One local `bun run beep --help` cold boot measured **1.79s elapsed, 2.53s user, 651,728 KiB max RSS**. Twenty-two of 25 policy steps re-enter `bun run beep`, so a rough ceiling is **~39s** of repeated CLI wall overhead (not 25 × 1.79s, because ESLint/typos/oxlint are direct `bunx` steps and concurrent boots overlap). This is material for 3–5s checks, but secondary to deprecated APIs and docgen.

### LPT model

Model: sort measured durations descending and repeatedly assign the next task to the least-loaded worker. Durations are treated as invariant; process startup is already inside each measured step. This is an optimistic scheduling bound and does **not** model CPU/I/O contention, memory pressure, the current FIFO order, or the ~149s gap between the 975s ideal bound and observed 1124s lane.

| deprecated-apis assumption | c=2 | c=4 | c=6 | c=8 |
|---|---:|---:|---:|---:|
| current 975.199s | 975.199s | 975.199s | 975.199s | 975.199s |
| improved 120s | 342.245s | 197.298s | 197.298s | 197.298s |

For context, adding the measured ~66s job setup gives optimistic job walls of ~17m21s with the current long pole, ~6m48s at improved/c=2, and ~4m23s at improved/c>=4. Those are projections, not SLA claims.

## 2. Evidence

### Orchestrator and scheduling

- Lint Policy's cap is a constant `2`; its comment describes constrained-runner overlap, while the nearby Turbo comment already recognizes the heavy fleet. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:105-124`.
- `runStepGroup` resolves all steps, then calls `Effect.forEach(..., { concurrency })`; it preserves array order, so today's launcher is bounded FIFO, not LPT. It times and buffers each child result. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1138-1163`.
- The 25-entry array puts deprecated APIs 19th and docgen 22nd, so both long jobs start late under FIFO. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1470-1511`.
- The hosted lane is one `bun run beep lint policy` child. `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:885-888`. CI runs `lint-policy` without affected/shape flags. `.github/workflows/check.yml:215-231`.
- The matrix assigns Lint Policy to `beep-ec2-heavy`. `.github/workflows/check.yml:63-68`. Fleet candidates are 64 GiB r7a/r7i/r6i or m7a instances. `infra/src/CiFleetController.ts:30-35`.

### Resource conflicts

- Deprecated APIs runs 24 shards sequentially, spawning ESLint once per shard with an **8 GiB V8 heap ceiling**. `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:46-74,461-503`.
- Its typed parser uses TypeScript project service plus a root default project and permits up to 160 default-project files, making it the clearest CPU/RSS-heavy step. `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:90-132`.
- `lint:docgen` analyzes packages four at a time by default. `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:221-225,582-606`. Each package constructs a ts-morph `Project` and loads source files. `packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocAnalysis.ts:528-547`.
- Several law/lint steps also construct repo-scale ts-morph projects: effect imports, terse effect, native runtime, identity registry, and package-test imports. `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:117-140`; `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:579-594`; `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:565-586`; `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:206`; `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:300`.
- Semantic delta materializes and extracts both base and head Git archives, so it is disk/I/O heavy even though it is not a TypeScript project-service consumer. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1092-1127`.
- Therefore use a **weighted/resource-class scheduler**, not just a counting semaphore: `typed-heavy` capacity 1 (deprecated APIs or docgen), `ast-heavy` capacity 2, total process capacity 4. On a verified 16-vCPU m7a runner, total capacity may rise independently, but keep typed-heavy at 1 until hosted RSS/CPU telemetry proves overlap safe.

### Matrix split and required checks

- Workflow check names come from `matrix.name`; the current entries are `Lint Policy` and `Docgen`. `.github/workflows/check.yml:47-56,63-68,105-110`.
- The CLI's check registry marks both contexts required: Lint Policy at `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:349-355`, Docgen at `:398-404`. Live GitHub ruleset lookup was unavailable in this read-only session, so the repository registry is evidence of intent, not proof of current server configuration.
- Safe migration: preserve the core job's name `Lint Policy`; introduce `Deprecated APIs`; add the new context to the GitHub ruleset in the same rollout. If instead the old context is renamed, the old required context can remain permanently expected. A new matrix job also incurs its own ~66s setup and another heavy-runner allocation.

### Docgen overlap: partial, not exact redundancy

- PR Docgen is affected by default, skipped for irrelevant changes, and escalated to full for tool/global inputs. `.github/workflows/check.yml:145-169`. Its lane runs `docgen:local --parallel=3` when affected and root `docgen` when full. `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:670-683`.
- Root `docgen` runs Turbo package generation and aggregation. `package.json:386-389`. Generation parses modules, checks them, validates/runs examples, writes Markdown, and emits proof manifests. `packages/tooling/tool/docgen/src/Core.ts:768-801`.
- Generation's checker enforces configured descriptions, examples, and `@since`. `packages/tooling/tool/docgen/src/Checker.ts:43-74,312-359`.
- The Lint Policy check is broader/different: it resolves every configured package, verifies current manifests, and analyzes stale/missing targets at package concurrency 4. `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:582-607`; `packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts:78-86,189-199`.
- Its analyzer always requires `@category`, conditionally requires example/version tags, normalizes category values, and separately inspects re-exports and module file overviews. `packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocAnalysis.ts:28-29,104-119,276-349,351-400`.
- A proof-manifest hit is not free: verification re-fingerprints inputs and outputs. `packages/tooling/tool/docgen/src/ProofManifest.ts:503-578`. The separate affected lane already verifies selected manifests and falls back to metadata analysis before generation. `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:626-660,687-716`.
- Conclusion: **partially redundant execution, non-identical policy**. Moving the analyzer into the required Docgen lane preserves ownership and avoids a second repo-wide pass; dropping it outright risks losing category/re-export/file-overview enforcement.

### CLI boot and in-process feasibility

- All 22 repo-CLI policy entries become `bun run beep ...`; only jsdoc, typos, and oxlint are direct `bunx` children. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1192-1209,1470-1511`.
- The lightweight bin still imports `bin-main`; lint subcommands deliberately bypass the quality-task fast path, then load the full root command tree and derived services. `packages/tooling/tool/cli/src/bin.ts:46-47`; `packages/tooling/tool/cli/src/bin-main.ts:75-89,219-235`; `packages/tooling/tool/cli/src/commands/Root.ts:63-95`.
- In-process execution is feasible for pure TS checks because many handlers are already exported Effects (examples: law runners and schema-first), while external tools must remain children. `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:117`; `packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts:393`; `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:461-491`.
- It is not a mechanical argv shortcut: some surfaces export only `Command` values, handlers have distinct option/service requirements, and subprocess isolation currently provides independent exit codes, buffered output, heap reclamation, and failure aggregation.

## 3. Implementation sketch

1. Add `weight`/`resourceClass` and optional in-process `run` to `QualityTaskStep` (or a lint-policy-specific step schema). Sort ready policy steps by estimated duration before launch. Configure total capacity 4, `typed-heavy=1`, `ast-heavy=2`; classify deprecated APIs/docgen as typed-heavy and semantic delta as I/O-heavy.
2. Add schedule tests using the measured fixture: assert c=2/4/6/8 makespans and assert typed-heavy steps never overlap. Emit start/end/RSS (where available) so weights can be tuned from hosted evidence.
3. Split `rootRepoLintPolicySteps` into `coreLintPolicySteps` and `deprecatedApiSteps`. Add a CI lane descriptor/runner for `deprecated-apis`; add a matrix entry named `Deprecated APIs`; leave the core context named `Lint Policy`.
4. Update the GitHub ruleset atomically to require both contexts. Verify PR check-runs and the repository's CI-lane registry agree before deleting deprecated APIs from core.
5. Move `docgen check` semantics into the Docgen lane: for affected PRs analyze exactly the Turbo-expanded packages when manifests are stale; for full mode analyze all configured packages. Ensure category normalization, re-export, and file-overview cases remain covered. Then delete only the `lint:docgen` policy step.
6. Introduce direct policy adapters around exported Effect handlers. Start with sub-10s pure checks, compare results/output against subprocess invocations, then migrate AST-heavy handlers. Keep ESLint, oxlint, typos, madge, Git, Turbo, and any handler needing process-level heap isolation as children.
7. Separately fix changed-scope law planning so an empty TypeScript subset skips the law step instead of producing `--include ""`; the current builder unconditionally appends it when `files` is defined. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1455-1468`.

## 4. Risks / correctness tradeoffs

- LPT assumes durations remain stable. More parallelism can lengthen every AST/type-aware job through CPU, page-cache, and GC contention; c=8 has no modelled benefit once docgen is the pole.
- A weighted scheduler is warranted now because the code proves qualitatively different resource profiles, but exact weights need hosted peak-RSS/CPU data. Avoid pretending the 8 GiB heap cap equals actual RSS.
- Matrix splitting improves time-to-signal but can increase fleet queueing, setup cost, and total compute. It does not shorten the required critical path until deprecated APIs itself is fixed.
- Affected Docgen cannot replace a full-state metadata gate unless target expansion and global-input escalation are proven complete. Keep full mode on push and tooling/global changes.
- In-process batching shares globals (`process.cwd`, environment, module caches), memory, and cancellation. Require handlers to accept explicit context/options; serialize any mutating-global handler; preserve deterministic per-step output and aggregate failures.
- Current worktree has unrelated modified files; none were touched. This investigation wrote only this report.

## 5. Open questions

1. What are hosted peak RSS, CPU utilization, and per-shard times for deprecated APIs, docgen, schema-first, and the law scans? These decide whether `typed-heavy=1` is conservative or necessary.
2. Is `beep-ec2-heavy` pinned per job to 8 vCPU or may it land on 16-vCPU m7a? The source lists a heterogeneous pool, so scheduling should detect capacity or target the 8-vCPU floor.
3. What contexts are actually required by GitHub ruleset 10240248 today? Live API verification failed due unavailable network; verify before changing matrix names.
4. Should deprecated APIs remain full-state on every PR, become affected plus a full push/nightly gate, or use a flat source-mode project? That correctness decision dominates its own 975s runtime but is outside this orchestration-only report.
5. Can the Docgen generation checker become the single source of metadata truth, including normalized categories and re-export/file-overview semantics, so proof-manifest generation certifies the exact policy now rechecked separately?
