# Harvey's Public Retrieval & Knowledge Architecture

**Date:** 2026-08-08
**Packet:** `explorations/harvey-lab-firm-knowledge`
**Lens:** external landscape sweep — what Harvey has *published* about how it
represents and retrieves firm knowledge, and what the LAB firm-knowledge
expansion reveals about where they are going next.
**Scope note:** this is an architecture/strategy read. The operator is not
competing with Harvey at scale and does not want a similar product. Nothing
here is a product recommendation.

---

## 0. Method, confidence, and how to read the citations

**Sources swept:** harvey.ai blog (engineering + product + benchmark posts),
harvey.ai product pages, harvey.ai author pages, the `harveyai/harvey-labs`
GitHub README, Calvin Qi's personal site, Voyage AI's blog, Artificial Lawyer,
LawSites/LawNext, ZenML's LLMOps database, Sequoia's Training Data podcast page,
Built In NYC and Welcome to the Jungle job listings. Every URL in §Sources was
actually fetched in this session unless explicitly marked.

**Confidence legend used throughout:**

| Tag | Meaning |
|---|---|
| **[ENG]** | Engineering evidence — a named mechanism, number, or component in a technical post |
| **[MKT]** | Marketing claim — product-page assertion with no disclosed mechanism |
| **[3P]** | Third-party characterization, not Harvey's own words |
| **[UNVERIFIED]** | Could not be fetched/confirmed this session; do not quote downstream as fact |

**Extraction caveat (applies to every harvey.ai quotation below):** page text
was pulled through WebFetch's HTML→markdown→summarizer path, not byte-verified
against raw HTML. Wording is high-confidence but treat exact-quote fidelity as
~95%, not 100%. The one exception is the Calderwood & Harkness announcement,
which is quoted from the locally scraped copy in
[`../assets/x-post-itsjuliopereyra-2085772997944803682.md`](../assets/x-post-itsjuliopereyra-2085772997944803682.md)
— that text is a direct scrape and is safe to quote verbatim.

**Prior packet work reused, not re-derived:** harness mechanics, tool surface,
corpus anatomy, task census, and eval machinery all come from the 2026-08-08
opus-5 mining run — `map-harness.md`, `map-evaluation.md`, `map-task-census.md`,
`map-corpus.md`, `map-pipeline-docs.md`, `mine-benchmark-integration.md`,
`verify-facts.md`. Numbers quoted from those files are the post-correction
values per `verify-facts.md` §G.

---

## 1. TL;DR — the answer to "what is Harvey's knowledge architecture?"

Harvey's public architecture is a **very well-engineered, evaluation-driven,
embedding-first RAG platform with an agentic search loop on top and a thin
relational scaffolding (client → matter → document + permissions) around it.**

- The substrate is **chunk → embed → vector index**, at industrial scale
  (24.8M documents / 56 TB in a week, July 2026) **[ENG]**.
- The intelligence lives in the **loop and the ranking**, not in the
  representation: agentic search plans, retrieves, checks sufficiency, and
  re-retrieves **[ENG]**.
- There is **no public evidence of a knowledge graph, an ontology, RDF/OWL,
  entity resolution, or any formal semantic layer** anywhere in Harvey's
  published corpus. The structure that exists is metadata, filters, tabular
  extraction, and declarative jurisdiction config — not a graph **[ENG/MKT]**.
- The closest thing to a semantic-layer thesis they have articulated in public
  is Gabe Pereyra's **"world model"** framing (Apr 2026), and even there he
  describes it as *process encoding* and "putting all of your context ... into
  one place where it's legible," not as a graph or ontology **[3P interview]**.
- The **Calderwood & Harkness / LAB firm-knowledge release (2026-08-07) is the
  first public admission that the loop-and-ranking strategy runs out of road at
  enterprise corpus scale**, and it names the fix: "build richer representations
  of the corpus up front — indexes, summaries, memory — and amortize the cost of
  building such representations across subsequent runs."

**The strategic shape:** Harvey has publicly diagnosed the exact problem that a
structured knowledge layer solves, and has publicly chosen (so far) to attack it
with *amortized indexes/summaries/memory* and, via the Engram partnership and
their own custom-model program, with **knowledge-in-weights** — not with a
schema-first semantic layer. That is the seam.

---

## 2. The production retrieval stack, in order of the pipeline

### 2.1 Ingestion and document processing **[ENG]**

Harvey's most technically explicit post is *"Scaling Document Processing Across
the Harvey Platform"* (2026-07-27). It describes a **three-stage pipeline with
independent bottlenecks**:

1. **Extraction** — download, type identification, text/structure extraction,
   OCR for scanned content, metadata capture (file type, size, page count,
   source, processing status).
2. **Chunking & Embedding** — "splits extracted content into retrievable chunks
   and generates embeddings," bottlenecked by document size, chunk volume, CPU,
   and embedding-model throughput.
3. **Indexing** — "writes chunks, metadata, and embeddings to retrieval layer
   for search/citation/reasoning," bottlenecked by vector-store write throughput
   and downstream backpressure.

Scale, as published: **0.94M documents/week (1.44 TB) a year prior → 24.8M
documents/week (56 TB)** in the latest complete week — 26× more documents, 39×
more data, ~3.5M documents/day.

Named infrastructure components:

- **Job Framework** — replaced an older queue; durable workflow state, explicit
  timeouts/retries, file-level failure isolation, regional worker management.
- **UDF (Unified Document Format)** — "a versioned internal format replacing
  monolithic document objects, reducing extraction latency by ~17-19% at p90."
