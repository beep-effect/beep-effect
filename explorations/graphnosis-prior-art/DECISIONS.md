# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-06 — packet-shape (Q1)

**Question:** Does this packet graduate as one goal packet, or dissolve into amendments on
existing packets?

**Answer:** **Dissolve, with exactly two graduations.** The 26 amendments in
[`research/AMENDMENTS.json`](./research/AMENDMENTS.json) route to their existing packets; this
packet keeps the provenance ledger and this decision log. Two new goals graduate:

1. `epistemic-contradiction-detection` — detection is an explicit Non-Goal and a
   stop-and-re-scope condition of `goals/epistemic-contradiction-triage`
   (`SPEC.md:23-26,138-139`), so it cannot be amended into that packet; it needs its own.
2. A repo-law bundle — Rule 5 (a minting process cannot raise its own ceiling), declared loop
   caps with recorded stop reasons, and law-scanner non-vacuity. No active packet owns any of
   the three.

**Rationale:** 63 of ~80 routed items land on packets that already exist and are already asking
the question — a single `graphnosis-adoption` packet would cut across 20+ packets' territory and
duplicate their open questions. Rejected: *graduate as one packet* (territory overlap);
*dissolve + 1 graduation* (folding the repo-laws into standards prose leaves nobody owning proof
that the laws are enforced — the non-vacuity scanner fix wants an owner); *dissolve with zero
graduations* (the detection Non-Goal means no existing packet will ever pull contradiction
detection in on its own). Recommendation given: dissolve + 2; accepted.

## 2026-08-06 — ranked-tie comparator key (Q2)

**Question:** What keys the canonical ranked-tie comparator that
`goals/hybrid-retrieval-fusion-core/SPEC.md:85` requires but leaves unnamed?

**Answer:** **Provenance-keyed, field-at-a-time** — an `Order.combineAll` of `Order.mapInput`
projections over `SourceTextIdentity` fields (`locator`, then `startChar`, then `textDigest`),
with EntityId as the terminal projection **for totality only**. Ranking must remain a pure
function of `(corpus, query)`.

**Rationale:** EntityId-keyed ordering is the donor's shipped-measured-reverted defect — their
own `tie-break.ts` postmortem: ordering on a surrogate id makes results *"an artifact of how the
candidate pool was built rather than anything about the query"* — and it is the exact shape of
the live `WinkCorpus.service.ts:783-784` bug (ties on `entry.index`). A concatenated provenance
string was rejected because numeric fields compare lexically after concatenation and per-field
direction is inexpressible. Recommendation given: provenance field-at-a-time; accepted.
Downstream: this wording lands in the fusion-core SPEC amendment and shapes the WinkCorpus fix.

## 2026-08-06 — authority ceiling placement (Q3)

**Question:** Does the authority ceiling live on the artifact, in the session context, or both?

**Answer:** **Both — and the artifact's declaration may only lower.** Effective authority is
computed at use time as `min(declared ceiling, ambient session ceiling)` under the ceiling order,
with an absent declaration meaning most-restrictive. Rule 5 (a minting process cannot raise its
own ceiling) holds by construction: minting writes the declaration, but the clamp always comes
from the consuming context.

**Rationale:** Session-only was rejected because the restriction does not travel — a borrowed or
exported artifact arrives unrestricted, the exact failure mode the trained-skills paper exists to
prevent. Artifact-only was rejected because it violates Rule 5 — the minter approves its own
limits and nothing ambient can clamp a generous declaration. TierGate already owns the
enforcement half in-tree (correction C2 in the amendments lane); this decision adds the
declaration half and the min-composition. Recommendation given: both/min-composed; accepted.

## 2026-08-06 — blocksReadmission ownership (Q4)

**Question:** Who owns the rule deciding whether re-ingesting retired content may resurrect it
(retirement-reason distinction: deleted ⇒ stays dead, superseded ⇒ may return)?

