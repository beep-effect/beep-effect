# X.com & Practitioner Signal (2025–2026): Document Structure Ontologies, Legal Standards, Ontology+LLM, and AI Drafting

**Lane:** `05-x-and-practitioner-signal`
**Packet:** `explorations/document-structure-ontologies`
**Sweep date:** 2026-08-11
**Primary methods:** native X semantic/keyword search (2025-01-01 → 2026-08-11), linked-blog/spec fetches, GitHub/project pages
**Scope:** SPAR / DoCO / document ontologies in production; FOLIO & SALI adoption; ontology + LLM / GraphRAG for legal or patent work; semantic document structure for AI drafting tools

Every factual claim below is backed by a real URL (post, article, spec, repo, or org page). Engagement metrics on X posts are as returned by the search tools at sweep time; they are snapshots, not longitudinal series.

---

## 1. Executive summary

| Theme | Practitioner reality (2025–2026) | Hype vs shipped |
| --- | --- | --- |
| **SPAR / DoCO / PO / DEO** | Specs remain alive (DoCO revised 2026-06-25). Near-zero X discourse. Production signal is scholarly / publishing infrastructure, not legal-tech product marketing. | **Shipped as vocabularies**; not shipped as mainstream legal-AI product substrate. |
| **FOLIO** | Active open legal ontology (~18k concepts), free API, **MCP server shipped Mar 2026**, CC-BY. Loud on its own channels; quiet as a general X meme. | **Shipped software + ontology**; adoption claims need independent verification. |
| **SALI / LMSS** | Industry matter-taxonomy with real firm/vendor mindshare historically; 2024–2025 governance dispute with ALEA/FOLIO fork/rebrand; SALI still claims accelerating AI adoption. | **Shipped taxonomy**; **governance contested** — treat as political risk for adopters. |
| **Ontology + GraphRAG (legal)** | Strong builder signal: Neo4j + LangGraph contract demos, LlamaIndex legal KG cookbooks, LinearRAG critique of relation extraction, layered-KG PoCs. | **Demos and OSS pipelines shipped**; few public “we run DoCO/FOLIO in production at firm X” proofs. |
| **Semantic document structure for AI** | **Docling** (IBM → LF AI) is the breakout open stack (parse → structured tree → RAG/agents). **DGML** (Docugami) markets clause-level provenance. Patent drafting tools emphasize *section structure*, not formal OWL. | **Docling: high-signal shipped OSS**. **DGML: product/standard push**. Formal SPAR patterns rarely named on X. |

**Headline for beep-effect:** practitioner energy is on (1) **layout-preserving document trees** (Docling / LlamaParse / structured markdown), (2) **matter & concept taxonomies for AI agents** (FOLIO MCP, SALI-style tagging), and (3) **hybrid graph+vector retrieval for contracts**—not on re-implementing SPAR’s full scholarly stack. DoCO/PO remain the clean *structural pattern theory* that maps onto `@beep/md` Inline/Block laws; FOLIO is the *legal concept* layer to wire through `@beep/ontology` + MCP; patent section rhetoric is mostly **custom domain schema**, not DoCO classes.

---

## 2. Method & corpus limits

### 2.1 What was searched

- **X semantic search** (topically ranked) and **X keyword search** (Latest mode) for: DoCO/SPAR, FOLIO/SALI/LMSS, GraphRAG+legal/patent, Docling/DGML/document structure, Definely/legal drafting agents.
- **Linked primary sources** opened when posts pointed to blogs, Neo4j, FOLIO org pages, GitHub, or standards.
- **Cross-check** against this packet’s prior notes (`research/SOURCES.md`, `research/folio/*`, session research in `RESEARCH.md`).

### 2.2 Important null results (signal in the silence)

| Query class | Result |
| --- | --- |
| `DoCO` / “Document Components Ontology” on X | Dominated by noise (Japanese usernames, stock tickers, “doco” = documentary). **No credible 2025–2026 practitioner threads** treating SPAR DoCO as a legal-tech product. |
| `SALI Alliance` exact org mentions | Sparse English legal-tech hits; more false positives on “sali” in other languages. |
| `FOLIO` as legal ontology | Overloaded with Solana/crypto “folio,” library ILS “FOLIO,” and unrelated uses. **Legal FOLIO signal is real but low-volume**, mostly via ALEA-adjacent accounts and LegalTech news retweets. |

**Interpretation:** absence of X chatter is *not* absence of use. SPAR ontologies live in academic semantic-publishing ecosystems; legal matter standards live in firm/vendor integrations and LinkedIn/Legaltech News more than Twitter/X. This report privileges **what practitioners actually amplify** plus **what is verifiably shipped**, and labels the gap.

### 2.3 Credibility tiers used below

1. **Primary shipped artifact** — repo, package, hosted API, OASIS standard.
2. **Vendor / org announcement with runnable code or public API.**
3. **Practitioner post with measurable engagement** (likes/views).
4. **Commentary / marketing without independent deployment evidence.**

---

## 3. SPAR / DoCO / document ontologies — production signal

### 3.1 What is actually maintained (primary sources)

**DoCO (Document Components Ontology)** provides structural *and* rhetorical document component classes (paragraph, section, chapter, front/body/back matter, list, table, figure, footnote, formula, etc.), imports **DEO** (rhetorical discourse elements) and **PO** (Pattern Ontology structural patterns), and is published under **CC BY 4.0**.

- Spec (release 2015-07-03, **modified 2026-06-25**, rev 1.4.0): https://sparontologies.github.io/doco/current/doco.html
- SPAR hub page: https://www.sparontologies.net/ontologies/doco
- GitHub: https://github.com/sparontologies/doco
- Foundational paper (Semantic Web, 2016): DOI https://doi.org/10.3233/SW-150177
- KG registry entry: https://kghub.org/kg-registry/resource/doco/doco.html

