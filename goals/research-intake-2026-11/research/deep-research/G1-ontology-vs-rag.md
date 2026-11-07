# G1. Ontology grounding versus RAG at a matched context budget

## Question

Cluster G1 of `goals/research-intake-2026-11/research/CONTRADICTIONS.md`: does
ontology or knowledge-graph grounding improve LLM agent answer quality over
retrieval-augmented generation when the context-token budget is matched, and
which validity criteria (entailment-based support versus non-contradiction
under open-world OWL semantics) do such studies use? Background: arXiv
2604.00555 injects about 2,800–3,200 tokens of ontology against about 2,000 for
RAG and states validity as non-entailment of the negation.

## Method

- Process: the deep-research skill. Three researchers ran in parallel, one per
  sub-question (matched-budget comparisons, structure versus volume, validity
  criteria), and one report writer synthesized their notes.
- Sources searched: arXiv full texts and abstracts (PDF and HTML), ACL
  Anthology, OpenReview, the W3C OWL 2 specifications, and general web search.
- alphaXiv tools were not available in the session, so arXiv was read
  directly (PDFs through `pdftotext`, HTML pages through fetch).
- Date: 2026-11-07. Model: `claude-opus-5-5`.
- Confidence: items marked "summary only" were read from abstracts or search
  summaries, not the full text.

## Findings

### 2604.00555 does not show ontology beating RAG

- Token numbers confirmed. C2 (RAG) is "8 curated paragraphs per industry,
  ∼2,000 tokens total"; C3 (ontology) is "∼2,800–3,200 tokens depending on
  industry", which the paper calls "a 40–60% overhead on structural
  scaffolding" ([2604.00555](https://arxiv.org/abs/2604.00555)).
- Grand means (Table 4, Claude Sonnet 4): C1 no context .58, C2 RAG .83,
  C3 ontology .77, C4 ontology plus judge .80. RAG leads in FinTech (.94 vs .77)
  and Healthcare (.92 vs .81). The other three industries are roughly tied.
- RAG versus ontology is not significant: "The C2–C3 post-hoc comparison was
  not significant on any metric (pcorr > 0.20)". Across three models,
  ontology beat RAG pairwise in one cell only (Role Consistency on Gemma 4,
  pcorr = .006). The authors concede that "C2 scores at or above C3 on TF, MA,
  and RC".
- The headline significance ("significantly outperform ungrounded agents")
  compares ontology with no context (C1), not with RAG.
- The RAG arm does no retrieval. Its chunks "were curated from the same
  ontology blueprints as C3". Ground truth comes from the same blueprints.
- Scoring: an LLM judge (Claude Sonnet 4, temperature 0, metric-specific
  rubrics), the same family as the primary agent, with no inter-rater
  reliability against experts.
- The validity criterion `valid(a,O) ⇔ O ⊭ ¬a` (§7, formula 11) belongs to a
  proposed OntologyValidator that "is not yet implemented in FAOS". The
  experiment never applies it.
- A budget-equalized test is listed as future work. The §4.1 default budget
  T_max = 2000 is exceeded by the reported C3, and the paper does not explain
  the difference.
- Injection can hurt: on PCI-DSS role compliance, C1 and C2 score 1.00 and C3
  scores .42.

### Matched-budget comparisons with graph methods

