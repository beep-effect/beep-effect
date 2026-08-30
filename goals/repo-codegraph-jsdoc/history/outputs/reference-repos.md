# Git Subtree Reference Repositories for Hybrid AST-JSDoc Knowledge Graph

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

A prioritized guide to open-source codebases worth cloning as git subtrees for your coding agents (Claude & Codex) to reference when building the hybrid AST-JSDoc knowledge graph system for beep-effect.

---

## Tier 1: Critical — Clone These First

These repos are directly on the critical path. Your agents will reference them constantly during implementation.

### 1. `ts-morph` — Your Primary AST Engine
- **Repo:** `https://github.com/dsherret/ts-morph`
- **Language:** TypeScript
- **Stars:** ~6K | **Weekly npm downloads:** ~2.9M
- **Why it's critical:** This is the backbone of your entire extraction pipeline. It wraps the TypeScript Compiler API and provides first-class JSDoc extraction via `getJsDocs()` → `getTags()` → `getTagName()`/`getCommentText()`. Your agents need to understand its internal structure to correctly build the AST walker, resolve cross-file symbols, and extract structured JSDoc metadata.
- **Key directories to study:**
  - `packages/ts-morph/src/compiler/ast/doc/` — JSDoc node wrappers (JSDoc, JSDocTag, JSDocParameterTag, etc.)
  - `packages/ts-morph/src/compiler/ast/module/` — Import/export declaration handling
  - `packages/ts-morph/src/compiler/ast/class/` — Class, method, property extraction
  - `packages/ts-morph/src/compiler/ast/function/` — Function declaration handling
  - `packages/ts-morph/src/compiler/symbols/` — Symbol resolution (critical for cross-file call graphs)
- **Subtree path suggestion:** `refs/ts-morph`

### 2. `falkordb-ts` — Your Graph Database Client
- **Repo:** `https://github.com/FalkorDB/falkordb-ts`
- **Language:** TypeScript
- **Why it's critical:** This is the official FalkorDB TypeScript client you'll use to write Cypher queries, create nodes/edges, and manage indexes. Your agents need to understand the Graph, QueryResult, and connection pooling APIs to correctly construct the graph ingestion pipeline.
- **Key files:**
  - `src/graph.ts` — Core Graph class with `query()`, `roQuery()`, `delete()`, `profile()`
  - `src/client.ts` — Connection management, cluster support
  - `src/query-result.ts` — Result parsing (how Cypher results map to JS objects)
- **Subtree path suggestion:** `refs/falkordb-ts`

### 3. `falkordblite-ts` — Zero-Config Embedded FalkorDB
- **Repo:** `https://github.com/FalkorDB/falkordblite-ts`
- **Language:** TypeScript
- **Why it's critical:** This is a game-changer for local development. Zero-config embedded FalkorDB that runs via Unix socket — no Docker required. Perfect for agent-driven development loops where you need instant graph access. The API is identical to `falkordb-ts`, so migration to remote is a one-line change.
- **Key insight:** `selectGraph()` returns the exact `Graph` type from `falkordb`, so all examples from `falkordb-ts` work identically.
- **Subtree path suggestion:** `refs/falkordblite-ts`

### 4. `eslint-plugin-jsdoc` — JSDoc Tag Validation Reference
- **Repo:** `https://github.com/gajus/eslint-plugin-jsdoc`
- **Language:** JavaScript
- **Stars:** ~1.1K
- **Why it's critical:** You're already using this for JSDoc enforcement. Your agents need the source to understand `structuredTags` configuration internals, how custom tag schemas are validated, and how `check-tag-names` / `valid-types` / `require-jsdoc` rules work under the hood. This is essential for extending your tag schema (adding `@domain`, `@depends-on`, `@architecture-layer`, etc.).
- **Key directories:**
  - `src/rules/` — Each rule's implementation (especially `check-tag-names.js`, `require-jsdoc.js`)
  - `src/jsdocUtils.js` — Tag parsing utilities
  - `.README/rules/` — Rule documentation with configuration examples
