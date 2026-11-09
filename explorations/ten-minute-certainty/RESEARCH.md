# Research

<!--
Stage 1. Dated sections. (a) external landscape, every claim cited;
(b) in-repo capability inventory, citing package + path, gaps marked NOT FOUND.
-->

## 2026-11-09 — phase 1: the verification surface

### In-repo capability inventory

The full inventory is [`research/phase1/SURFACE-INVENTORY.md`](./research/phase1/SURFACE-INVENTORY.md)
(12 areas, 147 components, 111 candidate levers, 120 rejections on record, the completeness critic's
uncovered areas, and the diff against a blinded GPT-6 Astra map). Compact tables beside it:
[`components-compact.md`](./research/phase1/components-compact.md),
[`levers-compact.md`](./research/phase1/levers-compact.md),
[`rejected-questions-gaps.md`](./research/phase1/rejected-questions-gaps.md),
[`astra-surface-map.md`](./research/phase1/astra-surface-map.md),
[`baseline-2026-11-09.md`](./research/phase1/baseline-2026-11-09.md).

The bricks the audit composes (all live in `packages/tooling/tool/cli/src/`):

| Brick | Path | What it already does |
| --- | --- | --- |
| Yeet proof tiers and waves | `commands/Quality/internal/GithubChecks.ts`, `commands/Quality/Quality.plan.ts`, `commands/Yeet/internal/{Planner,WaveOrder}.ts` | cheap-gates (27 lanes) and full tier (31-32 lanes), static waves, evidence-ordered seed from 2026-09-03 |
| Proof reuse | `commands/Yeet/internal/{ProofLedger,ProofFact,ProofShadow,ProofDigest,ProofState}.ts` | per-lane-digest ledger in shadow; whole-tree `LaneProofReuse` active; C4.2 bar reads READY |
| Final-check and ready gate | `commands/Yeet/internal/{FinalCheck,FinalCheck.schemas,FinalCheckRefresh,ReadyGate}.ts` | nine gates scoped to the merge base; head-pinned receipt required by `yeet ready` |
| Coverage ratchet | `commands/Quality/internal/{CoverageScope,CoverageRegression,CoverageArtifacts}.ts`, `commands/Ci/CiCoverage.ts`, `standards/coverage.regression-baseline.jsonc` | owner + dependents scope, per-package weights, self-judge rule, hosted artifact comparator |
| Hosted lanes and partitions | `commands/Ci/{CiLane,CiLanePartitions,LaneTimings,HeavyAdmission,CiAdmission}.ts`, `.github/workflows/{check,heavy,heavy-admit}.yml` | 24 lane ids, LPT partition plans, admission verdicts, route skips to heavy lanes |
| Verification route | `commands/Ci/Route*.ts`, `standards/verification-route.sentinel.json` | 28 atom kinds, total footprint over 24 lanes, replay corpus (5,083 PR heads), one enforced refinement |
| Change profile | `commands/Ci/CiOperational.{schemas,service}.ts`, `CiOperational.patterns.json` | docs-only, goals-only, desktop profiles consumed by admission and tier-1 skips |
| Admission scheduler | `internal/repo-run/QualityScheduler.ts` and siblings, `~/.beep/runtime/beep-admit-uid-1000/` | memory-token capacity (10), weights 3/5/1, FIFO + 120 s aging, journal ring of 200 admissions |
| Lint policy and seals | `commands/Lint/*`, `commands/Laws/*`, `commands/Quality/internal/LintPolicyScope.ts`, `standards/policy-tools.fingerprint.json` | ~45 gates; changed-scope with full-scope escalation; 39 per-task seals |
| Turbo graph | `turbo.json` (115 tasks), 26 overlays, `commands/Quality/internal/TurboConfigProof.ts`, `commands/Cache/*` | affected selection, global inputs, cache posture, qualification ledger |
| Economics and timings | `commands/Yeet/internal/{Economics,AttemptJournal}.ts`, `commands/Ci/LaneTimings.ts` | M1/M2/M4/M5 proxies from attempt journals; hosted job and step timings |

### Constraints discovered (binding on every lever)

Coverage evidence is bound to run and head and is never cached. `heavy.yml` is called at `@main`, so a
hosted heavy-lane change lands in two PRs. Cache reuse needs per-computation qualification and shadow;
Turbo is the single result cache. Proof reuse is shadowed before it is enforced. Route refinements are
admitted by mutation fixture plus 100% replay recall, never by a measurement window; the live shadow can
only revoke. Required contexts are always present, as skip-satisfied. The QualityScheduler is the only
admission authority. Capacity is the operator's lever (money). Doctest stays full fleet (ruling 20); bare
`bun run test` stays a full proof (EF-20). Full list: inventory section K; 120 rejections in
`rejected-questions-gaps.md`.

### Baseline (2026-11-09)

