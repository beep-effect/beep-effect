# Research

## 2026-10-27 — in-repo capability inventory (verified at HEAD this day)

Bricks the packet composes; `file:line` at `main` on 2026-10-27.

| Brick | Where | What it gives the route |
| --- | --- | --- |
| Lane vocabulary | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:219` (`CI_LANE_ID_VALUES`, 24 ids), `:260` (`CiLaneId`) | The shared key: pre-push lanes dispatch through `ciLaneStep` (`Quality/internal/GithubChecks.ts:163`), final-check through `lane(gate, hostedContext, laneId)` (`Yeet/internal/FinalCheck.ts:120`), hosted through `beep ci lane`. |
| Lane spec | `Quality/Quality.schemas.ts:1828` `GithubCheckLaneSpec` (id, tier, stage, wave, blockedBy, step, orderEstimate) | Stage/precision/class/cost exist; no footprint field. |
| Order | `Yeet/internal/WaveOrder.ts:1147` `WaveOrder` service over the A1 seed; six-key sort; pointer-verified seed rows | The ordering half of `Route`, already built and fixture-guarded (`gate-order-handoff/v1`). |
| Change classifier | `Ci/HeavyAdmission.ts:258-341` (`docsOnly` -> `skip-satisfied`) | The only atom today, and the three-valued hosted verdict the hosted phase extends. |
| Affected scope | `Yeet/internal/Planner.ts:313` `feedbackFilterArgs`; `Ci/CiLane.ts:384` `TURBO_SHAPE_FLAGS` (`--affected --base`) | Package-grain affected set exists for feedback and hosted PR lanes; never feeds lane selection. |
| Proof key | `Yeet/internal/ProofFact.ts:142` `ProofEpoch` (lockfileDigest, bunVersion, nodeVersion, rootTurboConfigDigest, rootTsconfigDigest, policyPackVersion); `ProofDigest.ts:103` key fields | The lookup half; keyed today on turbo task hash + lockfile epoch, so blind to lane-grain footprints. |
| Planner seam | `apps/labs/ciops/src/projection/LanePlan.ts:122` `rankChain`, `:153` `buildLaneGraph` (effect/Graph), `:178` `failOnCycle` | A total order plus a cycle guard; no change input. |
| Literal domains | `Ci/DependencyReviewSchemas.ts:30` `DependencyChangeType`; `Quality/ChangesetGraph.ts:135` `ChangesetBumpKind` | Two more atom kinds already named. |
| Replay inputs | `goals/time-to-certainty/research/inputs/close/hosted-runs.json.gz` (runs with jobs: name, conclusion, startedAt, completedAt), `live-journals.json.gz`; `research/scripts/economics.py` | Per-head hosted lane outcomes for recall; A1 lane costs for `Saved`. |
| Turbo facts | `turbo.json` (`futureFlags.globalConfiguration: true`; `global.inputs` lists root `package.json`, `.bun-version`, `.nvmrc`, `tsconfig*.json`); dry-runs 2026-10-27/28 in CAPTURE | Global inputs are copied into every task's input map (turbo 2.11.10), so root `package.json` reaches every task by our declaration, not by a turbo implicit; a per-task negation `!$TURBO_ROOT$/package.json` removes it (lint 187 -> 1 of 189 on the biome bump). `packages/foundation/modeling/identity/turbo.json` lint inputs declare `$TURBO_ROOT$/**/package.json` and survive the negation. Corrected 2026-10-28. |

Gaps, NOT FOUND: a change-kind domain beyond `docsOnly`; a per-lane footprint;
a per-lane propagation class; a replay harness over merged PRs; a census of
loss by change kind.

## External landscape (2026-10-28)

Axes: change grain, per-target inputs, propagation, soundness evidence.
Source reads are pinned (Turborepo `v2.11.10`, Nx `24.0.2`, both MIT;
target-determinator, Buck2's detector: Apache-2.0); we port ideas, not code.

### Turborepo 2.11.10

- **Docs vs source.** Docs put root `package.json` and the lockfile in the
  global hash, not excludable
  ([config](https://turborepo.dev/docs/reference/configuration)); task hashes
  add package files, its manifests, and only the lockfile slice touching that
  package ([caching](https://turborepo.dev/docs/crafting-your-repository/caching)).
  The source's global file map holds `globalDependencies`, `.gitattributes`,
  and root `package.json` only as a fallback when dependency resolution is
  unavailable
  ([global_hash.rs](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-task-hash/src/global_hash.rs)).
  The docs lag the source (our reading).
- **Correction to CAPTURE.** The 188/189 result is self-declared, not
  implicit: our `turbo.json` enables `futureFlags.globalConfiguration` and
  lists `package.json` in `global.inputs`. Under that flag
  `prepend_global_inputs` copies each global input into every task's `inputs`
  (as `<path-to-root>/package.json`) instead of the global hash
  ([task_definition.rs](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-engine/src/task_definition.rs)),
  matching the moved `../../../package.json` row.
  `test_global_inputs_can_be_excluded_and_affect_tasks` proves a task-level
  `!$TURBO_ROOT$/<file>` negation turns the miss into a hit
  ([global_inputs_test.rs](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo/tests/global_inputs_test.rs)).
  Unverified for `package.json` in this repo; a dry-run is owed.
- **`--affected`.** Default is `--filter=...[main...HEAD]` (package grain);
  `affectedUsingTaskInputs` narrows to task `inputs`, but root `package.json`,
  `turbo.json` or lockfile changes still select every task
  ([run](https://turborepo.dev/docs/reference/run),
  [config](https://turborepo.dev/docs/reference/configuration)). File grain;
  no published false-skip evidence.

### Nx 24

- **Inputs.** Globs start with `{projectRoot}` or `{workspaceRoot}`; `!`
  excludes, `^` targets dependencies; named inputs (`default`, `production`,
  `sharedGlobals`); JSON inputs hash only selected `fields` of parsed content
  ([inputs](https://nx.dev/docs/reference/inputs)).
- **Affected.** Nx 24 selects a task when the change touches its inputs;
  changes cross projects through `^` inputs and output reads, not `dependsOn`
  alone (`affected.legacy` keeps the project walk)
  ([affected](https://nx.dev/docs/features/ci-features/affected)).
- **Semantic locators.** Root `package.json` is JSON-diffed: each changed
  `dependencies`/`devDependencies` key or override selector maps to a graph
  node; a deleted dependency, an Nx-plugin package, or an unmatched selector
  returns null, meaning every project
  ([npm-packages.ts](https://github.com/nrwl/nx/blob/24.0.2/packages/nx/src/plugins/js/project-graph/affected/npm-packages.ts)).
  Our untested reading: a bun `workspaces.catalog` edit matches no branch.
  Root tsconfig: only `paths` edits are pinned, anything else touches all
  ([tsconfig-json-changes.ts](https://github.com/nrwl/nx/blob/24.0.2/packages/nx/src/plugins/js/project-graph/affected/tsconfig-json-changes.ts)).
  Lockfile: every task, unless `projectsAffectedByDependencyUpdates: "auto"`,
  which still falls back to all when unresolved
  ([lock-file-changes.ts](https://github.com/nrwl/nx/blob/24.0.2/packages/nx/src/plugins/js/project-graph/affected/lock-file-changes.ts)).
  No published recall figure.

### Bazel and target-determinator

- **`rdeps(u, x)`** returns reverse dependencies of `x` within universe `u`'s
  closure; plain query ignores configuration and keeps every `select()`
  branch, so it over-approximates ([query](https://bazel.build/query/language)).
- **target-determinator** runs cquery at both revisions and hashes each
  configured target from attributes, direct source contents, rule class, the
  whole `.bzl` text, configuration and Bazel version, recursively over
  dependencies; every imprecision its comments document is an over-estimate
  ([hash_cache.go](https://github.com/bazel-contrib/target-determinator/blob/d4b6125546979713431e63b5c3e65810fa989446/pkg/hash_cache.go)).
  A failed before-query defaults to `ignore-and-build-all`; cached results
  can carry a stale environment and yield spurious diffs; `-verbose` explains
  each selection ([README](https://github.com/bazel-contrib/target-determinator)).
  No false-negative cases or recall figures are published; soundness rests
  on BUILD files declaring every input (our inference).

### Regression test selection at scale

- **Google TAP** (Memon et al., ICSE-SEIP 2017): reverse dependencies through
  BUILD files give the AFFECTED targets; a milestone every ~45 min runs each
  once, at its latest affecting change. Of 5.5M affected tests, 63K ever
  failed; 1.23% of executions found a breakage; targets over 10 edges from
  the change rarely broke
  ([paper](https://huang.isis.vanderbilt.edu/cs8395-f23/paper/google-testing-icse-seip-17.pdf)).
  I found no other public account of TAP selection.
- **Elbaum, Rothermel & Penix (FSE 2014)**: post-submit tests a deliberately
  coarse dependency over-approximation; pre-submit picks suites that failed
  within `W_f`, have not run within `W_e`, or are new (history, no coverage).
  Skipped suites run in post-submit anyway: the catch-all. A replay over 3.5M
  Google records at `W_f`=96h caught 70–80% of failing suites, ~6x random
  selection at equal rate
  ([paper](https://cs.uwaterloo.ca/~m2nagapp/courses/CS846/1171/papers/elbaum_fse14.pdf)).
- **Meta predictive test selection** (ICSE-SEIP 2019): candidates are the
  build-dependency set (every impacted test, plus many more); gradient-boosted
  trees rank them, best on file extensions, change history, failure rates,
  project, test count and graph distance. Metrics TestRecall, ChangeRecall,
  SelectionRate: >95% and >99.9% recall, under a third of the dependency set,
  half the cost. Recall stays honest through sampled full "learning test
  runs" (~¼ of changes, off-peak), weekly retrains gated on an
  assertion (e.g. SelectionRate < 0.3 at TestRecall 0.9), de-flaking by up to
  10 retries, and a stabilization run of all tests on master every few hours
  ([paper](https://arxiv.org/pdf/1810.05286),
  [blog](https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/),
  [venue](https://conf.researchr.org/profile/conf/meredithporth)).

### Pants, Buck2, Please

- **Pants** `--changed-since` with `--changed-dependents=transitive` adds
  dependents; the docs warn one lockfile entry change marks every user of
  every dependency changed
  ([Pants](https://www.pantsbuild.org/dev/docs/using-pants/advanced-target-selection)).
- **Buck2's change detector** diffs before/after target info into level-0
  changes plus rdeps levels, splitting renames conservatively; `.bzl`/BUCK
  handling is undocumented
  ([BTD](https://github.com/facebookincubator/buck2-change-detector/blob/main/btd/README.md)).
- **Please** has `plz query changes --since master`
  ([commands](https://please.build/commands.html)); transitive semantics
  unverified.

### What beep can port

- **Nx locators**: semantic JSON diff of root `package.json` with a
  cannot-pin result that falls to the catch-all; extend to catalog keys
  mapped to `catalog:` consumers.
- **Nx JSON `fields` + Turborepo `global.inputs` negation**: drop whole-file
  root `package.json` from task inputs, re-add it as field-scoped atoms.
- **Meta metrics and gate**: TestRecall/ChangeRecall/SelectionRate as replay
  outputs, sampled full runs as standing measurement, an assertion on
  admission.
- **Meta stabilization / Elbaum post-submit**: a scheduled full run on `main`
  caps what a false skip costs.
- **target-determinator**: imprecision only toward over-estimate; errors and
  unknowns fall to all; every selection carries a reason.
- **TAP**: graph distance as an ordering prior.

What none of them do: Turborepo and Nx footprints are per-task file globs
without recall evidence; the selection literature measures recall but picks
tests by history or ML. I found no system keying footprints on semantic
change kinds per heterogeneous check lane, with a propagation class, each
admitted by replay recall over merged PRs.
