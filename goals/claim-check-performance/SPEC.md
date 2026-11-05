# Claim Checker Measurable Usefulness Spec

## Objective

Deliver a useful deterministic, span-anchored claim-element and advisory
antecedent/dependency checker. Implementation, measurement and merged delivery
alone do not satisfy this goal. Every usefulness gate below must pass together
on one frozen implementation. The prior completed-retained goal remains intact.

## Source Hierarchy

User request; AGENTS.md and governing architecture; this SPEC; PLAN; GOAL;
research/usefulness-gates.json; frozen evidence and protocol. Do not weaken a
performance gate to close the goal. The user may explicitly revise a gate;
retain both versions and report the effect rather than rewriting history.

## Target Surfaces

Existing ClaimElement deterministic behavior/policy, ClaimSelfCheck, USPTO
normalization/adapter, their fixtures and tests, plus this packet's evaluation
and diagnostic tools. Use existing package owners and schema-first contracts.

## Non-Goals

No PatentClaim shape changes, runtime LLM decomposition, training, retrieval,
Markush, DOCX, section 112(f), shared promotion, blocking findings, MCP writes,
IPRally adapter or licensed raw data in the repository. No mandatory attorney
presence. No new spending, capacity or paid endpoint without authorization.

## Binding Usefulness Gates

The exact machine-readable thresholds are frozen in
research/usefulness-gates.json before implementation changes:

| Gate | Required outcome |
| --- | --- |
| Legacy strict recovery | At least 270/538 full strict structures; original denominator, scorer and labels unchanged |
| Regression retention | All 37 original exact matches retained, no losses |
| Family-disjoint structures | At least 70% full strict recovery across at least 20 new families and 200 claims |
| Difficult subgroups | At least 50% strict recovery separately on nested, functional, dependent and multiple-dependent strata |
| Subgroup size | At least 30 nested, 30 functional, 50 dependent and 20 multiple-dependent claims; overlapping strata allowed |
| Stratification | All six original CPC sections A/B/E/F/G/H; at least two families and 20 claims per section |
| Input coverage | At least 98% on both legacy and final new cohorts; explicit abstentions at most 10% |
| Substantive alert precision | At least 95%; 95% Wilson lower bound at least 90%; at least 100 emitted alerts evaluated |
| Supported-defect recall | At least 80%; 95% Wilson lower bound at least 70%; at least 100 source-supported defects |
| Defect coverage | At least 10 independently supported cases for each of missing, ambiguous, outside-chain and number mismatch |
| Review burden | At most 5% of at least 200 independently reviewed control claims receive an erroneous substantive alert; 95% Wilson upper bound at most 10% |

Unsupported inputs and abstentions remain in denominators. Unknown alert
correctness counts as incorrect for precision; unknown defect detection counts
as missed for recall; unknown control judgments count against the review-burden
gate. Insufficient sample size or absent evidence is a failed gate. Coverage
warnings are distinct from substantive defect allegations and never count as
correct detections. Report their frequency and every failed/unchecked claim.
All thresholds must pass on the same source/environment freeze.

## Evaluation Integrity

1. Preserve every artifact in research/preservation-freeze.json byte for byte.
   The explicit research/preservation-location-addendum.json relocates only
   three historical runner sources to exact text archives; 1,210 other paths
   remain exact. Active runners retain accepted mechanical yield hoisting,
   are separately hash-checked and require report-equivalence replay. The
   original freeze, labels, scorer, outputs and numerical gates are unchanged.
   Never rewrite old labels, expected trees, result files, scorer or sampling.
   New findings about an old label are separate overlays; legacy scoring keeps
   its original reference. Keep all prior passes as a mandatory gate.
2. Qualify new public source families by provenance and family identity before
   predictions. Exclude overlap with all existing development/allowed families
   and disclose previous exposure. Never call already inspected claims held out.
3. Separate development and final evaluation. Source-grounded reference and
   defect annotation happens before predictions, without parser rules or model
   output. Freeze selection, full dependency context, subgroup membership,
   references, reviewer receipts and hashes. Retain disagreement and unknowns.
4. Independent automated extractor and critic review use separate approved
   model sessions, blinded to implementation and each other's initial work.
   A second independent reviewer qualifies defect/control correctness. Keep
   source quotes, exact ownership, model/effort and input/output identities.
   Confidence is not attorney agreement or calibrated probability.
