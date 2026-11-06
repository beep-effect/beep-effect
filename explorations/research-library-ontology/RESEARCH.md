# Research

<!--
Stage 1. What exists outside the repo (cited), and what exists inside it.
-->

## 2026-11-06

## What the October packet taught

Source: [reflection](../research-corpus-synthesis/history/reflections/2026-10-06-codex.md),
[friction receipts](../research-corpus-synthesis/research/OPPORTUNITIES.md),
[decisions](../research-corpus-synthesis/DECISIONS.md).

| Lesson recorded | Consequence for this packet |
| --- | --- |
| Web, docs and registry sources have no acquisition route; the Firecrawl route was removed and web is "scrape in session, `import-result`" ([runbook](../../docs/runbooks/research-library.md)) | 835 URLs at hop 1 alone cannot be hand-imported. A maintained web driver is a precondition, not a follow-up. |
| Reconciliation and hostile or partial responses cost more than URL extraction | Budget reconciliation as its own phase with its own denominator. |
| A validator change revalidated the whole library and demoted 68 valid captures | Separate whole-library migration from selected-source acquisition; version the validator contract. |
| X Search proves execution but omits post bodies (27 incomplete X sources) | Accept `incomplete` dispositions for X; do not spend the lane on 30 URLs. |
| "Preserve original denominators when discovery grows the collection" | Per-hop denominators (`hop0 read / hop0 total`, `hop1 ...`). |
| Package proof missed Fallow, jsdoc hook and test-policy gates | Run `yeet verify --tier cheap-gates` during CLI work. |
| `Library.service.ts` is a root resolver, not a `Context.Service`; the facade reaches internals via a star export (P2 debt) | Fix in the same slice that rewrites the models; both touch the same files. |
| Video decision D6: metadata, captions, transcripts; never archive video files | The 38 `.mkv` stay where they are; the library references them by hash. |
| Discovery expansion D3: gap-bound, not recursive | Hop 2 is gated, with depth as an edge property and the cutoff as policy. |

## External landscape

- **PROV-O** (W3C): Entity/Activity/Agent with `wasDerivedFrom`,
  `hadPrimarySource`, `wasAttributedTo`. Source identity, version/capture and
  immutable artifact are all `prov:Entity`; acquisition is `prov:Activity`;
  a model+effort pin is a `prov:SoftwareAgent`.
- **CiTO** (SPAR): typed citation properties (`citesAsEvidence`,
  `citesAsRelated`, `citesForInformation`, `disagreesWith`). The October
  finding triad assertion / observation / proposed-use maps onto CiTO
  subproperties instead of a bespoke enum.
- **FaBiO** (SPAR) and **schema.org**: `ScholarlyArticle`, `VideoObject`,
  `SoftwareSourceCode`, `WebPage` for the source-kind axis.
- **SKOS**: the topic scheme. Concepts are the repo's `goals/<slug>` and
  `explorations/<slug>` IRIs, so "relevant to beep-effect" is a `skos:related`
  edge to a live packet, not a prose judgement.
- **DCAT**: the library as a dataset with versioned distributions (intakes).
  Not yet in `@beep/rdf/Vocab`; the only vocabulary this packet adds.
- **Neo4j Ontology Graph Specification** (in `OTHER_ALPHA.md`): a competing
  AI-first ontology serialization; interop target at most, never storage.
- **alphaXiv MCP** (`api.alphaxiv.org/mcp/v1`, configured in the Claude
  user config): paper full text plus reference lists; reference lists are
  the cheap, typed hop 2 for the 213 arXiv URLs.
- **VidBee Desktop MCP** (`~/.local/libexec/vidbee-mcp/setup.sh --bridge`):
  persistent media tasks and transcripts; already produced the 45 FAQ files.
- **`/deep-research`** (Workflow harness): ~100 agents per run; three
  parallel runs trip the server rate limit and silently degrade verification
  (memory `deep-research-concurrency`). Sequential, per finding cluster.
- **`/adhd`**: used in October for the graduation portfolio
  (`ADHD-GRADUATION.md`); fits competency-question generation here.

## In-repo capability inventory

| Need | Brick | Status |
| --- | --- | --- |
| Library models, intake, acquisition, verify, render | `packages/tooling/tool/cli/src/commands/Research/Library/*` (19 role files, 8.5k lines; `Library.schemas.ts` holds `LibrarySourceKind`, `LibraryOwnership`, `LibraryCaptureStatus`, `LibraryQualificationStatus` as `LiteralKit`s and ~18 anonymous `S.Struct`s) | reuse, extend |
| IRI minting and vocab registry | `@beep/identity` (`Vocab.ts`, `Curie.ts`, `Id.ts`) | reuse |
| Ontology fold and projections | `@beep/ontology` `Fold.assembly.ts` (`fold`), `Fold.projections.ts` (`toTurtle`, `toJsonLd`), `AssembledOntology` | reuse |
| Vocabularies | `@beep/rdf/Vocab/{Prov,Cito,Fabio,Skos,Dcterms,SchemaOrg,Oa,Doco,Deo,Owl,Rdfs,Xsd}` | reuse; DCAT NET-NEW |
| PROV models | `@beep/rdf` `Prov.ts` (`Entity`, `Activity`, `Agent`, `SoftwareAgent`, `Plan`, `Collection`), `ProvRdf.ts` | reuse |
| Evidence anchors | `@beep/rdf` `Evidence.ts` (`TextQuoteSelector`, `TextPositionSelector`, `EvidenceAnchor`) | reuse for occurrence spans |
| SHACL validation | `@beep/shacl` (`ShaclValidationServiceLive`) | reuse |
| SPARQL store | `@beep/oxigraph` (`OxigraphSparqlQueryServiceLive`), `@beep/n3`, `@beep/rdf-canonize` | reuse |
| Box acquisition | `@beep/box` (`Box.service.ts`, `Box.streaming.ts`) | reuse as a library adapter |
| Web acquisition | none; `Library.web.ts` validates imported Firecrawl envelopes only | `drivers/firecrawl` NET-NEW |
| YouTube captions | `Library.youtube.ts` (yt-dlp native route, caption-API fallback import) | reuse; VidBee import NET-NEW |
| Mining tiers | `~/YeeBois/research/academia-2026-07/bin/{t1,t2,t3}-run.ts` (out of repo, packet-specific scripts) | precedent only; tiers become library commands |
| Repo CLI command topology | `standards/architecture/07-non-slice-families.md` §Repo CLI Command Topology; `goals/beep-cli-composition` (active; W0 done, library carve-out in flight) | doctrine; build in `commands/Research/Library`, let composition move it |

## Constraints discovered

- Doctrine drift: `Library.service.ts` must become the `Context.Service`
  contract and live layer (`<Group>.service.ts` role). Cleanup-on-touch.
- The graduated packet's accounting (143 files, 461 findings) is immutable;
  a third intake creates new denominators, never edits old ones.
- `Research-11-5-26/` is private: it may live in the out-of-repo library and
  be mined, but never enters the public repo or a shared alphaXiv folder.
- Firecrawl needs a key: `op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY`
  through the `op` shim; never in argv or logs.
- Box API quota is not visible in the console (memory
  `box-api-quota-not-visible-in-console`): the Box route checkpoints receipts
  per file.
- Volume pools (2026-11-06 `beep accounts`): Cursor 96% left; JetBrains AI
  cycle 5 of 10. Deep reads go to Junie first while credits remain, then
  Opus 5.5 children.