DoCO’s own examples encode *sentence-level* nodes ordered with the Collections Ontology and text via C4O—i.e. a graph model of document structure, not a UI editor AST. That matches this packet’s session take: structure/rhetoric as **annotation over node ids**, not new syntax tags in `@beep/md`.

**PO (Pattern Ontology)** remains the formal Inline/Block/Atom/Popup/Container axis: https://sparontologies.github.io/po/current/po.html

**SPAR suite history** (OpenCitations, 2010 introduction; later site refresh):
- https://opencitations.wordpress.com/2010/10/14/introducing-the-semantic-publishing-and-referencing-spar-ontologies/
- https://opencitations.hypotheses.org/55

### 3.2 X practitioner signal: effectively null

Targeted X keyword and semantic sweeps for DoCO / SPAR / “semantic publishing ontology” in a legal or product context returned:

- False positives (documentary “doco”, finance tickers, philosophy “ontology”).
- Generic enterprise “ontology” posts that never name SPAR classes.
- **No high-engagement 2025–2026 post series** from legal-tech builders shipping DoCO-labeled graphs.

**Assessment:** DoCO is a **stable academic/standard vocabulary**, not a 2025–2026 X hype cycle. If beep-effect adopts it, the justification is **formal fit to AST bipartition and interop IRIs**, not social proof.

### 3.3 Adjacent *shipped* document-structure standards that *do* show production use

These are not SPAR, but they occupy the “document ontology in production” niche practitioners actually cite:

| Standard | Role | Production / adoption evidence | URL |
| --- | --- | --- | --- |
| **Akoma Ntoso / LegalDocML** | Legislative / judicial XML vocabulary | OASIS standard (2018); national profiles (e.g. Germany LegalDocML.de); USLM derivative for U.S. legislative markup; 2025 talk framing for legal AI | https://www.oasis-open.org/standard/akn-v1-0/ · https://github.com/oasis-open/legaldocml-akomantoso · https://xcential.com/legis-standards · https://www.youtube.com/watch?v=ZVHj6E36HV4 |
| **USLM** | U.S. legislative markup (AKN-derived) | GPO / GovInfo pipeline | https://www.govinfo.gov/features/beta-uslm-xml |
| **DoclingDocument** | GenAI-oriented unified document representation | Massively adopted OSS parse layer (see §6) | https://docling-project.github.io/docling/concepts/docling_document/ |

POPVOX’s Feb 2026 write-up on Brazil LexML / Akoma Ntoso notes that structured legal data has moved from “niche” to enabling **automated drafting, consistency checks, semantic search** as AI arrived: https://www.popvox.org/blog/when-law-becomes-data

**Takeaway:** production legal document structure in the wild is mostly **XML profiles (AKN family)** or **AI-native intermediate trees (Docling)**, not OWL DoCO instances.

---

## 4. FOLIO and SALI — adoption, politics, and AI tooling

### 4.1 What SALI is (and was)

**SALI Alliance** (Standards Advancement for the Legal Industry) publishes the **Legal Matter Specification Standard (LMSS)** — a shared taxonomy/ontology for describing legal matters, services, roles, industries, etc.

- Home: https://sali.org/
- Explore the standard: https://sali.org/explore-the-standard/
- Vendor explainer (Agiloft, 2024-06-20): https://www.agiloft.com/blog/what-are-sali-standards-and-the-sali-alliance/
- Artificial Lawyer historical update: https://www.artificiallawyer.com/2021/11/24/sali-an-update-on-the-standards-project/
- Dewey B Strategic on LMSS 2.0 (~10k tags, 2022): https://www.deweybstrategic.com/2022/03/sali-releases-lmss-2-0-a-powertool-driving-legal-market-analysis-and-insights.html

Agiloft and SALI-adjacent materials claim industry uptake for tagging legal work and feeding CLM/AI; CLOC-era reporting cited ~10k tags as a “universal language” (see Agiloft article citations). Treat vendor “everyone is adopting” language as **tier-4 marketing** unless a named integration is shown.

SALI’s community page (as of sweep) still messages **AI strategy**: “SALI adoption is accelerating… building it into their AI and data strategies” — https://sali.org/community/

### 4.2 FOLIO: the open, federated continuation (shipped)

**FOLIO** = Federated Open Legal Information Ontology (rebrand from **SOLI**), maintained under the **ALEA Institute** ecosystem, **CC BY 4.0**, claiming **18,000+ concepts**, multilingual labels, free REST API, Python lib, and (Mar 2026) an **MCP server**.

Primary sources:

| Artifact | URL |
| --- | --- |
| FOLIO site | https://openlegalstandard.org/ |
| Ontology GitHub (alea-institute/FOLIO) | https://github.com/alea-institute/FOLIO |
| Related ontology source (soli path still referenced) | https://github.com/alea-institute/soli |
| MCP announcement (2026-03-19) | https://openlegalstandard.org/folio-mcp-server-ai-agents |
| ALEA blog on API + MCP | https://aleainstitute.ai/blog/posts/folio-api-mcp-tools/ |
| MCP tools reference (12 tools) | https://openlegalstandard.org/resources/folio-mcp-tools |
| MCP package | https://github.com/alea-institute/folio-mcp · https://pypi.org/project/folio-mcp/ |
| Hosted API docs | https://folio.openlegalstandard.org/docs |
| Hosted MCP endpoint | `https://folio.openlegalstandard.org/mcp` (cited in MCP docs) |

FOLIO’s positioning for AI is explicit: hybrid **human-curated taxonomy + LLM search**, document classification prompt templates (`classify-document`, `identify-area-of-law`, etc.), export to JSON-LD / OWL XML. That is the closest public **ontology-for-agents** pattern in legal tech today.

