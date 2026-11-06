# Research Library Ontology and Gated 2-Hop Intake — Sources & Provenance

- **Cluster / origin:** a 2026-11-06 grill-with-docs session over the Nov-5
  research aggregation, the Box survey, and the October packet's records.
- **Provenance:** [`research-corpus-synthesis`](../../research-corpus-synthesis/README.md)
  (reflection, friction receipts, decisions);
  [`academia-corpus-mining`](../../academia-corpus-mining/README.md) (tier
  precedent); [`identity-as-iri`](../../identity-as-iri/README.md) (fold and
  IRI registry).

## 1. Mined source corpus

The corpora this packet will intake; none is mined yet. Out of repo by design.

| Source | Title | Location | Theme | Disposition |
| --- | --- | --- | --- | --- |
| `nov5-aggregation` | Research Aggregation November 5th 2026 (332 files, 835 URLs, 38 videos) | `<research-root>/Research Aggregation November 5th 2026/` (the operator research root under the home directory) | nightlies, videos, papers, link list, private DM archive | intake hop 0 |
| `box-nightlies` | 34 `beep-effect-nightly-*.md`, 2026-09-13 to 2026-11-05 | Box root folder `0` | Grok nightly reports | intake hop 0 (authoritative nightly series) |
| `box-ip-law-ontology` | `IP_LAW_ONTOLOGY_RESEARCH`, 449 PDFs | Box folder `386465627622` | legal ontologies, patent NLP | separate intake, T1 only |
| `box-spike-paper` | `arxiv-2610.01553v1-public-sample.pdf` | Box folder `427399570949` | paper | intake hop 0 |
| `library-intakes` | existing intakes `2026-10-06`, `2026-10-14` | `<research-root>/beep-effect/intakes/` | October corpus | migration replay fixture |

## 2. Upstream repositories & licenses

None vendored. Firecrawl is consumed as a hosted API through a repo driver.

## 3. External research sources

Standards and tools named in [`RESEARCH.md`](../RESEARCH.md) § External
landscape: PROV-O, CiTO, FaBiO, SKOS, DCAT (W3C and SPAR vocabularies), the
Neo4j Ontology Graph Specification (`OTHER_ALPHA.md` in the Nov-5 corpus),
alphaXiv MCP, VidBee Desktop MCP. URLs for the ontology specifications are
not reproduced here because they do not yet appear on disk in this packet's
research files; the intake will acquire them as hop-1 sources.

## 4. In-repo capability references

| Brick | Path | Use |
| --- | --- | --- |
| Research library command group | `packages/tooling/tool/cli/src/commands/Research/Library/` | extend |
| `@beep/ontology` fold and projections | `packages/foundation/modeling/ontology/src/Fold.{assembly,projections,models}.ts` | reuse |
| `@beep/identity` vocab registry | `packages/foundation/modeling/identity/src/{Vocab,Curie,Id}.ts` | reuse |
| `@beep/rdf` PROV, evidence, vocabularies | `packages/foundation/modeling/rdf/src/{Prov,ProvRdf,Evidence}.ts`, `Vocab/` | reuse; `Vocab/Dcat.ts` NET-NEW |
| `@beep/shacl` | `packages/drivers/shacl/src/Shacl.validation.ts` | reuse |
| `@beep/oxigraph`, `@beep/n3`, `@beep/rdf-canonize` | `packages/drivers/{oxigraph,n3,rdf-canonize}/` | reuse |
| `@beep/box` | `packages/drivers/box/src/Box.{service,streaming}.ts` | reuse as adapter |
| Firecrawl driver | `packages/drivers/firecrawl/` | NET-NEW |
| Runbook | `docs/runbooks/research-library.md` | update |

## 5. Cross-links & provenance

- This packet: [`RESEARCH.md`](../RESEARCH.md), [`DECISIONS.md`](../DECISIONS.md),
  [`BRIEF.md`](../BRIEF.md), [`MAP.md`](../MAP.md).
- Predecessor records acted on:
  [`2026-10-06-codex.md`](../../research-corpus-synthesis/history/reflections/2026-10-06-codex.md),
  [`OPPORTUNITIES.md`](../../research-corpus-synthesis/research/OPPORTUNITIES.md),
  [`DECISIONS.md`](../../research-corpus-synthesis/DECISIONS.md).
- Inbox item carried as context: "TTL→Effect-Schema codegen pipeline"
  (`explorations/INBOX.md`), the inverse projection direction.
