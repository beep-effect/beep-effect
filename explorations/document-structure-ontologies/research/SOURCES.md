# Sources — provenance ledger

## External specifications & upstream repos

| Source | URL | On-disk | License | Disposition |
| --- | --- | --- | --- | --- |
| DOCO spec (HTML) | https://sparontologies.github.io/doco/current/doco.html | clone: `~/Downloads/ontologies/doco/docs/current/` | CC-BY 4.0 (stated in spec header) | permissive ⇒ port/vendor with attribution |
| PO spec (HTML) | https://sparontologies.github.io/po/current/po.html | scraped 2026-08-11 (session) | not verified | reference only until license verified |
| DOCO repo | https://github.com/SPAROntologies/doco | `~/Downloads/ontologies/doco` (out-of-repo clone) | CC-BY 4.0 per ontology header; repo license not checked | verify repo LICENSE before vendoring ttl/jsonld |
| DEO (imported by DOCO) | http://purl.org/spar/deo | not on disk | not verified | reference only |
| FOLIO explorer | https://folio.openlegalstandard.org/explore | scrape failed (JS SPA renders empty); use API docs https://folio.openlegalstandard.org/docs | FOLIO license — verify | pending verification |
| FOLIO MCP overview | https://openlegalstandard.org/resources/folio-mcp/ | `research/folio/folio-mcp.md` | — | reference |
| FOLIO MCP tools (12 tools, 18k+ concepts) | https://openlegalstandard.org/resources/folio-mcp-tools/ | `research/folio/folio-mcp-tools.md` | — | reference |
| FOLIO MCP server repo | https://github.com/alea-institute/folio-mcp | not cloned | check repo LICENSE | reference; candidate pattern donor for an MCP surface over `@beep/ontology` TaxonomyLoader |

## Sweep reports (machine-generated, Grok 4.5 high, 2026-08-11)

Raw transcripts in `research/grok/raw/*.jsonl` are a local-only recovery
layer; lane scrape caches in `research/grok/.firecrawl*/` are reproducible,
local-only copies of cited pages. Both are ignored in this public repo.
Reports: `research/grok/0{1..5}-*.md`, each with its own §Sources URL ledger.
Every claim inside must carry its own URL; treat uncited claims as unverified.

## Key upstream artifacts surfaced by the sweep

| Source | URL | License | Disposition |
| --- | --- | --- | --- |
| FaBiO (SPAR) — has Patent/PatentApplication classes | https://sparontologies.github.io/fabio/current/fabio.html | CC-BY 4.0 | vendor/generate terms with attribution |
| CiTO (SPAR) — citation intent | https://sparontologies.github.io/cito/current/cito.html | CC-BY 4.0 | curated subset, vendor with attribution |
| DataCite ontology (SPAR) | https://sparontologies.github.io/datacite/current/datacite.html | CC-BY 4.0 | vendor with attribution |
| 37 CFR 1.77 / MPEP §608 + USPTO claim-drafting materials | https://www.uspto.gov/web/offices/pac/mpep/s608.html | US-gov public domain | normative source; we author the schema layer |
| WIPO ST.96 v10.0 | https://www.wipo.int/standards/en/st96/v10-0/ | freely published standard; verify derived-schema terms | interchange vocabulary alignment |
| USPTO XML resources (bulk DTDs) | https://www.uspto.gov/learning-and-resources/xml-resources | government-published | fixtures / golden tests |
| FOLIO ontology data | https://github.com/alea-institute/FOLIO | CC-BY 4.0 (data), MIT heritage (SALI LMSS fork; NOTICES.md) | optional interop layer; governance risk noted |
| folio-mcp server | https://github.com/alea-institute/folio-mcp | check repo LICENSE (PyPI: folio-mcp) | pattern donor for beep-taxonomy MCP |
| Akoma Ntoso / OASIS LegalDocML | https://www.oasis-open.org/standard/akn-v1-0/ | OASIS IPR (RF) | pattern library only, never patent model |
| OG-RAG paper | https://arxiv.org/abs/2412.15235 | paper | method reference for ontology-grounded retrieval |
| Docling | https://github.com/docling-project/docling | check (LF AI project, MIT expected) | structure-first ingestion reference |
| EPO Guidelines F-IV (claims) | https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html | EPO publication | normative reference for claim schema |

## In-repo bricks this packet composes

| Brick | Path |
| --- | --- |
| Md AST (canonical) | `packages/foundation/modeling/md/src/Md.model.ts` |
| Pandoc AST + mapping | `packages/foundation/modeling/pandoc-ast/src/` |
| Lexical schema + normalize | `packages/foundation/modeling/lexical/src/` |
| RDF vocab modules + generator shape | `packages/foundation/modeling/rdf/src/Vocab/` |
| Taxonomy loader/registry + TTL/JSON-LD seeds | `packages/foundation/modeling/ontology/src/` |
| Professional Desktop (agent surface) | `apps/professional-desktop` |

## Cross-links

- `explorations/lynx-lkg-ontology-grounding/research/` — 15 reference legal
  ontologies already assessed there; do not re-mine, cite.
- `explorations/full-document-editor/` — D1–D27 architecture decisions bind
  this packet's layering.
