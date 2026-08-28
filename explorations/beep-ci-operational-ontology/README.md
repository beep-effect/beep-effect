# Beep CI Operational Ontology

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A question about the three cheapest yeet levers refused to stay small: we don't know the
levers, and picking them by hand misses the principle. Instead: formalize the repo's
verification & backpressure semantics into a reasoned T-Box whose runtime projection over
live instance data computes the fastest pipeline for ONE KPI — fleet-aggregated
time-to-certainty per verification episode (agent writes code → agent knows it passes).
Graduation target: the operational ontology pipeline itself. This is the scoped proof of
the "bush" (`A_LETTER_FROM_THE_OTHER_SIDE_OF_THE_LOOP.md`).

## Next Open Question

**The grill frontier is CLOSED and the application pass is APPLIED** (2026-08-27).
The suite is at 26 CQs (18 Must / 7 Should), 25 executing tests + 12 must-fail
fixtures, validator 0 blockers / 0 WARNS (the round-0 admission-law warns are closed
by the scheduling-trio CQs). Remaining WORK, in order: (1) review-loop round 3 —
post-grill delta attack + disposition audit of rounds 1–2 (the cap's last round);
(2) S4 lane launch under the amended contract (`ontology/docs/s4-lane-contract.md`
§4b normalization gate = the `ontology-foundational-auditor` skill; corpus pin
satisfied from the working tree after the origin/main merge).

Superseded context below (kept for the trail):

Rounds 1 AND 2 of the pre-S4 quality loop are fixed and recorded
([round2-triage](./research/reviews/pre-s4/round2-triage.md)); the suite is now
EXECUTABLY guarded (`regen_cq_artifacts` → `validate_packet` → `run_cq_suite`: 18 seed
tests + 8 must-fail fixtures + non-vacuity antecedents, all green). A second external
partner review (foundational-ontology audit, UFO/OntoClean lens —
[full text](./research/reviews/pre-s4/round2-partner-review2.md), disposition in
triage addendum 2) reframed S4 as candidate-bootstrap + ontological NORMALIZATION and
added frontier question 6 (terminology renames, admission-law semantic-support
category, P95≠charge≠limit, closure contract, starvation invariant). Round 3 — the
cap's last — is RESERVED for the post-grill delta plus a disposition-map audit.
Blocking everything: the grill frontier (now 6 questions, mirrored in manifest).

The pre-S4 quality loop (round 1 of 3) is fixed and recorded
([triage](./research/reviews/pre-s4/round1-triage.md), incl. the external
partner-review addendum); the **round-1 grill frontier is OPEN, awaiting operator
rulings** (mirrored in manifest openQuestions): (1) scheduling-vocabulary Must CQs —
now reshaped by verified reality drift: **PR #870 (merged 2026-08-27T19:52Z) deployed a
weighted admission scheduler** whose LiteralKits (AdmissionWorkKind/AdmissionPriority)
and ticket/lease schemas are the real carriers for SeatRequest/queue vocabulary, while
DRR stays prospective design; (2) ScheduleProposal (schedule-as-A-Box; also unlocks the
partner's stronger CQ-019B scope-narrowness form); (3) cache-posture + cost-charging
Should CQs; (4) kpi-measurement-rules.md codification; (5) rebase/pin the corpus to
≥ `debbbb51f7` before S4 (the branch predates #870). After rulings: apply → round 2
delta panel (A/B/C changed surfaces, D re-attacks post-grill) → S4 under
[`ontology/docs/s4-lane-contract.md`](./ontology/docs/s4-lane-contract.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`DECISIONS.md`](./DECISIONS.md) - grilling log (8 locked decisions + amendments, pre-seeded 2026-08-27).
4. [`prose/2026-08-27-pre-packet-session.md`](./prose/2026-08-27-pre-packet-session.md) - distilled pre-packet session narrative.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## The Pipeline (grilled v2)

S0 baseline KPI ETL → S1 capture & hygiene → S2 ORSD/CQs → S3 research (angles → deep
research + reuse scan) → S4 formal-first T-Box bootstrap → S5 adversarial taxonomy &
parameterization → S6 A-Box ratification & predicates → S7 projection function (the
loop-closer) → S8 OWL 2 RL + SHACL formalization, rules compilation → S9 dogfood proof &
graduation. Full plan with locked decisions: [`DECISIONS.md`](./DECISIONS.md).

## Trail

- 2026-08-27 (eighth stint): APPLICATION PASS — all 12 grill rulings applied and
  executing. Renames landed (VerificationEvidence / AssuranceTier /
  OperationalChangeEvent with vernacular altLabels); 7 new CQs (CQ-020 ordering,
  CQ-021 seat queue, CQ-022 stopping, CQ-023 starvation as Must; CQ-024 cache
  posture, CQ-025 cost calibration, CQ-026 demoted p95 screen as Should) grounded in
  deployed #870 carriers (ticket/lease, weightTokens, publishAgingSeconds,
  TurboCacheMode); CQ-010 reshaped to the deployed charge-vs-capacity invariant;
  CQ-019 closed scope-provenance ENFORCED both arms (fail-open trust + scope-
  provenance gap; the schedule half's "unenforced" caveat is retired); CQ-009
  self-scopes to FullProofWork in-query. New artifacts: closed-world.yaml (predicate
  closure contract), kpi-measurement-rules.md (v1 ETL law), lane-contract §4b (FULL
  normalization via ontology-foundational-auditor) + two-kind candidate schema;
  validator extended with supports= reachability (two-kind admission); glossary
  40 classes / 69 properties; suite 25 tests + 12 fixtures ALL GREEN, validator
  0/0. Corpus rebased: origin/main (≥ debbbb51f7) merged into the branch. Stopped
  at: review-loop round 3 → S4 launch.
- 2026-08-27 (seventh stint): teaching pass (review 2 through the Effect/type lens:
  Kind/Phase/Role = class vs state-field vs relational projection; spec/execution =
  Effect vs fiber; evidence vs truth; open-world none = unknown) + FINAL GRILL — the
  6-question frontier ruled in 3 rounds (12 rulings, DECISIONS.md): scheduling trio as
  Must (#870-grounded), ScheduleProposal + hasScope admitted, S4 gate = FULL
  normalization carried by the operator's new `ontology-foundational-auditor` skill
  (canonicalized from review 2 in a forked session), renames + vernacular-as-labels
  (VerificationEvidence, AssuranceTier) with the three splits as S4 mandates,
  admission law amended to capped two-kind (reachability from CQ roots), CQ-010
  tri-split reshape (AdmissionCharge from deployed weightTokens), closure contract as
  S6 law, starvation hard invariant, rebase + measurement-rules + Should CQs +
  observational naming all adopted. Stopped at: application pass → round 3 → S4.
- 2026-08-27 (sixth stint): FINAL adversarial round (round 2; codex ULTRA ×2 + grok
  xhigh). Seat E EXECUTED the queries (Oxigraph) and broke four round-1 repairs
  (CQ-004 BIND scoping, CQ-006 invalidated-proof discharge, CQ-012 partial-episode
  bias + zero-denominator green, batched-binding merges); seat F broke five claims
  against deployed origin/main (#870: lock retained not replaced, one-grant-per-
  checkout false for review-fix class, adoption-staggered intervention boundary,
  fleet probe cross-checkout branch merging, `topo sort` command nonexistent); seat G
  proved the round-1 CQ-019 completeness letter CIRCULAR and the #870 experiment
  SELF-ERASING. All fixed; perishable evidence snapshotted (245 journals/28 checkouts
  + digests + HEADs); iv-870 recorded in control-interventions.yaml with
  adoption-qualified membership; lane contract gained facts records, source_domain,
  real commands, full freeze; validator committed (validate_packet.py); **executing
  fixture harness built** (seed.ttl + 8 must-fail fixtures + run_cq_suite.py) — 0
  failures. Full map: research/reviews/pre-s4/round2-triage.md. Round 3 reserved for
  post-grill delta + disposition audit. Stopped at: grill frontier (unchanged, 5
  questions).
- 2026-08-27 (fifth stint): pre-S4 quality loop (operator-requested, 3-round cap).
  Round 0 mechanical checker (committed idea, scratchpad-run): 0 blockers. Round 1
  panel — 3 codex seats at max reasoning + 1 grok seat at xhigh (initiative effort
  directive recorded in DECISIONS): 30 blockers / ~30 warns across CQ answerability,
  coherence, KPI baseline, adversarial admission-law attack. All mechanical findings
  FIXED: parameter-binding convention + 14 query repairs + 5 property admissions
  (queueWaitMs, occurredAt, episodeStartedAt, attributedDelayMs, hasCurrentEpoch);
  literal-domains.md (6 closed domains, no-punning ruling); traceability policy +
  committed regen script; probe v3 (fleet-reproducible flags, right-censoring
  reported); **vein correction: attempts.ndjson is a RING BUFFER (newest ~50/branch),
  not append-only** — every baseline number is retained-window-relative;
  s4-lane-contract.md authored (closes seat C's 15-gap checklist). Full disposition
  map: research/reviews/pre-s4/round1-triage.md. Then: external partner review received
  and integrated — its central drift finding VERIFIED (PR #870 weighted admission
  scheduler merged same day at 19:52Z; the packet branch predates it), baseline
  re-labeled pre-intervention with #870 as the first ControlIntervention, deployed-vs-
  prospective scheduler split recorded, TurboQuery affected-reason loss verified +
  repo-fix chip spawned, corpus pin added to the lane contract. Stopped at: grill
  frontier (5 questions, mirrored in manifest) open at operator's request.
- 2026-08-27 (fourth stint): R5 done — Fable personally read the AgentO chapter
  (Ekelhart et al., ESWC 2026) from the proceedings PDF and distilled the *derivation
  process* into `research/r5-agento-process.md`: frozen-schema LLM extraction with
  Issues-ledgers, friction-driven taxonomy rulings, $2.72 rerunnable inner loop,
  reviewer time as the true bottleneck; no CQ gate is its weakness (we keep ours).
  Eight-item steal list adopted for S4/S6 lane contracts; S7 amendment candidate
  raised (schedule-as-A-Box). Operator ruling mid-stint: namespace re-minted to
  `https://oip.law/ontology/ci-ops#` (40 occurrences flipped; DECISIONS updated).
  S3 closed. Stopped at: S4 kickoff.
- 2026-08-27 (third stint): all S3 lanes landed — R1 (agentic ontology practice), R2
  (reuse scan: ten operational clusters genuinely novel; PROV-O/P-Plan/OSLC as alignment
  spines), R3 (DRR/admission/stopping/cache-validity as four mechanisms), R4 ×3 (plain
  grok, yolo-deep, firecrawl-deep; novelty triangulated — no ontology-driven CI exists).
  R4-deep contrarian finding admitted as CQ-019 (fail-open affected outcomes license no
  scoped certainty); suite regenerated to 18 Must/Should tests; pre-glossary now 28
  classes/41 properties (miscounted as 38 here originally; round-0 checker corrected). Grok lane ops hardened: env scrub required (parent session auth
  vars leak → 401), op run for FIRECRAWL_API_KEY. Stopped at: R5 + S4 kickoff.
- 2026-08-27 (second stint): S0 extended fleet-wide (27 checkouts, 2,433 attempts:
  episode P50 41.3m, 59% red, 17% lock bounces, 292 machine-hours/3.5wk) + CI-tier sketch
  (Check P50 12.0m, 80% red). S2 complete: ORSD, 5 use cases, 18 CQs (13 Must), pre-
  glossary (26 classes/36 properties), 17 generated SPARQL tests + manifest + traceability.
  S3 launched: 3 codex lanes (R1 agentic ontology learning, R2 reuse scan, R3 scheduling
  formalisms) + 1 grok lane (R4 live practice) running in background; R5 (agento chapter)
  queued for Fable. effect-ontology (~/YeeBois/dev, MIT) added to SOURCES as candidate
  reasoner substrate, critique gated at S8. Stopped at: lane distillation + S4 kickoff.
- 2026-08-27: packet opened from live session. Hygiene pass (raw transcript gitignored,
  `pros/`→`prose/`), proposal grilled via /grill-with-docs (2 rounds, 8 decisions locked,
  all on recommended arms), pipeline v2 recorded, S0 first-cut baseline computed from this
  checkout's verdicts. Stopped at: fleet-wide baseline + S2/S3 launch.
