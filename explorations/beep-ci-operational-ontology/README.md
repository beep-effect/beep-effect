# Beep CI Operational Ontology

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

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

**§4b NORMALIZATION GATE IS COMPLETE AND RATIFIED** (2026-08-29; PR #889). The
`ontology-foundational-auditor` skill ran as written over the S4 harvest: 1,112
observations, 692 hypotheses, 235 analysis pairs + 235 blinded pairs, 232 proposals,
five adversarial rounds, mechanical `--gate` PASSED, **31 terms ratified** by the
steward (rat-001..031), 216 conceded, 57.75% unresolved-fraction waiver ratified. The
run is rotated and replayable from
[`ontology/extraction/s4/beep-ci-ops/runs/`](./ontology/extraction/s4/beep-ci-ops/runs/)
(manifest, index, observations, the vendored judging engine, replay notes). **S5 IS COMPLETE AND RATIFIED** (2026-08-30): the binding contract is
[`ontology/docs/s5-taxonomy-contract.md`](./ontology/docs/s5-taxonomy-contract.md),
sittings 1–4 are scribed in DECISIONS.md (337 candidates, 104 LEDGER entries, the
docket policy, and the seat-round rulings), the ratified 38-term
`extraction/s5/TAXONOMY.yaml` passes the `--s5` gate at 0 blockers / 0 warns, and
`apply_s5_dispositions.py` projected every ruling onto the generated S4 surfaces —
nothing `candidate`/`open` remains.
**S6 IS COMPLETE AND RATIFIED** (2026-08-30): the binding contract is
[`ontology/docs/s6-abox-contract.md`](./ontology/docs/s6-abox-contract.md), the two
S6 sittings are scribed in DECISIONS.md, and
[`ontology/extraction/s6/`](./ontology/extraction/s6/) carries the ratified A-Box
(policy individual + 7 parameters, 4 token weights, 2 priority enumerations), the
83-predicate registry (CQ coverage 1/25 — the ratified-vs-CQ vocabulary gap is
machine-visible run-2 input), the provisional 138-package census graph, the pinned
golden snapshot (79 redacted admission-journal events), SHACL closure+typing shapes,
and the `--s6` gate at 0 blockers / 0 warns. The deferral is discharged
(`apply_s6_dispositions.py`): historical rulings intact, S4 statuses accepted.
**AUDITOR RUN 2 IS COMPLETE AND RATIFIED** (2026-09-03, `orun-2026-09-03T02:46:18Z`,
gate `ARTIFACTS VALID — GATE PASSED`): 21 ratifications (`rat-032..rat-052` — 15
clean accepts + 6 flagged reuse mappings), all 149 carried run-1 rows adjudicated
(146 retired, 3 kept with named corpus requirements), 24 proposals withdrawn or
deferred with named run-3 evidence, unresolved-fraction waiver (56%) steward-ratified.
The run report is
[`work-run2/impl-report.md`](./ontology/extraction/s4/beep-ci-ops/work-run2/impl-report.md);
sittings 1–3 are scribed in DECISIONS.md.
**THE CQ-020 AMENDMENT IS APPLIED** (2026-09-03, post-merge as sanctioned): the ordering
question now asks for the SeatRequest sequence under its governing
`AdmissionProjectionSpecification`, with the step's literal `hasScopeTag` (a distinct
data property — the no-punning ruling keeps `hasScope` an object property), and the S6
predicate registry regenerated to track it.
**NEXT: auditor run 3 prerequisites, then S8 IRI scheme.** Run 3's queue: the full
ordering cluster (`ScheduleStep` + its four
relations ratify together), the deferred identity-provenance corpora (evidence/result
issuance-custody lineage, plan-identity contract, priority-class registry lineage),
and the grant-contention + checkout-identity captures (sitting 2). Prior chain:
`runs/orun-2026-09-03T02:46:18Z.index.yaml`, sha12 `a207a106de68`. Upstream skill
follow-ups queued in the run report (scanner archive shelter; the sandbox rlimits fix
is already vendored in this repo). Do NOT rerun §4b or run 2.

**The 3-round pre-S4 review loop is COMPLETE** (2026-08-27). Round 3 (seat H codex
ultra delta-attack, seat I codex max disposition audit, seat J grok xhigh carrier
fidelity) landed 26 blockers / 18 warns — including two structural catches: the
repo's `**/docs` gitignore had silently kept the ENTIRE `ontology/docs/` authority
surface out of every commit (I-01, fixed with a negation rule), and CQ-009 audited a
checkout exclusion the deployed scheduler never had (origin-keyed; H-04/J-B3). All
adopted fixes are landed and executable: 26 CQs (18 Must / 7 Should / 1 Could), 25
executing tests + 19 must-fail fixtures + binding-contract machinery, validator 0
blockers / 1 aggregated S5-visibility warn, real `--s4-lane` mode. Full map:
[round3-triage.md](./research/reviews/pre-s4/round3-triage.md).

