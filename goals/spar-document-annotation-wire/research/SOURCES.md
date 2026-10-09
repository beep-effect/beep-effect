# spar-document-annotation-wire — inherited source corpus

Primary ledger: `explorations/document-structure-ontologies/research/SOURCES.md`.
This file reproduces the graduation-time corpus for implementation convenience;
the exploration ledger remains the primary copy.

# Sources — provenance ledger

## External specifications & upstream repos

| Source | URL | On-disk | License | Disposition |
| --- | --- | --- | --- | --- |
| DOCO spec (HTML) | https://sparontologies.github.io/doco/current/doco.html | clone: `~/Downloads/ontologies/doco/docs/current/` | CC-BY 4.0 (stated in spec header) | permissive ⇒ port/vendor with attribution |
| PO spec (HTML) | https://sparontologies.github.io/po/current/po.html | scraped 2026-08-11 (session) | not verified | reference only until license verified |
| DOCO repo | https://github.com/SPAROntologies/doco | `~/Downloads/ontologies/doco` (out-of-repo clone) | CC-BY 4.0 per ontology header; repo license not checked | verify repo LICENSE before vendoring ttl/jsonld |
| DEO (imported by DOCO) | https://sparontologies.github.io/deo/current/deo.html | not on disk | CC-BY 3.0 (official ontology page) | may generate pinned terms with attribution; historical 3.0 observation, superseded by D9; see Pinned acquisition (P0) |
| FOLIO explorer | https://folio.openlegalstandard.org/explore | scrape failed (JS SPA renders empty); use API docs https://folio.openlegalstandard.org/docs | FOLIO license — verify | pending verification |
| FOLIO MCP overview | https://openlegalstandard.org/resources/folio-mcp/ | original notes: `research/folio/folio-mcp.md` | page redistribution terms not verified | link/reference only; do not retain page capture |
| FOLIO MCP tools (12 tools, 18k+ concepts) | https://openlegalstandard.org/resources/folio-mcp-tools/ | original notes: `research/folio/folio-mcp-tools.md` | page redistribution terms not verified | link/reference only; do not retain page capture |
| FOLIO MCP server repo | https://github.com/alea-institute/folio-mcp | not cloned | check repo LICENSE | reference; candidate pattern donor for an MCP surface over `@beep/ontology` TaxonomyLoader |

## Sweep reports (machine-generated, Grok 4.5 high, 2026-08-11)

Raw transcripts in `research/grok/raw/*.jsonl` are a local-only recovery
layer; lane scrape caches in `research/grok/.firecrawl*/` are reproducible,
local-only copies of cited pages. Both are ignored in this public repo.
Reports: `research/grok/0{1..5}-*.md`, each with its own §Sources URL ledger.
Every claim inside must carry its own URL; treat uncited claims as unverified.

### Central sweep citation index

These report files and their cited URL ledgers are part of this packet's
provenance contract and must travel with it at graduation. The central index
keeps a cold session from losing a lane merely because its detailed citations
remain next to the claims they support.

