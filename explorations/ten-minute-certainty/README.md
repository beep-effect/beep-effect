# Ten-Minute Certainty

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `decompose`
Status: `active`
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

Graduate in a follow-up PR (ruling D22): scaffold the six goal packets named in `MAP.md` from
`goals/_template/` (SPEC seeded from `BRIEF.md`: no-gos to non-goals, rabbit holes to constraints; one
decision file per relevant ruling through `bun run beep goals decisions add`; `research/SOURCES.md`
carried over; manifests cross-linked), flip this packet to `graduated`, then open the three ready
implementation PRs (ROUT-03, TURB-01, MEAS-01) from their goal lanes. Brief and map were approved on
2026-11-09 (D20, D21); no open questions remain.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's request and rulings (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - the in-repo inventory and constraints (stage 1).
4. [`research/phase1/SURFACE-INVENTORY.md`](./research/phase1/SURFACE-INVENTORY.md) - the phase 1 surface map
   (12 areas, 147 components, 111 levers, 120 rejections on record, critic gaps, Astra diff).
5. [`DECISIONS.md`](./DECISIONS.md) - the 22 rulings of 2026-11-09 (D1 to D22).
6. [`BRIEF.md`](./BRIEF.md) - the shaped pitch (approved D20).
7. [`MAP.md`](./MAP.md) - six goal packets, sequencing, first slice, capability check (approved D21).
8. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

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
