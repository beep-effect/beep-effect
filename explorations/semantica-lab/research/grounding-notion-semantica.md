## Page + schema

- **Entity/workspace:** `@beep/semantica`, page `3c669573-788d-8001-82c3-e19b0cf3b58c`, workspace **Todox**. Parent data source: **Development Todo’s** (`collection://35a69573-788d-815c-b731-000b77bd0fa3`), inside database **Projects**.
- **Timestamps visible through the read API:** page `createdTime` 2026-08-24T07:15:42Z; workspace-search timestamp 2026-08-24T09:03:00Z (the MCP labels this only `timestamp`, conventionally its last-edit/index time); fetch snapshot 2026-08-24T09:03:33.764Z.
- **Body:** opens with the hand-specific request for `apps/labs/semantica` / package `@beep/semantica`, a **Tauri** lab, vertical-slice migration intent, and the proposed `drivers`, `foundation/modeling`, `domain`, `tables`, `use-cases`, `server`, `client`, `ui` tree. The remainder inventories Semantica’s 27 modules in six layers, embeds 34 inline databases, and gives six Mermaid pipeline chains: Document→KG, GraphRAG, AI Agent, Compliance, Web Scraping→Graph, and Temporal Analysis.

| Property | Full schema | Value on `@beep/semantica` |
|---|---|---|
| Project name | `title` | `@beep/semantica` |
| Status | `status`; to-do: Parking Lot (red), Not started (default), Paused (orange), Parked (brown), Reference (gray); in-progress: In progress (blue), Active (yellow); complete: Done (green), Completed-retained (green), Graduated (purple), Superseded (gray); current/future groups empty | **Parking Lot** |
| AI summary | `text` | “Create a new Tauri app @beep/semantica with a modular vertical-slice architecture (drivers, foundation, domain, tables, use-cases, server, client, UI) mirroring Semantica’s 27 modules across six layers—input, core processing, storage, QA, context & memory, and output—providing pipelines for ingestion, parsing, normalization, semantic extraction, KG building, reasoning, storage, provenance, and orchestration, plus utilities for LLM providers, MCP server, seeding, evaluation, core utilities, and more.” |
| Assignee | `person`; description “Who’s responsible for the project?” | Benjamin Oppold (`user://d90cec28-5042-458d-80a8-548bbc1f616b`) |
| Start date | `date`, format `MM/DD/YYYY`; SQL expansions `date:Start date:start/end/is_datetime` | empty (`is_datetime` serialized as 0 in page fetch) |
| End date | `date`, format `MM/DD/YYYY`; SQL expansions `date:End date:start/end/is_datetime` | empty (`is_datetime` serialized as 0 in page fetch) |
| Start value | `number` | empty |
| End value | `number` | empty |
| Progress | `formula`; description “Calculated as start value divided by end value”; code URI `formulaCode://35a69573-788d-815c-b731-000b77bd0fa3/S35tYA`; excluded from SQL by Notion | Result represented only as `formulaResult://35a69573-788d-815c-b731-000b77bd0fa3/3c669573-788d-8001-82c3-e19b0cf3b58c/S35tYA`; actual display value is not exposed by this read endpoint; both inputs are empty |
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

Data source `collection://950326ad-44c1-409b-9483-7f2e22a2a2e8`; schema: `MODULE` **title**, `PURPOSE` **text**, `KEY CLASSES` **text** (plus system `url/createdTime TEXT`; no selects). **27 rows; all three configurable properties are filled on every row.** Row creation range: 2026-08-24T08:05:18Z–08:05:28Z.