| Lane | Report and external-citation ledger | Scope | Default disposition |
| --- | --- | --- | --- |
| 1 | [`01-metadata-ontologies.md`](../../../explorations/document-structure-ontologies/research/grok/01-metadata-ontologies.md#8-sources-canonical-urls) | metadata, bibliographic, citation, annotation, and provenance vocabularies | reference only unless a source has an explicit licensed disposition below |
| 2 | [`02-legal-document-structure.md`](../../../explorations/document-structure-ontologies/research/grok/02-legal-document-structure.md#18-sources-appendix-url-ledger) | legal-document standards, patent XML/practice, and structure ontologies | reference only unless a source has an explicit licensed disposition below |
| 3 | [`03-folio-and-legal-kg.md`](../../../explorations/document-structure-ontologies/research/grok/03-folio-and-legal-kg.md#12-source-ledger-non-exhaustive-but-load-bearing) | FOLIO, SALI, LKIF, Lynx, and live FOLIO API probes | reference only unless a source has an explicit licensed disposition below |
| 4 | [`04-ontology-llm-integration.md`](../../../explorations/document-structure-ontologies/research/grok/04-ontology-llm-integration.md#9-source-index-urls-cited) | GraphRAG, MCP, constrained generation, and structure-aware retrieval | method/reference only |
| 5 | [`05-x-and-practitioner-signal.md`](../../../explorations/document-structure-ontologies/research/grok/05-x-and-practitioner-signal.md) | practitioner signal cross-checked against primary project sources | signal only; primary sources govern claims |

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
| Taxonomy loader/registry + repo-specific `TaxonomySeed` JSON-LD slices | `packages/foundation/modeling/ontology/src/` |
| Governed nine-tool ontology MCP toolkit | `packages/ontology/use-cases/src/tools/`, `packages/ontology/server/` |
| Ontology MCP desktop transport + integration harness | `apps/professional-desktop/server/OntologyMcpTransport.ts`, `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts` |
| Law-practice domain/server/use-cases slice | `packages/law-practice/domain/`, `packages/law-practice/server/`, `packages/law-practice/use-cases/` |
| Practice-KG MCP claims-batch consumer | `apps/practice-kg-mcp/` |
| USPTO MCP driver | `packages/drivers/uspto-mcp/` |
| Professional Desktop (agent surface) | `apps/professional-desktop` |

## Cross-links

- `explorations/lynx-lkg-ontology-grounding/research/` — 15 reference legal
  ontologies already assessed there; do not re-mine, cite.
- `explorations/full-document-editor/` — D1–D27 architecture decisions bind
  this packet's layering.

## Pinned acquisition (P0)

D9 selects dated releases; D13 records CC BY 4.0 for all four artifacts.
The historical DEO CC-BY 3.0 row is preserved as an observation of an older
page/release, not the license of these pins. Acquisition used upstream URLs
only; no local SPAR clone supplied bytes.

### Doco

- Commit: `4c4109a64148c207f80d48a611a79a2d996a44b4`; artifact: `docs/2026-06-25/doco.ttl`.
- Immutable source: https://raw.githubusercontent.com/SPAROntologies/doco/4c4109a64148c207f80d48a611a79a2d996a44b4/docs/2026-06-25/doco.ttl
- SHA-256: `616c0f7611168d4ff8325ce361ab79625f9664aead7bfe6bf8e0c66982f7c4ae`.
- Ontology IRI: `http://purl.org/spar/doco`; version IRI: `http://purl.org/spar/doco/2026-06-25`; version: `1.4.0`.
- Artifact license: CC BY 4.0 (`dcterms:license`); repository license: CC BY 4.0.
- Repository license: https://raw.githubusercontent.com/SPAROntologies/doco/4c4109a64148c207f80d48a611a79a2d996a44b4/LICENSE.md
- LICENSE.md SHA-256: `9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94`.
- Attribution: Doco by David Shotton and Silvio Peroni. Contributors: Sebastian Barzaghi. Licensed under CC BY 4.0. Term names selected and projected to TypeScript; ontology axioms are not redistributed.
- Semantic SHA-256 (sorted selected names joined with newline): `d01a7e4eaa8ede7c08c76c324ac0dc0ff8f24576df48d5d65e45d9cddf39a79d`.

### Deo

- Commit: `dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4`; artifact: `docs/2026-08-14/deo.ttl`.
- Immutable source: https://raw.githubusercontent.com/SPAROntologies/deo/dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4/docs/2026-08-14/deo.ttl
- SHA-256: `c66ac7523cef1d57b88fbb8d8e5bb3fe81e8ce2932e24167700f0aafd89126cc`.
- Ontology IRI: `http://purl.org/spar/deo`; version IRI: `http://purl.org/spar/deo/2026-08-14`; version: `1.2.0`.
- Artifact license: CC BY 4.0 (`dcterms:license`); repository license: CC BY 4.0.
- Repository license: https://raw.githubusercontent.com/SPAROntologies/deo/dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4/LICENSE.md
- LICENSE.md SHA-256: `9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94`.
- Attribution: Deo by David Shotton and Silvio Peroni. Contributors: Sebastian Barzaghi. Licensed under CC BY 4.0. Term names selected and projected to TypeScript; ontology axioms are not redistributed.
- Semantic SHA-256 (sorted selected names joined with newline): `bae13b8cd5aa68e5273b6a94053dbe4859ec7ddecd25ebd2fab19199e2842283`.

### Fabio

- Commit: `ea5b2cd49a7a8f4dc695d633c76bb05608c085db`; artifact: `docs/2026-09-03/fabio.ttl`.
- Immutable source: https://raw.githubusercontent.com/SPAROntologies/fabio/ea5b2cd49a7a8f4dc695d633c76bb05608c085db/docs/2026-09-03/fabio.ttl
- SHA-256: `86523bded037828b13c3d2083c6eccdb0daa223009d4ed8ddd70ff1a4d1789ea`.
- Ontology IRI: `http://purl.org/spar/fabio`; version IRI: `http://purl.org/spar/fabio/2026-09-03`; version: `2.3.1`.
- Artifact license: CC BY 4.0 (`dcterms:license`); repository license: CC BY 4.0.
- Repository license: https://raw.githubusercontent.com/SPAROntologies/fabio/ea5b2cd49a7a8f4dc695d633c76bb05608c085db/LICENSE.md
- LICENSE.md SHA-256: `9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94`.
- Attribution: Fabio by David Shotton and Silvio Peroni. Contributors: Paolo Ciccarese, Sebastian Barzaghi and Tim Clark. Licensed under CC BY 4.0. Term names selected and projected to TypeScript; ontology axioms are not redistributed.
- Semantic SHA-256 (sorted selected names joined with newline): `b6ce788d9786917c9d19adaa0d904213365607c7f683d7277f508dcf142b4cc2`.

### Cito

- Commit: `d34b42e8d4d1c9d45bc530599328897805116994`; artifact: `docs/2026-09-03/cito.ttl`.
- Immutable source: https://raw.githubusercontent.com/SPAROntologies/cito/d34b42e8d4d1c9d45bc530599328897805116994/docs/2026-09-03/cito.ttl
- SHA-256: `1b0570e2126525365d325771d1c8cf3ba399f6dfd829cb69fd2851f42802d7b0`.
- Ontology IRI: `http://purl.org/spar/cito`; version IRI: `http://purl.org/spar/cito/2026-09-03`; version: `2.9.0`.
- Artifact license: CC BY 4.0 (`dcterms:license`); repository license: CC BY 4.0.
- Repository license: https://raw.githubusercontent.com/SPAROntologies/cito/d34b42e8d4d1c9d45bc530599328897805116994/LICENSE.md
- LICENSE.md SHA-256: `9e5f1b3c610b9c2da5c313bf81d577a7d1acec686bdb0384edefa6df0f90cd94`.
- Attribution: Cito by David Shotton and Silvio Peroni. Contributors: Paolo Ciccarese, Sebastian Barzaghi and Tim Clark. Licensed under CC BY 4.0. Term names selected and projected to TypeScript; ontology axioms are not redistributed.
- Semantic SHA-256 (sorted selected names joined with newline): `7b748150bdc75159bc015a93e17523e93158d7421422bce8a36547e4f1b81669`.
