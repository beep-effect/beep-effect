# Prose-to-Proof — Product Vision

> **Prose in, proof out.**
> A provenance-grounded knowledge workbench for a solo intellectual-property practice.
> *Obsidian for lawyers — but it proves its sources.*

- **Status:** Vision (north star) · **Working codename:** Prose-to-Proof · **Architecture:** the knowledge stack ([`standards/architecture/16-knowledge-stack.md`](../standards/architecture/16-knowledge-stack.md)); BeepGraph is Proposed
- **Product target:** `apps/professional-desktop` (today a chat shell; tomorrow the workbench)
- **Companion docs:** [For Tom](./PROSE_TO_PROOF_FOR_TOM.md) · [User Story](./PROSE_TO_PROOF_USER_STORY.md) · [Visualization](./PROSE_TO_PROOF_VISUALIZATION.html) · [Architecture Map](./PROSE_TO_PROOF_ARCHITECTURE_MAP.md) · [Draft PRD](./product/prose-to-proof.md) · [BeepGraph Architecture](./BEEPGRAPH_ARCHITECTURE.md) · [Workspace Substrate](./product/workspace-substrate.md)

---

## 1. The one sentence

A solo IP attorney's whole practice — every email, application, response, contract, and figure — flows through **one workbench** that reads the prose, **proposes** structured claims about it, **verifies** each against its exact source text, and makes usable only what an attorney **admits** for a stated use. Admitted claims stay in canonical files, and the graph indexes them, so **every fact carries a link back to the exact words that justify it.** An admission is approval for a stated use, not truth (knowledge-stack chapter, sections 1 and 7).

## 2. Why this exists — and why it's father and son

This is not a feature list. It is a relationship encoded as a system.

For 25 years my father, **Tom Oppold**, has done intellectual-property law — drafting patents, answering examiners, shepherding inventions from a napkin sketch to a granted claim. That work lives as a vast archive of documents and a deeper, unwritten thing: his *judgment* — how he frames an argument, how he distinguishes prior art, the house style of a well-built response. He is now opening a **solo practice**, and I am building him the machine that makes all of it computable.

The structure of this is unusually clean, and it is the heart of the product:

- **The corpus is his 25 years.** The already-salvaged, deduplicated, USPTO-enriched Oppold corpus — 8,438 files — is the seed data ([goals/oppold-corpus-pipeline/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/oppold-corpus-pipeline/SPEC.md)). His past work *is* the training ground.
- **The first user is him.** Not a persona. A real attorney with real matters and real deadlines.
- **His use makes it smarter.** Every claim he approves, every draft he edits into his own voice, every correction he makes teaches the system his standard.

Father built the knowledge. Son builds the machine that makes it legible. The machine serves the father. The father's work sharpens the machine. **We dogfood our own product** — that is how this becomes something real instead of a demo. The loop is the architecture (see §7).

## 3. Prose in, proof out — the thesis

A patent practice runs on prose: applications, office actions, correspondence, contracts. Prose is rich and fallible. A knowledge graph is structured and trustworthy. The hard problem is the **crossing** between them — and the entire design is organized around making that crossing honest.

There are **two families** of computation, and they must never be confused:

- **The retrieval family — *proposes*, fallibly.** A language model and NLP read the documents and *guess*: this string is an inventor, that clause is a license grant, this paragraph distinguishes prior art. Useful, fast, revisable — and never, on its own, true.
- **The logic family — *proves*, soundly.** A formal ontology and a reasoner compute what *follows*: consequences true in every model, not guesses. What it asserts, it can defend.

Between them sits **the boundary**, and the boundary is admission with two witnesses. Signals (a model's score, a reviewer's flag) route a proposal to review; they never admit it. Admission needs a **grounding witness** whose anchors verify against the current text digest, and an **attorney's token** bound to the actor, the action, the revision and the scope (knowledge-stack chapter, sections 1 and 7). The admitted record links to its anchored occurrence in the source. Shape checks inform the review and do not admit anything. Signals never coerce into one number and no algebra combines them, so no score crosses the boundary on its own (sections 8 and 14).

> The deepest invariant, stated as a single test: *does anything compute an entailment?* Left of the boundary, no — vectors and an LLM, revisable guesses. Right of it, yes — consequences true in every model. The surface form (triples, RDF, a graph database) never tells you which family you're in. That question does. The full articulation lives in the system diagram and is mapped to code in [the Architecture Map](./PROSE_TO_PROOF_ARCHITECTURE_MAP.md).

## 4. What it is

One application with four faces, all over the same graph:

