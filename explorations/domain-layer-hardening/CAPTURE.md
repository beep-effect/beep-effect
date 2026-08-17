# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, half-sentences, contradictions.
Nobody tidies this file; cleaning it up destroys provenance. New material goes
under a new dated heading at the bottom. Analysis lives in RESEARCH.md.
-->

## 2026-06-29

### The ask (verbatim, from the planning session)

> # Goal
> Systematically strengthen the domain layer (entities, aggregates, value
> objects, typed errors) of our vertical slices — fields, annotations,
> refinements, checks, transformations, metadata, provenance, type safety,
> domain language, and ontological soundness — grounded in external best
> practices and our own research corpus. Optimize for future-proofing,
> hardening, observability, and queryability over short-term economy of
> tokens. Stay Effect-native and schema-first throughout (prefer the helper
> modules — `String`, `Equal`, etc. — over raw `effect` combinators).
>
> # Scope
> - Slices in scope: all product slices + kernel (workspace, law-practice,
>   epistemic, agents, shared/domain). [resolved at the Phase-0 gate]
> - Layer in scope: each slice's domain/schema layer (Schema models,
>   EntityIds, tagged unions, errors, value objects). Not UI/runtime.
> - Out of scope this pass: implementation/migration. We END on an approved
>   plan, not code changes.
>
> # Phase 0 — Orient (gate before Phase 1)  [DONE — see RESEARCH.md]
> # Phase 1 — Audit (artifact-producing)
> # Phase 2 — Challenge against external grounding
> # Phase 3 — Plan
> # Working rules: reuse-first; public repo (cite corpus by reference, keep
>   strategy/client data in _internal); use /grill-with-docs to drive out
>   unresolved questions; use /deep-research for external grounding.

Full multi-phase prompt + rubric preserved in the approved plan file
`~/.claude/plans/use-grill-with-docs-deep-research-vectorized-elephant.md`.

### Locked decisions from the Phase-0 gate (provenance — see DECISIONS.md)

- **Scope:** all product slices + kernel — `workspace`, `law-practice`,
  `epistemic`, `agents`, `shared/domain`. (`architecture-lab` is a fixture; out.)
- **Artifact home:** this new exploration packet, `domain-layer-hardening`.
- **External grounding:** full mine of all six corpora.
- **Pacing:** sequential per-slice, bounded concurrency (≤2–3 agents),
  continue agents via `SendMessage`, watch the budget — an account spend-limit
  was hit during orientation. No giant parallel fan-out.

### The regret-minimization rubric (applied to every candidate field/method)

1. Does it serve a plausible future need (query, audit, observability)?
2. Would we regret NOT adding it now (costly migration later)?
3. Is it validated by external sources (repos, libraries, papers, the corpus)?
4. Does it use the best-fit data-modeling strategy — party data model,
   Notion-style block model, tagged unions, exhaustive/matchable variants,
   provenance/event-sourcing, temporal validity, soft-delete, identity
   composition — and is it ontologically sound and grounded?

### Raw pointers (intake — analysis lives in RESEARCH.md)

- Product spine: local-first agentic professional runtime; law-practice is the
  sole active vertical; memory primitive = `claim + evidence + provenance +
  lifecycle`; candidate-only writes behind a human approval gate. Roadmap defers
  reasoner / matter-walls / **bitemporal store** to P4, DMS sync to P5 —
  *model now, enforce later*.
- The canonical substrate already exists in `packages/foundation/modeling/*`
  (`@beep/schema`, `@beep/identity`, `@beep/provenance`) + `@beep/shared-domain`.
  Reuse-first: do NOT re-propose `BaseEntity.Class`, `EntityId.factory`, `$I`
  annotations, `S.toTaggedUnion`/`LiteralKit`, `TaggedErrorClass`, the
  `@beep/schema` value-object library, `TextAnchor`, `Principal`/`SourceKind`.
- The hardening frontier (open/unbuilt): no typed domain errors in 3 slices;
  two competing audit bases (`BaseEntity` vs unused `@beep/schema/DomainModel`);
  no soft-delete; no temporal/bitemporal validity; no domain-event substrate;
  no shared cross-field refinement idiom; near-empty aggregates; partial
  `ConstraintDecoder` migration; law-practice rich in nouns, thin in lifecycle.
- External corpora (verified present, public-repo: cite by reference only):
  the machine-local research library `{law_stuff, ontology_research,
  digital_signature_stuff/repos, dms_stuff/repos, meeting_notes_ai}`,
  the machine-local Oppold corpus home.