- **Arrow IPC** — replaced JSON serialization in the embed→index handoff.

Input formats named: "Contracts, closing binders, deposition transcripts, email
archives, scanned PDFs, and entire data-room exports," plus connector exports
from **iManage, SharePoint, Box, Google Drive, NetDocuments**.

**Read on UDF:** this is the one component that could plausibly be a structural
representation layer. As published, it is described as a document-object
serialization format with a version, chosen for latency — *not* as a semantic
model. Treat "UDF is a semantic layer" as **[UNVERIFIED]** speculation.

### 2.2 Embeddings and the vector store **[ENG]**

*"Enterprise-Grade RAG Systems"* (2025-02-20) is the architecture post. It
names three data categories and the vector-DB decision:

| Data category | Scale |
|---|---|
| Temporary assistant threads | 1–50 docs |
| Long-term Vault projects | 1,000–10,000 docs |
| Third-party regulatory sources | n/a (public corpora) |

Vector DB choice: **LanceDB Enterprise** for production, **Postgres +
PGVector** retained for smaller public-data projects and dev simplicity.
Selection criteria as published: `<2s P50` for 15M rows *with metadata
filtering*; "massive-scale IVF-PQ index with search parameters to tune recall";
"decentralized by design. Data can live in various cloud buckets"; "unlimited
horizontal scaling of storage."

The post enumerates six retrieval complexities, of which two matter for this
packet: **"sparse vs. dense representations"** (i.e. they run hybrid, or at
minimum think in hybrid terms) and **"straightforward ground-truth evaluation
sets do not exist publicly"** for specialized legal tasks — which is the seed of
the whole BigLaw Bench → LAB program (§4).

*"How Harvey Secures Embeddings at Scale"* (2026-04-30) confirms the RAG shape
from the security side: uploaded files, Vault documents, and knowledge sources
are "converted into vector representations stored in dedicated vector
databases," enabling "semantic (i.e. meanings-based) search." Tenancy: "Harvey
stores embeddings in a vector database, and we partition that storage so that
each workspace has its own dedicated, isolated footprint," with "distinct,
non-overlapping namespaces." Query embeddings "exist only for the duration of
that request." Retrieval shape: "The system retrieves only the most relevant
vectors for a workspace and assembles them into a narrow context window scoped
to that interaction only."

**That last sentence is the architectural tell.** Retrieval is *per-request,
narrow-context assembly from a vector index*. There is no persistent derived
representation of the corpus in that description — which is precisely what the
C&H post (§5) says needs to change.

### 2.3 Domain-specific embeddings **[ENG]**

Voyage AI (2024-07-31) published the partnership: **`voyage-law-2-harvey`**,
fine-tuned from `voyage-law-2` on "more than 20 billion tokens of legal text"
using self-supervised techniques plus expert-annotated question→relevant-case
datasets. Published results: **25% reduction in irrelevant material in top
results** vs `text-embedding-004` and `text-embedding-3-large`, at **1/3 the
embedding dimensionality**, evaluated on **NDCG@10 and Recall@100**. Harvey
combined it with "other proprietary search methods" (undisclosed).

### 2.4 What actually drives retrieval quality, per Harvey **[ENG]**

*"BigLaw Bench Deep Dive: Retrieval"* (2024-11-13, Niko Grupen and Julio
Pereyra) is the single most useful post for this packet's question. Harvey
reports "up to 30% more relevant content than alternative retrieval methods"
(OpenAI, Voyage, Cohere baselines), measured as **recall at a fixed token
threshold** against ground truth set by their legal research team.

They name **three differentiators**:

1. **Metadata** — "contextualizing passages within complicated documents."
2. **Features** — "capturing factors like recency absent from semantic search."
3. **LLM-based retrieval** — "using language models for complex relevancy
   judgments."

Also notable: performance gaps appeared even between *similar* document types
(Merger Agreements vs Stock Purchase Agreements) "although lawyers would
typically consider these complex contracts as relatively similar."

**Read:** this is Harvey publicly stating that pure embedding similarity is
insufficient and that **structure-around-the-chunk (metadata, features) plus an
LLM reranker** is where the wins are. That is one hop short of a semantic layer
— and they stopped at that hop. "Features like recency" is a hand-built signal,
not a modeled fact. Contrast with a claim/evidence substrate where "this matter
settled" is a first-class typed fact.

### 2.5 The agentic search loop **[ENG]**

*"How Agentic Search Unlocks Legal Research Intelligence at Harvey"*
(2025-12-10, by Lysia Li, Varun Nair, Aaron Stern, Pablo Felgueres, Calvin Qi,
Philip Cerles) describes a five-step iterative workflow:

1. Query understanding and planning
2. Dynamic tool selection (which sources, which queries)
3. Reasoning and synthesis
4. **Completeness check** — evaluate sufficiency; if gaps remain, return to (2)
5. Citation-backed response

Framing: moving "from static, one-shot retrieval to a system that reasons about
what information it needs, where to find it, and when to dig deeper."

Sources the agent can reach: **"150+ legal knowledge sources"** plus internal
Vault documents, **iManage** integration, and proprietary databases including
**LexisNexis** case law.

Evaluation: because Harvey does not observe customer queries (privacy
commitment), they built a "privacy-preserving evaluation" with in-house legal
experts. Reported gains: **tool-selection precision "from near zero to 0.8-0.9"**;
complex queries now "scale to 3-10 retrieval operations." Telemetry: OpenAI
Agent SDK OpenTelemetry traces → **LangSmith** for offline eval, tracking
hallucination, tool recall, retrieval recall, formatting, and answer quality.

