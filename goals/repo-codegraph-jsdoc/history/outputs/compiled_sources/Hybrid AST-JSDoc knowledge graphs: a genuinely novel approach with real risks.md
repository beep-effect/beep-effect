# Hybrid AST-JSDoc knowledge graphs: a genuinely novel approach with real risks

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

**The combination of deterministic AST code property graphs enriched with JSDoc-derived semantic metadata is genuinely novel — no existing tool or published system treats documentation tags as first-class, queryable graph properties.** This matters because every current code intelligence tool falls into one of two camps (embedding-based or structural-graph), and neither captures developer-authored domain intent. The approach has strong theoretical backing: Google DeepMind's LIMIT paper proved fundamental retrieval limits of single-vector embeddings, and a 2024 structured code representations study showed deterministic structures consistently outperform base models by ≥5 CodeBLEU points. The key risk isn't technical feasibility — it's JSDoc coverage discipline. The system should be designed as progressive enhancement: valuable with zero JSDoc (pure AST graph), better with partial coverage, and exceptional with comprehensive semantic tags.

## Nobody has combined code property graphs with documentation-derived metadata

An exhaustive search of academic literature, open-source projects, and commercial tools reveals a clear gap. The foundational Code Property Graph work (Yamaguchi et al., IEEE S&P 2014; Joern) merges ASTs, control flow, and data flow graphs — but models only structural relationships. **IBM Research's GraphGen4Code (2020-2021) comes closest** to the hypothesis: it builds knowledge graphs combining data flow analysis with docstring extraction, producing 2+ billion triples across 1.3M Python files. But GraphGen4Code treats documentation as linked text blobs, not decomposed structured tags. It cannot answer "find all functions in @category 'auth' that call @category 'database' functions" because `@category` is not a queryable property.

The Semantic Code Graph (Borowski et al., IEEE Access 2023), Fraunhofer AISEC's CPG extensions, and SemanticForge (2025) all extend structural analysis but never touch documentation metadata. The dominant 2023-2026 research trend enriches code graphs with **LLM-inferred embeddings** — Vul-LMGNN adds pre-trained language model features to CPG nodes; LogicLens generates function summaries via LLM. No paper explicitly advocates for deterministic, documentation-derived semantic labels as an alternative. This positioning — that author-written JSDoc tags are ground truth, not probabilistic inference — represents an identifiable gap in both literature and tooling.

## The tool landscape splits cleanly, with nothing in the middle

Current code intelligence tools occupy two distinct architectural camps, and the proposed approach would be the first to bridge them systematically:

**Embedding-first tools** (Cursor, Copilot, Continue.dev) treat code as text. Cursor chunks code via tree-sitter, embeds it, and stores vectors in Turbopuffer. Copilot uses a proprietary code-optimized transformer with contrastive learning. Continue.dev embeds chunks in LanceDB. None understand structural relationships like call graphs, inheritance chains, or module boundaries — and critically, **none parse JSDoc tags as structured metadata**. Comments are simply embedded alongside code text, losing their categorical signal.

**Graph-first tools** (Potpie AI, Code-Graph-RAG, FalkorDB Code Graph) build structural knowledge graphs. Potpie uses Neo4j with AST-extracted nodes for functions, classes, and their relationships. Code-Graph-RAG combines tree-sitter parsing with Memgraph and optional UniXcoder embeddings. FalkorDB's own Code Graph project parses repos into property graphs. These tools capture structure accurately but **ignore documentation semantics entirely** — docstrings are at best stored as raw text properties, never decomposed into queryable tag fields.

Greptile offers an interesting data point: it found that embedding LLM-generated natural language descriptions of code retrieves **12% better** than embedding raw code. This validates the core premise — semantic descriptions of code are more retrievable than code itself — but Greptile generates these descriptions via LLM rather than extracting existing developer-written ones.

**Augment Code** deserves special attention. It uses "semantic dependency graphs" tracking architectural boundaries across 400K+ files and claims **40% fewer hallucinations** than embedding-only approaches, with a 70.6% SWE-bench score versus Copilot's 54%. This provides the strongest commercial evidence that structural+semantic hybrid approaches outperform pure embeddings for code tasks. However, Augment Code's semantic layer is inferred, not documentation-derived.

## Graphiti is best as a memory layer, not the primary code graph

Graphiti's temporal knowledge graph model has elegant properties for tracking code evolution. Its **bi-temporal timestamp system** (four timestamps per edge: `created_at`, `expired_at`, `valid_at`, `invalid_at`) maps naturally to code lifecycle — `valid_at` for when a function was introduced, `invalid_at` for deprecation, `expired_at` for when a newer parse superseded the data. Custom entity types via Pydantic models could theoretically model JSDoc metadata:

```python
class TSFunction(BaseModel):
    category: str | None = Field(None, description="@category tag value")
    module_path: str | None = Field(None, description="@module tag value")
    since_version: str | None = Field(None, description="@since version")
```

However, **Graphiti is fundamentally mismatched for primary code graph construction** for three reasons. First, it requires LLM API calls for entity extraction, relationship extraction, and edge invalidation during every episode ingestion — processing thousands of functions means thousands of expensive, slow API calls for work that deterministic AST parsing accomplishes perfectly. Second, its entity resolution is semantic/fuzzy, while code entities have precise identifiers (fully qualified names, file paths) where simple string matching is both faster and more accurate. Third, there's an open issue (#567) where custom entity labels and properties don't fully persist to the database.

**The recommended architecture is a two-layer approach**: use FalkorDB directly (via its Cypher interface) for the deterministic AST+JSDoc code graph, and optionally use Graphiti's MCP server as a separate memory layer for AI agent interactions — tracking developer conversations, design decisions, and evolving context about the codebase. This gives agents both precise code knowledge (FalkorDB) and conversational memory (Graphiti) without forcing code data through Graphiti's LLM-dependent pipeline.

## FalkorDB handles this hybrid model exceptionally well

FalkorDB's property graph model with OpenCypher queries is a natural fit. Nodes carry both structural properties (name, file path, line numbers, export status) and JSDoc-derived semantic properties (category, module, since version, description) as first-class key-value pairs. The query that motivates the entire approach — "find all functions in @category 'auth' that call functions in @category 'database'" — is a single Cypher statement:

```cypher
MATCH (f:Function {category: 'auth'})-[:CALLS]->(g:Function {category: 'database'})
RETURN f.name AS authFunction, g.name AS dbFunction, f.filePath
```

Cross-category dependency analysis, version-based impact queries (`WHERE f.since >= '2.0.0'`), unused export detection, and multi-hop call chain tracing are all native graph traversal operations. FalkorDB's **three index types** — range indexes for property filters, full-text search (TF-IDF with stemming) for description queries, and HNSW vector indexes for optional embedding-based similarity — mean the hybrid graph supports deterministic, text, and probabilistic queries from a single store.

Performance is more than adequate. FalkorDB benchmarks show **P99 latency under 83ms** (500× faster than Neo4j at P99) using GraphBLAS sparse adjacency matrices with AVX acceleration. A typical TypeScript monorepo graph of 50K nodes and 200K edges would require approximately 1-2GB RAM — well within FalkorDB's operating range. The existing FalkorDB Code Graph project confirms the database handles AST-scale code graphs in production.

## ts-morph is sufficient for production TypeScript code property graphs

For a TypeScript-only codebase, **ts-morph alone provides everything needed** without tree-sitter. It wraps the full TypeScript compiler API, giving access to complete type resolution, cross-file symbol resolution, call graph construction, and — critically — **first-class JSDoc extraction**. The `getJsDocs()` → `getTags()` → `getTagName()`/`getCommentText()` API chain extracts any JSDoc tag, including custom tags like `@category`, `@module`, and `@since`, as structured data already associated with the correct AST node.

Two production systems validate this. **Aide.dev** uses ts-morph to build code graphs with `getDescendantsOfKind(SyntaxKind.CallExpression)` plus `symbol.getAliasedSymbol()` for cross-file call resolution, claiming "near perfect code-graphs which work for almost 99% of cases." **CodeGraph Analyzer** uses ts-morph with Neo4j, extracting IMPORTS, EXPORTS, CALLS, EXTENDS, IMPLEMENTS, and HAS_METHOD relationships via a two-pass approach (build ASTs first, resolve cross-file relationships second).

The primary limitation is **performance**: initial TypeScript compiler program initialization takes 5-30 seconds for 1000+ files, and there's no incremental parsing. For watch-mode scenarios, a layered architecture works: tree-sitter for fast change detection (~5ms per file), queuing changed files for ts-morph enrichment (~200ms per file) asynchronously. But for batch graph construction and CI/CD integration, ts-morph's speed is acceptable. The bus-factor risk (single maintainer: dsherret) is mitigated by ts-morph being a convenience wrapper — the underlying TypeScript compiler API is maintained by Microsoft.

The JSDoc ecosystem supports the enforcement side well. **eslint-plugin-jsdoc** provides `structuredTags` configuration for custom tag schemas, `require-jsdoc` for coverage enforcement, and `check-tag-names` for tag whitelisting. **TSDoc** (Microsoft/Rush Stack) provides a rigorous grammar specification for TypeScript doc comments with explicit extensibility for custom tags. **TypeDoc** can export structured JSON containing full reflection data with all JSDoc tags preserved. The tooling to validate, enforce, and extract structured JSDoc metadata is mature.

