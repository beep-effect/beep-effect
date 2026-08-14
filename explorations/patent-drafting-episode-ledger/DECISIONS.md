# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.

Pre-seeded 2026-08-06: the packet is still at stage `capture`; these entries
land early from the packet-open session (explorations/README.md sanctions
pre-seeding — the manifest stage remains the authoritative resume point) and
mirror the relator wedge's opening posture with wedge-specific deltas.
Campaign-level decisions (phase shape, slug merge, unblock milestone) live in
../legal-patent-kg-deepening/DECISIONS.md; links, not copies.
-->

## 2026-08-06 — research depth

**Question:** What research does this wedge run in its research stage?

**Answer:** Two lanes. Lane A: repo composition inventory — a grounded
file:line map of the `ProfessionalRuntime` contracts (`RuntimeCandidateDraft`,
`RuntimeApprovalGate`, `RuntimeEvidenceRef`, principals, `RuntimeActivity`,
`RuntimeUsageRecord`) and the law-patent-intake runtime fixture (ADHD-3's
speedrun entry point), the `ExecutionLedger` append-only/hash-chain precedent,
the law-practice `Claim` model plus the live law-practice tables/migration
lane the candor implementation (PR #575) opened, the shared-domain EntityId
registration precedent, the remo2 lane surfaces (`PracticeKgQuery` target
shape, the bounded `SparqlQueryService`, the `@beep/rdf` in-memory dataset
Session pattern), the remo3 boundary surfaces
(`standards/memory-architecture/04-decision-log.md` 2026-08-01 entry and the
`agent-memory-tiers-bitemporal-edges` DECISIONS boundaries), and the SPEC
contracts of the four composed goals (`agentic-professional-runtime`,
`hybrid-retrieval-fusion-core`, `practice-kg-mcp`,
`citation-verified-span-substrate`) — reconciled against all eleven nuggets
and against the graduated sibling boundaries
(`goals/patent-citation-candor-gate` SPEC + live implementation,
`goals/legal-position-relator-runtime` SPEC) →
`research/01-repo-surfaces.md`. Lane B: bounded public-source grounding,
scoped at open to two frames. (a) The written-description/new-matter public
legal frame — 35 U.S.C. § 112(a) and § 132 statutory text plus MPEP § 2163
and § 608.04 — drawing the never-compute boundary precisely: anchor fidelity
never decides written-description support, implicit disclosure, terminology
equivalence, or new matter; the attorney disposition is the legal judgment,
append-only (T4-F1/ADHD-2 cautions). (b) The episode-memory/retrieval
research frame — re-open the public papers behind the eleven nuggets'
distillates: the six primary-cluster episode/retrieval sources (the
agent-memory benchmark behind T3-F10's raw-episode authority and recent-raw
fallback, the legal GraphRAG deterministic-resolution and answer-policy
sources behind T3-F4, the inference-event study behind T3-F5, the atomic
normative-row/anti-hub benchmark behind T1-F10, the patent-drafting
episode-ledger memory sources behind T4-F7, and ADHD-3's underlying frames)
plus the absorbed rung's drafting traceability/evaluation/routing studies
behind T4-F1..F4 and ADHD-2 — to draw exact boundary language for
raw-episode authority vs lossy projection, the fallback trigger,
answer-annex fields, and the hypothesis-only status of the T3-F5 and
T1-F10 retrieval claims →
`research/02-drafting-episode-frame.md`. On top of both lanes, `RESEARCH.md`
is authored as the canonical stage-1 synthesis before the packet advances to
align; all three land together in PR 2. No client or pre-publication material
touches any cloud model (standing OIP confidentiality rule); every Lane B
source is public.

**Rationale:** The campaign corpus verified nine of the eleven nuggets, but
the wedge's hardest boundaries — product-record authority vs projection,
never-compute for § 112 support, and the hypothesis-vs-verified status of two
retrieval claims — can only be drawn correctly from the primary sources, and
the two deepened plays (ADHD-2, ADHD-3) were never adversarially verified at
all. Rejected: repo-grounding only (draws the written-description and
memory-authority boundaries from second-hand distillates) and a full
adversarial deep-research track (nine of eleven nuggets already survived
adversarial verify; a mini-campaign is overweight for one wedge).

## 2026-08-06 — dependency posture

**Question:** How does this wedge relate to the live substrate it composes
and to the four active/graduated goals its clusters touch?

**Answer:** Live source + SPEC-bound, inheriting the sibling wedges' posture.
The first rung composes only live source (the `ProfessionalRuntime`
contracts, `ExecutionLedger`, the law-practice `Claim` model and the
law-practice migration lane PR #575 opened). All retrieval/annex/support
vocabulary is written against the composed goals' SPECs as binding
contracts: `goals/hybrid-retrieval-fusion-core` and `goals/practice-kg-mcp`
are composed substrate (no rebuild of weighted RRF or the read-only KG
surface), `goals/citation-verified-span-substrate` owns exact
source-versioned support anchors, and `goals/agentic-professional-runtime`
owns the draft/gate contracts — none of their SPECs is amended from this
wedge. The resolved grills are binding boundaries, never reopened: remo2 —
rows-first `PracticeKgQuery`, lineage via disposable in-memory `@beep/rdf`
sessions through the bounded `SparqlQueryService`, no persistent graph
store, no projection becomes authority; remo3 — `DraftingEpisode` ledgers
are law-practice product records (repo-native, authoritative, append-only),
operator dev-memory stays operator-level and may carry only a lossy
rebuildable projection with recent-raw-episode fallback
(`standards/memory-architecture/04-decision-log.md`, 2026-08-01 — that
log's 2026-08-06 entry passes the operator dev-memory role from Cognee to
basic-memory + codegraph while keeping the operator/product authority
boundary explicitly unchanged, so this wedge's `MemoryProjection` port is
engine-agnostic and "Cognee" in the seed-time quotes reads as the operator
memory engine of record at seed time). The wedge
never blocks on sibling goals and never forks their contracts; the graduated
candor and relator goal SPECs are stable reference points, not dependencies.

**Rationale:** Every substrate surface the episode rung composes is live
today, so no rung needs to wait; the two resolved grills already fixed this
wedge's authority and projection boundaries at campaign level, and this
posture is their wedge-side enforcement. Rejected: block-on-prerequisites
(nothing in the first rung needs an unfinished goal — the verified-span
anchor dependency is a SPEC contract, not a build-order block) and
own-adapter-seams (a second contract surface — the exact duplication the
routing seed warns against).

## 2026-08-06 — orchestration mode

**Question:** What orchestration mode runs this wedge's research and packet
work?

**Answer:** Opus 5 subagents, carrying the 2026-08-04 supersession forward
and reconfirmed at this open (2026-08-06, Benjamin: the weekly codex window
is exhausted again; preserve the Fable weekly limit): Workflow-orchestrated
Claude Opus 5 agents for the two research lanes and any adversarial review
passes; the Fable main thread does only grill/align/synthesis. If the codex
weekly window resets mid-wedge, revert to codex-first per standing routing
doctrine and record the reversion here.

**Rationale:** The candor wedge's codex-only decision was superseded
2026-08-04 when the codex weekly window exhausted mid-campaign, the relator
wedge ran Opus-first end to end on that supersession, and Benjamin
reconfirmed the posture when calling this wedge. The judgment-quality bar
that justified xhigh (the never-compute boundary, the authority/projection
split) is carried by Opus 5 review panels instead. Rejected: codex-only as
written in the candor packet (window exhausted; the decision's own engine is
unavailable) and unreviewed single-pass research (Lane B sets the § 112
never-compute boundary and the memory-authority language — both deserve
adversarial checking).

## 2026-08-06 — PR staging

**Question:** How do this wedge's stages land as PRs?

**Answer:** Two-stage, same as both sibling wedges. PR 1 (docs-only): packet
open + capture + this decision record plus the parent packet amendments
(routing-seed flips, HANDOFF/README/ATLAS sync). PR 2 (after the align
session with Benjamin): research artifacts + align outcomes. BRIEF/shaping
waits for align; research artifacts stay uncommitted until PR 2.

**Rationale:** Grill outcomes land as their own docs-only PR before further
work (standing feedback), and both sibling wedges proved the cadence end to
end — candor: open PR #550, research+align PR #552, BRIEF PR #557,
graduation PR #560; relator: open PR #565, research+align PR #573, BRIEF
PR #579, graduation PR #590 — with clean review treadmills at each step.
Rejected: three-stage granular (an extra closeout treadmill with no review
benefit) and single-PR (mixes the decision record with unreviewed research
output — the pattern that generated the nine-thread closeout on PR #542).

## 2026-08-08 — PR staging amended: research lands ahead of align

**Question:** Does the research-stage record wait for the align session
before landing (the original "PR 2 = research + align outcomes" plan), or
land now?

**Answer:** It lands now, as its own docs-only PR — the complete
research-stage record (both lane files, `RESEARCH.md`, the friction ledger,
the manifest/README stage flip) plus the parent-side Lane B promotions
(catalog URL back-fill, title-drift/one-work corrections, HANDOFF/README/
ATLAS pointer sweep). Align outcomes land in the NEXT PR after Benjamin's
align session; BRIEF remains gated behind align. Nothing in this landing
pre-decides an align branch — the six `openQuestions` stay open.

**Rationale:** Benjamin's 2026-08-08 wrap-up directive: long-running agent
sessions are being closed out, and any remaining finished work should reach
mergeable now rather than sit uncommitted in a working tree ("regardless of
the planned # of PRs"). The research record was already complete and
review-gate-1 hardened, so holding it uncommitted carried only risk (a
single dirty checkout as the sole copy) and no review benefit. Rejected:
waiting for align (leaves finished, reviewed work unlanded against an
explicit operator directive) and bundling a rushed align session into the
same PR (align is Benjamin's judgment session, not a wrap-up task).

## 2026-08-13 — Align closed: six-question contract

**Q1a — event union:** Ship the full drafting event union now. Arms without
live emitters are marked `provisional-until-first-emitter`.

**Q1b — fallback:** The watermark-lag fallback fires if and only if the
projection rebuild watermark lags the episode head.

**Q1c — rebuild proof:** The delete-and-rebuild drill asserts byte-identical
projection rows and identical retrieval answers. The answer annex reports no
fallback when none occurred.

**Q2 — answer annex:** All seven policy fields ship in rung 1: temporal,
membership, language, retrieval, rejected-candidate, fallback, and
incompleteness.

**Q3 — support set and artifacts:** `ClaimLimitationSupportSet` adopts the
research shape: per-§112(d)-closure sets, with N closures for
multiple-dependent claims; anchors are evidence and never verdict inputs;
attorney disposition is the sole verdict-bearing record. Unresolved support is
a `LiteralKit` state family distinguishing the §132 objection track from the
§112(a) rejection track. New matter is diffed against the as-filed record,
including omission. Durable artifacts are auditable work products, never
quality proxies.

**Q4 — routing:** Routing is fixed with human override. Learned routing is
gated on the Q5 benchmark.

**Q5 — benchmark:** Defer the benchmark. Record the public-USPTO
prosecution-history path over `uspto-prosecution-read` data as the upgrade
path.

**Q6 — refusal:** Compose promotion refusal law-side on the candor-derived
fail-closed predicate precedent, `CandorGateVerdict.isBlocked`. Do not change
the runtime vocabulary.

**Decision:** Align is closed; all six manifest questions are resolved and the
packet advances to shape.

## 2026-08-13 — Operator shape and MAP sign-off

**Question:** Operator shape gate: does BRIEF.md match the operator's picture?
(sign-off required before decompose)

**Answer:** Signed off as drafted. The sign-off also covers `MAP.md`, so the
rung-1 `patent-drafting-episode-ledger` goal may be scaffolded immediately.

**Rationale:** The operator ratified the shaped contract and its decomposition.
The public-USPTO benchmark remains a MAP re-entry point and is not graduated as
a goal in this ceremony.
