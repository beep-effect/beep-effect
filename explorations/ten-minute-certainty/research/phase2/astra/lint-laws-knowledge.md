# Area E — lint, laws, policy seals, JSDoc, schema catalog and knowledge gates

## Verdict

Recommend L1 (inventory-local noResolve) and L9 (algorithmic improvements) first. L2 is real duplicate execution, but its marginal benefit shrinks sharply after L1. L4 is the strongest scheduling candidate for the Heavy / Lint Policy ten-minute target, although it saves essentially no computation and therefore ranks last under the requested compute-plus-local-wall/risk rule. Do not confuse that ranking with a latency priority list.

The existing 712–738 s Heavy job could fall to roughly 497–523 s by hiding the 215 s doctor stage, **if** it fits behind medium without contention or added queueing. This is arithmetic on phase-1 timings, not a measured implementation result or a push-to-required-green p95. Lint Policy is absent from the checked-in required-context snapshot; JSDoc Ratchet and Repo Sanity are present. Other areas can still determine required-context completion. No Area E change alone establishes the operator's global target.

Local warm `lint:policy`/cheap-tier under two minutes is plausible through L9 and L7, but not proven. These are different command surfaces: the cheap stage inside `lint policy` is not the whole Yeet `cheap-gates` tier. L1 primarily helps inventory misses, not an already warm inventory hit. The phase-1 ~123 s warm number is for `bun run lint`, whereas economics' four-minute median is for Yeet cheap-gates. Those numbers cannot be interchanged.

No tracked source was edited, no proof or package task was executed, no worktree was created, and no other phase-2 auditor's output was read. #3005, #3007 and #3014 are assumed merged for recommendations; their savings are excluded.

## Measured this pass

### Commands and receipts

- Read BRIEF first; read the specified surface sections and Area E component, lever, rejection and independent-map rows. Used targeted source reads below. The memory registry search returned no relevant hits; no memory-derived claim is used.
- `gh run list --workflow check.yml --event pull_request --limit 100 --json databaseId,createdAt,headSha,conclusion`: 100 runs from 2026-11-08 16:49:31Z through 2026-11-09 16:33:53Z; 21 on Nov 8 and 79 on Nov 9. Both calendar days are partial. Observed interval rate is 101.10 runs/day, extrapolated 707.68/week, **not a measured full-week rate**. Receipt: `astra-e-runs.json` beside this report.
- Read REST `/actions/runs/<id>/jobs?per_page=100` for the newest 30 runs, then `/actions/jobs/<id>/logs` for completed non-skipped Heavy / Lint Policy jobs. Final retrieval: 21 readable, four without an eligible completed job, three HTTP 502, two HTTP 404. Errors are unknown, not zero-cost or changed-scope. Initial CLI refusal to emit ANSI escape sequences was resolved with `gh api --allow-escape-sequences`; ANSI was stripped before analysis. Receipts: `astra-e-histogram-source.json`, `astra-e-trigger-histogram.json`, `astra-e-log-<run>.txt`.
- `bun run beep yeet economics`: 476 checkout attempts, publish 188, verify 157; window Aug 8–Nov 9 (~93 days). Cheap-gates p50 4.0 min/p95 11.6 min, 114 wrapper executions. Inventory inner lane p50 3.1 min (34 executions); effect-imports 2.4 min, effect-vitest 1.4 min, schema-first 57 s. Inner times overlap and must not be summed as attempt wall.
- `bun run beep yeet economics --fleet`: live result 2,579 attempts, publish 1,210, verify 724, across 110 checkouts; differs from phase-1 2,596/112. The live checkout population changes as lanes retire. Fleet weekly rates below use the same approximate 93-day denominator as a planning assumption, not a verified identical fleet observation interval.
- Read the JSDoc Ratchet log for job 129229069240, run 42637312401. Both it and Heavy job 129229701130 execute inventory hash `3d3a54f0dbaf7da3`, both miss, and both say remote is read-only. Ratchet logs its miss at 14:44:25Z and upload suppression at 14:49:25Z; Heavy logs the same miss at 14:53:27Z. Grouped/buffered task log timestamps are not precise task-start timing. Receipt: `astra-e-jsdoc-log.txt`.

