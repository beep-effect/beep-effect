# Map — Document-Structure & Metadata Ontologies

Status: RATIFIED and graduated 2026-08-13.

## Candidate Goal Packets

| Order | Slug | Mission | Dependency edges | Live capability citations | First vertical slice |
| --- | --- | --- | --- | --- | --- |
| 1 | [`patent-document-schema`](../../goals/patent-document-schema/README.md) | Ship the schema-first patent-document contract in `@beep/law-practice-domain`, with the practice-KG claims batch as its first consumer. | Ships first; no campaign-goal dependency. | Law-practice LiteralKit/domain patterns: `packages/law-practice/domain/src/values/`; live claims consumer: `packages/law-practice/server/src/PracticeKg.claims.ts` and `apps/practice-kg-mcp/src/claims.ts`; canonical Md AST: `packages/foundation/modeling/md/src/Md.model.ts`. NET-NEW: patent section/claim structures and heading normalization. | Decode one Markdown patent application into ordered section roles and claim structure, then have one practice-KG claims fixture consume the typed result without re-parsing headings ad hoc. |
| 2 | [`document-ast-pattern-classification`](../../goals/document-ast-pattern-classification/README.md) | Classify every Md, Pandoc, and Lexical tagged constructor with a PO LiteralKit annotation and derive correspondence/conservation proof from schema truth. | Delivery-after `patent-document-schema`; no runtime dependency on its models. | Tagged unions: `packages/foundation/modeling/md/src/Md.model.ts`, `packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts`, `packages/foundation/modeling/lexical/src/Lexical.model.ts`; typed diagnostics: `packages/foundation/modeling/pandoc-ast/src/Pandoc.report.ts`, `packages/foundation/modeling/pandoc-ast/src/Pandoc.mapping.ts`, and `packages/foundation/modeling/lexical/src/Lexical.codec.ts`. NET-NEW: PO LiteralKit/annotation and derived correspondence report. | Annotate one representative inline and block family across all three ASTs, derive their correspondence row, and prove a deliberately lossy mapping is reported as an explicit demotion. |
| 3 | [`spar-document-annotation-wire`](../../goals/spar-document-annotation-wire/README.md) | Add pinned DOCO/DEO/FaBiO/CiTO terms and a typed OA/PROV document-annotation wire shape, including the DOCO section fold over Md headings. | Delivery-after `document-ast-pattern-classification`; consumes stable AST node identities, not PO as RDF vocabulary. | Identity registry: `packages/foundation/modeling/identity/src/Vocab.ts`; generated RDF terms/modules: `packages/foundation/modeling/rdf/src/Vocab/` and `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts`; Md headings: `packages/foundation/modeling/md/src/Md.model.ts`. NET-NEW: curated acquisition inputs/notices/drift proof, four vocab modules, annotation schemas, and section fold. | Pin and generate a minimal exercised term set, fold one flat Md heading fixture into a section tree, and encode one OA annotation whose target is an AST node and whose body carries DOCO/DEO/FaBiO/CiTO plus PROV terms. |
| 4 | [`folio-lynx-taxonomy-browse`](../../goals/folio-lynx-taxonomy-browse/README.md) | Vendor vetted FOLIO and Lynx slices through one TaxonomySeed path and expose read-only taxonomy navigation through the existing ontology toolkit. | Delivery-after `spar-document-annotation-wire`; Lynx supplies its own `lkg.ttl` vetting/license decision. | `TaxonomySeed` and loader/registry: `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts`, `TaxonomyLoader.ts`, and `TaxonomyRegistry.ts`; toolkit/handlers: `packages/ontology/use-cases/src/tools/OntologyToolkit.ts` and `packages/ontology/server/src/tools/OntologyToolHandlers.ts`. NET-NEW: pinned conversion/curation inputs and browse tool contracts. | Convert one small FOLIO IP branch and the Lynx-vetted seed into validated TaxonomySeed fixtures, load them, then list a branch and traverse concept/child/parent results through read-only toolkit handlers. |

## Sequencing

The patent-document schema ships first because it creates the concrete
consumer contract and immediate practice-KG payoff. PO classification follows
as an independently useful AST law. The SPAR wire packet then adds RDF
vocabulary and document annotations over stable AST structure. The FOLIO/Lynx
packet lands last because it composes the vetted-seed and browse-tool path and
does not block the earlier typed authoring work.

The dependency edges encode campaign order, not permission to absorb sibling
scope. Each goal remains independently shippable and abandonable.

## First Campaign Vertical Slice

Run one Markdown patent-application fixture through the new section and claim
schemas, consume its claims in the existing practice-KG claims batch, and prove
the raw headings are normalized once at the law-practice boundary. This slice
ships before any PO, SPAR, FOLIO, or MCP-browse work.

## Inherited Constraints and Re-entry

- No runtime OWL reasoner; schemas remain the reasoner.
- DOCO never models patent claim semantics.
- FOLIO remains a pinned IP-relevant slice, never the full class graph.
- ST.96 supplies aligned names, not the editor-native tree.
- Multi-pattern DOCO classes allow instance-level refinement.
- Sentence nodes remain deferred until a span consumer demonstrates need.
- If a later gated candidate is added after graduation, reopen this packet at
  `decompose`; do not scaffold directly from an old MAP row.