Hosted: PR run wall 40 min and main 41 min (91 min before #3009); critical path Heavy / Test Integration
38 min (one job; #3005 merged after this measurement and splits it into 16 partitions of 5.9 to 9.0 min).
After #3005 and #3007: Property Laws (11 to 18 min, one repo-cli task) and Heavy / Lint Policy (12 min) stay
over 10. Main pending before the first job 0.8 to 46.6 min; 12 of 15 main runs cancelled. Local: pre-push
p50 14.5 min and p95 57; cheap-gates p50 4.0 and p95 11.6; final-check p50 6.3 and p95 50, coverage gate
alone p50 18 to 20 min and skipped in 61% of receipts; red-to-green p50 36 min. Full table:
`research/phase1/baseline-2026-11-09.md`.

### Cross-cutting findings (three or more independent readers each)

1. Whole-repo scanners and coarse invalidation dominate; package-grain selection exists in the data (route
   atoms carry the package, Turbo knows the graph, CoverageScope knows owners) but nothing uses it to select.
2. Two packages are the long poles everywhere: law-practice-server and repo-cli.
3. Admission covers too much (a whole tier per lease) and sees too little (final-check, package-verify,
   ad-hoc coverage run unadmitted); the scheduler is idle 73% of the time.
4. Duplicate execution across surfaces (jsdoc inventory twice per hosted run, Shadcn twice, schema-catalog
   uncached in Repo Sanity, cheap-gates rerun inside final-check).
5. Escalation to full scope defeats affected selection (Lint Policy on 7 of 9 PRs; coverage full fallback;
   TURBO_FORCE on any lockfile change).
6. Measurement stores do not join; the economics report misattributes Aug-26 lock bounces to the install
   preflight.
7. Setup and install tax dominates short hosted jobs; the only warm-image path is dead.
8. Remote cache reuse is near zero on the workstation; the qualification program is paused with 0 tasks qualified.
9. Main serializes and mostly gets cancelled.
10. Doc and code drift is common (AGENTS.md final-check claims, turbo-cache-inputs G10 rows, and others).

### External landscape

NOT YET RESEARCHED in this packet. THE_AGENTIC_YOYO.md carries the prior external reading (the AgentO
derivation discipline; Turborepo's single-player assumptions). Phase 2 auditors may cite external sources;
each will be added to `research/SOURCES.md` with its URL when it is.

## 2026-11-09 — phase 2: per-area audits, merge, refute, rank

Twelve areas (A yeet pipeline, B coverage, C hosted CI, D Turbo, E lint/laws/knowledge, F tests,
G scheduler, H deps/toolchain, I routing, J measurement, L1 peripheral hosted, L2 peripheral local), one
Opus 5.5 auditor and one GPT-6 Astra (high) auditor each, briefed by `research/phase1/` plus the four
rulings in `DECISIONS.md`; neither seat saw the other. Seat reports: [`research/phase2/`](./research/phase2/)
(96 Opus levers, 91 Astra levers). Phase 2b merged the seats per area (125 levers), put every material
lever through two independent skeptics (69 reviewed; 15 refuted by the first, 1 more by the second),
synthesized the ranked plan and ran a cross-area critic: [`research/phase2/PLAN.md`](./research/phase2/PLAN.md),
with the per-area records under [`research/phase2/merged/`](./research/phase2/merged/).

### What the plan says

- **The hosted target is not reachable at the current heavy pool.** Peak heavy demand is about 260 slot-min/h
  against 120 supplied at cap 2. After the no-money levers (the Lint Policy diet, the admission-chain fix,
  job-level skips) the projected p95 push-to-required-green for code heads is 70 to 115 min, from 124.5.
  Closing the rest needs capacity (a money decision) or a much smaller Test Unit and Test Integration
  envelope, which only a #3005/#3007 steady-state measurement can confirm.
- **Main verdicts are a correctness repair.** 13% of main commits get a verdict today; 27 of 60 recent main
  runs were cancelled by hand mid-run, licensed by the AGENTS.md runner-freeing law. A no-cancel rule gets to
  about 55 to 65%; per-SHA groups get above 95% but cost 20 to 36k runner-min/day at the full profile unless a
  throughput layout lands first.
- **Eight trust repairs come first, even at a cost:** main verdicts; the `@beep/glob` setup-closure stale green
  (127 of 200 test tasks do not key on it); goal-folder data consumers misrouted as docs-only by #2999 (eyecite
  and law-practice tests read a `goals/` fixture; citation ops scripts run from `goals/`); knowledge policy
  skipped on docs/goals-only PRs since #2935 (two confirmed escapes); the bare-coverage self-judge; final-check
  receipt versioning and its omitted required contexts; the Node 22 coverage runtime; base-ref CI patterns.
- **Compute:** runner-minutes per green code run fall by about 20 to 40 from a p50 of 264. The largest items
  are owner-mapping generated standards files in CoverageScope (about 8% of runs go from a full to a repo-cli
  fan-out), the Property Laws file split, folding Fallow into Labs, one hosted `lint:shadcn` owner, the Nix,
  Security and SAST install removals, and the JSDoc inventory with `noResolve`.
- **Local:** publish p95 from 11.6 to about 6 to 9 min (the JSDoc and effect-imports poles shrink); verify
  p95 stays at 25 to 45 min while law-practice-server coverage (2,680 s solo) remains the long pole; the only
  route below that is running the hosted Test Unit partitions locally as admitted units, which is high risk
  and undemonstrated.
- **Dropped:** 16 refuted levers (one Turbo graph for the cheap tier, hosted Lint Policy on standard runners
  at 32 to 36 GiB peaks, consumer-aware escalation narrowing, tool-dependency isolation, treeless checkout,
  short lanes on EC2, caching eyecite, and others) and 3 that share a refuted mechanism.
- **Measurement first:** a nightly head-SHA scorecard (push-to-required-green with red, held and api-partial
  heads counted as misses; runner-minutes per run; main verdict rate), per-attempt job reads, the economics
  attribution fix, partition-job mapping in the route corpus, and journal retention on lane retirement. No
  target claim is checkable without them.

### Candidate goal packets named by the synthesis

`certainty-scorecard`, `route-soundness-repair`, `main-verdict-every-commit`, `heavy-pool-diet`,
`hosted-setup-tax`, `local-proof-under-ten` (missions, levers and dependencies in `PLAN.md`). These are
candidates for the decompose stage, not decisions.

### External landscape

Still NOT RESEARCHED in this packet; no seat cited an external source.
