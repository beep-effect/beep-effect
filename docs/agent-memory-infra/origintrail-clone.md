# TL;DR

OriginTrail DKG V10 passes the three hard gates in this clone read: it is self-hostable/local-first with caveats, Apache-2.0 licensed, and TypeScript/Node-native with CLI, HTTP API, TS package surfaces, SPARQL storage, and an MCP server. [R1][R2][R3][R4][R9]

The honest boundary is that local/tokenless OriginTrail is useful but not equivalent to full OriginTrail VM finality. Working memory, shared working memory, local import/query, discovery, and direct messages are documented as not requiring funds, while VM publish/update/endorse/verify and core-node profile/staking flows require gas, TRAC, wallets, chain configuration, or V10 publisher readiness. [R2][R10][R13]

For Role A, OriginTrail is a credible capability donor and rebuildable RDF/SPARQL projection engine, not a system of record. Its most portable patterns are knowledge-asset lifecycle envelopes, explicit WM/SWM/VM trust tiers, context graphs, Merkle commitments, author attestations, provenance metadata, fail-closed private graph gates, and no loose shared-memory writes. [R6][R8][R10][R11][R12][R13]

For Role B, it has a real Claude/Codex-compatible MCP story and automatic recall hooks, but it is heavier than a small dev-memory service and its `dkg_memory_search` implementation is trust-weighted literal/SPARQL search rather than semantic embedding recall. [R9][R10]

# Hard-gate verdicts

| Gate | Verdict | Evidence |
|---|---:|---|
| 1. Self-hostable / local-first | PASS, with chain/finality caveat | The README documents a standalone node installed by npm, `dkg init`, and `dkg start`, serving the daemon on `127.0.0.1:9200`; the run-node docs say edge nodes can run, sync, query, and serve local agents without an on-chain node profile. Funding docs say WM, SWM, queries, imports, discovery, and direct messages do not require funds, while on-chain VM operations do. [R1][R2] |
| 2. OSI license without copyleft trap | PASS | The clone root `LICENSE` is Apache License Version 2.0 with copyright and patent grants and standard redistribution terms; package manifests I read also declare `Apache-2.0`. [R3][R4] |
| 3. TS-native or clean HTTP/MCP API | PASS | The repo is a pnpm/TypeScript monorepo with TS package manifests and types for storage, query, chain, publisher, and MCP packages; the README and MCP package document CLI, local HTTP daemon, API bearer auth, SPARQL, and MCP integration for Codex/Claude/Cursor-style clients. [R1][R4][R9][R14] |

# Architecture & storage

The clone is a DKG V10 Node monorepo, not a narrow library. The README lists the node software, CLI, dashboard, protocol packages, adapters, and tooling; its architecture diagram separates daemon/API/UI, P2P, RDF/SPARQL storage, chain finality, memory layers, CLI, and UI. [R1]

The source architecture matches that split: CLI/HTTP API, agent runtime, publisher runtime, core protocol crypto, storage adapters, chain adapters, and node UI are explicit components, with publisher code responsible for VM commitments and chain anchoring. [R5][R13]

Storage is RDF-first. The storage package describes a triple-store abstraction over Oxigraph, Oxigraph worker/server, Blazegraph, and generic SPARQL HTTP stores; the `TripleStore` interface is explicitly SPARQL 1.1-oriented rather than vendor-specific. [R6]

The default local story is an OriginTrail-managed Oxigraph server for new installs, with a worker-backed N-Quads dump fallback and optional external SPARQL stores such as Blazegraph, Fuseki, GraphDB, Neptune, or Stardog. That is a clean projection/retrieval backend, but the opened storage contract is RDF/SPARQL rather than Postgres-native. [R6][R7]

Private and shared memory confidentiality is nuanced. The architecture docs describe encrypted SWM transport, but signatures do not make SWM payloads confidential; after accepted private or shared payloads are decrypted, local RDF terms are stored as normal queryable triples so SPARQL filters continue to work. [R8]

