# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

<!-- Pre-seeded before align formally opens: the packet-launch proposal was grilled
via /grill-with-docs on 2026-08-27 (two frontier rounds, recommended answer first).
Manifest stage remains the authoritative resume point. -->

## 2026-08-27 — kpi-shape

**Question:** How is the single KPI formulated, given a per-agent metric rewards
machine-hogging (the constipation failure mode wins a naive race-to-certainty)?

**Answer:** Fleet-aggregated distribution: P50/P95 of time-to-certainty per verification
episode, aggregated across concurrent agent episodes; tier-relative (repair loop / local
full proof / CI merge are three different certainties) and epoch-relative (a proof is a
fact about `CacheEpoch × tree`).

**Rationale:** Rejected per-agent-pure (one agent minimizes its own KPI by hogging the
machine — contradicts the packet's own backpressure principle) and per-agent-with-external-
fairness-constraint (fairness belongs inside the metric, not bolted beside it). The KPI is
a distribution, not a scalar; "certainty" unqualified by tier and epoch is unfalsifiable.

## 2026-08-27 — baseline-first

**Question:** Does the pipeline get a step 0 that computes the baseline KPI from existing
telemetry before any ontology work?

**Answer:** Yes. S0 = baseline KPI ETL over `.beep/yeet/runs/*/verdict.json` (per-lane
`durationMs`, `outcome`, `createdAt`, `branch`, `head` already recorded) + GitHub run data.

**Rationale:** The letter's own warning — backpressure paying for itself is "measurable,
not assumable." Without a baseline the pipeline can never prove it created value; the ETL
also seeds the A-Box. Rejected pipeline-first and parallel-with-research (weaker controls).

## 2026-08-27 — reasoning-stack

**Question:** What reasoning stack sits on the KPI critical path?

**Answer:** T-Box authored in the OWL 2 RL profile; operational reasoning compiled to
forward-chaining/Datalog rules. A fully fledged OWL DL reasoner becomes its own dogfooding
goal OFF the KPI critical path.

**Rationale:** Repo semantics are closed-world (a package outside the affected set IS
unaffected; turbo hash math is decisive; topo sort is total) — OWL DL is open-world by
construction, and a sound+complete DL tableau reasoner is a multi-year artifact. OWL 2 RL
is rule-compilable by design, keeping OWL interop + SHACL tooling without the tar pit.
Rejected full-DL-in-pipe (blocks the KPI on a research project) and skip-OWL (loses the
semantic-web dogfood and validation tooling).

## 2026-08-27 — mining-direction

**Question:** Which direction does T-Box mining run?

**Answer:** Formal-first bootstrap: mechanically extract candidate classes from the typed
corpus (schemas, LiteralKits, `turbo.json` task definitions, fallow boundaries,
`bun run beep topo-sort`, repo laws), then tiered prose-vein mining fills gaps and supplies
A-Box/cost evidence. Adversarial loops debate the residue, not what the type system states.

**Rationale:** The repo is already a typed corpus with zero-hallucination extraction cost.
Vein tiering: T1 = `.beep` verdicts, GitHub runs, turbo/topo/schemas/laws; T2 = phoenix,
cloudwatch, ai-metrics; T3 = transcripts, memories, OPPORTUNITIES.md. Rejected prose-first
(agents rediscover the obvious at LLM prices) and parallel-tracks (merge conflicts in the
taxonomy debate).

## 2026-08-27 — cq-gate

**Question:** Do competency questions gate T-Box admission?

**Answer:** Yes. An ORSD/CQ stage (via /ontology-requirements) precedes taxonomy; every
class/property must serve a KPI-derived CQ to enter the T-Box ("decision-relevance or
death"), and the CQ suite is the ontology's acceptance-test suite. "100% certainty about
classes" is redefined as: CQ regression green under KGCL-managed evolution.

**Rationale:** Every methodology the packet invokes (including the agento derivation
process) puts requirements before conceptualization; without CQs the adversarial loops have
no stopping rule and "exhaustively enumerate" has no boundary. Certainty is a property of
the validation loop, not of a frozen artifact. Rejected CQs-advisory and no-CQ-stage.

## 2026-08-27 — loop-bounds

**Question:** What bounds the adversarial taxonomist/ontologist loops?

**Answer:** Dry-2 (two consecutive rounds yielding nothing new) AND a CQ-coverage
threshold, under a per-stage token budget. Grok/Codex carry volume; Fable holds judgment
and synthesis (quota doctrine).

**Rationale:** Rejected fixed-rounds (under/overshoots yield) and unbounded-until-consensus
(no termination guarantee). Convergence must be observable, not vibes.

## 2026-08-27 — incubation-home

**Question:** Where does pipeline code (vein miners, KPI ETL, projection function)
incubate?

**Answer:** A labs app beside `apps/labs/semantica` — off the required turbo graphs by repo
law. Ontology ARTIFACTS flow through the existing `packages/ontology` slice (the dogfood:
the slice is the system, this ontology is its first serious operational payload). Proven
projection pieces graduate into repo-cli/yeet.

**Rationale:** Rejected straight-into-tooling (every iteration pays required-graph gate
costs during the exploratory phase) and packet-local-scripts-only (no typed/tested
substrate while iterating). One pragmatic exception recorded: the S0 baseline *probe* and
its first computed distribution live in packet `research/` as evidence; the durable ETL is
born in the labs app when it is scaffolded.

## 2026-08-27 — purity-vs-control-interventions

**Question:** May evidence-backed quick levers (machine-shared turbo cache, `--tier
affected` repair loop, cost-ordered fail-fast ladder) ship while the pipeline is built?

**Answer:** Yes, as tagged **control interventions**: each recorded in this packet against
the KPI time-series before/after.

**Rationale:** Known levers become natural experiments that validate the pipeline's KPI
attribution — the opposite of confounds when tagged. Rejected full-purity (months of known
waste; the letter's meta-work hazard) and fully-decoupled (unattributed confounds weaken
the value proof).

## 2026-08-27 — uncontested amendments (accepted without challenge at grill)

**Answer:**
1. The original steps 5/6 were duplicated verbatim; step 6 is now the **projection
   function** — `(T-Box, A-Box, live instance data) → WorkUnit schedule`, deterministic and
   property-tested. It is the stage that closes the loop from ontology to scheduler
   decision; without it the pipeline risks the beautiful dead T-Box.
2. The research stage adds an /ontology-scout **reuse scan** (PROV-O, P-Plan, OSLC
   Automation, SEON → SSSOM mappings): map before minting.
3. Raw session captures under `prose/` are gitignored; only distilled, redacted prose is
   committed (public-repo redaction law). `pros/` renamed to `prose/`.
4. Fable personally inspects `DrainableWorker.{ts,test.ts}` (t3code) and the effect v4
   `Tx*`/`Graph` modules at the projection stage (S7), validated against `.repos/effect`.

## 2026-08-27 — namespace domain (operator directive, mid-R5)

**Question:** Which domain mints the ontology namespace? (Provisional had been
`https://beep-effect.dev/ontology/ci-ops#`.)

**Answer:** `https://oip.law/ontology/ci-ops#`, prefix `ciops:` — operator ruling
("just do oip.law"), path shape retained. oip.law is a domain the operator actually
controls and deploys (Vercel), so the IRIs can dereference eventually; https minting per
the schema.org IRI doctrine. Applied across ORSD, scope, CQ YAML, and all generated
SPARQL tests (40 occurrences). S8 ratification now covers the term set only; the
namespace itself is settled.

## 2026-08-27 — delegated-lane reasoning effort (operator directive, pre-S4 review loop)

**Question:** What reasoning effort do delegated lanes run at for this initiative?

**Answer:** For ALL tasks delegated to codex or grok in this initiative going forward:
codex lanes run `-c model_reasoning_effort=max` (Codex's "Max" tier — above the old
xhigh scale) and grok lanes run `--reasoning-effort xhigh` (grok's literal maximum).
This supersedes, for this packet only, the global default-medium delegation doctrine.

**Rationale:** The packet's artifacts are judgment-dense and become frozen inputs to
mechanical extraction; review/extraction quality dominates speed and cost here. The
pre-S4 panel (round 1) was restarted mid-flight to apply this — codex seats A/B/C at
max, grok seat D at xhigh.

## 2026-08-27 — S0 vein correction (round-2 finding; supersedes wording in baseline-first)

**Question:** The baseline-first ruling named `.beep/yeet/runs/*/verdict.json` as the S0
ETL source. The investigation proved `verdict.json` is last-write-only (no history) and
that the episode source is `attempts.ndjson` — which round-1 additionally proved is a
~50-start-per-branch RING BUFFER, not append-only history. What is the constitutional
vein?

**Answer:** The S0/durable-ETL vein is `.beep/yeet/runs/*/attempts.ndjson`
(`yeet-attempt-journal/v1`), read as a retained-window ring buffer with continuous
snapshotting for durable history (first snapshot:
`research/evidence/journal-snapshot-2026-08-27/`). `verdict.json` is a last-state
convenience surface only. This entry corrects the baseline-first ruling's source
wording; the ruling's substance (baseline before ontology) is unchanged. Raised as a
constitution-vs-evidence contradiction by round-2 seat F.

Also corrected here (same seat, verified): the topology command is
`bun run beep topo-sort` (not `topo sort`), and it emits sorted package NAMES only —
dependency edges come from workspace package.json manifests.

## 2026-08-27 — final pre-S4 grill, round 1 (four rulings)

**Q1 — scheduling-vocabulary Must CQs.** ADMIT ALL THREE, #870-grounded: projection-
ordering, seat-queue (YeetAdmissionTicket→request, YeetAdmissionLease→grant carriers),
and stopping/cancellation. Vocabulary extracts FROM deployed schemas; DRR stays labeled
prospective. Closes the round-0 admission-law warns (Agent, Scope, SeatRequest).

**Q2 — ScheduleProposal + hasScope.** ADMIT BOTH NOW. The projection's output becomes
A-Box; hasScope derives from WorkUnit scopes (never the trust edge), unlocking the
non-circular CQ-019B scope-narrowness constraint and schedule audit as a CQ.

**Q3 — S4 normalization gate.** FULL NORMALIZATION (operator chose the stronger arm
over the recommended bounded variant): every S4 candidate — classes AND properties —
carries the complete worksheet (ontological category, identity criterion, rigidity,
dependence, temporal behavior) and the S4 gate fails on any unanalyzed term, per
partner review 2's S4-gate table. Reviewer-latency cost accepted knowingly.

**Q4 — terminology.** RENAME + VERNACULAR AS LABELS: ontology terms become
VerificationEvidence (was Proof) and AssuranceTier (was CertaintyTier); repo vernacular
(proof lock, full proof) preserved as altLabels so extraction maps cleanly. The three
splits (obligation/procedure, spec/execution, ticket/lease) become S4 normalization
mandates. Renames apply to glossary/CQs/tests in the post-grill delta pass.

Rounds 2–3 of the frontier grill (admission-law amendment, P95 split, closure
contract, starvation invariant, measurement rules, Should CQs, rebase, intervention
naming) PAUSED at operator request for the ontology-skill creation grill; resume after.

## 2026-08-28 — ontology-foundational-auditor skill created (session interlude)

**Question:** How to durably encode partner review 2's axioms for future ontology work?
The operator's raw capture (the 1395-line review pasted as a skill) had no frontmatter
and no canonical structure; a commissioned deep-research report ("A Reusable
Foundational-Ontology Adversary for Software Repositories") answered the design.

**Answer:** New ninth family skill `~/.claude/skills/ontology-foundational-auditor/`
per the report's architecture: gate between ontology-scout and ontology-conceptualizer;
five artifact contracts in `_shared/schemas/` (SourceObservation / DenotationHypothesis
/ FoundationalAnalysis / IdentityCard / OntologyTermProposal); six laws + failure-mode
table + category cheat-sheet in `_shared/foundational-analysis.md`; authority matrix +
forbidden-LLM-decisions in `_shared/stage-authority-matrix.yaml`; OntoClean BLOCK/REVIEW
rules; five role prompts (denotation, ufo-analysis, ontoclean-adversary,
alternative-model, synthesis); CONVENTIONS.md updated to 9 skills. Scope ruling
(fixer judgment after operator dismissed the ask, consistent with the report's own
"resist building everything" close): TODAY = skill layer only, artifact-by-hand; the
deterministic `ontology-review` engine (parsers, drift diff, gold benchmark, mutation
suite, CI gates) is a named EXPLORATION CANDIDATE the operator may open.

**Consequence for this packet:** the S4 full-normalization ruling (grill round 1 Q3)
now has its operating procedure — S4 lanes run the auditor's S4A→S4D decomposition;
s4-lane-contract.md realignment to the observation→hypothesis→analysis→proposal
artifact flow happens in the post-grill delta pass alongside the terminology renames.

## 2026-08-28 — final pre-S4 grill, rounds 2–3 (eight rulings; frontier CLOSED)

**Admission law:** ORSD NFR-2 becomes the TWO-KIND rule — decision term (Must/Should CQ
requires it) OR semantic-support term (required for a NAMED decision term's
correctness); S5 audits support justifications adversarially.
**P95 tri-split:** predictedP95Duration ≠ admissionCharge ≠ hardExecutionLimit. CQ-010
reshapes to the honest admission-policy heuristic check; admission charges enter as
deployed-policy facts (token weights) via the seat-queue CQ; hard limits are S7
projection-contract territory, never OWL.
**Closure contract:** `ontology/docs/closed-world.yaml` seeded NOW declaring
world/complete_within/source/freshness for every predicate our negations run over
(open-world declared for retention-bounded telemetry); SHACL enforcement shapes = S6.
**Starvation:** Must constraint CQ (zero rows: eligible request waiting beyond the
declared bound without a modeled exception) + the bound as deployed AdmissionPolicy
A-Box fact (aging config carrier); S7 inherits it as hard admissibility.
**KPI measurement rules:** `research/kpi-measurement-rules.md` authored now as v1 ETL
law (episode identity incl. clock-at-seat-request + pre-#870 queueWaitMs=0 mapping,
censorship reporting cut+uncut, tier partitioning, adoption-qualified membership,
observational-vs-causal labeling).
**Should CQs:** cache posture AND cost charging both admitted as Should.
**Corpus pin:** commit the packet on api-ref-scratch + MERGE origin/main (no rewrite,
per repo doctrine) — one tree carries packet + deployed scheduler; every S4 lane pins
one corpus_commit.
**Intervention naming:** class renamed OperationalChangeEvent (observational default;
causal subtype only with supporting design); "control intervention" survives as
DECISIONS vernacular.

Combined with round 1: renames (VerificationEvidence, AssuranceTier), scheduling trio
(CQ-020/021/022) + starvation (CQ-023) as Must, cache-posture/cost-charging
(CQ-024/025) as Should, ScheduleProposal + hasScope admitted, FULL normalization at
S4 under the ontology-foundational-auditor skill. Delta pass applies all of it; round
3 of the review loop (post-grill attack + disposition audit) gates S4.

## 2026-08-27 — final pre-S4 grill, round 1 (frontier questions 1, 2, 6-partial)

**Q1 — scheduling-vocabulary Must CQs.** ADMIT ALL THREE as Must, #870-grounded:
projection-ordering (ordered WorkUnit sequence with Scope per Agent/changeset/epoch/
tier), seat-queue (queued requests per Agent → grants; carriers are the DEPLOYED
`YeetAdmissionTicket`/`YeetAdmissionLease`, so queue wait becomes queryable), and
stopping (which in-flight executions a committed failure obsoletes; clean vs dirty
cancel). Vocabulary is EXTRACTED from deployed schemas, never invented; DRR stays
labeled prospective. This admits `Agent`, `Scope`, `SeatRequest` — closing the three
standing round-0 admission-law warns.

**Q2 — ScheduleProposal + hasScope.** ADMIT BOTH now. The projection's output becomes
A-Box (ordered WorkUnits, the AffectedComputation trusted, grants assumed); proofs and
schedules carry `hasScope` DERIVED FROM THEIR WORKUNITS' SCOPES (never from the trust
edge). This unlocks seat G's closed scope-provenance as the enforceable CQ-019 form
(the partner CQ-019B scope-narrowness query) and ends the "schedule half unenforced"
caveat.

**Q3 — S4 normalization gate depth.** FULL normalization (operator override of the
bounded recommendation): every candidate passes the review-2 worksheet — ontological
category, identity criterion, rigidity, dependence, temporal behavior, spec-vs-
execution, world-vs-information — and the S4 gate fails on any unanalyzed term.
Rationale for full over bounded: the operator canonicalized the discipline as the
`ontology-foundational-auditor` skill (authored in a forked session, 2026-08-27),
which is now the OPERATIONAL CARRIER of the gate — the skill amortizes the worksheet
toil that priced the bounded arm. S4 lanes run extraction; the auditor skill runs the
normalization pass between extraction and admission.

**Q4 — terminology.** RENAME + VERNACULAR AS LABELS: ontology terms become
`VerificationEvidence` (né Proof) and `AssuranceTier` (né CertaintyTier) — reasoner-
facing names carry inferential weight and must be category-honest; repo vernacular
("proof", "full proof", tier names) is preserved as altLabels so S4 extraction maps
cleanly. The three splits — VerificationObligation between tier and procedure,
WorkUnitSpecification/WorkUnitExecution, SeatRequest-ticket/SeatGrant-lease — are S4
normalization MANDATES (the worksheet decides final shapes; the splits themselves are
ruled).

Artifact application (renames, new CQs, glossary/suite regen, harness extension) is a
single pass AFTER the grill completes, followed by round 3 of the review loop
(post-grill delta + disposition audit).

## 2026-08-27 — final pre-S4 grill, round 2 (frontier questions 4, 6-remainder)

**Admission law AMENDED — two kinds, support capped.** A term enters the T-Box as a
decision-term (required by a Must/Should CQ) OR a semantic-support-term (required to
define/constrain/disambiguate a decision term). Every support admission NAMES the
decision term(s) it serves through a checkable dependency (appears in the definition,
an axiom, or a SHACL shape of the served term); a support term whose named dependency
disappears loses its license and is garbage-collected at the next audit. Mechanics:
reachability from CQ roots — the validator extends from `term ∈ CQ-requireds` to
`term ∈ CQ-requireds ∪ reachable-from-a-licensed-term`. Rationale: the strict law
proved category-forcing in our own suite (requiresLane conflates obligation with
procedure; blocked the substitute-cheaper-procedure lever) and incentivized
retroactive-CQ laundering (seat G caught one). Rejected: uncapped (judgment without
structure) and keep-strict.

**CQ-010 TRI-SPLIT + RESHAPE.** predictedP95 (distribution fact) ≠ AdmissionCharge
(policy quantity; deployed carrier = #870 weightTokens, unit-7 extraction) ≠ hard
execution limit (guarantee) — three types, no cross-boundary comparison. CQ-010's NL
becomes the honest deployed-policy invariant (no WorkUnit admitted whose CHARGE
exceeded capacity at admission; zero-rows, A-Box-auditable); the p95-vs-budget
comparison survives as a separately-named Should-level heuristic screen, explicitly
non-guarantee. Rejected: drop (loses the admission-audit question) and caveat-only
(category error stays in a Must CQ's name).

**Closure contract ADOPTED as S6 design law.** OperationalSnapshot declares
completeForPredicate + closureScope; SHACL validates the declaration BEFORE any
FILTER-NOT-EXISTS conclusion is trusted; the projection's fail-safe law
(incomplete ⇒ conservative schedule) keys on it. The harness's non-vacuity antecedents
were the first installment; this is the systematic form.

**Starvation HARD INVARIANT + Must CQ.** A zero-rows constraint — no eligible request
waiting past its declared bound without a modeled exception — with deployed #870 aging
configuration as the extracted carrier; KPI reporting carries starvation beside
percentiles, never inside them. (Review 2's 96-fast/4-starved counterexample:
GoodP95 does not imply NoStarvation.)

## 2026-08-27 — final pre-S4 grill, round 3 (frontier questions 3, 5, remainder) — FRONTIER CLOSED

All four confirmations ADOPTED:
1. **Corpus rebase**: merge origin/main (≥ `debbbb51f7`) into the working branch before
   S4 so lanes see the deployed scheduler; the lane contract's corpus pin becomes
   satisfiable from the working tree.
2. **kpi-measurement-rules.md authored now** as v1 ETL law: episode identity (clock
   opens at seat request, now that SeatRequest is admitted), censorship reporting (cut
   AND uncut distributions, right-censored counts), tier-partitioned reporting with
   starvation beside percentiles.
3. **Cache-posture and cost-charging enter as Should CQs** (read/write × local/remote
   posture per WorkUnit; actual-vs-estimated cost calibration).
4. **Observational intervention naming**: OperationalChangeEvent is the default;
   causal ControlIntervention status requires supporting design; iv-870 re-tags.

The 6-question grill frontier opened 2026-08-27 is now FULLY RULED (12 rulings across
3 rounds; rounds 1–2 recorded above). What remains before S4 launch is WORK, not
decisions: (a) the application pass — renames (VerificationEvidence, AssuranceTier +
vernacular altLabels), the splits, 4 new Must CQs (ordering, queue, stopping,
starvation) + 2 Should CQs, CQ-010 reshape + AdmissionCharge, CQ-019 closed
scope-provenance enforcement via hasScope/ScheduleProposal, glossary/literal-domain/
traceability regen, seed + fixture extension, measurement-rules doc, corpus rebase,
lane-contract wiring of the `ontology-foundational-auditor` skill and the two-kind
admission law; then (b) review-loop round 3 (post-grill delta + disposition audit);
then (c) S4 lane launch.

## §4b ratification sitting (2026-08-29, steward: Benjamin — grilled via /grilling, all rounds settled)

- **Q: Are measurements first-class UFO qualities or recorded values?** A: recorded values
  (observedQueueWaitMs precedent; blinded seat's `quality` reading rejected). Rationale: keeps the
  T-Box lean; the KPI layer reads values. Binds every *Ms/token-count property at S5.
- **Q: Grant model — endurant record or relator?** A: endurant lease record (pid+procStart
  identity); relator rival stays recorded for S5 (grant mereology trigger).
- **Q: MachineProofLock vs generalization?** A: ContendedResource generalization accepted; the
  proof lock becomes its named INDIVIDUAL at S5 with the 27%-bounce history attached.
- **Q: VerificationEvidence identity (content / lineage / role)?** A: accepted FLAGGED; the
  identity/custody contract is a NAMED S5 obligation (needed_evidence text = the work item).
- **Q: CachePosture — resolver decision or execution-borne?** A: resolver-decision reading;
  execution attestation deferred to S5 (CQ-024 actual-posture leg).
- **Q: ScheduleProposal before the retention trace exists?** A: accepted flagged as declared design
  intent (CQ-020 authored for the projection function); transient-DTO rival stays recorded.
- **Q: Ticket/lease split permanence?** A: real and load-bearing; a future transition journal
  becomes an EVENT term, never a merge.
- **Q: 57.75% unresolved-fraction waiver?** A: RATIFIED — deliberate parking of the CQ
  measurement/episode vocabulary pending journal/verdict runtime corpus ingestion; next run must
  re-open every row.
- All 31 submittable proposals ACCEPTED (rat-001..031); 216 conceded referents stand withdrawn;
  149 unresolved rows + 104-entry LEDGER = the S5 queue.

## 2026-08-30 — S5 design grill (eight rulings, rounds 1–2, steward: Benjamin)

- **Home:** S5 outputs live at `ontology/extraction/s5/` (stage-N continuity; the
  taxonomy graduates to the formal T-Box only at S8).
- **Engine:** bespoke `s5-taxonomy-contract.md` + a `validate_packet.py --s5` gate
  (disposition totality over 104 LEDGER + 337 candidates + every fact key,
  join-integrity against rat-001..031, lattice soundness, parked-row protection) —
  not a rerun of the foundational auditor (its unit is the referent, not the lattice).
- **Facts:** the 1,038 FACTS rule in bulk classes keyed by (predicate,
  subject-term disposition); only orphans and conflicts get individual rulings.
- **Parked rows:** the 149 waiver-parked dispositions auto-rule `parked-run-2`
  citing the ratified 57.75% waiver; auditor run 2 re-opens them after the
  journal/verdict corpus extension.
- **Seat budget:** one round, ~6 seats — assembly lanes per kind cluster (codex
  Sol max), one independent adversary (codex max), one blinded alternative
  (grok xhigh) — plus re-review; the §4b join pass shrinks the open surface first.
- **Literal-domain members:** all 89 appear in TAXONOMY.yaml as leaf records under
  their ratified domains (membership-check refs), giving S6 its enumerations.
- **Merges:** duplicate candidates mapping onto one ratified term get a distinct
  `merged-into` ruling (alias provenance is first-class for S6/KPI projection),
  never folded into `accepted-via`.
- **Sitting log:** steward sittings land in DECISIONS.md only (the §4b precedent);
  DISPOSITIONS.yaml carries the machine-readable outcome per row.