5. Final heldout results are opened only after a content-final candidate.
   After opening, that cohort becomes development data for subsequent tuning.
   A later final attempt needs a newly frozen disjoint cohort; all failed
   attempts remain reported. No repeated testing of one exposed cohort while
   continuing to call it held out.
6. Precision and recall require independent source-grounded truth. Allowed
   claims are not automatically clean and examiner allegations alone are not
   assumed correct. Controls need explicit review and unresolved judgments
   remain conservative unknowns. All selected records remain in the report.
7. Defect recall matches finding kind, exact offending span and dependency
   context, not just any alert on the same claim. Deduplicate identical alerts
   for reporting, while retaining raw outputs and counting distinct spurious
   assertions against precision. Claims are not independent merely because
   they are counted separately: report family-level sensitivity beside Wilson
   intervals and state correlated automated-review error is unquantified.
8. General rule repairs only: no patent/family/claim identifiers, fixture text
   lookups or expected-output leakage in runtime code. Same input gives same
   output. Every repair has source-grounded counterexamples and retention proof.

## Acceptance Criteria

- [ ] Original 1,213-artifact preservation freeze and explicit three-runner location addendum verify and all 37 passes remain.
- [ ] Baseline and recurring error taxonomy recorded without changing references.
- [ ] Independent source-qualified development/final datasets frozen as above.
- [ ] Every usefulness gate passes together on one content-final source freeze.
- [ ] Source-grounded per-rule precision/recall, errors, abstentions and uncertainty reported.
- [ ] No scope exclusion breached; findings stay advisory and tool read-only.
- [ ] Touched package verification, hosted checks and independent code review pass.
- [ ] Final PR has archived positive exact-head readiness before strict merge.
- [ ] Reflection, main-state verification and native worktree cleanup complete.

## Verification Matrix

| Check | Evidence |
| --- | --- |
| Preservation/retention | research/preservation-freeze.json and paired 538-claim results |
| Structural metric | Unchanged server/test/evaluation/Structural.ts and original scorer |
| Usefulness | Frozen thresholds, conservative executable gate report and independent adjudication receipts |
| Input/abstention coverage | Every selected claim accounted for, including failures |
| Package quality | package-verify for domain/use-cases/server as touched |
| Packet integrity | goals doctor, generated index check, launcher <=4000 chars, diff --check |
| Delivery | Yeet exact-head hosted checks, review/thread/window evidence and strict merge |

## Stop Conditions

Money requires the operator. Missing data, poor scores, disagreement, no
attorney, ordinary failures and slow CI do not count as goal completion. Keep
working on useful independent tasks while resolving blockers. Preserve failed
attempts; report an actual external blocker without claiming usefulness.

## Decision Log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-11-03 | Freeze numerical gates before tuning | Prior delivery completed without useful accuracy | User-authorized new protocol version; retain prior gates/results |
| 2026-11-03 | Legacy >=270/538 and new >=70% strict | Require substantial structural improvement plus separate generalization evidence | Explicit user revision, never retrospective relabeling |
| 2026-11-03 | Conservative unknowns and nonempty output/recall minima | Prevent success through silence, omitted hard inputs or optimistic adjudication | Versioned protocol amendment with sensitivity analysis |
| 2026-11-03 | Automated independent source review; attorney optional | User directs autonomous completion | Optional separate human overlay, no rewriting automated receipts |
| 2026-11-03 | Add explicit source-record and sparse-context contracts for partial inspection | One malformed sibling currently rejects an entire source set; dropping rows would violate PatentClaims | Remove additive inspection APIs while retaining strict behavior and all results |
| 2026-11-05 | Adopt independently reviewed prospective source-only annotation handbook v2; freeze all 24 families / 567 claims with 572 raw context nodes | Resolve representation/recording ambiguity before new independent annotations, retaining all six table gaps and every selected unknown; no old 71 admission or gate change | New prospective reviewed version/frame only; preserve both private activation overlays and all prior outcomes |
| 2026-11-05 | Admit only the native-generated new ClaimInspection.tools file coverage identity after independent review; preserve every preexisting baseline row | Retain defensive encoding error handling while testing real source-acquisition refusal, substantive findings and stale cursor failure; native package comparison passes | Regenerate the new identity after stronger source tests/coverage; never lower old floors or alter structural labels/scorer |

## Exception Ledger

None. No poor-performance completion exception is authorized.
