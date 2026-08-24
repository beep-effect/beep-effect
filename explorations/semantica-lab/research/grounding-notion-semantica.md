## Page + schema

- **Entity/workspace:** `@beep/semantica`, page `[notion: page @beep/semantica]`, workspace **Todox**. Parent data source: **Development Todo’s** (`[notion: Development Todo’s data source]`), inside database **Projects**.
- **Timestamps visible through the read API:** page `createdTime` 2026-08-24T07:15:42Z; workspace-search timestamp 2026-08-24T09:03:00Z (the MCP labels this only `timestamp`, conventionally its last-edit/index time); fetch snapshot 2026-08-24T09:03:33.764Z.
- **Body:** opens with the hand-specific request for `apps/labs/semantica` / package `@beep/semantica`, a **Tauri** lab, vertical-slice migration intent, and the proposed `drivers`, `foundation/modeling`, `domain`, `tables`, `use-cases`, `server`, `client`, `ui` tree. The remainder inventories Semantica’s 27 modules in six layers, embeds 34 inline databases, and gives six Mermaid pipeline chains: Document→KG, GraphRAG, AI Agent, Compliance, Web Scraping→Graph, and Temporal Analysis.

| Property | Full schema | Value on `@beep/semantica` |
|---|---|---|
| Project name | `title` | `@beep/semantica` |
| Status | `status`; to-do: Parking Lot (red), Not started (default), Paused (orange), Parked (brown), Reference (gray); in-progress: In progress (blue), Active (yellow); complete: Done (green), Completed-retained (green), Graduated (purple), Superseded (gray); current/future groups empty | **Parking Lot** |
| AI summary | `text` | “Create a new Tauri app @beep/semantica with a modular vertical-slice architecture (drivers, foundation, domain, tables, use-cases, server, client, UI) mirroring Semantica’s 27 modules across six layers—input, core processing, storage, QA, context & memory, and output—providing pipelines for ingestion, parsing, normalization, semantic extraction, KG building, reasoning, storage, provenance, and orchestration, plus utilities for LLM providers, MCP server, seeding, evaluation, core utilities, and more.” |
| Assignee | `person`; description “Who’s responsible for the project?” | Benjamin Oppold (`[notion: project owner]`) |
| Start date | `date`, format `MM/DD/YYYY`; SQL expansions `date:Start date:start/end/is_datetime` | empty (`is_datetime` serialized as 0 in page fetch) |
| End date | `date`, format `MM/DD/YYYY`; SQL expansions `date:End date:start/end/is_datetime` | empty (`is_datetime` serialized as 0 in page fetch) |
| Start value | `number` | empty |
| End value | `number` | empty |
| Progress | `formula`; description “Calculated as start value divided by end value”; code URI `[notion: Progress formula code]`; excluded from SQL by Notion | Result represented only as `[notion: Progress formula result]`; actual display value is not exposed by this read endpoint; both inputs are empty |
| Summary | `text`; description “One-line manager summary of what this packet is for.” | empty |
| Priority | `select`: High (red), Medium (yellow), Low (green) | empty |
| Team | `multi_select`: Account Management (default), Business Development (blue), Product Design (green), Human Resources (purple), Goal (blue), Exploration (purple) | empty |
| Budget | `number`, dollar format | empty |
| Attach file | `file` | empty |

Query-only system columns are `url TEXT UNIQUE` and `createdTime TEXT`; they are not configurable Notion properties.

## Databases