**Answer:** **A belief-view policy that the ingest path consults.** `blocksReadmission` lives
with belief-view revision, where retirement semantics already live; ingest, forget, and
preview-forget all consult the same code path (the donor's `previewForgetTopic` parity).

**Rationale:** An ingest-path check gives retirement semantics a second owner at the boundary
and breaks preview parity — previewing a forget would not run the code re-ingest runs. Checking
in both places makes a policy/boundary disagreement reachable state that neither side's tests
would catch. Recommendation given: belief-view policy consulted by ingest; accepted. Downstream:
lands as the retirement-reason amendment on the epistemic belief-view/ingestion packets.

## 2026-08-06 — sensitivity classifier placement (Q5)

**Question:** Does a content-sensitivity classifier enforce in a planner or at the egress
boundary?

**Answer:** **Egress boundary, coarse binary first.** The lock sits where content leaves the
trust boundary (cloud LLM calls, external services) — one choke point covers every path,
including ad-hoc tool calls and egress points added after any planner was written. Start with a
binary sensitive/not classification; a graded taxonomy only if evidence demands it. Planners may
consult the classifier advisorily; enforcement is at egress.

**Rationale:** This is trained-skills ts-23 mapped onto the standing OIP rule (pre-publication
patent text never reaches cloud AI) — made mechanical instead of procedural. Planner-side was
rejected because it covers only planned paths and requires the planner to model every egress.
Both-plus-graded-taxonomy was rejected as scope: taxonomy debate before any enforcement exists
ships nothing. Recommendation given: egress binary first; accepted.

## 2026-08-06 — DeterminismTier timing (Q6)

**Question:** Do we declare a DeterminismTier on tool/agent surfaces before a golden-vector
mechanism exists, or only with/after one?

**Answer:** **With or after golden vectors — never before.** A tier declaration lands in the
same PR as the mechanism that can falsify it; declaring a surface deterministic and shipping its
golden-vector test are one change. A tier nothing can test is a comment, not a contract.

**Rationale:** The donor is the cautionary case: their published purity claim coexisted with a
`process.env.GNOSIS_SCORE_RULE` fallback still read by `traverser.ts` in v0.11.0 — an untested
tier declaration drifts into aspirational metadata. Declare-now-verify-later was rejected for
exactly that drift; no-tiers-tests-only was rejected because the consumer-facing grouping (what
may an agent cache, retry, replay?) is real value tests alone never surface at the tool
boundary. Recommendation given: with/after; accepted.

## 2026-08-06 — fusion-core intent input timing (Q7)

**Question:** Does the fusion-core query contract carry aggregation-vs-lookup intent from day
one, or only after calibration data exists?

**Answer:** **Now — typed input, floor defaulting off.** The query schema carries
`intent: LiteralKit("lookup", "aggregation")` and a `sourceFloor` parameter from day one, both
with constant defaults that make them no-ops until calibration data justifies a real threshold.
Behavior unchanged until evidence; the contract never breaks.

**Rationale:** This is the packet's timing argument applied to itself: a schema field is one
sentence in an unstarted SPEC now and a breaking change for every caller (plus re-recorded
golden vectors) later. Runtime intent inference was rejected because a classifier version
becomes an undeclared ranking input, violating the Q2/wp-13 doctrine that ranking is a pure
function of (corpus, query). Recommendation given: now, typed, floor off; accepted. Downstream:
joins the fusion-core SPEC amendment alongside the Q2 comparator sentence.

## 2026-08-06 — loop caps before adherence (Q8)

**Question:** For the skills work, do declared loop caps land before an adherence instrument, or
after?

**Answer:** **Caps first, adherence second.** Per-edge lifetime caps with a declared cap and a
recorded stop reason (`completed` / `cap-reached` / `blocked`, cap-reached a normal outcome)
ship first as part of the Q1 repo-law bundle. The adherence instrument comes second and consumes
the stop-reason records the caps produce.

**Rationale:** The ordering is a data dependency, not just prudence — the instrument cannot
exist before something produces its input, and without a declared cap there is no reference line
to measure deviation against. Adherence-first was rejected because measuring an unbounded walk
inherits the unboundedness; together-in-one-packet was rejected because coupling delays a
five-line safety law on a metric's open design debate. Recommendation given: caps first;
accepted.

## 2026-08-06 — MATRES modality placement (Q9)

**Question:** Does the MATRES eight-axis modality taxonomy land on belief-view revision or on
the new contradiction-detection goal?

**Answer:** **Belief-view revision, as a vocabulary.** Modality qualifies what a belief asserts
— its truth-mode — so it is belief representation, owned where beliefs are modeled. The detector
consumes it (contradiction requires comparable modality; hypothetical vs factual is not a
contradiction), as do retrieval and revision. Cite **Ning et al. 2018 (MATRES)**, not
Chronocept.

**Rationale:** Detector ownership inverts the dependency direction — revision would import a
representation concept from one of its consumers, and modality matters even when no
contradiction is in play. Skipping was rejected because the quarantine covers Chronocept's
numbers, not Ning et al.'s taxonomy, and deferral spends the free-schema-timing window on a
future backfill migration. Recommendation given: belief-view revision as vocabulary; accepted.

## 2026-08-06 — envelope contract: paragraph vs packet (Q10)

**Question:** Do the gai-format lessons get a versioned-artifact-envelope-contract goal packet
now, or one standards paragraph the first real artifact format inherits?

**Answer:** **Standards paragraph first.** Three commitments pinned in standards prose: every
artifact envelope declares `(version, conformance)`; version-skew is a distinct tagged error
class from corruption, keyed on what the consumer should do; format breaks batch — "one break,
once". A packet opens only when a concrete format (skill export, evidence pack) needs
implementation.

**Rationale:** No shipping format needs the contract yet — the Skill model is a 47-line stub and
no export format exists — so a packet would design against no consumer and rot fake-active, the
exact guardrail this pipeline warns about. Per-format ad-hoc versioning was rejected because the
gai-format lesson is that skew-vs-corruption must be decided before the first format ships, or
consumers inherit N incompatible error vocabularies. Recommendation given: paragraph first;
accepted.

---

**Align stage closed 2026-08-06:** Q1–Q10 all resolved, each as recommended. The packet advances
to `shape` with two work products ahead: (a) BRIEF.md for the two graduations
(`epistemic-contradiction-detection`, repo-law bundle), (b) the amendment-application pass over
[`research/AMENDMENTS.json`](./research/AMENDMENTS.json), now unblocked — Q2/Q7 settle the
fusion-core wording, Q4 the retirement-reason wording, Q9 the modality placement, Q10 the
standards paragraph.

## 2026-08-06 — correction to Q2's schema naming (verification pass)

**Correction, not a reversal.** Q2's answer names `startChar` as a `SourceTextIdentity` field.
It is not one — `SourceTextIdentity` carries `scopeRef`, `sourceRef`, `locator`, `sourceDigest`,
`textDigest`, `extractor`, `normalizationVersion` (`SourceTextIdentity.ts:119-140`); `startChar`
lives on `TextAnchor` (`TextAnchor.ts:48`). The decided **mechanism** stands unchanged
(provenance-keyed, field-at-a-time, EntityId terminal for totality only); the comparator simply
spans the anchor schemas, which is exactly where the two provenance code-change amendments
already put it (new `AnchorOrder.ts` / `SourceSpanOrder.ts`). The fusion-core SPEC amendment
should cite anchor-bearing provenance fields, not `SourceTextIdentity` alone.

## 2026-08-06 — shape confirmed; graduation executed

**Question:** Does `BRIEF.md` match the picture in Benjamin's head (the shape-stage exit gate)?

**Answer:** **Confirmed.** Benjamin's instruction to finish the exploration and drive the packet
PR to mergeable closes the gate on the adversarially-verified BRIEF as written. Stage advances
shape → decompose → graduate in one motion: `MAP.md` decomposes the two Q1 graduations, and both
goal packets are scaffolded from `goals/_template` —
[`goals/epistemic-contradiction-detection`](../../goals/epistemic-contradiction-detection/README.md)
and [`goals/agentic-governance-laws`](../../goals/agentic-governance-laws/README.md) (the
BRIEF's working slug, kept). Status flips to `graduated`; the packet remains as provenance.

**Rationale:** The definition-of-ready held — BRIEF complete and verified against main,
`openQuestions` empty, MAP names both goals with capability citations, every major component
cites shipped code or is marked NET-NEW. The amendment-application pass over
[`research/AMENDMENTS.json`](./research/AMENDMENTS.json) is deliberately **not** part of this
graduation: it edits other packets' specs and shipped code, so it travels as its own PR ladder
(spec-delta docs-PR carrying the Q10 standards paragraph, then the three code-change PRs), per
the BRIEF's Sequencing and the repo's grill-outcomes-are-docs-PRs-first practice.