**S4 EXTRACTION IS COMPLETE** (same day): all seven lanes ran at codex max under the
frozen contract (corpus `469136d2a8`), every output passed the `--s4-lane` validator
independently, and the §5 merge landed — **337 candidates / 1,038 facts / 104 ledger
entries** at [`ontology/extraction/s4/`](./ontology/extraction/s4/)
(`CANDIDATES.yaml` / `FACTS.yaml` / `LEDGER.yaml` is the S4→S5 queue). The §4b
normalization gate that followed is recorded above; the mirror-resync precondition it
named is moot now that the judging engine is vendored with the archived run.

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

- 2026-09-03 (nineteenth stint): CQ-020 AMENDMENT APPLIED (PR #963). The
  steward-sanctioned post-run-2 amendment landed once the pinned run merged:
  SeatRequest ordering (`schedulesSeatRequest`), the required governing
  `AdmissionProjectionSpecification`, and the step's literal scope on a NEW
  data property `hasScopeTag` — the review wave caught that reusing `hasScope`
  would pun one IRI as both object and data property (OWL 2 DL + the packet's
  no-punning ruling), that the seed's scope literal had to be the deployed
  `admission` value (fixture realism), and that CQ-019's closed
  scope-provenance arms needed extending to the amended step shape with a new
  must-fail fixture. Two generator drifts repaired en route: regen now emits
  the #919 golden `legs` block itself, and the S6 predicate registry
  regenerates through `build_predicates.py` (the `--s6` scan no longer
  KeyErrors on unregistered predicates). Inherited finding logged: `--s5`
  reads 43 blockers on main, pre-dating this branch. Stopped at: PR #963
  babysit.
- 2026-09-03 (eighteenth stint): AUDITOR RUN 2 COMPLETE — `orun-2026-09-03T02:46:18Z`,
  gate `ARTIFACTS VALID — GATE PASSED`. Launch grill locked nine rulings (no TS
  re-extraction, fresh fleet corpus, full docket, run-1 seats, validator v13 as-is,
  clustered sittings, one end-of-run PR). Engine findings before any seat ran: the
  #902 sandbox runner could never start on a busy desktop (per-UID RLIMIT_NPROC vs
  bwrap — fixed by applying limits inside the user namespace), the v13 validator
  self-test breaks on Python 3.13 (pinned to 3.12, 156/156 families), the scanner
  has no archive exemption (run-1 archives relocated to `extraction/s4/archives/`),
  and `.ndjson` is outside `CONFIG_EXTS` (derived `.properties` projections became
  the grounding channel). Corpus: 30-checkout fleet capture, 6,213 events, both
  split-brain admission roots, digest-pinned with byte-idempotent regeneration.
  Pipeline at pin `341cfef8b6e8`: 20 sandbox-proven SourceObservations + 218
  ProseObservations (163 parked candidates re-grounded via transcription), 121
  denotation hypotheses across five seats, 40 primary ic/fa pairs, 40 blinded grok
  pairs converging independently on identical survivor sets, 45 proposals, three
  adversary rounds (36 FAIL → 0 FAIL; 100 landed attacks audited, 80 demonstrated,
  20 struck at sitting 1). Sitting 2 adjudicated all 149 carried run-1 rows (146
  retired, 3 kept with named corpus requirements — the 57.75% waiver debt paid).
  Sitting 3 (locked via /grill-with-docs, which caught `hasStep`/`stepIndex`
  binding the withdrawn `ScheduleStep` — deferred so no dangling ends entered the
  taxonomy): 21 ratifications `rat-032..rat-052`, 24 withdrawals with named run-3
  evidence, 56% unresolved waiver ratified. Run-3 queue: the ordering cluster after
  the CQ-020 amendment, identity-provenance corpora, grant-contention and
  checkout-identity captures. Stopped at: run artifacts committed, PR next.
- 2026-08-30 (seventeenth stint): S7 PROJECTION SHIPPED — REPLAY CLOSES THE
  LOOP. Steward re-ordered the queue on merging #919: S7 now, auditor run 2
  after. Design-first: sitting 1 locked four rulings (layered scope with a
  typed lane-DAG planner seam, provisional `ciops-prov:` ordering vocabulary
  queued for run 2, landing zone `apps/labs/ciops` via create-package,
  differential replay gating v1) into the binding
  `ontology/docs/s7-projection-contract.md`. Two codex lanes built
  `@beep/ciops`: schema-first policy/request/ledger/proposal models, strict
  A-Box decode from the frozen S6 Turtle bytes, a deterministic engine
  mirroring the deployed admission semantics (aging rank, review-fix-cap
  skippability, head-of-line capacity), byte-deterministic Turtle emission,
  a `Context.Service` with TxRef live shell, and the five-property gate
  suite. The replay first produced six first-choice divergences — adjudicated
  as JOURNAL CENSORSHIP, not projection error: phantom grant `1813f29f`
  (weight 5, event 20) is never released because the deployed reaper drops
  dead admission state via pid/proc-start liveness without journaling a
  release. One inferred dead-lease eviction (event 66) makes all 41
  admissions replay exactly; run-2 finding recorded: **lease death is
  unjournaled**. Evidence in `research/s7-replay-evidence.md`; report in
  `extraction/s7/work-s7/impl-report.md`. All gates green (8/8 tests,
  package-verify, base/--s5/--s6 validators 0/0, CQ suite 25+19 at 0).
  NEXT: auditor run 2 (review the updated skill on main first), then S8.

