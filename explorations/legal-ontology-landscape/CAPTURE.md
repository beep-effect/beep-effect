# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-08

Spark (verbatim intent from the kickoff prompt): find rdf/owl/ttl that can be
used to —

- inform ingestion into a knowledge graph
- perform reasoning or inference over the graph
- validate graph semantics
- provide rich semantic & domain knowledge to agents
- inform information management & file structures of systems of record & documents
- guide research and produce artifacts
- extract entities from emails, patent applications

P0 topics: project direction, ontologies, knowledge graphs, structured linked
data extraction informed by ontologies, legal DMS (ontologies for file metadata
à la EXIF, PDFs, DOCX; ontology for organizing legal information — custom or
existing).

Seed vocabularies already in hand (see `@beep/rdf` Vocab modules and the
external effect-ontology constants pasted in the kickoff): RDF, RDFS, OWL,
PROV-O, DCTERMS, XSD, SKOS, schema.org, plus an `EXTR` extraction-metadata
namespace (confidence, usedModel, ontologyVersion, sourceChunk,
extractionMethod).

Seed links from the kickoff prompt:

- FOLIO API: https://openlegalstandard.org/resources/folio-api/
- FOLIO MCP: https://openlegalstandard.org/resources/folio-mcp/
- LKIF-core: https://github.com/RinkeHoekstra/lkif-core/tree/master
- Box metadata taxonomies: https://support.box.com/hc/en-us/articles/47190277168275-Metadata-Taxonomies
- Box folder-structure planning: https://docs.box.com/en/box-fundamentals/for-admins/getting-started/plan-your-folder-structure

Seed corpus: `research/00-source-brief.md` — a curated six-layer source brief
for a Palantir-style IP-law ontology (Palantir paradigm, formal ontology
engineering, legal core ontologies, IP-specific ontologies/RELs, doctrinal
primary sources, LPG↔RDF bridges).

Execution constraints captured at kickoff: all exploration/research/fetching
delegated to codex sub-agents using the firecrawl CLI (preserve Claude limits);
Claude orchestrates and synthesizes. Aimed at the Aug 5 oip-web first-user
metric; research artifacts land in this packet; fetched third-party ontology
files stay gitignored under `assets/vendor/` (public repo — manifest + fetch
script are the committed record).

Grilling decisions of 2026-07-08 (full log to land in DECISIONS.md when the
align stage opens): deliverable = cited reports + machine-readable asset pack;
scope = IP-law practice DMS (doctrine + practice layer); graph stack = open
research question under the graph-is-projection doctrine; depth = standard
(one research + one asset-fetch codex agent per phase, final verification
pass); home = this packet; cadence = single-session run.

## 2026-07-08 — user-found legal ontology candidates (mid-P0 drop)

Additional candidates found by the user; P2 must evaluate each (several are
not in the seed brief):

- LKIF-Core — "principled ontology development for the legal domain" (go-to
  upper/core legal ontology; already in seed brief)
- IPROnto — digital-rights-management ontology (IP/DRM-focused; in seed brief)
- PrOnto — privacy ontology for legal compliance/reasoning (GDPR; in seed brief)
- UFO-L — core ontology of legal concepts on the UFO foundational ontology
  (in seed brief)
- FOLaw & LRI-Core — two classic core ontologies for law, compared
  head-to-head (NEW — not in seed brief)
- NEURONA — data-protection ontology (NEW)
- ALIS IP — IP ontology merging legal and technical perspectives (NEW)
- Carneades — argumentation / case-law modeling (NEW)
- DSAP — Data Sharing Agreement privacy ontology (NEW)