# Retrieval

Retrieval is primarily SPARQL over scoped named graphs. The query package resolves WM, SWM, and VM graph targets by view and context graph, enforces read-only SPARQL, and states that the query engine is local-only: data must already have arrived through protocol messages before it can be queried. [R11]

Remote querying exists as a P2P handler with access-policy checks, rate limiting, dispatch by query type, public context-graph resolution, and result-size controls. This is useful for agent-to-agent graph access, but it is not a hosted semantic search service by itself. [R11]

The MCP `dkg_memory_search` tool is explicit lexical recall. It tokenizes the query, builds SPARQL `CONTAINS(LCASE(STR(?text)))` filters over literals of at least 20 characters, fans out across WM/SWM/VM and optional project layers, deduplicates hits, and ranks with fixed trust weights: VM above SWM above WM. [R9]

That makes retrieval deterministic and provenance-friendly, but less rich than vector or hybrid semantic recall unless another layer is added behind a driver. The clone evidence I read did not show embeddings, ANN vector indexes, or LLM-generated semantic ranking in this MCP recall path. [R9][R11]

# Provenance/temporal/lifecycle

OriginTrail's strongest fit is lifecycle/provenance structure. The docs define WM, SWM, and VM layers, and the lifecycle is create/write/finalize/share/publish: finalize computes a Merkle root and author attestation, share moves finalized content into SWM, and publish promotes to VM when chain finality is desired and funded. [R10][R12]

Knowledge assets package RDF graph data with integrity/provenance. The docs describe KAs as graph data with provenance and integrity, minted as ERC-721 assets for VM publication, addressable by UAL, and suitable for final outputs rather than every transient note. [R12]

The publisher code and metadata helpers create concrete provenance artifacts: Merkle roots, public/private root structure, UAL subjects, publisher peer IDs, agent and author addresses, transaction hashes, block numbers, block timestamps, publisher addresses, chain IDs, verification metadata, and status quads. [R13]

The private-data model binds private roots into commitments while keeping private slices local or gated. The code defers public VM insertion until chain confirmation or an intentional local branch, avoids persisting finalized private slices on chain failure, and removed legacy self-signed ACK fallback in favor of real ACKs or failure. [R13]

Temporal support is lifecycle-oriented rather than bitemporal. The files I read show lifecycle status, timestamps such as `publishedAt`, tentative versus confirmed branches, materialization versions, history/update command surfaces, and trust gradients; they do not show a Graphiti-style valid-time/transaction-time fact contract. [R10][R12][R13]

# Integration surface

Integration surfaces are broad: npm CLI, daemon HTTP API, bearer-token auth, dashboard UI, context-graph and knowledge-asset commands, SPARQL query/update storage, package-level TS APIs, MCP tools, and OpenClaw/Hermes/ElizaOS-style adapters listed in the repo layout. [R1][R4][R9][R14]

The MCP package is real, not just aspirational. It exposes the local daemon over stdio, uses `@modelcontextprotocol/sdk`, registers read/assertion/memory/setup/health/chat tools, and documents 29 tools including status, context-graph reads, entity/source/activity reads, KA lifecycle writes, `dkg_memory_search`, and `dkg_query`. [R9]

The agent-facing API is intentionally layered. MCP assertion tools create/write/finalize/share KAs, while publish remains a separate flow with gas/TRAC implications; the node skill also warns that SWM is named-knowledge-asset-only and has no loose shared write path. [R9][R10]

For this repo, the cleanest Role A integration would be a `drivers/*` wrapper that projects accepted Postgres authority records into RDF/context-graph/KAs, queries OriginTrail as a rebuildable projection, and maps every result back to product-owned claim/evidence/provenance identifiers. OriginTrail's own storage and API surfaces support the projection side, but not the product authority store. [R6][R7][R9][R13]

# License & maturity

