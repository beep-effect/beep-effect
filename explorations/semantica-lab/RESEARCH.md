# Research

<!-- Stage 1. Cited external landscape + in-repo capability inventory, dated sections. -->

## 2026-08-24 — grounding sweep (3 × GPT-5.6 Sol xhigh agents, distilled files in `research/`)

### Semantica upstream ([`research/grounding-semantica-repo.md`](./research/grounding-semantica-repo.md))

Local clone `~/YeeBois/workstation-apps/semantica` @ `add1c006` (`danklocal`). Python 3.8+
setuptools distribution + React/Vite Explorer; ≈184k Python LOC in `semantica/`, 29k TS/TSX in
`explorer/src/`, 101k test LOC (CI does **not** run pytest). v0.6.6, MIT (Hawksight AI). The
27-module/six-layer claim verifies exactly. Maturity graded per module in the file: most solid;
`ontology`/`reasoning`/`pipeline`/`embeddings`/`llms`/`mcp_server`/`core` partial; `evals` stub.
Load-bearing negative findings (seed for the atlas Findings DB): random-vector embedding
fallback shaped like success; "parallel" DAG engine that runs one sequential data chain;
`SPARQLReasoner.execute_query` always raises; simulated consistency/satisfiability checks;
fourteen bare-`pass` ontology facade methods; packaged MCP (12 tools) vs unpackaged root `mcp/`
(17 tools) drift. Port-worthy concepts and schema-first structural wins are enumerated in §7 of
the file (provenance events, storage capability families, ContextGraph agent memory, ontology
lifecycle, typed inference explanations, declarative pipeline DAG).

### beep-effect labs doctrine ([`research/grounding-beep-labs.md`](./research/grounding-beep-labs.md))

Lab creation is `bun run beep create-package semantica --type app --app-kind tauri --lab`
(never mkdir); doctrine `standards/architecture/15-lab-apps.md` + `goals/lab-apps-lifecycle/SPEC.md`
(D1–D14; `semantica` is a named first-wave source in `research/SOURCES.md:37` there). Labs obey
full code law, skip ceremony, zero root-config churn, promotion = extraction + doctor-clean
deletion. Tauri precedent: `apps/professional-desktop` (Rust shell + compiled Bun sidecar
hosting Effect runtime, PGlite/Drizzle, embedded migrations) — reusable as pattern, never
imported. Existing lab: `apps/labs/trustgraph-workbench` (scaffold shell, `active`).
Slice anatomy references: `packages/architecture-lab/*` (canonical 7-role), `packages/ontology/*`
(production 6-role).

### Notion atlas forensics ([`research/grounding-notion-semantica.md`](./research/grounding-notion-semantica.md))

Page `3c669573-788d-8001-82c3-e19b0cf3b58c`, built 2026-08-24 07:15–09:03Z: 33 uniform
`name/description/link` catalog databases (213 rows, titles only), fully populated 27-row Module
Index, six mermaid chains, one content-bearing row (`FileIngestor` — hand-authored Effect Schema
translation of `FileObject`; the prototype for the Model-kind template). No decision columns yet.
Known deltas vs upstream already: missing `sqlite-vec`, `Anzo`; `Grok`-vs-`Groq` question; no
databases for `integrations/`, root `mcp/`, CLI, `cookbook/`, `deploy/`; embeddings omits hash
fallback + `LlamaStore` placeholder.

### In-flight / pending

- **v3 prior art** — LANDED: [`research/grounding-v3-logos.md`](./research/grounding-v3-logos.md).
  Verdicts: `rete` **SALVAGE** (a real restricted Rete — alpha/join/memory topology, EAV facts,
  incremental insert/update/retract, 46/46 tests green on Bun 1.4.0; its test suite is an
  executable oracle for the new substrate), `rules` **PATTERN** (94-operator taxonomy metadata
  model; engine absent), `logos` **PATTERN** (serializable predicate-tree AST + operator
  semantics catalog; abandoned mid-V2-rewrite, never wired into product). All Effect v3-era;
  reference material, not copyable code.
- **Criteria rubric**: v2.0 RATIFIED after the Sol+Grok adversarial pass
  ([`research/criteria-rubric.md`](./research/criteria-rubric.md); reviews and reconciliation
  under [`research/reviews/`](./research/reviews/)).
- **Five bake-offs** (D10+A4): LANDED as candidate screens (`research/bakeoff-*.md`), then
  reconciled to park-pending-canary (B1) after the second adversarial pass.
- **IR pipeline**: LANDED — `scratchpad/semantica-ir/` extracted 6,105 symbol records from 354
  files, zero validation failures ([`research/ir-extraction-report.md`](./research/ir-extraction-report.md)).
- **Still open:** `scratchpad/effect-ontology` deep read (its PORTING_LEDGER is a template
  precedent for atlas symbol work); `.claude/skills/semantica/SKILL.md` in the workstation
  clone (read during shape per O5).
- **llms.txt census** — LANDED: [`research/docs-url-census.md`](./research/docs-url-census.md)
  (Grok, all URLs fetch-verified). llms.txt coverage far better than expected (Pinecone,
  Weaviate, Milvus, Qdrant, FalkorDB, Neo4j, Neptune, OpenAI all serve one). License flags:
  FalkorDB SSPL-1.0, Neo4j GPL-3.0, Blazegraph GPL-2.0 + archived-since-2020; pgvector is SPDX
  `PostgreSQL` (BSD-family — needs an explicit rubric-list call at ratification). **Headline:
  no TS/WASM Datalog engine clears both hard gates** (Dusa GPL-3.0; CozoDB MPL-2.0 but stalled
  2024-12; datalog-ts MIT but stalled 2024-12; DataScript alive but EPL-1.0/ClojureScript) —
  the reasoning family's ecosystem gap is real, not assumed.
