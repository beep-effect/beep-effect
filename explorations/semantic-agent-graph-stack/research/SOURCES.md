# Semantic agent graph stack — sources and provenance

- **Cluster / origin:** operator link dump of 6 Nov 2026, Connected Data
  London week, plus local clones in `~/YeeBois/research/11-6-26/`.
- **Provenance:** X threads fetched live. Essays and arXiv abstracts
  fetched the same day. Local pins are git HEADs of those clones.
  Beep inventory pin: `df3ccd1b77aba565a72abd63c910ef3edde23929`
  (`origin/main` at publication). No upstream code is copied here.

License rule used below: Apache-2.0 and MIT may be ported later with
attribution, only inside a goal that names the file. CC BY-NC-SA and
any unchecked license are reference-only. This packet ports nothing.

## 1. Mined source corpus

| Source | Title | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| ontosmith-readme | Flat extraction contract | Dongbumlee/ontosmith @ `e68ca609` | `README.md` "What the schema is" | ontology-as-contract | reference |
| ontosmith-whitepaper | Flagship precision and CUAD recall | same pin | `docs/whitepaper.md` abstract and §5.8 | measured graph quality | reference |
| jevgraph-readme | Type-constrained blocking and closed-set choice | chenmingtang830/jevgraph @ `87f23023` | `README.md` "Why" and FewRel section | proposer/judge | reference |
| agrag-readme | Knowledge, tasks, and decision traces | ontogr/agentic-graphrag @ `15114200` | `README.md` opening and "History and decision traces" | correction travel | reference |
| horoi-readme | Term page generated from Turtle | kvistgaard/horoi @ `ffc2c901` | `README.md` opening | ontology projection | reference |
| tiwari-pdf | Ontology-aware multi-prompt KG construction | local PDF; code URL named in the PDF | `~/YeeBois/research/11-6-26/Ontology-Aware Prompting for Knowledge Graph Construction from Text.pdf` | grounded extraction | reference |
| beep-disposition | active / rejected / superseded | beep-effect @ `df3ccd1b` | `packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/ClaimDispositionStatus.model.ts` | claim lifecycle | extend |
| beep-intervals | valid time and knowledge time | same pin | `packages/foundation/modeling/epistemics/src/ValidInterval/`, `KnowledgeInterval/` | bitemporal facts | reuse |
| beep-claim-gate | admission, not extraction | same pin | `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` | judge seat | reuse |
| beep-edge-authority | bitemporal edge store | same pin | `packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts` | knowledge store | reuse |
| beep-reasoner | bounded structural inference | same pin | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts` | ontology session | reuse |
| beep-fold | SKOS fold and semantic foundation | same pin | `packages/foundation/modeling/ontology/src/index.ts` | schema layer | reuse |
| beep-slice-rule | ontology and epistemics stay strangers | same pin | `standards/architecture/DECISIONS.md` TierGate rationale | composition boundary | reuse |

## 2. Upstream repositories and licenses

| Repo | Pin read | License | Discipline | What a later goal could take |
| --- | --- | --- | --- | --- |
| <https://github.com/Dongbumlee/ontosmith> | `e68ca609eab55522178e6b6130ee0f463c127cd3` | MIT | port-with-attribution, not now | seat split, hash-pinned packs, pre-registered gates, evidence spans |
| <https://github.com/chenmingtang830/jevgraph> | `87f23023b3695cb0f58e0dd33c765e22341ece59` | Apache-2.0 | port-with-attribution, not now | neighbor blocking before a closed-set decision; DocJev license stays unchecked |
| <https://github.com/ontogr/agentic-graphrag> | `15114200c425270fcc4a7111ef70d2661735f5f4` | Apache-2.0 | port-with-attribution, not now | decision flagged when a cited version changes; fetch-before-cite; link, don't merge |
| <https://github.com/kvistgaard/horoi> | `ffc2c90171c71cfb9cdfb3a1c791dde66dc91d15` | Apache-2.0 | port-with-attribution, not now | one generated card per term IRI |
| <https://github.com/dice-group/ontology-aware-kg-construction> | not cloned | not opened | reference-only | multi-prompt plus three filters, after the license is read |
| <https://github.com/zjunlp/RAP> | not cloned | not opened | reference-only | schema-aware retrieved prompts |
| <https://github.com/iDC-NEU/EvoRAG> | not cloned | paper is CC BY 4.0; repo license not opened | reference-only | feedback attributed to paths; do not auto-edit governed edges |

## 3. External research sources

X posts, all fetched 6 Nov 2026:

- <https://x.com/Connected_Data/status/2118300588446220717>
- <https://x.com/TheYotg/status/2118665737971642475>
- <https://x.com/Connected_Data/status/2118664986192945190>
- <https://x.com/Connected_Data/status/2115039091351859480>
- <https://x.com/Connected_Data/status/2117575809556692994>
- <https://x.com/Connected_Data/status/2117218208679694547>
- <https://x.com/Connected_Data/status/2116128273176375792>
- <https://x.com/TheYotg/status/2118303352953979338>

Essays read:

- <https://www.linkedin.com/pulse/jev-came-first-dongbum-db-lee-deapc/>
- <https://dongbumlee.github.io/ontosmith/>
- <https://www.dataengineeringweekly.com/p/an-ontology-for-ai-agents-is-a-system>
- <https://veronahe.substack.com/p/on-ai-generated-ontologies>
- <https://www.linkedin.com/pulse/how-many-ontologies-does-enterprise-need-from-single-corporate-belin-gjade/>
- <https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and>
- <https://sergeyvasiliev.substack.com/p/knowledge-graph-memory-graph-and-b78>
- <https://www.bcgplatinion.com/insights/lost-in-translation-why-ai-agents-cannot-scale-without-semantic-foundations>

Essays not read, and why:

- <https://medium.com/@bechbd/maximum-relevance-minimum-context-cutting-through-the-ai-graph-stack-713724772060>
  — Medium interstitial, then a reader-proxy block. The X post is the account used.
- <https://blog.gopenai.com/stop-mixing-rag-knowledge-graphs-semantic-layers-and-agents-945b4170ab47>
  — Cloudflare challenge. Title only.

Papers, abstracts at arXiv:

- <https://arxiv.org/abs/2609.31663>
- <https://arxiv.org/abs/2210.10709>
- <https://arxiv.org/abs/2609.25607>
- <https://arxiv.org/abs/2604.02618>
- <https://arxiv.org/abs/2403.08345> (CC BY 4.0)
- <https://arxiv.org/abs/2607.28662> (CC BY-NC-SA 4.0, reference-only)
- <https://arxiv.org/abs/2605.29168> (CC BY-NC-SA 4.0, reference-only)
- <https://arxiv.org/abs/2211.12195> (audio tagging; out of scope)
- <https://arxiv.org/abs/2607.28692> (CC BY 4.0)
- <https://arxiv.org/abs/2608.22974> (CC BY 4.0)
- <https://arxiv.org/abs/2611.05953>
- <https://arxiv.org/abs/2604.15676> (CC BY 4.0)

The alphaXiv URLs in `CAPTURE.md` are the operator's links to these ids.

## 4. In-repo capability references

| Brick | Path | Mark |
| --- | --- | --- |
| `@beep/ontology` fold and foundation | `packages/foundation/modeling/ontology/src/` | reuse |
| Ontology session reasoner | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts` | reuse |
| `@beep/epistemics` claim model | `packages/foundation/modeling/epistemics/src/` | reuse |
| Claim gate | `packages/epistemic/use-cases/src/ClaimGate/` | reuse |
| Edge authority | `packages/epistemic/server/src/EdgeAuthority/` | extend, for a dependency walk |
| Belief view goal | `goals/belief-view-engine/` | paused; compose, do not restart |
| Memory retention goal | `goals/epistemic-memory-retention-projections/` | reuse |
| Ontology agent surface | `goals/ontology-agent-surface/` | reuse |
| RAG projection exploration | `explorations/rag-retrieval-projection/` | reuse; GraphRAG is not a second seam |
| Citation grounding exploration | `explorations/citation-grounding-hallucination-guard/` | reuse |
| Auto Ontology comparison | `explorations/auto-ontology-comparison/` | parked; do not reopen here |
| Context assembler with a separate sufficiency result | — | NET-NEW, only if align picks it |
| Decision-dependency walker and action recheck | — | NET-NEW, only if align picks it |
| Document-to-graph pipeline, pack compiler, Neo4j store | — | NET-NEW and not recommended |

## 5. Cross-links

- This packet: [`RESEARCH.md`](../RESEARCH.md), [`CAPTURE.md`](../CAPTURE.md),
  [`01-source-cards.md`](01-source-cards.md).
- Sibling explorations named in the research note.
- No goal is linked yet. Graduation has not started.
- `DECISIONS.md` does not exist. Align has not closed a question.