License: PASS. The root license is Apache-2.0, including permissive copyright and patent grants; the package manifests I read consistently declare Apache-2.0. [R3][R4]

Maturity: promising but not production-default. The README identifies this as a V10 release-candidate testnet state and explicitly says it is not recommended for production, even though the repo already includes the daemon, CLI, dashboard, storage, query, publisher, chain, MCP, adapters, benchmark, and test surfaces. [R1][R4]

Runtime requirements are current and non-trivial: the README requires Node.js 22+ and npm 10+, the workspace uses pnpm 10, the daemon owns local state under DKG home directories, and production-ish graph scale pushes users toward out-of-process SPARQL stores instead of the single-worker embedded path. [R1][R4][R6][R7]

# Role A assessment

Verdict: PASS as a capability donor/projection/cache; FAIL as product-runtime system of record.

OriginTrail maps well to a projection engine because it already speaks RDF, SPARQL, context graphs, named memory layers, knowledge assets, Merkle commitments, provenance metadata, and trust-weighted retrieval. Those are good donor patterns for legal-domain memory inspection and verifiable context packets. [R6][R9][R10][R11][R12][R13]

It should not own durable truth for the agentic-professional-runtime. The product needs Postgres-held claim/evidence/provenance/lifecycle authority; OriginTrail's opened persistence model is an RDF/SPARQL graph store with optional chain anchoring, not a schema-first legal claim ledger. [R6][R7][R13]

Claim/evidence compatibility is partial. RDF can express claims, evidence links, agents, context graphs, provenance activities, and verification metadata, and the KA model can envelope a bundle with Merkle integrity and optional on-chain identity. The clone does not enforce this repo's human acceptance semantics, legal evidence taxonomy, ethical-wall policy, or Postgres lifecycle invariants. [R10][R12][R13]

Patterns worth porting are concrete: KA-as-lifecycle-envelope, finalized-before-shared discipline, no loose SWM writes, explicit WM/SWM/VM trust layer labels, context-graph/subgraph scoping, Merkle commitments over public/private partitions, author attestations, provenance/status quads, fail-closed private graph gates, and refusal to silently degrade chain publish failures into fake finality. [R8][R10][R11][R13]

Purely local/self-hosted deployment can support local memory and projection work without tokens, but not VM-grade finality. The no-chain adapter states the node can still do P2P and queries while chain operations throw; funding docs say only local/P2P memory flows are tokenless, while VM publish/update/endorse/verify and core-node obligations require chain resources. [R2]

# Role B assessment

Verdict: useful experiment/reference for Claude/Codex dev memory, but not the default stack.

The positive case is strong enough to test: the MCP package explicitly targets local DKG daemon use from Cursor, Claude, Codex, Windsurf, VS Code/Copilot, and Cline; setup is intended to start the daemon, configure clients, fund/register when needed, and expose status/read/write/search/query tools. [R9]

Recall quality is likely precise but narrow. `dkg_memory_search` uses SPARQL literal matching, layer fan-out, trust weights, dedupe, provenance rendering, and optional project scope; this is good for exact text recall, but the clone path I read does not provide embedding recall, semantic expansion, or graph-neighborhood ranking in the MCP search implementation. [R9]

Maintenance burden is the main Role B problem. A useful local setup brings Node 22+, DKG daemon state, auth tokens, storage backend choices, optional P2P, optional wallet/funding/profile setup, and release-candidate churn; that is much heavier than file memory or a small MCP service for day-to-day coding agents. [R1][R2][R6][R7][R9]

Best use: keep it as an evaluation lane or specialized DKG/ontology memory lab. Do not make every Claude/Codex session depend on it unless the team wants RDF/SPARQL/KA provenance as the central dev-memory experiment. [R6][R9][R13]

# Contradictions with prior repo assessments

n/a

# References

