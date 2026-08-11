# Research

## 2026-08-11 — Session findings: DOCO/PO vs the AST family

### External: what DOCO and PO are

- PO (Pattern Ontology, http://www.essepuntato.it/2008/12/pattern) reduces
  document markup to a small set of content-model patterns defined by two
  axes (can contain text? can contain elements?) plus containment axioms:
  Block, Inline, Atom, Milestone, Popup, Container, HeadedContainer, Table,
  Record, Field, Meta, Marker/Flat/Mixed/Bucket abstractions. Spec:
  https://sparontologies.github.io/po/current/po.html
- DOCO (Document Components Ontology, http://purl.org/spar/doco) layers ~40
  structural classes (paragraph, section, chapter, front/body/back matter,
  list, table, figure, footnote, formula) over PO, and imports DEO
  (http://purl.org/spar/deo) for rhetorical classes (introduction, methods,
  discussion, acknowledgements). Structure and rhetoric are orthogonal: one
  node can be both `doco:Section` and `deo:Introduction`. Spec:
  https://sparontologies.github.io/doco/current/doco.html
- Local clone: `~/Downloads/ontologies/doco` (docs/current has ttl, jsonld,
  nt, owl, graphml). PO/DEO not vendored — `owl:imports` purl.org IRIs only.
- Worked examples model sentences as first-class `pattern:Inline` nodes
  ordered via the Collections Ontology (`co:firstItem`/`co:nextItem`), text
  attached via `c4o:hasContent` — i.e. sentence-level anchors are contained
  nodes, not char offsets.

### DOCO class → PO pattern typings (extracted from doco.nt, 2026-06-25 build)

Single-pattern: Paragraph→Block, Sentence→Inline, Section/Chapter/Appendix/
Index/ListOfFigures/ListOfTables→HeadedContainer, FrontMatter/BodyMatter/
BackMatter/Part/Stanza/CaptionedBox/FormulaBox/TextBox/BlockQuotation→
Container, Table→Table, Formula/ComplexRunInQuotation→Popup,
SimpleRunInQuotation/TextChunk→Inline, Title/Subtitle/Line→Block.

Multi-pattern (rhetorical identity ↔ structural pattern is many-to-many;
realization varies by format):

| DOCO class | Possible PO patterns |
| --- | --- |
| List | Block, Container, Field, HeadedContainer, Table |
| Footnote | Container, Popup |
| Figure | Meta, Milestone |
| Title | Block, Field |
| Label | Block, Container |

This is the formal statement of mapping lossiness: e.g. a footnote is a Popup
in `@beep/md` (inline `FootnoteReference` + out-of-band `FootnoteDefinition`)
but a Container in print-shaped formats.

### In-repo capability inventory

- `@beep/md` (`packages/foundation/modeling/md/src/Md.model.ts`): strict
  Inline/Block bipartition as recursive tagged unions (`InlineChildren`,
  `BlockChildren`, `ListItemChildren`, `ListChildren` only `Li`). The PO
  containment axioms are already statically enforced by `S.suspend` unions —
  PO Block≅`P`, Inline≅`Inline` union, Atom≅`Text`/`Code`, Milestone≅`Br`/
  `Hr`, Popup≅footnotes, Container≅`Document`, Table-pattern≅`ListChildren`/
  `TaskItemChildren`. No Section node — headings are flat siblings (the
  DOCO Section tree is a *derived* fold, not syntax).
- `@beep/pandoc-ast` (`Pandoc.model.ts`, `Pandoc.mapping.ts`): same
  bipartition + `Div` (generic Container md lacks), `Note` (Popup),
  `UnknownInline`/`UnknownBlock` escape hatches; mapping to `@beep/md` is
  where pattern demotion lives today. `PandocMappingIssue` already reports
  typed `lossy`/`unsupported` diagnostics; PO classification should enrich
  those reports, not replace them.
- `@beep/lexical-schema` (`Lexical.model.ts`): `ElementNode` vs `TextBase`
  hierarchy — PO Structured vs Flat; `RootNode` is a non-textual Container;
  `StrictRootChildType`, `strictNodeChildren`, and `StrictRootNode` in
  `Lexical.model.ts` enforce the recursive containment grammar. The Lexical
  codec already documents the Md projection's lossiness profile.
- `@beep/rdf` (`packages/foundation/modeling/rdf/src/Vocab/`): hand vocab
  modules `Oa.ts` (Web Annotation — anchors), `Prov.ts`, `Dcterms.ts`,
  `Skos.ts`, `Owl.ts`, `Rdfs.ts`, `Rdf.ts` + `generated/*.terms.ts` with
  `vocab-terms.data.json` — a generator target shape for `Doco.terms.ts`/
  `Deo.terms.ts`/`Fabio.terms.ts`/`Cito.terms.ts`. The current `CoreVocab`
  registry and `VocabTerms.ts` generator know only RDF, RDFS, SKOS, OWL, and
  DCTERMS, so acquisition, registry, export, and drift-test work is required.
- `@beep/ontology` (`packages/foundation/modeling/ontology/src/`):
  `TaxonomyLoader`/`TaxonomyRegistry` load vetted repo-specific
  `TaxonomySeed` JSON-LD slices; `Fold.*` modules; `SemanticFoundation`
  models. Upstream Turtle or ontology-shaped JSON-LD is not loader-ready and
  needs an explicit conversion/import step.
- `apps/professional-desktop`: the agent surface the ontology access is for
  (drafting responses / patent applications).
- Related packets: `explorations/lynx-lkg-ontology-grounding` (Lynx corpus
  has ZERO patent/IP modelling — gap confirmed); `explorations/
  full-document-editor` (D1–D27: `@beep/md` canonical, Lexical/Pandoc are
  projections — any pattern/annotation layer must respect this).
- NOT FOUND in-repo: any DOCO/DEO/PO/FOLIO vocab module; any
  pattern-classification of AST constructors; any rhetorical annotation
  layer over the ASTs; any patent-document ontology.

### Session take (candidate layering)

1. PO: don't adopt at runtime — *cite*. Classify AST constructors by pattern;
   use as the conservation law for mappings ("pattern preserved or explicitly
   demoted, never silently") and for `Pandoc.report` language.
2. DOCO/DEO: adopt as wire vocabulary in `@beep/rdf` when structure enters
   the graph — document-segment typing (claims section, abstract,
   background) for the legal/patent KG; principled structural chunking for
   retrieval.
3. Rhetoric is an annotation layer over node-ids/spans (OA + DOCO/DEO +
   PROV), never new node tags in the syntax ASTs.
4. Section tree = named derived fold from flat heading sequence.

## 2026-08-11 — FOLIO / metadata / candidate-ontology sweep

External sweep delegated to Grok 4.5 (`--reasoning-effort high`), 5 lanes,
reports land in [`research/grok/`](./research/grok/):

- `research/grok/01-metadata-ontologies.md` — document metadata ontologies.
- `research/grok/02-legal-document-structure.md` — legal/patent document
  structure standards (Akoma Ntoso, LegalDocML, USPTO/EPO/WIPO).
- `research/grok/03-folio-and-legal-kg.md` — FOLIO deep dive + legal KG
  vocabularies; MCP delivery pattern.
- `research/grok/04-ontology-llm-integration.md` — ontology-aided retrieval /
  generation patterns for LLM agents (GraphRAG, MCP, constrained drafting).
- `research/grok/05-x-and-practitioner-signal.md` — x.com + practitioner
  signal on adoption, critiques, live projects.

FOLIO reference pages scraped to `research/folio/` (see SOURCES.md).

### Sweep synthesis (all 5 lanes complete, ~250KB of cited reports)

The lanes converge on a **five-layer stack with no single winning ontology** —
each layer has a different best-fit source:

1. **Content-model layer (syntax):** PO — already implemented by the AST
   family's recursive unions. Cite, classify constructors, don't adopt at
   runtime. (Session finding, corroborated by lane 5: nobody ships DoCO/PO as
   product substrate; its value is pattern theory.)
2. **Structural/rhetorical layer (generic):** DOCO + DEO as wire vocabulary
   in `@beep/rdf` (CC-BY 4.0, DoCO 1.4.0 still maintained — revised
   2026-06-25). Lane 1 adds **FaBiO** (ranked #1 metadata adopt: FRBR-aligned
   document typing *including `fabio:Patent` / `PatentApplication` /
   `PatentDocument` classes*), **CiTO** (citation intent — `citesAsEvidence`,
   `disputes`, `supports` — for prior-art and OA-response reasoning), and
   DataCite identifiers; DCTERMS stays the spine. All SPAR = CC-BY.
3. **Patent-document layer (domain):** **no vendorable ontology exists** —
   lane 2's top finding. The semantic source of truth is **37 CFR 1.77 /
   MPEP §608** (US-gov public domain) for section roles + claim formalities,
   with **WIPO ST.96** element names as interchange vocabulary and USPTO
   bulk-data DTDs as ground-truth fixtures. Claim substructure
   (preamble/transition/body, independent/dependent graph) is a home-grown
   schema citing EPO Guidelines F-IV + USPTO claim-drafting materials. Akoma
   Ntoso is a *pattern library only* (hierarchy, Schematron drafting rules) —
   poor model for patent claims. Lane 3's live API probes confirm **FOLIO has
   no patent document structure**: no claim types (its "claim" hits are civil/
   bankruptcy claims), no spec-section roles, no MPEP/CFR nodes, no Office
   Action *document* type (only UTBMS billing task PA430). The lynx packet's
   "zero patent/IP modelling" gap is now confirmed across THREE corpora
   (Lynx, FOLIO, academic patent KGs).
4. **Legal-classification layer (matter tags):** FOLIO (~18k classes, 24
   branches, CC-BY data + MIT tooling, forked from MIT SALI LMSS) as
   *optional interoperability layer* — practice areas, USPTO as entity,
   UTBMS PA* task codes. Governance risk flagged: contested SALI↔FOLIO
   fork/rebrand (lane 5), adoption claims self-reported.
5. **Agent-delivery layer:** **ontology-as-MCP-tools beats
   ontology-as-prompt** (lane 4's #1 pattern, FOLIO MCP as the legal
   instance: 12 tools — discovery/browse/query/relationship/export — over
   REST or local mode, `uvx folio-mcp`, repo alea-institute/folio-mcp). The
   proposed move: add taxonomy-shaped tools to the existing governed
   ontology MCP surface over `@beep/ontology`'s TaxonomyRegistry, serving
   vetted vendor slices + the patent-structure schema. Lane 4's supporting
   evidence: structure-aware
   chunking (DOCO section/paragraph folds) is a top retrieval lever; OG-RAG
   (arXiv:2412.15235, +55% fact recall) is the academic template for
   ontology-grounded retrieval; anti-patterns = whole-ontology prompt
   stuffing, schema-valid hallucination, unconstrained Text2SPARQL.

Practitioner reality check (lane 5): energy is on layout-preserving document
trees (Docling — breakout IBM→LF-AI OSS), taxonomy-tagging via MCP, and
hybrid graph+vector retrieval — i.e. exactly layers 3–5, not re-implementing
SPAR's scholarly stack. "AI writes patent claims end-to-end" is overclaimed;
section structuring + boilerplate is the shipped reality.

Full detail + URL ledgers: `research/grok/01..05-*.md` (each is indexed from
the central `research/SOURCES.md` ledger and has its own ranked shortlist,
license notes, and fit-assessment section). Lane scrape
caches under `research/grok/.firecrawl*` are the on-disk copies of cited
pages; raw agent transcripts in `research/grok/raw/`.

## 2026-08-11 — Align-stage correction: the MCP layer partly exists

The earlier NOT-FOUND list overstated the gap. Found during align prep:

- `packages/ontology/use-cases` + `packages/ontology/server`: a governed
  **ontology MCP toolkit already exists** — 9 tools
  (`ontology_open_inspect`, `_snapshot_describe`, `_search`,
  `_sparql_query`, `_propose_change_batch` (mutating),
  `_validate`, `_repair` (mutating), `_export_provenance` (mutating),
  `_capability_metadata`), with mutation gating through the epistemic
  ExecutionLedger. Served via
  `apps/professional-desktop/server/OntologyMcpTransport.ts`; integration
  harness at `apps/professional-desktop/test/integration/support/
  ontology-mcp-harness.ts`.
- `apps/practice-kg-mcp`: office-action **candidate-claims batch** command
  over `@beep/law-practice-server` + Anthropic model + pglite KG.
- `packages/drivers/uspto-mcp`: USPTO MCP driver exists.

Revised gap statement: what's missing is not an MCP server but (a) the
**vocab content** (DOCO/DEO/FaBiO/CiTO terms, patent-document schema) behind
the existing tools, and (b) **taxonomy-browse-shaped tools** in the
folio-mcp style (branch listing, SKOS tree navigation, concept
search-by-definition) — the current toolkit is inspect/SPARQL-shaped.
Align Q4 is rewritten accordingly: extend the existing toolkit vs new
surface.