### L3 trigger histogram: larger, but biased

Twenty of 21 readable policy runs escalated; one logged `scope=changed`. Counts below are **runs with a visible trigger**, not changed-file counts; triggers overlap. Logging truncates long path lists (`+N more`), so counts can undercount additional trigger classes.

| Trigger | Runs / 21 |
|---|---:|
| policy-implementation | 17 |
| turbo-config | 5 |
| lint-configuration | 3 |
| deleted-path | 3 |
| deprecation-annotation | 3 |
| dependency-manifest | 1 |
| tsconfig | 1 |
| policy-seal-unreadable | 0 visible |

Examples: runs 42624585700, 42634648552 and 42637312401 escalate on coverage/partition implementation files; 42616280479, 42628003374 and 42628673169 escalate on deleted law-practice test files. These are repeated pushes in a CI optimization burst, not 21 independent change classes. A broader multi-day stratified sample remains necessary before estimating population savings.

### Source anchors

Paths below are relative to `~/YeeBois/projects/beep-effect`; `C/` abbreviates `packages/tooling/tool/cli/src/commands/`.

- `C/Quality/internal/LintPolicyScope.ts:216–318`: path trigger precedence and union of escalations; `:382–424` tests whether head text contains `@deprecated`, not whether the patch added a tag. Existing annotations can therefore force a full sweep on unrelated edits to that file.
- `C/Quality/Tasks.ts:3662–3728`: medium/state families, D2 freshness and the one-slot unscoped-state reservation; `:3811–3819` doctor inclusion; `:3865–3969` full/changed stage schedules. Changed state already runs beside medium. Doctor follows both.
- `C/Quality/internal/JSDocDocumentationInventory.ts:1198` uses semantic `getExportedDeclarations`, filtering declarations to the current file; `:1321–1350` constructs one project per package and adds all selected source files before analysis. `packages/tooling/library/repo-cli-kit/src/tsmorph/ProjectFactory.ts:74` sets only `skipAddingFilesFromTsConfig`, not `noResolve`. Despite its name, the factory is not configured as an in-memory filesystem.
- `.github/workflows/check.yml:1376–1436`, `.github/workflows/heavy.yml:184–205`, `.github/actions/setup-monorepo-ci/action.yml:328`: common cache setup and PR `local:rw,remote:r` mode. Separate jobs have separate local stores. A new PR hash absent from trusted main cannot be uploaded by either PR job. Backend mismatch is unnecessary to explain the miss.
- `C/Ci/CiLane.ts:1647–1654` inventory/ratchet sequence and prebuilt-inventory route; `:1740–1744` direct schema-catalog and changeset-graph before audit:github repo-sanity. `C/Quality/internal/GithubChecks.ts:577–581` also includes changeset-graph in repo sanity; `:88` and `:843+` define separate root-task cheap-gate launches.
- `C/Knowledge/KnowledgeDoctor.service.ts:1934–1971`: resolves refs, materializes head and base, reads seals and scans trees. It does not consume the prior medium graph's inventory artifact in this inspected execution path. Parallelization still needs temp/output collision and resource controls.
- `C/Laws/EffectImports.ts:1256–1391` repeats descendant queries by syntax kind. Its foundation/barrel mappings around `:726–760` demonstrate that the complete tool is not solely a function of the changed file's bytes.
- `C/Lint/OpaqueRoundtrips.ts:293–330` constructs compiler libraries/hosts and per-config programs; inference must survive a candidate pre-pass. `lefthook.yml:21–24` runs whole-repo typos despite other hooks using staged files.

## Ranked levers

### Ranking convention and savings limitations

Use risk divisors low=1, medium=2, high=4, a transparent ordinal planning heuristic rather than a probability model. Score = `(weekly hosted runner-minutes saved + weekly local publish/verify wall-minutes saved) / divisor`. Do not add critical-path minutes again. Current burst extrapolation is 708 PR runs/week; the 21 readable qualifying logs out of 30 yield a deliberately provisional **496 eligible runs/week**. Missing logs and canceled work make this a scenario, not a fleet forecast. Local fleet rates are approximately 91 publishes and 54 verifies/week; checkout-only rates are 14.2 and 11.8. No summing checkout and fleet.