FOLIO claims “100+ industry adopters” on its homepage marketing block (https://openlegalstandard.org/) — **not independently audited in this sweep**; flag as self-reported.

### 4.3 The SALI ↔ FOLIO governance conflict (critical practitioner context)

This is the **highest-stakes legal-standards story of 2024–2026** for anyone choosing LMSS-compatible IRIs.

ALEA’s open letter *“What’s Happening with SALI, SOLI, and FOLIO?”* (https://openlegalstandard.org/whats-happening-with-sali-soli-folio) alleges:

- SALI corporate standing issues (Delaware “void,” Illinois registration, IRS filing questions).
- SALI “pause” of activities (Aug 2024).
- SOLI created Sep 2024 as **MIT-licensed fork** of LMSS.
- SALI cease-and-desist Jan 2025; rebrand to **FOLIO** Mar 2025 to reduce trademark confusion.
- Claim that ALEA/FOLIO contributors built the vast majority of the ~18k tags.

**This is ALEA’s side of a live dispute.** Independent verification of corporate records and of which parties hold which rights was **not** performed in this X sweep. For beep-effect:

- Prefer **FOLIO’s published CC-BY artifacts and free API** for agent tooling *if* legal counsel accepts the MIT-fork lineage story.
- Treat **SALI membership / official LMSS feeds** as a separate commercial/governance path.
- Do **not** assume SALI and FOLIO IRIs are interchangeable without an explicit mapping layer.

### 4.4 X / social signal on FOLIO & ALEA (dated posts)

| Date (UTC) | Author | Post ID / URL | Engagement (snapshot) | Substance |
| --- | --- | --- | --- | --- |
| 2025-09-03 | @LegalTechStrtUp | https://x.com/LegalTechStrtUp/status/1963269111682908339 | 3 likes, 262 views | Summarizes Legaltech News: ALEA/FOLIO rebrand after LMSS rights dispute; Damien Riehl quote that SALI remains essential near-term, marketplace decides long-term |
| 2025-11-08 | @joelniklaus | https://x.com/joelniklaus/status/1987173543982080435 | 7 likes, 328 views | KL3M Data Project: 132M+ docs, USPTO patents + courts + regs, CC-BY via alea-institute on Hugging Face |
| 2025-12-04 | @lsolum | https://x.com/lsolum/status/1996370113008656766 | 1 like, 1 RT, 440 views | Academic pointer to Bommarito/Katz/Bommarito agent primer (SSRN via Legal Theory Blog) |
| 2025-12-24 | @lsolum | https://x.com/lsolum/status/2003924892966633894 | 2 likes, 469 views | Bommarito/Katz/Bommarito on designing AI agents for law & finance |
| 2025-01-28 | @mjbommar | https://x.com/mjbommar/status/1884280126361460951 | 3 likes, 2 RT, 272 views | KL3M datasets upload progress on Hugging Face |
| 2026-07-02 (Grok reply in thread) | @grok | https://x.com/grok/status/2072378238735704263 | low | Background on ALEA Institute org facts (EIN, leadership) — treat as secondary |

**Credible voices (legal standards + AI):**

- **Michael Bommarito** (@mjbommar) — ALEA / 273 Ventures / FOLIO technical lead.
- **Daniel Martin Katz** — academic + ALEA Research Director (CodeX / Chicago-Kent / Bucerius).
- **Jillian Bommarito** — ALEA governance.
- **Damien Riehl** — SALI contributor history; FOLIO advocate; also vLex (per Legaltech News summary).
- **Lawrence Solum** (@lsolum) — high-trust academic amplifier for ALEA papers (low engagement, high institutional credibility).
- **Joël Niklaus** (@joelniklaus) — Hugging Face / legal-data credibility for KL3M.

**Note:** A July 2026 post about an unrelated local “folio-mcp” document RAG project (https://x.com/abdansari_/status/2074769490454446308) is a **name collision**, not ALEA FOLIO.

### 4.5 SALI on X: thin English signal

Keyword search for “SALI standards” + legal produced little actionable English traffic. One crypto-adjacent reply (“SALI standards could be a game changer for AI adoption in legal”) is not a primary source of adoption evidence: https://x.com/DominusDomitius/status/2063858688851419237 (0 likes).

**Conclusion on adoption:**
- **SALI:** established matter-taxonomy brand; adoption claims live in firm RFPs, CLM vendors (Agiloft, etc.), and legal-ops communities more than X.
- **FOLIO:** **technically most advanced public surface for AI agents (MCP + API)** in this niche as of Mar–Aug 2026.
- **Neither** has “viral X proof of AmLaw production rollout” in this sweep.

---

## 5. Ontology + LLM / GraphRAG for legal & patent work

### 5.1 High-engagement practitioner / vendor posts (X)

| Date | Author | URL | Engagement | Claim / artifact |
| --- | --- | --- | --- | --- |
| 2025-06-15 | @LangChain | https://x.com/LangChain/status/1934294834086387829 | **408 likes, 76 RT, 467 bookmarks, 37.6k views** | GraphRAG contract analysis via Neo4j + LangGraph; points to Towards Data Science / Neo4j implementation |
| 2025-08-15 | @llama_index | https://x.com/llama_index/status/1956462158138712426 | **460 likes, 95 RT, 666 bookmarks, 102k views** | Legal contracts → LlamaParse → classify → LlamaExtract → Neo4j KG |
| 2025-08-17 | @jerryjliu0 | https://x.com/jerryjliu0/status/1957141315088728276 | **517 likes, 87 RT, 769 bookmarks, 64k views** | Same legal-document KG stack; collab with Neo4j (Tomaz) |
| 2025-04-08 | @LangChain | https://x.com/LangChain/status/1909618484981510580 | **392 likes, 66 RT, 347 bookmarks, 30.6k views** | **Definely** uses LangGraph agents in Microsoft Word (clause extract, draft, human approval) |
| 2025-12-20 | @pvergadia | https://x.com/pvergadia/status/2002204809164677292 | **296 likes, 59 RT, 221 bookmarks, 13k views** | GraphRAG cheatsheet (general, not legal-specific) |
| 2026-07-25 | @tom_doerr | https://x.com/tom_doerr/status/2081009750204916172 | **610 likes, 95 RT, 818 bookmarks, 29k views** | OSS text→KG for GraphRAG (https://github.com/rahulnyk/knowledge_graph) |
| 2026-08-10 | @Connected_Data | https://x.com/Connected_Data/status/2086762506773532924 | 20 likes, 10 bookmarks, 477 views | Layered RDF ontologies + GraphRAG as **schema triage** for real-estate legal docs |
| 2026-08-05 | @TheYotg | https://x.com/TheYotg/status/2084948302911435241 | 12 likes, 12 bookmarks, 480 views | **LinearRAG** paper critique: LLM relation extraction is weak link; entity-only graph can win |
| 2026-08-01 | @pauliusztin_ | https://x.com/pauliusztin_/status/2083591085385818419 | 24 likes, 30 bookmarks, 666 views | “Hardest part of agent memory is the ontology” — ontology as contract for extract/store/retrieve |
| 2026-07-16 | @VAIOT_LTD | https://x.com/VAIOT_LTD/status/2077706337081770104 | 40 likes, 1.7k views | LegalAI exploring KAG / KG-enhanced RAG (early-stage vendor claim) |
| 2026-07-29 | @SciFi (arXiv bot) | https://x.com/SciFi/status/2082515877774168375 | 0 likes, 124 views | Paper: *LLM-Assisted Ontology Engineering… French Legal Knowledge Graph* https://arxiv.org/abs/2607.24551 |
| 2026-06-08 | @veriprajna | https://x.com/veriprajna/status/2063935034881671460 | low | Claims GraphRAG +14% legal retrieval vs vector; underlayer for Harvey/Lexis (vendor claim) |

### 5.2 Linked “shipped or near-shipped” systems

#### A. Neo4j agentic GraphRAG for commercial contracts (May 2025)

- Blog: https://neo4j.com/blog/developer/agentic-graphrag-for-commercial-contracts/
- Code: https://github.com/tomasonjo-labs/legal-tech-chat
- Dataset: CUAD (https://www.atticusprojectai.org/cuad)
- **What ships:** LLM structured extraction (Pydantic) → Neo4j graph (Contract, Party, Clause, Location) → LangGraph agent tools with **deterministic Cypher**, optional vector summary search, public demo DB credentials documented in the post.
- **What it is not:** DoCO/FOLIO/SALI IRIs. Schema is **task-specific**, which is the practitioner norm.

#### B. LlamaIndex + Neo4j legal contract KG (Aug 2025)

- X: https://x.com/jerryjliu0/status/1957141315088728276
- Pattern: **parse structure first** (LlamaParse markdown tokens) → **classify** → **schema-dependent extract** → graph.
- Aligns with beep-effect’s “AST before retrieval” doctrine.

#### C. Docling Graph (OSS)

- https://github.com/docling-project/docling-graph
- Turns documents into validated Pydantic objects and a directed KG; targets chemistry, finance, **legal**.

#### D. Red Hat / finance agentic GraphRAG using Docling (Jul 2026)

- https://developers.redhat.com/articles/2026/07/22/how-we-built-agentic-graphrag-financial-disclosures
- Parses EDGAR/XBRL with Docling, builds structure-aligned graphs, multi-stage LangGraph agent with external judge — **architecture evidence**, adjacent to legal filings.

#### E. Graph RAG for legal norms (arXiv May 2025)

- https://arxiv.org/html/2505.00039v2 — hierarchical/temporal GraphRAG for norms (research).

#### F. LEXRAG / Neo4j talk (Nov 2025)

- https://www.youtube.com/watch?v=SJEnb5cadyo — GraphRAG over legislative codebase (practitioner conference signal).

#### G. French legal KG + LLM ontology engineering (arXiv 2026)

- https://arxiv.org/abs/2607.24551

### 5.3 Patent-specific signal

X keyword search for patent + ontology/GraphRAG mostly returns **unrelated patent applications that mention knowledge graphs**, or speculative institutional redesigns, not shipped patent-office AI ontologies.

More useful **web practitioner signal** (structure-first drafting, not OWL):

- DeepIP 2026 guide: AI drafting as **structured section workflow** (disclosure → claims → spec → drawings): https://www.deepip.ai/blog/patent-drafting-ai-guide
- Patentext: prioritize tools that build **logical segmentation** of claims/spec, not word salad: https://patentext.com/blog/best-ai-patent-drafting-tools/
- IPWatchdog skepticism: LLMs can mimic claim **structure** but struggle with **novelty**: https://ipwatchdog.com/2024/04/21/ai-tools-patent-drafting-llms-will-likely-never-write-claims-well-humans/
- Patent Bots: mix of generative + **rules-based** section generation: https://blog.patentbots.com/

ALEA’s **KL3M** data project *includes USPTO patents* as copyright-clean training corpus (https://x.com/joelniklaus/status/1987173543982080435) — training-data signal, not a patent-document ontology.

**Assessment:** patent AI tooling in 2025–2026 markets **document section structure and claim hierarchy**, not SPAR DoCO. beep-effect should plan a **patent document schema** (claims, background, summary, detailed description, drawings list, office-action grounds) as a first-class domain model, optionally *typed with* DoCO section containers + DEO-like rhetoric where it fits.

### 5.4 Critiques and anti-hype (GraphRAG / ontology)

These posts are important calibration against vendor decks:

| Date | Author | URL | Engagement | Critique |
| --- | --- | --- | --- | --- |
| 2026-08-06 | @sameersparadkar | https://x.com/sameersparadkar/status/2085231084015669572 | low | Most “advanced RAG” solves problems nobody has; GraphRAG only when real relationships exist |
| 2026-08-06 | @iHarnoorSingh | https://x.com/iHarnoorSingh/status/2085188922410492142 | 3 likes | “GraphRAG is expensive” |
| 2026-08-08 | @CharleSpectre | https://x.com/CharleSpectre/status/2086031791719174297 | 1 like | “GraphRAG is too expensive and hallucinates too much” |
| 2026-08-05 | @TheYotg / LinearRAG | https://x.com/TheYotg/status/2084948302911435241 | 12 likes | Relation extraction flips negations / invents hierarchy; entity-sentence-passage graphs without LLM RE can beat triple GraphRAG on multi-hop QA and cut indexing cost |
| 2026-06-07 | @Cris_KB2A | https://x.com/Cris_KB2A/status/2063492049610121309 | low | GraphRAG worth it for relationship-dense domains (legal citations, fraud); not default upgrade |
| 2026-08-05 | @bijani_nishant | https://x.com/bijani_nishant/status/2085065065963856115 | 0 | “Knowledge graph without ontology is expensive pile of nodes” |
| 2026-08-04 | @hankshiro | https://x.com/hankshiro/status/2084616577660707325 | 0 | Graphs aren’t hype; **GraphRAG productization** is the temporary hype |

**Practitioner consensus (distilled):**

1. **Structure the document first** (parse tree / markdown AST).
2. Use graphs when **multi-hop relationships** matter (parties–clauses–obligations–governing law).
3. Prefer **typed extraction schemas** over free-form triple mining.
4. Budget for **entity resolution** (Neo4j post is explicit that party name variance is hard).
5. Ontology without operational tooling is ceremony; tooling without ontology is noise.

---

## 6. Semantic document structure for AI drafting tools

### 6.1 Docling — the breakout OSS “document structure” layer

**Docling** (IBM Research origin; LF AI & Data project; MIT license) parses PDF/DOCX/etc. into a unified `DoclingDocument` with layout, reading order, tables, formulas, exports (Markdown, HTML, JSON, DocTags), integrations (LangChain, LlamaIndex, CrewAI, Haystack), MCP server, and **USPTO patent** / JATS / XBRL XML schema support.

- Repo: https://github.com/docling-project/docling
- Docs: https://docling-project.github.io/docling/
- Tech report: https://arxiv.org/abs/2408.09869
- Graph extension: https://github.com/docling-project/docling-graph

**X signal:**

| Date | Author | URL | Engagement | Notes |
| --- | --- | --- | --- | --- |
| 2025-02-12 | @rohanpaul_ai | https://x.com/rohanpaul_ai/status/1889469619544662179 | **226 likes, 26 RT, 289 bookmarks, 17.9k views** | “Get your documents ready for gen AI” — Docling feature dump |
| 2026-08-09 | @kobaHUB | https://x.com/kobaHUB/status/2086441094867284070 | 24 likes, 19 bookmarks, 1.3k views | Docling engineer video: **tree of sections vs chunk salad** for agents |
| 2026-08-10 | @Automager | https://x.com/Automager/status/2086693668283380208 | 3 likes | Practitioner: PDFs remain painful even with Docling; “AI will solve intergalactic travel before perfect PDF parsing” (Lee Mager, LSE Law School) |

**Why it matters for beep-effect:** Docling is the open-source manifestation of the same principle as `@beep/md` + Pandoc mapping — **preserve structure through the AI pipeline**. It is not an ontology, but it is the industrial path documents take *into* ontological layers.

### 6.2 DGML (Docugami Document Graph Markup Language)

**DGML** aims to preserve clause structure, tables, cross-refs, and provenance for enterprise AI / legal / RWA tokenization narratives.

- Project site referenced in posts: https://www.dgml.io/
- Docugami product context: https://www.docugami.com/ (company)
- X: https://x.com/christ0x33/status/2086757543263518964 (1 like, 53 views) — DGML pitch for legal AI + provenance
- Follow-up: https://x.com/christ0x33/status/2086763682604695605

**Assessment:** **product/standard marketing + crypto-adjacent amplification** in Aug 2026. Treat as interesting *prior art for clause-level graphs*, not as an open standard with the maturity of AKN or SPAR. Jean Paoli (ex-Microsoft XML) association is credibility for document markup experience (cited in posts as @jeanpaoli / Docugami).

### 6.3 In-editor legal drafting agents (structure as UX)

| System | Evidence | Structure angle |
| --- | --- | --- |
| **Definely** | LangChain case study post https://x.com/LangChain/status/1909618484981510580 · Word-native agents | Clause extraction, change analysis, human approval loops |
| **LegalOn** | https://x.com/litigationai/status/2086150700942451141 (21 likes, 1.9k views) | 100+ attorney-built workflows for in-house (Aug 2026 commentary) |
| **CaseMine AMICUS** | https://x.com/caseminelaw/status/2085759647806558333 | Prompt → structured legal draft (product video, low engagement) |
| **monday.com “Drafted”** | https://x.com/mondaydotcom/status/2085013458064416908 | Clause retrieval + addendum generation from firm positions |
| **Clio + Harbor** | https://x.com/goclio/status/2084686077579690111 · press https://www.clio.com/about/press/clio-harbor-global-partnership/ | Firm AI operationalization partnership (not ontology) |
| **Ballard Spahr / Syllo** | https://x.com/TodayEdiscovery/status/2085050600291446961 · firm news https://www.ballardspahr.com/insights/news/2026/08/ballard-spahr-expands-ai-adoption-with-firm-wide-rollout-of-syllo-litigation-agent | Litigation agent firm-wide rollout (Aug 2026) — **shipped firm deployment** signal |

**Pattern:** production legal AI drafting tools sell **workflow + Word integration + governance**, not OWL. Structure is **clause libraries, matter metadata, and approval graphs**.

### 6.4 Prompt-culture vs schema-culture

High-engagement posts still teach **prompt packs for legal drafting** (e.g. https://x.com/R_N_Vaghani/status/1995325985777135978 — 425 likes, 884 bookmarks; https://x.com/R_N_Vaghani/status/1980959821454074277 — 593 likes). That is mass practitioner behavior, but it is the **opposite** of beep-effect’s schema-first agents. The strategic opportunity is to **replace prompt folklore with typed document sections + FOLIO matter tags + provenance**.

---

## 7. Credible voices map (follow list for this domain)

| Voice | Why credible | Primary surface |
| --- | --- | --- |
| **Silvio Peroni / SPAR Ontologies maintainers** | Authors of DoCO/SPAR suite | https://www.sparontologies.net/ · GitHub SPAROntologies |
| **Monica Palmirani / LegalDocML community** | Akoma Ntoso architects; legal AI talks | OASIS LegalDocML, academic |
| **Michael Bommarito, Jillian Bommarito, Daniel Katz** | FOLIO/ALEA, legal AI agents research | openlegalstandard.org, SSRN, X |
| **Damien Riehl** | SALI history + FOLIO advocacy + vLex | Legaltech News quotes |
| **Jerry Liu / LlamaIndex** | Production document→structure→extract pipeline | X @jerryjliu0, @llama_index |
| **Tomaž Bratanič (Neo4j)** | Reference GraphRAG legal contracts implementation | neo4j.com blog, GitHub tomasonjo-labs |
| **LangChain** | Amplifies Definely + contract GraphRAG | X @LangChain |
| **IBM / Docling maintainers** | Dominant OSS document structure for genAI | github.com/docling-project |
| **Lee Mager (LSE Law)** | Grounded PDF-pain practitioner | X @Automager |
| **Connected Data / Year of the Graph** | GraphRAG skepticism + layered KG PoCs | @Connected_Data, @TheYotg |

---

## 8. Ranked shortlist — ontologies, standards, and tools

Rank combines: **fit to beep-effect (patent + office-action agents + AST)** × **open license / integrability** × **evidence of shipping** × **2025–2026 practitioner energy**. Licenses verified from primary pages where possible; re-check before vendoring.

### 8.1 Tier S — adopt / integrate soon

| # | Name | Role | License (as stated) | Shipped? | Rank rationale | URLs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **FOLIO** (+ MCP) | Legal concept taxonomy for agents (areas of law, document types, entities, venues) | **CC BY 4.0** (ontology); MCP package open on GitHub/PyPI | **Yes** — API, Python, MCP (Mar 2026) | Best-in-class public agent surface for legal concepts; maps to `@beep/ontology` TaxonomyLoader + professional-desktop MCP | https://openlegalstandard.org/ · https://github.com/alea-institute/folio-mcp · https://creativecommons.org/licenses/by/4.0/ |
| 2 | **DoCO + DEO + PO (SPAR)** | Structural + rhetorical document component vocabulary; PO as conservation law for AST mappings | **CC BY 4.0** (DoCO header) | **Yes as OWL artifacts**; low product adoption | Formal match to `@beep/md` Inline/Block; wire as RDF vocab modules, not runtime reasoner | https://sparontologies.github.io/doco/current/doco.html · https://github.com/sparontologies/doco |
| 3 | **Docling / DoclingDocument** | Parse/layout intermediate for ingestion into ASTs & graphs | **MIT** (codebase) | **Yes** — major OSS | Industry path for PDF→structure; USPTO patent schemas already in feature set | https://github.com/docling-project/docling |

### 8.2 Tier A — use selectively / map from

| # | Name | Role | License | Shipped? | Notes | URLs |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | **SALI LMSS** | Legal matter tagging industry brand | Historical **MIT** on published LMSS (per FOLIO letter; verify current SALI terms) | Taxonomy yes; governance contested | Keep mapping table FOLIO↔SALI; avoid hard dependency until rights counsel OK | https://sali.org/ · https://openlegalstandard.org/whats-happening-with-sali-soli-folio |
| 5 | **Akoma Ntoso / LegalDocML** | Legislative/judicial document XML | OASIS standard (open) | **Yes** in government pipelines | Use if beep-effect touches statutes/regulations; less central for patent applications | https://www.oasis-open.org/standard/akn-v1-0/ |
| 6 | **Web Annotation (OA) + PROV + DCTERMS** | Anchors, provenance, bibliographic metadata | W3C / DCMI open | **Yes** (already in `@beep/rdf`) | Rhetoric & agent claims as annotations over AST node ids — already in-repo | W3C Web Annotation, PROV-O, DCMI |
| 7 | **Neo4j legal GraphRAG pattern** (schema-agnostic) | Contract entity graph + agent tools | Neo4j community / AGPL/enterprise for DB; demo code on GitHub | Demo + cookbook **yes** | Steal **patterns** (structured extract → deterministic query tools), not the stack | https://github.com/tomasonjo-labs/legal-tech-chat |

### 8.3 Tier B — watch / optional

| # | Name | Role | License | Shipped? | Notes | URLs |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | **Docling Graph** | Document→validated objects→KG | Check repo LICENSE (docling-project) | Early OSS | May bridge Docling trees to beep graphs | https://github.com/docling-project/docling-graph |
| 9 | **DGML / Docugami** | Clause-level document graph markup | Proprietary / product-led open claims | Product | Interesting provenance story; not open academic SPAR | https://www.dgml.io/ |
| 10 | **LinearRAG / HippoRAG-class methods** | GraphRAG without brittle RE | Research code / papers | Research | Inform retrieval design; don’t bet product on one paper | LinearRAG paper via https://x.com/TheYotg/status/2084948302911435241 |
| 11 | **FaBiO / C4O / CO** (SPAR siblings) | Bibliographic types, content, ordered collections | SPAR suite (typically CC-BY family — verify per ontology) | Academic | Useful if publishing/citation graphs expand | https://www.sparontologies.net/ |

### 8.4 Explicit non-priorities (for now)

| Name | Why deprioritize |
| --- | --- |
| Full OWL reasoning over DoCO at edit time | `@beep/md` already enforces PO-like laws via `S.suspend` unions; runtime OWL is cost without UX win |
| Vendor GraphRAG as default retrieval | Practitioner critiques on cost/hallucination; start hybrid structure+vector; graph for multi-hop legal relations only |
| Crypto-RWA document tokenization stacks using DGML | Orthogonal to patent practice desktop; high noise on X |

---

## 9. Hype vs shipped — scorecard

| Claim heard on X / blogs | Reality check |
| --- | --- |
| “GraphRAG fixes legal AI” | **Partial.** Helps multi-hop contract Q&A when schema is good (Neo4j demo). Expensive and brittle if built on noisy LLM triples (LinearRAG critique). |
| “Legal ontologies are dead; only embeddings matter” | **False.** FOLIO MCP + matter tagging + structured extract are *increasing*. Embeddings alone fail on parties/dates/active contracts (Neo4j blog). |
| “SPAR DoCO is what enterprises use for contracts” | **False (on public signal).** Enterprises use CLM clause models, CUAD-like extract schemas, Docling trees, AKN for legislation. |
| “SALI is the universal language of legal work” | **Aspirational / contested.** Real historical traction; 2024–26 governance fight with FOLIO fork undermines “universal.” |
| “FOLIO has 100+ adopters” | **Self-reported.** Software surface is real; customer list not independently verified here. |
| “AI will write patent claims end-to-end” | **Overclaimed.** Tools help structure and boilerplate; novelty/strategy remain human (IPWatchdog). |
| “Document structure is optional for agents” | **False.** Highest-signal Docling/LlamaIndex content says **structure-first** is the difference between agent reliability and chunk soup. |

---

## 10. Live projects checklist (as of 2026-08-11)

| Project | Status | Entry point |
| --- | --- | --- |
| FOLIO ontology + explorer | Live | https://folio.openlegalstandard.org/ |
| FOLIO MCP | Live (API mode + local mode) | `uvx folio-mcp` · https://github.com/alea-institute/folio-mcp |
| FOLIO Python | Live | https://github.com/alea-institute/folio-python |
| SALI LMSS | Live brand; verify feed/license | https://sali.org/explore-the-standard/ |
| SPAR DoCO 1.4.0 | Live OWL (updated 2026-06-25) | https://sparontologies.github.io/doco/current/doco.html |
| Docling | Live, high velocity | https://github.com/docling-project/docling |
| legal-tech-chat (Neo4j) | Public demo + code | https://github.com/tomasonjo-labs/legal-tech-chat |
| ALEA KL3M data | Live on HF | Hugging Face `alea-institute` datasets (via Niklaus post) |
| Akoma Ntoso | OASIS standard + national profiles | https://www.oasis-open.org/standard/akn-v1-0/ |

---

## 11. Fit for beep-effect — assessment

### 11.1 Mapping to in-repo architecture

From this packet’s session research (`RESEARCH.md`):

- `@beep/md` already encodes **PO-like** Inline/Block/Atom/Popup laws as recursive tagged unions.
- `@beep/pandoc-ast` and `@beep/lexical-schema` are projections; mapping lossiness is the conservation-law problem PO names.
- `@beep/rdf` already has OA, PROV, DCTERMS, SKOS, OWL modules — natural home for **DoCO/DEO/PO term modules**.
- `@beep/ontology` TaxonomyLoader already eats TTL/JSON-LD — **FOLIO JSON-LD export and DoCO ttl are loader-ready**.
- `apps/professional-desktop` is the agent surface for patent apps / office-action responses.

### 11.2 Recommended layering (aligned with both research and 2025–26 practitioner signal)

```
┌─────────────────────────────────────────────────────────────┐
│ Agents (professional-desktop)                               │
│  - FOLIO MCP / local TaxonomyRegistry for matter & doc type │
│  - Section-aware tools (not free-form RAG only)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ Annotation / KG layer (RDF)                                 │
│  - OA anchors on AST node ids / spans                       │
│  - DoCO structural types + DEO rhetorical types             │
│  - PROV for agent edits & retrieval evidence                │
│  - FOLIO concepts as skos:Concept / domain tags             │
│  - Optional: contract/patent entity graph (parties, claims) │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ Canonical document AST — @beep/md                           │
│  - PO patterns as classification of constructors (cite,     │
│    don't runtime-import OWL)                                │
│  - Section tree as derived fold from headings               │
│  - Patent schema: claims hierarchy, background, detailed    │
│    description, abstract, drawings — domain extension       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ Ingestion projections                                       │
│  - Docling / LlamaParse / Pandoc → md AST                   │
│  - Lexical editor ←→ md                                     │
└─────────────────────────────────────────────────────────────┘
```

### 11.3 What to take from practitioner signal (do)

1. **Ship FOLIO (or a vendored subset) behind TaxonomyRegistry + optional MCP** — matches Mar 2026 industry direction and ALEA’s free API model.
2. **Generate `@beep/rdf` vocab modules for DoCO/DEO/PO** — low risk, high interop, supports principled chunking (“retrieve all `deo:Introduction` / claims sections”).
3. **Structure-first ingestion** — treat Docling-class trees as peers of Pandoc; never RAG on unstructured PDF text as the primary path for patents.
4. **Patent/office-action domain schema** — first-class Effect Schema models for claim trees and OA response sections; optionally type nodes with DoCO containers.
5. **Graph retrieval only for multi-hop** (party–claim–prior-art–rejection ground); default to AST-section + vector hybrid.
6. **Provenance everywhere** — practitioners (DGML pitch, Neo4j tools, LinearRAG skeptics) converge on: *which clause/version supports this answer?*

### 11.4 What to avoid (don’t)

1. **Don’t re-platform the editor AST on OWL DoCO** — your Schema unions are stricter and faster.
2. **Don’t hard-bind to SALI IRIs alone** without a FOLIO mapping strategy and legal review of the 2024–25 dispute.
3. **Don’t adopt full Microsoft GraphRAG-style community detection over a small patent corpus** by default — cost/skepticism is high.
4. **Don’t confuse X engagement with production law-firm deployment** — Definely/Clio/Ballard-Spahr posts show *firms buy agents*; they rarely show *firms buy SPAR*.

### 11.5 Risk register specific to this sweep

| Risk | Mitigation |
| --- | --- |
| SALI/FOLIO rights dispute | Prefer CC-BY FOLIO artifacts; keep abstraction `LegalConceptId`; dual-map if clients require SALI tags |
| GraphRAG cost | Cap graph use to typed relations extracted under schema; measure vs section-hybrid baseline |
| PDF lossiness | Accept imperfect parse; store original binary + AST + confidence; human-in-loop for claim critical sections |
| Over-ontology | Only promote terms that answer a competency question (DoCO’s CQ list is a good template) |

### 11.6 Bottom line

**2025–2026 practitioner energy validates beep-effect’s existing bet more than it introduces a new one:** agents need **(a)** a strict document structure model, **(b)** a legal concept taxonomy callable by tools/MCP, and **(c)** provenance-linked retrieval—not a revival of pure symbolic OWL document systems as the product UI.

- **DoCO/PO:** use as the **theory and wire vocabulary** for structure/rhetoric.
- **FOLIO:** use as the **legal concept service** for agents.
- **Docling-class pipelines:** use as **ingestion reality**.
- **GraphRAG:** use as a **scalpel** for relational legal questions.
- **Patent work:** still needs a **domain schema** the industry has not standardized on X; beep-effect should define it schema-first rather than wait for SPAR to invent patent claims classes.

---

## 12. Appendix A — selected X post index (copy-pasteable)

```
https://x.com/LangChain/status/1934294834086387829
https://x.com/llama_index/status/1956462158138712426
https://x.com/jerryjliu0/status/1957141315088728276
https://x.com/LangChain/status/1909618484981510580
https://x.com/rohanpaul_ai/status/1889469619544662179
https://x.com/LegalTechStrtUp/status/1963269111682908339
https://x.com/joelniklaus/status/1987173543982080435
https://x.com/tom_doerr/status/2081009750204916172
https://x.com/Connected_Data/status/2086762506773532924
https://x.com/TheYotg/status/2084948302911435241
https://x.com/pauliusztin_/status/2083591085385818419
https://x.com/sameersparadkar/status/2085231084015669572
https://x.com/christ0x33/status/2086757543263518964
https://x.com/kobaHUB/status/2086441094867284070
https://x.com/Automager/status/2086693668283380208
https://x.com/goclio/status/2084686077579690111
https://x.com/TodayEdiscovery/status/2085050600291446961
https://x.com/litigationai/status/2086150700942451141
https://x.com/pvergadia/status/2002204809164677292
https://x.com/SciFi/status/2082515877774168375
```

## 13. Appendix B — primary non-X URLs

```
https://sparontologies.github.io/doco/current/doco.html
https://sparontologies.github.io/po/current/po.html
https://www.sparontologies.net/ontologies/doco
https://github.com/sparontologies/doco
https://openlegalstandard.org/
https://openlegalstandard.org/folio-mcp-server-ai-agents
https://openlegalstandard.org/whats-happening-with-sali-soli-folio
https://openlegalstandard.org/resources/folio-mcp-tools
https://github.com/alea-institute/folio-mcp
https://github.com/alea-institute/FOLIO
https://sali.org/
https://sali.org/explore-the-standard/
https://www.agiloft.com/blog/what-are-sali-standards-and-the-sali-alliance/
https://neo4j.com/blog/developer/agentic-graphrag-for-commercial-contracts/
https://github.com/tomasonjo-labs/legal-tech-chat
https://github.com/docling-project/docling
https://github.com/docling-project/docling-graph
https://arxiv.org/abs/2408.09869
https://www.oasis-open.org/standard/akn-v1-0/
https://www.popvox.org/blog/when-law-becomes-data
https://developers.redhat.com/articles/2026/07/22/how-we-built-agentic-graphrag-financial-disclosures
https://arxiv.org/abs/2607.24551
https://arxiv.org/html/2505.00039v2
https://www.dgml.io/
https://ipwatchdog.com/2024/04/21/ai-tools-patent-drafting-llms-will-likely-never-write-claims-well-humans/
https://www.deepip.ai/blog/patent-drafting-ai-guide
```

---

## 14. Sweep metadata

| Field | Value |
| --- | --- |
| Authoring agent | Grok 4.5 (native X + web fetch) |
| Firecrawl | Rate-limited on this network at sweep time; used web_search/web_fetch instead for linked pages |
| Confidence | High on shipped FOLIO/Docling/Neo4j artifacts; **medium** on industry adoption counts; **low** on SALI corporate claims (one-sided public record) |
| Follow-ups | (1) Counsel review of SALI/FOLIO license lineage; (2) map FOLIO document-type branch to patent/OA types; (3) Docling USPTO path vs `@beep/pandoc-ast` bake-off; (4) optional scrape of Legaltech News full article behind SALI/FOLIO story |

---

*End of report.*
