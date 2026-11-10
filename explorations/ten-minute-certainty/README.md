# Ten-Minute Certainty

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Agents ship code and the hosted Coverage Regression job fails because nothing compared the touched
packages against the ratchet before publish. More generally: `yeet publish`, `yeet verify` and the hosted
check run still verify far more than a change can affect, hold shared compute in whole-proof units, and
leave agents spinning. Target, as ruled on 2026-11-09: on pull-request runs, p95 push-to-every-required-
context-green under 10 minutes, reported beside runner-minutes per run; every main commit gets a hosted
verdict; local verify and publish under 10 minutes; checks scoped to the affectable surface and ordered
cheapest-precise-first (THE_AGENTIC_YOYO.md), admitted to local compute in lane- or package-sized units
through the existing QualityScheduler.

## Next Open Question

None: the packet graduated on 2026-11-09 into six goals, and the work continues there.

- [`goals/certainty-scorecard`](../../goals/certainty-scorecard/README.md) and
  [`goals/route-soundness-repair`](../../goals/route-soundness-repair/README.md) go first and have no
  upstream.
- [`goals/main-verdict-every-commit`](../../goals/main-verdict-every-commit/README.md),
  [`goals/heavy-pool-diet`](../../goals/heavy-pool-diet/README.md),
  [`goals/hosted-setup-tax`](../../goals/hosted-setup-tax/README.md) and
  [`goals/local-proof-under-ten`](../../goals/local-proof-under-ten/README.md) each name in their
  `statusNote` what starts now and what waits on the first two.

The three first PRs open from their goal lanes: ROUT-03 slice 1 (`route-soundness-repair`), TURB-01 slice 1
(`hosted-setup-tax`) and MEAS-01 slice 1 with MEAS-04 (`certainty-scorecard`). D8's rollback clause is dated:
if the ROUT-03 census PR has not landed by 2026-11-16, the #2999 widening is rolled back in full.

This packet reopens at `decompose` when a gate in `MAP.md` (Gated candidates) fires. It also holds the
seventeen backlog rows no goal owns.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's request and rulings (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - the in-repo inventory and constraints (stage 1).
4. [`research/phase1/SURFACE-INVENTORY.md`](./research/phase1/SURFACE-INVENTORY.md) - the phase 1 surface map
   (12 areas, 147 components, 111 levers, 120 rejections on record, critic gaps, Astra diff).
5. [`DECISIONS.md`](./DECISIONS.md) - the operator's 22 rulings of 2026-11-09 (D1 to D22) and the six
   graduation decisions the agent took (D23 to D28).
6. [`BRIEF.md`](./BRIEF.md) - the shaped pitch (approved D20).
7. [`MAP.md`](./MAP.md) - six goal packets, sequencing, first slice, capability check (approved D21), the
   state at graduation, backlog rows and gated candidates.
8. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

- 2026-11-09 (graduated): six goals scaffolded through `explore graduate` and authored from the brief, the
  map and the rulings: `certainty-scorecard`, `route-soundness-repair`, `main-verdict-every-commit`,
  `heavy-pool-diet`, `hosted-setup-tax`, `local-proof-under-ten`. Every lever was re-read from `main`
  first: LINT-01, LINT-04 and ROUT-01 had landed, TEST-01, PERIL-03 and MEAS-03 in part (`MAP.md`, State at
  graduation). Six agent decisions logged (D23 to D28): homes for COVE-08, COVE-04, PERIL-09 and TURB-10,
  seventeen backlog rows, capability edges, landed levers and the Property Laws split, the monitor split
  with the github-api-quota goals, and per-SHA main groups handed to the merge-queue packet after the
  operator's `verdict-placement` ruling there. Retained whole until the six goals close.

- 2026-11-09 (shape and decompose): BRIEF.md and MAP.md approved as drafted (D20, D21); landing ruled
  as exploration first, graduation in a follow-up PR (D22). Stage `decompose`; graduation pending.

- 2026-11-09 (align closed): four grill rounds settled all nineteen rulings on the recommended
  answers (target scope, Coverage Regression status, staged main verdicts, #2999 narrowing, full corpus
  replay per PR, Property Laws split-first, Lint Policy on heavy with the diet, patch-id review-window
  anchor, TTC seams re-homed, R2 pause binding, bounded in-publish advisory coverage, monitor back-off and
  REST budgeting, merged-preview dormant, fleet economics, whole program sequenced). BRIEF.md and MAP.md
  drafted; stage `shape`.

- 2026-11-09 (later): phase 2 landed. 24 seat reports under `research/phase2/` (96 Opus and 91 Astra
  levers); phase 2b merged them per area (125 levers), two skeptics reviewed 69 and refuted 16, a synthesizer
  ranked 85 plan rows in six tiers with a projection and nine align questions, and a cross-area critic added
  conflicts, double counts, dependency order and missing items (`research/phase2/PLAN.md`). Stage `align`.
- 2026-11-09: packet opened from the operator's audit request. Phase 1 surface inventory filed under
  `research/phase1/` (eleven Opus 5.5 readers plus a completeness critic, and a blinded GPT-6 Astra map).
  Four operator rulings logged in `DECISIONS.md` (launch phase 2; target definition; extend the
  QualityScheduler; this packet as the audit's home). Phase 2 launched: 24 seats, one Opus and one Astra
  per area. Stage `research`.
