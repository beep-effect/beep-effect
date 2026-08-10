# Research — Patent Drafting Episode Ledger

> Stage-1 canonical synthesis, authored 2026-08-06 over the two locked
> research lanes (see the research-depth decision in
> [`DECISIONS.md`](./DECISIONS.md)). Both lane files carry the citations;
> this file synthesizes and routes. Nothing here reopens the resolved
> remo2/remo3 boundaries, the sibling goal SPECs, or the no-rebuild
> substrate list — where research sharpened a boundary, it is named as an
> align input, not a decision.

## Lane artifacts

1. [`research/01-repo-surfaces.md`](./research/01-repo-surfaces.md) — grounded
   file:line inventory of every live surface and binding SPEC contract the
   wedge composes (the `ProfessionalRuntime` contracts and the
   `law-patent-intake` fixture, `ExecutionLedger`, the live PR #575
   law-practice lane, the remo2 query/SPARQL surfaces, the remo3
   memory-architecture boundaries, the four composed goal SPECs, both
   graduated sibling boundaries), reconciled against all eleven nuggets;
   net-new symbols re-confirmed at zero source occurrences on 2026-08-06;
   drift against the 2026-08-01 routing-seed grounding attributed section by
   section, with an explicit corrections ledger (§ Corrections to inherited
   anchors).
2. [`research/02-drafting-episode-frame.md`](./research/02-drafting-episode-frame.md) —
   bounded public-source grounding in two frames: (a) the
   written-description/new-matter legal frame from primary text
   (35 U.S.C. § 112, 35 U.S.C. § 132, MPEP § 2163 and subsections,
   MPEP § 608.04), and (b) the episode-memory/retrieval research frame from
   the re-opened public papers behind the eleven nuggets' distillates, with
   a hypothesis-status ledger (§10), a per-URL sources ledger with access
   dates (§11), and an honest NOT FOUND / NOT VERIFIED ledger (§12).

Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## What the landscape says (synthesis)

### The never-compute boundary is two-sided, and now provable from primary text

The seed carried "anchor fidelity does not decide written-description law"
as a caution. Lane B §1 grounds it in both directions. Anchors are **not
necessary**: MPEP § 2163 I.B admits support that is "express, implicit, or
inherent," and § 2163.07(a) recognizes inherent-function disclosure with
zero corresponding spans. Anchors are **not sufficient**: § 2163.03
(quoting *Enzo*) holds that verbatim *in ipsis verbis* appearance does not
necessarily satisfy the requirement, and § 2163 I makes compliance "a
question of fact... case-by-case." So in the `ClaimLimitationSupportSet`
schema, a verified anchor is *evidence attached to a limitation*, never a
truth-functional input to a support verdict — the attorney disposition is
the only verdict-bearing record (T4-F1, ADHD-2).

Three legal-frame findings sharpen the support-schema align branch (parent
question 15):

- **Dependency closure is statutory, not a design nicety** —
  35 U.S.C. § 112(d) construes a dependent claim to incorporate all
  limitations of its parent, and MPEP § 2163 II.A.1 requires each claim to
  be separately analyzed. § 112(e) means one multiple-dependent claim
  yields **N closures**; a single-closure-per-claim model is
  under-specified (Lane B §1).
- **New matter arises by omission too** (MPEP § 608.04(a)), and is diffed
  against the **as-filed** disclosure (MPEP § 608.04).
- **The Office splits objection (§ 132, petitionable) from rejection
  (§ 112(a), appealable)** (MPEP § 608.04 + § 608.04(c)) — a boolean
  `CandidateNewMatter` state flattens a distinction the Office keeps; the
  unresolved-support state family should represent it.

### The episode/projection split is verified; the fallback design is not prescribed anywhere