- 2502.11371 (Han et al.) is the only verified total-input-token match. RAG
  chunks were increased "to match the total number of input tokens retrieved
  by Community-GraphRAG" (9,770 vs 3,631 tokens per query on MultiHop-RAG).
  - Overall, the gap goes to zero: GraphRAG 69.01 vs token-matched RAG 69.33
    (Llama 3.1-8B), 71.17 vs 71.01 (70B).
  - GraphRAG keeps Temporal (50.6 vs 36.71 at 8B; 49.06 vs 43.74 at 70B) and,
    narrowly, Comparison (60.63 vs 59.81).
  - Token-matched RAG wins summarization (ODSum-Story ROUGE-2 10.16 vs 8.49).
  - No significance tests were reported, and only Community-GraphRAG (Local)
    was tested ([2502.11371](https://arxiv.org/pdf/2502.11371)).
- 2404.16130 (GraphRAG) matches only the per-call window: "a fixed context
  window size of 8k tokens", tuned on the RAG baseline. Global search
  map-reduces, so total tokens per query are 26,657 (C0) to 1,014,611 (TS) on
  Podcast, about 3–140× the RAG baseline. Comprehensiveness win rates are
  72–83% ([2404.16130](https://arxiv.org/pdf/2404.16130)).
- BenchmarkQED/LazyGraphRAG (vendor blog, LLM-judged) matched an 8k
  generation window. Vector RAG at 120k and 1M windows still lost on global
  queries. The graph only selects text chunks
  ([Microsoft Research](https://www.microsoft.com/en-us/research/?p=1140429)).
- 2506.05690 (GraphRAG-Bench, Xiang et al.): average prompt tokens are 879 for
  V-RAG, 38,707 for MS-GraphRAG local and 331,375 for global. "Basic RAG Matches
  GraphRAG in simple fact retrieval task". Graph advantages appear only on
  complex questions. Budget is uncontrolled. The paper's prose and tables
  disagree on global token counts ([2506.05690](https://arxiv.org/pdf/2506.05690)).
- 2506.02404 (GraphRAG-Bench, Xiao et al.): "We imposed no max token length".
  There is no vanilla-RAG arm in the experiments
  ([2506.02404](https://arxiv.org/pdf/2506.02404)).
- 2412.15235 (OG-RAG): unit-count control only (2 or 5 contexts, best picked
  per method), with no token counts. Soybean answer correctness is RAG 0.31 vs
  OG-RAG 0.48 at uncontrolled budget ([2412.15235](https://arxiv.org/pdf/2412.15235)).
- 2509.16780: GraphRAG used about 47K tokens against about 3.7K for RAG and lost
  on page-level retrieval QA ([2509.16780](https://arxiv.org/pdf/2509.16780)).
- No study was found that equalizes tokens between ontology axioms or KG
  triples in the prompt and chunk RAG.

### Structure versus volume

- Same facts in different formats (no study matched tokens):
  - 2402.11541 (Dai et al.): unordered linearized triples beat human prose,
    for example GPT-4 DocRED 1-hop EM 59.16→75.48. The prose is a full
    document, so the triple advantage may partly be density
    ([2402.11541](https://arxiv.org/html/2402.11541v4)).
  - 2309.11206 (Wu et al.): verbalized KG text beat raw triples (MetaQA with
    ChatGPT 97.71 vs 93.19). The no-knowledge baseline is 60.58. Including the
    knowledge moves accuracy about 30–75 points; format moves it about 1–8
    ([2309.11206](https://arxiv.org/html/2309.11206)).
- Format sensitivity:
  - Formatting-only changes cause up to 76 accuracy points of difference
    ([2310.11324](https://arxiv.org/abs/2310.11324)).
  - Same content in plain text, Markdown, JSON or YAML differs by up to 40% on
    GPT-3.5 ([2411.10541](https://arxiv.org/abs/2411.10541)).
  - Single-template comparisons are therefore unreliable.
- Length hurts:
  - Padding the same task from 250 to 3,000 tokens drops average accuracy
    "from 0.92 to 0.68" ([2402.14848](https://arxiv.org/html/2402.14848)).
  - Accuracy "degrades substantially (13.9%--85%) as input length increases"
    even with perfect retrieval and whitespace filler
    ([2510.05381](https://arxiv.org/abs/2510.05381v1)).
  - More retrieved passages help at first and then hurt, mainly through hard
    negatives ([2410.05983](https://arxiv.org/abs/2410.05983)).
  - Mid-context evidence is used worst
    ([2307.03172](https://arxiv.org/abs/2307.03172)).
  - Counterpoint: random unrelated documents raised accuracy by up to 35%
    ([2401.14887](https://www.arxiv.org/abs/2401.14887)), so a filler arm must
    state its filler type.
- No shuffled-ontology, relation-permuted or ontology-as-prose control at
  equal tokens was found.

### Validity logic

- OWL 2 Direct Semantics §2.5 defines the two tests differently:
  - Consistency means "a model of O w.r.t. D and V exists".
  - Entailment means "every model of O ... is also a model of O1"
    ([OWL 2 Direct Semantics](https://www.w3.org/TR/owl2-direct-semantics/)).
- The Primer: a missing fact "may simply be missing (but possibly true),
  following the open-world assumption"
  ([OWL 2 Primer](https://www.w3.org/TR/owl2-primer/)).
- `O ⊭ ¬a` is consistency of O ∪ {a}. It passes every claim the ontology
  neither entails nor refutes, which includes fabricated but type-compatible
  facts in a sparse ABox.
- A claim using a new term is trivially consistent.
- If O is inconsistent, the criterion rejects everything (and entailment
  accepts everything), so O's consistency must be checked first.
- Entailment reduces to unsatisfiability of O ∪ {¬a} only in DLs with full
  negation ([TU Dresden KRR lecture 6](https://ddll.inf.tu-dresden.de/w/images/3/3e/KRR-lecture6.pdf);
  [1401.3487](https://arxiv.org/pdf/1401.3487)).
- No source measures how much of a real ontology's claim space is unknown;
  that part is a structural argument.

Papers that use consistency, not support:

- 2604.00555: proposes consistency (`O ⊭ ¬a`) and never implements it.
- 2406.07962: syntax check, then reasoner consistency, then SHACL. Summary
  only ([2406.07962](https://arxiv.org/pdf/2406.07962)).
- 2412.02035 (LLMs4Life/NeOn-GPT): HermiT/Pellet consistency. Summary only
  ([2412.02035](https://arxiv.org/pdf/2412.02035)).
- 2504.19023 (GLaMoR): learns to predict consistency. Summary only
  ([2504.19023](https://arxiv.org/pdf/2504.19023)).
- SHACL checks shape, not truth. A non-peer-reviewed blog reports that
  open-world SHACL conformed on graphs with fabricated terms
  ([Tesseract Academy](https://gov.tesseract.academy/research/ontology-correctness-benchmark)).
  Low confidence.

Methods that require positive support:

- GraphEval (2407.10793): per-triple NLI against the context; an output is
  flagged if any triple exceeds 0.5
  ([2407.10793](https://arxiv.org/html/2407.10793)).
- AIS (2112.12870): attributable only if "all parts can be directly inferred
  from the source". Neither-entailed-nor-contradicted is Not AIS
  ([2112.12870](https://arxiv.org/pdf/2112.12870)).
- FActScore (2305.14251): Not-supported means "either contradicts or does not
  contain any evidence" ([2305.14251](https://arxiv.org/pdf/2305.14251)).
- RAGAS faithfulness (2309.15217): claims must "be inferred from the context";
  unknown counts as No ([2309.15217](https://arxiv.org/html/2309.15217v2)).
- ALCE citation recall (2305.14627): requires TRUE-NLI entailment; it cannot
  detect partial support ([2305.14627](https://arxiv.org/html/2305.14627)).
- SummaC (2111.09525): entailment scores by default, despite the name
  "consistency" ([2111.09525](https://arxiv.org/html/2111.09525)).
- AlignScore (2305.16739): P(aligned); neutral counts against
  ([2305.16739](https://arxiv.org/html/2305.16739)).
- FEVER (1803.05355): keeps a separate NotEnoughInfo label. Read from the
  abstract only, not re-fetched in session
  ([1803.05355](https://arxiv.org/abs/1803.05355)).

No peer-reviewed paper was found that grades free-text LLM output by reasoner
entailment. 2610.00682 uses a reasoner to build benchmark items, not to grade
answers, and whether it checks entailment or consistency was not confirmed
(summary only).

## Verdict

The evidence does not support "ontology beats RAG at a matched budget". No
study tests that directly. In the closest study (2604.00555), the ontology arm
had 40–60% more tokens and still scored at or below RAG, and the difference was
not significant. In the one total-token-matched graph comparison (2502.11371),
the overall graph advantage disappears, and only a temporal and comparison edge
survives.

Non-entailment of the negation is a consistency test. Under OWL's open-world
semantics it accepts every claim the ontology leaves unknown. Every mainstream
support metric fails that case.

Still open:

- whether relational structure helps beyond added facts and compactness at
  equal tokens (no ontology-as-prose or permuted-ontology control exists);
- whether the temporal and comparison edge replicates with significance tests;
- how large the unknown region is for a real domain ontology graded by
  entailment.

## Implications

### goals/agent-outcome-experiments

Use a budget-matched, multi-arm design with these arms:

- no context;
- RAG at its natural k;
- RAG with more chunks, token-matched to the ontology arm;
- the ontology arm;
- the same ontology facts written as prose at equal tokens (isolates format);
- a shuffled or relation-permuted ontology at equal tokens (isolates relational
  correctness);
- a length-padded RAG control with stated filler type (neutral, random,
  hard-negative);
- the ontology truncated to the RAG budget.

Rules for running it:

- Report exact per-arm, per-task token counts under one named tokenizer.
- Use real retrieval, not paragraphs curated from the ontology's source.
- Run several prompt formats and several model families, and control where the
  evidence sits in the prompt.
- Use a judge outside the agent's model family, plus a human-agreement (κ)
  sample.
- Report results by question type (temporal, comparison, relational/role),
  since that is where any structural effect has appeared.

### goals/verification-route

- Require entailment or support, not non-contradiction. Decompose outputs into
  atomic claims and label each claim supported, contradicted or unknown
  (FEVER-style).
- Treat unknown as not verified, and report the unknown rate.
- Keep reasoner consistency (and a prior consistency check of the ontology
  itself) only as a necessary guard, never as proof of validity.
- Run the closed-vocabulary check (every term defined) as a separate gate,
  because OWL accepts new terms.
- Treat SHACL conformance as a shape check, not a support check.