1. **A document portal.** A rich editor (`@beep/lexical-schema` + `@beep/md`) where the file is the source of truth and every document is a *portal into a subgraph*. Hover over "Figure 1" and a card surfaces the linked CAD file; hover over a defined term and see its definition and every place it's used; hover over a party and see the matter, the client, the emails. This is already a built primitive — the `ArtifactRefNode` (`packages/foundation/modeling/lexical/src/Lexical.model.ts`).
2. **A document-management system (DMS).** Every file canonical on disk, synced to interchangeable backups (Box / S3 / local). Identity is *minted and stable*; storage locators (`box:fileId`, `s3:key`, `sha256`) are mere properties, never identity.
3. **A knowledge graph.** Prose becomes structure: anchored text (`@beep/text`), annotations (`@beep/annotation`), typed claims and admissions (`@beep/epistemics`), and their RDF projection (`@beep/rdf`), as the knowledge-stack chapter's layer table names them. External vocabularies are the chapter's section 10: gUFO as the upper ontology (not BFO), LKIF and ELI as candidates with no commitment, and FOLIO aligned in the legal intake scheme. Every matter is **walled**: the wall is authorization checked at each of seven access paths (section 11), never a graph name.
4. **Ask & check.** GraphRAG question-answering over the practice, and **conflict-of-interest checks across matters** — a cross-matter query that runs only under an explicit cross-matter authority grant checked by the section 11 port. Identical bytes in two matters never grant it.

## 5. What it is *not*

- **Not a multi-tenant SaaS.** It is one practice's workbench. Model providers may be hosted or local, as the attorney configures them; client matters are protected by authorization at every access path, and the real corpus stays out of the repository. (The competitive landscape is telling: the tools that cite their sources well do not ground rigorously against exact source text, and none are IP-specialized — see [the PRD](./product/prose-to-proof.md).)
- **Not a replacement for systems of record.** It does not replace email, calendar, billing, docketing, or the USPTO. It connects to them and keeps *its own* claims, evidence, drafts, approvals, and provenance (`goals/agentic-professional-runtime/SPEC.md`).
- **Not an autonomous lawyer.** Agents *propose*. The attorney *approves*. Legal advice, filings, and client-facing judgment stay behind a strict human approval gate (`goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md`).
- **Not a place for privileged data in the repo.** Real client material lives outside git (the machine-local Oppold corpus home); the repository carries only synthetic fixtures.

## 6. Five principles

1. **Every matter walled.** Authorization at every access path, never a graph name; a cross-matter read needs an explicit grant.
2. **The file is canonical.** One file = the truth for prose. Format is a per-document property carried by the extension, not a global mode. The graph indexes the file; it never replaces it.
3. **The editor is a portal.** Documents link into subgraphs; reading is navigating; provenance is one hover away.
4. **Provenance everywhere.** Nothing is asserted without a source. An **occurrence** is the provenance link — one place in one pinned text capture, highlightable, like a search engine jumping you to the precise sentence on a page. This is built: `OccurrenceId` (`@beep/text`) and `GroundedExtraction.anchor` (`packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts`).
5. **Retrieval proposes, logic proves.** Signals route a guess to review under a named triage policy; only an admission makes a record usable for a stated purpose. The boundary is sacred.

## 7. The dogfooding flywheel

```
Tom's 25 years  ──►  corpus (8,438 files)  ──►  anchored occurrences
      ▲                                                   │
      │                                                   ▼
  sharper drafts,                                  candidate claims
  faster review                                          │
      │                                                   ▼
      │                                          approval gate (Tom)
      │                                                   │
      └────────── practice memory ◄── admitted claims ◄───┘
```

Each turn of the wheel, the system knows more of what Tom knows, in a form it can prove. The product gets better precisely *because* the person it's built for uses it. That is the bet.

## 8. Where it stands, and where it goes

**Today.** `apps/professional-desktop` (v0.0.3) is honestly a desktop **chat app** — Tauri + React + a Bun sidecar, with chat turns persisted and cost tracked. The foundations beneath it are realer than the surface implies: anchored extraction, the artifact-ref portal node, a 42-tool NLP driver (`packages/drivers/nlp-mcp`), typed claims and admissions (`@beep/epistemics`), the PROV projection (`@beep/rdf` `src/Prov.ts`), and the RDF substrate (`packages/foundation/modeling/rdf`) all exist as built primitives.

**Next (MVP).** Turn the chat app into the **document portal**: ingest one matter's documents, extract claims and anchor them to occurrences, surface them in the Lexical editor with hover-card subgraph links, and gate everything behind attorney approval — the same **runtime data loop** already locked as the first proof (`goals/agentic-professional-runtime/docs/runtime-data-loop.md`), extended from email to documents. Detailed in [the PRD](./product/prose-to-proof.md).

**Horizon (GA).** The full graph: FalkorDB projection for Cypher traversal, GraphRAG ask-and-check, cross-matter conflict checks, the legal-ontology TBox with a sound reasoner, and the AI librarian ingesting the full corpus. The architecture that gets us there — effect-ontology as the typed authority spine, TrustGraph as the projection/retrieval shell — is proposed in [BeepGraph](./BEEPGRAPH_ARCHITECTURE.md); the binding doctrine is the knowledge-stack chapter (`standards/architecture/16-knowledge-stack.md`).

---

*Prose in · the file stays canonical · signals route to review · admission needs a grounding witness and a human token · proof out · every matter walled by authorization.*
