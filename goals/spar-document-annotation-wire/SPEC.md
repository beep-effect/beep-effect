# SPAR Document Annotation Wire Spec

## Objective

The identity/RDF vocabulary pipeline emits attributed pinned DOCO, DEO, FaBiO,
and CiTO modules; typed OA/PROV annotations target stable AST node ids; and a
deterministic fold turns flat Md headings into a DOCO-typed section tree.

## Non-Goals

- Runtime OWL reasoning or semantic inference.
- Patent claim semantics inside DOCO.
- PO as RDF vocabulary.
- Syntax-AST rhetoric tags.
- FOLIO/Lynx seed ingestion or MCP browse tools.

## Source Hierarchy

The ceremony request, repo instructions, source exploration BRIEF/DECISIONS/
MAP/SOURCES, this SPEC, PLAN, then GOAL.

## Target Surfaces

- `packages/foundation/modeling/identity/src/Vocab.ts`
- `packages/foundation/modeling/rdf/src/Vocab/`
- `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts`
- The smallest appropriate annotation/fold module and focused tests

## Constraints

- Acquire version-pinned upstream artifacts with exact notices: DEO CC-BY 3.0;
  selected DOCO/FaBiO/CiTO artifacts CC-BY 4.0 as recorded in the ledger.
- Repair generator-owned output at its registry/acquisition/generator source.
- OA targets use stable AST node ids; bodies compose document types/intents
  with PROV.
- The section fold is deterministic over heading levels and preserves source
  nodes; malformed level changes receive typed diagnostics.
- Allow per-instance refinement for multi-pattern DOCO classes.

## Acceptance Criteria

- [ ] Four terms modules generate from pinned attributed inputs with drift proof.
- [ ] Exports and notices are complete.
- [ ] Typed annotations encode/decode OA target plus SPAR/PROV body.
- [ ] A flat Md heading fixture folds deterministically into a section tree.
- [ ] Patent claim meaning and runtime reasoning remain absent.

## Decision Log

| Decision | Inherited contract |
| --- | --- |
| D1 | This goal owns wire vocab plus annotations. |
| D2 | Generate all four terms modules; PO remains LiteralKit. |
| D3 | Patent schema stays in law-practice. |
| D4 | MCP browse tools remain a later goal. |
| D5 | PO annotations are consumed only as AST structure context. |
| D6 | No FOLIO slice here. |
| D7 | Include the DOCO section fold; ship third. |
| D8 | Lynx routes to the taxonomy goal. |

## First Vertical Slice

Generate a minimal exercised term set, fold one Md heading fixture, and
round-trip one OA annotation over the resulting AST node.

## Stop Conditions

- Exact upstream artifact/license/notices cannot be pinned.
- The generator would be bypassed by hand-authored output.
- Annotation requires patent semantics or runtime reasoning.