All 33 feature catalogs use the same configurable schema: `name` **title**, `description` **text**, `link` **URL**; the SQL projection additionally exposes system `url TEXT UNIQUE` and `createdTime TEXT`. There are **no select options and no empty databases**. Across 213 rows, every `name` is filled and every `description`/`link` is empty.
### Ingest — Available Ingestors

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 23 | Representative 10: `FileIngestor`, `WebIngestor`, `RESTIngestor`, `DBIngestor`, `SnowflakeIngestor`, `EmailIngestor`, `MCPIngestor`, `RepoIngestor`, `StreamIngestor`, `HuggingFaceIngestor`. Remaining 13: `ParquetIngestor`, `XMLIngestor`, `DatabricksIngestor`, `PublicAPIIngestor`, `FeedIngestor`, `OntologyIngestor`, `ArrowIngestor`, `CloudStorageIngestor`, `DuckDBIngestor`, `ElasticIngestor`, `GDriveIngestor`, `MongoIngestor`, `PandasIngestor`. For every listed row: `description=∅`, `link=∅`. |
### Parse — Available Parsers

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 17 | Representative 10: `DocumentParser`, `DoclingParser`, `PDFParser`, `CodeParser`, `CSVParser`, `HTMLParser`, `ImageParser`, `MediaParser`, `StructuredDataParser`, `MCPParser`. Remaining 7: `DocxParser`, `EmailParser`, `ExcelParser`, `JSONParser`, `PPTXParser`, `WebParser`, `XMLParser`. For every listed row: `description=∅`, `link=∅`. |
### Split — Chunking Strategies

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 6 | All 6: `recursive`, `entity_aware`, `relation_aware`, `semantic_transformer`, `sliding_window`, `structural`. For every listed row: `description=∅`, `link=∅`. |
### Normalize — Normalizers

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 6 | All 6: `entity canonicalization`, `text cleaning`, `date normalization`, `encoding handling`, `number normalization`, `language detection`. For every listed row: `description=∅`, `link=∅`. |
### Semantic Extract — Extraction Methods

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 3 | All 3: `pattern`, `llm`, `ml`. For every listed row: `description=∅`, `link=∅`. |
### Semantic Extract — Additional Extractors

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `CoreferenceResolver`, `EventDetector`, `SemanticAnalyzer`, `SemanticNetworkExtractor`. For every listed row: `description=∅`, `link=∅`. |
### Knowledge Graph — Graph Algorithms

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 7 | All 7: `centrality calculation`, `community detection`, `connectivity analysis`, `entity resolution`, `link prediction`, `path finding`, `similarity calculation`. For every listed row: `description=∅`, `link=∅`. |
### Ontology — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 9 | All 9: `OntologyGenerator`, `LLMOntologyGenerator`, `OntologyValidator`, `SHACLGenerator`, `OntologyEvaluator`, `OWLGenerator`, `DomainOntologies`, `PropertyGenerator`, `NamespaceManager`. For every listed row: `description=∅`, `link=∅`. |
### Reasoning — Engines

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 6 | All 6: `forward chaining`, `Rete network`, `abductive`, `deductive`, `SPARQL`, `Datalog`. For every listed row: `description=∅`, `link=∅`. |
### Embeddings — Supported Models

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `Sentence-Transformers`, `FastEmbed`, `BGE`, `OpenAI`. For every listed row: `description=∅`, `link=∅`. |
### Embeddings — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 5 | All 5: `EmbeddingGenerator`, `TextEmbedder`, `VectorEmbeddingManager`, `GraphEmbeddingManager`, `PoolingStrategies`. For every listed row: `description=∅`, `link=∅`. |
### Vector Store — Backends

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 7 | All 7: `FAISS`, `Pinecone`, `Weaviate`, `Milvus`, `Qdrant`, `PgVector`, `in-memory`. For every listed row: `description=∅`, `link=∅`. |
### Vector Store — Search Modes

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 3 | All 3: `hybrid (vector + keyword)`, `semantic top-k`, `metadata-filtered`. For every listed row: `description=∅`, `link=∅`. |
### Graph Store — Backends

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `FalkorDB`, `Neo4j`, `Amazon Neptune`, `Apache AGE`. For every listed row: `description=∅`, `link=∅`. |
### Triplet Store — Backends

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `Oxigraph (embedded)`, `Apache Jena`, `Blazegraph`, `RDF4J`. For every listed row: `description=∅`, `link=∅`. |
### Deduplication — V2 Strategies

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 3 | All 3: `blocking_v2`, `hybrid_v2`, `semantic_v2`. For every listed row: `description=∅`, `link=∅`. |
### Deduplication — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 6 | All 6: `DuplicateDetector`, `EntityResolver`, `EntityMerger`, `SimilarityCalculator`, `ClusterBuilder`, `DuplicateDetector options (max_results, top_k_per_entity, min_similarity, sort_by)`. For every listed row: `description=∅`, `link=∅`. |
### Conflicts — Detection Types

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `type conflicts`, `value conflicts`, `logical conflicts`, `temporal conflicts`. For every listed row: `description=∅`, `link=∅`. |
### Conflicts — Resolution Strategies

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `prefer most recent`, `majority vote`, `prefer most reliable source`, `flag for manual review`. For every listed row: `description=∅`, `link=∅`. |
### Context — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 7 | All 7: `AgentContext`, `ContextGraph`, `AgentMemory`, `CausalAnalyzer`, `DecisionRecorder`, `EntityLinker`, `PolicyEngine`. For every listed row: `description=∅`, `link=∅`. |
### Provenance — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `ProvenanceManager`, `BridgeAxiom`, `IntegrityChecker`, `ProvenanceStorage`. For every listed row: `description=∅`, `link=∅`. |
### Change Management — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `TemporalVersionManager`, `ChangeLog`, `OntologyVersionManager`, `VersionStorage`. For every listed row: `description=∅`, `link=∅`. |
### Export — Export Formats

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 14 | All 14: `RDF`, `Turtle`, `JSON-LD`, `N-Triples`, `XML`, `ArangoDB`, `Parquet`, `AQL`, `CSV`, `Arrow`, `LPG`, `OWL`, `YAML`, `distance matrices`. For every listed row: `description=∅`, `link=∅`. |
### Visualization — Visualizers

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 6 | All 6: `KGVisualizer`, `OntologyVisualizer`, `EmbeddingVisualizer`, `SemanticNetworkVisualizer`, `AnalyticsVisualizer`, `TemporalVisualizer`. For every listed row: `description=∅`, `link=∅`. |
### Visualization — Layout Algorithms

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 3 | All 3: `force-directed`, `hierarchical`, `circular`. For every listed row: `description=∅`, `link=∅`. |
### Pipeline — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 7 | All 7: `FailureHandler`, `PipelineBuilder`, `ExecutionEngine`, `Pipeline`, `PipelineValidator`, `ParallelismManager`, `ResourceScheduler`. For every listed row: `description=∅`, `link=∅`. |
### Explorer — Routes

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 10 | All 10: `graph`, `ontology`, `provenance`, `decisions`, `analytics`, `SPARQL`, `temporal`, `annotations`, `export/import`, `vocabulary`. For every listed row: `description=∅`, `link=∅`. |
### LLM Providers — Supported Providers

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 8 | All 8: `Anthropic`, `OpenAI`, `Google Gemini`, `Grok`, `Ollama`, `DeepSeek`, `Novita AI`, `LiteLLM`. For every listed row: `description=∅`, `link=∅`. |
### MCP Server — Integrations

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 5 | All 5: `Claude Desktop`, `VS Code`, `Cline`, `Cursor`, `Windsurf`. For every listed row: `description=∅`, `link=∅`. |
### Seed — Use Cases

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 3 | All 3: `anchoring extraction with known entities`, `pre-populating ontology classes`, `deterministic test graph generation`. For every listed row: `description=∅`, `link=∅`. |
### Evals — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 4 | All 4: `KGEvaluator`, `ExtractionEvaluator`, `PipelineEvaluator`, `RegressionTracker`. For every listed row: `description=∅`, `link=∅`. |
### Core — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 6 | All 6: `PluginRegistry`, `Semantica`, `ConfigManager`, `HealthMonitor`, `LifecycleManager`, `Config`. For every listed row: `description=∅`, `link=∅`. |
### Utils — Components

