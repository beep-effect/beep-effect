# Ten-Minute Certainty

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
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

Align round 1 is open. The ranked plan ([`research/phase2/PLAN.md`](./research/phase2/PLAN.md)) needs the
operator's rulings on the questions listed in the manifest, each with a recommended answer in the plan's
"Questions for the align round" section: Coverage Regression's status, corpus replay cadence per PR, the
Property Laws latency-for-compute trade, Lint Policy on the heavy pool and capacity, how a verdict for every
main commit is delivered and paid for, review-window re-arm on diff-preserving merges, the #2999 docs-only
widening, what the 10-minute target counts, merged-preview support, the R2 pause, time-to-certainty's open
seams, monitor back-off, and fleet economics.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's request and rulings (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - the in-repo inventory and constraints (stage 1).
4. [`research/phase1/SURFACE-INVENTORY.md`](./research/phase1/SURFACE-INVENTORY.md) - the phase 1 surface map
   (12 areas, 147 components, 111 levers, 120 rejections on record, critic gaps, Astra diff).
5. [`DECISIONS.md`](./DECISIONS.md) - the four 2026-11-09 rulings (pre-seeded; align opens after phase 2).
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

- 2026-11-09 (later): phase 2 landed. 24 seat reports under `research/phase2/` (96 Opus and 91 Astra
  levers); phase 2b merged them per area (125 levers), two skeptics reviewed 69 and refuted 16, a synthesizer
  ranked 85 plan rows in six tiers with a projection and nine align questions, and a cross-area critic added
  conflicts, double counts, dependency order and missing items (`research/phase2/PLAN.md`). Stage `align`.
- 2026-11-09: packet opened from the operator's audit request. Phase 1 surface inventory filed under
  `research/phase1/` (eleven Opus 5.5 readers plus a completeness critic, and a blinded GPT-6 Astra map).
  Four operator rulings logged in `DECISIONS.md` (launch phase 2; target definition; extend the
  QualityScheduler; this packet as the audit's home). Phase 2 launched: 24 seats, one Opus and one Astra
  per area. Stage `research`.
