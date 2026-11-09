# Patent Drafting Episode Ledger Spec

## Objective

Ship a law-owned append-only `DraftingEpisode` authority with a pure replay
fold, a statutory-closure-shaped `ClaimLimitationSupportSet` promotion gate,
a seven-policy answer annex, and a deletable `MemoryProjection` whose
watermark-driven fallback and rebuild determinism are proven by the first
vertical slice.

## Non-Goals

- The public-USPTO routing benchmark; it remains a MAP re-entry point.
- Any runtime approval-vocabulary amendment.
- Computed written-description, implicit-disclosure, terminology-equivalence,
  or new-matter verdicts.
- A persistent graph store or any projection promoted to authority.
- Rebuilding weighted RRF, verified-span, practice-KG, professional-runtime,
  or candor-gate sibling contracts.
- Learned routing or client/pre-publication evaluation material.

## Source Hierarchy

1. The 2026-08-13 operator sign-off and ceremony request.
2. Repo instructions and required skills.
3. [`BRIEF.md`](../../explorations/patent-drafting-episode-ledger/BRIEF.md),
   [`MAP.md`](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/patent-drafting-episode-ledger/MAP.md), and
   [`DECISIONS.md`](../../explorations/patent-drafting-episode-ledger/DECISIONS.md).
4. This `SPEC.md`, then `PLAN.md` and `GOAL.md`.

## Target Surfaces

- Law-practice domain schemas, persistence, use cases, and focused fixtures.
- Existing professional-runtime approval, verified-span, practice-KG,
  candor-gate, claims-batch, and hybrid-retrieval seams.
- Deterministic projection/retrieval proof and answer-annex evidence.

## Constraints

- Define the full closed event union now. Arms without a live producer remain
  explicitly `provisional-until-first-emitter` until their first emitter proves
  the payload.
- Raw episode events are authoritative; every memory/search projection is
  engine-agnostic, lossy, deletable, and rebuildable.
- Recent-raw fallback fires if and only if the projection rebuild watermark
  trails the episode head; the annex reports no fallback when none occurred.
- Emit all seven rung-1 policy fields: temporal, membership, language,
  retrieval, rejected-candidate, fallback, and incompleteness.
- Model one support closure for every ordinary dependent-claim path and N
  closures for a multiple-dependent claim. Anchors are evidence only; attorney
  disposition is the sole verdict-bearing record.
- Distinguish section 132 objection from section 112(a) rejection in the
  unresolved-state literal family; compare new matter to the as-filed record,
  including omissions.
- Routing is fixed with human override. Learned routing waits for the public
  benchmark gate.
- Promotion refusal is composed law-side through the
  `CandorGateVerdict.isBlocked` fail-closed precedent; do not change the
  runtime vocabulary.
- Durable artifacts are auditable work products, never quality proxies.

## Acceptance Criteria

- [ ] The full episode event union and pure fold replay one canonical ordered
      drafting episode; emitterless arms are visibly provisional.
- [ ] A support set encodes statutory dependency closure and preserves
      attorney-only verdict authority.
- [ ] Promotion refuses law-side while any required closure is unresolved.
- [ ] The seven-field annex reports the exact retrieval and fallback policies.
- [ ] Delete-and-rebuild produces byte-identical projection rows and identical
      retrieval answers.
- [ ] Fallback occurs exactly on watermark lag and is absent otherwise.
- [ ] No sibling contract, persistent graph authority, learned routing, or
      computed legal verdict enters scope.

## Decision Log

| Decision | Ratified contract |
| --- | --- |
| Q1a — event union | Ship the full union; emitterless arms are `provisional-until-first-emitter`. |
| Q1b — fallback | Fire fallback if and only if the rebuild watermark trails episode head. |
| Q1c — rebuild proof | Require byte-identical rows and identical answers; report no fallback when none occurred. |
| Q2 — answer annex | Ship all seven policy fields in rung 1. |
| Q3 — support set | Use statutory dependency closures, evidence-only anchors, attorney-only verdicts, typed unresolved tracks, and omission-aware as-filed comparison. |
| Q4 — routing | Fixed routing with human override; learned routing is gated. |
| Q5 — benchmark | Defer the public-USPTO benchmark to exploration re-entry. |
| Q6 — refusal | Compose fail-closed refusal law-side with `CandorGateVerdict.isBlocked`; leave runtime vocabulary unchanged. |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug patent-drafting-episode-ledger`; add a `kind: decision` file there, never edit this block._

### research-intake-2026-11 routed 49 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 152 findings to this packet (49 affirmative, 0 critiques or disputes; 124 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: https://www.federalregister.gov/documents/2025/11/28/2025-21457/revised-inventorship-guidance-for-ai-assisted-inventions — Conception, the touchstone of inventorship, is proven by the human inventor's particular description; this motivates recording human conception evidence in AI-assisted drafting episodes.
- citesAsEvidence: https://www.nber.org/papers/w35720 — The reported trial separates performance with AI from subsequent professional judgment without AI. This offers a directly relevant evaluation design for patent-drafting assistance and professional age
- citesAsEvidence: https://www.legal500.com/intelligence/united-states/corporate-commercial-law/california-adopts-law-to-impose-new-guardrails-on-attorneys-and-arbitrators-use-of-ai — There is a categorical disclosure duty for AI use in court submissions. For public-facing content, the attorney need only consider whether to disclose. This points to provenance tracking of AI involve
- supports: https://www.bakerlaw.com/insights/from-hallucinations-to-legislation-california-codifies-ai-rules-for-attorneys/ — Firms must be able to show that safeguards were followed, which motivates evidence ledgers and an auditable provenance of AI-assisted work.
- usesMethodIn: https://www.slwip.com/agentic-coding-is-draining-your-moat/ — The entry template's fields (technical problem, mechanism, novelty, non-obviousness, technical character, implementation anchor, inventors, disclosure risk, confidence, next step) form a ready schema

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane `feat/research-intake-2026-11`

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

<!-- beep:decisions:end -->

## First Vertical Slice

Replay one ordered drafting episode through a limitation-support decision,
refuse promotion while one closure is unresolved, delete and rebuild the
projection, and prove identical rows/answers plus an honest seven-field annex
and exact watermark-fallback report.

## Stop Conditions

- A required sibling contract is missing or would need amendment.
- Practice-KG rows cannot be made totally deterministic within scope.
- The implementation would compute a legal verdict from anchor fidelity.
- An emitterless event payload would be treated as stable without producer proof.