**Read:** step 4 — the completeness check — is exactly the capability the C&H
baselines later show *failing at corpus scale* (§5). Harvey shipped the loop in
Dec 2025 and published its scale limit in Aug 2026. That is an honest and
unusually legible engineering arc.

### 2.6 Knowledge-source scaling: "The Data Factory" **[ENG]**

*"Using Agents to Scale Harvey's Knowledge Sources"* (date **[UNVERIFIED]** —
the page did not surface a publication date; content states "since August
2025"). Three components:

- **Intake Engine** — automated jurisdiction mapping + compliance review,
  turning coverage gaps into "vetted, pipeline-ready data sources." Two agents:
  a **Sourcing Agent** that "maps a jurisdiction's legal infrastructure,
  identifies trusted repositories, and cross-references them against our
  existing tools to find gaps," and a **Legal Review Agent** that pre-processes
  ToS/copyright/access policy (attorney throughput doubled to "two to four
  sources per hour, up from one to two").
- **Evaluation Pipeline** — synthetic scenario generation → production
  simulation → trace validation → multi-agent quality assessment, at
  **~150,000 tokens per evaluation**.
- **Configuration Layer** — "defines each jurisdiction declaratively through
  domain lists, filter hierarchies, permissions, and agent instructions,
  enabling a single unified reasoning agent across jurisdictions."

Coverage growth: **6 → 60+ jurisdictions; 20 → 400+ unique legal data sources**
since Aug 2025. Sources treated as "parameterized tools," enabling "a single
reasoning system that can fluidly move between Austrian court decisions and
Brazilian statutes in the same conversation." Explicitly *not* open web search:
"curated domain lists" ensure "every result comes from a vetted government
portal or authoritative legal database."

**This is the most ontology-adjacent thing Harvey has published** — a
declarative configuration layer over jurisdictions with domain lists, filter
hierarchies, and permissions. But note what it is: a **tool-registry
configuration schema**, not a domain ontology. It models *where to look*, not
*what a matter is*.

Stated future direction (relevant): organizing sources **by practice area**
(case law, tax codes, regulatory filings) to enable cross-jurisdictional
reasoning — i.e. a taxonomy over sources is on their roadmap.

### 2.7 Agent runtime **[ENG]**

*"Why we Built our own Cloud Agent Infrastructure"* (2026-06-01, Gabe Pereyra).
Key points bearing on knowledge representation:

- A runtime abstraction layer that "normalizes the harness, the sandbox, and the
  behavioral differences beneath a single interface" for multi-model routing.
- **State is session-scoped, not persistent.** Unlike managed runtimes that
  retain intermediate working memory and checkpoints in cloud storage, Harvey
  binds transient working disks to sandbox lifecycles; "automatic state
  persistence" is replaced by automatic cleanup at teardown.
- Zero-data-retention "can't be bolted on"; "customer data is not written into
  durable application storage by default."
- Claimed **3–5× cost reduction** vs frontier-model-only routing, including
  self-hosted open-source models.
- The post handles "hundreds of thousands or millions of files" but **does not
  describe how corpus representations are constructed or reused across runs.**

**Read — and this is a real tension worth naming:** Harvey's zero-retention,
session-scoped agent architecture is in direct structural tension with the
amortized-representation direction announced two months later in C&H. A
persistent derived index/summary/memory layer *is* durable derived customer
data. Whatever they ship next has to reconcile "richer representations
amortized across runs" with "customer data is not written into durable
application storage by default." That is a genuinely hard architectural
constraint, and it is self-imposed by their enterprise security posture.

---

## 3. Is there a knowledge graph, ontology, or semantic layer? — the evidence

**Direct answer: no public evidence of one. The structure Harvey has published
is relational scaffolding + metadata + tabular extraction + declarative source
config. Not a graph, not an ontology.**

### 3.1 What structure demonstrably exists

| Structure | Evidence | Type |
|---|---|---|
| Client → matter → document relationships | C&H post: "clients for whom they work and matters that they work on for those clients. We ground C&H in these core relationships." | Relational scaffolding **[ENG]** |
| Chunk-level metadata (file type, size, page count, source, status) | Scaling Document Processing | Index metadata **[ENG]** |
| Metadata filtering at query time (`<2s P50` at 15M rows *with metadata filtering*) | Enterprise-Grade RAG | Filter predicates **[ENG]** |
| "Metadata" + "Features" as top-2 retrieval differentiators | BigLaw Bench Retrieval | Ranking signals **[ENG]** |
| Structured tabular extraction into review tables | Vault product page | Per-document extraction **[MKT]** |
| Declarative jurisdiction config (domain lists, filter hierarchies, permissions) | Data Factory | Tool-registry schema **[ENG]** |
| UDF — versioned internal document format | Scaling Document Processing | Serialization format **[ENG]** |
| Permission model / ethical walls | Firm Knowledge page; Intapp ethical-wall launch (blog index, 2026-07-23) | Access control **[MKT]** |

### 3.2 What is conspicuously absent

Across every Harvey page fetched in this sweep — six engineering posts, three
product pages, two benchmark posts, the LAB README, an author page, and two
long-form founder interviews — **the terms "knowledge graph", "ontology",
"taxonomy", "RDF", "OWL", "SHACL", "triple store", and "entity resolution" do
not appear.** The fetch of the Firm Knowledge product page explicitly reported
that it "does not disclose ... knowledge graph or ontology structures ... entity
resolution techniques"; the Knowledge product page fetch reported "no mention"
of "knowledge graphs, ontologies, or taxonomies" or "entity/matter relationships
or structured metadata"; the Vault page fetch reported "no mention of formal
ontologies, knowledge graphs, or metadata schemas."

**Epistemic discipline:** absence of *public* evidence is not evidence of
absence internally. Harvey publishes selectively and their engineering posts
skew toward infra (queues, serialization, sandboxes, security) rather than
representation. A reasonable prior is that they have internal entity/matter
modeling that has simply never been written up. What can be stated with
confidence is narrower and still useful: **Harvey has never publicly positioned
a semantic/graph layer as a differentiator, and when they had the natural
opportunity to — the C&H post, whose entire thesis is corpus representation —
they named "indexes, summaries, memory" instead.**

### 3.3 The "world model" — the nearest public analogue

Artificial Lawyer, *"Harvey's Gabe Pereyra on Legal Agents + World Models"*
(2026-04-14, interviewer Richard Tromans). Pereyra defines a world model as
"putting all of your context, all of your company context into one place where
it's legible for all these models to use it," with a hierarchy:

1. **Client-matter level** — "the data room or the discovery corpus plus the
   document management system," plus case law and firm precedent.
2. **Firm-wide** — understanding connections between matters and clients.
3. **Process encoding** — "how do you encode the process for every practice area
   into these systems," plus billing and client-presentation systems.

Goal: "how do we encode our firm into a way that any human or any agent can
operate on it," with permissions. Agents run against isolated sandboxed
instances of relevant client matters, maintaining ethical walls.

**Read:** level 2 — "connections between client matters and clients" — is
literally a graph question, and level 3 is literally an ontology question. But
the framing Pereyra reaches for is **legibility and colocation** ("one place
where it's legible"), and **process encoding**, not modeling. This is the
context-engineering framing, not the semantic-web framing. The June 2026
Artificial Lawyer follow-up (*"Harvey Trains Open Source Models To Encode Law
Firm Workflows"*, 2026-06-18) makes the direction explicit: encode workflows
into **fine-tuned open-source models**, with CEO Winston Weinberg describing
proof-of-concept studies, and Pereyra stating the goals as serving "frontier
intelligence across our product surface areas at an affordable price and a
strong security posture" and creating "the foundations for law firms to build
their own specialized models and own their own intelligence." The article
describes "complex playbooks – i.e. digital twins of methodologies" alongside
the fine-tuned LLM. **No mention of knowledge graphs or formal ontologies.**

---

## 4. Evaluation culture — and what it implies about their engineering strategy

Harvey's evaluation program is, on the public record, their **strongest and most
distinctive engineering asset**. The arc:

| Date | Artifact | What it established |
|---|---|---|
| 2024-11-13 | BigLaw Bench Deep Dive: Retrieval | Recall-at-fixed-token-budget against expert ground truth; retrieval measured as a *first-class product surface* |
| 2025-02-20 | Enterprise-Grade RAG Systems | Public acknowledgment that "straightforward ground-truth evaluation sets do not exist publicly" for legal |
| 2025-12-10 | Agentic Search | Privacy-preserving eval built with in-house legal experts; OTel traces → LangSmith; tool recall / retrieval recall / hallucination as tracked metrics |
| 2026-05-06 | LAB launch | 1,250+ tasks, 24 practice areas, 75,000+ expert-written rubric criteria, **all-pass grading** |
| 2026-05-26 | LAB initial results | Frontier models <10% all-pass in aggregate; per-behavior deltas published |
| 2026-08-07 | C&H firm-knowledge expansion | 266 matters, ~10,000 files, 100M+ tokens, 250 retrieval/reasoning tasks |
| current | `harveyai/harvey-labs` README badges | **24+ practice areas, 1,671 tasks** (grown from the 1,250+ at launch) |

### 4.1 The methodology

**All-pass grading** is the load-bearing choice. From the LAB launch post: rubrics
break deliverables into "atomic, binary pass/fail criteria: facts, conclusions,
citations, severity ratings, recommendations, deadlines, dollar amounts, and
formatting choices," and "a deal-team report that identifies eight of ten risks
is not 80% useful; it is materially incomplete." A task passes only if *every*
required criterion passes. The worked change-of-control example carries **57
criteria across nine legal issues**.

**Initial results** (2026-05-26), all-pass: Claude Opus 4.7 **7.1%**, Sonnet 4.6
**5.4%**, Opus 4.6 **4.2%**, GPT-5.5 **2.1%**, Gemini 3.5 Flash **0.8%**.
Six agent actions defined: Read, Search, Execute, Write, Validate, Edit.
Per-behavior all-pass deltas published — verify-and-revise loop **+1.5**,
post-draft validation **+0.8**, thorough research before drafting **+0.4**,
targeted retrieval **+0.3**, structured analysis via code **+0.3**, grounding
against source documents **+0.3**, drafting without review **−1.2**, high
parallel tool use (5+ calls) **−0.5**. Cost/latency: Opus 4.7 ≈ **$50.90/task,
22 minutes**. Framing: "jagged intelligence"; "No single model is a silver
bullet for legal work today." Stated next steps include a public leaderboard
with **Artificial Analysis**.

### 4.2 What the eval culture implies about their strategy

1. **They are eval-led, not architecture-led, in public.** Every architectural
   move is justified downstream of a measurement. This is a genuinely good
   engineering culture and it is also *why* they arrive at "indexes, summaries,
   memory" rather than "ontology": those are the interventions that most
   directly move a recall-and-completeness metric, and they are measurable
   without committing to a domain model.
2. **The benchmark is also a market instrument.** Bob Ambrogi (LawSites,
   2026-05-19) calls LAB "the most ambitious public attempt yet to measure what
   legal AI agents can actually do on the kind of work law firms actually
   delegate," while noting flatly: "It is worth noting that LAB is a benchmark
   built by a market participant," and that Harvey's choices about what
   constitutes good legal work reflect its team's perspective. He cites
   Alt-Counsel's Houfu Ang on legal open source as "a federation of solo-author
   archipelagos," with well-funded vendors maintaining repos "almost exclusively
   by in-house staff" — "Open Source theatre." Whether LAB becomes a shared
   yardstick "will depend on how the leaderboard rolls out, how transparently
   submissions are normalized, and how much room the project leaves for outside
   contributors."
3. **Rubric-authoring is the moat, not the harness.** The harness is ~small and
   simple (see §5.3); 75,000+ expert-written criteria is the expensive part.
   That is the asset a solo/small shop cannot replicate — and correspondingly
   the part worth *consuming* rather than rebuilding (consistent with
   `DECISIONS.md` 2026-08-08: standing test asset; eval-as-reference).

---

## 5. The C&H / firm-knowledge announcement — reading their next direction

Primary source: the scraped announcement at
[`../assets/x-post-itsjuliopereyra-2085772997944803682.md`](../assets/x-post-itsjuliopereyra-2085772997944803682.md)
(Julio Pereyra, 2026-08-07, https://x.com/ItsJulioPereyra/status/2085772997944803682).
As of this sweep, **no corresponding post appears on the harvey.ai blog index**
(the index's Aug 2026 entries are marketing content; the most recent engineering
post is Scaling Document Processing, 2026-07-27). Treat the X post as the
canonical public text.

### 5.1 The environment

46 fictional clients; **266 in-progress or completed matters**; matters rendered
from ~1,000-token specifications into "a file system of 10-200 realistic
documents"; **250 tasks**; ~10,000 files; 100M+ tokens. Built with **Engram**.
Design principle: "Features are pinned to specific documents to allow features
to be traced to both the matter and file level." And critically: "A matter's
underlying features are not shown to agents at run-time, they must recover them
from the unstructured file system through a mix of search and reasoning."

Difficulty design, in their words: "the context needed to answer any one of
these questions is distributed, there are often no keywords to grep for, and at
100 million tokens the corpus is too large to exhaustively search."

### 5.2 The failure analysis — the most valuable paragraph they have published

> "Failures are largely explicable by an inability to comprehensively search and
> understand the corpus. Models mostly reason correctly about what they find,
> but often fail to find every relevant piece of information."

> "This is not a failure of search strategy. Agents consistently find the core
> information and satisfy around half the criteria. It is instead a failure to
> know when to keep looking for additional information. This suggests that
> agents do not build an effective intermediate model of what the corpus
> contains that allows them to know when their searches have been sufficiently
> exhaustive."

And the enumeration collapse: "As the number of atomic points required for
successful task completion increases, both models regress to 0% all-pass."

Baselines run with **GPT-5.6-sol and Opus-4.8**; both take "five or more minutes
per task and satisfy only around half of all grading criteria."

### 5.3 The harness caveat — do not over-read the baselines **[ENG, from prior mining]**

This is the correction that the external sweep must contribute back to the
packet. Per `map-harness.md` §3 and `mine-benchmark-integration.md`:

- The LAB harness exposes **six closed tools** — read, write, edit, glob, grep,
  bash — with `--network=none`, `--cap-drop=ALL`, and no MCP.
- **There is no vector index, no embedding model, no BM25, and no retrieval
  service anywhere in the harness.** The agent's entire retrieval surface is
  glob + grep + read over a raw filesystem.
- `glob` caps at **100** results and `grep` at **250**, **silently**
  (`tools.py:576`, `tools.py:629`) — "the enumeration tools lie by omission, so
  an agent that correctly believes its tool output is complete is wrong."
- `grep` is effectively **blind on this corpus**: it reads whatever glob matched
  as text, and on an OOXML zip that yields nothing usable.
- There is **no context management at all**: no compaction, no summarization, no
  tool-result truncation policy.

**Therefore:** the LAB firm-knowledge baselines measure *frontier agents driving
grep over a filesystem*, **not** Harvey's production retrieval stack (§2), which
has embeddings, hybrid signals, an LLM reranker, and an agentic completeness
loop. The published "agents can't build an intermediate model of the corpus"
conclusion is partly a **harness artifact** — the enumeration failure is
over-determined by the silent truncations.

This cuts both ways and both directions matter:

- **Against Harvey's framing:** the result is weaker evidence for "agents need
  amortized representations" than the post implies, because a competent
  retrieval layer was simply absent from the test.
- **In favor of the underlying claim:** the *shape* of the failure —
  enumeration/completeness collapsing as required-fact count rises — is exactly
  the failure mode that pure similarity retrieval also exhibits, and Harvey has
  independent production evidence for it (the Agentic Search completeness check
  exists precisely because one-shot retrieval was insufficient; BigLaw Bench
  Retrieval measures *recall*, not precision, as the headline metric).

### 5.4 The stated next direction

> "We think that a promising direction to improve agents in this capacity is to
> allow them to build richer representations of the corpus up front — indexes,
> summaries, memory — and amortize the cost of building such representations
> across subsequent runs. Because the environment is persistent, these one-time
> understanding costs pay off across many tasks. We'll be sharing more about our
> work here soon."

Four things to extract from this:

1. **"Indexes, summaries, memory" — not "graph, ontology, schema."** The vocabulary
   is retrieval-engineering vocabulary. Summaries are lossy natural-language
   compression; memory is (per the Engram partnership) plausibly weights or
   learned representations; indexes is their existing competency.
2. **"Amortize ... across subsequent runs" is the real thesis** and it is
   correct — and it is in tension with their session-scoped, zero-retention
   agent runtime (§2.7).
3. **"Because the environment is persistent"** — they are explicitly claiming
   the firm corpus is a *stable* substrate worth precomputing over. That is the
   same premise a semantic layer rests on.
4. **"We'll be sharing more about our work here soon"** — as of 2026-08-08 this
   is unpublished. There is a window.

### 5.5 The Engram signal — what "memory" probably means

The C&H environment was built "in collaboration with @engramlab," and the
acknowledgments name **Dan Biderman, Jessy Lin, Mayee Chen, Neel Guha (Columbia
Law / Engram), Shizhe He** from Engram alongside **Calvin Qi and Gabe Pereyra**
from Harvey.

Engram's thesis, from the Sequoia *Training Data* episode with Biderman and Lin
(episode #90; **publication date [UNVERIFIED]** — the page did not surface one):
rather than treating memory as external databases, **bake organizational
knowledge directly into model weights** via adapter fine-tuning (LoRAs, prefix
tuning, sparse architectures) plus SFT and RL, producing "per-team models."
Their critique of RAG: purely retrieval-based systems fail because **models
often don't know *what* to search for**, and continually retrieving identical
documents wastes compute; internalized knowledge enables associative reasoning
that retrieval cannot. Quoted: "We don't see the world through pre-training or
post-training. Our models are always training." The episode page contains **no
discussion of knowledge graphs or structured representations** — "the focus
remains architectural (adapters, training procedures) rather than
representational schema."

Founding team per search results: CTO Sabri Eyuboglu, Jessy Lin (Berkeley PhD,
"Active Reading"), Jack Morris (Cornell), Scott Linderman (Stanford), Chris Ré
(Stanford, co-founder). Funding reported as **$98M at ~$600M valuation**
(2026-06-23) — **[UNVERIFIED]**: CNBC and citybiz both returned HTTP 403 on
fetch; these figures come from search-result snippets only and must not be
quoted downstream as confirmed. Likewise Harvey's **$11B valuation / $200M
round** (CNBC, 2026-03-25) is **[UNVERIFIED]** — headline only, fetch blocked.

**Read:** the Harvey ⨯ Engram axis points at **knowledge-in-weights + amortized
indexes/summaries**, reinforced by Harvey's own custom-model program
(§3.3). Both partners' "memory" story is *learned/compressed*, not *modeled*.
Notably, Engram's own critique of RAG — "models often don't know *what* to
search for" — is the same diagnosis as C&H's enumeration failure, and both
Harvey and Engram answer it with more learning rather than more structure.

---

## 6. Marketing claim vs engineering evidence — scorecard

| Claim | Where | Verdict |
|---|---|---|
| "Firm Knowledge ... understanding terms, matter relationships, and permissions so that you can easily see what's truly relevant" | Firm Knowledge page, 2026-01-22 | **[MKT]** — no mechanism disclosed. "Matter relationships" is the only public hint of relational modeling in the product surface, and it is a marketing sentence |
| "96% key-term extraction accuracy"; up to 100,000 documents per vault | Vault product page | **[MKT]** — no methodology, no eval set, no denominator |
| "500+ legal sources globally"; cross-jurisdictional research | Knowledge product page | **[MKT]**, but corroborated by the Data Factory post's 400+ sources / 60+ jurisdictions **[ENG]** |
| "democratize institutional knowledge that typically stays hidden in silos" | Knowledge product page | **[MKT]** — pure positioning |
| "up to 30% more relevant content than alternative retrieval methods" | BigLaw Bench Retrieval | **[ENG]** — metric (recall @ fixed token budget), baselines, and ground-truth process all named. Self-run, so self-favorable, but methodologically legible |
| 25% less irrelevant material, 1/3 dimensionality, NDCG@10 / Recall@100 | Voyage AI blog | **[ENG]** — third-party publication, named metrics, named baselines |
| 24.8M docs/wk, 56 TB/wk, UDF −17–19% p90 | Scaling Document Processing | **[ENG]** — strongest quantitative disclosure Harvey has published |
| `<2s P50` @ 15M rows with metadata filtering; LanceDB Enterprise; IVF-PQ; PGVector | Enterprise-Grade RAG | **[ENG]** — named products, named index type |
| Tool-selection precision "near zero → 0.8-0.9"; 3-10 retrieval ops | Agentic Search | **[ENG]** — but no absolute task-quality number, and "near zero" is a suspiciously flattering baseline |
| Frontier models <10% all-pass on LAB | LAB initial results | **[ENG]** — reproducible harness is open source |
| C&H baselines: ~half of criteria, 5+ min/task, 0% all-pass on high-fact-count tasks | C&H post | **[ENG]**, but see the harness caveat in §5.3 — retrieval-layer-free by construction |
| "richer representations of the corpus up front — indexes, summaries, memory" | C&H post | **[ENG-as-intent]** — a stated research direction, zero implementation published |
| 2,400+ customers, 70+ countries | harvey.ai company page (fetched) | **[MKT]** — self-reported, uncorroborated here |
| Harvey $11B valuation / $200M round; Engram $98M @ ~$600M | CNBC headlines | **[UNVERIFIED]** — both fetches returned 403; snippet-level only |

---

## 7. Strategic read — where the seam is

Bounded to what this lens can support; the head-to-head comparison belongs to
the packet's synthesis.

**Where Harvey is genuinely strong and not worth contesting:**

- **Scale engineering.** 24.8M docs/week with regional data residency, fallback
  extraction chains, and vector-store backpressure accounting is real, hard,
  expensive infrastructure.
- **Rubric-authoring capital.** 75,000+ expert-written atomic criteria is a
  labor asset, not a code asset. Consume it (per `DECISIONS.md`), never
  reproduce it.
- **Distribution and source licensing.** 400+ vetted sources with legal review
  throughput as a tracked metric, plus LexisNexis and iManage integrations.
- **Eval discipline.** All-pass grading and privacy-preserving evaluation are
  methodologically better than most of the field.

**Where the published architecture leaves a seam:**

1. **Representation is unmodeled.** Everything structural in Harvey's public
   stack is *around* the chunk (metadata, features, filters) or *derived at read
   time* (tabular extraction, summaries). There is no published typed model of
   matter, party, obligation, deadline, or outcome that survives across queries.
   Their own BigLaw Bench post says metadata and features are the top-2 quality
   drivers — which is an argument for modeling, and they stopped at hand-built
   signals.
2. **Their own failure analysis is a structure argument they answer with
   learning.** "Agents do not build an effective intermediate model of what the
   corpus contains" is, read literally, a call for a schema. The answer they
   reach for is summaries + memory + fine-tuning. Summaries are lossy and
   unauditable; weights are lossy and unauditable. A typed claim/evidence
   substrate is neither.
3. **Enumeration is where all-pass dies, and enumeration is a set-completeness
   problem.** "As the number of atomic points required increases, both models
   regress to 0% all-pass." Set completeness over a corpus is the one thing an
   index-with-a-schema answers *by construction* — `SELECT ... WHERE` returns
   the whole set, and knows it did. Similarity search and summarization can
   never know they are done. This is the sharpest publicly-documented seam.
4. **Zero-retention vs amortization is an unresolved constraint they own.**
   Session-scoped, no-durable-derived-data (2026-06-01) versus persistent
   amortized representations (2026-08-07). Whoever solves derived-artifact
   governance — provenance, staleness, permission inheritance on derived facts —
   solves something Harvey has publicly boxed itself into needing.
5. **Provenance granularity.** Harvey's citation story is document/URL-level.
   C&H itself pins features "to specific documents" — document-level, not
   span-level. Character-span-grounded evidence is a strictly finer contract.
6. **Redlines / tracked changes are absent from every public artifact.** No
   Harvey post, product page, or C&H task description in this sweep mentions
   `w:ins`/`w:del`, tracked changes, or redline diffing as a first-class object
   — consistent with the packet's existing G2 finding. Their ingest pipeline
   description is text + OCR + chunk; a redline is a *structural* fact that
   chunking destroys.

**The honest counter-argument (do not skip this):** Harvey's approach is
correct-by-default for *their* problem. A semantic layer requires committing to a
domain model, and Harvey serves 24 practice areas across 60+ jurisdictions —
their ontology-maintenance cost would be brutal and their per-firm variation is
enormous. Embeddings generalize; schemas do not. The seam above is only
exploitable **in a narrow, deep domain where the model is stable and the
completeness contract is legally load-bearing** — which is precisely the OIP
patent-prosecution shape (a fixed statutory ontology: application, office
action, rejection ground, claim, prior-art reference, IDS). "Harvey doesn't have
a knowledge graph" is not itself an edge. "Harvey structurally cannot afford one
at their breadth, and the domain in question is narrow enough that one pays for
itself" is.

---

## 8. Open gaps and things this sweep could not establish

1. **No harvey.ai blog post for the C&H announcement** as of 2026-08-08 — only
   the X post. If one lands, re-scrape; it may contain the technical detail the
   X post omits. **[UNVERIFIED existence]**
2. **Job postings could not be mined.** harvey.ai/careers is a client-side SPA
   ("Loading jobs..."); individual `/company/careers/<uuid>` URLs render the
   company page, not the JD. Built In NYC listed 20 Harvey roles with **zero**
   mentioning retrieval, RAG, knowledge graph, ontology, indexing, embeddings,
   or memory; Welcome to the Jungle's "Staff Software Engineer, Embedded
   Experience" JD likewise had none. A search snippet indicated senior SWE JDs
   mention "improving retrieval and evaluation loops" — **[UNVERIFIED]**, snippet
   only, not fetched. **Conclusion: no evidence of KG/ontology hiring, but the
   negative is weak** (aggregator snapshots, SPA-blocked primary source). Worth
   a retry with a rendering scraper (`firecrawl-scrape`) if this becomes
   load-bearing.
3. **Data Factory post publication date** not surfaced. **[UNVERIFIED]**
4. **Sequoia/Engram episode date** not surfaced. **[UNVERIFIED]**
5. **CNBC funding figures** (Harvey $11B/$200M; Engram $98M/~$600M) — both
   fetches 403'd. Headline-level only. **[UNVERIFIED]**
6. **Calvin Qi's personal site** (calvinqi.com, 2025-07-03) is a link index, not
   substantive content — no additional architecture detail beyond the harvey.ai
   posts it points to.
7. **UDF's internal shape** is undisclosed. Whether it carries structure
   (headings, tables, tracked changes, spans) or is a flat text+metadata
   envelope is the single highest-value unknown in Harvey's stack for this
   packet's purposes.
8. **Whether "memory" in the C&H roadmap means Engram-style weights, an external
   store, or both** is unresolved and will be answered by the "we'll be sharing
   more about our work here soon" post.
9. **Harvey Workflows** was not fetched as a product page this session; the
   workflow-encoding story is covered only via the Artificial Lawyer pieces.

---

## Sources

Every URL below was fetched in this session unless marked. Prior-mining
citations are packet-local files, listed separately.

### Harvey primary — engineering

- https://www.harvey.ai/blog/scaling-document-processing-across-harvey — "Scaling Document Processing Across the Harvey Platform", 2026-07-27
- https://www.harvey.ai/blog/why-we-built-our-own-cloud-agent-infrastructure — Gabe Pereyra, 2026-06-01
- https://www.harvey.ai/blog/how-harvey-secures-embeddings-at-scale — 2026-04-30
- https://www.harvey.ai/blog/how-agentic-search-unlocks-legal-research-intelligence — Lysia Li, Varun Nair, Aaron Stern, Pablo Felgueres, Calvin Qi, Philip Cerles, 2025-12-10
- https://www.harvey.ai/blog/integrating-deep-research-into-harvey — 2025-07-03
- https://www.harvey.ai/blog/enterprise-grade-rag-systems — 2025-02-20
- https://www.harvey.ai/blog/using-agents-to-scale-harveys-knowledge-sources — "The Data Factory" (date [UNVERIFIED])
- https://www.harvey.ai/blog/biglaw-bench-retrieval — Niko Grupen, Julio Pereyra, 2024-11-13

### Harvey primary — benchmark

- https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark — 2026-05-06
- https://www.harvey.ai/blog/legal-agent-benchmark-initial-results — 2026-05-26
- https://github.com/harveyai/harvey-labs — LAB repo README (badges: 24+ practice areas, 1,671 tasks)
- https://x.com/ItsJulioPereyra/status/2085772997944803682 — Julio Pereyra, C&H firm-knowledge announcement, 2026-08-07 (scraped copy in packet `assets/`)

### Harvey primary — product & company

- https://www.harvey.ai/blog — blog index (post inventory and dates)
- https://www.harvey.ai/blog/firm-knowledge-in-harvey — "Search That Works With Firm Knowledge", 2026-01-22
- https://www.harvey.ai/products/knowledge
- https://www.harvey.ai/products/vault
- https://www.harvey.ai/blog/author/calvin-qi — Calvin Qi bio: "Engineering Manager for the Retrieval and Data team"
- https://www.harvey.ai/careers — SPA, jobs did not render
- https://www.harvey.ai/company/careers/2bd5b22c-d873-45da-a6d3-89944edb701c — "Software Engineer, Agents" URL; rendered company page, not JD

### Third-party

- https://www.artificiallawyer.com/2026/04/14/harveys-gabe-pereyra-on-legal-agents-world-models/ — Richard Tromans, 2026-04-14
- https://www.artificiallawyer.com/2026/06/18/harvey-trains-open-source-models-to-encode-law-firm-workflows/ — 2026-06-18
- https://www.lawnext.com/2026/05/some-thoughts-on-harveys-launch-of-lab-an-open-source-long-horizon-benchmark-for-legal-ai-agents.html — Bob Ambrogi, 2026-05-19
- https://blog.voyageai.com/2024/07/31/harvey-partners-with-voyage-to-build-custom-legal-embeddings/ — 2024-07-31
- https://www.zenml.io/llmops-database/enterprise-grade-rag-systems-for-legal-ai-platform — third-party summary citing harvey.ai/blog/enterprise-grade-rag-systems
- https://sequoiacap.com/podcast/memory-and-continual-learning-engrams-dan-biderman-and-jessy-lin/ — Training Data #90 (date [UNVERIFIED])
- https://www.calvinqi.com/posts/retrieval-augmented-generation-at-harvey — 2025-07-03; link index only
- https://www.builtinnyc.com/company/harvey/jobs — 20 Harvey roles, none retrieval/KG/ontology
- https://app.welcometothejungle.com/jobs/yoGyD8d9 — "Staff Software Engineer, Embedded Experience"

### Fetched but blocked (HTTP 403 — cited as [UNVERIFIED] headline-level only)

- https://www.cnbc.com/2026/06/23/ai-memory-startup-focused-on-cutting-token-costs-raises-98-million.html
- https://www.cnbc.com/2026/03/25/legal-ai-startup-harvey-raises-200-million-at-11-billion-valuation.html
- https://www.citybiz.co/article/864393/engram-emerges-from-stealth-with-98m-to-build-enterprise-ai-memory-layer/

### Prior packet mining reused (not re-derived)

- [`map-harness.md`](./map-harness.md) — §1 shape, §2 agent loop, §3 tool surface + silent truncations (`tools.py:576`, `:629`), §4 sandbox, §10 sweep
- [`mine-benchmark-integration.md`](./mine-benchmark-integration.md) — stock-image constraints, `--network=none` / `--cap-drop=ALL` / no-MCP, index-mount plan
- [`verify-facts.md`](./verify-facts.md) — §G corrections digest (applied to all quoted prior-mining numbers)
- [`SOURCES.md`](./SOURCES.md) — packet provenance
- [`../assets/x-post-itsjuliopereyra-2085772997944803682.md`](../assets/x-post-itsjuliopereyra-2085772997944803682.md) — direct scrape of the C&H announcement
