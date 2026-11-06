# Source cards

Dated 2026-11-06. Each card is a reading note for
[`RESEARCH.md`](../RESEARCH.md). Quotes are short and only where the
wording is the claim. Pages that did not load are marked unread.

## X posts

Fetched with the X thread API. Engagement is the live count at fetch
time, not a quality score.

### 2118300588446220717 — OntoSmith / Jev

Connected Data, 5 Nov 2026. Dongbum Lee. Likes 627, bookmarks 932.

Extraction is cheap. Verification is the cost. OntoSmith splits a
cheap proposer (Haiku 5.5 in the reference setup), a fitted pair call
plus Jev as judge, and a frontier model for hard calls. Ontology
packs are versioned and hash-pinned over a domain-neutral core.
Neo4j holds one graph per ontology build. Stated measurements:
3.8 cents per document across 500 documents in the flagship build;
about 7 cents per document projected for judging in the default
configuration; corrected graph precision 0.911 [0.892, 0.928] after
a re-audit by a different model family; +0.080 recall@20 (0.631 to
0.712) on a pinned 116-question set over long contracts, and zero on
short abstracts.

Reply from @richardt830 links `chenmingtang830/jevgraph`. Reply from
@awinml links `ontogr/agentic-graphrag`. Both repos are in the local
corpus.

<https://x.com/Connected_Data/status/2118300588446220717>

### 2118665737971642475 — Maximum relevance, minimum context

The Year of the Graph, 6 Nov 2026, summarizing David Bechberger.
The Medium article itself was not fetched.

Vectors answer about the wrong Ana. An ontology and a knowledge graph
find customer and order, and still show every past state. A context
graph scopes the view. Policies decide whether the agent may act.
Memory records the decision. Ontology and knowledge graph are stores.
Context graph and policies are views. Memory is the only new data.
GraphRAG is a retrieval pattern over the knowledge layer. The post
also names bitemporal facts and a test that counts hops, rules, and
time questions before adding a graph.

<https://x.com/TheYotg/status/2118665737971642475>

### 2118664986192945190 — Ontology for agents is a system

Connected Data, 6 Nov 2026. Ananth Packkildurai. The post is a
compressed form of the Data Engineering Weekly essay below. A catalog
can name a table owner and still cannot say whether two records are
the same customer.

<https://x.com/Connected_Data/status/2118664986192945190>

### 2115039091351859480 — Ontologies nobody knows

Connected Data, 27 Oct 2026. Veronika Heimsbakk. Compressed form of
the Substack essay below.

<https://x.com/Connected_Data/status/2115039091351859480>

### 2117575809556692994 — How many ontologies

Connected Data, 3 Nov 2026. Alexander Belin. Compressed form of the
LinkedIn essay below. Reply from @labs_sen: they bridge with SSSOM
and model each ontology in LinkML. That reply is not Belin's design.

<https://x.com/Connected_Data/status/2117575809556692994>

### 2117218208679694547 — Knowledge, memory, context

Connected Data, 2 Nov 2026. Sergey Vasiliev, both essays. The
correction scenario is the load-bearing example: a revised filing
shows an accepted ownership claim was wrong, while a report is still
being written from the old memory summary. Reply from @vishakha041
asks who may accept the new assertion, and whether the memory summary
is invalidated in the same transaction. Reply from @buswe_com on the
survey post: stamp a saved plan with the entity version and
re-resolve before sending.

<https://x.com/Connected_Data/status/2117218208679694547>

### 2116128273176375792 — Lost in translation

Connected Data, 30 Oct 2026. BCG Platinion. Compressed form of the
essay below, including the 16% to 54% citation and the ten-minute
regulatory screening.

<https://x.com/Connected_Data/status/2116128273176375792>

### 2118303352953979338 — Graph-mediated LLM survey

The Year of the Graph, 5 Nov 2026. Points at Liu et al.,
arXiv:2611.05953. Operator change from O1 to O2: memory is current,
the saved plan still names O1, retrieval and delivery succeed, the
action fails. Survey axes: role (reasoning, knowledge, retrieval and
memory, execution, coordination) and locus (inside the LLM, at a
graph-conditioned interface, in external traversal, in agent
orchestration). Cited local-versus-downstream splits: GNN-RAG
sparsifying helped node prediction and hurt answering; dialogue
memory graph-versus-flat order reversed with the return shape; GCR
path-constraint removal hurt path conformance and barely moved answer
accuracy; sparse communication routes reduced both harmful and useful
information.

<https://x.com/TheYotg/status/2118303352953979338>

## Local systems

Pins are the clones under `~/YeeBois/research/11-6-26/` on 6 Nov 2026.
They are not vendored.

