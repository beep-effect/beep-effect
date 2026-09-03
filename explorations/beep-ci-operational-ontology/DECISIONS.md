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

## 2026-08-30 — S5 sittings 1–2 (eight bulk rulings, steward: Benjamin)

Rulings over the join-pass buckets (`ontology/extraction/s5/JOIN.yaml`; rows bind by `seq`):

- **1a (79 literal members, 19 unratified domains):** `parked-run-2`, one row per domain
  cluster, join_ref = the §4b concede-where-held ruling — conceded means undefendable from
  the static corpus, not wrong; run 2's journal/verdict corpus re-proposes them.
- **1b (138 @beep/* package-census individuals):** `rejected` — runtime A-Box data the S6
  ETL regenerates from the live workspace; never T-Box candidates. CQs get these
  individuals from the A-Box at query time.
- **1c (45 unmatched properties):** `parked-run-2` via the ratified 57.75% waiver — the
  measurement/episode vocabulary awaiting the journal/verdict corpus.
- **1d (14 open classes):** merge-pair sitting + residue disposition (executed as 2b/2c).
- **2a (26 lane/work-unit individuals):** `parked-run-2` with their conceded domains.
- **2b (merge pairs):** `merged-into` — HostedRequiredCheck → RequiredCheckDesignation
  and ArchitectureBoundaryRule → VerificationObligation, each a distinct row with the
  reshape OTP + rat as join_ref (alias provenance stays first-class).
- **2c (the 12 residual classes):** `parked-run-2`, all — episode/occurrence/provenance
  vocabulary §4b conceded; the seat round therefore does pure lattice assembly over
  accepted terms, adjudicating no new referents.
- **2d (singletons):** MachineProofLock `accepted-via` (the ratified
  named-individual-under-ContendedResource precedent); YeetWeightedAdmissionV1
  `deferred-s6` (AdmissionPolicy accepted); TurboConfiguration469136d2a872 `rejected`
  (corpus-pinned config snapshot = A-Box evidence); both `dependsOn` properties
  `parked-run-2` with a named run-2 renaming obligation (importsDirectly vs
  declaresDependencyOn — the surfaced S4 merge-key collision).

Candidate totality after sittings 1–2: 26 accepted-via, 7 leaf-of-ratified-domain,
2 merged-into, 1 deferred-s6, 139 rejected, 162 parked-run-2 = 337. Remaining before
the gate: the 104 LEDGER entries (next sitting), fact-classes (derived), the 149
archived observation rows (mechanical parked-run-2), the seat round, TAXONOMY, and
`apply_s5_dispositions.py`.

## 2026-08-30 — S5 sitting 3 (LEDGER docket policy, four rulings + proceed arc)

- **Four-ruling docket policy RATIFIED** for all 104 LEDGER entries:
  `run-2-obligation` (subject parked, or needs runtime corpus / CQ-suite extension),
  `standing-constraint` (domains distinct, no alignment without explicit mapping),
  `taxonomy-input` (parameterization facts about accepted terms), `moot` (subject
  rejected as A-Box). Classifier committed at
  `ontology/extraction/s5/scripts/build_ledger_docket.py`; measured 76 / 20 / 7 / 1,
  emitting 27 constraints to `s5/CONSTRAINTS.yaml`.
- **The six flagged entries ruled**: fallow-laws-I02 standing-constraint
  (result-attribution scope ≠ execution scope binds hasScope); literalkits-I04
  standing-constraint + run-2 leg; turbo-tasks-I04/I01, fallow-laws-I01,
  literalkits-I08 run-2-obligation.
- **Constraints are machine-checkable**: seat prompts embed CONSTRAINTS.yaml and the
  `--s5` gate requires every constraint referenced by TAXONOMY or explicitly waived.
- **Proceed arc approved**: docket → DISPOSITIONS → gate → six-seat round without
  further sittings unless a surprise surfaces; steward returns for seat divergences
  and final ratification.
- Alias rulings folded into the builder: QualityScheduler schema spellings
  (FullProofWork/MergedPreviewWork/PublishWork/ReviewFixWork) are the accepted
  AdmissionWorkKind leaves; TierCiMergeGreen is parked AssuranceTier vocabulary.

## 2026-08-30 — S5 sitting 4 (seat-round ratification; taxonomy RATIFIED)

Seat round: four codex assembly lanes + grok blinded + codex adversary over the 33
accepted terms and 27 constraints. The blinded seat independently reproduced the
IDENTICAL term set (39/39, zero membership divergence) with three field divergences;
the adversary returned 21 PASS / 19 FAIL / 8 INDETERMINATE, validity-audited: the
FAILs were genuine fidelity/category findings, the INDETERMINATEs restate the §4b
flagged identity obligations. Rulings:

- **4a — both contested subsumption edges DROPPED** (ScheduleProposal ↛
  VerificationPlanSpecification, VerificationEvidence ↛ VerificationResultArtifact):
  blinded and adversary independently concur against assembly; re-proposable at
  run 2/S8 with identity evidence.
- **4b — rigidity dropped on instance records** (class-level OntoClean notion);
  **HardFloorException re-ruled parked-run-2** — its leaf join onto the
  StarvationException SITUATION class was a domain-name-normalization artifact
  (classifier value ≠ situation instance).
- **4c — lane placements stand flagged**: FallowAuditLane and FallowHealthLane stay
  instance_of WorkUnitSpecification with placement_pending_ratification; run 2
  carries the named obligation to ratify VerificationLane and re-place them.
- **4d — closing bundle approved**: members' own ratified identity cards
  (ic:turbo-cache:020/021/022); domain-membership identity basis on the worksheet
  leaves; boundary-faithful measurement parameter ranges (AdmissionSnapshot
  pre-grant / observation boundaries); publish's reserved+uninstantiated status
  annotations; four constraints waived to run 2 (parked-vocabulary discharge);
  the 8 INDETERMINATEs acknowledged as flagged obligations; PublishPriority and
  VerifyPriority excluded (S6 A-Box enumerates the deployed LiteralKit).

(Clarifying supersession: the design-grill phrase "all 89 literal-domain members
appear as leaf records" is bounded by these sittings — 1a/4b parked the 80 members
of unratified domains, so the leaf rule covers ACCEPTED members only; the contract
text is amended accordingly.)

**TAXONOMY RATIFIED at 38 terms** (gate 0 blockers / 0 warns, all 27 constraints
bound or reason-waived). `apply_s5_dispositions.py` projected the rulings:
CANDIDATES 32 accepted / 2 merged / 1 deferred-s6 / 139 rejected / 163 parked;
FACTS 4 accepted / 7 deferred / 206 parked / 821 rejected; LEDGER 27/76/1. The
s4-lane-contract §5 completion predicate holds: nothing candidate/open remains.
S5 IS COMPLETE. Next stage: S6 A-Box ratification & predicates.

## 2026-08-30 — S6 sitting 1 (design grill, seven rulings; steward: Benjamin)

Two grill rounds over the S6 A-Box design; the binding contract is
`ontology/docs/s6-abox-contract.md`.

- **Sequencing: S6 before auditor run 2.** The A-Box lands against the ratified
  38-term lattice and closes the loop toward S7; run 2 expands the T-Box on its
  own corpus afterward.
- **SHACL at S6, as scribed.** The closure-contract enforcement shapes ship this
  stage (`shapes/closure.ttl`, pyshacl), honoring the final-grill ruling
  literally rather than reinterpreting it into the python gate.
- **One golden snapshot.** A single pinned OperationalSnapshot from this
  checkout's real `.beep/yeet/runs` journal/verdict bytes (redacted for the
  public repo), ingested through closure declaration + SHACL and CQ-queried
  beside the fixtures. The durable telemetry ETL stays labs-incubated per the
  KPI measurement rules.
- **Hybrid ratification.** YeetWeightedAdmissionV1, its seven parameter facts,
  and the enumerations get per-individual sittings (drift vs the S4-deferred
  values surfaced, never silently re-extracted — verified zero drift at the
  branch cut); census and snapshot ratify as generator + output digest with
  steward spot-checks.
- **Census home: provisional named graph.** The @beep/* census types against a
  `ciops-prov:` namespace (provisional class + provisional dependency edge),
  closure declared OPEN, excluded from negation and ratified-typing shapes —
  honoring both sitting 1b (the S6 ETL regenerates it) and the parked run-2
  renaming obligation (importsDirectly vs declaresDependencyOn) without
  prejudging either.
- **IRI minting: qualify collisions only.** Bare local names stay the default
  (seed + ratified CQs already use `ciops:ActiveGrant` et al.); a literal member
  whose bare name is taken gets domain-qualified — `ciops:AdmissionPriority-publish`
  / `-verify`, with bare `ciops:publish` reserved for the AdmissionWorkKind
  member per sitting 4d. Fibered-IRI doctrine stays out; S8 ratifies IRIs.
- **SHACL scope: closure + typing.** Beside closure validation, shapes enforce
  instance-of-ratified-class and parameter datatype/boundary-range conformance
  on the ratified graphs; the census graph is excluded from typing shapes.

## 2026-08-30 — S6 sitting 2 (A-Box ratification; steward: Benjamin)

Four rulings over the assembled S6 surface (`ontology/extraction/s6/ABOX.yaml`,
corpus pin 3b27a0c179; all extracted values verified zero-drift against the
S4-deferred facts). The fourth ruling was corrected in-sitting from "snapshot
only" to the full bundle — the correction is authoritative.

- **Policy RATIFIED**: ciops:YeetWeightedAdmissionV1 as instance of
  AdmissionPolicy (rat-017) with all seven parameter facts (capacityMaxTokens 10,
  slotSizeGib 5, reserveGib 10, hardFloorGib 15, heartbeatSeconds 5,
  publishAgingSeconds 120 — the deployed starvation aging carrier —
  reviewFixClassCap 3). Candidate seq-247 and the seven deferred fact classes
  project to accepted via `apply_s6_dispositions.py --apply`.
- **Token weights RATIFIED**: the four accepted admissionTokenWeight edges get
  their A-Box carrier (full-proof 3, merged-preview 5, review-fix 1, publish 1).
- **Priority enumerations RATIFIED**: ciops:AdmissionPriority-publish and
  ciops:AdmissionPriority-verify as individuals of AdmissionPriorityClass,
  domain-qualified per the sitting-1 collision ruling; the T-Box stays 38 terms.
- **Bulks RATIFIED + gaps ACKNOWLEDGED**: census (138 @beep/* packages,
  804 provisional edges, digest cc7f08231f65) and golden snapshot (instant
  2026-08-30T22:04:02.475Z, 79 events / 41 admissions, redacted digest
  cf30b993a38d, source pinned against journal growth) both ratify by
  generator + output digest. Six honesty findings enter auditor run 2's queue:
  hasGrantState unratified (state tallies manifest-only);
  capacityAtAdmissionTokens and activeTokens have no deployed journal carrier;
  admittedBy unusable from this source (domain is WorkUnitSpecification);
  no ratified predicate for a request's work kind or priority; CQ predicate
  coverage 1/25 with 0 golden-executed CQs (the three ratified-vocabulary
  golden probes pass in their place).

S6 IS COMPLETE once the projection lands and the gate reports zero pending
refs. Next stage: auditor run 2 (journal/verdict corpus extension, adapter
v1.1.0), then S7 projection function.

### S6 sitting 2 — post-review amendment (2026-08-30, PR #919)

Five review findings (4 P1 + 1 P2) fixed under the steward's direction to
address PR comments; all five strengthen the ratified machinery without
touching ratified content:

- generators refuse dirty source bytes (`assert_sources_clean` — the pin claim
  is now enforced, not assumed);
- the `--s6` gate byte-verifies every generator-digest ratification against
  the artifacts on disk;
- SHACL unavailability now fails the gate closed (contract §4 conformance is a
  blocker, never a skip);
- the snapshot ETL derives the admission root from the running uid;
- the manifest no longer declares `hasGrantState` closed — closure is declared
  ONLY for predicates the snapshot graph actually asserts; the grant-state
  tallies remain manifest counts and the predicate stays a vocabulary gap.

The closure amendment and the moving corpus pin change the CENSUS/MANIFEST
digests — ABOX.yaml is the digest of record and the byte-verifying gate keeps
it honest; the ratified snapshot content — the redacted journal bytes
cf30b993a38d and every policy/enumeration fact — is byte-identical to what
sitting 2 ratified. A follow-up hardening in the same review arc removed every
committed live host path (the manifest source path is now a portable
descriptor; the impl-report environment transcript is prose-elided).

## 2026-08-30 — S7 sitting 1 (projection design grill, four rulings)

Steward re-ordered the queue on merging #919: S7 opens now; auditor run 2
follows S7. The six S6-surfaced gaps become explicitly-unavailable projection
inputs, never blockers. Four judgment points grilled; all four resolved to the
recommended option.

**Ruling 1 — v1 scope is layered: admission core + planner seam.** v1 computes
the deterministic admission-order projection — pending SeatRequests + ratified
A-Box policy + reconstructed token state → an ordered ScheduleProposal under
charge-vs-capacity, priority, FIFO aging, the starvation bound, and hard
limits — entirely inside deployed-scheduler semantics. The service contract
carries an explicit seam for the lane-DAG planner (Graph.topo territory); v1
does not implement it. Rejected: admission-core-only (loses the seam and
forces a fresh design later) and full-episode-planner-now (runs ahead of both
ratified vocabulary and journal carriers — fixture-driven theater).

**Ruling 2 — provisional ordering predicates; run 2 ratifies.** Emitted A-Box
types its nodes with ratified `ciops:` classes (ScheduleProposal, SeatRequest,
WorkUnitSpecification…); the unratified ordering vocabulary (hasCurrentProposal,
hasStep, stepIndex, schedulesWorkUnit, hasScope, class ScheduleStep) is emitted
in the provisional `ciops-prov:` named graph — the exact S6 census precedent
(open closure, excluded from negation/typing). Those terms join the run-2
re-proposal queue; vocabulary enters ratified status only through the auditor.
Rejected: an in-S7 mini-ratification (first-ever vocabulary ratification
outside an auditor run) and no-RDF-emission (schedule-as-A-Box untested).

**Ruling 3 — landing zone is `apps/labs/ciops`, all-in.** New labs app via
`bun run beep create-package`: schemas + Context.Service contract + engine +
property tests all incubate there, off the required turbo graphs (the
incubation-home decision's rationale). Schemas graduate to
`packages/ontology/domain` when proven. Name matches the ontology prefix.

**Ruling 4 — differential replay is IN v1, gating on the golden snapshot.**
A Must property test replays the pinned S6 golden journal (79 events, frozen
bytes, redacted digest cf30b993a38d) through the projection and requires the
projected admission order to reproduce the deployed scheduler's actual grant
order; token state is reconstructed from admitted/released deltas + A-Box
capacity. Flake-free by construction (frozen bytes); any mismatch is a real
semantic finding and becomes run-2 evidence. This is the loop-closer's proof
and seeds the S9 dogfood.

Binding contract: `ontology/docs/s7-projection-contract.md`.

## 2026-09-02 — auditor run-2 launch grill (nine rulings, steward: Benjamin)

Grilled after the S7 lane closed (#936, #940 merged) and the intake docket landed
(`research/auditor-run2-intake.md`). All nine resolved to the recommended arm;
frontier closed in two rounds.

**Ruling 1 — no TypeScript re-extraction in run 2.** The run-1 TS engine used the
compiler API and cannot execute in the #902 stdlib-only python3 sandbox. Run 2 is
re-adjudication: parked candidates ride their run-1 SourceObservations through the
prior-index chain; new vocabulary grounds in journal/verdict NDJSON, emitted `.ttl`
outputs, and prose. TS adapter v1.1.0 is deferred until a run needs new TS
observations. Rejected: a stdlib-Python TS adapter (fidelity downgrade from the
compiler API) and extending the sandbox runner upstream first (re-opens the closed
skill-hardening loop and delays the run).

**Ruling 2 — fresh journal/verdict corpus capture, S6 choreography.** Capture the
live journals now (attempt ring buffers self-erase), redact per the S6 rules, and
commit the raw snapshot beside the S6 precedent (`extraction/s6/snapshot/raw/`).
This is what grounds the 149 waiver-parked measurement/episode rows. Rejected:
reusing only the 79-event S6 snapshot (most rows could not discharge; another
unresolved-fraction waiver likely) and adding a historical-evidence sweep
(bigger ETL/redaction surface than the docket needs).

**Ruling 3 — full docket, one run.** All five intake buckets (149 re-opened rows,
163 parked candidates, 76 ledger rows, 4 waived constraints + VerificationLane,
six S6 gaps + the ciops-prov re-proposal) go through run 2. Rejected: a core-first
run with `carried_from_prior` retirement of the tail.

**Ruling 4 — seats keep the run-1 assignment.** Denotation/foundational/synthesis
= codex Sol max; adversary = codex max in an independent context; blinded
alternative = grok xhigh, now minting `-alt`-namespaced ids per the updated
prompt. Rejected: routing the blinded seat through the proxy harness (more moving
parts mid-run) and dropping the main seats to medium effort.

**Ruling 5 — validator v13 as-is; no upstream skill amendments.** Adapter v1.1.0
mirrors v13 exactly; the JSON pairing-grammar limitation stays a recorded honest
under-emission, and its fix queues as a skill follow-up outside this run.
Rejected: amending the validator first (re-opens the engine surface mid-packet).

**Ruling 6 — run 2 executes on `ontology-run2-prep`.** The branch is fresh off
current main and already carries the intake docket. Rejected: minting a
differently-named branch with the docket cherry-picked (same content, extra
choreography).

**Ruling 7 — ratification via clustered dockets, S5 style.** As each docket
bucket clears the mechanical gate, the steward sits over a suggested-disposition
table clustered by kind (bulk default + individually pulled contested rows);
rulings scribed per sitting. Rejected: one end-of-run marathon sitting and rigid
per-bucket sittings regardless of kind clustering.

**Ruling 8 — one end-of-run PR, #889 choreography.** Pin commit (corpus +
adapters + goldens + scribe), frozen HEAD through the run with `work/` untracked,
final commit of run artifacts + ratifications, single PR babysat to merge-ready;
merge readiness = checks + threads + GitHub mergeability (Greptile cannot score
at this size). Steward merges. Rejected: an infrastructure PR merged to main
before the run (blocks the stint on a mid-way merge cycle).

**Ruling 9 — corpus breadth is the local fleet sweep.** All beep-effect checkouts
on the workstation feed the capture (attempt journals, verdict artifacts,
admission/transition journals), matching the fleet-aggregated KPI framing.
Rejected: primary-checkout-only capture.

## 2026-09-03 — run-2 sitting 1 (adversary round-1 adjudication, steward: Benjamin)

Docket: 45 adversary reviews (36 FAIL / 4 INDETERMINATE / 5 PASS), 100 landed
attacks audited for validity (80 demonstrated / 20 invalid; full grounds in the
run's work/review-audit/validity-report.md, committed with the run artifacts).
All three cluster rulings resolved to the audit split; the 20 invalid attacks
are STRUCK, including the entire landed basis of otp:pa-docgen-work-unit:001
(misread CQ-002 as satisfiable by a nonempty subset) and
otp:pa-turbo-task-specification:001 (used the superseded WorkUnit spelling to
evade the ratified specification/execution split) — both retire at re-review.

**Ruling 1 — warrant-necessity cluster:** revision removes unnecessary support
edges and remaps warrants to the CQs that actually require them; helper classes
whose only case is implementation usefulness are conceded as undefendable from
current evidence (unresolved, run-3 evidence named); five strikes ratified
(attacks treating exact-reused ratified decision terms as optional new
subclasses).

**Ruling 2 — dto-discriminator cluster:** remaining measurement/capacity claims
recast as recorded-value information objects with only evidence-backed joins
(the run-1 'measurements are recorded values' precedent governs);
record-vs-process and content-vs-token choices lacking corpus joins conceded
with exact run-3 evidence named; eleven strikes ratified (carrier-only attacks
against already-supported record/specification content, schedulesSeatRequest
among them).

**Ruling 3 — identity-card cluster:** demonstrated card defects fixed in
revision (cross-wired composite evidence, grain conflicts, child-supplied
identity over an identity-supplying parent); the three co-denoting S7 contract
proposals consolidate; named boundary choices (ScheduleStep content/token,
lease relator/lifecycle, package lineage, evidence claim/carrier) conceded
until provenance exists; four strikes ratified. A concession means unsupported
now, never false.

## 2026-09-03 — run-2 sitting 2 (carried-row adjudication, steward: Benjamin)

Docket: the 149 carried prior-index rows (run-1 observations that cannot re-emit
under the run-2 pin), clustered into 15 referent groups against the run-2
surface (`work/sittings/carried-rows-docket.md` + `carried-clusters.yaml`,
committed with the run artifacts). All three rulings resolved to the docket's
recommendation.

**Ruling 1 — supersession retirements (94 rows, 9 clusters):** measurements,
attempt/execution structure, failure verdicts, merge readiness, origin-key,
package topology, work-unit specifications, and plan control/ordering retire as
irrelevant with per-cluster supersession reasons — the vocabulary lives on in
named run-2 proposals and is judged there, not through obsolete run-1
observation identities.

**Ruling 2 — wrapper retirements (52 rows, 4 clusters):** gate-staleness result
variants, watch-stream event records, monitor rerun-decision records, and
quality report/config containers retire as ontology-irrelevant for v1 —
transport/controller/DTO wrappers with no Must/Should CQ warrant, their
underlying verification and merge outcomes modeled elsewhere. This closes what
run 1 only parked; any future warrant re-enters through a fresh observation
chain.

**Ruling 3 — keep-unresolved (3 rows, 2 clusters):** grant-resource contention
(2) and fleet checkout identity (1) stay open with the docket's named run-3
corpus requirements: a joinable admission/lock event corpus carrying grant
identity, resource path, acquisition/release instants, and contention outcome
in one provenance chain; and a timestamped fleet inventory binding checkout
identity to root, origin, branch/worktree, and shared-cache mounts for the
CQ-015 evidence-transfer bearer.

## 2026-09-03 — run-2 sitting 3 (ratification docket, steward: Benjamin, locked via /grill-with-docs)

Docket: 44 converged proposals (final reviews 21 PASS / 23 INDETERMINATE / 0 FAIL after
three adversary rounds) presented as ratify-candidates (17), flagged submissions (6),
and withdrawals (21 + the stale-review conformance-evidence chain). The grill surfaced
one defect in the docket itself before locking: `hasStep` and `stepIndex` both bind
`ScheduleStep`, which is withdrawn and unratified, and share the pinned CQ-020 wording
problem — ratifying them would mint the `admittedBy` defect class into the taxonomy.

**Ruling 1 — ordering pair deferred:** `hasStep` and `stepIndex` join the run-3
deferral; the full ordering cluster (ScheduleStep and its four relations) ratifies
together after the CQ-020 wording amendment. No dangling ends enter the taxonomy.

**Ruling 2 — 15 ratify-candidates adopted as drafted:** per-proposal verbatim decisions
scribed into rat-032..rat-046 (FailureSignature, VerificationAttempt, the SeatRequest /
DocgenAffectedWorkUnit / FallowAuditLane / WorkUnitSpecification / VerificationLane
reuses, dependsOnTransitive, four AdmissionPolicy component-content mappings, dependsOn
as a plain property, resolved CachePosture as a recorded value, Agent as the anti-rigid
admission-owner role) — the last three carrying the sitting's seat-dispute rulings
(none over relator; information_object over mode; role over kind).

**Ruling 3 — 6 flagged submissions adopted as drafted:** rat-047..rat-052 accept reuse
mappings onto ratified evidence/plan/priority classes with identity-provenance choices
explicitly deferred to run 3 as flagged.

**Closure:** the 24 withdrawn/deferred proposals and their reviews were removed per the
run-1 close precedent (bytes preserved in git history); their observation rows re-parked
with named run-3 evidence; the unresolved-fraction waiver (56%, every park adjudicated
at sittings 1-3) entered the manifest; post-scribe gate: ARTIFACTS VALID — GATE PASSED,
flags only. Run rotated to runs/orun-2026-09-03T02:46:18Z (observations archived under
extraction/s4/archives/ per the v13 scanner-defect relocation).

## 2026-09-03 — run-3 corpora design grill (sixteen rulings, steward: Benjamin)

Grilled after run 2 closed (#957), the CQ-020 amendment landed (#963), the S5 gate
learned the two-run world (#972), and validator v14 discharged both upstream skill
follow-ups (#977). Inputs: a four-lane evidence sweep over the run-2 obligations
ledger, the deployed journal/event surfaces, the checkout-identity/fleet surfaces,
and the ordering-cluster requirements, synthesized into a design brief
(`research/run3-corpora-design-brief.md`). All sixteen resolved to the recommended
arm; frontier closed in three rounds. Two run-2-era blockers were verified already
FIXED on main and are settled facts, not rulings: the admission transition journal
exists and the reaper journals lease/ticket death, and the grant handoff no longer
self-erases (the lease carries the nonce and enqueue instant).

**Ruling 1 — grant-contention instruments first.** The sitting-2 ruling demands
"contention outcome in one provenance chain", and the loss population is traceless
today: no enqueue event exists and an abandoned wait deletes its ticket silently.
One additive v3 journal PR lands before capture. Rejected: capture-what-exists
(winners-only contention; C2/C3 re-park for losers and run 4 inherits the ask).

**Ruling 2 — fleet-wide scope for all three corpora.** Run-2 precedent; the three
admission roots ARE the split-brain evidence; CQ-015's evidence-transfer bearer
needs the fleet. The run-3 ETL must additionally glob linked worktrees and the
now-primary canonical runtime admission root, both invisible to the run-2
generator. Rejected: single-checkout capture (C1 re-parks; CQ-015 stays
unbearable).

**Ruling 3 — new generators, sibling pins.** Run-3 corpora pin as siblings under
the packet corpus home (`run3-*/`) via NEW committed generator scripts with the
run-2 MANIFEST/verify mechanics and S6 `corpus_commit`/source-cite/
`complete_within` conventions. `etl_fleet_corpus.py` stays byte-identical — its
sha256 is pinned into run2-fleet's manifest. Rejected: editing the run-2 ETL in
place (breaks run-2 verification; violates the immutable-packet law) and a shared
ETL library refactor (only safe with a re-proven byte-identical run-2 envelope).

**Ruling 4 — VerificationEpisode gets grounded.** Amended CQ-020 anchors on an
episode subject that was never proposed, and the deployed emission hangs
`hasCurrentProposal` off an untyped singleton. The S7 emission v2 work types a
real episode subject and run 3 proposes the class fresh. Rejected: a second
CQ-020 amendment (erodes a just-steward-sanctioned Must CQ) and proposing
un-grounded (near-certain withdrawal; the cluster ratifies together, so one weak
member re-parks all nine terms).

**Ruling 5 — checkout identity is a timestamped BINDING.** `originKey` is
repo-grain (all checkouts share one value), so C1's key is the corpus-local
fleet-name token with identity recorded as a binding — canonical origin URL,
kind, branch plus its digest, head, git-common-dir linkage — at the capture
instant, exactly the "timestamped fleet inventory binding" the ruling asks for.
Rigidity-across-rename stays an auditor question. Rejected: minting a synthetic
stable id (an unratified identity-criterion claim) and an origin+branch composite
(fails to discriminate co-branched checkouts).

**Ruling 6 — scope surprises re-park, two riders promoted.** The 13 families
fitting no planned corpus (~25 rows, each demanding an authoritative
contract/policy/CQ plus an observed case) re-park with named evidence. Promoted:
`pa-failure-signature` (occurrence join) and `pa-cache-plan-resolution`
(execution join) — both ride the verdict corpus for free. The nine-plus new-CQ
rider families get the same treatment; only cluster-required CQ work rides run 3.
Rejected: a third rider via the passed-step journal enhancement (kept out of the
v3 PR's scope), re-parking all 13 (leaves free discharges on the table), and a
CQ-amendment wave (unbounded scope).

**Ruling 7 — TS adapter v1.1.0 non-trigger recorded.** Run-3 corpora are
journal/inventory captures; the ordering-cluster evidence is emission RDF plus
the three hand-captured run-2 ProseObservations. The conditional deferral's
trigger ("a run needs new TS observations") does not fire. Rejected: speculative
v1.1.0 build.

**Ruling 8 — staged capture, Stage A / Stage B.** Stage A immediately:
checkout-identity capture plus identity-provenance of what exists (three
admission journals, fleet attempts/verdicts including worktrees) plus
granted-work contention facts. Stage B after the v3 PR, organic traffic, and
proof-ledger materialization (the issuance ledger exists in no checkout yet):
loss-population contention and proof-ledger issuance rows. Two pins, two
MANIFESTs, accepted. The S7 emission-v2 PR (Ruling 13) is a PARALLEL
instrumentation workstream: it gates the ordering-cluster evidence consumed at
the run itself, never the Stage B capture. Rejected: one capture gated on the
slowest of four clocks while ring buffers erase evidence.

**Ruling 9 — v3 event set is items 1-4.** `admission-enqueued` (nonce, pid,
procStart, attemptId, kind, weightTokens, priority, originKey, checkoutRoot,
branch, enqueue instant); `admission-withdrawn` in the ticket finalizer;
checkoutRoot+branch on released/evicted; last heartbeat instant on
lease-evicted. All additive NDJSON variants. Rejected: capacity stamps (feed a
family Ruling 6 re-parked) and the minimal enqueued+withdrawn pair (leaves
checkout attribution on the Option-attemptId dependency).

**Ruling 10 — fixture-induced evictions, labeled synthetic.** Zero death-shaped
events exist in the wild, and open-world absence cannot ground the sitting-1
lease-lifecycle boundary concessions. One fixture-driven eviction/withdrawal
scenario runs under the runtime-root test override, pinned with explicit
synthetic-provenance labeling; the seats weigh it in the open. Rejected:
organic-only waiting (likely re-parks the lifecycle boundary again).

**Ruling 11 — custody surrogate before the pid drop.** The run-2 redaction drop
deletes pid/procStart — the custody key. Capture mints `ownerRef =
sha12(pid:procStart:captureSalt)` with a per-capture salt BEFORE the member-drop;
the residue verifier still enforces zero raw bytes. Per-capture salt caps
quasi-identifier exposure via cross-capture unlinkability. Rejected: nonce-scoped
lineage only (four ratification flags re-defer) and an unsalted surrogate
(enumerable, hence reversible).

**Ruling 12 — cache mounts: turbo topology primary, git-common-dir secondary.**
CQ-015's join is proof `cachedIn` / checkout `mountsCache` under one epoch, so
the bearer is proof-cache topology: per-checkout turbo cache mounts (local cache
presence plus remote-cache enablement). Git-common-dir linkage is captured as a
checkout-binding fact for C1, not a proof cache. Install roots are skipped — no
CQ consumes them. The necessary-not-sufficient caveat (task-hash granularity)
stays on the record. Rejected: git-common-dir as the primary bearer and
capture-everything.

**Ruling 13 — S7 emission v2 is one bundled PR.** All five emission changes —
the scope-literal rename off the punned spelling, a typed
AdmissionProjectionSpecification individual plus its edge, digest serialization,
the typed episode subject (Ruling 4), and the deferred-tail step-reference
decision — plus the stale contract-doc refresh, land together, scribed as
instrumentation FOR run-3 ratification evidence, not ratification (the
contract's own §6 boundary). Rejected: piecemeal PRs (repeated provisional-graph
churn) and deferring emission to Stage B (the cluster's evidence IS the
emission).

**Ruling 14 — stepIndex is 0-based.** The evidence is the deployed emission;
ORDER BY is unaffected. seed.ttl and the CQ-020 sample answer get fixed in the
run-3 docket. The recorded none-vs-quality category dispute resolves in the
proposal text at the sitting. Rejected: 1-based with an emission change (puts an
engine edit between the evidence and the proposal).

**Ruling 15 — S8 stays out; nonce evidence rides.** IRI-scheme work remains
deferred per the standing pipeline, but emission v2 carries the scheduled unit's
nonce alongside the positional node ids, so nonce-grain SeatRequest identity
EVIDENCE exists and run 3 ratifies identity criteria semantically without fixing
IRI syntax. The `ciops-prov:` namespace re-proposal rides the cluster either
way. Rejected: pulling S8 into run 3 (timeline hostage) and positional-only
(the identity-criteria half re-parks).

**Ruling 16 — legacy terms: historical carrier; ratify-if-exercised.**
`schedulesWorkUnit` stays CQ-019 arm 3's historical carrier, unratified and
unrewritten mid-run. The object-property `hasScope`/`Scope` pair ratifies only
if run-3 fixtures exercise arm 2; otherwise it parks with the no-punning record.
Rejected: rewriting arm 3 mid-run (a Must-CQ semantic edit) and ratifying
unemitted vocabulary. Docket consistency item (no ruling needed): CQ-019's
`required_properties` and the traceability matrix must be aligned with the arm
predicates its query text actually uses — three artifacts currently disagree.
