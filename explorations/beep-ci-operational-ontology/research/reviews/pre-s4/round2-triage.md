# Round 2 triage — final adversarial round (2026-08-27)

Panel: seats E + F (codex, `reasoning effort: ultra` — verified in run headers),
seat G (grok, xhigh). Posture: pure attack on the round-1 FIXES; known-open grill items
off-limits. Fixer: Fable. This round validated the loop's premise the hard way: seat E
EXECUTED the queries (Oxigraph) and found semantic bugs that parse-only checking
certified; seat G broke a round-1 fix outright (CQ-019 circularity); seat F broke five
claims against deployed origin/main code. All fixes below re-verified by the new
executing harness.

## Seat E (codex ultra) — repair-regression on queries

| Finding | Disposition |
|---|---|
| CQ-004 BIND arm evaluates without outer mapping → UNBOUND rows green `non_empty` (Oxigraph-proven) | FIXED — touched pattern repeated inside each UNION arm; regression fixture `cq004-touched-only.ttl` + all-bound oracle |
| CQ-006 invalidated proof still discharges (missing CQ-005's exclusion) | FIXED — inner `FILTER NOT EXISTS { invalidates }`; `invalidates` added to requireds; fixture `cq006-invalidated-proof.ttl` |
| CQ-012 partial episodes silently vanish from all sums → plausible-but-wrong shares | FIXED — query now reports `decomposedEpisodes` vs `windowEpisodes` (multi-block harness binding); harness fails on mismatch; fixture `cq012-incomplete-episode.ttl` |
| CQ-012 zero-denominator all-unbound row greens `non_empty` | FIXED — `HAVING (SUM(?total) > 0)` + all-bound oracle |
| Binding convention permits batched multi-row substitution (merged aggregates; collapsed ASK) | FIXED — ONE-ROW-ONLY contract + preserved-datatype rule + multi-block rule in suite header |
| CQ-011/012 typed-literal window params vs plain-string data silently drop solutions | FIXED — datatype rule in header; noted as a harness datatype-validation gate; CQ-011 plain-only case goes red (E verified), CQ-012 mixed-graph risk documented |
| CQ-013 delayed signature with NO surfacing lane invisible | FIXED — lane join OPTIONAL; unbound `?lane` = visible coverage hole; oracle allowance recorded |
| CQ-015 `boolean` oracle checks type not value | FIXED — harness asserts value: seed=true, `cq015-no-mount.ttl`=false; CQ note updated |
| regen script destructive writes without preflight (priority typo silently deletes a test; id collision overwrites) | FIXED — full-authority preflight (priority/expected enums, id + output-path uniqueness, single-line NL) aborts before any write |
| regen multiline-NL header corruption (latent) | FIXED — preflight rejects |

Attacks that failed (E confirmed sound): CQ-006 negation correlation, CQ-013 tie
semantics (set-valued argmin), CQ-017 symmetry, CQ-019's untyped `?subject` (correct —
a class constraint would be the loophole), zero-rows falsifiability, marker convention
unambiguous in current files, byte-faithful regeneration.

## Seat F (codex ultra) — post-fix coherence vs deployed reality