Lane B §2 re-verified T3-F10 at source: the cited benchmark's graph
retrieval regressed in three cells, under the benchmark's own category
labels — single-session-assistant under both models (94.6→80.4 and
81.8→75.0) and knowledge-update under gpt-4o-mini (76.9→74.4) — the
regression is real and slightly under-reported by the seed. But two honesty findings bound what the sources
license: the Zep paper's audit-trail claim is **unevaluated in its own
experiments** (cite it for the raw-episodes/projection split, never as
evidence that audit works), and **no source prescribes the recent-raw
fallback** — it is an unvalidated design response to a verified failure
mode (Lane B D6). The fallback trigger, episode set, and rebuild proof are
therefore genuinely open align questions (parent question 14), not
inherited answers.

On the repo side, Lane A §6 confirms the remo3 seam intact: the
agent-memory packet's Decision 2 explicitly defers "IP-law-specific
records" — that deferral is exactly the space this wedge's law-owned
product ledger occupies. The 2026-08-06 operator dev-memory role change
(Cognee → basic-memory + codegraph) leaves the 2026-08-01 operator/product
boundary explicitly unchanged; the `MemoryProjection` port stays
engine-agnostic.

### The answer annex is mostly net-new, and the repo confirms the gap

Lane B §3 found that 4 of the 7 annex policy fields are net-new beep-side
extensions — two (`rejected-candidate`, `incompleteness`) have zero
occurrences in the re-opened retrieval sources, two (`language`,
`fallback`) are named but unspecified there; the remaining three
(temporal, membership, retrieval) are source-prescribed. Lane A §10 plus
its § Open items close the loop from the repo side: the only live
policy-disclosure carrier is the free-text `SdkContextPacket.exclusions` —
exactly the shape T3-F4 calls insufficient. The smallest-annex align branch
(parent question 11, T3-F4 half) starts from a named field list with
per-field provenance, not from a donor schema.

### Two retrieval claims stay hypothesis-only — confirmed at source

- **T3-F5 (inference-event retrieval gain):** the cited study contains no
  reification ablation — the word does not appear, and all baselines are
  non-graph (Lane B §4). The independent-benchmark align question (parent
  question 12) is the upgrade path; until then the inference event is a
  study fixture.
- **T1-F10 (anti-hub prefilter):** small benchmark, study fixture only
  (Lane B §5); P002/P003 are duplicate catalog rows for the same HSNKB study,
  not independent corroboration. The full-text metric tables remain
  distillate-only because the publisher endpoint served a consent page
  (recorded NOT FOUND, retryable).
- **T4-F2 (traceability):** the sources support artifact traceability and
  **refute the causal reading in the measured direction** — outline/budget
  artifacts are auditable work products, never quality-acceptance proxies
  (Lane B §7, reinforcing the T4-F2/T4-F3 cautions).

### The repo is further along than the seed recorded — three drift findings matter

Lane A's drift ledger (§§4-5, § Corrections) moves three things from
"planned" to "live", all favorable:

1. **PR #575 opened the whole law-practice lane, not just a migration
   precedent**: domain entities/values, use-cases, server repos, three
   table modules, three `EntityId` registrations, and the slice's first
   db-admin migration with six append-only guard triggers — a
   **payload-bearing append-only table precedent** that did not need
   `ExecutionLedger`'s raw-`pgTable` escape hatch. A live precedent now
   exists for rung 2's storage shape to follow.
2. **`goals/practice-kg-mcp` is live code** (~4 kLOC, three read-model
   tables), and the rows-first contract can reuse its live row/decoder
   shapes. But the deterministic-rows property remo2 requires is **not yet
   structurally guaranteed**: several catalog queries order by non-unique
   `(kind, natural_key)` fields without the unique `iri` tie-breaker, and
   `find` applies `LIMIT 100` (Lane A §5.1). Closing that ordering gap is an
   align/implementation prerequisite. Naming caution: the live symbol
   `PracticeKgQueries` is one letter from the seed's `PracticeKgQuery`
   contract name — recommend a distinct stem to avoid collision
   (Lane A §9).