[R1] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/README.md`: lines 10-16, 19-38, 68-83, 122-170, 203-217, 221-307, 313-330, 379-480, 483-529, 564-581, 600-628, 646-678.

[R2] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/use-dkg/funding.md`: lines 8-16, 18-27, 29-42. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/use-dkg/run-node.md`: lines 22-39, 47-73. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/chain/src/no-chain-adapter.ts`: lines 15-26.

[R3] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/LICENSE`: lines 1-3, 66-87, 89-128, 189-201.

[R4] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/package.json`: lines 1-13, 83-93. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/package.json`: lines 1-16, 24-29. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/query/package.json`: lines 1-16, 24-29. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/mcp-dkg/package.json`: lines 1-36, 44-63. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/chain/package.json`: lines 1-20, 30-36. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/publisher/package.json`: lines 1-20, 31-36.

[R5] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/ARCHITECTURE.md`: lines 1-5, 17-133, 344-384, 410-560.

[R6] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/README.md`: lines 1-15, 36-67. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/triple-store.ts`: lines 1-5, 55-124, 181-217. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/index.ts`: lines 34-50.

[R7] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/use-dkg/storage-sparql-http.md`: lines 8-14, 16-43, 45-68, 90-94. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/adapters/oxigraph.ts`: lines 25-43, 45-93, 116-139, 194-218, 242-247. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/adapters/oxigraph-worker.ts`: lines 8-35, 65-73, 146-247. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/adapters/sparql-http.ts`: lines 1-22, 114-145, 166-253. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/adapters/blazegraph.ts`: lines 15-22, 36-52, 112-164, 189-211.

[R8] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/ARCHITECTURE.md`: lines 562-593, 641-669, 705-759. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/storage/src/private-store.ts`: lines 21-26, 180-257.

[R9] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/mcp-dkg/README.md`: lines 1-6, 7-50, 141-204, 212-233, 235-300. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/mcp-dkg/src/index.ts`: lines 43-66. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/mcp-dkg/src/tools/memory-search.ts`: lines 47-82, 168-257, 259-294, 296-385. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/mcp-dkg/test/memory-search.test.ts`: lines 19-83, 89-117.

[R10] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/cli/skills/dkg-node/SKILL.md`: lines 254-283, 290-306, 308-418, 524-562, 618-625, 674-724.

[R11] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/query/README.md`: lines 1-12, 32-41. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/query/src/dkg-query-engine.ts`: lines 44-53, 84-131, 132-219, 232-300. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/query/src/query-handler.ts`: lines 33-39, 88-149, 151-245. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/query/src/sparql-guard.ts`: lines 1-7, 12-27, 123-160.

[R12] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/how-dkg-works/memory-layers.md`: lines 12-18, 20-47. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/use-dkg/knowledge-asset-lifecycle.md`: lines 8-18, 20-45, 47-68. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/use-dkg/publish-and-query.md`: lines 10-17, 25-57, 59-89. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/how-dkg-works/knowledge-assets.md`: lines 8-31. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/how-dkg-works/agents-and-trust.md`: lines 21-35. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/how-dkg-works/context-graphs.md`: lines 8-30.

[R13] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/chain/src/chain-adapter.ts`: lines 81-90, 92-148, 150-204. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/chain/src/evm-adapter-publish.ts`: lines 214-223, 275-320. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/publisher/src/merkle.ts`: lines 1-16, 26-41, 54-92. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/publisher/src/metadata.ts`: lines 46-72, 83-90, 110-155, 169-224, 229-260. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/publisher/src/verification-metadata.ts`: lines 8-45. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/publisher/src/dkg-publisher.ts`: lines 1508-1649, 1651-1720, 1751-1935, 2090-2130, 2144-2146, 2173-2248, 2257-2300, 2359-2399, 2682-2690, 2757-2858, 2858-2939.

[R14] `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/docs/references/api.md`: lines 8-17, 19-41. `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/dkg/packages/mcp-dkg/src/client.ts`: lines 1-7, 10-27, 46-68, 75-117.
