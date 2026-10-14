# Research foundations for the beep-effect white paper

**beep-effect occupies an entirely uncontested position in the developer tooling landscape.** No existing tool combines knowledge graph reasoning, structured output schemas derived from tag metadata, deterministic-first multi-layer extraction, and closed-loop hallucination verification into a single automated JSDoc generation system. This research report compiles the technical evidence, competitive analysis, mathematical foundations, and architectural patterns needed to write a comprehensive white paper for engineers who would build or contribute to the system.

---

## The TypeScript documentation crisis is real but undermeasured

The most striking finding across documentation research is a paradox: **no published study systematically measures JSDoc/TSDoc coverage rates across the TypeScript ecosystem**, despite TypeScript's explosive growth to **~115 million weekly npm downloads** as of 2025. This measurement gap itself signals the severity of the problem—the crisis is so pervasive it hasn't been formally quantified for JavaScript/TypeScript specifically.

The data that does exist paints a grim picture. Developers spend **only 16% of their time on actual application development** (IDC, February 2025), with **42% of a 41.1-hour work week consumed by technical debt and bad code** (Stripe Developer Coefficient, 2018). The Atlassian/DX Developer Experience Report (2024, 2,100+ developers) found that **69% of developers lose 8+ hours per week to inefficiencies**, with the majority attributing time loss to "tech debt or insufficient documentation." Developers spend **up to 70% of their time understanding existing code** rather than writing new features (Lin & Robles). The annual cost: Stripe estimates **$85 billion in lost developer productivity** globally.

Open-source documentation quality data, while mostly Java-focused, reinforces the problem. A FreeBSD study by Spinellis found **fewer than 1 comment per 100 lines of code** across 307 projects. A study of the top 100 GitHub Java repositories found **46.7% of TODO comments are "low-quality"**—ambiguous, uninformative, or useless. ACM Transactions on Intelligent Systems and Technology (2022) states bluntly: "Few software projects adequately document the code to reduce future maintenance cost."

The TypeScript ecosystem's scale amplifies these gaps. The npm registry hosts **2.5+ million live packages** with **184+ billion downloads per month** (Socket.dev, 2023). **85% of the top 1,000 npm packages** ship with TypeScript types. TypeScript-first frameworks like NestJS, Zod, and ts-node show **50–120% year-over-year growth**. Node.js natively supports TypeScript as of version 22.18.0. Yet documentation tooling has not kept pace.

### LLM documentation generation fails in specific, predictable ways

Research on code hallucinations reveals systematic failure modes that explain why naive LLM-based documentation generation produces unreliable results:

**CodeHalu (AAAI 2025, Tian et al.)** established the definitive taxonomy across **8,883 samples from 699 tasks** evaluated on **17 mainstream LLMs**. It identifies four major categories: **Mapping Hallucinations** (misunderstanding how code parts relate), **Naming Hallucinations** (incorrect variable/function/API names), **Resource Hallucinations** (fabricating non-existent libraries or APIs), and **Logic Hallucinations** (syntactically correct but logically flawed code). The cross-task occurrence rate averages only **2.04%**, confirming these categories are independent failure modes.

**Package hallucinations affect all 16 tested coding models** at an average rate of **19.6%** across Python and JavaScript ecosystems (Spracklen et al., USENIX Security 2025). LLMs cannot reliably detect their own hallucinated packages, creating a security risk called "slopsquatting."

**"Beyond Functional Correctness" (Liu et al., 2024, ACM SIGSOFT)** documented hallucinations specific to repository-level generation, identifying **12 subcategories across 3 primary categories**. The critical finding: LLMs fail on **"project context conflicts"**—they cannot reason about cross-file dependencies, development environment constraints, or code repository structures. RAG-based mitigation showed only modest improvement.

These failures map directly to documentation generation: single-file context limitation prevents cross-file dependency tracking, behavioral claims get hallucinated because the LLM lacks call-graph context, and structural claims (parameter types, return types) get approximated when they could be deterministically extracted.

---

## No existing tool combines all four pillars

The competitive landscape divides into two categories that never overlap: **commercial documentation generators** (LLM-only, no knowledge graphs) and **academic code knowledge graph systems** (no structured documentation output, no hallucination verification).

### Commercial documentation tools: LLM in, text out, hope for the best

Every commercial JSDoc generation tool follows the same pattern: send code to an LLM, receive documentation, and trust the user to review it. None uses a knowledge graph, none performs deterministic extraction before LLM enrichment, and none validates output against the actual codebase.

**Mintlify** is the largest player with **5,000+ companies** (Anthropic, Vercel, PayPal) and an **$18.5M Series A from a16z** (September 2024). Its Doc Writer extension generates free-form docstrings at single-function scope. Testing shows it produces inconsistent outputs across runs and is confused by misleading function names. The Platform Agent has repo-level context but no knowledge graph or structured schema enforcement. Mintlify acquired Trieve (AI retrieval) in July 2025, signaling a move toward better context but still without deterministic extraction.