3. **The verified-span substrate is live** (`VerifiedTextAnchor` et al.)
   and already consumed by #575 — the `ClaimLimitationSupport` rung binds
   to a live receipt type on day one (Lane A §4, §7).

Also load-bearing: the ADHD-3 speedrun entry is real and cheap —
`runLawPatentIntake` emits a deterministic, evidence-closed grouped output
with five on-disk expected snapshots. It has no cross-category sequence or
timestamp, so it can seed a fold only after align defines a flattening/order
contract or implementation adds a canonical event fixture (Lane A §2). And the
`ExecutionLedger` transfer boundary is drawn precisely: port shape, dense
`seq`/`prevHash` chain, and trigger pair transfer; the digest-only
payload law does not (Lane A §3).

### One live blocker surfaced — routed to align, not resolved here

`RuntimeApprovalDecision` is a single-member `LiteralKit(["pending"])` in
the live runtime vocabulary (Lane A §1) — so "refuse draft promotion"
(ADHD-2's gate semantics) has no representable **runtime** decision state
today. The live alternative is law-side: the candor implementation's
derived fail-closed predicate (`CandorGateVerdict.isBlocked`, computed
from a non-empty uncovered set and never stored — Lane A §4.2) refuses
promotion without ever writing a runtime decision, and it is option 1 of
the new branch. Widening the runtime vocabulary instead touches
`goals/agentic-professional-runtime`'s contract, which this wedge's
dependency posture forbids amending unilaterally. This is a new align
branch (recorded in `ops/manifest.json` `openQuestions`), with options for
Benjamin: compose law-side on the candor precedent, propose a minimal
runtime-side vocabulary extension through that goal's own process, or
defer refusal semantics to rung 2.

### Corrections and hygiene carried into the ledger

The lane files correct inherited anchors (the `:428-490` span, two SPEC
off-by-N cites), retitle two papers, and identify two duplicate pairs:
P002/P003 are one HSNKB work and P018/P019 are one SAT-Graph work. The 18
parent-catalog rows therefore represent 16 distinct works; T1-F10's and
T3-F4's independent-evidence counts are each one lower than their distillate
lists suggest. Lane B re-discovered and verified public URLs
for 15 rows, carried in its §11 per-URL ledger; this research-stage PR
promoted those URLs into the parent catalog while P005/P025/P030 remained
`url: null`, as recorded by the 2026-08-08 PR-staging amendment in
[`DECISIONS.md`](./DECISIONS.md). [`research/SOURCES.md`](./research/SOURCES.md)
§3 points at that ledger and the parent promotion record. One method hazard
is recorded for future lanes: a
summarizing fetch on a very long MPEP page falsely reported a section
absent; only a full-page read is evidence of absence (Lane B §12).

## Open questions carried to align

The five carried parent questions (`ops/manifest.json` `openQuestions`),
sharpened by this stage, plus one new branch:

1. **Episode set, rebuild proof, raw fallback** (parent q14) — now knowing
   the fallback is unprescribed by any source and the delete-and-rebuild
   drill has a live projection seam (remo3) plus a snapshot-backed grouped
   source fixture whose cross-category order remains an align input (Lane A
   §2).
2. **Smallest annex** (parent q11, T3-F4 half) — now knowing 4 of 7 fields
   are net-new beep-side and the live exclusions carrier is the
   insufficient shape.
3. **Support schema and attorney gates** (parent q15) — now carrying the
   statutory N-closure requirement, omission-type new matter, and the
   objection/rejection split.
4. **Routing modes** (parent q16) — Lane B §9's persisted-decision fields.
5. **Independent benchmark for T3-F5** (parent q12) — the reification
   ablation gap confirmed at source.
6. **NEW: runtime approval-decision vocabulary** — how does the gate refuse
   promotion when the live `RuntimeApprovalDecision` has only `pending`?
   (Lane A §1; touches a sibling goal's contract — Benjamin's branch.)
