# Verification-efficiency audit: surface inventory (phase 1)

Date: 2026-11-09. Repo: beep-effect `main` 7a31078ddd3. Method: orchestrator scouting, then a Workflow of
eleven Opus 5.5 readers (one area each) and a completeness critic (`wf_3297f768-8c7`, 12 agents, 760 tool
uses, 14 min), plus a blinded GPT-6 Astra (high) independent map (T3 delegate, `astra-surface-map.md` beside
this file when done). Detail files beside this one: `baseline-2026-11-09.md`, `components-compact.md`
(147 components), `levers-compact.md` (111 levers), `rejected-questions-gaps.md` (120 rejections, 83 open
questions, 78 gaps), `opus-maps.json` (full structured maps and critique).

Target under audit: every hosted CI job, local `yeet verify` and `yeet publish` under 10 minutes, with less
compute burned by parallel agents, without weakening trust. Principle: THE_AGENTIC_YOYO.md (cheapest precise
check first, scoped to the affectable surface; admission in small units; return to origin fast).

## 1. Baseline (where the time is today)

Hosted (GitHub Actions, runs sampled 2026-11-09 during a heavy-cap burst 2 -> 12):

| Measure | Value | Source |
| --- | --- | --- |
| PR run wall (56 jobs, #3007 layout) | 40 min | run 42637312401 |
| Main run wall | 41 min (46 incl. pending); 91 min pre-#3009 | runs 42634939284, 42619213744 |
| Critical path | Change Profile -> Heavy Admission -> Heavy / Test Integration (38 min, one unsharded job) | all three runs |
| Next tier | Test Unit law-practice/repo-cli shards 17-18.5 (main layout), Property Laws 11-18, Heavy / Lint Policy 12 | same |
| Main pending before first job | 0.8-46.6 min; 12-13 of 15 main runs on 11-09 cancelled (no verdict) | measurement, hosted-ci |
| Setup share | 7% of heavy runner-min, 13-19% hosted; 70-90% of wall on Lint shards, Nix, Shadcn, Ecosystem, Codegen | hosted-ci, deps |
| Cold `bun install` | 44-62 s on ubuntu-24.04, 7-9 s on beep-ec2; ssh2 postinstall 31 s | deps-toolchain |

Local (`yeet economics` v2, this checkout, 476 attempts, Aug 8 to Nov 9; fleet: 112 checkouts, 2,596 attempts):

| Lane | p50 | p95 | Share |
| --- | --- | --- | --- |
| pre-push (full verify) | 14.5 min (fleet 15.6) | 57 min (fleet 39.8) | 56% of wrapper time |
| cheap-gates (the publish gate) | 4.0 min | 11.6 min | 17% |
| final-check | 6.3 min | 50 min | 162 receipts |
| final-check coverage gate alone | 18-20 min | 41 min | skipped in 61% of receipts (106/175) |
| red-to-green episode (M1) | 36 min | 5.6-12 h | 54 episodes; baseline 43.3 min / 3.95 h |

Lint (`bun run lint`, 11-09): 287 s wall / 2,427 CPU-s cold, ~123 s warm; 198 `lint:laws` walks ~990 CPU-s;
Turbo hashing ~116 CPU-s before any task (PR #3014 in flight). Tests: law-practice-server = 91% of the local
unit lane and 45% of coverage weight (2,680 s solo at 1 worker), repo-cli 20% (1,192 s); the other 189
packages share 34%. Scheduler: capacity 10 tokens, idle 73% of the retained window, at most 3 leases.

## 2. The surface, by area

Grain legend: F = file, P = package, A = affected set (package + dependents), R = whole repo.

### A. Yeet local pipeline (publish, verify, final-check, ready)
- Two tiers in `Quality/internal/GithubChecks.ts`. cheap-gates = 27 lanes (26 preflight in declaration order,
  4-8 wide, collect-all; `lint:schema-catalog` alone in a heavy wave) + changeset-status off main. Full tier =
  31-32 lanes, fail-fast, ordered by a static seed from 2026-09-03 (`WaveOrder.ts`), stale against current p50s.
- `yeet publish` (push-first) = cheap-gates under a full-proof(3) lease -> head-install preflight (12 s) -> push.
  No test, no coverage. `yeet verify` = cheap-gates + pre-push + preflight (~18.5 min p50).
- `yeet final-check` = 9 gates one at a time, scoped `--affected --base <merge-base>`; `yeet ready` refuses
  without its receipt. Omits Doctest, Test Integration, Codegen Drift, Desktop IPC, Nix, SAST, Secrets, Security,
  Commitlint (AGENTS.md says "every hosted gate"; code disagrees).
- Grain: cheap-gates lanes are R (root tasks, whole-tree globs; speed comes from Turbo cache hits, not scoping;
  any `.ts` edit reruns jsdoc-ratchet:regenerated 188 s, effect-imports 143 s, effect-vitest 85 s, schema-first 57 s).
  Only Fallow lanes and changeset-status are diff-scoped. Full-tier ciLane steps are A.
- Proof reuse: whole-tree `LaneProofReuse` active; per-lane-digest `ProofLedger` shadow only, and its C4.2
  enforcement bar reads READY (324/200 attempts, 151/10 branches, 0 disagreements) with no owner (time-to-certainty paused).
- In flight: #3014 (Turbo inputs). Levers: Y3 package/file grain for cheap-tier scanners (high); Y6 publish-time
  coverage gap; Y4 admission per lane not per tier; Y2 C4.2 flip; Y5 re-seed wave order; Y7 hosted-receipt
  reuse in final-check (blocked by the parity-ledger rule); Y1 is an attribution artifact (see J).

### B. Coverage
- Producers: Test Unit partitions (13 on main, 28 on #3007) run each package's canonical `vitest run --coverage`
  under Node 22.23.4 and upload raw counters; Labs adds its own. Consumer: `Heavy / Coverage Regression`
  validates, merges shards, judges against `standards/coverage.regression-baseline.jsonc` (196 rows, floors
  70/70/50/60, epsilon 0.001) for affected owners + dependents vs the PR base rows. Comparator p50 314 s,
  but it waits for the slowest shard (p50 639 s, p90 1,287 s), so a coverage red lands 15-40 min after push.
- Local: `bun run coverage` bare = `--affected` since #3008; final-check runs it (p50 1,114 s when it runs; skipped
  61%). Publish runs none. Per-package cost: median 4 s, p90 23 s, two long poles (LPS 2,680 s, repo-cli 1,192 s);
  receipts show a package-scoped reproduction of a hosted red at 40-48 s.
- Constraints: coverage is `cache:false` by policy; "cache coverage results" rejected (bound to run + head);
  self-judge rule (a touched package cannot lower its own floor); Node 22 pin (node#63785); local is Node 24.
- Grain: A (owners + dependents) hosted and in final-check; P is cheap and unexploited; F possible for the two
  long poles via related-tests mapping (unproven).
- Levers: COV-L1 touched-package ratchet before publish (high; advisory); COV-L2 file-scoped delta for the long
  poles; COV-L3/L5 comparator per partition, split inherited vs introduced rows; COV-L7 Node 22 locally.
- Coverage Regression is NOT a required context on main's ruleset but gates Yeet "mergeable".

### C. Hosted CI
- `check.yml` (1,868 lines, ~40 jobs main / 56 PR) calls `heavy.yml@main` (6 beep-ec2-heavy Spot lanes: Lint
  Policy, Check, Test Integration, Docgen, Doctest, Build); `heavy-admit.yml` (label path); `rerun-runner-loss.yml`.
  15 required contexts (ruleset 10240248 = `standards/branch-protection-contexts.json`); Yeet waits on every job.
- Skips today: docs-only (admission skip-satisfied + tier-1 matrices skipped before runner allocation, #2935),
  goals-only, one enforced route refinement (packet markdown -> skip Build/Check), Docgen path filter, `hold`.
  Never skip: Change Profile, Commitlint, Secret Scanning, Security, SAST, Heavy Admission.
- Standing heavy cap 2 (bursts to 6-12 by manual Lambda edits; receipts under `~/.cache/beep/ci-burst/`); queue
  waits up to 2 h 52 min observed at cap 2. Main push runs never cancel in progress, run the full profile, and serialize.
- In flight: #3005 (16 integration partitions, 5.9-9.0 min each; lands at merge because heavy.yml is @main),
  #3007 (28 Test Unit partitions, all under 10.8 min; Coverage Regression compare 4-wide). After both: still over
  10 min = Property Laws (one task, `@beep/repo-cli#test:property` 577 s) and Heavy / Lint Policy (12 min).
- Levers: L1/L2 partitions vs the org concurrency ceiling (unverified "60"); L3 main serialization; L4 job-level
  skip instead of booting a VM to skip; L6 shard Property Laws, scope Lint Policy; L7 setup amortization; L8 cap policy (money).

### D. Turbo
- 2.11.10, 200 workspaces, 115 root tasks (83 cache:true, 26 cache:false), 27 overlays (eyecite all cache:false).
  Global key: 7 inputs + 4 env + root external-dependency hash (lockfile), so any root devDependency bump (Biome,
  oxlint, vitest, tsrs, effect), root tsconfig or root scripts projection edit re-keys ~580 tasks. Since 10-25:
  31/725 commits touched a global input, 71 touched bun.lock (Yeet sets TURBO_FORCE on lockfile change).
- Hub-dominated: 7 packages (fc-runs, types, test-runner, identity, utils, data, schema) have 189-197 dependents;
  every test depends on `^transit` + `@beep/utils#transit`, so a hub src edit replays ~all 198 tests.
  Soundness gap: vitest.setup.ts imports @beep/glob but 128/200 tests do not key on it (T5).
- Cache: shared local dir 20 GB; 6,395 LOCAL vs 1 REMOTE hits in 400 summaries (R2 brings ~nothing locally);
  hosted PRs read-only, main writes; hit rates build 93%, check 84%, lint 97%, test 49%, coverage 0%.
  Qualification program paused with 0 tasks qualified; `quality:cache-policy` gates any input/cache change.
- Levers: T2 shrink global key (high, stale-green risk); T3 root devDependency isolation; T4 narrow test hash
  chain for hubs (high risk); T6 stop turbo.json/standards edits escalating Lint Policy and coverage to full;
  T1 glob hashing (#3014); T9 TURBO_FORCE scope; T8 cached defaults for new workspaces.

### E. Lint, laws, policy seals, JSDoc, schema catalog (+ knowledge gates)
- ~45 gates in four layers: per-package `lint` (Biome + 8 GritQL plugins, 198 tasks); per-package `lint:laws`
  x198, `lint:jsdoc` x183, `lint:deprecated-apis`; ~35 root `//#` whole-repo tasks behind 39 policy seals;
  lefthook pre-commit on staged files. `lint policy` = cheap(10) -> medium(12 laws + ~15 state) -> knowledge
  doctor (hosted only, 210-245 s serial) -> tail (abreast since #2997).
- Hosted Lint Policy 712-738 s: medium graph 368 s at width 4 (jsdoc:inventory:check 233 s), knowledge 215 s
  serial, tail 59 s. Changed scope escalated to full on 7 of 9 sampled PRs (1,227 sealed files incl. all of
  @beep/schema). Duplicates: JSDoc Ratchet job and Lint Policy both compute jsdoc:inventory (same hash, both
  miss); Shadcn lint twice; Repo Sanity runs schema-catalog uncached (45 s) and changeset-graph twice.
- ~6 ts-morph tools parse the same TS tree separately (schema-first, schema-catalog, effect-imports,
  effect-vitest, jsdoc inventory, opaque-roundtrips).
- Grain: per-file verdict exists in principle for schema-catalog (splice), schema-tag-idioms, effect-imports,
  oxlint rules; R by construction for membership/orphan checks (identity registry, orphan shards, seals, schema-first inventory).
- In flight: #3014 (PR A), PR C unstarted (noResolve 152 -> 22 s; opaque pre-pass; pruned laws walk).
- Levers: L1 noResolve (high), L2 dedupe inventory (high), L3 narrow escalation triggers (high), L4 knowledge
  doctor abreast or own job (high), L5 shared parse, L6 file-level forms + cheap membership join, L7 one Turbo
  graph for cheap-gates, L11 typos on staged files only.

### F. Tests
- 205 per-package vitest configs merging `vitest.shared.ts` (modes: unit, doctest, coverage isolate:false,
  property). Turbo: `test`/`test:property`/`doctest` dependsOn ^transit; integration and coverage dependsOn
  ^build, cache:false. Hosted Test Unit always `--force` (coverage output), never reads the test cache.
- Long poles: law-practice-server (maxWorkers 2 across 299 files; real-clock extractDeadline 30 s; native
  spawns) and repo-cli (research-library-views.test.ts 449 s on PR runners, 200 s on main; PR runners ~1.5x slower).
- No file-level test selection anywhere (no `--changed`/related); PR selection is package `--affected` only.
- Property Laws = effectively one task (repo-cli sweep 577 s, 4,664 tests, 3 workers). Doctest/Docgen cheap
  hosted only because of the remote cache (cold cost unmeasured).
- Levers: T1 file-level selection inside an affected package (high; unsound for the coverage producer of record
  unless advisory); T2 shard Property Laws; T3 narrow ^transit for hubs (stale-green risk); T6 fix
  research-library-views; T7 LPS deadline tests on an injected clock; T9 admit test work per shard locally.

### G. Local admission scheduler and compute governance
- One scheduler: `internal/repo-run/QualityScheduler.ts` (~14k lines with schemas/journal/run-scope). Only
  `yeet` takes leases: verify/cheap-gates/publish = full-proof(3), `--merged` = merged-preview(5), review-fix(1).
  final-check, package-verify, ad-hoc vitest/coverage/docgen and monitors run UNADMITTED. Capacity = memory only:
  min(10, floor((MemAvailable-10)/5)). Priority + FIFO + 120 s aging; no starvation bound (console escalation at 2 and 10 min).
- Journal ring = 200 admissions (~2.8 days): idle 73%, max 3 concurrent leases, wait p50 0.04 s / p90 86 s /
  max 644 s; hold p50 4 min / p90 7.6 / max 88. All 200 grants full-proof(3) (165 at publish priority); measured
  cgroup peak p50 22.9 GiB vs the 15 GiB the weight assumes. docs/goals branches took 51/199 leases and ~42% of lease-hours.
- Operator recollection vs evidence: "tiny changes queue a full proof" = true (cheap-gates charges full-proof
  weight regardless of diff since #2076); "one agent hogs the seat, others bounce" = the legacy per-origin
  LOCK era (all 46 local / 187 fleet lock-bounce receipts fall 2026-08-08..31; lock retired by 09-23);
  "agents killed each other" = the 2026-10-31 pkill incident, not the scheduler.
- Binding constraint: not memory in steady state (MemAvailable p50 82 GiB, mem-some p99 2.5%); CPU-some p99 21%,
  max 66%. The one deep dip (4.6 GiB free) happened with ONE lease: unadmitted work caused it.
- ~2,068 stale quarantine lines in `status` (1,505 merged-preview leases from September); the `beep-heavy`
  wrapper doctrine still lives in memory/skills beside the token scheduler.
- Levers: L3 admit the unadmitted work in small units (high), L4 lane/package as the admission unit (high),
  L1 charge cheap-gates/docs publishes by footprint, L2 recalibrate weights to measured peaks, L5 CPU dimension,
  L6 declared starvation bound, L7 retire beep-heavy doctrine and quarantine residue, L8 journal retention.
  "A second scheduler or lock" is rejected on record; a "checker agent" would be exactly that.

### H. Dependencies, install, toolchain
- 200 workspaces, hoisted linker, 259-entry catalog, 17 overrides, 5 patches; bun.lock 1.03 MB -> 2,336 packages.
  Every hosted job does a full unscoped frozen install; no dependency cache (archive cache rejected: restore
  cost more than install); the EC2 AMI fast path has missed every job since 2026-09-09 (Bun 1.4.2, old lockfile).
- Head-install preflight passed 153/153 locally and 839/842 fleet-wide; it is NOT the top first red (see J).
- Typecheck: each package passes over src three times (build emit; tsconfig.check.json; tsconfig.test.json);
  only build's tsbuildinfo is cached. Effect catalog bump reaches 197/200 workspaces and re-keys everything.
- Levers: L1 scoped `bun install --filter` for package-scoped lanes (high), L2 contain ssh2 postinstall,
  L3 short lanes on EC2, L4 root devDependency isolation, L6 collapse duplicate src passes, L7 image/cache or retire the AMI.

### I. Change classification and routing
- Seven independent path classifiers at two grains: the replay-proven route (`Ci/Route*`: 28 atom kinds, total
  footprint over 24 lanes, ONE enforced refinement; `propagation` is a label, so it is kind-aware, not
  package-aware); the regex profile (`CiOperational.patterns.json`: docs_only/goals_only/desktop) which does
  most hosted skipping and is NOT replay-covered (widened 11-09 by #2999); Turbo `--affected`; CoverageScope;
  LintPolicyScope; docgen mode; inline greps and lefthook globs.
- They disagree measurably: for #3012 (README + runbook) the route selects 24/24 lanes, the regex skips most
  hosted jobs, Turbo selects 0 tasks. A test-only law-practice commit still scheduled 97 dependency builds.
- Census (5,083 PR heads, 11,710 h): Test Unit 2,614 h, Lint Policy 873, Coverage 772, Property 765, Lint 730,
  JSDoc 665. Pure-kind loss is small; agent PRs are mixed, so package-grain selection is the unexploited lever.
- Levers: VR-1 package-aware route (high), VR-2 unify regex with footprints under replay (high), VR-3 route the
  cheap-gates tier, VR-4 cut the ^build closure for check, VR-5 refresh the corpus past 10-30, VR-6 collapse classifiers.
- Gate for any new refinement: mutation fixture + 100% replay recall; shadow can only revoke.

### J. Measurement and telemetry
- Five stores, none joined: `yeet economics` (attempts.ndjson), `ci lane-timings` (GitHub API; aborts on one
  502; peakRss empty), final-check receipts (per-gate durationMs, overwritten per head), Turbo `--summarize`
  (1,816 local files / 6.4 GB; hosted 7-day artifacts nobody reads), admission journal (~3-day ring).
- Attribution defect: economics `actionableLane` falls back to `failedStepId`, so Aug-26 proof-lock handler
  errors were charged to head-install-preflight (46/46 local, 182 fleet). Y1 is built on that artifact.
- Not measurable today: per-machine throughput under N agents (PSI never persisted), hosted per-task durations
  (artifacts unread), per-file vitest durations (#3007 scrapes logs), time-to-main-verdict.
- Levers: M-L1 joined per-check ledger (high), M-L2 ingest hosted turbo summaries (high), M-L3 stamp host
  pressure on attempts/admissions, M-L4 main pending + cancellation metric, M-L5 lane-timings robustness,
  M-L6 journal final-check runs, M-L7 classify unlocated first failures.

### K. Prior art and constraints (the audit must respect)
- Coverage evidence bound to run + head; never cached. heavy.yml at @main: hosted lane changes take two PRs.
  Cache reuse only after qualification and shadow; Turbo is the single result cache (no persisted memos).
  Proof reuse shadow before enforce. Route refinements admitted by replay + fixtures, never a measurement window.
  Required contexts always present (skip-satisfied). The scheduler is the only admission authority. Capacity is
  the operator's lever (money). S11 merge over attributed reds. Push-first D1-D11. Doctest stays full fleet
  (ruling 20). Bare `bun run test` stays a full proof (EF-20).
- 120 rejections on record (see `rejected-questions-gaps.md`), including: archive/dependency caching, shallow
  checkout, PR cache write, partial JSDoc inventory, persisted lint memos, merged bins, Test Unit on the heavy
  pool, two vitest workers per hosted integration partition, bare `test --affected`, merge queue before 80%
  main-green over 14 days, native stacks now, main-red admission hold.
- Parked with reopen conditions: C4.2 flip, ProofFact re-key on footprint, WaveOrder planner seam, merge
  queue (E8), stacked PRs, `beep ci slots` governor (signed, never built), draft matrix skip, hosted-receipt reuse.

### L. Areas the critic found uncovered (to add to phase 2)
Vercel preview builds (3 apps, full install each, rate-limit exemption in the merge rule); `yeet monitor`
polling as a GitHub REST load source (30 s loop, 6 resident services seen); the 20-min review window and
merge-gate latency as non-compute wall; Fallow lanes (run in three places, scan shape unmapped); always-on
Security/Secrets/SAST/Commitlint/Nix jobs; Desktop IPC, Labs, Codegen Drift, Ecosystem, Shadcn content;
storybook.yml (Playwright Chromium per run; unmeasured); knowledge gates (semantic-delta 162 s, refs-check 32 s,
doctor 210-245 s = ~30% of Lint Policy wall, cache-bypass by D2); changesets/commitlint (changeset-status has
431 undeclared-input misses); the compiled beep CI binary; merged-preview (5 tokens, 0 grants in window,
1,505 quarantined leases); git/worktree churn; fleet hosts as compute; agent seats as unattributed load;
lefthook (typos scans the whole repo; ts-morph writers per commit); attempt-journal retention on lane retire;
side workflows; docgen/doctest cold cost.

## 3. Cross-cutting findings (3+ readers each)
1. Whole-repo scanners and coarse invalidation dominate; package-grain selection exists in the data (route atoms
   carry `pkg`, Turbo knows the graph, CoverageScope knows owners) but nothing uses it to select.
2. Two packages are the long poles everywhere (law-practice-server, repo-cli).
3. Admission covers too much (a whole tier per lease) and sees too little (final-check, package-verify, ad-hoc
   coverage run unadmitted); the scheduler is idle 73% of the time.
4. Duplicate execution across surfaces (jsdoc inventory twice hosted, Shadcn twice, schema-catalog uncached in
   Repo Sanity, cheap-gates rerun inside final-check, uncached laws rerun in verify).
5. Escalation to full scope defeats affected selection (Lint Policy 7/9 PRs; coverage full fallback; TURBO_FORCE on lockfile).
6. Measurement stores do not join and attribution is wrong in at least one headline number.
7. Setup/install tax dominates short hosted jobs; the only warm-image path is dead.
8. Remote cache reuse is near zero on the workstation; the qualification program is paused with 0 tasks qualified.
9. Main serializes and mostly gets cancelled: most merged commits never receive a hosted verdict.
10. Doc/code drift is common (AGENTS.md final-check claims, turbo-cache-inputs G10 rows, local-docs-gates
    disposition, D1 cheap-gates exemption, lane-proofs retirement, aws-cost setup median).

## 4. Operator questions that change phase 2 (from the critic and readers)
1. What does "under 10 minutes" measure: per-job wall, run wall (incl. main pending), push -> required-context
   verdict, or push -> mergeable (which includes the 20-min review window by rule)? Do non-required gates that
   still gate Yeet mergeable (Coverage Regression, Property Laws, Lint Policy) count?
2. Does this audit supersede ci-lane-economics' 20-minute p95 charter, and who owns the C4.2 ProofLedger flip?
3. Scheduler direction: extend QualityScheduler to lane/package units and cover unadmitted work, or a new
   "checker agent" (which the record rejects as a second authority)?
4. Is full canonical corpus replay required on every PR (R1), or smoke-on-PR plus merge-group/nightly (Q13)?
5. Money: standing heavy cap, EC2 for short lanes, org concurrent-job limit (unverified "60").
6. Should Coverage Regression become a required context, paired with a cheap touched-package pre-check?
7. Where does the audit live: a new exploration packet (research/ in repo) or this scratchpad?

## 4b. Blinded GPT-6 Astra (high) map: diff against the Opus maps
`astra-surface-map.md`: 32 components, a 28-row rejected/held ledger, 12 trust constraints, a reproducible
per-job ledger for runs A/B/C. Agreement is near-total on components, owners, in-flight PRs and rejections.
What Astra adds or sharpens:
- Latency and compute are different objectives: the #3007 layout lowers the slowest Unit job 1,108 -> 650 s but
  raises Unit job-wall sum 151 -> 202 min and job count 40 -> 56 (different heads, so not causal; still, a
  per-job target alone cannot prove compute savings). Track runner-minutes and CPU/RSS beside the makespan.
- Coverage Regression is a 307-378 s comparator, not the coverage workload; the instrumentation lives inside
  the Unit producers. Integration (38-89 min), Lint Policy (~12), Property (11-18) are the bodies to target.
- THE_AGENTIC_YOYO.md is a historical narrative: the current scheduler admits same-origin distinct-checkout peers
  (QualityScheduler.ts ~1480-1539); the 2,068 quarantine rows are residue, not contention. Re-measure under a
  representative agent fan-out instead of solving the 2026-08 topology.
- "Verification route completed" means one enforced refinement, not affectable-surface routing.
- The 10-minute claim needs a statistic and a workload class (global toolchain/root changes can legitimately
  touch all 200 packages; a 600 s timeout is not success).
- Cheapest-first is not a universal serial schedule; it needs failure-probability and precision per lane, and
  concurrent cheap lanes already exist. Collect first-actionable-red distributions before reordering.
- Economics windows differ, so today's M1 36.3 min does not prove the 43.3 min baseline moved.
- Operator-only questions Astra adds: may phase 2 move a class of assurance from every PR to a periodic gate
  (trust policy, not performance)? what representative fan-out (agents, mix, protected reserve) is the acceptance
  condition? does the Nov 8 R2 pause bind phase 2?
Minor divergences: Astra observed 0/10 tokens and an empty queue at 16:38Z while the orchestrator saw 3/10 with
one lease at 16:30Z (timing). Astra lists a `publish 1` weight in the schema; the Opus reader confirms publish is
charged full-proof(3) at publish priority (ship-velocity D1 deviation 1 rejected weight 1). Both are true.

## 5. Proposed phase 2 shape
Per area (A-L): one Opus 5.5 auditor and one GPT-6 Astra (high) auditor, same brief, independent; each ranks
levers by (minutes saved per week across hosted + local) / (trust risk), names the admission gate per lever
(replay fixture, qualification, parity ledger, measurement), and the rejected mechanisms it must not re-propose.
Then an adversarial refute pass (3 Opus skeptics per surviving lever, different lenses: soundness, prior art,
measurement), a cross-provider diff (Astra vs Opus), and a synthesis into a ranked plan with PR-sized slices.
Measurement lanes run bounded real measurements where the maps say "unmeasured" (per-package coverage cost on a
quiet host, cheap-gates per-lane peak RSS, hosted turbo-summary ingest for one week, lefthook commit cost,
main pending/cancellation census). Out of scope for phase 2: anything in flight (#3005, #3007, #3014) and any
lever whose only route is money.
