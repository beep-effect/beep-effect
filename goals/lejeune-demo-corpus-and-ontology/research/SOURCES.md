# LeJeune Demo Corpus and Ontology — Sources & Provenance

- **Source exploration:**
  [`explorations/lejeune-bolt-agentic-demo`](../../../explorations/lejeune-bolt-agentic-demo/README.md)
- **Primary ledger:**
  [`research/SOURCES.md`](../../../explorations/lejeune-bolt-agentic-demo/research/SOURCES.md)
  in the source exploration. It wins if this goal-side mirror drifts.
- **Decision authority:**
  [`DECISIONS.md`](../../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md)
- **Carry-forward date:** 2026-08-26

The tables below reproduce the bundle-relevant implementation subset of the exploration corpus.
No raw public or customer payload is copied here.

## 1. Mined source corpus

| Source | Title | Location | Theme | Disposition |
| --- | --- | --- | --- | --- |
| L1 | Public-site mining | [`01-lejeunebolt-site-mining.md`](../../../explorations/lejeune-bolt-agentic-demo/research/01-lejeunebolt-site-mining.md) | Public taxonomy, products, tools, standards, and source metadata | Cite metadata and URLs; keep raw captures machine-local |
| L3 | Fastener distribution process | [`03-fastener-distribution-process.md`](../../../explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md) | RFQ fields, matched assemblies, DTI matching, A490 coating refusal, lots and certificates | Rule and fixture authority; do not reproduce standards |
| L4 | In-repo capability inventory | [`04-in-repo-capability-inventory.md`](../../../explorations/lejeune-bolt-agentic-demo/research/04-in-repo-capability-inventory.md) | Exact spans, document text, RDF, local projections, provider adapters | Re-verify live source before implementation |
| L7 | Use-case evaluation | [`07-use-case-evaluation.md`](../../../explorations/lejeune-bolt-agentic-demo/research/07-use-case-evaluation.md) | Fixed story, trust boundary, temporal correction | Acceptance and fixture-shape input |
| L8 | Demo options | [`08-demo-options.md`](../../../explorations/lejeune-bolt-agentic-demo/research/08-demo-options.md) | Shared bundle contract and five-day cut | Architecture and sequencing input |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What this packet takes |
| --- | --- | --- | --- |
| [TrustGraph](https://github.com/trustgraph-ai/trustgraph) | Apache-2.0 | Reference or port only with attribution | Architecture reference only; the full runtime is excluded |
| [trustgraph-ui](https://github.com/trustgraph-ai/trustgraph-ui) React root | Apache-2.0 | Named files only with attribution and replaced marks | No bundle code planned |
| Local TrustGraph TypeScript port | Root license unverified in the source ledger | Reference-only | No copied code |
| Public standards and vendor pages | Publisher copyright unless the ledger says otherwise | Cite designation, revision, URL, and short facts only | Rule evidence; never raw documents or copied standards |

The implementation composes in-repo capabilities. It has no authorized upstream-code port.

## 3. External research sources

- LeJeune product taxonomy:
  <https://lejeunebolt.com/product-portfolio/>
- RCSC 2020 structural-joint specification:
  <https://www.boltcouncil.org/files/2020RCSCSpecification.pdf>
- AISC engineering FAQ on bolting and matched assemblies:
  <https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/>
- DTI strength behavior and ASTM F959 summary:
  <https://www.portlandbolt.com/technical/specifications/astm-f959/>
- A490 hot-dip-galvanizing refusal:
  <https://blueprint.fastenal.com/structural-bolts.html>
- The consolidated access dates, caveats, and evidence labels remain in the
  [primary ledger](../../../explorations/lejeune-bolt-agentic-demo/research/SOURCES.md).

## 4. In-repo capability references

| Brick | Source evidence | Packet use or limit |
| --- | --- | --- |
| `@beep/doc-text` | `packages/drivers/doc-text/src/DocText.service.ts:125-163,179-224` | PDF text layer and DOCX text; no OCR promise |
| `@beep/langextract` | `packages/foundation/capability/langextract/src/Service/Service.layer.ts:44-104`; `VerifiedSpan/VerifiedSpan.behavior.ts:641-683` | Structured extraction and exact source-span alignment |
| `@beep/rdf`, `@beep/identity`, `@beep/ontology-*` | [`L4 §C`](../../../explorations/lejeune-bolt-agentic-demo/research/04-in-repo-capability-inventory.md#c-knowledge-graph-substrate) | RDF, identity, evidence, provenance, and schema projection |
| `@beep/oxigraph`, `@beep/shacl` | `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-194,253-290`; `packages/drivers/shacl/src/Shacl.validation.ts:401-451` | Bounded in-memory query and validation; not persistence |
| Practice-KG pattern | `packages/law-practice/server/src/PracticeKg.projections.ts:572-645`; `apps/practice-kg-mcp/src/runtime/Host.ts:51-114` | PGlite, DuckDB/full-text, provenance, deterministic read model |
| Model adapters | `packages/drivers/anthropic/src/Anthropic.service.ts:78-116`; [`L4 §D`](../../../explorations/lejeune-bolt-agentic-demo/research/04-in-repo-capability-inventory.md#d-agent-runtime-mcp-and-memory) | Day-1 live proof and same-day fallbacks; provider runtime unverified |

## 5. Cross-links & provenance

- [Ratified brief](../../../explorations/lejeune-bolt-agentic-demo/BRIEF.md)
- [Ratified decisions](../../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md)
- [Decomposition map](../../../explorations/lejeune-bolt-agentic-demo/MAP.md)
- [Research synthesis](../../../explorations/lejeune-bolt-agentic-demo/RESEARCH.md)
- [Sibling lab goal](../../lejeune-knowledge-desk-lab/README.md)
