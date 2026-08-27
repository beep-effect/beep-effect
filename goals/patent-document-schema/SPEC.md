# Patent Document Schema Spec

## Objective

`@beep/law-practice-domain` exposes typed patent-application section roles,
claim substructure/dependency, and Md heading normalization, and the existing
practice-KG claims batch consumes that contract.

## Non-Goals

- Rhetorical tags inside Md/Pandoc/Lexical syntax ASTs.
- Runtime OWL reasoning or a graph vocabulary as the patent model.
- ST.96 as the editor-native tree.
- Live ontology APIs, a new MCP deployable, PO RDF vocabulary, or FOLIO.

## Source Hierarchy

1. The 2026-08-13 D7/D8 ceremony request.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. [`BRIEF.md`](../../explorations/document-structure-ontologies/BRIEF.md),
   [`DECISIONS.md`](../../explorations/document-structure-ontologies/DECISIONS.md),
   and [`MAP.md`](../../explorations/document-structure-ontologies/MAP.md).
4. This `SPEC.md`, then `PLAN.md` and `GOAL.md`.

## Target Surfaces

- `packages/law-practice/domain`
- The smallest required `packages/law-practice/use-cases`/server seam
- `packages/law-practice/server/src/PracticeKg.claims.ts`
- Focused tests and normative-reference documentation

## Constraints

- Follow schema-first package conventions; section and state families use
  named schema building blocks and LiteralKit.
- Section order aligns to 37 CFR 1.77(b); claim names align where useful to
  ST.96; MPEP section 608 and EPO F-IV remain normative references.
- Model preamble/transition/body and independent/dependent graphs, including
  invalid/cyclic dependency diagnostics.
- Heading normalization crosses the raw Md boundary once.
- DOCO stops at generic structure and never owns patent claim semantics.

## Acceptance Criteria

- [x] Patent application sections decode to a closed ordered domain.
- [x] Claims preserve preamble, transition, body, and dependency relations.
- [x] One Md fixture normalizes headings into the typed section contract.
- [x] The practice-KG claims batch consumes the schema without duplicate
      heading/claim parsing.
- [x] Normative citations and focused behavior tests cover valid and invalid
      section/claim cases.

## First Vertical Slice

Decode one Markdown patent application into ordered sections and claim
structure, then persist/emit its candidate claims through the existing
practice-KG claims-batch seam.

## Decision Log

| Decision | Inherited contract |
| --- | --- |
| D1 | The five-layer stack stands; this goal owns only its patent layer. |
| D2 | PO remains a LiteralKit elsewhere; SPAR vocab is a sibling goal. |
| D3 | Patent schemas live in `@beep/law-practice-domain`. |
| D4 | No new MCP deployable. |
| D5 | AST pattern annotation is a sibling goal. |
| D6 | FOLIO is a later pinned slice. |
| D7 | This goal ships first; practice-KG claims batch is the first consumer. |
| D8 | Lynx routing has no bearing on this goal. |

## Stop Conditions

- The implementation requires syntax-AST rhetoric tags or a foundation-level
  jurisdictional patent package.
- A normative source materially conflicts with the ratified section/claim
  shape.
- The first consumer would require widening sibling contracts rather than
  consuming the domain schema.