Values below are per eligible executing PR run. Multiply by 0.70 for the provisional average over all listed PR runs. Central values are planning estimates; admission remains closed until evidence gates pass. `criticalPathMinPerPrRun=0` in the final JSON means **no demonstrated global required-context gain**, not proof of no potential gain. Each lever separately lists lane latency potential. CPU estimates are reported only where there is evidence; otherwise unknown. Scores are conditional on opportunities actually occurring, and not additive across overlapping levers. L2 uses its marginal estimate after L1; other interactions require remeasurement.

| Rank | Lever | Central hosted min | Local publish / verify min | Risk divisor | Conditional score min/week |
|---|---|---:|---:|---:|---:|
| 1 | L1 | 5.9 | 1.0 / 1.0 | 2 | 1,536 |
| 2 | L9 | 1.5 | 0.6 / 0.9 | 2 | 424 |
| 3 | L2, after L1 | 0.55 | 0 / 0 | 2 | 136 |
| 4 | L10 | 0.2 | 0 / 0 | 1 | 99 |
| 5 | L3 | 0.5 | 0 / 0.1 | 4 | 63 |
| 6 | L7 | 0 | 0.4 / 0.4 | 2 | 29 |
| 7 | L6 | 0.15 | 0.2 / 0.2 | 4 | 26 |
| 8 | L5 | 0.1 | 0.1 / 0.1 | 4 | 16 |
| 9 | L11 | 0 | 0.02 / 0 | 1 | 1.8 |
| 10 | L4 | 0 | 0 / 0 | 2 | 0; latency candidate |

### 1. L1 — restrict JSDoc resolution within the complete inventory

