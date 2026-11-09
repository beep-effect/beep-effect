# Area H — dependencies, install, toolchain

## Verdict

Prioritize **L1 scoped-install qualification**, **L2 native lifecycle containment**, and **L4 root tool ownership/hash isolation**. These are experiments with explicit admission gates, not ready-to-land savings claims. Fix **L5 attribution first as a measurement prerequisite**, although it saves no execution time. Do not move short jobs to EC2 merely on the install-speed comparison, delete a compiler pass merely because it includes src, or rebake an AMI expecting it to eliminate dependency installation.

The two green runs below spend 53.22 and 56.65 runner-minutes in the measured setup envelope. Most of that is on GitHub-hosted jobs. This is a meaningful compute opportunity, but setup removal alone cannot meet push-to-all-required-green p95 <10 minutes. Queueing and the remaining long bodies require the other audit areas. Assume #3005, #3007 and #3014 merged for planning; none of their partitioning/input changes is proposed here. The historical samples expose different partition layouts, not the eventual combined baseline.

Read-only audit on 2026-11-09. Read the brief first and the requested inventory/compact/map sections; did not inspect the separate Opus phase-2 output. No installs, task executions, proofs, repository edits, worktrees or Git writes. The observed local main ref at the end was `16370d15737f2daddc10e43c4d00a42e09648ed6`, newer than the inventory's `7a31078ddd3`; runtime/source assertions are distinguished from the frozen hosted heads. Paths are repository-relative unless prefixed `~`.

## Measured this pass

### Sources and method

