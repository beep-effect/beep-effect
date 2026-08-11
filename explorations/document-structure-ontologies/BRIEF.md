# Brief — Document-Structure & Metadata Ontologies over the AST Family

Status: DRAFT — awaiting operator review (shape stage).
Inputs: [`CAPTURE.md`](./CAPTURE.md) · [`RESEARCH.md`](./RESEARCH.md) ·
[`DECISIONS.md`](./DECISIONS.md) (D1–D6).

## Problem

Agents in `apps/professional-desktop` will draft patent applications and
office-action responses. Today the repo has three document ASTs whose
structural laws are implicit (enforced by recursive unions but named
nowhere), an RDF/KG layer with no document-structure or citation-intent
vocabulary, a governed ontology MCP toolkit with no taxonomy worth browsing,
and no typed notion of what a patent application's sections, claims, or
drafting rules *are*. Research confirmed no vendorable patent-document
ontology exists anywhere — we must author that layer. The generic SPAR
vocabularies are available under attribution licenses, but their acquisition,
curation, generator integration, and notices are net-new work.

Without this: retrieval chunks documents blind to structure, agents get
matter/section knowledge via prompt-stuffing (the documented anti-pattern),
and the existing Md/Pandoc/Lexical lossiness diagnostics have no shared
document-pattern classification.

## Appetite

One focused cycle (~2–3 weeks of PR-sized work), decomposable into 3–4 goal
packets that are independently shippable and abandonable. This is
substrate work — each slice must pay for itself without the later slices.

## Solution sketch (fat marker)

Five layers, per D1–D6:

1. **PO classification (D5).** PO LiteralKit + schema annotation on every
   tagged class in `Md.model` / `Pandoc.model` / `Lexical.model`. Derived:
   cross-model correspondence table and conservation-law property tests
   ("pattern preserved or explicitly demoted") over the existing typed
   `PandocMappingIssue` and Lexical codec lossiness reports.
2. **Wire vocab (D2).** Extend the curated vocabulary registry, acquisition
   inputs, generator, exports, notices, and drift tests to add `Doco`, `Deo`,
   `Fabio`, and `Cito` terms modules to `@beep/rdf/Vocab`. Annotation layer
   shape: OA anchors on AST node ids + DOCO/DEO/FaBiO types + CiTO intents +
   PROV, over the *existing* vocab modules.
3. **Patent-document schema (D3).** In `@beep/law-practice-domain`:
   `PatentApplicationSection` literal domain (37 CFR 1.77(b) order),
   claim substructure (preamble/transition/body, independent/dependent
   graph), ST.96-aligned element names, heading normalizers over `@beep/md`.
   MPEP §608 / EPO F-IV cited as normative references in JSDoc/tests.
   First consumer: practice-kg-mcp claims batch.
4. **FOLIO slice (D6).** Convert a pinned IP-relevant upstream slice (IP Law,
   UTBMS PA*/TR*, USPTO entities, coarse doc types) into the repo-specific
   `TaxonomySeed` JSON-LD shape, then validate and vendor that vetted,
   CC-BY-attributed seed for TaxonomyLoader, following the lynx precedent.
5. **MCP browse tools (D4).** Extend the existing ontology toolkit with
   read-only folio-mcp-shaped tools (list branches, get concept /
   children / parents, search definitions) serving the loaded taxonomies —
   FOLIO slice, patent-section projection, vocab terms — to
   professional-desktop agents.

Retrieval note: the DOCO-typed section fold over `@beep/md` (flat headings →
section tree) is the structural-chunking enabler; it rides layer 2, not a
separate layer.

## Rabbit holes (constraints for goal SPECs)

- **No OWL reasoning at runtime.** The schemas are the reasoner. Vocab
  modules are IRI constants, not semantics engines.
- **Don't make DOCO model claims.** Patent claim structure is the
  law-practice schema's job; DOCO stops at generic structure.
- **Don't ingest all 18k FOLIO classes** or chase its full class graph —
  slice only, pinned release, refresh is a deliberate future act.
- **Sentence-level modeling (Collections-Ontology ordering, c4o content)**
  is explicitly deferred — spans/anchors first; sentences-as-nodes only if
  the NLP span work demands it.
- **ST.96 XML is interchange, never the editor-native format** — alignment
  means IRI/element *names*, not adopting the XSD tree.
- **Multi-pattern DOCO classes** (List, Footnote, Figure, Title, Label) are
  unions in the ontology — the annotation layer must allow per-instance
  pattern refinement, not force one pattern per class.

## No-gos

- No rhetorical node tags in the syntax ASTs (`full-document-editor` D1–D27:
  `@beep/md` stays canonical; rhetoric is annotation over structure).
- No live external ontology API as a runtime dependency of the desktop app.
- No unpinned or unvetted vendoring; every vendored artifact carries license
  + provenance in the ledger.
- No new MCP deployable; browse tools land in the existing governed toolkit.
- No PO vocab module in `@beep/rdf` — PO is a LiteralKit type discipline.
