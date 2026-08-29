# Prose-to-Proof — Product Vision

> **Prose in, proof out.**
> A local-first, provenance-grounded knowledge workbench for a solo intellectual-property practice.
> *Obsidian for lawyers — but it proves its sources.*

- **Status:** Vision (north star) · **Working codename:** Prose-to-Proof · **Architecture name:** BeepGraph
- **Product target:** `apps/professional-desktop` (today a chat shell; tomorrow the workbench)
- **Companion docs:** [For Tom](./PROSE_TO_PROOF_FOR_TOM.md) · [User Story](./PROSE_TO_PROOF_USER_STORY.md) · [Visualization](./PROSE_TO_PROOF_VISUALIZATION.html) · [Architecture Map](./PROSE_TO_PROOF_ARCHITECTURE_MAP.md) · [Draft PRD](./product/prose-to-proof.md) · [BeepGraph Architecture](./BEEPGRAPH_ARCHITECTURE.md) · [Workspace Substrate](./product/workspace-substrate.md)

---

## 1. The one sentence

A solo IP attorney's whole practice — every email, application, response, contract, and figure — flows through **one local machine** that reads the prose, **proposes** structured claims about it, **proves** those claims sound against a formal legal ontology, and admits only what survives into **one knowledge graph where every fact carries a link back to the exact words that justify it.**

## 2. Why this exists — and why it's father and son

This is not a feature list. It is a relationship encoded as a system.

For 25 years my father, **Tom Oppold**, has done intellectual-property law — drafting patents, answering examiners, shepherding inventions from a napkin sketch to a granted claim. That work lives as a vast archive of documents and a deeper, unwritten thing: his *judgment* — how he frames an argument, how he distinguishes prior art, the house style of a well-built response. He is now opening a **solo practice**, and I am building him the machine that makes all of it computable.

The structure of this is unusually clean, and it is the heart of the product:

- **The corpus is his 25 years.** The already-salvaged, deduplicated, USPTO-enriched Oppold corpus — 8,438 files — is the seed data (`goals/oppold-corpus-pipeline/SPEC.md`). His past work *is* the training ground.
- **The first user is him.** Not a persona. A real attorney with real matters and real deadlines.
- **His use makes it smarter.** Every claim he approves, every draft he edits into his own voice, every correction he makes teaches the system his standard.

Father built the knowledge. Son builds the machine that makes it legible. The machine serves the father. The father's work sharpens the machine. **We dogfood our own product** — that is how this becomes something real instead of a demo. The loop is the architecture (see §7).

## 3. Prose in, proof out — the thesis

A patent practice runs on prose: applications, office actions, correspondence, contracts. Prose is rich and fallible. A knowledge graph is structured and trustworthy. The hard problem is the **crossing** between them — and the entire design is organized around making that crossing honest.

There are **two families** of computation, and they must never be confused:

- **The retrieval family — *proposes*, fallibly.** A language model and NLP read the documents and *guess*: this string is an inventor, that clause is a license grant, this paragraph distinguishes prior art. Useful, fast, revisable — and never, on its own, true.
- **The logic family — *proves*, soundly.** A formal ontology and a reasoner compute what *follows*: consequences true in every model, not guesses. What it asserts, it can defend.

Between them sits **the boundary** — the one place where *confidence becomes provenance*. A proposal does not enter the graph because a model felt sure. It enters only after a **SHACL gate** validates its shape, a **consistency check** proves it doesn't contradict what's already known, and it is **materialized** into the record with a permanent link to its source span. Confidence gets you to the boundary; only proof gets you across.

> The deepest invariant, stated as a single test: *does anything compute an entailment?* Left of the boundary, no — vectors and an LLM, revisable guesses. Right of it, yes — consequences true in every model. The surface form (triples, RDF, a graph database) never tells you which family you're in. That question does. The full articulation lives in the system diagram and is mapped to code in [the Architecture Map](./PROSE_TO_PROOF_ARCHITECTURE_MAP.md).

## 4. What it is

One application with four faces, all over the same graph:

