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

### Phase 2 (in progress)

Twelve areas (A yeet pipeline, B coverage, C hosted CI, D Turbo, E lint/laws/knowledge, F tests,
G scheduler, H deps/toolchain, I routing, J measurement, L1 peripheral hosted, L2 peripheral local), one
Opus 5.5 auditor and one GPT-6 Astra (high) auditor each, briefed by `research/phase1/` plus the four
rulings in `DECISIONS.md`. Deliverable per lever: mechanism, grain and its soundness, savings estimate with
basis, trust risk and failure mode, admission gate, prior art, PR slices, confidence. Findings land under
`research/phase2/` when they arrive, followed by an adversarial refute pass and a ranked plan.
