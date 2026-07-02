# Ontology Modeling Foundation

## Status

Lifecycle: `reference`

Status: `superseded`

Superseded by:
[`explorations/identity-as-iri`](../../explorations/identity-as-iri) — the
identity-as-IRI design replaces this packet's `Ontology.create(...)` authoring
API with composer-derived `$I.key` / `$I.class` / `$I.ontology`; the
projections, assembly pipeline, and error taxonomy survive as salvage (see the
handoff in that packet's `assets/`). Supersession audit:
[`research/12-audit-goals-supersession.md`](../../explorations/identity-as-iri/research/12-audit-goals-supersession.md).

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-06-04
- **Updated:** 2026-06-04

## Purpose

This goal promotes the ontology-builder experiment into foundation
modeling packages:

- `@beep/rdf` owns pure RDF, IRI, JSON-LD value models, and common vocabularies.
- `@beep/ontology` owns schema-backed ontology authoring, annotation retrieval,
  assembly, and projections.
- `@beep/semantic-web` remains a broader capability package and compatibility
  home for existing imports.

The POC proves that Effect Schema annotations can carry ontology metadata on
classes and property signatures, then assemble that annotated schema set into
JSON-LD and Turtle without maintaining a parallel registry.

## Reading Order

- [SPEC.md](./SPEC.md) - normative package boundary and API contract
- [PLAN.md](./PLAN.md) - current implementation sequence
- [GOAL.md](./GOAL.md) - concise objective statement
- [ops/manifest.json](./ops/manifest.json) - machine-readable metadata
- [research/package-home.md](./research/package-home.md) - package-home
  rationale

## Current Decisions

- `@beep/ontology` is a new foundation/modeling package, not folded into
  `@beep/semantic-web`.
- `@beep/rdf` is a new foundation/modeling package for domain-safe RDF/IRI
  primitives that ontology and semantic-web capabilities can share.
- The authoring syntax should favor the `Ontology.create(...)` combinator
  surface and an identity wrapper that auto-populates Effect Schema annotation
  fields.
- Relationship references such as `sameAs`, `equivalentClass`, `parents`,
  `children`, `seeAlso`, and `isDefinedBy` may accept schema values, local
  terms, IRIs, RDF named nodes, or assembled references.
- Assembly reads annotations through Effect Schema's display annotation map
  APIs rather than side-channel extraction.

## Verification Targets

- `bunx tsgo -p packages/foundation/modeling/rdf/tsconfig.json`
- `bunx tsgo -p packages/foundation/modeling/ontology/tsconfig.json`
- `bunx tsgo -p scratchpad/tsconfig.json`
- `bunx tsc -p scratchpad/tsconfig.json --noEmit --pretty false`
- package tests for `@beep/rdf` and `@beep/ontology`
- empty scratchpad Vitest wiring check
