# Ontology–LLM Agent Integration Patterns (2025–2026 Survey)

**Lane:** `document-structure-ontologies` / research / grok
**Report:** `04-ontology-llm-integration.md`
**Date:** 2026-08-11
**Scope:** How ontologies and knowledge graphs are wired into LLM *agent* systems for retrieval, drafting, and tool use — with emphasis on patterns that matter for legal/IP professional desktop agents (patent applications, office-action responses, structure-aware ASTs).

**Method:** Web survey of Microsoft Research / vendor docs, arXiv, GitHub, engineering blogs, and legal-ontology projects. Every substantive claim below carries a real URL. Synthesis and “fit for beep-effect” are interpretive and labeled as such.

---

## 1. Executive summary

Between 2024 and mid-2026 the industry converged on a few durable patterns:

1. **Ontology-as-tool beats ontology-as-system-prompt.** Dumping large OWL/TTL into the system message does not scale; exposing *search, browse, schema, and query* operations as agent tools (especially via MCP) does. FOLIO’s legal ontology MCP server is the clearest legal-domain instance of this shift ([openlegalstandard.org announcement](https://openlegalstandard.org/folio-mcp-server-ai-agents), [GitHub alea-institute/folio-mcp](https://github.com/alea-institute/folio-mcp)).

2. **GraphRAG is real but expensive in its classic form.** Microsoft’s GraphRAG (entity/relation extraction → Leiden communities → hierarchical summaries → global/local query) materially improves multi-document and “theme-level” questions over baseline vector RAG ([GraphRAG docs](https://microsoft.github.io/graphrag/), [arXiv:2404.16130](https://arxiv.org/abs/2404.16130), [GitHub microsoft/graphrag](https://github.com/microsoft/graphrag)). Indexing cost and LLM summarization cost were the primary adoption blockers; LazyGraphRAG cut indexing cost to ~0.1% of full GraphRAG by deferring LLM work to query time ([MSR LazyGraphRAG blog](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)).

3. **Ontology-grounded retrieval is distinct from “LLM-built graphs.”** OG-RAG maps documents onto a *pre-existing domain ontology*, builds fact hypergraphs, and retrieves minimal hyperedge sets — reporting +55% fact recall and +40% answer correctness vs RAG/RAPTOR/GraphRAG on domain tasks ([arXiv:2412.15235](https://arxiv.org/abs/2412.15235), [HTML](https://arxiv.org/html/2412.15235v1)). This is the closest academic pattern to “use DOCO/DEO/FOLIO as retrieval grammar,” not just entity soup.

4. **MCP became the default delivery surface for graph/ontology tools in 2025.** Neo4j ships Cypher, memory, data-modeling, Aura, and GraphRAG retriever MCP servers ([Neo4j MCP guide](https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/), [GraphRAG as MCP](https://neo4j.com/blog/developer/neo4j-graphrag-retrievers-as-mcp-server/)). GraphDB/Graphwise exposes SPARQL + ontology-schema tools over MCP ([Graphwise MCP blog](https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/), [community GraphDB MCP](https://github.com/keonchennl/mcp-server-graphdb)). FOLIO is the legal-specific peer.

5. **Structured generation is production infrastructure, not a research toy.** OpenAI Structured Outputs guarantee JSON Schema adherence via constrained decoding ([OpenAI announcement](https://openai.com/index/introducing-structured-outputs-in-the-api/), [docs](https://developers.openai.com/api/docs/guides/structured-outputs)). Open-source stacks (Outlines, Guidance/llguidance, XGrammar, llama.cpp grammars) provide the same idea for local models ([JSONSchemaBench arXiv:2501.10868](https://arxiv.org/html/2501.10868v1)). **Important failure mode:** schema validity ≠ factual correctness ([Friendli note](https://friendli.ai/blog/structured-output); OpenAI itself notes value-level mistakes still occur).

6. **Document-structure-aware chunking often beats model swaps.** Hierarchical / markdown / section-boundary chunking and late-chunking variants consistently improve retrieval quality; OWL-aware and document-structure-graph chunking are emerging academic lines ([Dell structure-aware chunking](https://infohub.delltechnologies.com/en-us/p/chunk-twice-retrieve-once-rag-chunking-strategies-optimized-for-different-content-types/), [GraLC-RAG arXiv HTML](https://arxiv.org/html/2603.22633v1), [OWL-aware chunking](https://dev.to/vishalmysore/owl-aware-chunking-strategies-a-comprehensive-performance-analysis-6pa)). For beep-effect this maps cleanly to DOCO section/paragraph folds over `@beep/md`.

**Ranked shortlist for beep-effect (evidence × fit):**

| Rank | Pattern | Real-world evidence | Beep fit |
| --- | --- | --- | --- |
| 1 | Ontology-as-tool (MCP + search/browse/export) | FOLIO, Neo4j, GraphDB in production agent hosts | High — legal concepts + AST vocab |
| 2 | Structure-aware hierarchical chunking | Industry RAG practice + 2025–26 papers | High — DOCO/PO over AST |
| 3 | Hybrid vector + graph / path retrieval | Neo4j GraphRAG, LightRAG, LlamaIndex PropertyGraph | High — docket KG + document spans |
| 4 | Schema-constrained drafting (JSON Schema / Effect schemas) | OpenAI SO, Outlines, API strict tools | High — patent section templates |
| 5 | Ontology-grounded indexing (OG-RAG style) | Strong evals; fewer production refs than GraphRAG | Medium–high for patent/legal facts |
| 6 | Lazy / cheap GraphRAG variants | MSR LazyGraphRAG; LightRAG OSS adoption | Medium — corpus exploration |
| 7 | Full Microsoft GraphRAG pipeline | Mature OSS + Azure; cost/ops heavy | Low–medium for desktop agents |
| 8 | Free-form Text2SPARQL/Text2Cypher without guardrails | Widely demoed; brittle in practice | Low unless schema tools + validation |
| 9 | Ontology-as-system-prompt dump | Common anti-pattern in blogs; weak at scale | Avoid |

---

## 2. Landscape map (what “wiring an ontology into an agent” means)

An agent that “uses an ontology” typically does one or more of:

| Layer | Role of ontology | Typical mechanism |
| --- | --- | --- |
| **Index time** | Shape what gets extracted/stored | Typed entity extraction prompts; schema for graph build; OWL class constraints |
| **Chunk time** | Decide retrieval atoms | Section/heading hierarchy; DOCO-like structure; late chunking with structure graphs |
| **Query time** | Route retrieval | SPARQL/Cypher tools; VectorCypher hybrid; community summaries; hyperedge cover |
| **Reasoning time** | Constrain multi-hop paths | Think-on-Graph style KG walks ([ICLR ToG](https://openreview.net/forum?id=nnVO1PvbTv), [ToG 2.0 arXiv:2407.10805](https://arxiv.org/abs/2407.10805)) |
| **Generation time** | Constrain output shape | JSON Schema / CFG / tool schemas; enum of legal document types |
| **Action time** | Validate agent verbs | Typed tool ontology; policy in the type system ([TypeDB agents post](https://typedb.com/blog/why-agents-need-ontologies), [Ken Huang 2026](https://kenhuangus.substack.com/p/why-ontology-matters-for-agentic)) |

The 2025–2026 practical consensus: **put structure in the index and tools; put free language in the model; put enforcement outside the prompt.**

Supporting framing from agent-ontology practitioners: ontology as *queryable infrastructure* and *compiled action interface*, not as more prompt text ([TypeDB](https://typedb.com/blog/why-agents-need-ontologies); [Ken Huang](https://kenhuangus.substack.com/p/why-ontology-matters-for-agentic); [designing ontology-aware tooling](https://pub.towardsai.net/designing-ontology-aware-tooling-for-agents-61035921af1c)).

---

## 3. Pattern catalog (ranked by evidence of real-world use)

Evidence score (subjective, explained):

- **A** — Production vendor product or widely adopted OSS with enterprise case studies
- **B** — Strong open-source adoption + peer-reviewed evals
- **C** — Academic / early commercial; promising metrics, limited deploy reports
- **D** — Conceptually common, empirically weak or failure-prone alone

### 3.1 Ontology-as-tool via MCP and agent frameworks — **Evidence A**

#### What it is

The agent does **not** hold the full ontology in context. It calls tools such as:

- search concepts by label/definition
- get concept details / parents / children
- export JSON-LD / OWL / Markdown
- get graph schema
- run parameterized or LLM-generated queries (SPARQL/Cypher) with results truncated back into context

#### Canonical examples

**FOLIO (legal ontology MCP)**
- Announced March 2026: 18,000+ legal concepts as MCP tools for Claude Code, Gemini CLI, Codex, Cursor, VS Code ([announcement](https://openlegalstandard.org/folio-mcp-server-ai-agents), [resource page scrape context](https://openlegalstandard.org/resources/folio-mcp), [GitHub](https://github.com/alea-institute/folio-mcp), [PyPI](https://pypi.org/project/folio-mcp/)).
- Tools + prompt templates for classify-document, identify-area-of-law, classify-entity, identify-forum-venue, etc. ([announcement](https://openlegalstandard.org/folio-mcp-server-ai-agents)).
- Modes: API client to free REST API, or local full-ontology load ([same](https://openlegalstandard.org/folio-mcp-server-ai-agents)).
- Ontology license: FOLIO/SOLI lineage described as open **CC-BY** on project pages ([FOLIO GitHub](https://github.com/alea-institute/FOLIO), [openlegalstandard.org](https://openlegalstandard.org/)).

**Neo4j MCP suite**
- Official Neo4j MCP: get schema, read/write Cypher, GDS algorithms ([developer guide](https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/), [github.com/neo4j/mcp](https://github.com/neo4j/mcp)).
- Labs: mcp-neo4j-cypher, memory KG, Aura manager, data-modeling → ontology-ish graph models ([same guide](https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/); [NODES 2025 ontology + data modeling MCP](https://neo4j.com/nodes-2025/agenda/ontology-creation-with-the-neo4j-data-modeling-mcp-server/)).
- GraphRAG retrievers exposed as MCP tools (VectorCypher etc.) ([Neo4j blog](https://neo4j.com/blog/developer/neo4j-graphrag-retrievers-as-mcp-server/)).
- Aura Agent: ontology-driven agent construction with REST + MCP deployment ([Aura Agent tutorial](https://neo4j.com/developer/genai-ecosystem/aura-agent-getting-started/)).

**GraphDB / Graphwise (RDF + SPARQL MCP)**
- Built-in MCP server tools: similarity search, SPARQL interface, ontology schema extraction ([Graphwise MCP blog](https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/); earlier NLQ+LangChain pattern [Ontotext LangChain blog](https://www.ontotext.com/blog/natural-language-querying-of-graphdb-in-langchain/)).
- Explicit design note: **do not ship the entire large ontology into the prompt**; expose a tool that returns ontological data from a named graph, and prefer a *subset* of FIBO/etc. relevant to the task ([Graphwise multi-dataset MCP blog](https://graphwise.ai/blog/querying-diverse-datasets-with-mcp/)).
- Community read-only GraphDB MCP servers ([keonchennl/mcp-server-graphdb](https://github.com/keonchennl/mcp-server-graphdb)).

#### What improves quality

- On-demand retrieval of only the relevant branch of the taxonomy (token efficiency).
- Reusable **prompt templates** bound to ontology workflows (FOLIO classify-* templates).
- Schema tools that ground Text2Cypher/Text2SPARQL (Neo4j `get-neo4j-schema`, GraphDB ontology extraction).

#### Failure modes

- Unrestricted write Cypher/SPARQL from an agent is a security incident waiting to happen (Neo4j and GraphDB docs both emphasize careful tool scope).
- LLM-generated queries fail silently or return empty when schema is incomplete.
- Tool sprawl without routing (too many MCP tools → wrong tool selection).

#### License notes

| Component | License (as published) | URL |
| --- | --- | --- |
| FOLIO ontology | CC-BY (project claim) | https://github.com/alea-institute/FOLIO |
| folio-mcp | Open source (GitHub/PyPI; verify LICENSE file before vendoring) | https://github.com/alea-institute/folio-mcp |
| Neo4j MCP servers | See each repo (Labs / official) | https://github.com/neo4j-contrib/mcp-neo4j , https://github.com/neo4j/mcp |
| MCP specification | Open standard (Anthropic-origin) | https://modelcontextprotocol.io/ |

---

### 3.2 Hybrid vector + graph retrieval (GraphRAG family) — **Evidence A/B**

#### Microsoft GraphRAG (classic)

**Pipeline** ([docs](https://microsoft.github.io/graphrag/), [paper arXiv:2404.16130](https://arxiv.org/abs/2404.16130), [MSR intro blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)):

1. Slice corpus into TextUnits
2. LLM extract entities, relationships, claims
3. Leiden hierarchical community detection
4. Bottom-up community summarization
5. Query: **Global** (community summaries), **Local** (entity neighborhood), **DRIFT**, or baseline vector

**Strengths:** global/theme questions; multi-document synthesis; private corpora the model never trained on.
**Weaknesses:** indexing LLM cost historically severe; community summaries can drift from source text; not natively *ontology-typed* unless you prompt-tune entity types.

**License:** MIT ([github.com/microsoft/graphrag](https://github.com/microsoft/graphrag)).

**Legal case example:** Azure sample “GraphRAG for legal cases on PostgreSQL” ([Azure-Samples/graphrag-legalcases-postgres](https://github.com/Azure-Samples/graphrag-legalcases-postgres), MIT).

#### LazyGraphRAG

Defers community LLM summarization; NLP noun-phrase concept graph + query-time relevance tests ([MSR blog 2024-11-25](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)):

- Indexing cost ≈ vector RAG, **0.1% of full GraphRAG**
- At comparable query cost to vector RAG, beats competitors on local queries
- At ~4% of GraphRAG global-search query cost, significantly outperforms global/local competitors on their metrics
- Later integrated into Microsoft Discovery / Azure Local previews (blog editor’s note, June 2025)

**Takeaway:** if beep-effect wants GraphRAG-like *global* understanding of a patent family or OA history, prefer lazy/hybrid indexing over full community summarization for a desktop product cost envelope.

#### LightRAG / nano-graphrag / Fast GraphRAG

- **LightRAG** (HKUDS): dual-level retrieval, simpler/faster alternative; MIT ([github.com/HKUDS/LightRAG](https://github.com/HKUDS/LightRAG), [arXiv:2410.05779](https://arxiv.org/abs/2410.05779)). Strong OSS adoption as a cost-aware GraphRAG substitute (practitioner write-ups compare cost to Microsoft GraphRAG extensively).
- **nano-graphrag**: ~1.1k LOC educational reimplementation ([github.com/gusye1234/nano-graphrag](https://github.com/gusye1234/nano-graphrag)).
- Curated landscape: [Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG) + survey [arXiv:2501.13958](https://arxiv.org/abs/2501.13958).

#### Schema-guided extraction (important nuance)

Domain schemas change GraphRAG quality. Dagstuhl work on technical documents compares expert minerals schemas vs auto-generated GraphRAG schema vs schema-less ([TGDK 2025](https://drops.dagstuhl.de/entities/document/10.4230/TGDK.3.2.3)).
Ontology learning vs expert ontology impact on RAG: [arXiv:2511.05991](https://arxiv.org/abs/2511.05991).

**Implication for beep-effect:** do **not** rely on free-form entity extraction for patent claims. Prefer fixed type sets (claim, limitation, prior-art reference, statutory basis, figure callout) aligned to your RDF vocabs + DOCO structural types.

#### Failure modes (GraphRAG family)

| Failure | Why it hurts drafting agents |
| --- | --- |
| Index cost cliff | Full GraphRAG unusable for iterative patent drafts without Lazy/Light variants ([cost narrative](https://medium.com/graph-praxis/the-graphrag-cost-cliff-how-33-000-became-33-in-eighteen-months-be1b0fbe37e4)) |
| Entity soup without ontology | Ambiguous “method” / “system” nodes in patents |
| Stale community summaries | Amended claims invalidate summaries |
| Global search overkill | Most OA response questions are *local* (this claim vs this rejection) |

---

### 3.3 Ontology-grounded RAG (OG-RAG and kin) — **Evidence B/C**

#### OG-RAG (Microsoft Research authors; EMNLP 2025 lineage)

Paper: [arXiv:2412.15235](https://arxiv.org/abs/2412.15235) · [HTML](https://arxiv.org/html/2412.15235v1) · code pointer [github.com/microsoft/ograg2](https://github.com/microsoft/ograg2)

**Core idea:**

1. Take a **domain ontology** (not LLM-invented)
2. Map document text into ontology-shaped **factual blocks** (JSON-LD via LLM)
3. Flatten into a **hypergraph** where hyperedges are verifiable fact clusters
4. At query time: embed-relevant hypernodes (keys and values), then **greedy set cover** of hyperedges for compact context
5. Prompt LLM with dictionary-form facts

**Reported results** (agriculture + news multi-hop; four LLMs): +55% accurate-fact recall, +40% response correctness, +30% faster attribution, +27% fact-based reasoning vs RAG / RAPTOR / GraphRAG ([abstract](https://arxiv.org/abs/2412.15235)). Explicitly lists **legal** among target industrial workflows.

**Why this matters more than classic GraphRAG for beep-effect:**

- Ontology is an *input*, not an accidental byproduct of extraction.
- Context is fact-cluster shaped → better citation/attribution UX for lawyers.
- Deductive “apply rule over facts” tasks improve when context is ontology-normalized.

**Failure modes:**

- Requires a decent ontology up front (paper uses semi-automated ontology learning + expert review).
- Mapping LLM can still mis-slot free text into the wrong property.
- Hyperedge cover is greedy; pathologically dense graphs may over-retrieve.

**License:** paper CC BY-NC-SA 4.0 on arXiv; check repo LICENSE before commercial use ([arXiv license badge](https://arxiv.org/abs/2412.15235)).

#### Related “existing KG” agent patterns

- **Think-on-Graph / ToG 2.0:** iterative LLM decisions over KG paths ([ICLR 2024](https://openreview.net/forum?id=nnVO1PvbTv), [arXiv:2407.10805](https://arxiv.org/abs/2407.10805)).
- **Reasoning on Graphs (RoG):** faithful KG reasoning ([ICLR 2024](https://openreview.net/forum?id=ZGNWW7xZ6Q)).
- **HippoRAG2:** non-parametric memory graphs ([arXiv:2502.14802](https://arxiv.org/abs/2502.14802)).
- **LegalGraphRAG** listed among 2026 acceptances in Awesome-GraphRAG news ([Awesome-GraphRAG](https://github.com/DEEP-PolyU/Awesome-GraphRAG)) — watch as legal-specific GraphRAG signal.

---

### 3.4 SPARQL-aided / Text2SPARQL RAG — **Evidence B (with brittleness)**

#### Architecture

1. Provide ontology schema (file or SPARQL CONSTRUCT from named graph) to the LLM
2. LLM emits SPARQL
3. Execute against triple store
4. Verbalize rows or feed as RAG context

Documented in Ontotext GraphDB + LangChain ([blog](https://www.ontotext.com/blog/natural-language-querying-of-graphdb-in-langchain/)) and GraphDB MCP SPARQL tool ([Graphwise](https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/)).

#### What works

- Well-scoped schema fragments (not entire FIBO)
- Read-only SELECT with result limits
- Ontology schema tool as a *separate* call before query generation ([Graphwise multi-dataset](https://graphwise.ai/blog/querying-diverse-datasets-with-mcp/))

#### Failure modes

- Hallucinated predicates / class IRIs
- Unbounded CONSTRUCT flooding context
- Poor performance when ontology and instance data use inconsistent naming

**Cypher analogue** has more production polish (Neo4j Text2Cypher + schema tool) ([Neo4j MCP](https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/)) but the same failure class applies.

**Beep-effect stance:** if you keep RDF (you do: `@beep/rdf`, taxonomy TTL loader), prefer **parameterized SPARQL templates as tools** over free-form Text2SPARQL for agent actions that mutate or cite case law.

---

### 3.5 Ontology-as-system-prompt vs ontology-as-tool — **Evidence A for tool; D for dump**

| Approach | How | When it works | Failure |
| --- | --- | --- | --- |
| **Prompt dump** | Paste OWL/TTL/Markdown taxonomy into system/developer message | Tiny taxonomies (< few dozen classes); static persona | Context bloat; model ignores middle; no live updates; no enforcement |
| **Prompt distill** | Summarize ontology into compact glossary + 5–15 hard rules | Style/rhetoric constraints (“never invent claim numbers”) | Still soft; model can violate |
| **Tool / MCP** | Search + get_subtree + validate | Production agents | Needs good tool design |
| **Compiled constraint** | JSON Schema / FSM / CFG at decode time | Output shape, enums of document types | Not semantic correctness |
| **DB-enforced ontology** | TypeDB / SHACL / OWL reasoner on write path | High-assurance enterprise | Heavier ops |

Industry posts in 2026 frame ontology as the *compiler front-end* for agent actions: make invalid actions unrepresentable rather than “please don’t” in a prompt ([Ken Huang](https://kenhuangus.substack.com/p/why-ontology-matters-for-agentic); [TypeDB](https://typedb.com/blog/why-agents-need-ontologies); [dlt ontology engineering](https://dlthub.com/blog/ontology-engineering)). Reddit/practitioner threads often restate the same: “prompt engineering is ontology engineering in denial” ([r/AI_Agents discussion](https://www.reddit.com/r/AI_Agents/comments/1r05nab/prompt_engineering_is_ontology_engineering_in/)).

**Rule of thumb for beep-effect:**

- System prompt: *role, tone, safety, short glossary of 10–20 core IRIs*
- Tools: FOLIO-like concept search; DOCO section type lookup; claim-graph query
- Decode constraints: Effect Schema / JSON Schema for draft *structure*
- Graph store + SHACL/typed edges: *truth* for matter data

---

### 3.6 Ontology-constrained generation and structured drafting — **Evidence A**

#### Production constrained decoding

OpenAI **Structured Outputs** (2024-08-06): model outputs match developer JSON Schema via constrained decoding (CFG) + model training; function-calling `strict: true` and `response_format.json_schema` ([announcement](https://openai.com/index/introducing-structured-outputs-in-the-api/), [docs](https://developers.openai.com/api/docs/guides/structured-outputs)). Claims 100% schema match on their internal complex-schema eval for `gpt-4o-2024-08-06` vs <40% for older unconstrained models ([same announcement](https://openai.com/index/introducing-structured-outputs-in-the-api/)).

Open-source / local:

- Outlines ([github.com/dottxt-ai/outlines](https://github.com/dottxt-ai/outlines); original paper [arXiv:2307.09702](https://arxiv.org/abs/2307.09702))
- Guidance / llguidance ([github.com/guidance-ai/llguidance](https://github.com/guidance-ai/llguidance))
- XGrammar, llama.cpp grammars, SGLang
- Benchmark: JSONSchemaBench ([arXiv:2501.10868](https://arxiv.org/html/2501.10868v1), [OpenReview](https://openreview.net/forum?id=FKOaJqKoio))

#### Mapping ontology → generation constraints

Practical pattern (widely used, even if not always named “ontology”):

1. Ontology/class enum → JSON Schema `enum`
2. Required rhetorical sections (DEO Introduction / Methods…) → required object keys
3. Cardinality axioms → `minItems` / required arrays (where schema dialect supports them)
4. Tool schemas for “insert claim limitation” actions

**Critical failure mode (must internalize for patent drafting):** constrained decoding enforces *form*, not *truth*. Models still invent citations, misstate claim scope, or fill valid fields with nonsense ([OpenAI limitations section](https://openai.com/index/introducing-structured-outputs-in-the-api/); [Friendli “more than guided generation”](https://friendli.ai/blog/structured-output)). Mitigation: retrieval of ground-truth spans + post-generation SHACL/Schema decode + human approve.

#### Structured drafting for legal documents

Patterns observed:

- Multi-step agent: retrieve → outline (schema) → section fill → cite check
- Template skeletons as first-class schema (office-action response: Summary of Invention, Claim amendments, Argument under §103…)
- Ontology prompt templates (FOLIO classify-*) as *classification* side-channel, not full brief generation

There is **not** (as of this survey) a single dominant open patent-drafting ontology with GraphRAG maturity comparable to biomedical UMLS pipelines; practitioners compose USPTO structure + firm playbooks + general legal taxonomies (FOLIO document types / areas of law).

---

### 3.7 Document-structure-aware chunking — **Evidence A/B**

Chunking is the highest-ROI “ontology-adjacent” technique for document-heavy agents.

#### Industry practice

- Hierarchical / recursive separators (heading → paragraph → sentence) ([Databricks chunking guide](https://community.databricks.com/t5/technical-blog/the-ultimate-guide-to-chunking-strategies-for-rag-applications/ba-p/113089))
- Markdown structure-aware chunking for headers, tables, code, lists ([Dell InfoHub](https://infohub.delltechnologies.com/en-us/p/chunk-twice-retrieve-once-rag-chunking-strategies-optimized-for-different-content-types/))
- Hierarchical parent-child with auto-merge for enterprise docs ([Bisok hierarchical chunking](https://bisok.com/blog/hierarchical-chunking-with-auto-merge-for-better-enterprise-rag/))
- Practitioner claim: chunk strategy can beat embedding model swaps for recall ([r/Rag discussion](https://www.reddit.com/r/Rag/comments/1nvzl1b/why_chunking_strategy_decides_more_than_your/))

#### Research extensions

- **GraLC-RAG:** document structure graphs (section/subsection/paragraph/citation) + UMLS ontology signals + late chunking ([arXiv HTML 2603.22633](https://arxiv.org/html/2603.22633v1))
- **OWL-aware chunking** study comparing ontology-informed vs text-only splits ([dev.to](https://dev.to/vishalmysore/owl-aware-chunking-strategies-a-comprehensive-performance-analysis-6pa))
- Knowledge-graph path-aware chunking ([LinkedIn / Mysore](https://www.linkedin.com/pulse/knowledge-graph-chunking-rag-neo4j-path-aware-vector-store-mysore-hiulc))

#### Mapping to SPAR DOCO / PO (beep-effect specific)

From this packet’s own RESEARCH.md and SPAR specs:

- **PO** patterns (Block/Inline/Atom/Milestone/Popup/Container/HeadedContainer/Table) are already latent in `@beep/md` recursive unions ([PO spec](https://sparontologies.github.io/po/current/po.html)).
- **DOCO** supplies document-component classes (Section, Paragraph, FrontMatter, …) ([DOCO spec](https://sparontologies.github.io/doco/current/doco.html)).
- **DEO** supplies rhetorical classes (Introduction, Methods, …) orthogonal to structure ([DEO via DOCO import](http://purl.org/spar/deo)).

**Agent-facing chunk design that fits beep-effect:**

1. Canonical unit = AST node id (not character offsets alone).
2. Retrieval atom = DOCO-typed segment (e.g., `doco:Section` fold from heading sequence) with optional DEO rhetoric tag as annotation (OA + PROV).
3. Never re-chunk by raw tokens across claim boundaries.
4. Parent context injection: child paragraph chunk carries breadcrumb path `Application > Claims > Claim 1 > limitation (b)`.

This is “ontology-informed chunking” without requiring a full OWL reasoner at index time.

---

### 3.8 LlamaIndex / LangChain / framework property graphs — **Evidence A**

Frameworks made hybrid graph RAG accessible:

- LlamaIndex PropertyGraphIndex and knowledge-graph agents ([LlamaIndex KG agents blog](https://www.llamaindex.ai/blog/building-knowledge-graph-agents-with-llamaindex-workflows), [KG RAG query engine docs](https://developers.llamaindex.ai/python/examples/query_engine/knowledge_graph_rag_query_engine/))
- LangChain Ontotext GraphDB integration ([Ontotext blog](https://www.ontotext.com/blog/natural-language-querying-of-graphdb-in-langchain/))
- Memgraph + LlamaIndex/LangChain improvements ([Memgraph blog](https://memgraph.com/blog/improved-knowledge-graph-creation-langchain-llamaindex))
- Comparison landscape: Neo4j GraphRAG vs LlamaIndex vs LangChain transformers ([Atlan comparison](https://atlan.com/know/ai-agent/knowledge-graph/neo4j-graphrag-vs-llamaindex-vs-langchain/))

**Beep-effect note:** you are Effect-first, not LangChain-first. Steal the *patterns* (property graph + hybrid retrievers + tool adapters), not the dependency tree. MCP remains the cleaner agent boundary for a professional desktop host.

---

## 4. What actually improves retrieval and drafting quality?

Cross-cutting findings with citations:

### 4.1 Retrieval quality

| Lever | Evidence | Effect |
| --- | --- | --- |
| Structure-preserving chunks | Industry + GraLC-RAG | Higher precision on section-local questions |
| Explicit entity-relation paths | GraphRAG, Neo4j VectorCypher | Better multi-hop than pure vectors |
| Ontology-grounded facts | OG-RAG | Large gains on fact recall/correctness in evals |
| Community / dual-level summaries | GraphRAG global, LightRAG | Better theme-level questions |
| Lazy evaluation | LazyGraphRAG | Near-parity quality at fraction of cost |
| Schema-constrained extraction | TGDK schema study; OG-RAG | Reduces entity noise |

### 4.2 Drafting quality

| Lever | Evidence | Effect |
| --- | --- | --- |
| Structured section schemas | OpenAI SO, legal templates | Valid document shape; fewer missing sections |
| Cite-from-retrieved-facts | OG-RAG attribution; GraphRAG source links | Faster human verification |
| Ontology tool calls mid-draft | FOLIO MCP classify tools | Consistent document-type / area-of-law tags |
| Guardrails outside the model | TypeDB / SHACL / Schema decode | Soft prompt rules become hard rejects |

### 4.3 Negative results / anti-patterns

1. **Whole-ontology prompt stuffing** — burns tokens; Graphwise explicitly warns large ontologies should not be injected wholesale ([blog](https://graphwise.ai/blog/querying-diverse-datasets-with-mcp/)).
2. **Schema-valid hallucination** — Structured Outputs prevent bad JSON, not bad law ([OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/)).
3. **Unconstrained Text2SPARQL/Cypher writes** — demo-friendly, production-hostile.
4. **Full GraphRAG on every desktop session** — cost and latency wrong for interactive drafting (use Lazy/Light/local hybrid).
5. **Ignoring document structure** — claim text split mid-limitation destroys agent reasoning.

---

## 5. Ranked shortlist of tools/ontologies (with licenses)

### 5.1 Integration frameworks & systems

| # | Name | Role | License (published) | URL | Real-world use signal |
| --- | --- | --- | --- | --- | --- |
| 1 | Model Context Protocol | Agent–tool standard | Open standard | https://modelcontextprotocol.io/ | Default 2025–26 agent wiring |
| 2 | Microsoft GraphRAG | Index + global/local graph RAG | MIT | https://github.com/microsoft/graphrag | Flagship OSS; Azure samples |
| 3 | LazyGraphRAG | Cheap graph-enabled RAG | MSR tech; via Discovery/Azure | https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/ | Cost-quality SOTA claims |
| 4 | LightRAG | Lightweight GraphRAG | MIT | https://github.com/HKUDS/LightRAG | High OSS adoption |
| 5 | Neo4j GraphRAG + MCP | Property-graph RAG tools | Neo4j product + OSS servers | https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/ | Strong vendor+community |
| 6 | GraphDB / Graphwise MCP | RDF/SPARQL agent tools | Commercial GraphDB + community MCP | https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/ | Semantic-web production |
| 7 | FOLIO MCP | Legal ontology tools | FOLIO CC-BY; MCP package OSS | https://github.com/alea-institute/folio-mcp | Legal-domain native |
| 8 | OG-RAG | Ontology-grounded hypergraph RAG | Paper CC BY-NC-SA; check code | https://arxiv.org/abs/2412.15235 | Strong evals; legal listed |
| 9 | OpenAI Structured Outputs | Constrained generation | Proprietary API | https://developers.openai.com/api/docs/guides/structured-outputs | Massive production use |
| 10 | Outlines / Guidance | Local constrained decoding | Open source (see repos) | https://github.com/dottxt-ai/outlines · https://github.com/guidance-ai/llguidance | OSS standard |
| 11 | LlamaIndex PropertyGraph | Framework KG RAG | LlamaIndex license (OSS core) | https://www.llamaindex.ai/ | Wide builder adoption |
| 12 | Awesome-GraphRAG survey | Landscape map | CC per repo | https://github.com/DEEP-PolyU/Awesome-GraphRAG · https://arxiv.org/abs/2501.13958 | Research compass |

### 5.2 Ontologies relevant to document structure + legal agents

| Ontology | Domain | License note | URL | Agent use |
| --- | --- | --- | --- | --- |
| DOCO | Document components | CC-BY 4.0 (spec header; verify repo) | https://sparontologies.github.io/doco/current/doco.html | Structural chunk types, section KG |
| PO | Content-model patterns | Verify before vendor | https://sparontologies.github.io/po/current/po.html | AST conservation laws |
| DEO | Discourse/rhetoric | Via SPAR; verify | http://purl.org/spar/deo | Rhetorical annotations |
| FOLIO | Legal concepts | CC-BY (project) | https://openlegalstandard.org/ · https://github.com/alea-institute/FOLIO | Classify docs, law areas, entities |
| OA (W3C) | Web Annotation | W3C | https://www.w3.org/TR/annotation-model/ | Anchors on AST node ids |
| PROV-O | Provenance | W3C | https://www.w3.org/TR/prov-o/ | Draft lineage, agent actions |
| DCTERMS | Metadata | DCMI | https://www.dublincore.org/specifications/dublin-core/dcmi-terms/ | Document metadata |
| SKOS | Thesauri | W3C | https://www.w3.org/TR/skos-reference/ | Concept schemes, altLabels |
| SNaP (news; used in OG-RAG) | News events | IPTC third-party | https://iptc.org/thirdparty/snap-ontology/ | Example of domain ontology grounding |

---

## 6. Architecture patterns for agents (reference designs)

### 6.1 Pattern A — “Tool-first legal ontology agent” (recommended baseline)

```
User ↔ Professional Desktop Agent Host
          │
          ├─ MCP: FOLIO (search/browse/export/classify templates)
          ├─ MCP/Tools: Matter KG (claims, citations, prior art) — Cypher or SPARQL templates
          ├─ Tool: Document structure index (DOCO-typed chunks from @beep/md)
          ├─ Tool: Vector retriever over chunk embeddings
          └─ Generator: schema-constrained section draft → Schema decode → human review
```

Evidence base: FOLIO MCP ([announcement](https://openlegalstandard.org/folio-mcp-server-ai-agents)), Neo4j MCP ([guide](https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/)), Structured Outputs ([OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/)).

### 6.2 Pattern B — “OG-RAG-style fact hypergraph” (for high-precision Q&A)

```
Domain ontology (patent procedure + DOCO structure)
        │
        ▼
LLM map docs → ontology-shaped factual blocks (JSON-LD)
        │
        ▼
Hypergraph index (fact clusters)
        │
        ▼
Query → node similarity → greedy hyperedge cover → LLM answer + attribution UI
```

Evidence: [OG-RAG paper](https://arxiv.org/abs/2412.15235).

### 6.3 Pattern C — “Lazy community exploration” (for large corpora)

Use when agents must answer *global* questions over many dockets or a large prior-art library without full GraphRAG indexing cost ([LazyGraphRAG](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)).

### 6.4 Pattern D — “Ontology-constrained draft compiler”

```
Effect Schema (section tree)  ←── DOCO/DEO enums
        │
        ▼
Constrained decode / strict tools
        │
        ▼
Validate against firm checklist + retrieved claim text equality checks
```

Evidence: OpenAI SO + schema-first repo doctrine; failure modes documented in same sources.

---

## 7. Failure modes checklist (agent ops)

1. **Token blow-up:** large ontology or full community summaries in every turn.
2. **Stale graph:** claim amendments not re-indexed; agent argues deleted limitations.
3. **Predicate hallucination:** Text2SPARQL invents `ex:hasClaimScope`.
4. **Over-retrieval:** hybrid retrievers dump 50 chunks; model loses the rejection ground.
5. **Under-structure:** free text chunks split mid-claim.
6. **False confidence from valid JSON:** schema-ok draft with wrong law.
7. **Write tools without RBAC:** agent deletes graph nodes.
8. **License contamination:** NC research code (check OG-RAG license) in commercial product.
9. **Jurisdiction mismatch:** FOLIO global concepts ≠ USPTO claim practice specifics.
10. **Evaluation theater:** win-rate LLM-as-judge (GraphRAG style) without lawyer review.

---

## 8. Fit for beep-effect

### 8.1 What you already have (leverage)

From packet RESEARCH.md and SOURCES.md:

- Canonical **schema-first ASTs**: `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema` — PO patterns already enforced as typed unions.
- RDF vocabs: OA, PROV, DCTERMS, SKOS, OWL modules + generated terms.
- **TaxonomyLoader / TaxonomyRegistry** ingesting TTL/JSON-LD — DOCO/FOLIO-ready.
- Professional desktop as the agent surface.
- Prior assessment of SPAR DOCO / PO / DEO.

### 8.2 Recommended adoption stack (ordered)

| Priority | Adopt | How | Why |
| --- | --- | --- | --- |
| P0 | Structure-aware chunking via DOCO folds over `@beep/md` | Derive section tree; chunk by section/paragraph; store node ids | Highest ROI; unique to your AST stack |
| P0 | Ontology-as-tool, not prompt dump | MCP or Effect tools: concept search, section type lookup | Matches 2025–26 production pattern (FOLIO/Neo4j/GraphDB) |
| P1 | FOLIO for legal *matter* classification | Integrate folio-mcp or reimplement tools against `@beep/ontology` | 18k concepts, CC-BY, agent-native ([FOLIO MCP](https://openlegalstandard.org/folio-mcp-server-ai-agents)) |
| P1 | Schema-constrained drafting | Effect Schema ↔ JSON Schema for OA response / application sections | Production SO pattern; aligns with schema-first law |
| P1 | Hybrid retrieval | Vector over structure chunks + path queries on claim/citation graph | Standard GraphRAG hybrid win |
| P2 | OG-RAG-like fact mapping for patent procedure ontology | Small proprietary ontology for rejections, statutes, claim dependencies | Best academic match to “ontology-grounded” legal QA |
| P2 | LightRAG / Lazy-style indexing for large prior-art sets | Cost-aware global questions | Avoid full GraphRAG cost cliff |
| P3 | Full Microsoft GraphRAG | Only if Azure/enterprise offline analysis | Ops heavy for desktop |
| Avoid | Full OWL dump in system prompt | — | Token and reliability failure |
| Avoid | Free-form write SPARQL from agent | Prefer templates | Safety |

### 8.3 Document-structure rules as agent tools

Expose tools shaped like:

- `get_document_outline(docId)` → DOCO-typed tree
- `get_section(docId, sectionId)` → AST slice + prose
- `search_sections(query, type?: DocoClass)`
- `annotate_rhetoric(nodeId, DeoClass)` via OA
- `validate_draft(sectionSchema, draftAst)`

Rhetoric stays an **annotation layer** (OA + DEO), never a second syntax AST — consistent with this packet’s session take.

### 8.4 Patent-specific caution

- No widely deployed open **patent claim ontology** with GraphRAG-level maturity was found at the same depth as biomedical UMLS or FOLIO’s legal *practice* taxonomy.
- USPTO/EPO document structure standards (assessed in sibling lane `02-legal-document-structure`) should feed **section schemas** and chunk boundaries, not be replaced by free GraphRAG entity types.
- Agent value is highest when: (1) claim graph is explicit, (2) rejection grounds are structured facts, (3) draft sections are schema-valid, (4) every assertion cites a retrieved span or docket node.

### 8.5 Suggested evaluation protocol (for later goals/)

When you implement:

1. **Retrieval:** context recall / entity recall on multi-hop OA questions (RAGAS-style as in OG-RAG) ([OG-RAG metrics](https://arxiv.org/html/2412.15235v1)).
2. **Structure:** % of retrieved chunks that respect claim/section boundaries.
3. **Draft:** schema validity rate + lawyer rubric (not LLM-only win rates).
4. **Cost:** $/query and index cost vs LazyGraphRAG baselines.
5. **Attribution time:** human time to verify a citation (OG-RAG’s +30% faster is the right *kind* of metric).

### 8.6 Bottom line

For beep-effect’s professional desktop agents, the 2025–2026 evidence says:

> **Wire ontologies as tools and as chunk/schema grammar; retrieve with hybrid structure+graph methods; constrain drafts with schemas; never rely on ontology-stuffed prompts or schema-valid generation alone for legal truth.**

Your existing schema-first ASTs + RDF + taxonomy loader put you *ahead* of teams still bolting GraphRAG onto PDFs. The missing product pieces are mostly: DOCO-typed retrieval atoms, FOLIO-class matter tagging tools, claim-graph hybrid search, and Effect-schema drafting loops with citation checks.

---

## 9. Source index (URLs cited)

### Research & papers
- https://arxiv.org/abs/2404.16130 — GraphRAG (local→global)
- https://arxiv.org/abs/2412.15235 — OG-RAG
- https://arxiv.org/html/2412.15235v1 — OG-RAG full HTML
- https://arxiv.org/abs/2410.05779 — LightRAG
- https://arxiv.org/abs/2501.13958 — Survey of GraphRAG
- https://arxiv.org/abs/2501.10868 — JSONSchemaBench / constrained decoding
- https://arxiv.org/html/2501.10868v1
- https://arxiv.org/abs/2511.05991 — Ontology learning vs GraphRAG impact
- https://arxiv.org/html/2603.22633v1 — GraLC-RAG structure-aware late chunking
- https://arxiv.org/abs/2407.10805 — Think-on-Graph 2.0
- https://arxiv.org/abs/2502.14802 — HippoRAG2
- https://openreview.net/forum?id=nnVO1PvbTv — Think-on-Graph
- https://openreview.net/forum?id=ZGNWW7xZ6Q — Reasoning on Graphs
- https://openreview.net/forum?id=FKOaJqKoio — JSONSchemaBench
- https://drops.dagstuhl.de/entities/document/10.4230/TGDK.3.2.3 — GraphRAG + schema impact

### Vendor / product docs
- https://microsoft.github.io/graphrag/
- https://www.microsoft.com/en-us/research/project/graphrag/
- https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/
- https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/
- https://github.com/microsoft/graphrag
- https://github.com/microsoft/ograg2
- https://github.com/HKUDS/LightRAG
- https://github.com/gusye1234/nano-graphrag
- https://github.com/DEEP-PolyU/Awesome-GraphRAG
- https://neo4j.com/developer/genai-ecosystem/model-context-protocol-mcp/
- https://neo4j.com/blog/developer/neo4j-graphrag-retrievers-as-mcp-server/
- https://neo4j.com/developer/genai-ecosystem/aura-agent-getting-started/
- https://neo4j.com/nodes-2025/agenda/ontology-creation-with-the-neo4j-data-modeling-mcp-server/
- https://github.com/neo4j/mcp
- https://github.com/neo4j-contrib/mcp-neo4j
- https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/
- https://graphwise.ai/blog/querying-diverse-datasets-with-mcp/
- https://www.ontotext.com/blog/natural-language-querying-of-graphdb-in-langchain/
- https://github.com/keonchennl/mcp-server-graphdb
- https://openai.com/index/introducing-structured-outputs-in-the-api/
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://modelcontextprotocol.io/
- https://www.llamaindex.ai/blog/building-knowledge-graph-agents-with-llamaindex-workflows
- https://developers.llamaindex.ai/python/examples/query_engine/knowledge_graph_rag_query_engine/
- https://memgraph.com/blog/improved-knowledge-graph-creation-langchain-llamaindex

### Legal ontology / MCP
- https://openlegalstandard.org/
- https://openlegalstandard.org/folio-mcp-server-ai-agents
- https://openlegalstandard.org/resources/folio-mcp
- https://github.com/alea-institute/folio-mcp
- https://github.com/alea-institute/FOLIO
- https://pypi.org/project/folio-mcp/
- https://aleainstitute.ai/blog/posts/folio-api-mcp-tools/

### Document structure ontologies
- https://sparontologies.github.io/doco/current/doco.html
- https://sparontologies.github.io/po/current/po.html
- http://purl.org/spar/deo
- https://www.w3.org/TR/annotation-model/
- https://www.w3.org/TR/prov-o/
- https://www.dublincore.org/specifications/dublin-core/dcmi-terms/
- https://www.w3.org/TR/skos-reference/
- https://iptc.org/thirdparty/snap-ontology/

### Chunking / engineering blogs
- https://infohub.delltechnologies.com/en-us/p/chunk-twice-retrieve-once-rag-chunking-strategies-optimized-for-different-content-types/
- https://community.databricks.com/t5/technical-blog/the-ultimate-guide-to-chunking-strategies-for-rag-applications/ba-p/113089
- https://bisok.com/blog/hierarchical-chunking-with-auto-merge-for-better-enterprise-rag/
- https://dev.to/vishalmysore/owl-aware-chunking-strategies-a-comprehensive-performance-analysis-6pa
- https://atlan.com/know/what-is-graphrag/
- https://atlan.com/know/ai-agent/knowledge-graph/neo4j-graphrag-vs-llamaindex-vs-langchain/
- https://medium.com/graph-praxis/the-graphrag-cost-cliff-how-33-000-became-33-in-eighteen-months-be1b0fbe37e4
- https://friendli.ai/blog/structured-output
- https://typedb.com/blog/why-agents-need-ontologies
- https://kenhuangus.substack.com/p/why-ontology-matters-for-agentic
- https://dlthub.com/blog/ontology-engineering
- https://pub.towardsai.net/designing-ontology-aware-tooling-for-agents-61035921af1c
- https://github.com/Azure-Samples/graphrag-legalcases-postgres

### Constrained decoding OSS
- https://github.com/dottxt-ai/outlines
- https://github.com/guidance-ai/llguidance
- https://arxiv.org/abs/2307.09702

---

## 10. Confidence & gaps

| Area | Confidence | Gap |
| --- | --- | --- |
| GraphRAG cost/quality trajectory | High | Exact $ figures vary by corpus; cite MSR relative % not absolute |
| FOLIO MCP production depth | Medium–high | Public launch 2026-03; court/clinic case studies still thin |
| OG-RAG legal domain transfer | Medium | Evals on agriculture/news; legal claimed but not primary dataset |
| Patent-specific ontology+agent systems | Low–medium | Fragmented proprietary tools; less open literature than biomedical |
| Effect/TypeScript-native GraphRAG stacks | Low | Most stacks Python; beep will reimplement patterns |

---

*End of report. Companion lanes: `01-metadata-ontologies.md`, `02-legal-document-structure.md`, `03-folio-and-legal-kg.md`, `05-x-and-practitioner-signal.md`.*
