# Semantica glossary seed

`Datalog` appears twice in the source glossary; the row below consolidates both definitions.

| Term | Semantica definition (1 line, condensed from source, cite file) | Kind (concept\|module\|artifact\|process) | Rosetta: beep/Effect translation | Module Index link candidate |
| --- | --- | --- | --- | --- |
| Agent | Autonomous AI system that perceives, reasons, and acts toward goals; Semantica gives it graph memory and records decisions. (`docs/glossary.md:16`) | concept | tbd | [context](https://docs.getsemantica.ai/reference/context) |
| Context Graph | Persistent queryable graph of an agent's entities, relationships, decisions, and causal links. (`docs/glossary.md:19`) | artifact | tbd | [context](https://docs.getsemantica.ai/reference/context) |
| Decision | Recorded agent choice with category, scenario, reasoning, outcome, confidence, causal chain, and provenance. (`docs/glossary.md:22`) | artifact | tagged decision schema | [context](https://docs.getsemantica.ai/reference/context) |
| Entity | Real-world object or concept represented as a graph node with typed properties and provenance. (`docs/glossary.md:25`) | concept | entity schema | [kg](https://docs.getsemantica.ai/reference/kg) |
| Knowledge Graph (KG) | Knowledge represented as entity nodes and relationship edges for querying, reasoning, search, and traceable inference. (`docs/glossary.md:28`) | artifact | tbd | [kg](https://docs.getsemantica.ai/reference/kg) |
| Relationship | Directed typed connection between entities, with confidence and source provenance. (`docs/glossary.md:31`) | concept | relationship schema | [kg](https://docs.getsemantica.ai/reference/kg) |
| Semantic | Concerned with meaning and intent rather than keyword matching alone. (`docs/glossary.md:34`) | concept | tbd | [semantic_extract](https://docs.getsemantica.ai/reference/semantic_extract) |
| Chunking | Splitting documents into smaller pieces while preserving semantic context. (`docs/glossary.md:40`) | process | tbd | [split](https://docs.getsemantica.ai/reference/split) |
| Ingestion | Loading external data into a pipeline as unified `SourceDocument` values. (`docs/glossary.md:43`) | process | tbd | [ingest](https://docs.getsemantica.ai/reference/ingest) |
| Normalization | Converting data into canonical forms and removing noise before extraction. (`docs/glossary.md:46`) | process | schema transformation | [normalize](https://docs.getsemantica.ai/reference/normalize) |
| Parsing | Extracting text, layout, and metadata from unstructured or semi-structured documents. (`docs/glossary.md:49`) | process | schema decode at document boundary | [parse](https://docs.getsemantica.ai/reference/parse) |
| Abductive Reasoning | Inferring the most plausible explanation for observed facts. (`docs/glossary.md:55`) | process | tbd | [reasoning](https://docs.getsemantica.ai/reference/reasoning) |
| Datalog | Declarative deductive query language; Semantica evaluates recursive Horn clauses with bottom-up semi-naive fixpoint semantics. (`docs/glossary.md:58,181`) | concept | tbd | [reasoning](https://docs.getsemantica.ai/reference/reasoning) |
| GraphRAG (Graph-Augmented Retrieval Augmented Generation) | RAG combining vector similarity with graph traversal so generated claims can trace to source nodes. (`docs/glossary.md:61`) | process | tbd | [context](https://docs.getsemantica.ai/reference/context) |
| Inference | Deriving facts or conclusions from existing knowledge and rules when sources do not state them directly. (`docs/glossary.md:64`) | process | tbd | [reasoning](https://docs.getsemantica.ai/reference/reasoning) |
| LLM (Large Language Model) | Model trained on large text corpora to understand and generate natural language. (`docs/glossary.md:67`) | concept | service contract with provider Layers | [llms](https://docs.getsemantica.ai/reference/llms) |
| RAG (Retrieval Augmented Generation) | Retrieving relevant knowledge-base context before an LLM generates a response. (`docs/glossary.md:70`) | process | tbd | [context](https://docs.getsemantica.ai/reference/context) |
| Allen Interval Algebra | Thirteen relations describing how two time intervals relate. (`docs/glossary.md:76`) | concept | literal relation domain | [kg](https://docs.getsemantica.ai/reference/kg) |
| BiTemporalFact | Fact carrying valid time and transaction time for audit and historical reconstruction. (`docs/glossary.md:79`) | artifact | schema with valid-time and transaction-time fields | [kg](https://docs.getsemantica.ai/reference/kg) |
| Edge | Directed graph connection representing a typed relationship with confidence and provenance. (`docs/glossary.md:82`) | artifact | edge schema | [kg](https://docs.getsemantica.ai/reference/kg) |
| Node | Graph vertex representing an entity or concept with typed properties, confidence, and provenance. (`docs/glossary.md:85`) | artifact | node schema | [kg](https://docs.getsemantica.ai/reference/kg) |
| Property | Attribute of an entity or relationship, such as a name, date, URI, confidence, or source URL. (`docs/glossary.md:88`) | concept | schema field | [kg](https://docs.getsemantica.ai/reference/kg) |
| Temporal Graph | Graph whose nodes and edges have validity windows for point-in-time queries and historical reconstruction. (`docs/glossary.md:91`) | artifact | tbd | [kg](https://docs.getsemantica.ai/reference/kg) |
| Triplet | Atomic `(subject, predicate, object)` unit used by RDF and SPARQL storage. (`docs/glossary.md:94`) | artifact | readonly tuple or struct schema | [triplet_store](https://docs.getsemantica.ai/reference/triplet_store) |
| Coreference Resolution | Detecting when different expressions in text denote the same entity. (`docs/glossary.md:100`) | process | tbd | [semantic_extract](https://docs.getsemantica.ai/reference/semantic_extract) |
| Entity Resolution | Detecting when mentions across documents denote the same real-world entity. (`docs/glossary.md:103`) | process | tbd | [deduplication](https://docs.getsemantica.ai/reference/deduplication) |
| Event Detection | Identifying and classifying events described in text. (`docs/glossary.md:106`) | process | tbd | [semantic_extract](https://docs.getsemantica.ai/reference/semantic_extract) |
| Named Entity Recognition (NER) | Identifying named entities in text and assigning predefined or custom categories. (`docs/glossary.md:109`) | process | tbd | [semantic_extract](https://docs.getsemantica.ai/reference/semantic_extract) |
| Relationship Extraction | Extracting typed semantic relationships between entities from raw text. (`docs/glossary.md:112`) | process | tbd | [semantic_extract](https://docs.getsemantica.ai/reference/semantic_extract) |
| Axiom | Statement accepted as true to define an ontology's logical constraints. (`docs/glossary.md:118`) | concept | tbd | [ontology](https://docs.getsemantica.ai/reference/ontology) |
| Class | Ontology category for entities, arranged in a hierarchy and constrained by SHACL. (`docs/glossary.md:121`) | concept | tbd | [ontology](https://docs.getsemantica.ai/reference/ontology) |
| Ontology | Formal specification of domain concepts, relationships, and constraints, commonly expressed in OWL. (`docs/glossary.md:124`) | artifact | tbd | [ontology](https://docs.getsemantica.ai/reference/ontology) |
| Ontology Hub | Visual UI for editing classes and alignments, authoring SHACL, checking health, and viewing versioned diffs. (`docs/glossary.md:127`) | module | tbd | [explorer](https://docs.getsemantica.ai/reference/explorer) |
| OWL (Web Ontology Language) | W3C language for defining and instantiating ontologies. (`docs/glossary.md:130`) | concept | tbd | [ontology](https://docs.getsemantica.ai/reference/ontology) |
| SHACL (Shapes Constraint Language) | W3C language for validating RDF graphs against shape constraints. (`docs/glossary.md:133`) | concept | schema validation | [ontology](https://docs.getsemantica.ai/reference/ontology) |
| SKOS (Simple Knowledge Organization System) | W3C standard for controlled vocabularies, taxonomies, and thesauri. (`docs/glossary.md:136`) | concept | tbd | [ontology](https://docs.getsemantica.ai/reference/ontology) |
| Embedding | Dense numeric vector representing data in a semantic space where similar meanings are nearby. (`docs/glossary.md:142`) | artifact | embedding schema | [embeddings](https://docs.getsemantica.ai/reference/embeddings) |
| Graph Database | Database optimized for graph data represented as nodes and edges. (`docs/glossary.md:145`) | concept | Layer-backed graph-store service | [graph_store](https://docs.getsemantica.ai/reference/graph_store) |
| Hybrid Search | Retrieval combining vector similarity with keyword or metadata filtering. (`docs/glossary.md:148`) | process | tbd | [vector_store](https://docs.getsemantica.ai/reference/vector_store) |
| Triplet Store | Database for RDF subject-predicate-object triples and SPARQL queries. (`docs/glossary.md:151`) | module | Layer-backed triplet-store service | [triplet_store](https://docs.getsemantica.ai/reference/triplet_store) |
| Vector Store | Database for storing and similarity-searching high-dimensional embedding vectors. (`docs/glossary.md:154`) | module | Layer-backed vector-store service | [vector_store](https://docs.getsemantica.ai/reference/vector_store) |
| Centrality | Measure of a node's graph importance, including PageRank, betweenness, and closeness. (`docs/glossary.md:160`) | concept | tbd | [kg](https://docs.getsemantica.ai/reference/kg) |
| Community Detection | Finding node groups with denser internal than external connections. (`docs/glossary.md:163`) | process | tbd | [kg](https://docs.getsemantica.ai/reference/kg) |
| Distance Band | `near`, `mid`, or `far` classification derived from embedding-distance thresholds. (`docs/glossary.md:166`) | artifact | literal domain schema | [kg](https://docs.getsemantica.ai/reference/kg) |
| Distance Intelligence | Semantic-neighborhood analysis using distance matrices, ego views, and distance bands. (`docs/glossary.md:169`) | module | tbd | [kg](https://docs.getsemantica.ai/reference/kg) |
| PageRank | Algorithm scoring node importance from incoming-link structure. (`docs/glossary.md:172`) | process | tbd | [kg](https://docs.getsemantica.ai/reference/kg) |
| Cypher | Declarative query language for graph databases such as Neo4j and FalkorDB. (`docs/glossary.md:178`) | concept | tbd | [graph_store](https://docs.getsemantica.ai/reference/graph_store) |
| RDF (Resource Description Framework) | W3C standard for representing information as subject-predicate-object triples. (`docs/glossary.md:184`) | concept | triplet schema | [triplet_store](https://docs.getsemantica.ai/reference/triplet_store) |
| SPARQL | W3C query language for RDF data, also used for query-based inference. (`docs/glossary.md:187`) | concept | tbd | [triplet_store](https://docs.getsemantica.ai/reference/triplet_store) |
| Conflict Resolution | Detecting contradictory graph facts and applying a configured resolution strategy or flagging review. (`docs/glossary.md:193`) | process | tbd | [conflicts](https://docs.getsemantica.ai/reference/conflicts) |
| Data Provenance | Origin, history, and lineage of a fact, including source, extraction method, timestamp, and confidence. (`docs/glossary.md:196`) | concept | append-only provenance event schema | [provenance](https://docs.getsemantica.ai/reference/provenance) |
| Deduplication | Identifying and merging duplicate entity records. (`docs/glossary.md:199`) | process | tbd | [deduplication](https://docs.getsemantica.ai/reference/deduplication) |
| W3C PROV-O | W3C ontology for interoperable provenance and lineage representation. (`docs/glossary.md:202`) | concept | tbd | [provenance](https://docs.getsemantica.ai/reference/provenance) |
| SSRF (Server-Side Request Forgery) | Vulnerability that induces a server to request an unintended destination. (`docs/glossary.md:208`) | concept | tbd | [llms](https://docs.getsemantica.ai/reference/llms) |
| XXE (XML External Entity) | XML parser vulnerability that can expose files or trigger SSRF through external entities. (`docs/glossary.md:211`) | concept | tbd | [ingest](https://docs.getsemantica.ai/reference/ingest) |
| SourceDocument | Unified document value emitted by ingestors for downstream pipeline stages. (`docs/modules.md:31`) | artifact | source-document schema | [ingest](https://docs.getsemantica.ai/reference/ingest) |
| Pipeline | Serializable DSL for reproducible workflows with validation, parallel workers, retries, and failure handling. (`docs/reference/pipeline.md:2-14`) | module | tbd | [pipeline](https://docs.getsemantica.ai/reference/pipeline) |
| Pipeline step | Named handler node wired into a pipeline sequence and governed by a per-step failure strategy. (`docs/reference/pipeline.md:8-22,43`) | artifact | tagged step schema | [pipeline](https://docs.getsemantica.ai/reference/pipeline) |
| Plugin registry | Registry that associates custom components with names for use across modules. (`docs/modules.md:489-501`) | module | Layer composition | [core](https://docs.getsemantica.ai/reference/core) |
| Method registry | Registry that associates a method category and name with custom domain logic. (`docs/reference/deduplication.md:360-372`; `docs/reference/normalize.md:572-579`) | module | Layer composition / service contract | [core](https://docs.getsemantica.ai/reference/core) |
| ProvenanceEntry | Single lineage record containing entity, activity, source, confidence, checksum, and related metadata. (`docs/reference/provenance.md:21`) | artifact | append-only provenance event schema | [provenance](https://docs.getsemantica.ai/reference/provenance) |

## Source files

- `~/YeeBois/workstation-apps/semantica/docs/glossary.md`
- `~/YeeBois/workstation-apps/semantica/docs/modules.md`
- `~/YeeBois/workstation-apps/semantica/docs/reference/pipeline.md`
- `~/YeeBois/workstation-apps/semantica/docs/reference/deduplication.md`
- `~/YeeBois/workstation-apps/semantica/docs/reference/normalize.md`
- `~/YeeBois/workstation-apps/semantica/docs/reference/provenance.md`