| Schema | Count | Rows/property values |
|---|---:|---|
| `name TITLE; description TEXT; link URL` (plus system `url/createdTime TEXT`); no selects | 7 | All 7: `helpers`, `constants`, `validators`, `types`, `exceptions`, `logging`, `ProgressTracker`. For every listed row: `description=∅`, `link=∅`. |
## Module Index

Data source `[notion: Module Index data source]`; schema: `MODULE` **title**, `PURPOSE` **text**, `KEY CLASSES` **text** (plus system `url/createdTime TEXT`; no selects). **27 rows; all three configurable properties are filled on every row.** Row creation range: 2026-08-24T08:05:18Z–08:05:28Z.

| Count | All rows (`MODULE` — `PURPOSE` — `KEY CLASSES`) |
|---:|---|
| 27 | ingest — Data ingestion — FileIngestor, WebIngestor, ParquetIngestor, XMLIngestor<br>normalize — Data cleaning — TextNormalizer, EntityNormalizer, LanguageDetector<br>parse — Document parsing — DocumentParser, DoclingParser<br>semantic_extract — NER & relation extraction — NERExtractor, RelationExtractor, TripletExtractor, SemanticAnalyzer, SemanticNetworkExtractor, ExtractionValidator<br>split — Text chunking — TextSplitter<br>embeddings — Vector embeddings — EmbeddingGenerator<br>kg — Graph construction — GraphBuilder, TemporalGraphQuery, SimilarityCalculator<br>ontology — Schema management — OntologyGenerator, SHACLGenerator<br>reasoning — Logical inference — Reasoner, DatalogReasoner<br>vector_store — Vector database — VectorStore<br>graph_store — Graph database — GraphStore<br>triplet_store — RDF triple store — TripletStore<br>conflicts — Conflict resolution — ConflictDetector<br>context — Agent context & decisions — AgentContext, ContextGraph<br>deduplication — Entity resolution — EntityResolver, DuplicateDetector, ClusterBuilder, MergeStrategyManager<br>change_management — Version control — TemporalVersionManager<br>export — Data export — RDFExporter, ParquetExporter<br>pipeline — Workflow orchestration — Pipeline, PipelineBuilder<br>provenance — W3C PROV-O lineage — ProvenanceManager<br>visualization — Graph visualization — KGVisualizer<br>explorer — Knowledge Explorer UI — semantica-explorer --graph<br>evals — Quality evaluation — KGEvaluator, ExtractionEvaluator, PipelineEvaluator, RegressionTracker<br>llms — LLM providers — Groq, OpenAI, create_provider<br>mcp_server — MCP stdio server — python -m semantica.mcp_server<br>seed — KG bootstrapping from structured sources — SeedManager<br>core — Base classes & registry — Semantica, ConfigManager, PluginRegistry, LifecycleManager<br>utils — Shared utilities — helpers, validators |