- **Subtree path suggestion:** `refs/eslint-plugin-jsdoc`

---

## Tier 2: High Value — Clone for Architecture Patterns

These repos provide proven architecture patterns for code knowledge graphs. Your agents should study them for graph schema design, ingestion pipelines, and query patterns.

### 5. `code-graph-context` — ts-morph + Neo4j + MCP (Closest Architecture Match)
- **Repo:** `https://github.com/drewdrewH/code-graph-context`
- **Language:** TypeScript
- **Why it's high value:** This is the single closest existing implementation to what you're building. It uses ts-morph to parse TypeScript projects, stores the graph in Neo4j, adds OpenAI vector embeddings, and exposes everything via MCP server for Claude Code. The architecture diagram matches your target almost exactly: `AST Parser (ts-morph) → Neo4j Graph → Vector Embeddings → Claude Code`.
- **Key differences from your approach:** Uses Neo4j instead of FalkorDB, doesn't extract JSDoc as structured metadata, uses LLM-generated embeddings rather than deterministic tags.
- **What to study:** The two-pass analysis pattern (build ASTs first, resolve cross-file relationships second), MCP tool definitions, async parsing with status polling.
- **Subtree path suggestion:** `refs/code-graph-context`

### 6. `CodeGraph` (ChrisRoyse) — Multi-Language ts-morph + Neo4j Analyzer
- **Repo:** `https://github.com/ChrisRoyse/CodeGraph`
- **Language:** TypeScript
- **Why it's high value:** The most feature-complete ts-morph-based code graph analyzer available. Extracts files, directories, classes, interfaces, functions, methods, variables, parameters, type aliases, and components. Maps CALLS, EXTENDS, IMPLEMENTS, IMPORTS, HAS_METHOD relationships. Supports TypeScript, Python, Java, C#, and more.
- **Key insight:** Uses a two-pass analysis approach: first builds detailed ASTs for each file, then resolves complex cross-file relationships. This is the pattern your agents should follow.
- **What to study:** The TypeScript-specific parser, relationship extraction patterns, Neo4j schema design, and the MCP server integration with `neo4j-contrib/mcp-neo4j`.
- **Subtree path suggestion:** `refs/codegraph-analyzer`

### 7. `codegraph` (prompted365) — Simpler ts-morph + Neo4j Reference
- **Repo:** `https://github.com/prompted365/codegraph`
- **Language:** TypeScript
- **Why it's useful:** A cleaner, simpler implementation of the same pattern (ts-morph → Neo4j). Less feature-complete than ChrisRoyse's CodeGraph but easier for agents to parse and understand. Good as a "hello world" reference for the basic pipeline.
- **What to study:** The minimal viable graph schema (Function, Class, Variable nodes with CALLS, INHERITS, IMPORTS edges), batch processing configuration.
- **Subtree path suggestion:** `refs/codegraph-simple`

### 8. `graphiti` (Zep AI) — Temporal Knowledge Graph + MCP Server
- **Repo:** `https://github.com/getzep/graphiti`
- **Language:** Python
- **Stars:** ~20K
- **Why it's high value:** You're already using Graphiti's MCP server for shared memory between Claude and Codex. Your agents need the source to understand episode ingestion, entity extraction, the bi-temporal timestamp model (`created_at`, `expired_at`, `valid_at`, `invalid_at`), and how custom entity types work via Pydantic models. Also critical for understanding the FalkorDB driver implementation within Graphiti.
- **Key directories:**
  - `graphiti_core/` — Core library (entity extraction, edge resolution, search)
  - `graphiti_core/drivers/falkordb_driver.py` — FalkorDB-specific Cypher patterns
  - `mcp_server/` — MCP server implementation (tool definitions, episode management)
  - `graphiti_core/models/` — Entity type definitions
- **Subtree path suggestion:** `refs/graphiti`

