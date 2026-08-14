# Document AST Pattern Classification Spec

## Objective

Every tagged constructor in Md, Pandoc, and Lexical carries a colocated PO
LiteralKit annotation, from which correspondence tables and conservation-law
tests are derived.

## Non-Goals

- A PO RDF vocabulary module or imported PO ontology runtime.
- Rhetorical semantics inside syntax ASTs.
- Replacing PandocMappingIssue or Lexical compatibility/lossiness diagnostics.
- SPAR terms, patent schemas, FOLIO, or MCP tools.

## Source Hierarchy

1. The 2026-08-13 D7 ceremony request.
2. Repo instructions and required skills.
3. The source exploration BRIEF, DECISIONS, and MAP.
4. This SPEC, then PLAN and GOAL.

## Target Surfaces

- `packages/foundation/modeling/md/src/Md.model.ts`
- `packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts`
- `packages/foundation/modeling/lexical/src/Lexical.model.ts`
- Existing mapping/codec diagnostics and focused tests

## Constraints

- PO is a named LiteralKit and schema annotation, colocated on each tagged
  class; no drifting sidecar Record.
- Classification is exhaustive across all constructors.
- Derived reports classify existing diagnostics; no second issue channel.
- A mapping must preserve its pattern or record an explicit demotion.
- Multi-pattern ontology classes do not force one classification onto every
  instance.

## Acceptance Criteria

- [ ] Every live tagged constructor has exactly one valid PO annotation.
- [ ] A derived report covers Md/Pandoc/Lexical correspondence exhaustively.
- [ ] Property tests prove preserved-or-explicitly-demoted behavior.
- [ ] Existing Pandoc and Lexical diagnostics remain canonical.
- [ ] Adding an unannotated constructor fails focused exhaustiveness proof.

## Decision Log

| Decision | Inherited contract |
| --- | --- |
| D1 | PO classification is layer one of the stack. |
| D2 | PO stays a LiteralKit, never RDF vocabulary. |
| D3 | Patent schema remains a sibling domain goal. |
| D4 | No MCP scope. |
| D5 | Annotation is colocated on every tagged class; reports derive from it. |
| D6 | No FOLIO scope. |
| D7 | Ships second after the patent schema. |
| D8 | No Lynx vendor routing here. |

## First Vertical Slice

Classify representative inline and block constructors across all three ASTs,
derive their correspondence row, and prove a known lossy mapping emits an
explicit demotion through the existing diagnostic.

## Stop Conditions

- The design needs a sidecar source of truth or duplicate diagnostics.
- Exhaustive annotation cannot be derived/tested from the live tagged unions.
- Work expands into sibling patent, SPAR, or taxonomy scope.