## Row-page bodies

| Sampled row page | Database | Body |
|---|---|---|
| `FileIngestor` | Ingest | **Filled.** “File Ingestion Module” overview, feature hierarchy, and class design. The `FileObject` sketch uses Effect/TypeScript idioms: `S.String`, `S.Int`, `S.OptionFromOptionalKey`, `S.Uint8ArrayFromBase64`, `S.Record`, `SchemaUtils.withNoneDefault/withEmptyRecordDefault`, `DateTime.now`, and a TypeScript template-string warning. |
| `DocumentParser` | Parse | Blank |
| `OntologyGenerator` | Ontology | Blank |
| `FAISS` | Vector Store | Blank |
| `RDF` | Export | Blank |
| `AgentContext` | Context | Blank |
| `PipelineBuilder` | Pipeline | Blank |
| `Anthropic` | LLM Providers | Blank |
| `ingest`, `semantic_extract`, `explorer` | Module Index | All three blank |

Result: **1 filled and 10 blank** among 11 row pages opened across eight databases. This is a sample, not an assertion that every un-opened row body is blank; workspace searches for `Key Features`, `Classes`, `SchemaUtils`, `S.String`, and related implementation phrases found only `FileIngestor` as a content-bearing row.

## Sub-pages & comments

- The main body contains **no direct child-page blocks other than the 34 inline databases**. Its 27 `<mention-page>` links in Architecture Overview resolve to Module Index row pages (their ancestor is the Module Index data source), not separate non-database sub-pages.
- All other page-like descendants observed are rows owned by those inline databases.
- `get_comments` with child blocks and resolved discussions included returned `{}`: **no page comments, inline/block comments, or resolved discussions**.

## Editorial forensics

- **Likely hand-authored framing:** the opening build instruction (`apps/labs/semantica`, `@beep/semantica`, Tauri, vertical slice, migration to slices/foundation, and the beep directory tree) is project-specific and distinct from the product-documentation prose below it.
- **Likely imported/templated inventory:** the six-layer architecture, uniform one-sentence module summaries, feature-name catalogs, 27-row Module Index, Mermaid “Common Module Chains,” deployment/compliance examples, and precise product claims (`v0.5.0`, `0.004ms on 118k nodes`, “20+ models,” “12 MCP tools”) read like a structured condensation/import from Semantica documentation and source inventory.
- **Population pattern:** Module Index is fully populated (27/27 × 3 properties). Feature catalogs are broad but attribute-sparse: 213/213 titles, 0/213 descriptions, 0/213 links. The largest inventories are Ingest (23) and Parse (17); all others have 3–14 rows. No database is empty.
- **Decision tracking:** none of the 34 inline databases has author-added decision columns such as priority, port status, keep/drop, target beep package, checkbox, rating, owner, or notes. Their only columns are descriptive scaffolding. Generic project tracking exists only in the parent Development Todo’s schema; this page uses `Status=Parking Lot` and Assignee, while Priority, Team, dates, values/progress inputs, budget, summary, and attachment remain blank.
- **beep/Effect references:** the main page explicitly says `@beep/semantica`, `apps/labs/semantica`, Tauri, vertical slice, slices/foundation, and proposed beep-style layers. No catalog title/property value mentions beep-effect, existing beep packages, Effect, TypeScript, or Tauri. The sole sampled row body with such adaptation is `FileIngestor`, where Python/Semantica concepts are being translated into Effect Schema/TypeScript forms (`S.*`, `SchemaUtils`, `DateTime`).
- **Likely activity sequence:** page created 07:15Z; Module Index rows bulk-created 08:05Z; inline database shells indexed around 08:13Z; 213 catalog rows created sequentially 08:15–08:27Z; `FileIngestor` edited/indexed 08:42Z; Parse database 08:53Z; main page 09:03Z. This supports “scaffold an exhaustive migration/reference map, then begin a concrete Effect/TypeScript design spike at FileIngestor,” not a completed per-module port decision.
- **Author intent inference:** the page is presently an architecture-grounding and migration-planning artifact: comprehensive scope enumeration first, with one concrete row-level port sketch and no per-component prioritization/acceptance decisions yet.