---

## Tier 3: Valuable — Clone for Specific Subsystem References

These provide reference implementations for specific subsystems (tree-sitter integration, graph RAG querying, code-graph patterns).

### 9. `code-graph-rag` — Tree-sitter + Memgraph + MCP (Multi-Language Reference)
- **Repo:** `https://github.com/vitali87/code-graph-rag`
- **Language:** Python
- **Stars:** Growing rapidly
- **Why it's valuable:** The most actively developed open-source code knowledge graph project. Uses tree-sitter for multi-language parsing, Memgraph for graph storage, and has the best real-time updater implementation (file watcher → incremental graph update). While Python-based and tree-sitter-focused (not ts-morph), the 4-pass parsing pipeline (Structure → Definitions → Calls → Semantic) is an excellent architectural reference.
- **Key things to study:**
  - `codebase_rag/graph_updater.py` — The 4-pass pipeline pattern
  - `codebase_rag/mcp_server/server.py` — MCP tool definitions for code graph querying
  - `realtime_updater.py` — File watcher → incremental graph updates
  - `codebase_rag/services/llm.py` — Natural language → Cypher translation
- **Subtree path suggestion:** `refs/code-graph-rag`

### 10. `potpie` — Production Code Knowledge Graph Platform
- **Repo:** `https://github.com/potpie-ai/potpie`
- **Language:** Python
- **Stars:** ~5K+
- **Why it's valuable:** The most production-hardened code knowledge graph system (used by Fortune 500 companies, $1.1M revenue). Uses Neo4j with AST-extracted nodes, Celery for async parsing, and has pre-built agents for Q&A, debugging, code generation, and code review. Study this for production patterns: async job queues, agent routing, conversation management with graph context.
- **Key directories:**
  - `app/modules/parsing/` — AST extraction and graph construction
  - `app/modules/intelligence/agents/` — Pre-built agent implementations
  - `app/modules/conversations/` — Multi-turn conversation with graph context
- **Subtree path suggestion:** `refs/potpie`

### 11. `tree-sitter-typescript` — TypeScript Grammar for Tree-sitter
- **Repo:** `https://github.com/tree-sitter/tree-sitter-typescript`
- **Language:** C / JavaScript
- **Why it's valuable:** If you implement the layered architecture (tree-sitter for fast change detection, ts-morph for deep analysis), you'll need this grammar. Defines both TypeScript and TSX as separate dialects. Also useful as a reference for understanding how tree-sitter represents TS AST nodes differently from the TypeScript compiler.
- **Subtree path suggestion:** `refs/tree-sitter-typescript`

### 12. `graph-code` (davidsuarezcdo) — TypeScript Code Analysis with NestJS Support
- **Repo:** `https://github.com/davidsuarezcdo/graph-code`
- **Language:** TypeScript
- **Why it's valuable:** Uses TypeScript Compiler API directly (not ts-morph wrapper) with Neo4j, vector embeddings, and an MCP server. Has special handling for NestJS applications (module/controller/provider analysis). Good reference for framework-specific graph enrichment patterns — similar to how you'd add React component analysis or Express route extraction.
- **Subtree path suggestion:** `refs/graph-code`

---

## Tier 4: Supplementary — Reference as Needed

These are useful for specific edge cases or as documentation references. Don't clone as subtrees unless you need them; web access is sufficient.

### 13. `FalkorDB/code-graph` + `code-graph-backend`
- **Repos:** `https://github.com/FalkorDB/code-graph` and `https://github.com/FalkorDB/code-graph-backend`
- **Why:** FalkorDB's own code graph implementation. Python/Java/C# only (no TypeScript parser), but demonstrates FalkorDB-native Cypher patterns for code graphs and the GraphRAG-SDK integration.

### 14. `FalkorDB/GraphRAG-SDK`
- **Repo:** `https://github.com/FalkorDB/GraphRAG-SDK`
- **Why:** Official SDK for building knowledge graphs on FalkorDB. Python-based, but the ontology management, multi-tenant patterns, and chat session implementation are valuable architectural references.

