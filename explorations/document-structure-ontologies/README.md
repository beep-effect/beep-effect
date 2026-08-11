# Document-Structure & Metadata Ontologies over the AST Family

## Status

Stage: `shape`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The DOCO/PO taxonomy is near-isomorphic to the recursive tagged unions in
`@beep/md`, `@beep/pandoc-ast`, and `@beep/lexical-schema` — convergent
evolution toward the same content-model algebra. What is that similarity worth:
pattern-classification of AST constructors, a DOCO/DEO rhetorical annotation
layer in `@beep/rdf`/`@beep/ontology`, and FOLIO-style ontology access for
agents drafting patent applications in `apps/professional-desktop`?

## Next Open Question

Shape review: does [`BRIEF.md`](./BRIEF.md) (DRAFT) match the operator's
picture — problem, one-cycle appetite, 5-layer sketch per D1–D6, rabbit
holes, no-gos? Iterate until confirmed, then decompose into `MAP.md`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
7. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Related Packets

- [`lynx-lkg-ontology-grounding`](../lynx-lkg-ontology-grounding/README.md) —
  align-stage sibling on legal KG ontologies; found zero patent/IP modelling
  in the Lynx corpus, so that gap is live here too.
- [`full-document-editor`](../full-document-editor/README.md) — architecture
  grill pinned `@beep/md` canonical with Lexical/Pandoc as projections; this
  packet's pattern/annotation layers must respect that decision.

## Trail

<Dated one-liners, newest first: what each session did and where it stopped.>

- 2026-08-11 (align+shape): align-prep repo dive corrected the research
  record — a governed 9-tool ontology MCP toolkit already exists
  (`packages/ontology/use-cases`+`server`, professional-desktop transport),
  plus practice-kg-mcp claims batches and `@beep/uspto-mcp`. Grilled all six
  questions → D1–D6 in DECISIONS.md (stack accepted; four vocabs one pass,
  PO stays LiteralKit; patent schema in `@beep/law-practice-domain`; extend
  existing MCP toolkit with browse tools; PO via schema annotations; FOLIO
  as pinned vetted slice). BRIEF.md drafted; stage → shape, awaiting
  operator review of the brief.
- 2026-08-11 (later): all 5 sweep lanes landed (~250KB cited reports, all
  exit 0); synthesis written into RESEARCH.md — converged on a 5-layer stack;
  FOLIO live-probed: no patent document structure (patent/IP gap now
  confirmed across Lynx, FOLIO, and academic KGs); manifest re-queued with 6
  align questions. Research stage complete; next session starts align.
- 2026-08-11: packet opened from live session (DOCO/PO analysis + DOCO clone
  axiom extraction already in hand); capture written; stage advanced to
  research; 5-lane Grok 4.5 (high) sweep launched into `research/grok/`;
  FOLIO pages scraped for the ledger; branch
  `docs/explore-document-structure-ontologies` created.