### OntoSmith — MIT — `e68ca609eab55522178e6b6130ee0f463c127cd3`

<https://github.com/Dongbumlee/ontosmith>

Flat extraction contract: entity and relation types, definitions,
boundary examples. The README states there is no class hierarchy, no
inheritance, and no logical axioms, and that the pipeline runs no
inference. Stages run from ingest to verify. Seats are configuration.
Identity disagreements across documents are held out as ambiguous.
Packs: core baseline, open-domain, legal-contract, bio-medical,
fibo-contracts. A missing pack can be drafted and must be approved
by a named person before emit. Search has lexical, graph, and vector
arms. Whitepaper numbers are scoped in `RESEARCH.md`. Site:
<https://dongbumlee.github.io/ontosmith/>.

### JevGraph — Apache-2.0 — `87f23023b3695cb0f58e0dd33c765e22341ece59`

<https://github.com/chenmingtang830/jevgraph>

Schema-guided document-to-candidate-graph. Local parse, gazetteer
mentions, type-constrained neighbor blocking, then a closed-set
relation choice. Edges land in proposed, review, or rejected, with
probabilities and request receipts. The keyword provider is a
deterministic demo. The FewRel track isolates relation choice; the
README says it does not measure entity extraction, candidate recall,
negative-edge rejection, or end-to-end graph quality. Optional
document ingestion depends on DocJev; that dependency's license is
in the repo acknowledgements and was not re-audited here.

### Agentic GraphRAG — Apache-2.0 — `15114200c425270fcc4a7111ef70d2661735f5f4`

<https://github.com/ontogr/agentic-graphrag>

Three layers in one graph: enterprise knowledge (document, section,
chunk, entity, relation), conversation history (task, event, step),
and decision traces linked to passages, events, and earlier
decisions. A changed document flags dependent decisions. The built-in
search omits decisions that need review. Citation check requires a
fetched, in-scope, version-matched evidence id. Out-of-schema
extractions are candidates; approval returns a schema patch.
Resolution links rather than merges, and an undecided pair is not a
rejection. OWL/RDFS Turtle is one accepted ontology input, exported
 onward to JSON-LD and SHACL. Store is Neo4j or FalkorDB. Dependency
licenses (Docling, GLiNER, BAML, databases) were not audited.

### Horoi — Apache-2.0 — `ffc2c90171c71cfb9cdfb3a1c791dde66dc91d15`

<https://github.com/kvistgaard/horoi>

`horoi build` writes one self-contained HTML page, a diagram, and
Turtle, RDF/XML, JSON-LD, and N-Triples. Each term's IRI leads to its
card. It reads `owl:Ontology` metadata and, per term, label, comment,
domain, range, subclass, and subproperty. A release tag must match
`owl:versionInfo`.

## Essays

### Jev Came First — Dongbum Lee

<https://www.linkedin.com/pulse/jev-came-first-dongbum-db-lee-deapc/>

Public pulse text loaded. Same architecture and numbers as the X post
and the whitepaper. Additional claim: the article does not publish a
bake-off in which Jev beats a frontier judge. The pair-call judge in
the reference configuration is the proposer's model in a second
fitted configuration. The seat is separate. The vendor logo is not
the separation.

### What an Ontology for AI Agents Actually Needs — Ananth Packkildurai, 14 Aug 2026

<https://www.dataengineeringweekly.com/p/an-ontology-for-ai-agents-is-a-system>

Meaning is the ontology. Facts are the graph. Context is a slice.
Discover first in an unfamiliar domain, then extract under the seed
ontology. Two loops: build and query. Candidate edges have a
lifecycle: proposed, evaluated, accepted, remapped, or retired.
Entity resolution keeps provenance and uncertainty. Security resolves
with meaning. Start with one decision.

### On AI-generated Ontologies — Veronika Heimsbakk, 22 Oct 2026

<https://veronahe.substack.com/p/on-ai-generated-ontologies>

Human authorship of the blueprint. Models draft SKOS and SHACL.
Functional `hasSKU` plus SKU-as-subclass collapses variants. Same
inputs, many ontologies. Review of a generated model catches what is
present and wrong, and misses what was never discussed.

### How many ontologies — Alexander Belin

<https://www.linkedin.com/pulse/how-many-ontologies-does-enterprise-need-from-single-corporate-belin-gjade/>

Domain, process, application, and capability ontologies, plus a
bridge ontology for cross-links. Business Function was rejected as
the universal hub. "As many as distinct semantic responsibilities
justify, and no more than are needed to represent them coherently."

### Knowledge graph, memory graph, context graph — Sergey Vasiliev

