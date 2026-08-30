# Knowledge graphs for TypeScript monorepos: the definitive guide to grounding AI agents in code structure

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

**A compiler-accurate knowledge graph built from TypeScript's own type system is the single most effective architecture for eliminating AI code hallucinations in large monorepos.** The approach works because code — unlike natural language — has deterministic, parseable structure that knowledge graphs can capture precisely, giving AI agents verified facts about every function, type, import, and dependency instead of forcing them to guess. Research shows **32.8% improvement in bug-fix resolve rates** (RepoGraph, 2024) and **36.36% pass@1 on repository-level generation** (KG-CodeGen, ICSE 2025) when graph-structured context replaces naive vector search. Yet remarkably, only a handful of tools — Greptile, Potpie AI, and FalkorDB's Code Graph — actually build knowledge graphs from codebases today. Every major AI coding assistant (Cursor, Copilot, Claude Code, Codex) still relies on vector similarity or brute-force context windows. This represents both a significant technical opportunity and a validated market gap.

This report synthesizes findings across 100+ sources — academic papers, open-source projects, commercial tools, and production architectures — to provide a complete blueprint for building a TypeScript monorepo knowledge graph system that dramatically reduces LLM hallucinations across code generation, review, debugging, documentation, and migration tasks.

---

## The code property graph is the proven foundation

The **Joern Code Property Graph (CPG)** specification, introduced by Fabian Yamaguchi in 2013 and now supporting TypeScript, remains the most mature formal schema for representing code as graphs. It merges three classical representations into a single labeled property graph: the Abstract Syntax Tree (AST) for syntactic structure, the Control Flow Graph (CFG) for execution paths, and the Program Dependence Graph (PDG) for data and control dependencies. This unified representation is defined formally as a "directed, edge-labeled, attributed multigraph" with nodes carrying key-value attributes and multiple edge types between the same node pair.

For TypeScript monorepos specifically, the recommended schema extends the CPG with **TypeScript-specific type system nodes**. The core node types include `Package`, `Module`, `Class`, `Interface`, `Function`, `TypeAlias`, `Variable`, `Enum`, and `Decorator`, while edge types capture `IMPORTS`, `CALLS`, `EXTENDS`, `IMPLEMENTS`, `TYPE_OF`, `DEPENDS_ON`, `CONTAINS`, `RETURNS`, `OVERRIDES`, and `DATA_FLOW`. TypeScript's structural type system introduces unique modeling challenges:

- **Union and intersection types** require composite type nodes with `UNION_MEMBER` or `INTERSECTION_MEMBER` edges to constituent types
- **Generics** need `TypeParameter` nodes with `CONSTRAINS` edges and `TYPE_ARGUMENT` edges on instantiations
- **Conditional types** (`T extends U ? X : Y`) become `ConditionalType` nodes with `EXTENDS_CHECK`, `TRUE_BRANCH`, and `FALSE_BRANCH` edges
- **Mapped types** and **template literal types** each require dedicated node types with ordered relationship edges
- **Declaration merging** uses `MERGES_WITH` edges connecting multiple declaration nodes to a merged result
- **Module resolution** tracks `PATH_ALIAS` nodes from `tsconfig.json` and `WORKSPACE_REF` edges for monorepo packages

**Property graphs beat RDF/OWL for code.** While CodeOntology (University of Cagliari) demonstrated OWL 2 ontologies for Java codebases with SPARQL querying, the triple-based representation creates verbose models and performs poorly on multi-hop traversals critical for call chain analysis. Labeled property graphs in Neo4j or Memgraph naturally map relationships as first-class citizens with properties (e.g., a `CALLS` edge carrying `argumentCount` and `isConditional`), and Cypher's pattern-matching syntax maps intuitively to code navigation patterns like `MATCH (f:Function)-[:CALLS]->(g:Function) WHERE f.module = 'auth'`.

For **temporal/versioned knowledge graphs** tracking codebase evolution, TerminusDB provides native Git-like revision control with commits, diffs, branching, and time-travel queries — architecturally mirroring how code changes in Git. The alternative is Graphiti (by Zep, 4K+ GitHub stars), a temporal knowledge graph framework supporting incremental updates without full recomputation, with an MCP server for Claude integration.

---

## The optimal extraction pipeline combines tree-sitter speed with TypeScript Compiler API precision