1. **A document portal.** A rich editor (`@beep/lexical-schema` + `@beep/md`) where the file is the source of truth and every document is a *portal into a subgraph*. Hover over "Figure 1" and a card surfaces the linked CAD file; hover over a defined term and see its definition and every place it's used; hover over a party and see the matter, the client, the emails. This is already a built primitive — the `ArtifactRefNode` (`packages/foundation/modeling/lexical/src/Lexical.model.ts`).
2. **A document-management system (DMS).** Every file canonical on disk, synced to interchangeable backups (Box / S3 / local). Identity is *minted and stable*; storage locators (`box:fileId`, `s3:key`, `sha256`) are mere properties, never identity.
3. **A knowledge graph.** Prose becomes structure: typed claims, evidence, and provenance (`@beep/epistemic-domain`), grounded against a stack of published legal ontologies (FOLIO, BFO, LKIF-Core, the WEMI/LRMoo document model, ODRL, CPC/IPC — see `goals/ip-law-knowledge-graph/SPEC.md`). One logical graph, **walled by matter** — each matter a named subgraph that doubles as an ethical wall with legal force.
4. **Ask & check.** GraphRAG question-answering over the practice, and **conflict-of-interest checks across matters** — a query only a single unified graph can answer, even though each matter stays sealed for substantive reads.

## 5. What it is *not*

- **Not a cloud SaaS.** Local-first, on device by default; client data does not leave the machine unless a backup backend is explicitly chosen. Embeddings are computed locally. (The competitive landscape is telling: the tools that cite their sources well are cloud-bound; the tools that are truly local don't ground rigorously, and none are IP-specialized — see [the PRD](./product/prose-to-proof.md). The local-*and*-grounded intersection is essentially unoccupied.)
- **Not a replacement for systems of record.** It does not replace email, calendar, billing, docketing, or the USPTO. It connects to them and keeps *its own* claims, evidence, drafts, approvals, and provenance (`goals/agentic-professional-runtime/SPEC.md`).
- **Not an autonomous lawyer.** Agents *propose*. The attorney *approves*. Legal advice, filings, and client-facing judgment stay behind a strict human approval gate (`goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md`).
- **Not a place for privileged data in the repo.** Real client material lives outside git (the machine-local Oppold corpus home); the repository carries only synthetic fixtures.

## 6. Five principles

1. **Local-first, every matter walled.** On-device by default; matters are named subgraphs that are also confidentiality boundaries with legal force.
2. **The file is canonical.** One file = the truth for prose. Format is a per-document property carried by the extension, not a global mode. The graph indexes the file; it never replaces it.
3. **The editor is a portal.** Documents link into subgraphs; reading is navigating; provenance is one hover away.
4. **Provenance everywhere.** Nothing is asserted without a source. A **character span** is the provenance link — the exact words, highlightable, like a search engine jumping you to the precise sentence on a page. This is built: `GroundedExtraction.span` (`packages/foundation/capability/langextract/src/Extraction`).
5. **Retrieval proposes, logic proves.** Confidence routes a guess to review; only proof admits a fact. The boundary is sacred.

## 7. The dogfooding flywheel

```
Tom's 25 years  ──►  corpus (8,438 files)  ──►  extract + ground (spans)
      ▲                                                   │
      │                                                   ▼
  sharper drafts,                                  candidate claims
  faster review                                          │
      │                                                   ▼
      │                                          approval gate (Tom)
      │                                                   │
      └────────── practice memory ◄── proven graph ◄──────┘
```

Each turn of the wheel, the system knows more of what Tom knows, in a form it can prove. The product gets better precisely *because* the person it's built for uses it. That is the bet.

## 8. Where it stands, and where it goes

**Today.** `apps/professional-desktop` (v0.0.3) is honestly a local-first **chat app** — Tauri + React + a Bun sidecar, with chat turns persisted and cost tracked. The foundations beneath it are realer than the surface implies: span-grounded extraction, the artifact-ref portal node, a 42-tool NLP driver (`packages/drivers/nlp-mcp`), typed claims/evidence/provenance, PROV-O and bounded SHACL (`packages/foundation/capability/semantic-web`), and the RDF substrate (`packages/foundation/modeling/rdf`) all exist as built or specced primitives.

**Next (MVP).** Turn the chat app into the **document portal**: ingest one matter's documents, extract and ground claims to spans, surface them in the Lexical editor with hover-card subgraph links, and gate everything behind attorney approval — the same **runtime data loop** already locked as the first proof (`goals/agentic-professional-runtime/docs/runtime-data-loop.md`), extended from email to documents. Detailed in [the PRD](./product/prose-to-proof.md).

**Horizon (GA).** The full graph: FalkorDB projection for Cypher traversal, GraphRAG ask-and-check, cross-matter conflict checks, the legal-ontology TBox with a sound reasoner, and the AI librarian ingesting the full corpus. The architecture that gets us there — effect-ontology as the typed authority spine, TrustGraph as the projection/retrieval shell — is settled in [BeepGraph](./BEEPGRAPH_ARCHITECTURE.md).

---

*Prose in · the file stays canonical · the boundary converts confidence into provenance · proof out · one graph, walled by matter · everything on device.*
