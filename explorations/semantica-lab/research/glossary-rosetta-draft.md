# Rosetta glossary — draft translations for the 36 `tbd` cells (2026-08-24)

Status: **DRAFT** — Fable proposals per the O-dispositions ("Rosetta `tbd` fill → Fable drafts
during shape, Benjamin ratifies"). Source rows: [`glossary-seed.md`](./glossary-seed.md).
Nothing here is written to the Notion Glossary—Rosetta database until ratified. Translations use
the shared-schema families (`research/shared-schema.md` v1.1) and the D13 charter split
(construction = this lab; consumption = `trustgraph-workbench`).

| Term | Proposed beep/Effect translation | Why |
| --- | --- | --- |
| Agent | agents-slice entity (`@beep/agents-domain`); the lab *produces* the graph an agent reads | Consumer side of D13; no lab counterpart in M1 |
| Context Graph | a named-graph partition over ledger `Statement`s + `ProvenanceEvent`s; a projection, not a store | Semantica treats it as a separate artifact; here it is a view keyed by provenance partition |
| Knowledge Graph (KG) | the ledger (`EvidenceBatch`/`Statement`/`ProvenanceEvent`) plus its derived projections (RDF, vector, graph tables) | "KG" names the projection family, never one engine (A1) |
| Semantic | n/a (adjective) — extraction that yields typed `Statement`s with spans rather than string matches | No schema; recorded so the term is not translated ad hoc |
| Chunking | `Chunk` family: `CanonicalText` ref + UTF-16 span; `Chunked` ProvenanceEvent; span-preserving `Stream` stage | Text is never divorced from its span (shared-schema law 2) |
| Ingestion | `SourceDocument` acquisition: tagged origin `LocalFile \| Url \| Fixture`, sha256 identity, `Ingested` event; brick `@beep/file-processing` | Content-addressed identity from the first byte |
| Abductive Reasoning | parked — would be an `InferenceEvent` with an abductive engine id and hypothesis rule kind | Not in G-entailment; no M1 counterpart |
| Datalog | rule kind inside the `PipelineStep`/rule schema; M1 runtime = RDFS-lite closure; NET-NEW certified-rules spike post-C2; EYE as test-time oracle | TS Datalog gap is a market gap (OPPORTUNITIES) |
| GraphRAG | consumption-side retrieval — `trustgraph-workbench` charter | D13 |
| Inference | `InferenceEvent`: conclusion `Statement` ref + rule id + premise refs + engine id + proof DAG as data | Semantica's single-step "explanation" is the anti-pattern |
| RAG | consumption-side — `trustgraph-workbench` charter | D13 |
| Temporal Graph | `Statement.validity` interval qualifier (valid time) + ledger commit time (transaction time); point-in-time = projection filter | Bitemporality falls out of an append-only ledger |
| Coreference Resolution | extraction sub-stage emitting `EvidenceClaim`s that bind several surface forms (spans) to one `Entity` | Parked for M1; G-entity tolerates unresolved mentions |
| Entity Resolution | cross-document identity merge as a `Deduplicated` ProvenanceEvent + `ConflictWitness`; never an in-place mutation | Ledger owns invalidation (B4) |
| Event Detection | `EvidenceClaim` kind `Event` — parked for M1 | G-entity covers persons/orgs/works/methods only |
| Named Entity Recognition (NER) | `Extractor` service emitting `EvidenceClaim`s with `Entity.types: HashSet<Iri>` + spans; bricks `@beep/langextract` (hosted) and `@beep/nlp-processing` Wink (pattern) under one gold probe | Extraction family verdict is one verdict (Current law) |
| Relationship Extraction | `EvidenceClaim` relation assertions → `Statement`s; G-relation gold | LangExtract relation-drop defect is the tripwire (B6) |
| Axiom | ontology-slice authority; in the lab an axiom is a rule value in the G-entailment suite | Shared spine (D13) |
| Class | `RdfTerm.Iri` drawn from the ontology slice's class vocabulary; `Entity.types` set | Plain strings never carry RDF meaning |
| Ontology | ontology slice (`@beep/ontology-domain`, consumed via `/public`); seeded ontology fixture in F1 | D13 shared spine |
| Ontology Hub | ≈ ontology slice `Session.workbench` UI; outside the lab charter | Explorer/UI deferred (D16) |
| OWL | parsed/served by ontology slice + `@beep/semantic-web`; M1 uses RDFS only, OWL profiles parked | Reasoning family scope |
| SKOS | vocabulary IRIs via `@beep/rdf`; SKOS hierarchy queries are part of G-entailment | Workload contract gold |
| Hybrid Search | consumption-side — `trustgraph-workbench`; C1 proves only exact vector query by dimension key | D13 |
| Centrality | graph analytics over derived graph tables via `effect/Graph`; parked for M1 | Consumption/analytics, not construction |
| Community Detection | same as Centrality — `effect/Graph` algorithm over derived tables; parked | D13 |
| Distance Intelligence | distance-band views over `EmbeddingVector` neighbourhoods; parked (workbench candidate) | Consumption |
| PageRank | `effect/Graph` algorithm over derived tables; parked | Consumption |
| Cypher | no counterpart; property-graph queries go through SQL over derived graph tables / `effect/Graph`; FalkorDB/Neo4j park under the envelope gate | D9 |
| SPARQL | RDF projection query via `packages/drivers/oxigraph` (rebuild-from-ledger per run); ontology slice `Session.sparql` for the spine | G defaults |
| Conflict Resolution | `ConflictWitness` typed node + adjudication policy as a typed projection (strict / defeasible / user-adjudicated); `ConflictResolved` event | ADHD synthesis 3; never a destructive merge |
| Deduplication | identity merge as a `Deduplicated` ProvenanceEvent with method identity recorded | Same ledger law as Entity Resolution |
| W3C PROV-O | derived projection of `ProvenanceEvent` (`@beep/provenance`), not the storage shape | Shared schema |
| SSRF | rubric gate 6: a typed ingest policy at the `Url` origin boundary; URL ingest is a no-go until it exists | BRIEF no-gos |
| XXE | rubric gate 6: bounded parsing with external entities disabled at the XML/HTML parser boundary (`@beep/html`) | Security posture |
| Pipeline | `PipelineStep` tagged step algebra (D16) interpreted by services; fiber concurrency per ready level; no raw callables | Semantica's "parallel" engine runs sequentially (D6) |
