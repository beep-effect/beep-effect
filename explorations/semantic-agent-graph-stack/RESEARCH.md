# Research

## 2026-11-06 — External landscape and in-repo inventory

Snapshot against beep-effect `df3ccd1b77aba565a72abd63c910ef3edde23929`
on branch `@chore/deps-update-11-6-26`. That branch was moving while
this note was written. Source cards, licenses, and fetch gaps are in
[`research/01-source-cards.md`](research/01-source-cards.md) and
[`research/SOURCES.md`](research/SOURCES.md). No upstream code was
copied into this packet.

### What the corpus actually agrees on

The posts, essays, and systems are arguing about roles, not about a
new database. Read together, they draw one stack:

```text
human-owned ontology          schema: what may exist and how it relates
        |
knowledge graph               accepted instances, with valid time
        |                     and recorded time
memory                        observations, claims, decisions,
        |                     outcomes, and rejections
context view                  the slice for one actor, purpose,
        |                     and point in time
policy                        whether that actor may use it
        |
action recheck                the versions are still the ones
                              the approval covered
```

GraphRAG sits on the knowledge layer as a retrieval pattern. It is
not a layer of its own. David Bechberger's essay body was not
fetched (Medium blocked the anonymous client). The Year of the Graph
post that points at it states the same diagram, including the test
"what breaks if this piece is removed, and is it a view or a store?"
([status 2118665737971642475](https://x.com/TheYotg/status/2118665737971642475)).

Sergey Vasiliev gives the three graph words an authority, a write
path, and a lifecycle. The knowledge graph holds accepted assertions.
The memory graph holds experience around those assertions. The
context graph is assembled for one task and is usually thrown away.
A correction does not rewrite the past: the memory record can still
say an analyst accepted the old filing, while the knowledge graph
publishes the revised assertion. Selection of evidence and the
judgment that the evidence is sufficient are separate outputs. The
execution service rechecks before it releases
([Part I](https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and),
[Part II](https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and-b78)).

Ananth Packkildurai makes the same cut in different words. The
ontology is the schema. The knowledge graph is the instance layer.
A taxonomy, a metrics layer, and a context graph each do a narrower
job. A build loop turns new data into governed knowledge. A query
loop uses the ontology to interpret the request, the graph for
multi-hop facts, and vectors for fuzzy context. New relationships
start as candidate edges. The starting move is one decision, a small
seed ontology, and one context path
([Data Engineering Weekly, 14 Aug 2026](https://www.dataengineeringweekly.com/p/an-ontology-for-ai-agents-is-a-system)).

Haihui Liu and colleagues survey the same gap from the other end:
correct retrieval does not ensure correct action. A facility changes
operator, memory stores the new operator, and a saved notification
plan still names the old one. Retrieval succeeds and delivery
succeeds. The action fails. Their evaluation demand is to score what
was available, selected, stored, and delivered, and to report
construction, update, retry, and failure cost
([arXiv:2611.05953](https://arxiv.org/abs/2611.05953)).

### Ranked patterns beep can use

These are hypotheses for align. They are not a build list.

| Rank | Pattern | Where it already lives | What is missing |
| --- | --- | --- | --- |
| 1 | A correction must reach the next action | Bitemporal edges in `@beep/epistemics` and `EdgeAuthority`. Dispositions are `active`, `rejected`, `superseded`. | A walk from a superseded edge to the summaries, saved contexts, and decisions that used it, plus a recheck before a later action. NOT FOUND as a service. |
| 2 | Context is a view, and sufficiency is a second result | Paused [`belief-view-engine`](../../goals/belief-view-engine/README.md) selects a working assertion at `(validAt, knownAt)`. | A task context that also names actor, purpose, policy version, what was selected, and which requirements failed. The belief view does not do that job. |
| 3 | The proposer does not judge | `ClaimGate` admits a claim through a bounded SHACL validator. | No extraction pipeline, no separate judge seat, no pre-registered operating point. That absence is fine until a corpus consumer exists. |
| 4 | A person owns the ontology | Ontology sessions, SKOS fold, bounded structural inference. Full OWL 2 DL is an explicit non-goal in [`goals/ontology-agent-surface`](../../goals/ontology-agent-surface/SPEC.md). | A written rule for what a model may draft. Heimsbakk's rule fits: draft SKOS candidates and SHACL scaffolding against a blueprint a person can explain. Do not let a model author the classes. |
| 5 | Candidates stay out of search until accepted | Law-practice read models mention an unreviewed candidate edge. Epistemic dispositions can reject. | No shared candidate lifecycle (`proposed` / `review` / `accepted` / `remapped` / `retired`) across ontology and epistemics. The slices cannot import each other. |
| 6 | Cite only a span the agent fetched | `EvidenceSpan` in `@beep/epistemics`. Graduated [`citation-grounding-hallucination-guard`](../citation-grounding-hallucination-guard/README.md). | Confirm, at align, whether any live agent path can cite a span it did not read. Not established by this pass. |
| 7 | Link near-duplicates; do not merge them | [`identity-as-iri`](../identity-as-iri/README.md) treats identity as an IRI problem. | Agentic GraphRAG's cheapest-first resolver, with `undecided` distinct from `rejected`, is a reference shape. No beep resolver was found that matches it. |
| 8 | Hash-pinned extraction packs | Ontology packs would be data, reviewed by a person, enforced per type. | OntoSmith's pack is a flat extraction contract with boundary examples. It says it is not an OWL ontology and runs no inference. Beep's ontology slice is the opposite shape. A pack can sit beside the session as an extraction contract. It cannot replace the session. |
| 9 | One page per term, generated from the ontology file | Horoi reads Turtle and writes a card per term plus a diagram. Apache-2.0. | Whether `@beep/ontology-ui` already emits that page was NOT VERIFIED in this pass. If it does, Horoi is a comparison, not a port. |
| 10 | As many ontologies as distinct responsibilities | Ontology and epistemics already cannot see each other. The desktop entrypoint binds epistemic `TierGate` into the ontology MCP ([`standards/architecture/DECISIONS.md`](../../standards/architecture/DECISIONS.md) around the TierGate ruling). | Alexander Belin's bridge ontology is a fifth model whose only job is cross-links. Beep does not need that model. A cross-slice fact belongs on the neutral port that already exists, with provenance. |

### What the systems add, and what to leave there

**OntoSmith** (MIT, local pin `e68ca609`) and **JevGraph** (Apache-2.0,
local pin `87f23023`) split proposing from judging. JevGraph blocks
candidate pairs by ontology type and a neighbor bound before a
closed-set decision model sees them. OntoSmith then fits thresholds
stage by stage, keeps failed pre-registered gates in the record, and
writes only judged triples with an evidence span. The graph store is
Neo4j, one graph per ontology build. This packet does not vendor
Neo4j, Jev, or the packs.

The numbers are real and narrow. Treat them as protocol results:

- Flagship Re-DocRED build, all 500 dev documents, sentence-window
  Tier-1 set of 3,902 triples: raw precision 0.5723, corrected under
  blind machine adjudication to **0.9110 [0.8919–0.9275]**,
  ceiling-adjusted recall **0.2028**. The whitepaper says the shipped
  default configuration differs, and that 186 promoted triples in the
  shipped Tier-1 set were not recomputed
  (`ontosmith/docs/whitepaper.md` abstract).
- Legal-contract certification, 116 questions, production retrieval
  path: recall@20 graph 0.6516, hybrid 0.6314, graph+hybrid 0.7115.
  The gain is **+0.080** on 510 long contracts. The same comparison
  on short BioRED abstracts is zero (`whitepaper.md` §5.8).
- JevGraph's public benchmark is closed-set relation choice on pinned
  FewRel, not an end-to-end graph score. On that run Jev was faster
  and cheaper than the two comparators and less accurate
  (`jevgraph/README.md`).

**Agentic GraphRAG** (Apache-2.0, local pin `15114200`) is the memory
shape closest to rank 1. One graph holds document structure, task
events, and decisions. A decision stores conclusion, rationale, and
assumptions, and points at passages, task events, and earlier
decisions. A new document version flags the decision and the
decisions that depend on it. Search hides a decision that needs
review. A citation must be an evidence id the agent fetched, in
scope, at the cited version. Schema-illegal extractions become
candidates; approval returns a schema patch. Entity resolution links
records and leaves `undecided` undecided.

That is a reference architecture. The implementation is Python on
Neo4j or FalkorDB, with Docling, GLiNER, and BAML. Those
dependencies have their own licenses. Nothing here is a port.

**Horoi** (Apache-2.0, local pin `ffc2c901`) is small on purpose. It
publishes one HTML page of term cards and a diagram from an OWL file.
The alpha is the projection: the ontology file is the source, the
page is generated, each IRI resolves to its card.

### Papers, clustered

The local PDF is not one of the twelve alphaXiv ids. It is Tiwari et
al., September 2026, "Ontology-Aware Prompting for Knowledge Graph
Construction from Text." Three prompt strategies produce candidates.
Three filters keep them: cross-prompt agreement with textual anchors,
an explicit evidence span, and a surface-form fallback. On
Text2KGBench they report up to 2.3× over the named LLM baselines,
hallucination rates below 0.20 in most domains, and ontology
conformance above 0.90 on most DBpedia-WebNLG domains. Code is named
as `dice-group/ontology-aware-kg-construction`. That repository's
license was not opened. Reference only.

| Cluster | Papers | Use |
| --- | --- | --- |
| Human-bounded extraction contract | [2609.25607](https://arxiv.org/abs/2609.25607) ArticleMiner; [2210.10709](https://arxiv.org/abs/2210.10709) RAP (SIGIR 2023) | A task module lists canonical names, surface forms, derivation rules, an identity key, and RDF bindings. RAP retrieves schema-aware examples as the prompt. Both match schema-first extraction. Neither asks beep to grow an OWL reasoner. |
| Judge after extraction, not inside every prompt | [2605.29168](https://arxiv.org/abs/2605.29168) Loconte et al. | Open extraction, then embedding canonicalization, then a targeted correction of ontology violations. CC BY-NC-SA. The idea is reference-only. |
| Schema as a reusable artifact | [2604.02618](https://arxiv.org/abs/2604.02618) OntoKG | Intrinsic versus relational routing produces a schema later tasks consume without the builder. Large Wikidata instantiation. The routing idea is the part that travels. |
| Dynamic or generated ontologies | [2608.22974](https://arxiv.org/abs/2608.22974) OaK; [2403.08345](https://arxiv.org/abs/2403.08345) Kommineni et al.; [2609.31663](https://arxiv.org/abs/2609.31663) Belfadel et al. | These let a model build or refine the TBox. Kommineni still recommends a person in the loop. OaK refines a task ontology from judge feedback. This cluster conflicts with Heimsbakk. Align has to pick a side before any draft tool exists. |
| Feedback that edits the graph | [2604.15676](https://arxiv.org/abs/2604.15676) EvoRAG | Response feedback is pushed back onto retrieved triples. Reported accuracy gain 7.34% over the paper's KG-RAG baselines. Automatic mutation of governed edges fights the candidate lifecycle above. Reference only. |
| Downstream effect of a graph operation | [2611.05953](https://arxiv.org/abs/2611.05953) Liu et al. | The survey beep should keep. Local metric gains are not pipeline gains. GNN-RAG sparsifying helped node prediction and hurt answering because the support became disconnected. |
| Tool ontology | [2607.28692](https://arxiv.org/abs/2607.28692) SciToolAgent-Evo | An ontology of scientific tools, not of business facts. Adjacent to skill contracts. Out of this packet's core. |
| Ontology-shaped eval metric, wrong domain | [2211.12195](https://arxiv.org/abs/2211.12195) | Audio tagging (OmAP on AudioSet). Recorded so the dump stays complete. No beep use found. |
| Production dedup with a non-overridable guard | [2607.28662](https://arxiv.org/abs/2607.28662) Dangaich et al. | Six dedup stages with no model, then an embedding stage whose conflict guard no similarity score can override. CC BY-NC-SA. Reference only. The guard is the pattern. |

### Essays that set constraints

Veronika Heimsbakk, 22 Oct 2026: a generated ontology is a result
without the conversation. Her SKU example is an OWL-legal disaster
for a business that has many SKUs per product: `hasSKU` functional
plus `SKU` subclass of `Product` collapses sizes with `owl:sameAs`
and counts the shirt sixteen times. The same drawing, prompt, and
model (she names Opus 5.5) produced as many ontologies as workshop
participants. LLMs may draft SKOS candidates and SHACL shapes. The
blueprint stays human-authored. Three questions: what does this mean,
why is it there, who decided
([On AI-generated Ontologies](https://veronahe.substack.com/p/on-ai-generated-ontologies)).

Alexander Belin: one corporate ontology failed as soon as process,
application, and capability were different responsibilities. A
Business Function hub was tried and dropped, because a process step
can be supported by an application function directly. The bridge
ontology owns only the cross-links. The count of ontologies is an
outcome, not a target
([LinkedIn pulse](https://www.linkedin.com/pulse/how-many-ontologies-does-enterprise-need-from-single-corporate-belin-gjade/)).
A reply mentions SSSOM and LinkML. That is a comment, not the
article's design.

BCG Platinion, 20 Jul 2026: agents stall on semantic debt, retrieval
does not encode obligations, and two agents can retrieve different
chunks. They cite a peer-reviewed insurance benchmark in which a
knowledge graph raised GPT-4 accuracy from 16% to 54%, and a
regulatory screening of up to 300 questions compressed to ten
minutes. The page does not name the paper or the dataset. Those
numbers stay theirs. The architectural claim that does travel: the
semantic layer also has to be the place that knows which source type
a question needs, and an agent that cannot trigger a governed action
is an advisor
([Lost in Translation](https://www.bcgplatinion.com/insights/lost-in-translation-why-ai-agents-cannot-scale-without-semantic-foundations)).

Dongbum Lee's LinkedIn essay "Jev Came First" matches the X post and
the whitepaper. The extra sentence worth keeping: he publishes no
bake-off in which Jev out-judges a frontier model. The record is cost
and how much of the graph survives audit.

The GoPenAI post "Stop mixing RAG, knowledge graphs, semantic layers
and agents" was not fetched. Cloudflare returned a challenge page.
Its title is not a summary of the article.

### In-repo capability inventory

Checked by path at the pin above. "Implemented" means the file
exists and was opened far enough to name the contract. Tests were
not run.

| Brick | Path | State for this packet |
| --- | --- | --- |
| SKOS fold, semantic foundation, taxonomy, vocabulary | `packages/foundation/modeling/ontology/src/index.ts` | Implemented schema layer. This is beep's ontology product surface, separate from the RDF session. |
| Bounded session inference | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts` | Implemented structural inference. The file header calls it domain-native structural inference. It is not an OWL 2 DL reasoner. SPEC non-goal stands. |
| Claim, evidence span, valid interval, knowledge interval, logical edge identity | `packages/foundation/modeling/epistemics/src/index.ts` | Implemented. Valid time and knowledge time already have schemas. |
| Disposition | `packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/ClaimDispositionStatus.model.ts` | Implemented literals: `active`, `rejected`, `superseded`. No `proposed` or `review` literal. |
| Claim gate | `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts`, wired in `packages/epistemic/server/src/Layer.ts` | Implemented admission through bounded SHACL. This is a gate, not a proposer/judge extraction pipeline. |
| Bitemporal edge authority | `packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts` | Implemented store. Goal [`epistemic-bitemporal-edge-core`](../../goals/epistemic-bitemporal-edge-core/README.md) is `completed-retained`. |
| Belief view | [`goals/belief-view-engine`](../../goals/belief-view-engine/ops/manifest.json) | Paused. One phase complete, the rest pending. It is the nearest named projection to "what we believe at a time." |
| Memory retention projections | [`goals/epistemic-memory-retention-projections`](../../goals/epistemic-memory-retention-projections/ops/manifest.json) | `completed-retained`. Graduated from [`agent-memory-tiers-bitemporal-edges`](../agent-memory-tiers-bitemporal-edges/README.md). |
| Ontology agent surface | [`goals/ontology-agent-surface`](../../goals/ontology-agent-surface/ops/manifest.json) | `completed-retained`. MCP toolkit over the session. |
| Hybrid retrieval seam | [`explorations/rag-retrieval-projection`](../rag-retrieval-projection/README.md) | Graduated. Weighted RRF that cannot bypass `ClaimGate`. GraphRAG-as-a-layer would duplicate this seam. |
| Slice isolation | `standards/architecture/DECISIONS.md` TierGate ruling | `ontology` cannot learn that `epistemic` exists, and the reverse. Any context assembler that needs both is an entrypoint composition, not a cross-import. |
| Warehouse text-to-SQL / Auto Ontology | [`explorations/auto-ontology-comparison`](../auto-ontology-comparison/README.md) | Parked at research on 2026-11-06. This packet does not reopen that comparison. |
| Document-to-graph builder, Jev seat, Neo4j graph store, ontology pack compiler, Horoi publisher, decision-dependency walker, execution-time version recheck | — | NOT FOUND. |

Sibling packets to compose with, not to reopen as copies:
[`ontology-curation-governance`](../ontology-curation-governance/README.md),
[`ontology-lifecycle-qa`](../ontology-lifecycle-qa/README.md),
[`epistemic-belief-view-revision`](../epistemic-belief-view-revision/README.md),
[`semantica-lab`](../semantica-lab/README.md),
[`legal-ontology-landscape`](../legal-ontology-landscape/README.md).

### Constraints

- This packet vendors nothing. Permissive upstreams
  (Apache-2.0, MIT) may be ported later with attribution, in a goal
  that names the file. CC BY-NC-SA papers (`2605.29168`,
  `2607.28662`) are reference-only. Unverified licenses are
  reference-only. See the ledger.
- OntoSmith's flat pack and beep's RDF session answer different
  questions. Importing the pack format into the ontology slice would
  pretend a closed extraction inventory is an ontology.
- Generated classes fail Heimsbakk's ownership test even when they
  validate. A SHACL shape that checks a generated claim is not a
  business constraint.
- Publishing a graph-quality number without its protocol is the
  failure OntoSmith's whitepaper is written to prevent. Any later
  beep eval should keep failed pre-registered gates in the record
  and should score the next step, not only the local metric.
- BCG's 16% to 54% figure is an unnamed citation. It is not evidence
  beep can quote as its own.
- A governed action plane, an enterprise bridge ontology, and a
  Neo4j deployment are out of scope for this exploration. Beep is
  not missing them by accident.
- Firecrawl's MCP token was unauthorized. Medium and the GoPenAI
  post were not read. Claims about those two articles are limited
  to the X post that quotes Bechberger, and to the GoPenAI title.

### Align frontier

1. Which existing beep decision is the first consumer? The research
   leans to a corrected claim that must still be safe to act on,
   because the bitemporal store and the disposition literals already
   exist, and the dependency walk does not.
2. Does this packet ever include a document-to-graph pipeline? The
   research leans no, until a corpus consumer sponsors it. The role
   split can be shaped without Jev, Neo4j, or a pack compiler.
3. What may a model emit before a person accepts it? The research
   leans to Heimsbakk: SKOS candidates and SHACL scaffolding against
   a human blueprint. Class authorship stays with a person who can
   answer what it means, why it is there, and who decided.