- A: [Check 42637312401](https://github.com/beep-effect/beep-effect/actions/runs/42637312401), attempt 1, success, head `9f30182f4a856d3e90e14f4f98fa3e338020a973`, created 14:42:32Z, updated 15:22:44Z on November 9. 56 executed jobs; 28 Unit shards, no hosted Integration partitions.
- B: [Check 42656046751](https://github.com/beep-effect/beep-effect/actions/runs/42656046751), attempt 1, success, head `cb81d3467e9bd826a3d14baa55750db20a1a20b0`, created 16:33:53Z, updated 17:14:02Z. 59 executed jobs; 13 Unit shards plus 17 hosted Integration partitions. The legacy heavy integration body also ran: do not carry that duplication into the assumed-merged forecast.
- Commands: `gh api repos/beep-effect/beep-effect/actions/runs/<id>/jobs?per_page=100`, run metadata endpoint, and `/logs --allow-escape-sequences`. Parsed both ZIP archives in memory, matched every executed job's top-level log (56/56, 59/59), and retained only sanitized derived measurements in `astra-deps-measurements.json` beside this report. Raw logs were not persisted. Job IDs and matched archive member names in that artifact make the table reproducible.
- Setup = sum of successful **forward** checkout, monorepo setup, explicit Node/Bun setup, dependency install and matching native-tool setup steps. Post-job cleanup is excluded. Composite setup includes its lifecycle scripts. It excludes runner queue/boot before the job starts, action download, and unrelated setup outside these named steps; thus this is a reproducible setup envelope, not every second of infrastructure overhead. Wall = job completed_at minus started_at. Percent = summed setup / summed job wall, not mean of per-job percentages. All durations below are seconds, rounded by GitHub's step timestamps. Install-only values come from actual Bun `2336 packages installed [Xs]` log lines, not the enclosing composite duration.
- A preliminary candidate, run 42646019844, returned only the latest rerun's integration log archive. Replaced it with A rather than mixing latest-attempt logs with retained prior-attempt jobs. It is excluded from the measurement artifact and estimates.

### Setup share by job class

Table cells are **job count; setup / wall seconds; share**. Missing means not present in that layout.

| Job class | A | B |
|---|---:|---:|
| Commitlint | 1; 26/33; 78.8% | 1; 24/35; 68.6% |
| Secret Scanning | 1; 20/29; 69.0% | 1; 21/28; 75.0% |
| SAST | 1; 44/93; 47.3% | 1; 39/89; 43.8% |
| Security | 1; 34/61; 55.7% | 1; 45/85; 52.9% |
| PR Size Label | 1; 71/78; 91.0% | 1; 49/56; 87.5% |
| Change Profile | 1; 4/8; 50.0% | 1; 4/9; 44.4% |
| Nix Shell | 1; 76/104; 73.1% | 1; 60/88; 68.2% |
| Property Laws | 1; 88/1084; 8.1% | 1; 69/880; 7.8% |
| Professional Desktop IPC Stdio | 1; 102/154; 66.2% | 1; 86/144; 59.7% |
| Shadcn Lint | 1; 64/79; 81.0% | 1; 59/79; 74.7% |
| Ecosystem Contracts | 1; 58/85; 68.2% | 1; 68/86; 79.1% |
| Labs | 1; 60/128; 46.9% | 1; 76/165; 46.1% |
| Repo Sanity | 1; 58/176; 33.0% | 1; 74/170; 43.5% |
| Codegen Drift | 1; 17/22; 77.3% | 1; 57/74; 77.0% |
| Fallow Advisory Envelopes | 1; 54/178; 30.3% | 1; 77/180; 42.8% |
| Lint shards | 2; 162/206; 78.6% | 2; 122/184; 66.3% |
| JSDoc Ratchet | 1; 50/365; 13.7% | 1; 53/378; 14.0% |
| Heavy Admission | 1; 55/64; 85.9% | 1; 67/77; 87.0% |
| Test Integration partitions | — | 17; 1196/6755; 17.7% |
| Test Unit shards | 28; 1871/12133; 15.4% | 13; 873/9757; 8.9% |
| Heavy / Lint Policy | 1; 39/725; 5.4% | 1; 38/725; 5.2% |
| Heavy / Check | 1; 37/84; 44.0% | 1; 39/77; 50.6% |
| Heavy / Test Integration | 1; 37/2313; 1.6% | 1; 39/2163; 1.8% |
| Heavy / Build | 1; 41/93; 44.1% | 1; 40/68; 58.8% |
| Heavy / Docgen | 1; 40/148; 27.0% | 1; 40/149; 26.8% |
| Heavy / Doctest | 1; 38/154; 24.7% | 1; 38/104; 36.5% |
| Lint | 1; 0/4; 0.0% | 1; 0/3; 0.0% |
| Test Integration Partitions | — | 1; 0/4; 0.0% |
| Test Unit | 1; 0/3; 0.0% | 1; 0/4; 0.0% |
| Heavy / Coverage Regression | 1; 47/314; 15.0% | 1; 46/308; 14.9% |

| Runner class | A setup / wall min | B setup / wall min |
|---|---:|---:|
| ubuntu-24.04 | 49.35/256.68 (19.2%) | 52.75/327.30 (16.1%) |
| beep-ec2-heavy | 3.87/58.62 (6.6%) | 3.90/54.77 (7.1%) |

Full executed-job wall sums: **315.30 runner-min A, 382.07 runner-min B**. These are neither CPU-minutes nor billed-dollar equivalents across runner types. Two successes do not establish a latency p95 or a causal before/after comparison.

A install-only: ubuntu-24.04: n=44, median 38.34s, range 14.86–61.76s; beep-ec2-heavy: n=6, median 9.48s, range 9.24–9.75s; 

B install-only: ubuntu-24.04: n=47, median 40.35s, range 22.05–54.49s; beep-ec2-heavy: n=6, median 9.50s, range 9.04–9.66s; 

One ssh2 warning across 115 executed-job logs: A / Test Unit (repo-cli-3), install 61.76s, `ssh2's postinstall cost you 31s`. No such warning in B. Absence of the warning does not prove absence of native compilation; Bun's warning threshold and concurrency obscure attribution. The 31s is a script duration, not demonstrated marginal install wall saved. B / Lint (lint-a), job 129294909701, separately fetched through `gh api .../actions/jobs/129294909701/logs --allow-escape-sequences`, confirms root postinstall at 16:35:14.467Z, prepare at 16:35:15.981Z and install completion at 16:35:17.741Z. That is about 3.27s from root postinstall start to completion, within its 28.48s install. `Blocked 1 postinstall` remains unidentified; it is not evidence that ssh2 was blocked.

### Local economics and graph observations

`bun run beep yeet economics --json`: 476 attempts, publish 188, verify 157, August 8–November 9 (~93.24 days); about 14.1 publishes and 11.8 verifies/week in this checkout. `bun run beep yeet economics --fleet --json`: **2,579 finished attempts**, publish 1,210, verify 724, August 4–November 9 (~97.10 days), approximately **87.2 publishes and 52.2 verifies/week**. The inventory's 2,596 is a different snapshot/population; do not silently substitute it. Fleet install executions: 411 publish (409 passed, 2 failed), 366 prepare (365 passed, 1 failed), 61 early-publish (all passed): **835/838 passed**, versus 181 first-red attributions to the preflight. Fleet lock-bounce proxy count remains 187. This pass confirms the code defect and inconsistent populations, but did not reconstruct all 181 individual verdicts; the inventory's exact 182-row join is not claimed as a fresh measurement.

`bunx turbo run check --dry-run=json --filter=@beep/repo-utils` selects 21 tasks including that package's build and check; the check's dependency list is `^build` products, not its own build. Global external-dependency hash `5ddaf41aa515ace0`, own external hash `d77089f72c1a84aa`. The existence of separate hashes does not prove which synthetic bump preserves unaffected tasks. No manifest mutation or task execution performed. Dry-run `globalCacheInputs.files` showed only `.gitattributes`, despite the source's future-flag `global.inputs` declaration; do not infer a complete invalidation contract from that field alone.

### Ranking denominator and uncertainty

`gh run list --workflow check.yml --event pull_request --limit 100 --json databaseId,createdAt,conclusion,headSha,displayTitle`: 79 starts November 9 and 21 November 8; oldest November 8 16:49:31Z, newest November 9 16:33:53Z. This is a truncated, high-activity **23.739-hour** window, roughly **101.1 starts/day or 707.7/week at that burst rate**, not a measured normal week. Cancelled and docs-only runs are included; they do not necessarily pay a complete install matrix.

Ranking uses `(707.7 × f × hosted saving + 87.2 × publish saving + 52.2 × verify saving) / risk weight`, with low=1, medium=2 or 3, high=4. **f is the unmeasured fraction of these starts that execute the eligible full code-job population.** The table deliberately gives f=1 opportunity scores, not realized weekly forecasts. For f=0.5 halve only the hosted term. Local fleet counts already include this checkout: do not add its counts again. Midpoint savings below are explicit planning guesses bounded by measured setup; confidence and gates matter more than the apparent precision. No CPU seconds were measured, and runner wall is not substituted for CPU.

| Rank | Lever | Hosted min/eligible PR run | Local publish / verify min | Risk weight | Opportunity min/week / risk at f=1 |
|---|---|---:|---:|---:|---:|
| 1 | L1 scoped install | 8 | 0 / 0 | 3 | 1,887 |
| 2 | L2 native lifecycle containment | 3 | 0.05 / 0.05 | 2 | 1,065 |
| 3 | L4 root tool/hash isolation | 2 | 0.2 / 0.3 | 3 | 483 |
| 4 | L3 short EC2 lanes | 2.5 | 0 / 0 | 4 | 442 |
| 5 | L8 optional payload ownership | 0.5 | 0 / 0 | 3 | 118 |
| 6 | L6 compiler pass consolidation | 0.3 | 0 / 0.1 | 3 | 73 |
| 7= | L7 retire dead optimization path | 0 | 0 / 0 | 1 | 0 |
| 7= | L5 correct attribution | 0 | 0 / 0 | 1 | 0 |

These are standalone opportunities, **not additive**. L1 may remove the packages targeted by L2/L8; L3 accelerates the same install seconds; L4 changes which jobs incur cold work. L4's frequency assumption is particularly weak and could move it below L3. L5 precedes optimization work operationally despite ranking last for direct minutes. The JSON's hosted values mean eligible full code-run scenarios, not unconditional means over all 100 starts.

## Ranked levers

### 1. H-L1 — Qualify scoped frozen installation on the hoisted linker

- **Area / mechanism / files:** H. Add an opt-in explicit workspace closure input to `.github/actions/setup-monorepo-ci/action.yml`, then pass it only from qualified package-scoped jobs in `.github/workflows/check.yml`. Keep `bun install --frozen-lockfile`, the pinned Bun, patches, overrides, strict peers and current retry semantics. Use repeated `--filter <workspace>` arguments generated from an audited closure, never interpolate untrusted package names into a shell command. A single package is an initial experiment, not automatically a sufficient install closure.
- **Grain:** affected-set: scheduled packages plus build/runtime dependencies, test helpers, CLI dispatch, root tooling and lifecycle consumers. File grain cannot safely define install resolution. Unknown/global selectors fall back to full installation. Do not change test or coverage selection.
- **Hoisted parity experiment:** use fresh disposable hosted jobs at the same immutable SHA, same runner OS/arch, Bun/Node pins and empty dependency cache. Randomize full/scoped order for at least five paired rounds on one lint shard and one Unit shard, including a small package and a large helper closure. Keep remote-cache state equal (initially disabled for proof-body comparisons) and record queue separately. A full install control remains authoritative during shadow. No such installs were run in this audit.
- **Root lifecycle requirements:** `package.json:385,401–402` requires `lefthook install`, `infra:prepare-gha-runners` with `infra/node_modules/@pulumi/gharunners/scripts/build.js` and infra's TypeScript, and `effect-tsgo unpatch --tsrs`, the CLI's backup-pruner and `effect-tsgo patch --tsrs`. Include `@beep/root`, infra and the exact CLI/toolchain closure in the first candidate; explicitly measure whether doing so destroys the savings. Observe whether Bun actually selects/runs root lifecycle scripts under the hoisted filtered install: help text support is not parity. Assert patched tsrs identity, Go compiler identity, infra generated output and required binary locations. Do not use `--ignore-scripts` to make the candidate green. If root inclusion forces almost the full graph, stop this slice and split lifecycle ownership in a separately qualified PR.
- **Parity ledger / negative controls:** compare frozen-lock byte identity, resolved package versions and realpaths at each selected consumer, peer resolution, patched file digests, runtime imports, emitted artifacts, compiler/Effect diagnostics and identical lint/test census and fresh coverage counters. Include manifest addition/removal, catalog/override/patch changes, undeclared dependency import, conflicting transitive versions, stale node_modules, missing native binary and malformed lockfile. A candidate that fails where full succeeds is not deployable; one that succeeds where full correctly fails is a trust failure. The hoisted layout may change even if versions match. Preserve full-install validation on main and head-install preflight until separately proven.
- **Savings:** hosted **0–16 min**, planning **8 min** = 20 eligible installations × 24s; critical path **0–0.4 min** for a single affected final-path install (queue effects excluded); local publish/verify **0/0** in this hosted-only slice. Basis **guess**, supported by the measured 15–62s full installs and 53–57m setup ceiling. No CPU estimate. Root closure may make savings zero.
- **Trust:** medium-high (weight 3): changed hoisting, absent lifecycle patches, phantom dependencies or a different peer tree could yield a false green. Mitigation is the parity ledger above, conservative fallback and full control. **Admission gate:** parity ledger plus route replay/mutation fixtures for the closure selection; any task-cache changes additionally require cache qualification.
- **Prior art / dependencies:** no dependency archive (already rejected); frozen full install/retry and head receipts already shipped. Depend on the settled #3005/#3007 matrix and #3014 inputs, plus lane-plan ownership in routing. Root tooling isolation L4 may improve the candidate, but is not silently bundled.
- **PR slices:** M, “Record install closure and parity receipts,” setup action + CI plan/test fixtures; M, “Enable scoped installs for qualified lint jobs,” action and check workflow; separate M Unit rollout only after coverage and runtime parity. **Confidence:** medium opportunity, low savings estimate. **Open:** actual Bun hoisted-filter semantics, minimum lifecycle closure, and which blocked script is present.

### 2. H-L2 — Contain ssh2 and cpu-features lifecycle work

- **Area / mechanism / files:** H. Audit lifecycle trust and dependency ownership in `package.json`, `bun.lock`, `packages/tooling/test-kit/test-utils/package.json`, setup action, and downstream integration consumers. The live chain is test-utils → testcontainers → Docker libraries → docker-modem → ssh2; another lockfile path is ssh-remote-port-forward. Removing only one direct dependency is insufficient. Prefer excluding that closure from non-consumers under L1. Otherwise experimentally qualify a narrow, versioned lifecycle trust policy retaining every other required installer; first verify Bun 1.4.4's effective default trust semantics. Do not invent an unsupported environment switch or replace default trust with an incomplete allowlist.
- **Grain:** package dependency closure. Native work remains enabled where its behavior/performance is required; identical source and lock remain installed when testing a pure-JS fallback.
- **Savings:** hosted **0–8m**, planning **3m** = an unproven mean marginal 4s across 45 installs; critical **0–0.1m** central, isolated tail potentially 0.52m if fully serial; local publish/verify **0.05/0.05m**, guesses. Observed warning is only one 31s script across two runs, not 31s/job. All savings basis **guess** pending A/B lifecycle timings, CPU unmeasured.
- **Trust:** medium (weight 2). Native-free runtime might fail SSH encryption/handshake, select a different cipher or slow integration despite an install success. `node_modules/ssh2/install.js` explicitly treats the crypto build as optional unless `CI_CHECK_FAIL=ssh2`; `lib/protocol/crypto.js:24–32` catches unavailable native binding; `constants.js` similarly tolerates missing cpu-features. This is source evidence for fallback, not end-to-end qualification. Keep root prepare and other binary installers intact.
- **Admission:** A/B controls and parity ledger: native and fallback SSH connection/cipher tests, local Docker tests, supported Docker-over-SSH path, fail/retry behavior, patch identity and complete selected integration census. Measure total install wall and CPU with overlapping lifecycle tasks, not sum of individual script durations.
- **Prior art / dependencies:** keytar removal and install retries already exist; no blanket script suppression is admitted. Overlaps L1/L8, coordinate #3005 consumers. **Slices:** S diagnostic installer timing/trust census; M narrow policy + regression fixtures + CI control. **Confidence:** medium fallback feasibility, low aggregate savings. **Open:** whether cpu-features ran in these jobs, identity of blocked installer, and exact SSH consumers.

### 3. H-L4 — Isolate root tool dependencies with complete Turbo invalidation

- **Area / mechanism / files:** H with Turbo seat ownership. Move genuinely tool-only root dependencies to their existing owning tooling workspaces, update entrypoints and generated manifest bindings, and qualify affected external hashes. Files: root/package workspace manifests, `bun.lock`, `turbo.json`, `standards/root-package.projection.generated.json`, `packages/tooling/library/repo-cli-kit/src/package-scripts/*`. Bootstrap a new workspace only through `beep create-package` if no owner exists; search existing owners first. Do not simply delete global hash inputs.
- **Grain:** package or affected-set consumers of a tool, with whole-repo invalidation retained for shared compiler/Effect/config changes. A catalog entry alone is not an installed root dependency; root devDependencies are the relevant ownership edge.
- **Savings:** hosted planning **2m/run**, local **0.2m/publish, 0.3m/verify**, critical **0–0.5m/run**. Basis **guess**: scenario 5% tool-only invalidations × 40 avoidable runner-min each. The inventory's 71 lockfile commits is not a count of 71 tool-only bumps; no causal hash experiment ran. CPU unknown. Warm non-tool changes may save zero.
- **Trust:** medium-high (weight 3): compiler, lint plugin, shared setup or root executable changes could cease to invalidate a consumer and serve stale green. Require explicit tool edges/seals, runtime imports, identity tests and conservative shared-tool invalidation. Hoisting must not be the untracked mechanism that supplies the executable.
- **Admission:** cache qualification and before/after dry-run hash matrix with negative probes: owner-only tool bump, shared Effect bump, lockfile-only resolution change, root script/config change, transitive dependency mutation. Verify outputs and fresh failure detection on every consumer class. Existing lock-change `TURBO_FORCE` remains unless separately qualified; if it stays blanket, much of the same-PR benefit is blocked. Quantify later warm-run benefit separately.
- **Prior art / dependencies:** #3014 already narrows lint inputs; do not repeat it. Root seals/projection and cache trust work already shipped. Coordinate one PR with Turbo T3/T9 ownership; L1 and L8 benefit but cannot each claim the same minutes. **Slices:** S dependency/tool census; M move one tool owner and qualify; M expand proven pattern. **Confidence:** medium mechanism, low savings. **Open:** actual tool-only event frequency and how much forced lock replay remains.

### 4. H-L3 — Trial short jobs on existing owned EC2 capacity

- **Area / mechanism / files:** H. Consider five setup-heavy non-Unit lanes only after a controlled trial in `.github/workflows/check.yml`, permitted reusable workflows and `infra/ci-runners` configuration. Preserve exact contexts and workflow allowlists. Do not move Test Unit onto the heavy pool (explicitly rejected), enlarge capacity or add another scheduler.
- **Grain:** package/affected-set jobs as presently defined. Only runner placement changes.
- **Savings:** hosted runner-wall **0–4m**, planning **2.5m** = five installs ×30s; critical path **−queue regression to +0.5m saved**, central credited **0**. Local **0/0**. Basis **guess** extrapolating observed ~9–10s EC2 installs versus ~15–62s GitHub installs; different workloads/hosts are not an A/B. Boot and existing heavy queue can consume the entire gain. No dollar or CPU saving asserted; owned minutes and hosted minutes have different costs.
- **Trust:** high (weight 4), not the inventory's “low.” `goals/runner-trust-boundary/history/reflections/2026-11-02-claude.md` says no usable ambient instance-role credentials were re-proven, but a stolen JIT configuration remained replayable after SIGKILL until original job completion. A 12-minute accepted replay received no job; the operator accepted that bounded residual. More admitted workflows expand exposure and must retain that exact boundary, ephemeral teardown, main-pinned workflow restrictions, workload identity, fork handling and PR read-only caches.
- **Admission:** controlled A/B at existing capacity, queue-inclusive required-context p95 and total runner wall, plus runner trust regression probes/allowlist checks. Confirm replay acceptance using “Listening for Jobs,” org runner roster, orderly/SIGKILL/VM-loss cases. Run job body parity. Reject if displaced heavy work worsens the objective.
- **Prior art / dependencies:** runner-trust-boundary completed-retained #2618; Test Unit placement rejected; #3005 frees a long heavy body only once actually deployed. **Slices:** S measurement/placement feasibility; M one-lane permitted workflow pilot; S rollout if queue/trust gates hold. **Confidence:** medium install gap, low end-to-end win. **Open:** spare capacity, launch latency, effective runner-group allowlist and marginal cost; new spending is operator-only.

### 5. H-L8 — Remove unused optional native payloads by ownership

- **Area / mechanism / files:** H. Audit fresh installed package/byte census, then remove excluded workspace closures through L1 or move scratchpad-only imports to their true owner. Sources: `scratchpad/package.json`, root catalog/devDependencies, `bun.lock`, platform package metadata, setup action. Verify glibc/musl and OS/arch selection before claiming DuckDB bytes.
- **Grain:** package/affected-set runtime closure. Do not use repo-wide `--omit=optional`: tsrs/@tsrs platform executables, esbuild/workerd and other required implementations may be optional packaging dependencies.
- **Savings:** hosted **0–1.5m**, planning **0.5m** = 15 installs ×2s; critical **0–0.05m**, local **0/0** for hosted-only slice; **guess**. Inventory sizes (92MB onnxruntime, 87MB musl DuckDB, 143MB workerd) are local footprints, not measured fresh hosted transfer or removable payloads. CPU unknown.
- **Trust:** medium-high (weight 3): missing native backend silently falls back, skips tests, or changes runtime behavior. Keep explicit backend identity/import assertions and full consumer tests for each retained platform.
- **Admission:** paired fresh-install census and runtime parity ledger, binary-load/absence negative fixtures, OS/libc matrix; preserve compiler canaries and fresh coverage producer census.
- **Prior art / dependencies:** broad archive caching rejected; root `@xenova/transformers` occurrence is **catalog only**, while scratchpad declares the dependency. L1 likely captures much of this benefit already; L4 ownership work should be shared. **Slices:** S fresh payload receipt; M one proven unused closure removal; no blanket optional flag. **Confidence:** low. **Open:** actual installed musl artifacts and whether any selected lane truly needs ONNX/workerd.

### 6. H-L6 — Consolidate only diagnostics-equivalent compiler passes

- **Area / mechanism / files:** H. Qualify a generated library template variant using existing package script policy, overlay generators and Turbo outputs. Inspect `packages/tooling/library/repo-utils/{package.json,tsconfig.json,tsconfig.check.json,tsconfig.test.json}`, `PackageScripts.schemas.ts`, and `docs/runbooks/typescript-toolchain.md`. Do not hand-edit generated package scripts.
- **Grain:** package plus referenced dependency products. Preserve an own-source check when build is absent or restored from an inadmissible cache. `check` depends on `^build`, not universally its own build; “build already checked src” is not guaranteed. Test overlays include src but differ in types (`bun-types` vs `bun`), rootDir, fixtures, composite and declaration settings. The three scopes are not interchangeable.
- **Savings:** hosted planning **0.3m/run**, critical **0–0.1m**, local publish **0**, verify **0.1m**, all **guess**. Historical runbook's 181 source-check projects totaled 21.3s serial under an older compiler; it does not support minutes saved on every job. Current Heavy Check is 77–84s including 37–39s setup and cache-dependent dependency builds. CPU unmeasured; no fresh per-pass timings performed.
- **Trust:** medium-high (weight 3): missed rootDir/declaration/ambient-type/Effect errors, stale incremental state, or check-order-sensitive fast-mode diagnostics. Retain emit/Babel pure annotations and declaration obligations. A shared incremental state file between distinct programs is not a safe optimization.
- **Admission:** parity ledger over program membership, normalized compiler options, diagnostics including deliberately seeded TS and Effect errors, build outputs and missing/stale artifact controls. Compare TSRS_FAST=0/1, source-only/test-only/config-only edits, warm/cold state, package-local check with no own build. Any reusable diagnostic state requires cache qualification and separate project identities. First measure schema/repo-utils and representative app/config programs; CLI/LPS qualification belongs in the implementation lane, not this bounded audit.
- **Prior art / dependencies:** tsrs fast mode, scheduling-cost caches and direct launcher already shipped; Oxlint type-check substitute is rejected. Coordinate Turbo ^build scope without losing dependency declarations. **Slices:** S per-pass profiler/parity fixtures; M one equivalent overlay/template; M generated rollout only to qualified package classes. **Confidence:** low savings, high that blanket deletion is unsafe. **Open:** exact fraction of source diagnostics duplicated and whether compatible incremental reuse beats existing Turbo hits.

### 7=. H-L7 — Retire the dead baked optimization unless measured payback justifies refresh

- **Area / mechanism / files:** H. `infra/ci-runners/runner-image.json` stamps Bun 1.4.2 and September 9 lock identity; setup expects 1.4.4. In `.github/actions/setup-monorepo-ci/action.yml`, even a successful baked hit **still runs the full frozen install** and deletes inherited Bun cache. Therefore prefer retiring misleading dependency-cache expectations and the dead optimization branch/documentation, while preserving a bootable base image and secure ordinary setup. “Retire” does not mean delete the running fleet's AMI or change a production pin in this audit.
- **Grain:** repo toolchain bootstrap. Root-owned binary/archive/mode/symlink checks remain if any fast path remains.
- **Savings:** **0 hosted, 0 critical, 0 local publish/verify** credited for retirement, basis **derived** from the current always-miss path. Maintenance simplification is real but unmeasured. A Bun-only refreshed image could at most avoid approximately 2s download ×6 heavy jobs =0.2 runner-min/full run before bake amortization; it cannot save all 9–10s installs or 38–41s setup. No CPU claim.
- **Trust:** low for removing an unused optimization and retaining identical fallback; high if conflated with image/privilege redesign. **Admission:** none for pure documentation correction; A/B boot/setup identity and successful lane parity for code retirement. Refresh requires measured hit rate × per-hit saving greater than bake/maintenance cost; lock-coupled churn makes that unattractive. A version-only key could be sound for a Bun-only artifact, but requires reviewing the original lock-key obligation, not deleting integrity checks casually.
- **Prior art / dependencies:** 1.35GB dependency archive restore already lost to fresh install; setup-bun cross-home-path restore poisoned fleet run 31245263696. Keep current registry fallback (#2964). **Slices:** S truthful timing/report and retirement decision; S dead branch removal with fallback test. Any bake/pin change is a separately scoped M operational action with rollback. **Confidence:** high no present dependency-install benefit. **Open:** measured Bun-only maintenance payback; refreshing for OS/security maintenance is a distinct justification.

### 7=. H-L5 — Attribute lock refusals to admission, not planned install

- **Area / mechanism / files:** H/J. `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts:1014–1019,1154–1161` recognizes `isLockBounce`, but `actionableLane` falls through to `failedStepId` without proof the step ran. Classify known admission refusal before step attribution; prefer timestamped failed execution evidence, and keep unexecuted planned-step and unlocated categories explicit. Update `Economics.schemas.ts` and focused fixtures. Preserve historical raw receipts; regenerate report classification rather than rewriting history.
- **Grain:** repo attempt ledger; execution evidence is per lane. This is telemetry, not a new scheduler or reordered proof.
- **Savings:** **0** in all four units, **derived**; avoids wasting future optimization effort but no invented runtime credit. CPU none claimed.
- **Trust:** low (weight 1); misclassification could conceal a real install failure in reports, though it does not change proof execution. Fixtures must distinguish admission-before-start, real install process failure, later failed inner lane, missing receipt and interrupted/unknown. Never exclude all handler errors from reliability reporting.
- **Admission:** parity ledger of historical classifications plus mutation fixtures; totals and real three failed executions must remain visible. Use the existing isLockBounce predicate, not a second independent text heuristic. Include corrected execution-denominator failure rates alongside raw refusal counts.
- **Prior art / dependencies:** inventory J already found 46 local/182 fleet artifacts; reuse/dedupe #2631/#2767 already shipped. Current fleet has 181 attributions versus 3 failed executions; census drift noted above. Depends on no performance lever; prerequisite to first-red scheduling claims in Yeet/measurement seats. **Slices:** S pure fold + schema/docs + focused fixtures; S historical reconciliation receipt. **Confidence:** high defect, high zero direct savings. **Open:** exact classification of every current attributed row; do not claim all 181 are lock bounces without the join.

## Rejected mechanisms considered

- **Restore full Bun/node_modules archive:** remains rejected: documented 1.35GB restore cost exceeds fresh install and heterogeneous homes poison paths. Reopen only with new paired end-to-end restore/install measurements on the exact target class, relocatable artifacts and integrity/platform qualification. A warm local directory is not new evidence.
- **PR cache writers/shared privileged build producer:** remains rejected by protected-producer trust model. Faster setup does not justify write credentials or shared mutable PR state. Reopening requires an explicitly redesigned and approved trust boundary, not performance numbers.
- **Shallow checkout:** remains rejected without merge-base reachability proof. Setup table includes checkout time, but none of the lever estimates claims it removable. New evidence must cover merge-base/divergent-history fixtures and every route consumer.
- **Blanket ignore-scripts / omit-optional:** rejected here: root Effect compiler patching, infra provider generation and platform executables are real obligations. Reopen only a named package/installer exception with runtime and compiler parity; not a global switch.
- **Test Unit on heavy EC2 / merged job bins:** prior rejections stand. L3 excludes Unit and keeps contexts separate. Reopen only with new workload-capacity, trust and context-preserving architecture evidence; this audit supplies none.
- **Oxlint type-aware checking replaces compiler / effect-tsgo proxy everywhere / bundler replaces emit:** remain rejected or parked per toolchain runbook: different program census, ~160ms proxy vs ~20ms launcher, no material bundler win and Babel annotations remain necessary. Reopen with full scope/diagnostic/emission parity and meaningful controlled speed evidence.
- **Per-module promoted imports migration:** stopped pilot remains stopped; dependency isolation does not revive it.
- **Admission dependency added merely to skip docs jobs:** retain recorded rejection; it delays code jobs absent routing parity. No new second admission authority or checker agent. Extend only existing QualityScheduler for local implementation measurements that need admission.
- **Delete head-install because “it never fails,” or move it first because “it is top red”:** both arguments misuse the ledger. Keep committed-head lock/install proof and existing receipt reuse. Reordering would require real failure timing/denominators after L5, not historical lock refusals.

## Contradictions with the inventory

1. “Every hosted job does full install” is too broad. Logs show aggregate context jobs, Change Profile, Commitlint and Secret Scanning without the 2,336-package install; A Codegen Drift also has no install line and a 22s wall. Restrict install-saving multiplication to executed installing jobs.
2. GitHub-hosted full install is not uniformly 44–62s. These logs include 14.86–61.76s; EC2 is approximately 9–10s. Short lanes remain setup-heavy, but a universal 40s migration dividend is unsupported.
3. The stale AMI path is a **Bun bootstrap** optimization, not an install-elision path. Refresh alone cannot recover the full setup/install duration. Its historical misses are implied by version/lock mismatch; this pass does not claim a log census of every job since September.
4. ssh2's 31s is one warning, not a common per-job tax. Its own optional crypto compilation and cpu-features' separate compilation must be measured independently, including overlap.
5. Root `@xenova/transformers` is a catalog declaration, not a root devDependency in current source; scratchpad owns an actual dependency. A catalog occurrence alone does not widen installed root ownership.
6. Src appears in three compiler programs, but the programs differ and Check does not always require its own Build. The quoted “three passes” is a possible execution pattern, not proof that one can be deleted.
7. L3 trust risk is not low: runner-trust-boundary closed with an accepted replay residual, not proof that PR runner identity is unrecoverable. Preserve that boundary on any placement expansion.
8. Fleet totals moved: 2,579 finished attempts and 838 recorded install executions now versus inventory 2,596 and 842; exact failure-attribution count 181 vs182. Lock-bounce proxy remains187. Keep snapshots and denominator definitions, rather than comparing totals as a performance trend.
9. Setup is about 6.6–7.1% of EC2 job wall here, but individual Heavy Check/Build jobs spend 44–59% on setup. Aggregate averages hide short jobs. Both layouts still have the legacy heavy integration long pole; neither is a combined post-#3005/#3007 experiment.
10. No two-run sample establishes the operator's p95. The relevant target is push-to-every-required-context green, not each job's runtime or the 20-minute review window. Required contexts, property floors and fresh coverage remain intact under every proposal.

## Operator-only questions

No operator answer blocks this read-only recommendation or the L1/L2/L4 parity experiments under existing authorized resources. Only if L3 requires increased spend: what existing EC2/hosted budget envelope may the implementation lane consume? Keep the pilot on existing authorized capacity until then. Preserve the already accepted runner-trust residual; any proposal that materially broadens it needs an explicit decision and fresh boundary proof. All other unknowns above are engineering measurements, not requests for the operator to repeat facts or choose routine implementation details.

```json
{
  "area": "H: dependencies, install, toolchain",
  "levers": [
    {
      "id": "H-L1",
      "title": "Qualify scoped frozen installation on the hoisted linker",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 8,
        "criticalPathMinPerPrRun": 0.4,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; 20 eligible installs x 24s; range 0-16 runner-min; root lifecycle closure may erase gain; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "medium-high",
        "failureMode": "Changed hoisting, peers or unpatched compiler produces a false green"
      },
      "admissionGate": "parity ledger + route replay + mutation fixture; cache qualification for any changed reuse",
      "confidence": "medium opportunity; low savings"
    },
    {
      "id": "H-L2",
      "title": "Contain ssh2 and cpu-features lifecycle work",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 3,
        "criticalPathMinPerPrRun": 0.1,
        "localWallMinPerPublish": 0.05,
        "localWallMinPerVerify": 0.05,
        "basis": "guess; 45 installs x 4s marginal wall; only one observed 31s warning, not a per-job measurement; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Native-free SSH fallback changes behavior or silently loses required backend"
      },
      "admissionGate": "A/B measurement with controls + runtime parity ledger",
      "confidence": "medium feasibility; low savings"
    },
    {
      "id": "H-L4",
      "title": "Isolate root tool dependencies with complete Turbo invalidation",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 2,
        "criticalPathMinPerPrRun": 0.5,
        "localWallMinPerPublish": 0.2,
        "localWallMinPerVerify": 0.3,
        "basis": "guess; 5 percent tool-only invalidations x 40 runner-min; blocked partly by blanket lock TURBO_FORCE; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "medium-high",
        "failureMode": "A real tool or compiler dependency no longer invalidates cached proof"
      },
      "admissionGate": "cache qualification + mutation fixtures + before/after hash matrix",
      "confidence": "medium mechanism; low savings"
    },
    {
      "id": "H-L3",
      "title": "Trial short jobs on existing owned EC2 capacity",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 2.5,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; five jobs x 30s; queue-inclusive gain unproven and may be negative; excludes Test Unit; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Expanded workflow admission exposes runner identity or displaces critical heavy work"
      },
      "admissionGate": "A/B measurement with queue controls + runner trust regression proof",
      "confidence": "low end-to-end gain"
    },
    {
      "id": "H-L8",
      "title": "Remove unused optional native payloads by ownership",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.5,
        "criticalPathMinPerPrRun": 0.05,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; 15 installs x 2s; actual fresh payload census missing; overlaps L1; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "medium-high",
        "failureMode": "Missing platform binary or silent fallback hides runtime regression"
      },
      "admissionGate": "parity ledger + platform/backend mutation fixtures + paired install census",
      "confidence": "low"
    },
    {
      "id": "H-L6",
      "title": "Consolidate only diagnostics-equivalent compiler passes",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.3,
        "criticalPathMinPerPrRun": 0.1,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0.1,
        "basis": "guess; no fresh per-pass timing; older 181-project source-check total was 21.3s; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "medium-high",
        "failureMode": "Different compiler programs lose source, declaration, ambient or Effect diagnostics"
      },
      "admissionGate": "diagnostic and output parity ledger + mutation fixtures; cache qualification if incremental reuse changes",
      "confidence": "low savings; high blanket-deletion risk"
    },
    {
      "id": "H-L7",
      "title": "Retire the dead baked optimization unless payback justifies refresh",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; present fast path misses and still performs frozen install; no direct runtime saving credited; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Removing a fallback or weakening binary integrity during retirement"
      },
      "admissionGate": "none for documentation pure waste removal; A/B boot and setup identity for code retirement",
      "confidence": "high no present dependency-install benefit"
    },
    {
      "id": "H-L5",
      "title": "Attribute lock refusals to admission, not planned install",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; telemetry-only change, no execution removed; hosted scenario conditional on eligible full code run, not unconditional PR average"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Report classifier hides a genuine install failure or drops refusal counts"
      },
      "admissionGate": "historical classification parity ledger + refusal/real-failure mutation fixtures",
      "confidence": "high"
    }
  ]
}
```