- 2026-08-30 (sixteenth stint): S6 COMPLETE — A-BOX RATIFIED. Design-first:
  the binding `ontology/docs/s6-abox-contract.md` landed under two grill
  rounds (seven sitting-1 rulings: S6 before run 2, real SHACL, one golden
  snapshot, hybrid ratification, provisional census graph, collision-only IRI
  qualification, closure+typing shapes). One codex lane built the mechanical
  layer: `extraction/s6/` carries the predicate registry (83 predicates, CQ
  coverage 1/25 — the ratified-vs-CQ vocabulary gap is now machine-visible
  run-2 input), the zero-drift policy extraction, the 138-package census
  (provisional `ciops-prov:` graph, open closure), a pinned golden snapshot
  (79 real admission-journal events, redacted), `graphs/abox.ttl`, SHACL
  closure+typing shapes (pyshacl PASS), and the `--s6` gate. Sitting 2
  ratified all nine surfaces; `apply_s6_dispositions.py` discharged the
  deferral (historical rulings intact, S4 statuses accepted). All gates 0/0;
  CQ suite green with three ratified-vocabulary golden probes. NEXT: auditor
  run 2, then S7 projection function.

- 2026-08-30 (fifteenth stint): S5 COMPLETE — TAXONOMY RATIFIED. The six-seat
  round converged remarkably (blinded grok reproduced the identical 39-term
  set; three field divergences), the codex adversary's 48 findings were
  validity-audited and drove a fidelity layer + four sitting-4 rulings
  (DECISIONS.md), and the ratified 38-term `extraction/s5/TAXONOMY.yaml`
  passes the `--s5` gate at 0/0 with all 27 constraints bound or
  reason-waived. `apply_s5_dispositions.py` projected the rulings onto
  CANDIDATES/FACTS/LEDGER — the §5 completion predicate holds (nothing
  candidate/open). CQ suite green. NEXT: S6 A-Box ratification & predicates.

- 2026-08-30 (fourteenth stint): S5 DISPOSITIONS SURFACE COMPLETE. Sitting 3
  ratified the four-ruling LEDGER docket policy (76 run-2 / 20 constraints / 7
  taxonomy-inputs / 1 moot; classifier + `s5/CONSTRAINTS.yaml` committed), the
  DISPOSITIONS builder landed (`s5/DISPOSITIONS.yaml`: 337 candidates, 104
  ledger, 149 archived observations, 31 fact classes covering all 1,038 facts,
  zero orphans), and `validate_packet.py --s5` gates it all (0 blockers; one
  expected pre-seat warn until TAXONOMY.yaml exists). Next: the six-seat
  TAXONOMY round over the 33 accepted terms + constraints, then ratification
  and `apply_s5_dispositions.py`.

- 2026-08-30 (thirteenth stint): S5 SCAFFOLDING LANDED. The locked eight-ruling
  design became [`ontology/docs/s5-taxonomy-contract.md`](./ontology/docs/s5-taxonomy-contract.md)
  plus the committed mechanical join pass
  (`ontology/extraction/s5/scripts/join_s4b.py` → `s5/JOIN.yaml`, idempotent):
  337 candidates → 25 accepted-via ratified terms, 7 leaves of ratified
  domains, 305 open (167 individuals — 152 of them the package census, 79
  literal members across 19 unratified domains, 45 properties, 14 classes).
  Next: bulk steward sittings over the open buckets, then the six-seat round,
  the `--s5` gate, and `apply_s5_dispositions.py`.