| Finding | Disposition |
|---|---|
| Fleet probe merged same-named branches ACROSS checkouts (real collisions verified) | FIXED — episodes keyed by `(checkout, branch)`; rerun reproduces published 282 / 41.3m / 3.1h exactly (defect real, quantiles unchanged — luck, now disclosed) |
| Published fleet table not reproducible by the documented recipe; row semantics undisclosed | FIXED — baseline provenance-honesty paragraph: raw census rows vs filtered episode row; committed probe v3.1 command reproduces the episode row; fleet right-censoring now reported (90 pairs, 236 red attempts, ≤65.2h) |
| ORSD AC2 unsatisfiable after queueWaitMs admission (pre-#870 journals lack it) | FIXED — AC2 states the pre-intervention mapping (`queueWaitMs = 0`, unlabeled waiting disclosed) + post-#870 needs ticket/lease telemetry |
| Enum-collision: `review-fix`/`publish` exist in multiple deployed domains; member records unqualified; unit ownership overlapped | FIXED — `source_domain` required on literal-domain-members; merge key includes it; unit 4 excludes unit 5/7 files |
| UC-002 deployed-vs-prospective fix lived only in YAML comments | FIXED — structured `main_flow` now separates active-policy invariants / DEPLOYED #870 ordering / PROSPECTIVE DRR |
| `one-grant-per-checkout` false post-#870 (review-fix class-capped, no checkout gate — verified in Handler.ts/QualityScheduler.ts) | FIXED — scope.md restates as one-FULL-PROOF-grant-per-origin; CQ-009 NL scoped to full-proof class + S6 ingestion note |
| Baseline "replacing the bounce-fail proof lock" overstated (lock retained) | FIXED — "layered over the retained per-origin lock; contender behavior changes" |
| Merge time is not the fleet intervention boundary (staggered adoption) | FIXED — adoption-qualified membership (HEAD ancestry ≥ mergeCommit) in baseline header + control-interventions.yaml; CHECKOUT_HEADS.txt is the adoption census |
| Bounce exclusion does not remove waiting wall time from episode durations | FIXED — caveat corrected (removes bounce ATTEMPTS from opening/counts only) |
| Right-censor "age so far" label underdefined | FIXED — relabeled observed span to last recorded event, lower bound, no common cutoff |
| Schema "assertion" is a skip; verdict schema unchecked | FIXED — verdict schemaVersion checked + counted; output says "SKIPPED, not asserted" |
| Bounce classifier prose-substring caveat absent from baseline | FIXED — caveat added (structured journal marker named as real fix) |
| CI-tier "adds ~12m after local green" overclaimed from duration sample | FIXED — reworded to workflow-duration sample; join stays v1 |
| Baseline intro stale (single checkout) | FIXED |
| scope/ORSD 17%/59% without pre-intervention qualifier | FIXED |
| DECISIONS baseline-first names verdict.json vein (constitution vs evidence) | FIXED — dated corrective DECISIONS entry (journal ring buffer is the vein; also records the real `topo-sort` command) |
| Unit 7 facts don't fit the candidate record (config VALUES) | FIXED — `facts:` record type (subject/predicate/value/value_type + admission law) |
| `bun run beep topo sort` does not exist; stdout not citable | FIXED — real command; orchestrator captures to a committed inputs file; edges from package.json manifests |
| Telemetry under-freezes (2/5 files, no corpus commit, no digest procedure) | FIXED — all five digests + corpus_commit + digest command + origin-main materialization rule |
| Completion gate had no executable carrier | FIXED — `validate_packet.py` committed to the packet (known-limits documented); `--s4-lane` extension named |
| LEDGER schema-less; candidates could skip S5 disposition | FIXED — entry schema + claim normalization + CANDIDATES/FACTS merged outputs; S5 completion covers candidates+facts+issues |
| Source manifest vagueness (bare filenames, unnamed design record) | FIXED — full paths incl. `goals/ship-velocity/research/d1-admission-scheduler.md` |
| Runner/model provenance contradiction | FIXED — `-m gpt-5.6-sol` explicit in the prescribed command |
| ORSD glossary census regressed (41 vs 46) | FIXED |

## Seat G (grok xhigh) — free adversarial

| Finding | Disposition |
|---|---|
| CQ-019 completeness letter CIRCULAR ("affected-scoped" knowable only from the omitted edge) — round-1 FIX broken | FIXED (as far as pre-grill allows) — CQ-019 note rewritten to closed scope-provenance (hasScope derived from WorkUnit scopes; non-full scope ⇒ edge required; closed outcome enum); the schedule half explicitly RECORDED AS UNENFORCED pending the ScheduleProposal/hasScope grill ruling |
| CQ-012 never read the queueWaitMs admitted to close the queue-wait game | FIXED — queueShare in the instrument; requireds/traceability updated |
| #870 experiment self-erasing (ring buffers) + no ControlIntervention record + classifier fragility | FIXED — fleet evidence snapshot (245 journals/28 checkouts + HEADs + sha256s + gh-runs window, payload gitignored, manifests committed); `control-interventions.yaml` seeds iv-870 with adoption-qualified membership |
| attributedDelayMs = mild retroactive-CQ; occurredAt/episodeStartedAt duplicate temporal vocabulary | RECORDED — honest flag in CQ-013 note (S5 must ratify or strike); temporal-vocabulary consolidation queued for S5 |
| hasCurrentEpoch freezes coarse epoch grain contradicting CQ-015's task-hash caveat | S4/S5 — the grain pin is already the recorded resolution path; extraction lanes see both notes |
| Loop holes: (1) grill/delta inversion vs cap | ACCEPTED — round 3 (the cap's last) is RESERVED for post-grill delta; recorded below |
| (2) fixer self-review of dispositions | ACCEPTED — G's own CQ-019 break proves it; round 3 seats explicitly AUDIT the round-1/2 disposition maps |
| (3) round-0 checker not in tree; structurally blind to semantics | FIXED — `validate_packet.py` committed with known-limits; the semantic gap is now owned by the EXECUTING harness (`run_cq_suite.py`) |
| (4) effort ≠ capability (xhigh adversary missed what an executing engine caught) | ACCEPTED + ACTED — `run_cq_suite.py` + seed + 8 must-fail fixtures: 18 seed tests all-bound green, all counterexamples now permanent executable regressions |
| VALUES-are-not-A-Box; suite had no seeded graph (ORSD §7.1) | FIXED — `ontology/tests/fixtures/seed.ttl` (matches committed harness-bind individuals) |
| CQ-007 escaped the binding convention ("For an episode") | FIXED — "a given episode" + harness-bound VALUES |
| Traceability regen certifies YAML claims, blind to requireds-vs-query drift | RECORDED — known-limit in validate_packet.py docstring; SPARQL-parsing validation is a harness v2 item |

## Verdict

Round 2 found real blockers in the round-1 repairs and they are fixed and now
EXECUTABLY guarded: `regen → validate_packet (0 blockers) → run_cq_suite (0 failures,
18 seed + 8 must-fail)` all green. Remaining open: the 5 grill-frontier questions
(operator's), the S5/S6 carriers, and the corpus rebase. **Round 3 = the cap's final
round, reserved for the post-grill delta: seats re-attack the grill-admitted vocabulary
AND audit the round-1/2 disposition maps (seat G's self-review remedy).** S4 launches
only after that.

## Addendum 2 — foundational-ontology partner review (review 2, received post-round-2)

Full text: [`round2-partner-review2.md`](./round2-partner-review2.md). A
category-discipline audit (UFO/OntoUML/OntoClean lens) — different in KIND from seats
A–G: it attacks what the frozen names DENOTE. Its central demand: **S4 = candidate
bootstrap + ontological normalization, never "extract the T-Box"** — identity/rigidity/
dependence/spec-vs-execution/world-vs-information analysis stands between extraction
and admission, and the LLM proposes but never authorizes.

Already satisfied (independent convergence with rounds 1–2): candidates-not-classes
lane contract with status transitions reserved for human ratification; frozen corpus +
commit pinning + drift reconciliation; deployed-vs-prospective tagging; provenance per
candidate; consensus-is-not-authority (loop doctrine); executable fixtures over prose
confidence; CQ-015 insufficiency recorded; ControlIntervention adoption-qualification.

Mechanically applied now:
- **Antecedent non-vacuity companions** for all three zero-rows CQs in the executing
  harness (its exact pattern: zero rows accepted ONLY with the antecedent population
  present; emptiness must be intentional) — green.

GRILL — the review's substantive demands are scope/design decisions, consolidated as
**frontier question 6 (foundational normalization cluster)**, operator's to rule:
1. S4 contract amendment: candidate records gain the normalization worksheet
   (ontological category, identity criterion, rigidity, dependence, temporal behavior)
   and the S4 gate fails on unanalyzed sortals — per its S4-gate table.
2. Terminology rulings: `Proof` → `VerificationEvidence` (green CI output is evidence,
   not deduction) and `CertaintyTier` → `AssuranceTier`; obligation/procedure split
   (`VerificationObligation` between tier and lane); `WorkUnit` specification/execution
   split; ticket/lease split for SeatRequest/SeatGrant (deployed #870 already
   distinguishes them). Fixer note: the repo vernacular ("full proof", proof lock) is
   load-bearing — a labels-vs-referents compromise (keep operational names as labels
   over honest definitions) is a legitimate alternative arm.
3. Admission-law amendment: decision-term OR semantic-support-term (defined/constraining
   term required for a decision term's correctness) — replaces the bare
   "decision-relevance or death" slogan.
4. CQ-010 split: predictedP95 ≠ admissionCharge ≠ hardExecutionLimit (deployed #870
   charges token weights — the percentile-as-bound reading was always wrong; the CQ
   survives as an admission-policy heuristic check, renamed honestly).
5. Closure contract: OperationalSnapshot + completeForPredicate declarations gating
   every FILTER-NOT-EXISTS conclusion (S6 SHACL design; supersedes ad-hoc
   completeness notes).
6. Starvation invariant: hard max-wait/aging guarantee distinct from the percentile
   KPI (its 96-fast/4-starved counterexample; deployed #870 aging is the carrier).
7. `ControlIntervention` naming: observational OperationalChangeEvent by default,
   causal only with design support (iv-870 record already carries the caveats).
8. Its 22 revised-CQ candidates fold into the S5 agenda alongside the round-1 grill
   CQs.

S5/S8 carriers (recorded, no action now): asymmetric adversary seat mandates
(identity/OntoClean/UFO/logic/reality/CQ/optimization/provenance/LLM-safety); the
forbidden-LLM-decisions table as S4/S5 governance; mutation + metamorphic +
non-entailment test layers; the quality dashboard (ontology validity ≠ KPI utility);
DecisionContext reproducibility tuple at S7; conservative-fallback projection laws.
