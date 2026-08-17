# Prose-to-Proof — Architecture Map

> How the product vision lands on real code. Every capability below points at a
> concrete package or goal packet, with an honest **have / specced / build** status.
> This is the bridge between the [Vision](./PROSE_TO_PROOF_VISION.md) /
> [User Story](./PROSE_TO_PROOF_USER_STORY.md) and the engineering reality.
>
> It **complements, not replaces**, the existing
> `goals/agentic-professional-runtime/docs/architecture-map.md` (slice ownership and
> boundary rules) and `docs/BEEPGRAPH_ARCHITECTURE.md` (the authority/projection/cache
> decision). Where they overlap, those documents win.

---

## 1. The shape in one picture

```
                          RETRIEVAL FAMILY                BOUNDARY               LOGIC FAMILY
                          (proposes, fallibly)         (confidence→proof)        (proves, soundly)
 documents ─► read+ground ──► candidates ──────────►  SHACL gate · consistency ──► proven graph ──► ask & check
   files       @beep/md         @beep/epistemic-domain    @beep/semantic-web        @beep/rdf +          GraphRAG +
   (canon)     @beep/pandoc-ast  CandidateClaim/Evidence   prov.ts · shacl-engine    FalkorDB (proj.)     conflict checks
               @beep/langextract                          (the approval gate)        + reasoner
               @beep/nlp-mcp                                                          (specced)
                    │                                                                     ▲
                    └───────────────── editor as portal (@beep/lexical-schema · artifact-ref) ──────────────┘
                                              governed by the ontology TBox (§4) · everything local
```

The invariant that organizes everything: **left of the boundary nothing computes an
entailment** (vectors + an LLM, revisable guesses); **right of it, everything does**
(consequences true in every model). The product's job is to make the crossing honest.

## 2. Capability → code map