- **Area, mechanism, grain:** E; inventory-local compiler option in `JSDocDocumentationInventory.ts`, not a global behavior change to ProjectFactory. Repo grain, internally package programs: preserve full package/file/export census and all findings.
- **Savings:** hosted 5.5–6.3 runner-min/run across the two current copies, central 5.9, derived from phase-1 207–233 s tasks versus projected 30–40 s each. Local publish/verify 0–2.6 min each; central 1.0 explicitly discounts warm hits and overlapping lanes. Inventory lane potentially 2.8–3.4 min faster; global critical path unproved. CPU reduction unmeasured here. The reported 152→22 s experiment is prior evidence, not reproduced this pass.
- **Trust risk:** medium: semantic export/re-export alias resolution may change the counted universe even if foreign declarations are later filtered. Mitigate with complete canonical output equality, excluding only generatedAt, plus alias, star export, merged declaration, overload and cross-package schema fixtures.
- **Admission gate:** A/B measurement with controls + full-output parity ledger + cache qualification for changed computation/seals. Run hosted cold and warm controls on both runner classes; require export counts and detailed findings, not just aggregate ratchet green.
- **Prior art/dependencies:** semantic population-before-query already shipped (#2751); S1/PR C proposed, not shipped in this inspected source. Reject partial committed-baseline inventory. Assume #3014; no credit for its hashing gain.
- **PR slice:** “Bound JSDoc inventory module resolution”, S; inventory implementation, focused tests and fingerprint projection. **Confidence:** medium on safety, medium-high opportunity. **Open question:** does noResolve preserve every semantic alias case under current TypeScript? Only parity can answer.

### 2. L9 — algorithmic fixes without new cache reuse

- **Area, mechanism, grain:** E; syntax pre-pass before opaque-roundtrips' semantic programs; pruned manifest discovery for LawsPackage's discovery dependencies; one syntax visitor in EffectImports. Package grain for laws, repo grain for opaque/import scans; retain the same census and reports.
- **Savings:** hosted 0.5–2.5 runner-min/run, central 1.5 (guess anchored to 102.6 s opaque and 95.4 s imports tasks); local 0.3–0.9 publish and 0.5–1.3 verify, central 0.6/0.9. Phase-1 pruned walk opportunity is 330–430 CPU-s across the cold laws fleet; do not count #3014's ~70 CPU-s hashing separately here. Warm opaque pole is 57.5 s. Lane benefit 0–1.5 min, global path unproved.
- **Trust risk:** medium: lexical prefilters can miss aliased or inferred opaque calls; pruning can lose deeply nested fixture manifests; visitor changes can lose import types, import-equals, dynamic imports or fence findings. No new persisted memo and no cache:false flips.
- **Admission gate:** A/B controls + finding-by-finding parity ledger; adversarial alias/comment/template/import fixtures, exact manifest census including depth 7–9 fixtures, negative controls for each pruned subtree.
- **Prior art/dependencies:** PR C P11/P12/P28/P55; #3014's seal/glob relocation is assumed done and excluded. Existing single discovery walks and exclusions in EffectImports are not new work. EffectVitest S4 is related but deliberately not counted in this requested PR C subset.
- **PR slices:** “Avoid needless opaque semantic programs” M; “Prune laws manifest traversal without losing roots” S; “Visit import syntax once” M. Files: named tools and their discovery helpers/tests, seals. **Confidence:** medium. **Open question:** measured residual CPU/wall after #3014 and L1, on identical heads and cache states.

### 3. L2 — execute one complete inventory per hosted run

- **Area, mechanism, grain:** E; repo grain. Use one inventoried producer and an explicit same-run artifact consumer or colocated ratchet; preserve the literal JSDoc Ratchet context and fail-closed producer status. Existing `ci lane jsdoc-ratchet --inventory` is a consumer seam, not an authentication mechanism.
- **Savings:** standalone 3.4–3.9 runner-min/run; **after L1**, only 0.5–0.67 (central 0.55), derived. Local zero. Global latency may worsen if the required JSDoc context waits for all of Heavy Policy; no guaranteed critical-path saving. CPU saved equals one inventory execution, not measured.
- **Trust risk:** medium: wrong head/base/attempt inventory, artifact substitution, or skipped producer yielding green. Bind artifact to run/head/attempt, generator/schema version and complete census; fail missing/corrupt/failed artifacts. Do not promote PR artifacts into shared trusted cache.
- **Admission gate:** parity ledger + route replay/mutation fixtures for missing, stale, wrong-attempt, producer failure and docs-only skip; cache qualification only if the design changes cache reuse.
- **Prior art/dependencies:** #2579 cached chain already exists. This pass explains the dual PR miss with read-only upload suppression. Ordering jobs alone cannot solve it. Depends on L1 for sizing and on a staged trusted `heavy.yml@main` interface deployment.
- **PR slice:** “Share same-run JSDoc inventory with explicit provenance”, M, check/heavy workflows, CiLane and consumer tests. **Confidence:** high duplicate diagnosis, medium proposed handoff. **Open question:** can an early producer preserve JSDoc completion time without an extra setup-heavy job?

### 4. L10 — remove verified duplicate hosted invocations

- **Area, mechanism, grain:** E; repo grain. Remove the inner Shadcn copy only when the standalone authority runs; remove one changeset-graph execution inside Repo Sanity; route schema-catalog through its existing Turbo task after validating its input contract.
- **Savings:** central 0.2 runner-min, range 0.1–0.9; derived/guess from Shadcn 6.1 s and catalog 45.4 s. Catalog contributes only on a legitimate hit; switching command spelling does not guarantee a hit. Keep the standalone job, so do not claim its 78–93 s setup as savings. Local zero (some duplicates already removed). Required Repo Sanity can improve 0–0.8 min, global path unknown; CPU unknown.
- **Trust risk:** low for exact duplicates; catalog reuse separately medium until qualified. Hosted-only dedupe must not remove local Shadcn assurance or skip it when a route disables the standalone job.
- **Admission gate:** none, pure waste removal **after** task/arguments/input/base/failure parity is demonstrated; catalog cache qualification. Route fixtures keep authoritative outcomes present on all profiles.
- **Prior art/dependencies:** local R6/G9/G8 removals already shipped. P35 config fusion remains rejected. Depends on existing route contracts and catalog qualification, not PR-write cache access.
- **PR slices:** “Remove duplicate hosted Shadcn and changeset checks” S; “Use qualified schema catalog task in Repo Sanity” S. Files: Tasks, CiLane, GithubChecks and route fixtures. **Confidence:** high duplicate structure, medium savings. **Open question:** catalog hit fraction under current input seals.

### 5. L3 — task-specific escalation with conservative fallback

- **Area, mechanism, grain:** E; affected-set. Replace blanket escalation only for proven trigger/task pairs in LintPolicyScope/Tasks; use sealed task closure to select all consumers of implementation changes. First candidate: distinguish unchanged pre-existing `@deprecated` text from newly introduced annotations. Keep relevant dependent analysis for deletion/type-resolution changes.
- **Savings:** central 0.5 hosted min/run, 0 publish and 0.1 verify; guess, plausible range 0–2 hosted. Not inferred from “20/21 full”: affected state remains expensive and uncached. Root Turbo tasks' broad inputs may still select almost everything. CPU unknown; lane/global latency unproven.
- **Trust risk:** high: unchanged importers, global configs, missing/deleted modules or dynamic seal inputs can create reds outside the edited package. Keep full fallback for unreadable/unknown state and unqualified classes; main remains full.
- **Admission gate:** route replay + mutation fixture, 100% failing-witness recall; cache qualification for relied-upon task input closures. A lower escalation count is not acceptance evidence.
- **Prior art/dependencies:** #2635 changed scope already exists; P58 bare-default change and D2 filtering remain rejected. Histogram here widens evidence but is biased; depends on #3014 and route owners, not a new classifier authority.
- **PR slices:** “Distinguish added deprecation annotations” M; “Select sealed policy consumers by trigger” L, LintPolicyScope/Tasks/tests/seals. **Confidence:** low savings, medium causal diagnosis. **Open question:** complete untruncated trigger telemetry and a multi-day cohort after excluding these in-flight optimization PRs.

### 6. L7 — batch only compatible cheap-gate Turbo launches

- **Area, mechanism, grain:** E; repo tasks in one bounded cheap-tier graph. Batch compatible rootTaskLane entries in GithubChecks; map Turbo task results back to every existing lane receipt and hosted context. Retain heavy schema-catalog wave and required dependency/failure ordering.
- **Savings:** hosted zero; local publish/verify central 0.4 min each, range 0–0.8, guess. Do not multiply an assumed startup cost by twenty without measuring residual planner cost after #3014. CPU unknown. No global hosted latency gain.
- **Trust risk:** medium: dropped task verdicts, failure attribution changes, or width multiplication beside remaining processes. Charge the graph through existing QualityScheduler lane/package admission and current width plan.
- **Admission gate:** task-level parity ledger + controlled warm/cold A/B including partial failure/cancellation. All original lane IDs and receipts must remain reconstructable.
- **Prior art/dependencies:** P5 merging lint stages 1–3 stays rejected; this applies only inside the existing cheap-gates tier, not D10 stage order. Depends on #3014 and scheduler lane admission. Never silently suppress later uncached laws by name.
- **PR slice:** “Batch compatible cheap-gate task planning”, M, GithubChecks/planner/executor/tests. **Confidence:** low-to-medium. **Open question:** how much of today's wall is planner startup rather than scanner execution?

### 7. L6 — stateless file checks plus fresh membership joins

- **Area, mechanism, grain:** E; file grain only for proven syntactic laws, with repo-wide membership/orphan join. Start with schema-tag idioms or catalog candidate extraction; keep schema-first totals and discovery-sensitive checks whole. Path, config and tool identity are part of the function, not file bytes alone.
- **Savings:** central 0.15 hosted, 0.2 publish/verify; broad 0–1 min opportunity, guess after L1/L9. No proven critical-path gain; CPU unknown.
- **Trust risk:** high: deletion/orphan drift, exports outside the chosen files, import-derived rules and changed ignore/index state. Fresh full membership census, deletion/rename fixtures, full fallback on configs or unknown dependency closure. Do not reuse a committed baseline as unquestioned per-file truth.
- **Admission gate:** route replay + mutation fixture and full-versus-selected finding parity; cache qualification if Turbo begins reusing file products. Keep main full sweep.
- **Prior art/dependencies:** schema-catalog staged splice exists; no credit for reimplementing it. EV014, retired-iri and EffectImports barrel maps contradict blanket file purity. P47/P48 persisted memos remain rejected. Depends on L3's route evidence and explicit law purity contracts.
- **PR slice:** “Prove a file-local schema law with fresh orphan join”, M; scanner/catalog and membership tests. Broader rollout L. **Confidence:** low savings, medium for narrow feasibility. **Open question:** which laws truly have no semantic/import dependency?

### 8. L5 — share syntax parsing only where ownership and semantics agree

- **Area, mechanism, grain:** E; repo grain, an ephemeral read-only parse session for compatible schema-first/catalog consumers. Do not force opaque semantic programs, export inventories and syntactic rules into one universal compiler context. Preserve each verdict and each consumer's discovery universe.
- **Savings:** central 0.1 hosted and 0.1 local publish/verify, range zero to one minute, guess. No measured overlap/parse cost matrix; savings may be negative through cache-key coupling or higher RSS. CPU and global latency unknown.
- **Trust risk:** high: differing compiler options, source mutation between consumers, scope contamination and fused invalidation. Immutable parse facts, explicit inputs per consumer, unchanged task-level observations and no persisted second cache.
- **Admission gate:** full finding parity ledger, cache qualification for any fused result task, controlled per-tool parse/analysis/RSS measurements. Require improvement after L1/L9 rather than measuring obsolete implementations.
- **Prior art/dependencies:** shared ts-morph services and package syntax programs already exist; P18 cheap tracked-text fusion remains rejected. L1/L9 reduce the residual benefit. Depends on measured overlap, not simply “six tools import ts-morph.”
- **PR slice:** “Measure and share schema scanner syntax facts”, L, SchemaFirst/SchemaCatalog/EffectSchemaInventory and scoped service tests. **Confidence:** low; park broad fusion. **Open question:** can sharing avoid coupling otherwise independent Turbo hit rates?

### 9. L11 — staged-file typos for pre-commit

- **Area, mechanism, grain:** E; file grain in lefthook.yml; pass safely quoted staged paths while preserving exclusions, config and deletion handling. Retain hosted full typos.
- **Savings:** hosted/verify zero; publish central 0.02 min **only when the attempt includes one commit hook**, range 0–0.1; guess, not a measured hook latency. A publish that performs no commit saves zero. Phase-1 ~10.8 CPU-s full walk is not equivalent to wall time. Global latency zero.
- **Trust risk:** low: partially staged contents or filenames with spaces can cause missed staged errors; account for index/worktree semantics and rely on unchanged hosted full scan for repo assurance.
- **Admission gate:** A/B hook measurements and staged/unstaged, rename, deletion, spaces and ignored-file fixtures.
- **Prior art/dependencies:** Biome/docs already use staged paths; #3014's typos exclusion is assumed shipped and excluded. Does not change main or hosted proof cadence.
- **PR slice:** “Scope pre-commit typos to staged paths”, S, lefthook config and fixture checks. **Confidence:** high mechanism, low magnitude. **Open question:** actual hook latency and commits per local attempt.

### 10. L4 — overlap doctor under the existing admission budget

- **Area, mechanism, grain:** E; repo grain remains fresh. Move doctor into a resource-budgeted stage beside medium in Tasks, or use a separately admitted job while maintaining parent Lint Policy status aggregation. Prefer within-job scheduling first; own job adds setup and capacity demand.
- **Savings:** central **zero hosted runner-min and zero local publish/verify** under the current full-scope local plan. Lane latency potential 3.5–4.1 min (210–245 s), derived from phase-1 timing. Local explicitly based `lint policy` may benefit, but not counted as ordinary publish/verify. CPU unchanged absent contention; own job can increase runner-min by setup. Global required-path saving unproved.
- **Trust risk:** medium: losing doctor failure propagation or baseline seal environment, concurrent temp collisions, resource exhaustion; not stale cache because D2 remains fresh. Reserve measured memory/CPU within QualityScheduler/current concurrency plan; do not simply add a fifth process to width four. Preserve promoted-kind and mint-seal behavior.
- **Admission gate:** A/B resource measurement with controls + verdict parity and failure propagation fixtures. Measure full and changed scope separately: the latter already reserves one serial state slot and can become slower when another slot is taken.
- **Prior art/dependencies:** #2997 already overlaps tail; state already overlaps medium. D2 freshness and D1 width authority remain binding. Inspect #3015 baseline activation when implementing; reusable-workflow changes need trusted-main interface staging.
- **PR slices:** “Schedule doctor beside medium within measured capacity” M, Tasks/concurrency planner/tests; only if needed, “Separate knowledge execution with fail-closed aggregation” L, check/heavy workflows and route tests. **Confidence:** medium-high independent-input structure, low resource headroom proof. **Open question:** same-run medium/doctor peak RSS and CPU under normal hosted contention.

## Rejected mechanisms considered

| Mechanism | Why it stays rejected | New evidence that could reopen |
|---|---|---|
| PR cache writes or ordering jobs to fill remote cache | Violates protected-writer trust; ordering read-only jobs cannot upload missing hashes | An explicit new trust policy would be necessary for PR writes; not requested. Use same-run bound artifact instead |
| Partial JSDoc inventory from committed baseline | Semantic exports and discovery invalidation not proven | Complete detailed parity and mutation controls covering membership/aliases; L1 needs neither partial inventory nor this reopening |
| Persisted CLI/per-file lint memos P47/P48 | EV014/import closures, path-sensitive IRI, lockfile/index state invalidate naive keys | Complete input model and qualification; Turbo must remain the single result cache |
| Cache opaque/tracked laws as written P15/P17 | Tracked membership, .mts/.cts, ignores and outside-root reads remain holes | Discovery/index qualification including add/reset/rename/delete controls; algorithmic L9 deliberately leaves cache policy alone |
| Fuse tracked text P18 or oxlint/Shadcn/docs P35 | ~5 CPU-s saving does not justify lost probes; config fusion leaked findings into other scopes | Large controlled benefit plus exact scopes/findings/context parity; L10 removes duplicate execution without merging configs |
| One graph for all lint stages P5; width=16/P9 | Breaks stage ordering and admission, can starve medium | Existing-budget scheduling proof and an explicit applicable policy amendment if order changes; L7 does not cross stages |
| Bare affected default P58, empty-change fast exit, suppressing D2 | Hides unfiltered git/index/clock obligations | No reopening proposed; keep D2 fresh even for empty source diffs |
| Blanket ignored-tree pruning/fixed-depth manifests | Can hide dist/.next consumers and depth 7–9 fixtures | Anchored exclusions with exact full-census equality; L9 must demonstrate this |
| Remove whole Shadcn job by name alone | Setup saving is attractive but authority/routing parity not established | All profiles preserve equivalent verdict and literal required contexts; no such saving booked here |
| Share one semantic program for all six tools | Different options, compiler state and discovery contracts; no parse-cost matrix | Measured overlap plus immutable per-consumer parity/RSS/cache evidence; L5 remains parked beyond narrow exploration |

## Contradictions with the inventory

1. “Run the unscoped state graph abreast of medium” is already implemented (`Tasks.ts:3941–3965`); its width-one serialization is intentional. Only doctor is serial after that stage. Count no savings for redoing the existing overlap.
2. L2's suggested “share remote entry/order jobs” cannot solve a novel PR hash: both jobs are read-only. This pass reproduced matching hash `3d3a54f0dbaf7da3` and upload suppression, rather than relying solely on phase-1 hash `8bb79e209f0e67f0`. Main double misses may additionally involve simultaneous execution/cache availability; this pass does not claim to diagnose every main run.
3. L3 escalation is 20/21 readable logs, versus 7/9 previously. This is a wider but biased repeated-push cohort, not evidence that production incidence rose. Trigger logging is truncated and the missing nine runs are not classified.
4. Deprecation escalation is a head-text containment test, not an annotation-delta test. That explains a narrower possible improvement without deleting the cross-package safety guard.
5. Schema-catalog “uncached in Repo Sanity” means direct invocation bypasses the task, not that switching to Turbo necessarily saves 45 s. Both PR jobs can still miss a novel hash.
6. File grain is not sound for complete EffectImports merely because individual diagnostics name one file; foundation/barrel mappings are external inputs. Opaque-roundtrips is semantic, not another interchangeable syntax parse.
7. Fleet economics is now 2,579/110 rather than 2,596/112. Use retention-aware cohorts, not an apparent reduction as throughput evidence.
8. No candidate speedup was measured in this read-only pass. Phase-1 task durations and prior A/B experiments remain attributed historical evidence; this report's new measurements are volume, scope logs, cache behavior and economics. Neither sub-ten-minute hosted p95 nor sub-two-minute warm local cheap tier is established.

## Operator-only questions

None blocks this audit or the low-risk implementation candidates. The brief already settles the target, scheduler authority, proof depth, main verdict and in-flight PR exclusions. Do not ask those questions again.

Only if L4 requires paid additional runner capacity or a higher spending ceiling does it need an operator money decision. First measure the within-budget schedule. Cache qualification scope remains subject to the existing pause; the owning orchestrator can reconcile that recorded scope before implementation without treating this report as permission to restart an exhaustive program. Remaining uncertainties are engineering measurements and admission evidence, not questions the operator must answer from memory.

```json
{
  "area": "E: lint, laws, policy seals, JSDoc, schema catalog and knowledge gates",
  "levers": [
    {
      "id": "L1",
      "title": "Restrict resolution within complete JSDoc inventory",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 5.9,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 1,
        "localWallMinPerVerify": 1,
        "basis": "derived; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Semantic alias/export census changes"
      },
      "admissionGate": "A/B measurement with controls + parity ledger + cache qualification",
      "confidence": "medium"
    },
    {
      "id": "L9",
      "title": "Opaque pre-pass, pruned laws walk and import visitor",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 1.5,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.6,
        "localWallMinPerVerify": 0.9,
        "basis": "guess; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Prefilter or traversal omits a failing witness"
      },
      "admissionGate": "A/B measurement with controls + parity ledger",
      "confidence": "medium"
    },
    {
      "id": "L2",
      "title": "One same-run complete JSDoc inventory",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.55,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Wrong head or attempt artifact accepted"
      },
      "admissionGate": "parity ledger + route replay + mutation fixture",
      "confidence": "medium"
    },
    {
      "id": "L10",
      "title": "Remove equivalent hosted duplicate invocations",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.2,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Authoritative route absent or catalog inputs incomplete"
      },
      "admissionGate": "parity ledger; none for proven pure waste; cache qualification for catalog",
      "confidence": "medium"
    },
    {
      "id": "L3",
      "title": "Task-specific scope escalation",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.5,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0.1,
        "basis": "guess; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Unchanged dependent misses a new policy red"
      },
      "admissionGate": "route replay + mutation fixture + cache qualification",
      "confidence": "low"
    },
    {
      "id": "L7",
      "title": "Batch compatible cheap-tier Turbo launches",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.4,
        "localWallMinPerVerify": 0.4,
        "basis": "guess; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Dropped task verdict or admission overcommit"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "low-to-medium"
    },
    {
      "id": "L6",
      "title": "File-local laws with fresh membership join",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.15,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.2,
        "localWallMinPerVerify": 0.2,
        "basis": "guess; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Orphan or import-dependent red omitted"
      },
      "admissionGate": "route replay + mutation fixture + parity ledger",
      "confidence": "low"
    },
    {
      "id": "L5",
      "title": "Ephemeral shared syntax parsing for compatible consumers",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.1,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.1,
        "localWallMinPerVerify": 0.1,
        "basis": "guess; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Compiler state or scope contaminates another verdict"
      },
      "admissionGate": "parity ledger + cache qualification + A/B measurement with controls",
      "confidence": "low"
    },
    {
      "id": "L11",
      "title": "Staged-file typos hook",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.02,
        "localWallMinPerVerify": 0,
        "basis": "guess; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Staged content or quoted filename not checked"
      },
      "admissionGate": "A/B measurement with controls + mutation fixture",
      "confidence": "medium"
    },
    {
      "id": "L4",
      "title": "Doctor beside medium within existing admission budget",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; conditional eligible-run central estimate; global required-path savings unproven; see report ranges and overlap caveats"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Doctor failure lost or concurrent resource/output collision"
      },
      "admissionGate": "A/B measurement with controls + parity ledger + mutation fixture",
      "confidence": "medium"
    }
  ]
}
```