**JetBrains AI** ("Write Documentation") comes closest to leveraging code intelligence. The IDE provides deep symbol resolution, type information, and project structure as context to the LLM. Users can customize prompts to enforce documentation patterns. However, there is no knowledge graph, no structured schema enforcement, and no hallucination validation. Users report credit consumption concerns and inconsistency across similar code patterns. RAG-based multi-file context was added in 2025.1.

**GitHub Copilot** treats documentation as a byproduct of code completion. JSDoc generation occurs when typing `/**` or using the `/doc` chat command. A **known bug (GitHub Discussion #13636)** causes Copilot to suggest synonym parameter names instead of actual function parameter names—exactly the failure mode that deterministic extraction prevents. Enterprise adds codebase knowledge bases but still lacks validation.

**CodeDocs AI** (5 VS Code installs), **Workik** (RAG-based repo indexing, broad platform), **Trelent** (appears to have pivoted away from documentation), and **doctypes** (archived June 2025, 7 GitHub stars) round out the field. None use knowledge graphs. Only Workik has repo-level context via RAG. The **Docstring Auditor** (a GitHub Action for Python) is the only tool that validates existing docstrings against code, but it's a separate post-hoc auditing tool, not integrated into generation.

### Academic code knowledge graph systems: graphs without documentation output

**CodexGraph (NAACL 2025, Liu et al.)** demonstrates the power of code knowledge graphs with LLM agents. It builds code graphs in Neo4j, then uses a dual-agent system where one LLM writes natural language queries and another translates them to Cypher. It achieves **36.02% pass@1 on EvoCodeBench** with GPT-4o and up to **94.3% improvement on cross-file dependency tasks** (GraphCodeAgent extension). However, CodexGraph targets code navigation and completion, not documentation generation, and has **no hallucination verification loop**.

**GraphGen4Code (IBM, K-CAP 2021, Abdelaziz et al.)** operates at massive scale: **2 billion RDF triples** from **1.3 million Python files** and **47 million forum posts**, using WALA static analysis. It captures ~86% of function calls. However, it predates LLMs and has no documentation generation capability.

**code-graph-rag** (1,992 GitHub stars) combines Tree-sitter parsing, Memgraph storage, and LLM-powered Cypher generation with MCP server integration. It includes surgical code replacement and multi-language support but lacks hallucination verification.

**GraphCodeAgent (arXiv 2025, Li et al.)** uses dual graphs (Requirement Graph + Structural-Semantic Code Graph) with a ReAct-style agent loop, achieving **+43.81% relative improvement on DevEval** with GPT-4o. Like CodexGraph, it targets code generation, not documentation.

**RepoAgent (EMNLP 2024, Tsinghua/Siemens)** is the closest academic system to beep-effect's goals. It performs three-stage documentation generation: global structure analysis via AST, LLM-powered doc generation using call graph context, and git pre-commit hook integration for updates. It outperformed human-authored documentation in blind preference tests. However, RepoAgent **lacks a knowledge graph** (uses topological sorting, not graph reasoning), has **no structured output schemas**, and has **no hallucination verification**.

### The ETF and FORGE papers validate the beep-effect approach

**ETF (Entity Tracing Framework, ACL 2025, Maharaj et al.)** is the most directly relevant academic work. It detects hallucinations in code summaries by: (1) extracting entities from code via static analysis, (2) extracting entities from LLM-generated summaries, (3) matching entities between the two, and (4) verifying entity-intent accuracy. It achieves **0.73 F1** with GPT-4-Omni versus **0.28 for direct approaches**—a 2.6x improvement. ETF validates the principle that deterministic code analysis must ground LLM-generated documentation.

**FORGE (IEEE/ACM 2026, Khati et al.)** demonstrates deterministic AST analysis for hallucination detection and correction in LLM-generated code. Using AST parsing and a dynamically generated knowledge base of library signatures, it achieves **100% detection precision** and **77% fix accuracy** across 200 Python snippets. Missing import fixes succeed at **97.9%**. FORGE validates the "deterministic-first" principle—structural facts should never be left to probabilistic generation.

### Competitive positioning summary

| Capability | Mintlify | JetBrains AI | Copilot | CodexGraph | RepoAgent | ETF | FORGE | **beep-effect** |
|---|---|---|---|---|---|---|---|---|
| Knowledge graph reasoning | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | **✅** |
| Structured output schemas | ❌ | ❌ | ❌ | ✅ | ✅ | Partial | ✅ | **✅** |
| Deterministic-first extraction | ❌ | Partial | ❌ | ✅ | ✅ | ✅ | ✅✅ | **✅** |
| Closed-loop hallucination verification | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | **✅** |
| All four combined | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |

**Potential future competitors**: JetBrains holds an IDE integration advantage with deep code intelligence already feeding their LLM. GitHub/Microsoft's GraphRAG research could extend Copilot with knowledge graph capabilities. Neither currently combines all four pillars.

---

## Mathematical foundations: fibrations, OWL 2 RL, and forward chaining

### Grothendieck fibrations model the schema-instance factoring

A **Grothendieck fibration** is a functor `p : E → B` between categories where for every morphism in the base and every object in the fiber, a *Cartesian lift* exists. The **fiber** `E_B` over an object `B` is the subcategory of objects mapping to `B`. A **section** `s : B → E` assigns to each base object an object in its fiber.

This formalism models beep-effect's schema design directly. The **base category B** represents JSDoc tag definitions (the constant metadata: tag name, description, constraints, validation rules). The **fiber E_b** over a tag definition `b` represents the possible instance payloads for that tag. The **projection** `p : E → B` maps each concrete tag value to its definition. Reindexing functors model how schema-level relationships (e.g., tag subtyping) transform instances.

The connection to dependent type theory is precise. In HoTT, a type family `P : A → Type` corresponds to a fibration with total space `Σ(x:A).P(x)`. The **dependent sum** (Σ-type) has terms `(a, b)` where `a : A` and `b : P(a)`—a tag identifier paired with its appropriately-typed payload. When `P` is constant (independent of `a`), the Σ-type degenerates to a product `A × B`. The dependent case captures the heterogeneity where different tags carry different payload schemas.

In Effect/Schema, this factoring is implemented through `mapFields` + `.annotate()`. The `JSDocTagDefinition.make()` function performs the fibration: it takes constant metadata (tag name, description, constraints) as annotations and produces a schema whose decode/encode targets are the fiber payload types. The **tag-values/ module** implements **113 fiber payload types across 11 files**, with **_fields.ts providing reusable compositions** (typeField, optionalType, nameField) that factor common structure. Annotations serve three roles simultaneously: agent context (telling the LLM what to generate), validation schema (constraining the output), and ts-morph write target (specifying how to emit the JSDoc).

Key references: Jacobs, *Categorical Logic and Type Theory* (1998); The Univalent Foundations Program, *Homotopy Type Theory* (2013, §2.7); Capriotti, "Families and Fibrations" (2013); Milewski, "Fibrations, Cleavages, and Lenses" (2019).

### OWL 2 RL provides PTime-guaranteed rule-based reasoning

The **OWL 2 RL profile** (W3C Recommendation, December 2012, https://www.w3.org/TR/owl2-profiles/) is specifically designed for rule-based implementation via forward chaining. Its formal complexity properties make it optimal for code knowledge graphs:

- **Data complexity: PTime-complete** for ontology consistency, class satisfiability, subsumption, instance checking, and conjunctive query answering
- **Combined complexity: NP-complete** for conjunctive query answering
- **Translates to Datalog**, inheriting Datalog's termination guarantees and optimization techniques

The foundational complexity result is from **ter Horst (2005)**: "Completeness, Decidability and Complexity of Entailment for RDF Schema and a Semantic Extension Involving the OWL Vocabulary" (*Journal of Web Semantics* 3(2-3): 79–115). ter Horst proved RDFS entailment is decidable, NP-complete in general, and **in P if the target graph contains no blank nodes**. For extensions involving OWL vocabulary (FunctionalProperty, sameAs, differentFrom, allValuesFrom), consistency checking remains in P.

The RDFS entailment rules form the core of the reasoning engine:

| Rule | Condition | Conclusion | Code application |
|------|-----------|------------|------------------|
| **rdfs9** | `C rdfs:subClassOf D . X rdf:type C .` | `X rdf:type D .` | Type hierarchy: instance of `UserService` is also instance of `BaseService` |
| **rdfs11** | `C rdfs:subClassOf D . D rdfs:subClassOf E .` | `C rdfs:subClassOf E .` | Transitive subclassing: `AdminService → UserService → BaseService` |
| **rdfs7** | `P rdfs:subPropertyOf Q . X P Y .` | `X Q Y .` | `imports rdfs:subPropertyOf dependsOn`: import implies dependency |
| **rdfs2** | `P rdfs:domain C . X P Y .` | `X rdf:type C .` | If `calls` has domain `Callable`, anything that calls is a `Callable` |
| **rdfs3** | `P rdfs:range C . X P Y .` | `Y rdf:type C .` | If `implements` has range `Interface`, anything implemented is an `Interface` |
| **rdfs5** | `P rdfs:subPropertyOf Q . Q rdfs:subPropertyOf R .` | `P rdfs:subPropertyOf R .` | Transitive property hierarchies |

**Runtime optimization** (Komazec et al., 2012): Only rdfs2, rdfs3, rdfs7, and rdfs9 require runtime evaluation. Rules rdfs5, rdfs11, and others have only TBox statements in their bodies and can be pre-computed at schema-load time.

### Forward chaining with incremental update algorithms

Forward chaining computes the fixpoint `P∞(E)`—the smallest superset of explicit facts closed under all rules. For OWL 2 RL (translatable to Datalog without function symbols), the Herbrand base is finite, so **termination is guaranteed** and the fixpoint is reached in polynomially many steps.

**Seminaïve evaluation** avoids redundant re-derivation by tracking only newly derived facts: `ΔI_{i+1} = T_P(I_i) \ I_i`. Terminate when `ΔI_{i+1} = ∅`.

The **DRed algorithm (Gupta, Mumick & Subrahmanian, SIGMOD 1993)** handles deletions via three phases: overdeletion (propagate deleted facts forward), deletion (remove from materialization), and rederivation (attempt to re-derive from remaining facts). Its weakness: overdeletion can be expensive when facts have many alternative derivations.

The **B/F algorithm (Motik, Nenov, Piro & Horrocks, AAAI 2015)** improves on DRed by using **backward chaining** to check for alternative derivations before deleting. "The B/F algorithm was several orders of magnitude more efficient than DRed on some inputs, and was never significantly less efficient." Implemented in **RDFox**, which achieves speedups up to **87x**, handles **9.2 billion triples** at **36.9 bytes/triple**, imports at **1 million triples/second**, and reasons at **6.1 million triples/second**.

**JTMS (Justification-Based Truth Maintenance, Doyle 1979)** provides exact dependency tracking by recording justifications (rule + antecedent facts) for each derived fact. When a base fact is retracted, the JTMS traverses the justification graph to update belief statuses. JTMS avoids overdeletion entirely but requires significant memory for storing all justifications—impractical for very large knowledge graphs. The B/F algorithm is a middle ground: more precise than DRed without JTMS's memory overhead.

### Union-find canonicalization for owl:sameAs

Naive owl:sameAs materialization causes **quadratic blowup**: for a clique of `k` equal resources and `m` triples, materialization grows to `O(k² × m)`. **Motik et al. (AAAI 2015)** solved this via rewriting: maintain a representative mapping `ρ` using union-find (disjoint-set) with path compression and union by rank. Each operation costs `O(α(n))` (inverse Ackermann—effectively constant). Results: **up to 7.8x reduction in materialized triples** and **31.1x reduction in materialization time**.

For code knowledge graphs, this handles re-exports, barrel files, and aliased imports efficiently. When `barrel/index.ts` re-exports `utils/format.ts#formatDate`, asserting `owl:sameAs` and calling `union()` maps both to a single canonical IRI without the N² explosion.

---

## System architecture: Effect-TS patterns and service design

### Effect-TS service architecture

The idiomatic Effect-TS pattern uses **Context.Service** for service identity, **Layer** for dependency injection, and **Effect.gen** for generator-based composition.

**Context.Service** declares a service as a class extending `Context.Service<Self, Shape>()("@app/ServiceName")`, 
binding a unique identifier to a service interface. **Key rules**: tag identifiers must be unique (use `@path/to/ServiceName` prefix), service methods should have `R = never` (dependencies handled via Layer, not leaked through method signatures), and use `readonly` properties.

**Layer** provides implementations via constructors: `Layer.succeed` (sync), `Layer.effect` (async), `Layer.scoped` (with lifecycle). Layers compose via `Layer.merge` (concurrent) and `Layer.provide` (dependency wiring). The idiomatic pattern co-locates `Live` and `Mock` layers as static properties on the Tag class.

**Effect.gen** works like async/await: `yield*` resolves services from context and sequences effects. The Requirements type parameter (`R`) automatically tracks all needed services.

### Effect/Schema v4 API

**Schema.Class** defines both a schema and an opaque TypeScript type simultaneously. Constructors validate properties (throwing `ParseError` on invalid input), and instances get automatic hashing and equality via `Data.Class`. **Schema.TaggedClass** adds a `_tag` discriminant field automatically. **Schema.Literal/Literals** creates simple string/number alternatives. **Schema.tag()** adds discriminant fields to structs. **.annotate()** adds metadata (JSON Schema annotations, custom metadata) to schemas.

Key v4 changes: `Schema.TaggedError` → `Schema.TaggedErrorClass`; `Schema.Codec<A, I, R>` is the new dual encode/decode type; `Model.Class` from `effect/schema` added.

### Vertical slice architecture

Vertical slice architecture organizes code by **features/use cases** rather than technical layers. Each slice is self-contained (handler + schema + test), minimizing cross-slice coupling. New features only add code—no changing shared abstractions. This aligns naturally with CQRS and works well in TypeScript monorepos where each bounded context can be its own package.

### FalkorDB vs Neo4j for code knowledge graphs

**FalkorDB** uses **sparse adjacency matrices** with **GraphBLAS-based execution** (linear algebra primitives), running as a C Redis module. Its benchmarks show significant advantages for code graphs:

- **7x less memory** for equivalent datasets (v4.8 benchmarks)
- **500x faster p99, 10x faster p50** for aggregate operations
- Sub-140ms consistent p99 latency vs multi-second under load for Neo4j
- **65% faster aggregation** with v4.8 COLLECT optimization
- Supports **10K+ isolated graphs per instance** for multi-tenancy

FalkorDB's wide fan-out performance suits code knowledge graphs (many relationships per node). Multi-hop traversals as matrix operations excel at dependency chain analysis. OpenCypher compatibility enables Neo4j query migration.

**Caveat**: Most benchmark data comes from FalkorDB's own marketing. Independent third-party benchmarks are limited. Neo4j retains advantages in mature ecosystem, ACID transactions, and deep/selective traversals.

**Key limitation**: FalkorDB has no built-in RDFS/OWL reasoning—inference rules must be implemented in the application layer.

### MCP server design

The **Model Context Protocol** (Anthropic, November 2024; donated to Linux Foundation's Agentic AI Foundation, December 2025) uses JSON-RPC 2.0 with three primitives:

- **Tools**: Executable functions (validate JSDoc, write JSDoc, query KG)
- **Resources**: Read-only data (tag database schema, KG subgraph for current file)
- **Prompts**: Reusable templates (enrichment templates per AST node kind)

The TypeScript SDK (`@modelcontextprotocol/sdk` v2, uses Zod v4) provides `McpServer` with `registerTool`, `registerResource`, and `registerPrompt` methods. Transports include **stdio** (for Claude Code/Desktop) and **Streamable HTTP** (for remote production servers). MCP is self-describing: any compatible client (Claude Code, Cursor, Windsurf) auto-discovers tools via initialization handshake.

### CI/CD integration patterns

**Turborepo `--affected`** scopes task execution to changed packages by comparing against a base branch. In CI (detached HEAD), use `TURBO_SCM_BASE` and `TURBO_SCM_HEAD` environment variables. This enables package-level scoping for documentation generation.

**TypeScript project references** create build dependencies (`tsc -b` auto-builds referenced projects). For internal packages, the recommended pattern exports raw TypeScript source with consuming apps handling transpilation. File-level scoping uses project references to track exactly which files depend on which.

---

## Knowledge graph design for TypeScript code

### Node and edge type taxonomy

Based on CodeOntology (ISWC 2017, 65 OWL classes, 86 object properties), SEON, SCRO (56 OWL classes), and practical TypeScript AST analysis, the standard types are:

**Node types**: Module, Class, Interface, Function, Method, Variable, TypeAlias, Parameter, Enum, Property, Namespace. All inherit from a root `CodeElement` class. `Function` and `Method` share a superclass `Callable`.

**Edge types**: CONTAINS (structural), CALLS (invocation), IMPLEMENTS (interface), EXTENDS (inheritance), IMPORTS/EXPORTS (module boundaries), THROWS (exceptions), RETURNS_TYPE/HAS_TYPE (type annotations), HAS_PARAMETER (parameters), OVERRIDES (method override), REFERENCES (name usage), DECORATES (decorator application).

**RDF triple mapping**: Each source file maps to a named graph. `<proj:src/models.ts#UserService> a code:Class ; rdfs:label "UserService" ; code:containedIn <proj:src/models.ts> ; code:implements <proj:src/interfaces.ts#IUserService>`. Named graphs enable efficient incremental updates—when a file changes, only its named graph is rebuilt.

### RDFS/OWL rules applied to code

**rdfs9 + rdfs11** propagate type information through inheritance hierarchies. If `AdminService extends UserService extends BaseService`, rdfs11 computes the transitive closure, and rdfs9 ensures any instance typed as `AdminService` is also typed as `BaseService`.

**rdfs7** enables abstract dependency relationships. Defining `imports rdfs:subPropertyOf dependsOn` and `calls rdfs:subPropertyOf dependsOn` automatically infers dependency edges from more specific relationships.

**rdfs2/rdfs3** infer types from usage. If `calls` has domain `Callable` and range `Callable`, any entity observed calling or being called is inferred to be a `Callable`.

**owl:sameAs** handles entity deduplication for re-exports (`barrel/index.ts#formatDate owl:sameAs utils/format.ts#formatDate`), aliased imports, and barrel files. Implemented via union-find canonicalization.

**owl:inverseOf** creates bidirectional edges: `calls/calledBy`, `imports/importedBy`, `contains/containedIn`, `extends/extendedBy`, `implements/implementedBy`. The reasoner infers inverses automatically.

**owl:TransitiveProperty** on `contains` and `dependsOn` computes transitive closures for containment hierarchies and dependency chains.

### Custom documentation propagation rules

**@throws propagation**: If `F calls G`, `G throws E`, and `F` doesn't catch `E`, then `F mayThrow E` (confidence 0.85, degrading with chain length).

**@inheritDoc resolution**: If `M overrides ParentM` and `ParentM` has documentation and `M` has `@inheritDoc`, inherit the documentation (following depth-first class hierarchy resolution).

**@deprecated cascading**: If `X isDeprecated` and `Y dependsOn X`, flag `Y` as having deprecated dependency (confidence 0.95 for direct, 0.7 for transitive).

**Interface contract inheritance**: If class `C implements I`, interface method `IM` has documentation, class method `CM overrides IM`, and `CM` lacks documentation, inherit `IM`'s documentation.

### Provenance and confidence tracking

| Tier | Confidence | Source | Example |
|------|-----------|--------|---------|
| Definite | **1.0** | AST-derived facts | `X rdf:type Class` from parser |
| Static analysis | **0.95** | Type checker, control flow | Return type inference, reachability |
| Direct inference | **0.85** | Single-hop RDFS/OWL rule | rdfs9 type propagation |
| Transitive inference | **0.7–0.8** | Multi-hop rule chains | Transitive @throws propagation |
| Heuristic | **0.5–0.7** | Pattern-based inference | "Likely deprecated" via dependency chain |

Confidence propagation: `confidence(inferred) = min(confidence(antecedents)) × rule_factor`. Provenance tracked via RDF-star or edge properties with W3C PROV-O alignment: `prov:wasGeneratedBy` (rule), `prov:wasDerivedFrom` (antecedent triples), `prov:generatedAtTime`.

### Incremental reasoning implementation

**Predicate-indexed forward chaining**: Maintain a `Map<string, Rule[]>` mapping predicates to rules referencing them. When triple `(S, P, O)` is added, lookup `predicateIndex[P]` in O(1), then match each candidate rule's full antecedent against the graph—overall O(n) per rule. This avoids scanning all rules for every new triple.

**Scoped inference**: When file `F` changes, restrict reasoning to: all triples in named graph `F`, all triples where any entity from `F` appears as subject or object, and all triples reachable via 1-hop from entities in `F`.

**JTMS-inspired dependency tracking**: Each inferred fact stores its justification (rule + antecedent facts) and consequence list. On retraction, traverse the justification graph: if no valid justification remains, set the consequence to OUT and recurse. This is O(k) where k = affected inferred facts.

---

## Multi-layer extraction pipeline and validation

### Three-layer deterministic-first architecture

**Layer 1 (tree-sitter + ts-morph, certainty 1.0)**: Deterministic AST extraction of parameter names, types, return types, class hierarchy, interface implementations, imports/exports. tree-sitter provides fast incremental parsing (used in VS Code, Neovim, Zed, GitHub navigation); ts-morph wraps the TypeScript Compiler API for full type system awareness with fluent navigation/manipulation APIs.

**Layer 2 (ts-morph static analysis, certainty 0.95)**: Call graphs, data flow analysis, thrown exception tracking, type inference from usage. ts-morph's TypeScript type checker integration enables symbol resolution, reachability analysis, and control flow tracking.

**Layer 3 (LLM agent enrichment, certainty varies)**: Behavioral descriptions, usage examples, semantic documentation. The agent receives pre-filled deterministic values so it cannot hallucinate structure. Context is a **2-hop ego network** from the knowledge graph. Task granularity: one API call per symbol.

The "agent only writes what it can't derive" principle means structural facts (parameter names, types, return types, class hierarchy) are never generated by the LLM—they're pre-filled from Layers 1–2. The agent focuses exclusively on semantic content that requires understanding intent.

### NLP service components

**Code-aware sentence splitting** uses the **mask-replace-split-restore** technique: identify code blocks, replace with placeholder tokens (`__CODE_BLOCK_0__`), apply standard sentence boundary detection (sbd library), restore placeholders. This prevents code like `console.log("Hello. World.")` from triggering false sentence boundaries.

**Token estimation**: Use **gpt-tokenizer** (npm) for exact OpenAI token counts with cl100k_base encoding. For Claude, use the **Anthropic countTokens API** (`POST /v1/messages/count_tokens`) for billing-grade accuracy; approximate with tiktoken p50k_base encoding (+15–20% margin) for offline estimation. Google Gemini provides a dedicated `countTokens` endpoint.

**AST-aware code chunking**: The **code-chunk** library (Supermemory) uses tree-sitter to parse code, then applies a recursive split-then-merge algorithm. Top-down traversal fits large AST nodes into single chunks; if a node exceeds chunk size, recurse into children; greedy merging combines adjacent small siblings. Uses non-whitespace character count as the size metric. The **cAST paper (Zhang et al., 2025)** shows StarCoder2-7B sees **+5.5 points on RepoEval** with AST chunking versus fixed-size.

**Context budget management** uses tiered graph serialization (5 levels of detail) with composite priority scoring and greedy filling. The 2-hop ego network provides the primary context window for agent enrichment.

### Claim decomposition and validation (De-Hallucinator)

The De-Hallucinator adapts FActScore-style claim decomposition for code documentation. Key techniques from the literature:

**FActScore (Min et al., EMNLP 2023)**: Decomposes text into atomic facts, each containing one piece of information, then verifies each against a knowledge source. Automated estimator achieves **<2% error rate** vs human. ChatGPT achieves only **58% FActScore** on biography generation.

**SAFE (Wei et al., NeurIPS 2024, Google DeepMind)**: Search-Augmented Factuality Evaluator. Three-step pipeline: break down → search and verify → make the call. Agrees with human annotators **72%** of the time; on 100 disagreements, SAFE was correct **76%** of the time. **20x cheaper** than human annotators.

**VeriScore (Song, Kim & Iyyer, Findings of EMNLP 2024)**: Evaluates only **verifiable claims**, addressing FActScore/SAFE's limitation of treating all claims as verifiable. Uses sliding-window contextualized extraction to resolve pronouns and maintain context. Fine-tuned Llama3 achieves **F1 = 0.841** for verification.

**Claimify (Microsoft, Metropolitansky & Larson, 2025)**: Four-stage pipeline (split → select → disambiguate → decompose) achieving **99% entailment rate**, **87.6% coverage**, and **96.7% precision** for verifiable content—statistically significant improvement over FActScore, SAFE, and VeriScore extraction.

For beep-effect, claims decomposed from generated documentation are classified into three verification tiers: **AST-verifiable** (parameter names, types, return types—cross-referenced against KG with certainty 1.0), **semantically verifiable** (behavioral claims checked against call graph edges, thrown exceptions, data flow), and **unverifiable** (subjective descriptions requiring human review).

The **3-retry circuit breaker** with progressive constraint tightening works as follows: Retry 1 uses full strict schema, retry 2 relaxes constraints (fewer required fields), retry 3 falls back to basic JSON mode. Confidence scores degrade across retries (e.g., 1.0 → 0.85 → 0.7). If all retries fail, the claim enters a **human-in-the-loop review queue** sorted by lowest confidence. The circuit breaker monitors for systemic failures (provider outages) and fails fast after threshold breaches.

---

## Embedding and retrieval with Voyage Code 3

**Voyage Code 3** (released December 4, 2024) is the state-of-the-art code embedding model:

- **32,000-token context window** (vs OpenAI's 8K, CodeSage's 1K)
- **Dimensions**: 2048, 1024 (default), 512, 256 via **Matryoshka learning**—vectorize once at 2048d, truncate later without re-invoking
- **input_type parameter**: `"document"` for indexing, `"query"` for search (prepends tailored prompts); embeddings are compatible across types
- **Quantization**: float32, int8, uint8, binary, ubinary (up to **32x storage reduction**)
- **Benchmarks**: Outperforms **OpenAI text-embedding-3-large by 13.80%** on 32 code retrieval datasets; at 256d binary, **4.81% better at 1/384 the storage cost**
- **Latency**: 90ms single query; **12.6M tokens/hour** throughput; $0.22/M tokens

**Multi-level embeddings**: function-level (fine-grained retrieval), class-level (structural similarity), module-level (architectural patterns). The **reactive embedding pipeline** follows: write → hash → upsert → embed (node + 1-hop neighbors). **Staleness detection via content hashing** ensures re-embedding only when code actually changes.

### Multi-provider structured output constraints

**OpenAI**: CFG-based constrained decoding with 100% schema compliance. Key restrictions: `additionalProperties: false` required on all objects; **all fields must be in `required`** (no optional keys); root cannot be `anyOf`; no support for minLength, maxLength, pattern.

**Anthropic**: Grammar-compiled constrained decoding. Key restrictions: internal limits on compiled grammar size; **24 optional parameters total** across all strict schemas; union types supported but contribute disproportionately to grammar complexity.

**Union type limitations**: OpenAI `anyOf` works for properties but not at root level. Anthropic supports unions but can exceed internal grammar limits with complex discriminated unions + many optional parameters. **Workaround**: flatten discriminated unions into a single object with a discriminator field and all possible properties (non-applicable ones nullable). The `toAgentOutputSchema` function handles this transformation—narrowing from union to product-of-optionals keyed by tag name.

---

## Verified reference list for the white paper

| # | Citation | Venue | Key metric |
|---|----------|-------|------------|
| 1 | ter Horst, H.J. "Completeness, Decidability and Complexity of Entailment for RDF Schema..." *J. Web Semantics* 3(2-3): 79–115, 2005 | JWS 2005 | PTime for ground graphs |
| 2 | Motik et al. "OWL 2 Web Ontology Language Profiles (Second Edition)." W3C Rec., 2012 | W3C | OWL 2 RL PTime-complete |
| 3 | Motik et al. "Incremental Update of Datalog Materialisation: The Backward/Forward Algorithm." AAAI 2015, pp. 1560–1568 | AAAI 2015 | Orders of magnitude faster than DRed |
| 4 | Gupta, Mumick & Subrahmanian. "Maintaining Views Incrementally." SIGMOD 1993, pp. 157–166 | SIGMOD 1993 | DRed algorithm |
| 5 | Min et al. "FActScore: Fine-grained Atomic Evaluation..." EMNLP 2023, pp. 12076–12100 | EMNLP 2023 | ChatGPT: 58% FActScore |
| 6 | Wei et al. "Long-form Factuality in Large Language Models." NeurIPS 2024 | NeurIPS 2024 | SAFE correct 76% vs humans |
| 7 | **Song**, Kim & Iyyer. "VeriScore: Evaluating the Factuality of Verifiable Claims..." Findings of EMNLP 2024, pp. 9447–9474 | EMNLP Findings 2024 | F1 = 0.841 (fine-tuned Llama3) |
| 8 | Liu et al. "CodexGraph: Bridging LLMs and Code Repositories..." NAACL 2025, pp. 142–160 | NAACL 2025 | 36.02% pass@1 EvoCodeBench |
| 9 | Abdelaziz et al. "A Toolkit for Generating Code Knowledge Graphs." K-CAP 2021 | K-CAP 2021 | 2B triples, 1.3M files |
| 10 | Atzeni & Atzori. "CodeOntology: RDF-ization of Source Code." ISWC 2017, LNCS 10588, pp. 20–28 | ISWC 2017 | 2M+ RDF triples (OpenJDK 8) |
| 11 | Motik et al. "Handling owl:sameAs via Rewriting." AAAI 2015 (DOI: 10.1609/aaai.v29i1.9187) | AAAI 2015 | 7.8x triple reduction, 31.1x time reduction |
| 12 | Voyage AI. "voyage-code-3: More Accurate Code Retrieval..." Blog, Dec 4, 2024 | Blog 2024 | 13.80% over OpenAI-v3-large |
| 13 | Maharaj et al. "ETF: An Entity Tracing Framework for Hallucination Detection in Code Summaries." ACL 2025, pp. 30639–30652 | ACL 2025 | 0.73 F1 (vs 0.28 baseline) |
| 14 | Khati et al. "Detecting and Correcting Hallucinations in LLM-Generated Code via Deterministic AST Analysis." FORGE 2026 (arXiv: 2601.19106) | FORGE 2026 | 100% precision, 77% fix accuracy |
| 15 | Tian et al. "CodeHalu: Investigating Code Hallucinations via Execution-based Verification." AAAI 2025 | AAAI 2025 | 8,883 samples, 17 LLMs |
| 16 | Luo et al. "RepoAgent: An LLM-Powered Framework for Repository-level Code Documentation Generation." EMNLP 2024 | EMNLP 2024 | Beat human docs in blind tests |
| 17 | Li et al. "GraphCodeAgent: Dual Graph-Guided LLM Agent..." arXiv: 2504.10046, 2025 | arXiv 2025 | +43.81% on DevEval (GPT-4o) |
| 18 | Metropolitansky & Larson. "Towards Effective Extraction and Evaluation of Factual Claims." Microsoft, 2025 (arXiv: 2502.10855) | arXiv 2025 | 99% entailment, 87.6% coverage |
| 19 | Spracklen et al. "Package Hallucinations in Coding Models." USENIX Security 2025 | USENIX 2025 | 19.6% average hallucination rate |
| 20 | Nenov et al. "RDFox: A Highly-Scalable RDF Store." ISWC 2015, LNCS 9367, pp. 3–20 | ISWC 2015 | 9.2B triples, 87x speedup |
| 21 | Doyle, J. "A Truth Maintenance System." *AI* 12: 231–272, 1979 | AI 1979 | JTMS foundations |
| 22 | Ruy et al. "SEON: A Software Engineering Ontology Network." EKAW 2016, LNCS 10024 | EKAW 2016 | Layered SE ontology network |
| 23 | Stripe. "The Developer Coefficient." 2018 | Industry 2018 | $85B/year lost to bad code |
| 24 | Atlassian/DX. "Developer Experience Report." 2024 | Industry 2024 | 69% lose 8+ hrs/week |
| 25 | Zhang et al. "Enhancing Code RAG with Structural Chunking via AST." cAST, 2025 | arXiv 2025 | +5.5 pts RepoEval |

**VeriScore author correction**: The user's prompt references "Kamoi et al. 2024" for VeriScore. The correct authors are **Song, Kim & Iyyer** (Findings of EMNLP 2024). Kamoi et al. (2023) authored a separate paper on WiCE (claim decomposition for NLI).

---

## Conclusion: beep-effect's four-pillar novelty is empirically grounded

This research confirms that no existing system—commercial or academic—combines knowledge graph reasoning, structured output schemas, deterministic-first extraction, and closed-loop hallucination verification. The closest systems each demonstrate one or two pillars: CodexGraph (KG + deterministic extraction), ETF (deterministic extraction + hallucination verification), FORGE (deterministic extraction + hallucination correction), RepoAgent (structured output + deterministic extraction). But none achieves the synthesis.

The mathematical foundations are mature and well-characterized. OWL 2 RL's PTime complexity guarantees scalable reasoning. The B/F algorithm provides efficient incremental updates. Union-find canonicalization eliminates the owl:sameAs quadratic blowup. Grothendieck fibrations give the schema design a principled categorical foundation.

The documentation crisis is quantified: $85 billion in annual developer productivity loss, 42% of work time on technical debt, 70% of time spent understanding code. LLM documentation tools exist but none can verify their output—CodeHalu shows hallucinations span four independent categories, ETF shows detection F1 improves from 0.28 to 0.73 with entity tracing, and FORGE shows deterministic AST analysis achieves 100% precision on structural claims.

The key technical risks remain implementation complexity (custom forward-chaining engine on FalkorDB, which lacks built-in reasoning) and the structured output limitations of current LLM providers (Anthropic's 24-optional-parameter limit, OpenAI's all-fields-required constraint). The `toAgentOutputSchema` transformation—narrowing from union to product-of-optionals—is the critical design choice that navigates these constraints.