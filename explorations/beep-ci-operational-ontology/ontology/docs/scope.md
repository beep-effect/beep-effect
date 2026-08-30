# beep-ci-ops ontology — scope (S2, 2026-08-27)

Specification-phase scope for the operational ontology of beep-effect's verification &
backpressure semantics. Produced by the /ontology-requirements stage; governed by the
packet's locked decisions ([`../../DECISIONS.md`](../../DECISIONS.md)).

## Domain

The verification lifecycle of code changes in the beep-effect monorepo as executed by a
fleet of coding agents across machine-local checkouts: lanes, verification evidence
(vernacular: proofs), attempts, episodes, assurance tiers (vernacular: certainty tiers),
cache epochs, invalidation, scheduling seats/grants, contended resources, and measured
costs. The runtime projection of this ontology computes verification schedules
(`WorkUnit` sequences, emitted as queryable `ScheduleProposal` A-Box) that minimize the
KPI.

## KPI (the single judge)

Fleet-aggregated **P50/P95 time-to-certainty per verification episode** — wall time
from the episode's opening instant to the attempt that establishes the target
assurance tier. The opening CLOCK is defined by
[`../../research/kpi-measurement-rules.md`](../../research/kpi-measurement-rules.md)
§1 (round-3 W-07 — this document defers): post-#870 it opens at the first admission
ticket's `enqueuedAtMillis`; ticketless repair loops open at first attempt start;
pre-#870 episodes open at first red attempt start with `queueWaitMs := 0` stated.
Tier-relative and epoch-relative.
Baseline (2026-08-27, 27 checkouts, 3.5 weeks — **pre-intervention: all figures predate
PR #870's weighted admission scheduler**): episode P50 **41.3m**, P95 3.1h; 59% of
attempts red; 17% of attempts lock-contention bounces; 292 machine-hours inside episodes.

## Stakeholders

| Stakeholder | Information need |
| --- | --- |
| Coding agent (post-edit) | cheapest next WorkUnit sequence; what certainty currently holds |
| Proof coordinator / scheduler | admissible charge-feasible grants; fairness across agents; contention state |
| Operator (Benjamin) | KPI attribution; lever ranking; control-intervention deltas |
| Ontology pipeline itself | which telemetry ratifies which predicates (A-Box admission) |

## In scope

- Verification lanes (turbo tasks, scripts, collected gates) and their membership in the
  three certainty tiers (TierRepairGreen / TierLocalFullProof / TierCiMergeGreen). Yeet's
  own proof tiers (`full | cheap-gates | review-fix`, `YeetProofTier` in Planner.ts) are a
  distinct enumeration whose mapping into certainty tiers is an S4 extraction question —
  do not conflate the two domains.
- Scoping algebra: FullRepoScope, AffectedScope (affected-from-base), FilterScope,
  ShardScope (glossary spellings are canonical); package dependency
  topology; hash surfaces and invalidation blast radius.
- Episodes, attempts, verdicts, failure signatures (failedStepId × failureKind).
- Scheduling: seat requests/grants (deployed #870 ticket/lease carriers), admission
  policy (charges, capacity, aging, class caps), contended resources (proof lock,
  cores, memory, turbo daemon/cache), backpressure invariants (admission charge vs
  remaining capacity — CQ-010; declared starvation bound — CQ-023; origin exclusion —
  CQ-009). Round-3 correction (seats H+J, superseding the round-2 checkout wording):
  the deployed exclusion identity is the ORIGIN KEY (proof-lock basename of
  remote.origin.url) — the scheduler skips any ticket whose nonempty originKey matches
  an active lease's, kind-independently; review-fix work carries an EMPTY originKey
  (origin-exempt, class-capped at 3); checkoutRoot is an owner attribute with no
  uniqueness semantics. CQ-009 binds on hasOriginKey accordingly.
- Assurance tiers and their obligations; evidence validity relative to CacheEpoch ×
  tree; evidence transferability between checkouts (shared cache, cache postures).
- Measured costs (P50/P95 wall, memory class) per (lane, package) and actual-vs-estimate
  calibration; KPI decomposition (queue wait, lock wait, execution, repair, CI wait);
  operational change events (vernacular: control interventions).

## Out of scope (v1)

- Cross-repo generalization (this ontology is closed-world over beep-effect).
- Human IDE inner loops (typecheck-on-save etc.) — only yeet/CI verification events.
- Dollar cost accounting (machine-time only).
- Probabilistic inference inside OWL — failure-probability estimates are data properties
  computed by the external cost model, never OWL-derived (expressivity boundary).
- The full OWL DL reasoner (separate goal, off the KPI critical path).

## Constraints

- **OWL 2 RL profile** only; operational reasoning compiles to forward-chaining/Datalog
  (closed-world). SHACL for shape validation.
- CQs gate T-Box admission (two-kind, capped — final-grill round 2): a term enters as a
  decision term a Must/Should CQ requires, or as a semantic-support term naming the
  decision term(s) it serves (`supports=` reachability from CQ roots; ORSD NFR-2).
- Namespace (settled by operator ruling 2026-08-27; the term set ratifies at S8 with the
  `packages/ontology` slice IRI scheme): `https://oip.law/ontology/ci-ops#`, prefix
  `ciops:`.
- Naming per `_shared/naming-conventions.md`: CamelCase singular classes, camelCase
  properties, no class-encoding property names.