Part I, 17 Aug 2026:
<https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and>

Part II, 28 Oct 2026:
<https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and-b78>

Three roles. Valid time versus recorded time. An extracted claim is
not governed knowledge. Negative semantic knowledge (explicit
rejections) has to be enforced at retrieval. Context snapshots record
versions, policy, and purpose. Storage is chosen after the
responsibility boundaries. One LPG is allowed when the checks that
must commit together fit in one store.

### Lost in Translation — BCG Platinion, 20 Jul 2026

<https://www.bcgplatinion.com/insights/lost-in-translation-why-ai-agents-cannot-scale-without-semantic-foundations>

Semantic debt, two-tier ontology (shared core plus use-case tier),
maturity one step at a time, governance as a business decision. The
16% to 54% and ten-minute figures are cited without a named paper on
the page that was fetched. Do not adopt them as beep evidence.

### Maximum Relevance, Minimum Context — David Bechberger

<https://medium.com/@bechbd/maximum-relevance-minimum-context-cutting-through-the-ai-graph-stack-713724772060>

Unread. Medium returned an interstitial, and the reader proxy blocked
the domain. Use the X post above as the extracted account, and reopen
the essay if a later session can fetch it.

### Stop mixing RAG, knowledge graphs, semantic layers and agents

<https://blog.gopenai.com/stop-mixing-rag-knowledge-graphs-semantic-layers-and-agents-945b4170ab47>

Unread. The fetch returned a Cloudflare challenge. Title only.

## Papers

Abstracts opened at `https://arxiv.org/abs/<id>` on 6 Nov 2026.
The alphaXiv URLs in the capture redirect to the same ids. Full PDFs
were not read except the local Tiwari file.

| id | Title | What transfers |
| --- | --- | --- |
| local PDF | Tiwari et al., Ontology-Aware Prompting for Knowledge Graph Construction from Text, Sep 2026 | Multi-prompt candidates plus three grounding filters. Stated Text2KGBench gains in the abstract. Code URL in the PDF; license unchecked. |
| 2609.31663 | Belfadel et al., LLM-Guided Ontology-Driven KG Construction, IJCKG 2026 | Schema-guided prompts on a private French incident corpus, local 7B–32B models, then OWL enrichment. The OWL-generation step is the part Heimsbakk disputes. |
| 2210.10709 | Yao et al., Schema-aware Reference as Prompt, SIGIR 2023 | Retrieve annotated schema-aware examples as the prompt. Code: `zjunlp/RAP`. Old and still the right shape for few-shot extraction. |
| 2609.25607 | Jahin, Knoblock, Pujara, ArticleMiner, Sci-K at ISWC 2026 | Human-authored task module: canonical names, surface forms, derivation rules, validity constraints, identity key, RDF bindings. Four scientific tasks, 163 papers. |
| 2604.02618 | Li et al., OntoKG | Intrinsic versus relational routing into a reusable schema. Wikidata-scale instantiation (34.0M nodes, 61.2M edges, 38 relationship types in the abstract). |
| 2403.08345 | Kommineni, König-Ries, Samuel, CC BY 4.0 | Competency questions, then TBox, then KG. A judge LLM rates answers. Authors still recommend a person in the loop. |
| 2607.28662 | Dangaich, Lewis, Pundalik, CC BY-NC-SA | Ontology slice retrieved into the prompt; six non-model dedup stages; a conflict guard no similarity score can override. Reference only. |
| 2605.29168 | Loconte, Hospedales, Cornelio, CC BY-NC-SA | Correct ontology violations after extraction instead of inside every prompt. Reference only. |
| 2211.12195 | Liu et al., ontology-aware audio tagging, Interspeech 2023 | AudioSet metric. No beep use. Kept so the dump is complete. |
| 2607.28692 | Tang et al., SciToolAgent-Evo, CC BY 4.0 | Ontology of scientific tools, bandit gate, OpenSciToolBench (900 tasks). Adjacent to skill contracts, not to the knowledge stack. |
| 2608.22974 | Zhang et al., OaK, CC BY 4.0 | Task ontology refined from judge feedback. Conflicts with a human-owned blueprint. |
| 2611.05953 | Liu et al., graph-mediated LLM systems, 4 Nov 2026 | Role/locus survey. Downstream effect and process diagnostics. The paper to keep. |
| 2604.15676 | Fu et al., EvoRAG, ICDE 2027, CC BY 4.0 | Backpropagate answer feedback onto triples. Abstract claims +7.34% reasoning accuracy over the paper's KG-RAG baselines. Do not auto-edit governed beep edges from answer feedback. |