### 15. `memcp` (evanmschultz)
- **Repo:** `https://github.com/evanmschultz/memcp`
- **Why:** An extended fork of Graphiti's MCP server specifically for IDE AI agents. Adds coding-specific entity types and modular architecture. Good reference if you extend your Graphiti MCP setup with custom entity types for code concepts.

### 16. `@jsdoc/jsdoc` (JSDoc parser)
- **Repo:** `https://github.com/jsdoc/jsdoc`
- **Why:** The canonical JSDoc parser. Useful if you need to understand the full JSDoc spec, though ts-morph's built-in JSDoc parsing should be sufficient for your needs.

### 17. `tsdoc` (Microsoft)
- **Repo:** `https://github.com/microsoft/tsdoc`
- **Why:** Microsoft's standardized TypeScript doc comment grammar. If you eventually want to move from JSDoc to TSDoc for stricter parsing, this is the reference. Supports explicit extensibility for custom tags.

---

## Recommended Clone Strategy

```bash
# In your beep-effect project root:

# Tier 1 — Critical (clone immediately)
git subtree add --prefix=refs/ts-morph-morph https://github.com/dsherret/ts-morph.git main --squash
git subtree add --prefix=refs/falkordb-ts-morph https://github.com/FalkorDB/falkordb-ts.git main --squash
git subtree add --prefix=refs/falkordblite-ts-morph https://github.com/FalkorDB/falkordblite-ts.git main --squash
git subtree add --prefix=refs/eslint-plugin-JSDoc https://github.com/gajus/eslint-plugin-jsdoc.git main --squash

# Tier 2 — Architecture patterns (clone next)
git subtree add --prefix=refs/code-graph-context https://github.com/drewdrewH/code-graph-context.git main --squash
git subtree add --prefix=refs/codegraph-analyzer https://github.com/ChrisRoyse/CodeGraph.git main --squash
git subtree add --prefix=refs/graphiti https://github.com/getzep/graphiti.git main --squash

# Tier 3 — Subsystem references (clone as needed)
git subtree add --prefix=refs/code-graph-rag https://github.com/vitali87/code-graph-rag.git main --squash
git subtree add --prefix=refs/potpie https://github.com/potpie-ai/potpie.git main --squash
```

## Size Considerations

Keep in mind that git subtrees add to your repo size. For agent reference purposes, you may want to use **sparse checkout** or just clone the specific directories your agents need most:

| Repo | Approximate Size | Key Directories |
|------|-----------------|-----------------|
| ts-morph | ~15MB | `packages/ts-morph/src/` |
| falkordb-ts | ~2MB | `src/` |
| falkordblite-ts | ~1MB | `src/` |
| eslint-plugin-jsdoc | ~8MB | `src/rules/`, `.README/` |
| code-graph-context | ~3MB | `src/` |
| CodeGraph (ChrisRoyse) | ~5MB | `src/` |
| graphiti | ~20MB | `graphiti_core/`, `mcp_server/` |
| code-graph-rag | ~10MB | `codebase_rag/` |
| potpie | ~15MB | `app/modules/` |

## Agent Instruction Template

Add to your agent system prompts:

```
When implementing the hybrid AST-JSDoc knowledge graph:
- For ts-morph API patterns → reference refs/ts-morph/packages/ts-morph/src/
- For FalkorDB Cypher queries → reference refs/falkordb-ts/src/
- For JSDoc tag validation → reference refs/eslint-plugin-jsdoc/src/rules/
- For code graph schema design → reference refs/codegraph-analyzer/src/ and refs/code-graph-context/src/
- For MCP server patterns → reference refs/graphiti/mcp_server/
- For incremental graph updates → reference refs/code-graph-rag/realtime_updater.py
- For production ingestion pipelines → reference refs/potpie/app/modules/parsing/
```