| Product capability | What it means to Tom | Carrier in the repo | Status |
|---|---|---|---|
| **Canonical documents** | The file is the truth; format is per-document | `@beep/md` is the canonical AST; `@beep/pandoc-ast` keeps a lossless interchange wire beside its strict semantic profile; `@beep/html` owns conformant and policy-approved projections | **Have** (core slice; Pandoc tables remain an explicit mapping gap) |
| **Editor as portal** | Hover Figure 1 → CAD; term → definition; party → matter | `@beep/lexical-schema` keeps a lossless compatibility wire beside the strict runtime grammar; `@beep/editor` consumes only the strict state and renders incompatible wire read-only | **Have** (primitive) |
| **Read & ground to the exact line** | "Show me the source," highlighted | `@beep/langextract` `GroundedExtraction.span` (`…/capability/langextract/src/Extraction`) | **Have** (capability) |
| **NLP precision (offsets, entities)** | The machinery behind span highlighting | `@beep/nlp-mcp` (42 tools, `AiToken.start/end`) over `@beep/nlp` + `@beep/wink` (`packages/drivers/nlp-mcp`) | **Have** (driver) |
| **Typed claims + evidence + provenance** | Every fact knows what justifies it and who approved it | `@beep/epistemic-domain` — `CandidateClaim`, `Evidence`, `Activity`, `UsageRecord` (`packages/epistemic/domain/src/entities`) | **Have** (domain) |
| **The approval gate (shape + consistency)** | A guess can't become a fact on its own | `@beep/semantic-web` — `prov.ts` (PROV-O), `adapters/shacl-engine.ts` (bounded SHACL) | **Have** (capability) |
| **RDF substrate** | The triples the graph is made of | `@beep/rdf` — `Rdf.ts` (Quad/Dataset), `Vocab/Owl.ts` (`packages/foundation/modeling/rdf`) | **Have** (modeling) |
| **Persisted epistemic store** | Claims/evidence survive restarts | `@beep/epistemic-tables` (Drizzle), local **PGlite** in the desktop app | **Have** (tables) |
| **Chat / agent turns** | Ask the workbench in natural language | `@beep/agents-{domain,client,server,use-cases}`; `ChatRpcs`, `AnthropicTurnKernel`, `FixtureTurnKernel` | **Have** (today's app) |
| **Workspace / threads / tasks / approvals** | The practice's containers and work items | `@beep/workspace-{domain,server,use-cases}`; `@beep/shared-domain` | **Have** (slices) |
| **Law-specific overlays** | Clients, matters, IP assets, filings, docket | `@beep/law-practice` (domain; thin) + `goals/ip-law-knowledge-graph` | **Specced / partial** |
| **Graph projection (Cypher traversal)** | Walk the practice graph fast | FalkorDB, fed from accepted claims — `goals/ip-law-knowledge-graph/SPEC.md` (ADR-002), `goals/trustgraph-port` | **Specced** |
| **Ask & check (GraphRAG + conflicts)** | Q&A and cross-matter conflict checks | BeepGraph retrieval shell — `docs/BEEPGRAPH_ARCHITECTURE.md` | **Specced** |
| **Reasoner (entailment)** | Compute what *follows*, soundly | OWL 2 EL/RL reasoning over the TBox (§4) | **Build** |
| **AI librarian (ingest the corpus)** | The tireless filer | corpus lane over `goals/oppold-corpus-pipeline` output | **Build** |
| **Sync engine + backups** | FS ↔ Box/S3/local, document-aware | per the system diagram; Box Events → ingest | **Build** |
| **On-device embeddings** | Vectors computed locally, nothing sent out | Ollama (e.g. `mxbai-embed-large`) per the system diagram | **Build** |

## 3. The four faces, mapped

1. **Document portal** — `@beep/md` is the canonical document AST; `@beep/pandoc-ast` is the strict/lossless interchange boundary; `@beep/lexical-schema` is the strict/lossless editor wire; and the app's `@beep/editor` is the runtime projection. Links are subgraph edges; the editor is the window.
2. **DMS** — canonical files on disk + sync to interchangeable backends; **identity is minted and stable**, locators (`box:fileId`, `s3:key`, `sha256`) are properties. (Sync engine = build.)
3. **Knowledge graph** — authority in `@beep/epistemic-domain` + `@beep/semantic-web` + `@beep/rdf`; projection in FalkorDB; governed by the ontology TBox.
4. **Ask & check** — GraphRAG over the corpus + conflict checks across walled matters; a query only one unified graph can answer.

## 4. The ontology TBox (the schema that governs the graph)

A layered, standards-backed stack — design-time grounding, not a live runtime authority
(authority stays typed Effect Schema; the ontology supplies the vocabulary and the
constraints). Each layer is a published standard so the model is defensible, not bespoke.

| Layer | Standard(s) | Role | Governance note |
|---|---|---|---|
| Language | **OWL 2** (EL + RL profiles) | how the schema is written; EL classifies, RL materializes | W3C |
| Upper | **BFO** | keeps the schema satisfiable; never sees a document | ISO/IEC 21838-2:2021 |
| Document model | **FRBR / LRM / LRMoo** (WEMI) | a `.md` and a `.docx` are two *Manifestations* of one *Expression*; each copy an *Item* | IFLA |
| Legal practice | **FOLIO** | matters, actors, document/practice vocabulary | ALEA-maintained; SALI/SOLI lineage — describe as "open, ALEA-stewarded," not an uncontested single standard |
| Legal core | **LKIF-Core** | norms, roles, actions (legal reasoning primitives) | academic core |
| IP rights | **IPRonto / Copyright Ontology** | patents, trademarks, designs, copyright works/rights | academic |
| Rights / licensing | **ODRL** | who may do what with which IP under what conditions | W3C Recommendation (2018) |
| Concepts | **SKOS** | lightweight concept schemes | W3C |
| Patent class. | **CPC / IPC** | classification taxonomy the EL reasoner classifies over | EPO+USPTO / WIPO |
| Provenance | **PROV-O** | the documented history of every fact | W3C Recommendation |
| Validation | **SHACL** | the shape gate at the boundary | W3C Recommendation |

> The `ip-law-knowledge-graph` packet locks a **7-ontology source-of-truth set** (S1 LKIF-Core,
> S2 IPRonto/ALIS, S3 Copyright Ontology, S4 JudO, S5 LCBR, S6 ESTRELLA, S7 WIPO IPC) and
> requires every node/edge type to cite ≥1 source. See `goals/ip-law-knowledge-graph/SPEC.md`
> and `goals/ip-law-knowledge-graph/research/ontology-grounding-corpus.md`. The FOLIO ontology
> lives at `…/research/ontology_research/legal_ontologies/openlegalstandards_folio/FOLIO/FOLIO.owl`
> (≈18k concepts; **shallow on patent/trademark specifics** — it's the backbone, not the IP layer).

## 5. Authority / projection / cache (BeepGraph)

The discipline that keeps the graph trustworthy at scale (full argument in
[BeepGraph](./BEEPGRAPH_ARCHITECTURE.md), grounded in
`standards/memory-architecture/`):

| Tier | What lives here | Carrier |
|---|---|---|
| **Authority** | Typed claims + evidence + provenance + lifecycle — the only source of truth | `@beep/epistemic-domain`, `@beep/semantic-web`, `@beep/rdf`; the EventLog/`Activity` record |
| **Projection** | Rebuildable views for traversal/search/timeline | FalkorDB (Cypher), search index, GraphRAG packets — **rebuilt from authority, never a second source** |
| **Cache** | Candidates and similarity | vectors / embeddings (on-device), the unasserted corpus |

This resolves the `ip-law-knowledge-graph` P0 directly: **FalkorDB is a projection**, not a
second source of truth.

## 6. The corpus feeder

`goals/oppold-corpus-pipeline` (status: completed-retained) produced the seed: **8,438 files**
salvaged, deduplicated, name-restored, text-extracted, organized into 643 docket files across
105 families, and USPTO-enriched — exposed as a **DuckDB catalog + `@beep/file-processing`
manifests**. The librarian/ingestion lane (build) reads that surface, runs span-grounded
extraction, and emits candidate claims into the authority spine.

> **Boundary that must hold:** the real corpus and any privileged data stay **outside the
> repository** (the machine-local Oppold corpus home, outside any checkout). The repo carries only synthetic
> fixtures. Dogfooding runs on the local machine, not in git.

## 7. Have vs. build — the honest ledger

| Status | Items |
|---|---|
| **Have today** | `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema` (+`artifact-ref`), `@beep/langextract` (spans), `@beep/nlp-mcp`/`@beep/nlp`/`@beep/wink`, `@beep/epistemic-domain` (claims/evidence/provenance/usage) + `@beep/epistemic-tables`, `@beep/semantic-web` (PROV-O + bounded SHACL), `@beep/rdf`, `@beep/agents-*` chat kernel, `@beep/workspace-*`, the Tauri+React+Bun desktop chat app with local PGlite |
| **Specced** | `ip-law-knowledge-graph` (7-ontology TBox, typed entities, FalkorDB projection, seed pipeline), the document-portal product slice, the runtime data loop (`runtime-data-loop.md`), approval policy, `trustgraph-port` extraction kernel, GraphRAG ask-and-check |
| **Build (net-new)** | OWL 2 EL/RL reasoner integration, the AI librarian/ingestion lane over the corpus, the sync engine (FS ↔ backends, Box Events → ingest), on-device embeddings (Ollama), matter-as-named-subgraph wall enforcement, bitemporal instance store |

## 8. Non-negotiable boundaries (inherited)

From `goals/agentic-professional-runtime/SPEC.md` and `standards/ARCHITECTURE.md`:

- **Authority vs. projection.** Claim + evidence + provenance + lifecycle is the authoritative
  memory primitive; graph/search/retrieval are projections.
- **Candidate-only writes.** Agents propose; human/policy approval promotes to authoritative
  state. Professional judgment stays approval-gated.
- **SDK-first.** The internal Effect/TypeScript SDK is the canonical contract; MCP / Claude
  Desktop / native app are adapters over it.
- **Slice isolation.** No direct slice-to-slice imports; cross-slice language is promoted only
  through `shared/*`. Drivers hold no product language.
- **Storage-neutral domain.** First local adapter is a Postgres-compatible Drizzle path (PGlite);
  domain language must not depend on it.

---

## Related documents

- [Product Vision](./PROSE_TO_PROOF_VISION.md) · [For Tom](./PROSE_TO_PROOF_FOR_TOM.md) · [User Story](./PROSE_TO_PROOF_USER_STORY.md) · [Visualization](./PROSE_TO_PROOF_VISUALIZATION.html) · [Draft PRD](./product/prose-to-proof.md)
- [BeepGraph Architecture](./BEEPGRAPH_ARCHITECTURE.md) — authority/projection/cache; EO spine + TG shell
- `goals/agentic-professional-runtime/docs/architecture-map.md` — slice ownership & boundary rules
- `goals/ip-law-knowledge-graph/SPEC.md` — the 7-ontology TBox and FalkorDB projection
- `goals/oppold-corpus-pipeline/SPEC.md` — the corpus feeder
