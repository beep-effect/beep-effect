# Verification efficiency surface map — independent research seat

Snapshot: 2026-11-09, approximately 16:38 UTC. Repository `~/YeeBois/projects/beep-effect`, branch `main`, HEAD `7a31078ddd3620643d935267f6f94259096d0a0d`; initial `git status --short` empty. Read-only investigation: no proofs, installs, git writes, worktrees, configuration changes, or other seats' reports. This document is the requested external scratch artifact. Source locations below are relative to the repository unless prefixed `~`.

## Scope and evidence rules

32 components are mapped below. `C/` abbreviates `packages/tooling/tool/cli/src/commands/`; `R/` abbreviates `packages/tooling/tool/cli/src/internal/repo-run/`. Commands listed describe the mechanism; they were **not executed** unless explicitly identified as an observation. Packet ownership means the documented subject owner or closest historical packet, not an assertion that a live agent is assigned. An absent open PR means none appeared in the live open-PR census, not that no unpushed work exists.

Actual commands executed: file reads and targeted searches, read-only git status/log/rev-parse/ls-files, `gh pr list --state open --limit 100`, `gh run view <id> --json jobs,headSha,attempt,status` for the three requested runs, `bun run beep quality scheduler status`, `bun run beep yeet economics`, and `bun run beep ci lane-timings --help`. Python reduced those outputs and counted configuration entries. No local test/coverage/build/check/lint/docgen or Yeet proof was run. Repository files were inspected, not private sibling-lane output. Historical memory supplied search leads only; current claims were checked against live source or commands.

**Measurement limitations:** job wall means `completedAt − startedAt`, excluding queue time and including setup/teardown. Summing walls is job-seconds, not CPU-seconds, money, or critical-path duration. Skipped jobs are excluded (some API timestamps produce negative one-second synthetic durations). All three run samples are attempt 1. Different heads, caches, workloads, runner shapes, and simultaneous load prevent causal attribution. These are a convenience sample, not a representative week. Economics spans old implementations and includes failed/cancelled attempts. Static task weights and timeout ceilings are not current elapsed-time measurements.

## Current evidence ledger

Run aliases used throughout:

| Alias | Run / attempt | Head | Relevant context |
|---|---|---|---|
| A | [42634939284 / 1](https://github.com/beep-effect/beep-effect/actions/runs/42634939284) | `5cd896d6e8d0be196c11d39135d61f7b049c0efe` | After redundant citation replay removal; 13 Unit partitions |
| B | [42637312401 / 1](https://github.com/beep-effect/beep-effect/actions/runs/42637312401) | `9f30182f4a856d3e90e14f4f98fa3e338020a973` | Candidate 29-Unit-partition layout; not the inspected main workflow |
| C | [42619213744 / 1](https://github.com/beep-effect/beep-effect/actions/runs/42619213744) | `d1170ab46a4cdebfb6b7ccef99be11ab851d3859` | Earlier main; 13 Unit partitions |

| Job measure, seconds | A | B | C |
|---|---:|---:|---:|
| Heavy / Test Integration | 2279 | 2313 | 5345 |
| Integration verification step alone | 2234 | 2270 | 5299 |
| Heavy / Lint Policy | 712 | 725 | 734 |
| Lint Policy verification step alone | 666 | 680 | 675 |
| Property Laws | 667 | 1084 | 860 |
| Property execution alone | 583 | 990 | 787 |
| Slowest Unit partition | 1108 | 650 | 1825 |
| Heavy / Coverage Regression | 378 | 314 | 307 |
| Coverage comparison step alone | 333 | 255 | 251 |
| Heavy / Check | 74 | 84 | 74 |
| Heavy / Build | 65 | 93 | 61 |
| Heavy / Docgen | 323 | 148 | 314 |
| Heavy / Doctest | 104 | 154 | 105 |
| JSDoc Ratchet | 283 | 365 | 372 |
| Heavy Admission | 65 | 64 | 69 |
| Change Profile | 8 | 8 | 8 |
| Unit job-wall sum, minutes | 150.83 | 202.22 | 196.18 |
| All non-skipped job-wall sum, minutes | 257.37 | 315.30 | 357.98 |
| Non-skipped job count | 40 | 56 | 40 |

Live economics observation: `yeet-economics/v2`, generated `2026-11-09T16:37:54.676Z`, journal window `2026-08-08T07:58:03.626Z`–`2026-11-09T13:42:52.258Z`. 476 attempts (243 failure, 155 success, 78 unknown); 46 readable journals; no malformed rows reported. Wrapper lanes total 51.57 hours versus 53.80 hours attempt time. Inner lanes total 16.17 hours versus 14.44 hours enclosing attempt time: **overlap is real; do not add wrappers and inner lanes**. Full pre-push median 14.5m, P95 57.1m (91 executions); full cheap gates median 4.0m, P95 11.6m (114); head-install preflight median 12.1s, P95 40.6s (73). First-failure completion median 6.4m, P95 31.2m; only 128/321 red attempts reconstructable. Comparable-24h red-to-green: 54 closed episodes, median 36.3m, P95 12.03h; 24 right-censored streaks. These are historical mixed-population observations, **not a benchmark of this HEAD**.

## Component map

### 01. Yeet publish and cheap proof boundary

- **Paths/commands:** `C/Yeet/Yeet.command.ts`, `internal/Planner.ts`, `internal/Handler.ts`, `internal/PublishScope.ts`, `internal/ProvenanceFooter.ts`; `bun run beep yeet publish --message ...`, `yeet open`.
- **Behavior/cost:** push-first publication runs cheap gates and committed-head install proof, creates draft/label/provenance and submits readiness monitoring; explicit prove-first/reuse modes also exist. Historical cheap-gate median 4.0m/P95 11.6m; install median 12.1s/P95 40.6s (economics above). Total current publish latency **unmeasured**; commit hooks, API calls and scheduler wait are additional terms.
- **Owner/in flight:** `goals/push-first-publish`, `goals/time-to-certainty`; recent `2ecd78c2df0` (#2631) deduplication, `d0b463048ba` (#2767) proof/install reuse, `393f3410ca8` (#2790) redundant local work removal. No named publish PR in the open census.
- **Hypothesis/test:** cheap-gate task sharing can reduce repeated starts; confirm equivalent task receipts, first-red preservation, fingerprint invalidation, and paired exact-head publish traces. Do not propose moving a full proof before every push: that reverses the adopted boundary.

### 02. Yeet verify, merged preview, and proof reuse

- **Paths/commands:** `C/Yeet/internal/{Handler,Planner,MergedPreview,ProofLedger,ProofDigest,ProofState,ParityReuse,AttemptJournal}.ts`; `yeet verify`, `yeet verify --merged`, `--tier review-fix`.
- **Behavior/cost:** composed cheap/pre-push/parity work; same-attempt environment-bound parity reuse; resumable matching proofs; merged-tree verification is distinct from branch proof. Full pre-push median 14.5m/P95 57.1m; parity 16.6m/P95 32.3m on only four historical executions. Current clean/cold full-verify cost **unmeasured**.
- **Owner/in flight:** `goals/time-to-certainty`, `goals/ship-velocity`; #2631/#2767/#2773 (`13574da71c8` sequential fingerprint sharing), #2790. No dedicated open PR.
- **Hypothesis/test:** avoid recomputing proven equal environments; require exact scope, config/toolchain, base/head and receipt parity, not simply a green cached task. Measure cold, warm and dirty-tree cases separately.

### 03. Final-check, readiness, and merge policy

- **Paths/commands:** `C/Yeet/internal/{FinalCheck,FinalCheckRefresh,ReadyGate,ReviewWindow,MergeReadiness.policy,MergeGate,ExpectationRewrite}.ts`; `yeet final-check`, `yeet ready`.
- **Behavior/cost:** ordered diff-scoped replay of cheap gates, policy laws/root sweeps, lint, repo sanity, check, docgen, Fallow, coverage and rewritten-expectation scrutiny; receipts bind readiness. Worker compute profiles can explicitly route hosted-only gates away from local execution. Cost **unmeasured**. Review window is a policy minimum of 20 minutes after later push/ready event, not execution cost.
- **Owner/in flight:** `goals/push-first-publish`, `goals/verification-route`, `goals/time-to-certainty`; #2313 ancestor receipt through main merge, #2856 route use, #2925 compute profiles. No dedicated open PR.
- **Hypothesis/test:** consolidate identical publish/final-check checks without silently carrying stale receipts. Confirmation needs changed-base, expectation rewrite, root-policy, missing-receipt and revoked-route negative cases.

### 04. Quality planner and lane executor

- **Paths/commands:** `C/Quality/{Quality.plan,Quality.schemas,Tasks}.ts`, `internal/GithubChecks.ts`, `internal/LaneProofReuse.ts`; `quality github-checks cheap-gates`, pre-push profile.
- **Behavior/cost:** waves, lane deduplication, cheap-first ordering, pooled execution and exclusive integration resource. Static CI widths: Turbo 4/policy 4/cheap 4/pre-push 1; workstation: 8/8/8/4, docgen 6. Actual widths scale against admission. Source-measured deprecated-API sweep: 8 threads 30.0s/111.6 CPU-s; 16 threads 30.5s/158.8 CPU-s and ~1.3GB extra RSS (`Quality.plan.ts:110–121`). Current whole planner cost **unmeasured**.
- **Owner/in flight:** `goals/time-to-certainty`, historical `goals/quality-speedup`; #2560 hardware planning, #2584 pooled lanes, #2997 parallel lint tail.
- **Hypothesis/test:** smaller admission units may improve fleet feedback; test utilization, memory peaks and starvation across concurrent agents, preserving integration exclusivity and first-red stopping. More threads alone is contradicted by the cited sweep.

### 05. Clean-head install preflight

- **Paths/commands:** `C/Yeet/internal/{HeadInstallPreflight,HeadInstallReceipt}.ts`; embedded frozen `bun install` in publish/verify, disposable checkouts under `~/.cache/beep/head-install`.
- **Behavior/cost:** catches committed manifest/lock inconsistencies hidden by dirty installed trees; checks receipt expiry and identity before reuse. Economics median 12.1s/P95 40.6s, 22.0m total/73 executions. Cold failure/retry cost **unmeasured**.
- **Owner/in flight:** `goals/push-first-publish`, `goals/time-to-certainty`; #2631/#2767 reuse already landed.
- **Hypothesis/test:** improve reuse coverage only where receipt invariants hold; count miss reasons first. Removing the install outright would lose a separate proof obligation.

### 06. Coverage ratchet and local scope

- **Paths/commands:** `standards/coverage.regression-baseline.jsonc`; `C/Quality/internal/Coverage{Scope,Regression,Config.runtime,Environment}.ts`; `bun run coverage`, explicit `--affected`, baseline commands.
- **Behavior/cost:** per-package/per-file non-regression, epsilon .001 percentage points, declared minima 70 lines/70 statements/50 branches/60 functions with existing exceptions/follow-ups. Scope uses changed owners and dependency consumers; unknown/machinery changes conservatively expand. Bare local runs now default affected (#3008). Historical inner coverage median 11.5m/P95 13.0m, nine economics executions. `CoverageScope.ts:130–146` records a loaded workstation law-practice run: 2679.9s wall, 4692.7s user +543.9s system, 279 files; not this HEAD's hosted benchmark.
- **Owner/in flight:** `goals/quality-gate-ratchets`, `goals/ci-lane-economics`; #2772 bounded artifact validation, #3008 affected default/isolation, #3009 replay reduction. No standalone open coverage PR.
- **Hypothesis/test:** narrow additional explicit external-input consumers, or remove genuinely redundant tests. Confirm baseline parity, missing-file detection, all changed consumers and fresh evidence; never reduce floors as a speedup.

### 07. Combined Unit coverage producers and artifact consumer

- **Paths/commands:** `C/Ci/CiCoverage.ts`, `CiCoverage.reporter.ts`, `C/Quality/internal/CoverageArtifacts{,.schemas}.ts`; `.github/workflows/check.yml:694–1000`; `ci lane test-unit --partition ... --coverage-output ...`, `ci lane coverage --compare-only --coverage-input ...`.
- **Behavior/cost:** Unit partitions freshly generate coverage, seal runtime/test census/identity, upload run-attempt-specific artifacts; comparator authenticates complete producers including Labs and compares ratchet. Canonical Node/V8 versus Bun/Istanbul differences are explicitly handled; combined producer clears legacy standalone ratchet suppression so unit cases remain enabled. A/B/C comparator walls 378/314/307s, comparison steps 333/255/251s. This is **not** a second full coverage test run.
- **Owner/in flight:** `goals/ci-lane-economics`, ratchet owners; #2772 bounded artifact validation is confirmed in history; #3007 changes producer partitions.
- **Hypothesis/test:** optimize artifact decoding/comparison (bounded concurrency already exists), not cache old coverage output. Confirm exact run/head/base/attempt/runtime and test inventory integrity, reject missing/duplicate/stale shards.

### 08. Hosted Check DAG and ordinary runners

- **Paths/commands:** `.github/workflows/check.yml`, `C/Ci/CiLane.ts`; `ci lane <id>`.
- **Behavior/cost:** ubuntu-24.04 jobs; profile precedes most lanes; security/commit checks independent; lint/unit reducers preserve aggregate contexts. PR cancellation enabled; push cancellation disabled. A/B/C all-job wall sums 257.37/315.30/357.98 minutes; not critical-path or CPU totals. Timeouts commonly 20–60m, not performance targets.
- **Owner/in flight:** `goals/ci-lane-economics`, `goals/ci-fleet-endgame`; open #3007/#3005; #2999 goal-folder docs routing, #3010 docs allocation evidence, #3011 source-scanner qualification.
- **Hypothesis/test:** eliminate unnecessary job allocation for proven irrelevant changes while retaining required aggregate statuses. Evaluate queue, setup, runner minutes and invalid skip cases together.

### 09. Trusted Heavy reusable workflow and fleet

- **Paths/commands:** `.github/workflows/heavy.yml`, `.github/workflows/check.yml:209`, `infra/src/CiFleetController.ts`, `C/Ci/CiRunnerOutputs.ts`, runner-resource dispatch.
- **Behavior/cost:** callers use `beep-effect/beep-effect/.github/workflows/heavy.yml@main`; heavy workers labeled `beep-ec2-heavy`; six verification leaves plus explicitly selected cache-pilot leaves. Source planner describes 64GiB, 8/16-vCPU fleet shapes. Integration A 2279s; Check 74s; Build 65s. Live fleet CPU/RSS, queue and dollar cost **unmeasured**.
- **Owner/in flight:** `goals/runner-trust-boundary`, `goals/ci-fleet-endgame`, `goals/ci-fleet-residue`; #2666 nested read permissions; #2923 binary fetch only after admission. #3005 cannot prove its Heavy changes from an ordinary PR call while the caller resolves main.
- **Hypothesis/test:** integration parallel leaves may reduce critical path; must preserve runner trust, resolved reusable-workflow SHA and exact scenario coverage, and measure increased setup/runner occupancy.

### 10. Heavy admission and label event workflow

- **Paths/commands:** `.github/workflows/heavy-admit.yml`, `C/Ci/{HeavyAdmission,CiAdmission}.ts`, `check.yml` admission outputs; `ci admission --github-output`.
- **Behavior/cost:** label-triggered Heavy Admit avoids rerunning/cancelling cheap tier solely on ready-for-heavy label; route skips flow into trusted Heavy and required contexts complete. Migration coverage logic authenticates resolved trusted workflow version. A/B/C admission 65/64/69s, mostly setup; no current fleet admission latency measurement.
- **Owner/in flight:** `goals/time-to-certainty` ruling 51, `goals/verification-route`; #2879 fail-open route admission, #2884 caller wiring.
- **Hypothesis/test:** move only genuinely pre-toolchain work onto pinned binary; prove identical admission outputs for author/label/event/error cases. Making every cheap shard depend on Heavy Admission may worsen the common critical path.

### 11. Change-profile and operational routing

- **Paths/commands:** `C/Ci/CiOperational.{service,schemas,patterns.json}`, `.github/workflows/check.yml`; `ci change-profile`.
- **Behavior/cost:** pinned PR diff drives documentation, desktop, Nix, Storybook and lane relevance. A/B/C profile 8s each including setup. It is a separate selector from the newer semantic route engine and from Turbo affected selection.
- **Owner/in flight:** `goals/verification-route`, `goals/time-to-certainty`; #2774 pinned head, #2999 goal folders, #3011 source scanners.
- **Hypothesis/test:** reconcile selector overlaps without collapsing their contracts. Test path deletion/rename, root metadata, packet executable data and unknown classifications against full executed controls.

### 12. Semantic route classifier, footprints and revocation

- **Paths/commands:** `C/Ci/Route{Classify,Footprints,Corpus,Census,.service,.schemas,.command}.ts`, `standards/verification-route.sentinel.json`; `ci route plan/capture/census/replay`.
- **Behavior/cost:** typed change atoms, commit-resolved owners, conservative unknown, enforced versus shadow refinements and revocation. Live registry has **one enforced refinement**, `packet-markdown-out-of-build-check`, removing packet and commits atoms from build/check. Propagation is currently a lane-class label, not an implemented general dependency-closure routing optimizer. Cost **unmeasured**.
- **Owner/in flight:** `goals/verification-route` completed-retained; `explorations/verification-route`; #2414 slice 1, #2856 slice 2, #2879/#2884 hosted route.
- **Hypothesis/test:** admit more footprint refinements one at a time using replay plus real red witnesses; compare full proof selection and revocation behavior. Do not claim all affected-only verification is already implemented.

### 13. Turbo root graph and global invalidation

- **Paths/commands:** `turbo.json`, `standards/root-package.projection.generated.json`, `docs/runbooks/turbo-cache-inputs.md`; `bunx turbo run <task> --dry-run=json` (not run here).
- **Behavior/cost:** counted **115 tasks**, flags `affectedUsingTaskInputs`, `filterUsingTasks`, `globalConfiguration` all true. Global inputs include Bun/Node pins, TS configs and root manifest projection; raw package.json negated. Hashed env differs from passthrough env. Cost of graph/hash planning **unmeasured**. Root turbo config inherently affects root task hashes.
- **Owner/in flight:** `goals/beep-cli-composition`, `goals/time-to-certainty`, cache packets; #2559/#2575/#2633 input hygiene; open [#3014](https://github.com/beep-effect/beep-effect/pull/3014) lint:laws manifests onto seal and 20 root tasks' residue negation.
- **Hypothesis/test:** narrow measured over-invalidation using dry-run before/after hashes and real negative input probes. `cache:true` alone proves no correctness.

### 14. Turbo overlays, transit and dependency closure

- **Paths/commands:** 26 operational package `turbo.json` overlays plus one tracked proof-epoch fixture; `C/Quality/internal/Turbo{ConfigProof,LaneDigest}.ts`; root `transit`, `^build`, `^transit` dependencies.
- **Behavior/cost:** package-specific outputs/source/env exceptions, emitted versus noEmit build behavior, runtime dependency propagation. Tests/prose excluded from transit, but certain app build overlays re-include tests. Count verified by `git ls-files`: 27 nested turbo files includes `packages/tooling/tool/cli/test/fixtures/proof-epoch/turbo.json`; the user's 26-package figure is accurate. Cost **unmeasured**.
- **Owner/in flight:** same as 13; #2633 narrowing; #3014 relevant. No claim that every root exclusion applies to every package.
- **Hypothesis/test:** minimal dependency products may reduce cold rebuilds; confirm compiler program inclusion and artifact restoration across all overlays, especially app tests, Storybook sibling inputs and eyecite native runtime.

### 15. Remote cache, qualification and protected writers

- **Paths/commands:** `infra/r2-cache/`, `.github/actions/setup-monorepo-ci/action.yml`, `C/Cache/`, policy-pack cache modules, cache producer leaves in Heavy; `beep cache audit`, qualification/profile commands (not executed).
- **Behavior/cost:** protected writer environments, PR read-only credentials, optional R2 adapter, signed/native qualification scoped by computation × reuse layer × profile × epoch. Ordinary cache enablement, one successful hit, and exhaustive qualification are different states. Current hit rate/savings **unmeasured**. Historical signed pilot: 103 accepted fragments, ledger revision 8 at frozen `93a19425da` (task-qualification reflection).
- **Owner/in flight:** `goals/turborepo-task-qualification` completed-retained; `turborepo-quality-cache-adoption`, `turborepo-cache-trust-observability`, `turborepo-cache-conformance`; `explorations/turborepo-quality-cache`. #2307 enrollment; #2650 protected workflow; #2850 bounded observations. Nov 8 decisions adopt six-gate operational scope and pause; no completion/signing activation implied.
- **Hypothesis/test:** increase qualified hit population, not credential power. Need complete invalidation, source/runtime identity, authentic reuse and corruption/refusal controls in each intended environment.

### 16. Lint orchestration and policy-pack

- **Paths/commands:** `C/Lint/LintPolicy.command.ts`, `C/Quality/internal/LintPolicyScope.ts`, `packages/tooling/policy-pack/`, root `.oxlintrc*.json`, `biome.jsonc`; `beep lint policy`, `ci lane lint-policy`, `ci lane lint`.
- **Behavior/cost:** package Biome/GritQL work plus root typed/custom policies, docs/deprecated sweeps; affected scopes retain full fallback and unfiltered discovery-sensitive work. Lint Policy ~12m hosted (table); local historical median 7.7m/P95 11.9m. Ordinary Lint shards A 119/104s.
- **Owner/in flight:** `goals/beep-cli-composition`, quality-speedup, time-to-certainty; #2635 affected policy, #2997 parallel tail, #3011 source-scanner qualification, #3014 inputs.
- **Hypothesis/test:** profile sub-lanes and AST/program setup before broad concurrency. Confirm full rule set, identical findings, discovery population and peak RSS; policy wall is not explained by hosted setup (~21–23s in sampled Heavy jobs).

### 17. Laws and tracked-discovery exceptions

- **Paths/commands:** `C/Laws/{LawsPackage,EffectImports,MarkdownFences,SchemaDiagnostics,SchemaTagIdioms,EntityKitFreeze,TrackedShellAllowlist}.ts`, `internal/TrackedTextFiles.ts`; root `lint:laws`, `beep laws ...`.
- **Behavior/cost:** source/text/import/schema and repository-index-sensitive enforcement. Historical inner `lint:effect-imports` median 2.4m/P95 2.9m (34 runs). Individual remaining law costs **unmeasured**.
- **Owner/in flight:** `goals/beep-cli-composition`, cache-adoption; #2826 keeps five discovery checks unfiltered, #3011 updates docs-only scanner qualification; #3014 law input sealing.
- **Hypothesis/test:** share discovery snapshots only if tracked membership/index and every scanner's input contract are bound; unknown or index-sensitive discovery must remain fresh until qualified.

### 18. Policy fingerprint seals

- **Paths/commands:** `C/Lint/{PolicyFingerprint,PolicyFingerprint.schemas}.ts`, `internal/{PolicyFingerprintGraph,PolicyRootFiles}.ts`, generated CLI Turbo seals; `beep lint policy-fingerprint --write` (not run).
- **Behavior/cost:** script-less per-task seals carry reachable implementation/root config closure; shared CLI shell seal; standalone drift checker. Root seals were moved to CLI workspace to avoid turbo.json invalidating every law. Historical runbook: 29 turbo.json-only/non-global-input commits in two weeks to Nov 2 would replay 188 law and 183 JSDoc tasks under old layout. Current hashing elapsed **unmeasured**.
- **Owner/in flight:** `goals/beep-cli-composition/research/g4-task-fingerprint.md`; #2390 G4, #2633 refinement, #3014 follow-on.
- **Hypothesis/test:** reduce common seal closure only with import/root-file reachability and mutation probes; do not omit dynamically discovered files merely because imports do not name them.

### 19. JSDoc inventory and ratchet

- **Paths/commands:** `C/Quality/internal/{JSDocDocumentationInventory,JSDocRatchet}.ts`, root `jsdoc:inventory:check`, `jsdoc:ratchet:check`, `ci lane jsdoc-ratchet`.
- **Behavior/cost:** semantic export inventory, complete coverage ratchet, cached chain and protected remote cache. Runbook paired full scan **286.63→134.14s**, peak RSS **5,914,908→4,355,136KiB**, output parity except generatedAt (187 packages/3,663 modules/26,321 exports). Hosted A/B/C 283/365/372s; current inventory population not recounted.
- **Owner/in flight:** `goals/effect-jsdoc-quality`, `goals/time-to-certainty`; #2579 cached chain; #2751 compiler/repo checks improvement. No dedicated open PR.
- **Hypothesis/test:** further share semantic construction with inventory consumers; prove entire output equality and complete invalidation. Partial baseline inventory reuse was explicitly rejected.

### 20. Schema catalog and Effect Vitest policy

- **Paths/commands:** `C/Lint/{SchemaCatalog,SchemaFirst,EffectVitest,EffectSchemaInventory}.ts`, associated `internal/` scanners/stores; root `lint:schema-first`, `lint:effect-vitest` and catalog tasks.
- **Behavior/cost:** generated schema/test policy inventories, guard/fixture/arbitrary coverage, freshness enforcement; metadata consumers inform coverage scope. Historical local Effect Vitest median 1.4m/P95 2.0m; schema-first 57s/P95 1.4m. Runbook records generated metadata selection **190→2 packages** (repo-cli and repo-cli-kit), no elapsed-time claim.
- **Owner/in flight:** `goals/beep-cli-composition`, quality-ratchets, time-to-certainty; #2561 Turbo dispatch, #2751 and runbook coverage-consumer change. No dedicated open PR.
- **Hypothesis/test:** shared parsed sources and consumer metadata can narrow work; require scanner parity and conservative unknown-input fallback, not just fewer selected packages.

### 21. Vitest runtime and Test Unit partitioning

- **Paths/commands:** root `vitest.config.ts`, `vitest.shared.ts`, `vitest.setup.ts`, `vitest.aliases.generated.json`; `C/Ci/CiLanePartitions.ts`, `CiLane.ts`; Unit matrix in check.yml.
- **Behavior/cost:** current main six CLI shards, three law-practice shards, four mixed bins. Node/V8 canonical coverage and runtime-specific producers; hosted 16GiB cap of two Turbo tasks. Unit maxima A/B/C 1108/650/1825s; total Unit wall 150.83/202.22/196.18 minutes. Path-hash slicing is deterministic but not duration-balanced.
- **Owner/in flight:** `goals/ci-lane-economics`; #2540 six CLI shards; open [#3007](https://github.com/beep-effect/beep-effect/pull/3007) LPT plans and expanded shards. Main and B use different matrices.
- **Hypothesis/test:** LPT by **test-body** durations with fixed census reduces tail. Confirm no duplicates/omissions, seed/run parity, coverage merge completeness and total CPU/RSS/setup cost. B still has a 650s Unit job, so under-ten-minutes is not yet established by that run.

### 22. Law-practice-server unit/native workload

- **Paths/commands:** `packages/law-practice/server/{vitest.config.ts,test,src/internal/Citation}`, coverage weight table; package test/coverage scripts.
- **Behavior/cost:** native worker cold loading plus large citation surface; package maxWorkers/maxConcurrency both 2; coverage topology can override to one. Source measurement 2679.9s wall for 279 coverage files under high shared load. Hosted C law-practice shards 1652/1825/1501s; A 1108/713/701s.
- **Owner/in flight:** `goals/claim-check-performance`, ci-lane-economics; #3009 removed redundant citation replays and rebaselined; #3007 sharding, #3005 integration. Attribution between #3009 and speedup is plausible, not controlled proof.
- **Hypothesis/test:** consolidate duplicate expensive setup/replays while preserving independent cases and native deadline semantics. Compare fixed test inventory, assertion coverage and task-level CPU under matched load.

### 23. Integration tests and SQL exclusivity

- **Paths/commands:** `C/Ci/CiLane.ts`, `C/Quality/internal/GithubChecks.ts`, package `test:integration`, `test:integration:parallel`, `test:integration:serial`; Heavy Test Integration.
- **Behavior/cost:** uncached external-state checks; shared SQL container resource marks local integration exclusive. A/B/C 2279/2313/5345s; verification itself 2234/2270/5299s, so bootstrap is not the dominant cause.
- **Owner/in flight:** ci-lane-economics, claim-check-performance; #2823 preserves unsplit owners; open [#3005](https://github.com/beep-effect/beep-effect/pull/3005) law-practice hosted partitions.
- **Hypothesis/test:** independent DB/container namespaces and partitions can reduce tail without dropping external checks. Require exact scenario census, cleanup/failure behavior and serial-resource contracts; measure repeated database startup and runner cost.

### 24. Property laws and nightly depth

- **Paths/commands:** `C/Ci/CiLane.ts`, `vitest.shared.ts`, `packages/tooling/test-kit/fc-runs`, property workflow/root `test:property`.
- **Behavior/cost:** fixed PR seed `20260708`, 400-run floor; nightly deeper/rotating seeds. Config limits deep sweep to files importing fast-check/using it.prop. Hosted A/B/C 667/1084/860s; execution 583/990/787s.
- **Owner/in flight:** `goals/one-round-loop` completed-retained; property required-check flip historically deferred; inspect live ruleset before assuming required. #2844 capped nightly property I/O. No dedicated open PR.
- **Hypothesis/test:** shard independent property files or reduce repeated fixture I/O while retaining run floors/seeds and all property owners. Cutting run count changes proof and is not an efficiency result.

### 25. Doctest and docgen

- **Paths/commands:** `vitest.shared.ts` Doctest plugin and `BEEP_VITEST_DOCTEST`, `packages/tooling/tool/docgen`, root Turbo docgen/doctest chains; `ci lane doctest`, `ci lane docgen`, `docgen:local`.
- **Behavior/cost:** executable examples versus API documentation generation are different obligations. Shared doctest timeout 120s per test due to cold transforms; docgen concurrency profile-specific. Hosted doctest 104–154s, docgen 148–323s. Runbook CLI handoff docgen 38.3s historical local.
- **Owner/in flight:** `goals/effect-jsdoc-quality`, quality-speedup, time-to-certainty; #2559 doctest hygiene, #2454 shared Markdown extraction, #2751 checks. No dedicated open PR.
- **Hypothesis/test:** reuse qualified parser/build outputs; bound cold-start fan-out. Prove generated output and example census parity; do not merge inventory, docgen and doctest into one supposedly equivalent check.

### 26. Workspace dependency graph and toolchain

- **Paths/commands:** `package.json`, `bun.lock`, `.bun-version`, `.nvmrc`, `tools/tsgo-shim`, tsconfig overlays, `docs/runbooks/typescript-toolchain.md`; generated workspace scripts/check/build.
- **Behavior/cost:** verified **200 workspace directories** expanding declared nested workspace level; lockfile 1,030,620 bytes. Catalog @effect/tsgo 0.67.5, TypeScript ^7.0.2, Vitest ^5.1.0, Turbo ^2.11.10 (ranges are declarations, not proof of installed versions). tsrs-patched check/build and separate fresh compiler diagnostics/test-program receipts. Runbook test references: CLI median **1.79→1.55s**, RSS **6,420,996→4,758,956KiB**, 172 overlays, 342 successful check tasks. Current cold dependency build cost **unmeasured**; sampled hosted Check is warm/scope-dependent.
- **Owner/in flight:** `goals/quality-speedup`, `goals/beep-cli-composition`; #2260/#2262 tsrs, #2415/#2915 dependency bumps, #2751 overlay improvement. No dedicated open dependency PR in census.
- **Hypothesis/test:** dependency-only build products and narrower compiler programs help; preserve own-source diagnostics and deliberate-error controls. Dependency bumps can invalidate broad graphs even when textual diffs are small.

### 27. Hosted bootstrap, native dependencies and binary dispatch

- **Paths/commands:** `.github/actions/setup-monorepo-ci/action.yml`, CI binary setup action, `C/Ci/{CiBinary,CiCompileBinary,CiBootstrap.command}.ts`, Rust/native package scripts.
- **Behavior/cost:** exact toolchain bootstrap, baked metadata fast path, frozen installs with three bounded retries, optional PDF/native provisioning and R2 adapter. Old dependency archive restore disabled: source cites **1.35GB** archive more expensive than fresh install. A Heavy setup 21–22s; A Property setup 57s; B Property 68s; coverage dependency install 17/27/26s. Native package-by-package cost **unmeasured**.
- **Owner/in flight:** `goals/ci-fleet-residue`, ci-lane-economics, cache-trust-observability; #2672 OpenSSL prerequisites, #2860 binary, #2906 pre-toolchain binary, #2923 admitted-only fetch.
- **Hypothesis/test:** move proven selection earlier and avoid unnecessary native tools; compare exact installed products and failed-install handling. Another lazy loader or archive cache would repeat already-settled work (#2384 argv-first lazy dispatch).

### 28. Local weighted admission and cgroup containment

- **Paths/commands:** `R/{QualityScheduler,QualityScheduler.schemas,MemoryStats.service,ComputeProfile,RunScope,AgentRunsSlice,AdmissionJournal}.ts`; `quality scheduler status`; `~/.beep/runtime/beep-admit-uid-1000/`.
- **Behavior/cost:** token ≈5GiB, reserve 10GiB, capacity ≤10, hard floor 15GiB; weights full proof 3/merged preview 5/review-fix 1/publish 1; heartbeat 5s, suspect 30s, publish aging 120s, review-fix cap 3. Source slice defaults MemoryHigh 48G/MemoryMax 60G; installed enforcement not inspected. Live status **0/10 tokens, MemAvailable 66.5GiB**, empty queue/leases, **2068 quarantine entries**; journal 242,881 bytes. Quarantine count is historical residue, not 2068 active leases or measured current contention. Current scheduler wait/CPU overhead **unmeasured**.
- **Owner/in flight:** `goals/ship-velocity`, time-to-certainty, beep-ci-operational-ontology exploration; #2925 profile refusal, #2973 cgroup reservations. Current scheduler source permits same-origin distinct-checkout capacity peers, unlike historical article. Same-checkout exclusion and legacy protocol compatibility remain.
- **Hypothesis/test:** admit task-sized workloads with calibrated peak resources and durable lease accounting; demonstrate fleet throughput and low tail waits without oversubscription, orphan processes or output races. Audit journal/quarantine decoding cost before cleanup; no evidence here warrants deleting state.

### 29. Package handoff, Fallow and repository sanity

- **Paths/commands:** `C/Quality/internal/PackageVerify.ts`, Fallow commands/envelope contracts, CheckCensus/TestTsgoPrograms, config-sync/syncpack/sherif/root scripts; `quality package-verify <packages>`, `ci lane fallow`, `ci lane repo-sanity`.
- **Behavior/cost:** lint-before-full package proof, dependency closure preparation, sequential batching; full audit/docgen unless justified quick subset. Fallow cached pure verdicts but fresh envelopes/consumer contracts. A Fallow 188s, Repo Sanity 171s; runbook CLI audit 157.4s/docgen 38.3s, AI metrics audit 15.6s/docgen 7.2s historical.
- **Owner/in flight:** `goals/fallow-quality-enforcement`, quality-speedup; #2526 removes per-package audit scripts, #2592 restores composed package audit, #2630/#2634 Fallow scope/cache/concurrency, #2779 lint first.
- **Hypothesis/test:** reuse identical full-package handoff receipts inside final proof; keep audit side effects/integration and receipt outputs distinct from cacheable pure verdicts. Batching already exists and is sequential.

### 30. Peripheral hosted gates and selective provisioning

- **Paths/commands:** check.yml Security/SAST/Secret Scanning/Commitlint/Nix/Desktop/Labs/Shadcn/Ecosystem/Codegen; `CiLane.ts`, CI governance and dependency-review modules, Storybook selection path.
- **Behavior/cost:** distinct security, generated-config, browser/native and ecosystem obligations. A: Commitlint 32s, SAST 71s, Security 76s, Secret Scanning 26s, Nix 85s, Desktop 158s, Labs 157s, Shadcn 78s, Ecosystem 94s, Codegen 69s. Storybook affected workload source comment records historical 584s build/browser work; current cost **unmeasured**.
- **Owner/in flight:** ci-lane-economics, runner-trust-boundary, quality-ratchets; #2551 setup trim, #2751 early Storybook selection, #2999/#3011 routing. No dedicated open PR except baseline mint #3015 adjacent governance.
- **Hypothesis/test:** optimize provisioning only after relevance determination; preserve merge-base, scanner history and exact policy results. No evidence that these short sampled jobs warrant priority over Integration/Policy/Property.

### 31. Economics, attempts and time-to-certainty KPI

- **Paths/commands:** `C/Yeet/internal/{Economics,Economics.schemas,AttemptJournal,InnerLaneReports,ProofShadow}.ts`; `goals/time-to-certainty/research/baseline.md`, `THE_AGENTIC_YOYO.md`; `yeet economics`.
- **Behavior/cost:** reconstructs attempts, nested lanes, first red, repeat fingerprints, red-green episodes, censoring and review rounds. Live observation numbers above; old article rebaseline median 43.3m/P95 3.95h is not current fleet performance. Economics tool overhead itself **unmeasured**.
- **Owner/in flight:** `goals/time-to-certainty`, `explorations/beep-ci-operational-ontology`; #2310 rounds-to-ready, later journal/resume work. Historical reflection says lane-retirement erased shadow samples until store lifetime repaired; zero rows did not mean no activity.
- **Hypothesis/test:** choose optimizations by first-actionable-red and sustained fleet returns, alongside resource totals. Need matched populations, retained receipts and uncertainty/censoring reporting; do not sum overlapping lane time or infer causality from mixed months.

### 32. Hosted lane timing, queue and fleet measurement

- **Paths/commands:** `C/Ci/LaneTimings.ts`; `ci lane-timings --window --since ... --until ... --event ...`, `--head-sha`, `--preview` (help only executed).
- **Behavior/cost:** run-attempt-aware job/step timing, bounded census, branch peaks; pickup latency undefined after attempt 1 because GitHub rewrites run_started_at. Peak RSS requires out-of-band evidence; jobs API supplies none. Three-run observations above; representative seven-day queue/CPU/RSS/cost **unmeasured**.
- **Owner/in flight:** `goals/ci-lane-economics`, `goals/ci-fleet-endgame`; #2528 per-day branch peaks and ruleset ratification.
- **Hypothesis/test:** join attempt-1 queue, setup, test-only duration, runner class, cache state and cancellations; use paired fixed-head experiments before setting universal job SLOs. Preserve complete cancelled/retried populations rather than selecting only green fast runs.

## Open ownership and recent changes

Live open PR census returned five PRs, all on Nov 9. Relevant active changes are #3007 Unit LPT/shards, #3005 hosted Integration partitions, #3014 Turbo law inputs. Also open: [#3015](https://github.com/beep-effect/beep-effect/pull/3015) sealed knowledge-doctor baseline and [#3013](https://github.com/beep-effect/beep-effect/pull/3013) agent-memory-store foundations; they may affect governance/dependency workloads but are not verification optimization owners. Read their source ownership before assigning overlapping implementation. No PR bodies/reviews or other seats' work were inspected.

`git log --since=2026-10-25` confirms numerous already-landed optimizations: tsrs (#2260/#2262), cache enrollment (#2307), semantic route (#2414/#2856/#2879/#2884), argv-first CLI (#2384), task seals (#2390/#2633), two-wide/six-CLI Unit bins (#2540), source-input hygiene (#2559/#2575), profile concurrency (#2560), Turbo policy tasks (#2561), cached JSDoc chain (#2579), pooled GithubChecks/fingerprint sharing (#2584/#2773), affected Lint Policy (#2635), proof/install reuse (#2631/#2767/#2790), Fallow pure caching (#2634), property I/O cap (#2844), binary bootstrap (#2860/#2906/#2923), compute-profile routing (#2925), cgroup accounting (#2973), lint tail concurrency (#2997), coverage affected default (#3008), redundant citation replay removal (#3009), docs source-scanner qualification (#3011). Their existence is implementation evidence, not universal savings evidence.

## Rejected, killed, withdrawn or held mechanisms

These are dispositions with reasons, not a list of suggestions. Reopening requires the stated new evidence. Principal source: `docs/runbooks/repository-performance.md`, “Sequential review method and dispositions.”

| Mechanism | Disposition / reason | Source or condition to reconsider |
|---|---|---|
| Cache coverage results across runs/heads | Rejected: evidence identity belongs to current run/head | Runbook; CoverageArtifacts identity checks |
| Partial JSDoc inventory reconstructed from committed baseline | Rejected: full-scan equivalence/invalidation missing | Runbook; require complete inventory parity |
| Shared PR build carrying cache write token | Rejected: violates producer trust | Runbook; protected producer/PR read-only boundary |
| Restore old Bun dependency archive | Rejected: measured restore more expensive than fresh frozen install | Runbook; setup action lines 220–221, 1.35GB archive |
| Immediate shallow checkout/fetch only base tip | Rejected: merge-base history not guaranteed | Runbook; full same-head scanner/governance and ancestry proof required |
| Disable superseded-run cancellation | Rejected: obsolete heads consume more resources | Runbook; first join cancellation receipts and push cadence |
| Restart/disable telemetry because scorecard looks empty | Rejected: live consumers/protective holds; empty local view not no traffic | Runbook; live evidence/owner coordination |
| Hard skill byte caps / blanket decision-tail bans | Rejected as naive structural enforcement | Runbook; preserve valid references/post-marker sections |
| Parallel final-check and audit/docgen | Held, not adopted: memory admission and output races | Runbook; equivalent-work concurrency experiment |
| Skip duplicate gate/law work by name alone | Hypothesis only: no task-level receipt parity | Runbook; equivalent coverage and failure receipts |
| Make docs-only shard skips depend on Heavy Admission | Held: additional admission setup delays all code runs | Runbook; required-context plus critical-path comparison |
| Property/Unit sharding based on full job walls | Not qualified: setup/build is not test weight | Runbook; test-only durations and fixed seeds/run counts |
| Merge hooks / memoize session projections | Held: per-call timing insufficient for invalidation correctness | Runbook |
| Exclude all `src:test` changes from build | Explicitly rejected: apps build via tsconfig.check including test/ and re-include tests in Turbo inputs | `goals/verification-route/decisions/2026-11-07-reject-src-test-out-of-build.md` |
| General dependency propagation claimed for slice 2 | Not implemented: stays a label until a refinement actually needs package graph selection | `.../2026-11-07-propagation-stays-a-label-in-slice-2.md` |
| Hosted-first route learning, path-pattern-only routing, symbol grain from start, order inferred from tiny census | Rejected alternatives | `explorations/verification-route/DECISIONS.md` entries around lines 41,58,113,197; typed conservative route and staged evidence preferred |
| Reopen ontology packet to implement route | Rejected: carries unrelated ontology history/authority | Same exploration lines 23 onward |
| Treat one hit, archive restoration or local proof as qualification/hosted authority | Rejected: different reuse layers and obligations | `explorations/turborepo-quality-cache/DECISIONS.md` lines 79–148 |
| Broad write tokens, unsigned downgrade, immediate production/fleet cache rollout | Rejected trust/authority shortcuts | Same cache exploration lines 66–95,148–174 |
| Immediate generic cache package extraction / monolithic goal | Rejected boundary and authority expansion | Same exploration lines 23,241–260 |
| Qualify tracked discovery while omitting index membership | Explicitly held fresh/unfiltered | cache-adoption decisions Nov 6 tracked-test/entity-kit/source-inventory and Nov 7 index-sensitive laws |
| Storybook schema alias workaround | **Withdrawn**: original-resolution control passed on different refreshed profile; causal/cache-corruption claim unproved | `goals/turborepo-quality-cache-adoption/decisions/2026-11-07-withdraw-an-unproven-storybook-alias-candidate-after-source-bound-control.md` |
| Cache mutating formatting/fixer families as ordinary pure results | Held whole-command keep-fresh | cache-adoption `2026-11-08-revalidate-the-complete-current-formatting-fixer-family-as-whole-command-keep-fresh.md` |
| Expand paused operational R2 effort into exhaustive assurance | Explicitly deferred, not killed on merits | cache adoption/trust Nov 8 operational-scope pause decisions; new scope/effort decision needed |
| Close time-to-certainty solely on a sample that cannot accumulate | Rejected completion design; evidence store was deleted with lanes | `goals/time-to-certainty/history/reflections/2026-09-28-claude.md`; 200-attempt/10-branch gate and store-lifetime repairs |
| Treat process doubles as native signed-cache evidence | Rejected evidence substitution | `goals/turborepo-task-qualification/history/reflections/2026-10-02-codex.md` |
| Raise API/cache concurrency without backend throttle envelope | Prior conformance reflection calls for throttle-aware envelope | `goals/turborepo-cache-conformance/history/reflections/2026-10-24-claude.md` |

This ledger covers inspected performance/route/cache decisions and reflections. It is **not an exhaustive semantic review of every historical packet in the monorepo**; that would exceed a bounded independent surface audit. Search the owning packet before adopting any phase-2 lever.

## Decisions and trust constraints on phase 2

1. **Preserve proof obligations, not command spellings.** Equivalent checks may share work, but cached task status, local receipt, hosted required context, qualification and merge readiness are different facts.
2. **Heavy runs trusted `@main`.** Stage reusable-workflow interface changes before callers rely on them. Record the resolved workflow SHA as well as tested source SHA; a PR's edited Heavy file does not automatically execute.
3. **Coverage binds producer identity, inventory and current run/head/base/attempt.** Unit work now produces coverage. Compare-only jobs cannot accept arbitrary prior artifacts; runtime/provider changes need parity qualification.
4. **Cache trust remains profile/epoch/computation/reuse-layer scoped.** PRs read only; protected trusted producers write. Signed artifact integrity does not by itself prove complete inputs or confidentiality.
5. **Unknown routing runs checks.** Only enforced, non-revoked refinements skip; errors fail open to execution, shadow results still execute. Keep required context completion and producer-consumer consistency.
6. **Affected inputs include non-source consumers.** Root metadata, executable packet ops, manifests, tracked index discovery, native binaries and aliases can affect tests/checks even outside package src directories.
7. **No test depth reduction disguised as efficiency.** Property floors/seeds, canonical test census, baseline floors and external integration contracts survive partitioning.
8. **Local containment is part of sound execution.** Keep cgroup identity/reservations, memory floor, process cleanup, same-checkout/output exclusivity and detached proof ownership. Static token weights are policy estimates, not measured memory allocations.
9. **S11 is a merge exception, not evidence.** Standing repo instructions allow certain final PRs over attributed reds with thread/window conditions; current history includes #2541 holding introduced own-reds. Do not count S11 merges as green proof or optimize by accepting more reds.
10. **20-minute review window is independent of ten-minute jobs.** “Every job <10m” does not imply merge <10m. Failed review reads remain unknown.
11. **Operational R2 scope is paused and bounded.** Avoid silently reopening exhaustive qualification or paid infrastructure work; money is an escalation under repo charter.
12. **Attempt-aware measurement is mandatory.** Rerun queue estimates are invalid after attempt 1; cancelled/right-censored work matters. CPU, wall, RSS, queue, dollars and correctness are separate axes.

## What the operator's framing may have wrong

1. **“Every job under ten minutes” and “less compute” are not the same optimization.** B's expanded Unit layout lowers max Unit wall to 650s (still above 600), while Unit wall sum is 202.22m versus A's 150.83m and job count is 56 versus 40. Different heads prevent a causal penalty claim, but the sample decisively shows why makespan alone cannot establish compute savings. Track runner-class-weighted occupancy and CPU/RSS alongside latency.
2. **Coverage Regression is no longer the full coverage workload.** It is a 307–378s artifact comparison job in these runs; instrumentation is inside Unit producers. Optimizing the coverage label alone misses the long law-practice tests and may double-count already shared work. Integration is 38–89m, Policy ~12m, Property 11–18m; target their bodies first.
3. **The article is a historical narrative, not current scheduler documentation.** Its origin-wide exclusion and missing diary links describe earlier implementations. Current `QualityScheduler.ts:1480–1539` admits same-origin distinct-checkout peers; live queue/leases were empty. 2068 quarantine records do not establish active contention. Re-measure under a representative agent fan-out rather than solving a historical topology.
4. **A completed route packet is not completed affectable-surface routing.** Current `RouteFootprints.ts` enforces only packet/commits-out-of-build/check. The rest remains conservative; affected Turbo/coverage/change-profile selectors have different semantics. Generalize only from negative controls, not the word “completed.”
5. **Universal <600s success needs a workload domain and statistic.** Global toolchain/root config changes can legitimately affect all 200 packages; cold caches, native dependencies, shared workstations and remote services vary. A job timeout of 600s is not success. Decide whether the target is P95, a bounded workload class, or an absolute claim requiring different proof decomposition/resources.
6. **Cheapest-first is valuable but not a universal serial schedule.** It minimizes expected feedback only with useful failure probability/precision, dependency constraints and adequate context retention. Concurrent independent cheap lanes already exist. Reordering or serializing everything may delay certainty for rare expensive failures; collect first-actionable-red distributions.
7. **Today's economics does not prove the old KPI improved.** The current median 36.3m and article 43.3m use different windows/populations; current P95 12.03h and right censoring tell another story. The known 193/321 unreconstructable first-red attempts also limit ordering claims.
8. **Several obvious wins are already shipped.** Lazy CLI dispatch, batched package handoffs, shared proof hashes, install reuse, semantic JSDoc program loading, affected metadata consumers, early Storybook provisioning and root seal narrowing are not fresh ideas. Phase 2 must prove residual opportunity at current HEAD and coordinate the three open optimization PRs.

## Operator-only questions

- Is the ten-minute target an absolute maximum or a percentile, and does its clock include queue/admission, checkout/install and review waiting? Which cold-cache/global-change workloads must it cover?
- When faster feedback increases total runner occupancy or infrastructure spend, which objective wins and what already-authorized budget ceiling applies? This audit does not authorize new purchases.
- Is phase 2 allowed to revise proof cadence (for example move a class of assurance from each PR to a periodic gate), or must every current obligation remain on every currently selected PR? That is a trust policy choice, not a performance implementation detail.
- What representative workstation fan-out should be accepted: number of simultaneous agents, workload mix and protected non-agent resource reserve? The idle snapshot is insufficient for acceptance.
- Does the Nov 8 pause on R2 operational/qualification work remain binding for this audit's implementation phase? If resumed, is its scope still the six operational gates?

All remaining questions—actual test census, cache misses, source ownership, current runner resource utilization and sub-lane timings—are measurable engineering work rather than matters the operator must answer from memory.

## Suggested phase-2 acceptance evidence, not an implementation authorization

Freeze a current source/base/toolchain/runner profile and representative narrow-source, test-only, docs-only, root-policy and dependency-change cohorts. Record full-proof controls plus selected proof, all negative fixtures, first actionable red, time to green, queue/admission, setup, task-only duration, CPU/RSS, runner occupancy and cancellation waste. Require no lost failing witnesses, artifacts, test cases or ratchet checks. Compare warm and cold runs and realistic workstation fan-out. Coordinate #3005/#3007/#3014 before making overlapping changes. Retain failed and partial trials; a timed-out trial is not a fast proof.

## Memory provenance

Memory was used only as a discovery index; source verification superseded historical conclusions. Relevant index: `~/.codex/memories/MEMORY.md:114–130` (verification-route fail-open and admission pointers). No claims in this report depend solely on unverified memory.

## Reproducible hosted job ledger

Source command for each table: `gh run view <run> --json jobs,headSha,attempt,status`; all attempt 1. These IDs permit exact job/step lookup without relying on temporary local captures. Skipped leaves omitted.

### Run 42634939284

| Job ID | Job | Wall seconds | Conclusion |
|---|---|---:|---|
| 129223463844 | Commitlint | 32 | success |
| 129223464400 | SAST | 71 | success |
| 129223464421 | Security | 76 | success |
| 129223464432 | Secret Scanning | 26 | success |
| 129223464475 | Change Profile | 8 | success |
| 129223829345 | Codegen Drift | 69 | success |
| 129223829438 | Repo Sanity | 171 | success |
| 129223829512 | Shadcn Lint | 78 | success |
| 129223829522 | Labs | 157 | success |
| 129223829607 | Property Laws | 667 | success |
| 129223829656 | Nix Shell | 85 | success |
| 129223829668 | JSDoc Ratchet | 283 | success |
| 129223829718 | Fallow Advisory Envelopes | 188 | success |
| 129223829732 | Ecosystem Contracts | 94 | success |
| 129223829773 | Lint (lint-a) | 119 | success |
| 129223829832 | Test Unit (repo-cli-6) | 1053 | success |
| 129223829839 | Lint (lint-b) | 104 | success |
| 129223829890 | Professional Desktop IPC Stdio | 158 | success |
| 129223829905 | Test Unit (repo-cli-1) | 697 | success |
| 129223829910 | Test Unit (repo-cli-2) | 518 | success |
| 129223829930 | Test Unit (law-practice-2) | 713 | success |
| 129223829946 | Test Unit (unit-a) | 475 | success |
| 129223829953 | Test Unit (unit-c) | 662 | success |
| 129223829955 | Test Unit (repo-cli-5) | 438 | success |
| 129223830012 | Test Unit (repo-cli-4) | 722 | success |
| 129223830032 | Test Unit (repo-cli-3) | 533 | success |
| 129223830041 | Test Unit (law-practice-3) | 701 | success |
| 129223830074 | Test Unit (unit-d) | 710 | success |
| 129223830200 | Heavy Admission | 65 | success |
| 129223830208 | Test Unit (law-practice-1) | 1108 | success |
| 129223830421 | Test Unit (unit-b) | 720 | success |
| 129224458567 | Heavy / Test Integration | 2279 | success |
| 129224458581 | Heavy / Lint Policy | 712 | success |
| 129224458662 | Heavy / Docgen | 323 | success |
| 129224458664 | Heavy / Build | 65 | success |
| 129224458694 | Heavy / Doctest | 104 | success |
| 129224459203 | Heavy / Check | 74 | success |
| 129224996219 | Lint | 3 | success |
| 129234400020 | Test Unit | 3 | success |
| 129234486644 | Heavy / Coverage Regression | 378 | success |

### Run 42637312401

| Job ID | Job | Wall seconds | Conclusion |
|---|---|---:|---|
| 129228979416 | Commitlint | 33 | success |
| 129228979825 | PR Size Label | 78 | success |
| 129228979887 | Security | 61 | success |
| 129228980019 | Change Profile | 8 | success |
| 129228980021 | Secret Scanning | 29 | success |
| 129228980078 | SAST | 93 | success |
| 129229068656 | Labs | 128 | success |
| 129229068725 | Heavy Admission | 64 | success |
| 129229068901 | Ecosystem Contracts | 85 | success |
| 129229068916 | Repo Sanity | 176 | success |
| 129229068964 | Codegen Drift | 22 | success |
| 129229068996 | Shadcn Lint | 79 | success |
| 129229069116 | Fallow Advisory Envelopes | 178 | success |
| 129229069163 | Nix Shell | 104 | success |
| 129229069201 | Property Laws | 1084 | success |
| 129229069206 | Professional Desktop IPC Stdio | 154 | success |
| 129229069223 | Lint (lint-a) | 106 | success |
| 129229069240 | JSDoc Ratchet | 365 | success |
| 129229069285 | Lint (lint-b) | 100 | success |
| 129229070568 | Test Unit (repo-cli-1) | 507 | success |
| 129229070611 | Test Unit (repo-cli-6) | 514 | success |
| 129229070623 | Test Unit (repo-cli-2) | 528 | success |
| 129229070673 | Test Unit (repo-cli-5) | 416 | success |
| 129229070682 | Test Unit (law-practice-4) | 432 | success |
| 129229070701 | Test Unit (repo-cli-9) | 501 | success |
| 129229070712 | Test Unit (repo-cli-8) | 508 | success |
| 129229070723 | Test Unit (repo-cli-3) | 650 | success |
| 129229070740 | Test Unit (law-practice-9) | 289 | success |
| 129229070761 | Test Unit (repo-cli-7) | 545 | success |
| 129229070767 | Test Unit (law-practice-8) | 375 | success |
| 129229070773 | Test Unit (law-practice-1) | 343 | success |
| 129229070791 | Test Unit (unit-a) | 402 | success |
| 129229070792 | Test Unit (law-practice-7) | 375 | success |
| 129229070796 | Test Unit (repo-cli-4) | 507 | success |
| 129229070814 | Test Unit (unit-b) | 467 | success |
| 129229070882 | Test Unit (unit-d) | 486 | success |
| 129229070988 | Test Unit (law-practice-5) | 253 | success |
| 129229070990 | Test Unit (law-practice-10) | 341 | success |
| 129229071001 | Test Unit (law-practice-11) | 399 | success |
| 129229071044 | Test Unit (unit-g) | 469 | success |
| 129229071211 | Test Unit (law-practice-2) | 361 | success |
| 129229071212 | Test Unit (unit-c) | 376 | success |
| 129229071248 | Test Unit (unit-f) | 589 | success |
| 129229071254 | Test Unit (law-practice-6) | 327 | success |
| 129229071267 | Test Unit (law-practice-12) | 322 | success |
| 129229071288 | Test Unit (unit-e) | 497 | success |
| 129229071299 | Test Unit (law-practice-3) | 354 | success |
| 129229700836 | Heavy / Doctest | 154 | success |
| 129229700840 | Heavy / Test Integration | 2313 | success |
| 129229700948 | Heavy / Docgen | 148 | success |
| 129229701012 | Heavy / Build | 93 | success |
| 129229701070 | Heavy / Check | 84 | success |
| 129229701130 | Heavy / Lint Policy | 725 | success |
| 129230082695 | Lint | 4 | success |
| 129236140213 | Test Unit | 3 | success |
| 129236199188 | Heavy / Coverage Regression | 314 | success |

### Run 42619213744

| Job ID | Job | Wall seconds | Conclusion |
|---|---|---:|---|
| 129176073138 | Commitlint | 28 | success |
| 129176073199 | Change Profile | 8 | success |
| 129176073414 | Security | 89 | success |
| 129176073542 | SAST | 56 | success |
| 129176073710 | Secret Scanning | 27 | success |
| 129176148477 | Codegen Drift | 77 | success |
| 129176148491 | Repo Sanity | 178 | success |
| 129176148521 | JSDoc Ratchet | 372 | success |
| 129176148558 | Ecosystem Contracts | 95 | success |
| 129176148570 | Lint (lint-a) | 112 | success |
| 129176148577 | Lint (lint-b) | 86 | success |
| 129176148592 | Property Laws | 860 | success |
| 129176148625 | Fallow Advisory Envelopes | 179 | success |
| 129176148637 | Shadcn Lint | 93 | success |
| 129176148719 | Nix Shell | 101 | success |
| 129176148721 | Labs | 166 | success |
| 129176148772 | Professional Desktop IPC Stdio | 166 | success |
| 129176148781 | Test Unit (repo-cli-3) | 415 | success |
| 129176148800 | Test Unit (law-practice-2) | 1825 | success |
| 129176148824 | Test Unit (repo-cli-6) | 607 | success |
| 129176148847 | Heavy Admission | 69 | success |
| 129176148882 | Test Unit (law-practice-1) | 1652 | success |
| 129176148883 | Test Unit (repo-cli-4) | 944 | success |
| 129176148981 | Test Unit (unit-a) | 705 | success |
| 129176149006 | Test Unit (repo-cli-2) | 704 | success |
| 129176149025 | Test Unit (unit-c) | 1063 | success |
| 129176149116 | Test Unit (unit-b) | 750 | success |
| 129176149152 | Test Unit (law-practice-3) | 1501 | success |
| 129176149170 | Test Unit (repo-cli-5) | 430 | success |
| 129176149199 | Test Unit (repo-cli-1) | 552 | success |
| 129176149217 | Test Unit (unit-d) | 623 | success |
| 129176713734 | Heavy / Check | 74 | success |
| 129176713868 | Heavy / Lint Policy | 734 | success |
| 129176713918 | Heavy / Test Integration | 5345 | success |
| 129176714126 | Heavy / Doctest | 105 | success |
| 129176714197 | Heavy / Build | 61 | success |
| 129176714207 | Heavy / Docgen | 314 | success |
| 129177062078 | Lint | 4 | success |
| 129191287257 | Test Unit | 2 | success |
| 129191321243 | Heavy / Coverage Regression | 307 | success |
