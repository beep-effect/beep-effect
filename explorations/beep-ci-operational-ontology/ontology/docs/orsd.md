# beep-ci-ops — Ontology Requirements Specification Document (S2 v1, 2026-08-27)

## 1. Purpose

Formalize beep-effect's verification & backpressure semantics so that a deterministic
runtime projection `(T-Box, A-Box, live instance) → WorkUnit schedule` minimizes the KPI:
fleet-aggregated P50/P95 **time-to-certainty per verification episode**, tier-relative
(repair / local full proof / CI merge) and epoch-relative (verification EVIDENCE is
scoped to CacheEpoch × tree — evidence, not truth; the round-3 W-08 phrasing law).
The ontology's value is judged by that KPI alone (packet ruling); levers are derived
as projections — the sole exception is evidence-backed quick levers shipped as
**tagged operational change events** (DECISIONS vernacular: control interventions) on
the KPI time-series, evaluated as OBSERVATIONAL deltas unless a supporting design
upgrades them (kpi-measurement-rules.md §2).

## 2. Scope

See [`scope.md`](./scope.md). Closed-world over one repo; OWL 2 RL + Datalog compilation;
probability and dollar cost outside OWL.

## 3. Implementation language & profile

- T-Box: OWL 2 **RL** (rule-compilable), serialized through the `packages/ontology` slice
  ("beep's bespoke system"); shapes in SHACL.
- Operational reasoning: forward-chaining/Datalog fixpoint (e.g. `dependsOnTransitive`),
  per the reasoning-stack ruling in packet DECISIONS.md.
- Namespace (settled by operator ruling 2026-08-27, see DECISIONS.md; the term set
  ratifies at S8): `https://oip.law/ontology/ci-ops#`.

## 4. Intended users & uses

Use-case catalog: [`use-cases.yaml`](./use-cases.yaml) (UC-001 planning, UC-002
scheduling, UC-003 invalidation, UC-004 certainty accounting, UC-005 KPI attribution).

## 5. Requirements

### 5.1 Non-functional

- **NFR-1 Determinism**: identical A-Box + T-Box + instance inputs must yield an identical
  schedule (property-tested at S7).
- **NFR-2 Admission law (two-kind, capped — final-grill round 2)**: every T-Box term is
  (a) a DECISION TERM required by a Must/Should CQ, or (b) a SEMANTIC-SUPPORT TERM
  whose admission NAMES the decision term(s) it defines/constrains/disambiguates
  through a checkable dependency (`supports=` in the pre-glossary; validator-checked
  reachability from CQ roots). A support term whose named dependency disappears loses
  its license and is garbage-collected at the next audit; S5 audits support
  justifications adversarially. Rationale: the strict single-kind law proved
  category-forcing (requiresLane conflating obligation with procedure) and incentivized
  retroactive-CQ laundering.
- **NFR-3 Evolution**: KGCL-managed changes; the CQ suite is the regression gate
  ("certainty" = suite green, not artifact frozen).
- **NFR-4 Loop bounds**: adversarial refinement terminates on dry-2 + CQ-coverage +
  budget (packet ruling).
- **NFR-5 Provenance**: every A-Box assertion carries its vein (journal file, gh run id,
  cloudwatch metric) — the repo's evidence discipline applies to the ontology itself.

### 5.2 Functional (competency questions)

Authoritative list: [`competency-questions.yaml`](./competency-questions.yaml) —
18 Must, 7 Should, 1 Could, 3 recorded Won'ts (post-grill application pass: scheduling
trio CQ-020/021/022 + starvation CQ-023 as Must; cache-posture CQ-024, cost-calibration
CQ-025, and the demoted p95 screen CQ-026 as Should). Test queries under
[`../tests/`](../tests/), manifest in `cq-test-manifest.yaml`; predicate closure
declarations for every negation in [`closed-world.yaml`](./closed-world.yaml).

## 6. Pre-glossary

[`pre-glossary.csv`](./pre-glossary.csv) — 41 candidate classes, 67 candidate
properties, 4 named individuals (post-grill: renames VerificationEvidence /
AssuranceTier / OperationalChangeEvent with vernacular altLabels; the scheduling,
execution, attempt, and policy vocabulary; three `supports=`-licensed semantic-support
terms; round-3 removals: occupiesCheckout, grantedFrom, proposedFor, failsEpisode,
servesEpisode, estimatedFailureProbability — each with its finding recorded), every
row traceable to a CQ or use case. Hand-off input for /ontology-scout (reuse mapping)
and the /ontology-foundational-auditor → /ontology-conceptualizer chain (S4/S5; the
auditor skill run AS WRITTEN is the S4 gate — lane-contract §4b).

## 7. Acceptance criteria

1. Every Must CQ has a runnable SPARQL test; enumerative/relational expect non-empty
   against the seeded A-Box, constraint CQs expect zero rows.
2. The S0 baseline A-Box (attempt journals) can answer CQ-007 and CQ-012 for the
   2026-08 window without schema contortion — under the documented PRE-INTERVENTION
   mapping (round-2 seat F): pre-#870 episodes materialize `queueWaitMs = 0` (durable
   queueing did not exist; bounce-era waiting is unlabeled inside episode wall time,
   which the mapping must state, not hide). Post-#870 episodes require the scheduler's
   ticket/lease telemetry as an additional source, and the episode clock OPENS at seat
   request (`enqueuedAtMillis`). The full ETL law is
   [`../../research/kpi-measurement-rules.md`](../../research/kpi-measurement-rules.md).
3. The invalidation model (CQ-011) reproduces the observed biome-bump behavior: a root
   tool-pin surface change radiates ONLY to its feeding lane once hash surfaces are
   modeled per-lane.
4. CQ tests stay green across KGCL evolution steps (curator workflow).

## 8. Known risks (carried from grill)

- Retroactive-CQ hazard: S4 mechanical extraction may tempt term admission without CQ
  backing — the admission law is the guard, reviewed adversarially at S5.
- Prioritization bias: the operator is the loudest stakeholder; agent needs are derived
  from telemetry (59% red attempts, 17% lock bounces — PRE-#870 pre-intervention
  figures) as an independent voice.
- Term-set ratification pending: the namespace is settled (DECISIONS 2026-08-27), but the
  term set ratifies against the ontology slice's IRI doctrine at S8.