The critical architectural decision in graph construction is the parsing layer. After evaluating four approaches — tree-sitter, TypeScript Compiler API, ts-morph, and LSP — the evidence strongly favors a **hybrid two-phase architecture**:

**Phase 1 uses tree-sitter for fast structural parsing.** The `tree-sitter-typescript` grammar parses files in milliseconds with true incremental parsing via `tree.edit()`, extracting file structure, imports/exports, and declaration outlines. It handles multi-language codebases and provides the speed needed for real-time file-watching scenarios. However, tree-sitter is purely syntactic — it cannot resolve types, follow imports across files, or determine generic instantiations.

**Phase 2 uses ts-morph (or raw TypeScript Compiler API) for semantic extraction.** ts-morph wraps the TypeScript Compiler API with a developer-friendly interface that provides full type resolution via `TypeChecker`, cross-file symbol resolution, call signature extraction, and heritage clause traversal. Aide.dev reports **~99% accuracy for TypeScript** using ts-morph in production for their code graph. Key extraction patterns include:

```typescript
// Extract call edges with ts-morph-morph
block.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
  const symbol = callExpr.getExpression().getSymbol();
  const declarations = symbol?.getAliasedSymbol()?.getDeclarations();
  // Resolve to target file and qualified name for graph edge
});
```