| Count | All rows (`MODULE` — `PURPOSE` — `KEY CLASSES`) |
|---:|---|
| 27 | [ingest](https://app.notion.com/afd439171fa7455c941b235ca60dc052) — Data ingestion — FileIngestor, WebIngestor, ParquetIngestor, XMLIngestor<br>[normalize](https://app.notion.com/3ac6474446fc44a7baf83a06f95056b4) — Data cleaning — TextNormalizer, EntityNormalizer, LanguageDetector<br>[parse](https://app.notion.com/ca6efaa850ce4da8807ef959ce1c0f0b) — Document parsing — DocumentParser, DoclingParser<br>[semantic_extract](https://app.notion.com/0e78837304274a91a0fca60702d59ca3) — NER & relation extraction — NERExtractor, RelationExtractor, TripletExtractor, SemanticAnalyzer, SemanticNetworkExtractor, ExtractionValidator<br>[split](https://app.notion.com/ac92c83791dd47f3a1db6d4076a6610a) — Text chunking — TextSplitter<br>[embeddings](https://app.notion.com/2fba4456f02c41f0aa856d07b51ee6b8) — Vector embeddings — EmbeddingGenerator<br>[kg](https://app.notion.com/cad71b3561d447c594820c3d89f79093) — Graph construction — GraphBuilder, TemporalGraphQuery, SimilarityCalculator<br>[ontology](https://app.notion.com/1d4638cc9999493faf7154357ec964b2) — Schema management — OntologyGenerator, SHACLGenerator<br>[reasoning](https://app.notion.com/831a4c31e38e4bacbffc1b8fcf3b2870) — Logical inference — Reasoner, DatalogReasoner<br>[vector_store](https://app.notion.com/97540bd06a3d46a8b5c3cc961f8d26c5) — Vector database — VectorStore<br>[graph_store](https://app.notion.com/dfb988e917bf4d1b89efd6578c0b64f2) — Graph database — GraphStore<br>[triplet_store](https://app.notion.com/e13e6b8e52144347beffb0b9302108f1) — RDF triple store — TripletStore<br>[conflicts](https://app.notion.com/912c2e220ea14416affe31c033c17a5d) — Conflict resolution — ConflictDetector<br>[context](https://app.notion.com/ff241e84303f468f8cdf77625e3cfb00) — Agent context & decisions — AgentContext, ContextGraph<br>[deduplication](https://app.notion.com/57d16cebaf14439bace69fae1c98f6c8) — Entity resolution — EntityResolver, DuplicateDetector, ClusterBuilder, MergeStrategyManager<br>[change_management](https://app.notion.com/c9c5b2e6f2a34b4a9680c64a6540ecf2) — Version control — TemporalVersionManager<br>[export](https://app.notion.com/5c72c1757d40449cb923151ef8271e60) — Data export — RDFExporter, ParquetExporter<br>[pipeline](https://app.notion.com/f9ca4507aefe4c0c91921b79bb4ab548) — Workflow orchestration — Pipeline, PipelineBuilder<br>[provenance](https://app.notion.com/fe9191f36ec042748f977c1cdd5e9ffc) — W3C PROV-O lineage — ProvenanceManager<br>[visualization](https://app.notion.com/959a8e44808b483692adf317c0ba4029) — Graph visualization — KGVisualizer<br>[explorer](https://app.notion.com/25e8532cc4c34993accac100004c739a) — Knowledge Explorer UI — semantica-explorer --graph<br>[evals](https://app.notion.com/ba3ba7d5a81143bbb6ef149eea96c227) — Quality evaluation — KGEvaluator, ExtractionEvaluator, PipelineEvaluator, RegressionTracker<br>[llms](https://app.notion.com/f3260c91aa534babaa7a272a19053cc1) — LLM providers — Groq, OpenAI, create_provider<br>[mcp_server](https://app.notion.com/c55362bba3384bdc9dafeda9a9ad248a) — MCP stdio server — python -m semantica.mcp_server<br>[seed](https://app.notion.com/fcacbb57ddca4cfdb08c8417d6677e0c) — KG bootstrapping from structured sources — SeedManager<br>[core](https://app.notion.com/f9c3c4ce1aa4490eb884eae270c32657) — Base classes & registry — Semantica, ConfigManager, PluginRegistry, LifecycleManager<br>[utils](https://app.notion.com/be2deda1a06446c2b2d50d845f4e180d) — Shared utilities — helpers, validators |

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