## The deterministic advantage is theoretically well-supported

The "ground truth semantic labels" argument has strong backing. **DeepMind's LIMIT paper (August 2025)** proved fundamental theoretical limitations of single-vector embedding retrieval: for any embedding dimension d, there exist relevance patterns that cannot be represented. SOTA embedding models achieve less than 20% recall@100 on LIMIT benchmarks despite seemingly simple tasks. This is an architectural limitation, not a training data problem — queries requiring multiple orthogonal constraints (e.g., "async functions in the auth category that handle Redis connections") get compressed into a single point that cannot simultaneously satisfy all dimensions.

A 2024 study on structured code representations found that **structured models always outperform base counterparts**, with fine-tuning on just 100 structured examples exceeding base model performance on 1,800+ unstructured examples. The effect is most pronounced in low-data scenarios — exactly the regime where monorepo-specific domain context matters most. Multiple surveys (NAACL 2024, ACL 2025 SRW) confirm that knowledge graph integration during LLM inference significantly reduces hallucination and enhances reasoning.

The practical implication: a query like "find all payment processing functions" against a codebase where developers have tagged functions with `@category 'payments'` will return **100% precise, 100% recall results** through a simple property filter — something no embedding model can guarantee. The graph then provides full structural context (what these functions call, what calls them, their type signatures, their module boundaries) that further grounds the LLM's understanding.

## Real risks that require architectural mitigation

**JSDoc coverage is the critical vulnerability.** No published studies give definitive coverage percentages, but industry consensus suggests public APIs may have 50-80% JSDoc coverage while internal code often sits below 20%. The system must be designed so that **zero JSDoc coverage still delivers value** through the pure structural graph (imports, calls, inheritance, type references). Each additional JSDoc tag enriches the graph but should never be required. A progressive model: structural graph → + descriptions → + @param/@returns → + @category/@module → + custom domain tags.

**Stale documentation actively harms** when tags feed into LLM context. If a function tagged `@category 'payments'` was refactored to handle authentication, the graph provides misleading context. Mitigation requires CI/CD integration: run graph construction on every PR, diff graph changes against code changes, and flag "structural change without tag review" as a warning. Tools like Swimm and DocuMate provide patterns for documentation drift detection.

**Tag schema evolution** presents a real operational challenge. Renaming `@category 'auth'` to `@category 'authentication'` requires updating potentially hundreds of files. The graph construction pipeline should support schema migrations — maintaining an alias table where `'auth'` maps to `'authentication'` during transition periods. eslint-plugin-jsdoc's `match-name` rule can enforce allowed values via regex.

**Graph synchronization** is a solved problem architecturally. Code-Graph-RAG's realtime updater, CodePrism's O(k) incremental indexer, and Code Grapher's git-diff-based updates all demonstrate viable patterns. For the proposed system, the most practical approach is CI/CD-triggered full rebuild (leveraging FalkorDB's speed — rebuilding a 50K-node graph takes seconds) supplemented by file-watcher-triggered incremental updates during development.

## Honest assessment: significant but not revolutionary

This approach occupies a **genuinely novel position** in the solution space. No existing tool, paper, or commercial product specifically treats JSDoc tags as first-class queryable graph properties combined with AST structural analysis. The theoretical foundation is strong (DeepMind LIMIT paper, structured representations research, KG hallucination reduction surveys). The infrastructure is proven (FalkorDB, ts-morph, Graphiti MCP, eslint-plugin-jsdoc).

However, the honest calibration is **"significant advancement with important caveats"** rather than "paradigm shift." The graph-plus-embeddings hybrid architecture is not new — Code-Graph-RAG, Code Grapher, and Augment Code all combine structural and semantic approaches. The specific novelty is the **JSDoc semantic layer**, and its value is directly proportional to tag coverage and quality. In a well-documented enterprise TypeScript monorepo with enforced JSDoc standards, this approach could meaningfully reduce hallucinations for AI coding agents. In a typical open-source project with sparse documentation, the JSDoc layer provides minimal additional value over pure structural graphs.

The strongest competitive positioning: frame this as a **"codified context" system** — the graph doesn't just index code structure, it indexes developer knowledge *about* the code (domain categorization, architectural intent, version boundaries, business logic descriptions) that exists nowhere in the syntax itself. This is precisely the information embeddings cannot reliably infer and the information most likely to prevent hallucination in large, complex codebases. The key differentiator isn't the graph database or the AST parser — it's the insight that structured documentation tags, when validated and enforced, constitute a deterministic semantic layer that no amount of embedding training can replicate.