**SCIP (Sourcegraph's Source Code Intelligence Protocol)** deserves special attention as a third extraction source. The `scip-typescript` indexer produces compiler-accurate definition/reference data at **1K-5K lines/second**, generates indexes **4-5x smaller** than LSIF, and supports `--pnpm-workspaces` and `--yarn-workspaces` flags natively. Meta integrated SCIP with their Glean system and found it "8x smaller, 3x faster" than LSIF. SCIP extracts fully-qualified symbol strings, occurrence ranges, hover documentation, and implementation relationships — but focuses on navigation rather than full knowledge graph relationships, so post-processing is needed for call graphs and type hierarchies.

For **incremental graph updates** in large monorepos, the most practical approach combines git-diff-based file identification with selective re-extraction:

1. File change detected (via chokidar watcher or `git diff --name-only`)
2. Identify affected scope: changed files + their 1-hop import dependents
3. Re-extract entities and relationships from affected files only using ts-morph
4. Diff against existing graph — add/remove/update nodes and edges via Cypher `MERGE`
5. Propagate transitive changes if type signatures changed

Nx's 2024 batch mode for TypeScript (`@nx/js:tsc`) represents the state-of-the-art for incremental monorepo builds, creating TypeScript project references on-the-fly from the Nx project graph with **1.16x to 7.73x speedup** over non-batch mode. The `nx sync` command auto-syncs project references, and `nx affected` uses git diff + project graph to identify impacted packages — a pattern directly applicable to incremental knowledge graph updates.

---

## Graph-structured context reduces hallucinations where vector search fails

The evidence for knowledge graphs reducing LLM hallucinations is now substantial. Agrawal et al.'s NAACL 2024 survey ("Can Knowledge Graphs Reduce Hallucinations in LLMs?") categorizes KG-based augmentation into three validated approaches: **knowledge-aware inference** (augmenting retrieval at query time), **knowledge-aware learning** (fine-tuning with KG-derived data), and **knowledge-aware validation** (post-generation fact-checking against KGs).

For code specifically, the **CodeHalu taxonomy** (AAAI 2025) identifies four hallucination types across 17 LLMs with an average hallucination rate of ~2.04%: mapping hallucinations (incorrect NL-to-code logic), **naming hallucinations** (fabricated function names and API calls), **resource hallucinations** (references to non-existent libraries or imports), and logical hallucinations (incorrect control flow). Knowledge graphs directly address naming and resource hallucinations — which account for a significant portion of failures — by grounding generated code against verified entities. De-Hallucinator (Eghbali & Pradel, 2024) demonstrates that iterative grounding against project-specific APIs improves edit distance by **23-51%** and API recall by **24-61%**.

The critical advantage of graphs over vector search for code is structural reasoning:

| Capability | Vector search | Graph search |
|---|---|---|
| Find similar functions | ✅ Good | ✅ Good |
| Find all callers of function X | ❌ Cannot | ✅ Traversal |
| Trace dependency chain A→B→C | ❌ Cannot | ✅ Path query |
| What types does function X use? | ❌ Unreliable | ✅ Edge traversal |
| Find all tests for module Y | ❌ Unreliable | ✅ Relationship query |

Three systems demonstrate this concretely. **RepoGraph** (2024, submitted to ICLR 2025) uses k-hop ego-graph retrieval centered on search terms at line-level granularity, achieving a **32.8% average relative improvement** on SWE-bench resolve rates when plugged into existing frameworks. **CodexGraph** (NAACL 2025) enables LLM agents to generate Cypher queries against code graph databases, achieving Pass@1 of 22.96% on SWE-bench Lite with GPT-4o. **KG-CodeGen** (ICSE 2025 LLM4Code Workshop) combines full-text indexes on names with vector indexes on documentation in Neo4j, reaching **pass@1 of 36.36%** with Claude-3.5 Sonnet on EvoCodeBench.

Microsoft's **GraphRAG** (20K+ GitHub stars) introduced community-based hierarchical summarization using the Leiden algorithm, showing 70-80% win rate over naive RAG on comprehensiveness. However, GraphRAG was designed for narrative text, not code. Its LLM-based entity extraction is wasteful for code where compilers can parse deterministically. The recommended approach: **build code-specific knowledge graphs using AST parsing and static analysis, then borrow GraphRAG's community detection and hierarchical summarization** for high-level codebase understanding (module clusters, architecture summaries).

For injecting graph context into LLM prompts, research on graph linearization (Xypolopoulos et al., 2024) shows that ordering edges by graph degeneracy and starting from highest-degree nodes improves LLM comprehension. The practical format for code graphs is structured pseudo-schema:

```
Function: processPayment(order: Order) → PaymentResult
  - Defined in: packages/billing/src/payment.ts
  - Called by: handleCheckout(), retryFailedPayment()
  - Uses types: Order, PaymentResult, PaymentGateway
  - Tests: test_processPayment_success(), test_processPayment_declined()
```

---

## Only a handful of tools actually build code knowledge graphs today

The market landscape reveals a striking gap: **most AI coding assistants use vector similarity, not structural understanding**. Cursor stores embeddings in Turbopuffer with Merkle tree-based incremental re-indexing. GitHub Copilot relies on surrounding file context and LLM training data. Claude Code explores file systems agentically with large context windows. Aider creates a tree-sitter-based "repo map" — a lightweight precursor to knowledge graphs but without graph storage or traversal.

**Sourcegraph Cody** is the closest major tool to using structural code graphs, leveraging SCIP-derived symbol definitions and cross-repo references alongside keyword and semantic search. SCIP remains the **gold standard for code intelligence extraction** — compiler-accurate, TypeScript-native, open-source, and proven at Meta's scale.

The companies and projects explicitly building code knowledge graphs:

- **Potpie AI** (potpie.ai, Apache 2.0, $2.2M raised 2025): Converts git repos into knowledge graphs using Neo4j. Parses functions, classes, APIs, dependencies, and call chains. First-class TypeScript support. Pre-built agents for debugging, testing, code review. The closest existing open-source project to the envisioned system.
- **Greptile** (Y Combinator, 2K+ organizations including NVIDIA and Stripe): Builds complete code graphs of functions, variables, classes, and their connections. Uses the graph for multi-hop investigation during PR review. ~90% cache hit rates.
- **FalkorDB Code Graph**: Purpose-built code knowledge graph tool using FalkorDB's ultra-fast graph database. Supports dependency mapping, debugging path tracing, and documentation generation.
- **Code-Graph-RAG** (github.com/vitali87/code-graph-rag, 1.9K stars): Open-source RAG system using tree-sitter + Memgraph + UniXcoder embeddings. Works as MCP server with Claude Code. Supports 11 languages including TypeScript.

For code analysis tools applicable to graph construction, **Joern** provides the most complete Code Property Graph implementation with TypeScript support via its JSSRC frontend (tree-sitter based, no compilation required). **CodeQL** offers first-class TypeScript support with full data flow analysis but requires CodeQL database creation and is designed for security queries rather than general graph extraction. **Semgrep** is purely AST pattern matching — useful for linting but not graph construction.

Among graph databases, **Neo4j** has the largest ecosystem and most code-specific implementations (Potpie, graph-code, CodeGraph all target it). **Memgraph** offers **10x faster writes** than Neo4j for in-memory workloads, Cypher compatibility, and is used by Code-Graph-RAG. Memgraph v3.0 (February 2025) added native GraphRAG and vector search support. For a TypeScript monorepo generating an estimated **5-15 million nodes and 20-60 million edges** at 100K files, either database handles the scale comfortably — Memgraph for real-time development scenarios, Neo4j for enterprise durability and tooling ecosystem.

---

## The research frontier points toward type-aware graph representations

Several 2024-2025 papers define the cutting edge. **LambdaNet** (ICLR 2020) is the most directly relevant to TypeScript — it introduces a GNN-based type inference system using type dependency graphs with hyperedges, specifically designed for TypeScript programs. **Typilus** (PLDI 2020) pioneered GNN-based type inference using graph representations combining syntax, data flow, and naming patterns, achieving 70% coverage at 95% type-check accuracy. **TyFlow** (2025, arXiv 2510.10216) goes further, internalizing type reasoning within code generation by maintaining isomorphism between type derivation trees and synthesis derivation trees — **eliminating type errors entirely** while improving functional correctness.

**GraphCodeBERT** (ICLR 2021) proved that incorporating data flow edges ("where-the-value-comes-from" between variables) into pre-training significantly improves code search, clone detection, and translation tasks. The "Unveiling Code Pre-Trained Models" study (ACM TOSEM, 2024) confirmed that current code models excel at syntax but have significant gaps in semantic understanding — exactly the gaps a knowledge graph fills.

For repository-level code generation, **CodeRAG** (2025, arXiv 2504.10046) constructs requirement graphs and dependency-semantic code graphs, achieving **+35.57 points on Pass@1** over baselines. **Code Graph Model (CGM)** (2025) pre-trains on repository-level code graphs with a full RAG pipeline (Rewriter, Retriever, Reranker, Reader). **KGCompass** (2025, arXiv 2503.21710) uses repository-aware knowledge graphs for enhanced bug localization, achieving new state-of-the-art on SWE-bench Lite through multi-location context via graph traversal.

The comprehensive survey by Tao et al. (2025, arXiv 2510.04905), reviewing 579 papers on retrieval-augmented code generation from 2023-2025, identifies graph-based methods as a "promising paradigm" — the field is converging on the approach this report recommends.

---

## A concrete architecture and phased implementation plan

The recommended end-to-end architecture has five layers:

**Source Layer** → File system watcher / Git hooks detect changes in the TypeScript monorepo.

**Parsing Layer** → Tree-sitter for fast structural pre-pass; ts-morph + TypeScript `TypeChecker` for semantic extraction; optionally SCIP for compiler-accurate symbol resolution. These run in parallel: tree-sitter identifies changed file structure, ts-morph resolves types and cross-file references.

**Graph Construction Layer** → Node builder (dedup via `MERGE` semantics), edge builder (resolve references across packages), incremental differ (update only changed subgraph). Batch size of 5,000-10,000 records per transaction.

**Storage Layer** → Memgraph (primary, for real-time performance) or Neo4j (enterprise, for durability and tooling). Vector index alongside the graph for hybrid semantic+structural search using UniXcoder embeddings. Cache layer for frequently-accessed subgraphs (LRU, <100MB).

**Query Layer** → MCP server exposing tools for AI agents (`find_symbol`, `find_references`, `get_dependencies`, `analyze_impact`, `get_context`), REST/GraphQL API for dashboards, and natural language → Cypher translation via LLM for ad-hoc queries.

The MCP server should expose these core tools:

- `find_symbol(name, kind?)` — Look up any function, class, type, or variable
- `find_references(symbolId, maxDepth?)` — Callers, usages, and reverse dependencies
- `get_dependencies(fileOrPackage, direction, maxDepth?)` — Import/dependency graph traversal
- `get_context(focus, radius, maxTokens?)` — k-hop ego-graph retrieval with token budget enforcement
- `analyze_impact(changedFiles[])` — Affected files, tests, and risk score

For CI/CD integration, a three-tier update strategy keeps the graph fresh without blocking developers: **Tier 1** (IDE/file watcher) provides real-time incremental updates debounced to 1-2 seconds; **Tier 2** (CI pipeline on push/PR) runs git-diff-based incremental updates; **Tier 3** (weekly scheduled) performs full graph rebuilds for consistency verification.

### Phased MVP roadmap

**Phase 1 (2-4 weeks):** Parse TypeScript files with the Compiler API. Extract functions, classes, interfaces, imports/exports. Build `CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS` edges. Store in Memgraph. Basic MCP server with `find_symbol`, `find_references`, `get_dependencies`. Value: cross-file navigation and import graph visualization.

**Phase 2 (4-8 weeks):** Add type resolution via TypeChecker — generics, union/intersection types, conditional types. Build `EXTENDS`, `IMPLEMENTS`, `TYPE_OF` edges. Add incremental updates via file watcher and CI pipeline. Add vector embeddings for semantic search. Value: type-aware navigation, impact analysis, semantic code search.

**Phase 3 (8-16 weeks):** Package-based partitioning for monorepo scale. Data flow analysis. Advanced MCP tools (`analyze_impact`, `get_architecture`). GraphRAG-style community detection and hierarchical summaries for architecture-level understanding. Precomputed analytics (unused exports, circular dependencies, complexity metrics). Value: full architecture-level code intelligence for AI agents.

---

## Key GitHub repositories and tools to build on

| Repository | Purpose | Relevance |
|---|---|---|
| `sourcegraph/scip` + `scip-typescript` | Compiler-accurate symbol extraction | Data extraction layer |
| `potpie-ai/potpie` | Neo4j-based code KG with AI agents | Architecture reference |
| `vitali87/code-graph-rag` | Memgraph + tree-sitter + MCP server | Production reference |
| `microsoft/graphrag` | Community detection + summarization | Retrieval patterns |
| `joernio/joern` | Code Property Graph specification | Schema reference |
| `dsherret/ts-morph` | TypeScript Compiler API wrapper | Primary extraction tool |
| `ozyyshr/RepoGraph` | k-hop ego-graph for SWE-bench | Retrieval strategy |
| `getzep/graphiti` | Temporal knowledge graph + MCP | Versioned graph layer |
| `ChrisRoyse/CodeGraph` | Two-pass code analysis + Neo4j MCP | Implementation reference |
| `ysk8hori/typescript-graph` | TS dependency visualization CLI | Lightweight starting point |

---

## Conclusion: the structural grounding thesis is validated but underexploited

The convergence of evidence across academic research, production systems, and market dynamics points to a clear conclusion: **deterministic code knowledge graphs built from compiler-accurate static analysis are fundamentally superior to vector-based retrieval for grounding AI agent outputs in large codebases**. The 32.8% improvement from RepoGraph, the 35.57-point Pass@1 gain from CodeRAG, and De-Hallucinator's 23-51% edit distance improvement are not incremental — they represent a qualitative shift in AI code generation reliability.

The market opportunity is substantial because the gap between what's technically validated and what's commercially deployed is wide. No company has productized TypeScript-specific knowledge-graph-based hallucination reduction. Qodo's 2025 research shows 76% of developers experience frequent hallucinations, yet every major coding assistant still treats code as flat text for retrieval purposes.

The most novel insight from this research is that **TypeScript's type system itself serves as a formal specification layer within the graph**. Unlike dynamically-typed languages, TypeScript's compiler already maintains a complete semantic model of every type relationship, generic instantiation, and structural compatibility in the codebase. A knowledge graph that faithfully captures this information — using the TypeScript Compiler API's `TypeChecker` rather than approximating with tree-sitter or embeddings — provides AI agents with the same verified understanding that the compiler has. TyFlow (2025) demonstrated that internalizing type reasoning eliminates type errors entirely; a type-enriched code knowledge graph achieves a similar effect through grounded context rather than model architecture changes, making it applicable to any LLM without fine-tuning.

The recommended starting point is pragmatic: extend an existing open-source foundation (Code-Graph-RAG or Potpie) with TypeScript Compiler API-based semantic extraction via ts-morph, store in Memgraph for real-time performance, expose via MCP server, and validate against SWE-bench using the RepoGraph or CodexGraph evaluation methodology. Phase 1 delivers measurable value in 2-4 weeks; the full system at Phase 3 represents a genuine competitive moat in the rapidly evolving AI coding landscape.