- 2026-08-30 (twelfth stint): frozen-evidence integrity repair + S5 design grill.
  PR #865's repo-wide Biome write sweep had rewritten the digest-locked §4b
  adapter engine and its golden input without the sidecar (engine check broken
  on main); restored to the pinned bytes and exempted the packet's `adapters/`
  and `runs/` trees from Biome (PR #899; receipt in the ledger). S5 grill
  rounds 1–2 settled — eight rulings recorded in DECISIONS.md; next session
  authors `ontology/docs/s5-taxonomy-contract.md` + the `--s5` gate and runs
  the join pass before any seat launches.

- 2026-08-29 (eleventh stint): §4b NORMALIZATION GATE COMPLETE + RATIFIED. The
  ontology-foundational-auditor ran AS WRITTEN in a dedicated worktree
  (branch ontology-s4b-normalization, pin c1558f6ca9b1): 1,112 observations
  (3 committed adapters + goldens, 353 prose quotes incl. 15 runtime
  captures), 692 hypotheses, 235 ic/fa pairs, 235 blinded grok pairs, 232
  proposals, five adversarial rounds (234/235 first-round FAIL; locus census
  → steward-ruled concede-where-held; 216 concessions, 21 runtime-hardened),
  31 survivors ALL RATIFIED by the steward (rat-001..031, grilled sitting;
  docket artifact bd0987d0). Engine re-locked 5× as the skill hardened
  mid-run; run finished on the pinned mirror snapshot. 57.75%
  unresolved-fraction waiver RATIFIED (the parked CQ measurement/episode
  vocabulary = next-run corpus extension). NEXT: S5 adversarial taxonomy over
  the 104-entry LEDGER + 149 unresolved rows + ratified term set.

- 2026-08-27 (tenth stint): S4 EXTRACTION FLEET — orchestrator duties executed
  (topo-sort materialized to extraction/s4/inputs/, five frozen-input digests +
  corpus commit 469136d2a872 pinned, fallow config census, seven lane prompts
  embedding contract §3–§4 verbatim at research/prompts/s4-lane-*.md), seven codex
  lanes at max effort ran concurrently, each self-checked AND independently
  re-validated with the round-3 `--s4-lane` mode: turbo-tasks 36/214/7,
  affected-typenames 1/0/3 (honest: the decoder's unconstrained typename string
  cannot ground CQ-019's closed outcome partition — S5 material),
  package-topology 141/799/17, literalkits 73/0/21, yeet-internals 16/0/5,
  fallow-laws 18/14/12, admission-scheduler 52/11/10 — ALL 0-blocker. §5 merge
  landed as a committed carrier (merge_s4_lanes.py; IRI-valued predicates merge as
  SETS, only differing literal facts conflict): 337 candidates / 1,038 facts / 104
  ledger entries incl. a real dependsOn definition conflict flagged for S5. Stopped
  at: §4b normalization gate (auditor skill; mirror re-sync precondition) → S5.
- 2026-08-27 (ninth stint): REVIEW-LOOP ROUND 3 (the cap's last) — three seats at
  ruled efforts (codex ultra + max, grok xhigh) returned 26 blockers / 18 warns, all
  triaged and the adopted set FIXED same-session (round3-triage.md). Structural:
  `**/docs` gitignore had excluded the whole ontology/docs authority surface from
  every commit (fixed, negation rule + landed); the Codex skills mirror is
  stale (S4 launch precondition recorded). Reality corrections against the RUNNING
  scheduler: CQ-009 rebuilt origin-keyed (deployed law was never checkout-scoped);
  grantedFrom removed (ticket→lease handoff self-erases — no stored edge exists);
  QuarantineException removed (corrupt-record isolation, not an owner state);
  starvation bound re-declared as operator policy (aging promotes rank, guarantees
  nothing — seat H ran the scheduler to prove a 5×-aged ticket still queued).
  Semantic repairs, each with a permanent fixture: CQ-019 grew derived-scope and
  dangling-target arms (4 total); CQ-020 gained hasCurrentProposal + projected
  proposal; CQ-022 attempt-scoped (VerificationAttempt admitted, retry-cancellation
  killed); CQ-008 typed-grant-only (WaitingGrant removed); isNumeric guards on all
  numeric constraints; CQ-025/026 pinned to usedCostEstimate. Machinery: binding
  contract now executable (bind_params + mutation self-tests); two-kind validator
  exact-token + Must/Should-rooted at blocker level (two false licenses killed);
  literal-domain member audit; real --s4-lane mode; probe v3.2 true nearest-rank
  (fleet re-run: headline quantiles unchanged, addendum in the baseline). Suite:
  25 tests + 19 fixtures, 0 failures. Stopped at: S4 lane launch (mirror re-sync
  precondition).
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
  queued for Fable. effect-ontology (external local checkout, MIT) added to SOURCES as candidate
  reasoner substrate, critique gated at S8. Stopped at: lane distillation + S4 kickoff.
- 2026-08-27: packet opened from live session. Hygiene pass (raw transcript gitignored,
  `pros/`→`prose/`), proposal grilled via /grill-with-docs (2 rounds, 8 decisions locked,
  all on recommended arms), pipeline v2 recorded, S0 first-cut baseline computed from this
  checkout's verdicts. Stopped at: fleet-wide baseline + S2/S3 launch.
