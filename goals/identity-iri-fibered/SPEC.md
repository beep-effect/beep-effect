# Identity IRI Fibered Spec

## Objective

The repo ships a discrete-case `Fibered` abstraction and `IdentityRegistry`
over identity/IRI/CURIE fibers, migrates `JSDocTagDefinition.make` with
byte-identical behavior, projects policy into the post-move SHACL contract
layer, and provides local plus test/dev store Layers.

## Non-Goals

- Version fibers, migrations, cartesian lifts, 2-cells, or pseudofunctor
  coherence.
- Fuzzy discovery/search in IdentityRegistry.
- A new production store-technology decision.
- Resurrection of old Ontology.create/reference-synonym APIs.
- Runtime-computed IRIs/CURIEs, general JSON-LD import, or new inline fact sugar.

## Source Hierarchy

1. The 2026-08-13 ceremony request.
2. Repo instructions and required skills.
3. [`DECISIONS.md`](../../explorations/identity-as-iri/DECISIONS.md),
   [`BRIEF.md`](../../explorations/identity-as-iri/BRIEF.md), and
   [`MAP.md`](../../explorations/identity-as-iri/MAP.md).
4. This SPEC, PLAN, then GOAL.

## Target Surfaces

- `@beep/identity`: Fibered, discrete pullback operation, IdentityRegistry
  interface, local layer
- `@beep/repo-utils`: byte-identical `JSDocTagDefinition.make` migration
  (P0 audit corrected the SPEC's original `@beep/schema` placement; see
  `history/p0-blocker-audit.md`)
- `@beep/semantic-web`: post-move SHACL projection and test/dev store Layers
- Focused type, behavior, projection, and layer tests

## Constraints

- Discrete case only.
- SHACL projection targets the contract layer after the semantic-web PR2/PR3
  moves; do not code against the pre-cleanup topology.
- Store implementations land as test/dev Layers; no production persistence
  commitment.
- Resolve `identity | iri | curie` exactly; no fuzzy matching.
- `JSDocTagDefinition.make` migration is byte-identical.
- Existing identity-core and fold public contracts remain stable.

## Acceptance Criteria

- [x] Fibered represents base, fibers, and section for the discrete case with
      type/behavior laws.
- [x] The discrete pullback operation is implemented and property-tested
      without version, cartesian-lift, or coherence machinery.
- [x] JSDocTagDefinition migration is byte-identical.
- [x] IdentityRegistry resolves identity, IRI, and CURIE exactly through a
      local Layer.
- [x] SHACL projection composes with the post-move contract layer.
- [x] Store-backed examples are test/dev Layers only.
- [x] No P1 work begins before both textual semantic-web blockers clear.

## Decision Log

| Decision | Inherited contract |
| --- | --- |
| Packaging | Pure identity interface/core; runtime services remain downstream. |
| Metadata | Address projections and semantic documentation remain layered. |
| Registry | Service name is `IdentityRegistry`; exact dereference only. |
| Fold | Fold shipped in `@beep/ontology`; this goal does not reopen it. |
| Inline facts | `is:` sugar is not planned. |
| 2026-08-13 | Fold trigger fired; one goal carries the full MAP row and is blocked by semantic-web PR2+PR3 cleanups. |
| 2026-08-13 | Discrete case only; post-move SHACL target; stores as test/dev Layers. |
| 2026-08-25 | P0 audit: both semantic-web blockers evidenced landed; `JSDocTagDefinition` migration target corrected to `@beep/repo-utils`; P1 design in `research/2026-08-25-p1-design.md`. |

## BlockedBy Note

Both blockers cleared 2026-08-25 with live-source evidence recorded in
[`history/p0-blocker-audit.md`](./history/p0-blocker-audit.md):

- semantic-web PR2 cleanup — landed as #695 (`6706b95a75`); bounded validator
  now in `packages/epistemic/server/src/ShaclValidation/`.
- semantic-web PR3 cleanup — landed as #687 (`a6ffc516e1`) with follow-ups #711
  and #715; `semantic-web/src` is the three service contracts only.

## Stop Conditions

- Either semantic-web cleanup is not evidenced as landed.
- The post-move SHACL contract layer cannot be identified.
- A discrete-case implementation would require version/coherence machinery.
- Store work would become a production technology decision.
