# RAPTOR — Recursive Abstractive Processing for Tree-Organized Retrieval

Mining note for `explorations/graphnosis-prior-art`. Source PDF:
`explorations/graphnosis-prior-art/assets/raptor-tree-organized-retrieval.pdf` (23 pages).

## Citation (transcribed from the title page / arXiv side-stamp)

> Published as a conference paper at ICLR 2024
>
> **RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval**
>
> Parth Sarthi, Salman Abdullah, Aditi Tuli, Shubh Khanna, Anna Goldie, Christopher D. Manning
> Stanford University
> psarthi@cs.stanford.edu
>
> Side-stamp on p.1: `arXiv:2401.18059v1 [cs.CL] 31 Jan 2024`

No DOI is printed anywhere in the PDF. The venue string "Published as a conference paper at
ICLR 2024" is printed in the running header of every page.

## Reproducibility / license as printed

- Footnote 1 (p.2): "We will release the code of RAPTOR publicly **here**." — the word "here" is a
  hyperlink; **the URL text is not rendered in the PDF body**, so I am not transcribing a URL.
- §6 Reproducibility Statement (p.10), "Source Code": "The source code for RAPTOR will be publicly
  available **here**." Same situation — link text only, no printed URL.
- §6 lists models: `gpt-3`, `gpt-4`, `gpt-3.5-turbo` via the OpenAI API; UnifiedQA "publicly
  available" on Hugging Face (again a hyperlink, no printed URL).
- §6 lists datasets as publicly accessible: QuALITY, QASPER, NarrativeQA (hyperlinks, no printed
  URLs).
- **No software license is stated anywhere in the PDF.** Both code statements are future tense
  ("will be").
- Appendix H links AllenNLP's NarrativeQA eval script by printed footnote URL:
  `docs.allennlp.org/models/main/models/rc/tools/narrativeqa/`.

---

## 1. The thesis in one paragraph

Flat chunk RAG retrieves a handful of short contiguous spans, so it structurally cannot answer
questions whose answer is distributed across a whole document ("How did Cinderella reach her happy
ending?", "What is the central theme?"). RAPTOR's move is to **push the synthesis work to index
time**: recursively cluster chunk embeddings, LLM-summarize each cluster into a parent node,
re-embed, repeat, producing a tree whose upper layers are progressively more abstract summaries.
At query time you retrieve over nodes **at every level of abstraction simultaneously**, so the
retriever can pick a whole-document summary for a thematic question and a raw 100-token chunk for a
detail question, from the same index.

The crucial and under-advertised structural consequence: **at inference time the winning variant of
RAPTOR is not a tree walk at all.** It is ordinary flat dense retrieval over a corpus that has been
augmented with ~18% extra synthetic "summary documents". Everything hierarchical happens offline.

---

## 2. Tree construction — reimplementable detail

### 2.1 Chunking (p.3, §3 "Overview of RAPTOR")

- Segment the corpus into **short contiguous texts of length 100 tokens**.
- **Sentence-boundary safe**: "If a sentence exceeds the 100-token limit, we move the entire
  sentence to the next chunk, rather than cutting it mid-sentence. This preserves the contextual and
  semantic coherence of the text within each chunk."
- No stated overlap between chunks. No stated tokenizer.

### 2.2 Embedding (p.3)

- SBERT, specifically `multi-qa-mpnet-base-cos-v1` (Reimers & Gurevych 2019).
- "Note that we embed **all nodes** using SBERT" (p.4) — leaves and summaries alike, same encoder,
  same space. This is what makes cross-level comparison well-typed.
- Embedding dimensionality is **not printed** in the paper. (The mpnet-base family is 768-d, but
  treat that as inference, not transcription.) The `-cos-v1` suffix means outputs are normalized for
  cosine similarity — which is why the pseudocode's `dot_product` and the prose's "cosine
  similarity" are the same operation here (see §6.3, defects).

### 2.3 Clustering (p.3–4, §3 "Clustering Algorithm")

Four stacked ideas, all offline:

1. **Soft clustering.** "nodes can belong to multiple clusters without requiring a fixed number of
   clusters. This flexibility is essential because individual text segments often contain
   information relevant to various topics, thereby warranting their inclusion in multiple
   summaries." So the tree is really a **DAG-ish structure**: a leaf can have more than one parent.
   The paper still calls it a tree, and Figure 1 draws a node with `Child Nodes: 2, 3`.
2. **Gaussian Mixture Models.** `P(x|k) = N(x; μ_k, Σ_k)`; overall
   `P(x) = Σ_{k=1..K} π_k · N(x; μ_k, Σ_k)`. Parameters (means, covariances, mixture weights)
   fit by Expectation-Maximization.
   **The paper does not state the posterior-probability threshold used to convert soft GMM
   responsibilities into cluster membership.** That is a required hyperparameter for reimplementation
   and it is missing.
3. **UMAP for dimensionality reduction, used twice at different scales.** "The high dimensionality
   of vector embeddings presents a challenge for traditional GMMs, as distance metrics may behave
   poorly ... in high-dimensional spaces (Aggarwal et al., 2001). To mitigate this, we employ Uniform
   Manifold Approximation and Projection (UMAP)". Then the load-bearing trick: "The number of nearest
   neighbors parameter, `n_neighbors`, in UMAP determines the balance between the preservation of
   local and global structures. **Our algorithm varies `n_neighbors` to create a hierarchical
   clustering structure: it first identifies global clusters and then performs local clustering
   within these global clusters.** This two-step clustering process captures a broad spectrum of
   relationships among the text data, from broad themes to specific details."
   **The actual `n_neighbors` values (global vs local) and the UMAP target dimensionality are not
   printed.**
4. **BIC for choosing K.** "`BIC = ln(N)k − 2 ln(L̂)`, where N is the number of text segments (or
   data points), k is the number of model parameters, and L̂ is the maximized value of the likelihood
   function". Minimize over candidate K. The candidate range for K is **not printed**.

**Token-overflow recursion (p.4):** "Should a local cluster's combined context ever exceed the
summarization model's token threshold, our algorithm recursively applies clustering within the
cluster, ensuring that the context remains within the token threshold." So cluster size is bounded
by the summarizer's context window, enforced by re-clustering, not by truncation.

### 2.4 Summarization (p.4, §3 "Model-Based Summarization")

- Model: `gpt-3.5-turbo`.
- Prompt (Appendix D, Table 11, p.17), verbatim:
  - `system`: `You are a Summarizing Text Portal`
  - `user`: `Write a summary of the following, including as many key details as possible: {context}:`
  (Yes, the trailing colon after `{context}` is in the printed table.)
- No temperature, max-tokens, or few-shot examples are printed.
- Hallucination audit (Appendix E, p.17–18): 150 nodes sampled across 40 stories, hand-annotated.
  **4% (6 nodes) contained some form of hallucination** — "the model adding minor information
  possibly from its training data that was not present in the text being summarized, or from
  incorrectly extrapolating some information". Worked example given: a summary asserts "Ajor,
  Co-Tan's sister" where the source text never states or implies the relation. "Upon reviewing all
  parent nodes, we found that **hallucinations did not propagate to higher layers**" and had "no
  discernible impact on the performance of QA tasks."

### 2.5 Recursion and termination (p.3)

"Once clustered, a Language Model is used to summarize the grouped texts. These summarized texts are
then re-embedded, and the cycle of embedding, clustering, and summarization continues **until further
clustering becomes infeasible**, resulting in a structured, multi-layered tree representation of the
original documents."

"Infeasible" is never defined. In practice it must mean: the layer has too few nodes for BIC/GMM to
pick K > 1. **This is the single largest gap for reimplementation** — there is no printed stop rule,
no max-depth, no min-layer-size.

**Observed depths (recoverable from Appendix I, Tables 19–21, p.23):**

| Dataset | Deepest layer index observed | ⇒ levels |
|---|---|---|
| NarrativeQA | 4 (DPR retriever) / 3 (SBERT, BM25) | 5 (or 4) |
| QuALITY | 2 | 3 |
| QASPER | 2 | 3 |

So: books/movie transcripts → ~5 levels; ~5,000-token QuALITY passages and full NLP papers →
3 levels. Depth is emergent from corpus size, not configured.

### 2.6 Node data shape (Figure 1, p.2, "Contents of a node")

Printed fields: `Index #8`, `Child Nodes: 2, 3`, `Text: summary of nodes 2 and 3`,
`Text Embedding [ ... ]`. Algorithm 2 additionally requires `node.token_size`. So the minimal
reimplementable record is:

```
Node {
  index:      int          // stable id
  layer:      int          // 0 = leaves (per Appendix I tables)
  children:   int[]        // [] for leaves; >1 parent per child is legal (soft clustering)
  text:       string       // raw 100-token chunk (leaf) | gpt-3.5-turbo summary (internal)
  embedding:  float[]      // SBERT multi-qa-mpnet-base-cos-v1, unit-normalized
  token_size: int          // needed by the collapsed-tree budget fill
}

Tree {
  layers:     Node[][]     // layers[0] = leaves
  num_layers: int
  all_nodes:  Node[]       // the "collapsed" view; this is what actually gets queried
}
```

### 2.7 Build pseudocode (my reconstruction — the paper gives no build pseudocode)

```
build(doc, summarizer_token_limit):
  chunks  = split_100_tokens_sentence_safe(doc)
  layer   = [Node(text=c, emb=SBERT(c), layer=0, children=[]) for c in chunks]
  layers  = [layer]
  L = 0
  while feasible_to_cluster(layers[L]):                 // stop rule NOT printed in paper
    clusters = cluster(layers[L], summarizer_token_limit)
    parents  = []
    for cl in clusters:
      s = gpt35("You are a Summarizing Text Portal",
                "Write a summary of the following, including as many key details as possible: "
                + concat(cl.texts) + ":")
      parents.append(Node(text=s, emb=SBERT(s), layer=L+1, children=cl.ids))
    layers.append(parents); L += 1
  return Tree(layers)

cluster(nodes, limit):
  Xg = UMAP(embeddings(nodes), n_neighbors = LARGE)     // global structure   [value not printed]
  Kg = argmin_K BIC(GMM_K(Xg))                          // BIC = ln(N)k − 2 ln(L̂)
  for gc in soft_assign(GMM_Kg, Xg):                    // threshold NOT printed
    Xl = UMAP(embeddings(gc), n_neighbors = SMALL)      // local structure    [value not printed]
    Kl = argmin_K BIC(GMM_K(Xl))
    for lc in soft_assign(GMM_Kl, Xl):
      if tokens(lc) > limit: yield from cluster(lc, limit)   // recursive split on overflow
      else:                  yield lc
```

---

## 3. The two retrieval strategies

### 3.1 Tree traversal (p.4–5, Algorithm 1 p.18)

Prose steps (p.4–5), verbatim structure:

1. Start at the **root layer**. Compute cosine similarity between the query embedding and all nodes
   at this layer.
2. Take top-k → set `S₁`.
3. Descend to the **children** of the elements of `S₁`; compute cosine similarity of the query
   against those children only.
4. Take top-k of that child pool → `S₂`.
5. Continue recursively for `d` layers, producing `S₁ … S_d`.
6. **Concatenate `S₁ … S_d`** as the retrieved context. (Note: it returns the union of every level's
   selections, not just the leaves it lands on.)

Printed pseudocode (Algorithm 1, p.18), verbatim:

```
function TraverseTree(tree, query, k)
    S_current ← tree.layer[0]
    for layer in range(tree.num_layers) do
        top_k ← []
        for node in S_current do
            score ← dot_product(query, node)
            top_k.append((node, score))
        end for
        S_layer ← sorted(top_k)[:k].nodes
        S_current ← S_layer
    end for
    return S_0 ∪ S_1 ∪ S_2 ∪ … ∪ S_k
end function
```

Two knobs: depth `d` and branching `k`. "By adjusting the depth d and the number of nodes k selected
at each layer, the tree traversal method offers control over the specificity and breadth of the
information retrieved."

### 3.2 Collapsed tree (p.5, Algorithm 2 p.19)

1. **Collapse the entire tree into a single layer** — set `C` contains nodes from every layer.
2. Cosine similarity between query and **all** nodes in `C`.
3. Take highest-scoring nodes, "Keep adding nodes to the result set until you reach a predefined
   maximum number of tokens, ensuring you don't exceed the model's input limitations."

Printed pseudocode (Algorithm 2, p.19), verbatim:

```
function CollapsedTree(tree, query, k, max_tokens)
    tree ← flatten(tree)                      ▷ Flatten into 1D
    top_nodes ← []
    for node in tree do
        top_nodes.append((node, dot_product(query, node)))
    end for
    top_nodes ← sorted(top_nodes)
    result ← []
    total_tokens ← 0
    for node in top_nodes do
        if total_tokens + node.token_size < max_tokens then
            result.append(node)
        end if
        total_tokens ← total_tokens + node.token_size
    end for
    return result
end function
```

### 3.3 Which wins (p.5–6, Figure 3)

- Tested on **20 stories from QASPER**. Tree traversal swept over top-k ∈ {1,3,5,7,9,11}; collapsed
  tree swept over max-token budgets ~500–2500.
- "**The collapsed tree approach consistently performs better.**"
- Their explanation: "by searching through all the nodes simultaneously, it retrieves information
  that is at the correct level of granularity for a given question. In comparison, while using tree
  traversal with the same values of d and k, the ratio of nodes from each level of the tree will be
  constant. So, the ratio of higher-order thematic information to granular details will remain the
  same regardless of the question."
  → **This is the real insight**: tree traversal hard-codes an abstraction mix; collapsed tree lets
  the *query* choose the abstraction mix. Adaptive granularity is the product, the tree is just the
  factory.
- Figure 3 axis read (approximate, read off the plot; the paper prints no table for it): F1 axis
  spans ~40–60, context-length axis ~500–2500 tokens. The tree-traversal curve climbs from ~40 F1 at
  Top-1 (~500 tokens) through ~52 (Top-3), ~55 (Top-5), ~56 (Top-7), ~57 (Top-9), ~57 (Top-11). The
  collapsed-tree curve sits above it and peaks around the 2000-token budget. **Treat these as
  graph-read approximations, not transcribed numbers.**
- **Chosen configuration for all main results**: collapsed tree, **2000 max tokens**, "which
  approximately equates to retrieving the top-20 nodes". For UnifiedQA experiments they use
  **400 tokens** of context because UnifiedQA's max context is 512. "We provide the same amount of
  tokens to RAPTOR and to the baselines." — good, the token budget is controlled.
- Acknowledged drawback: "it requires cosine similarity search to be performed on all nodes in the
  tree. However, this can be made more efficient with fast k-nearest neighbor libraries such as
  FAISS."

### 3.4 The engineering consequence

Collapsed-tree RAPTOR at query time is **exactly** an ANN search over `all_nodes` plus a greedy
token-budget fill. There is no tree walk, no graph traversal, no multi-hop. The tree is an *offline
corpus-augmentation procedure*; the runtime is unchanged flat vector RAG. That is enormously
convenient for an existing retrieval-fusion stack: summary nodes are just more documents with a
`layer` and `children` attribute.

---

## 4. Cost profile — the affordability question

All from **Appendix A** (p.15–16). Hardware: "a consumer-grade laptop, specifically an **Apple M1
Mac with 16GB of RAM**." Context length varied **12,500 to 78,000 tokens**.

### 4.1 Token expenditure (Figure 5, p.15)

Total tokens (prompt + completion) vs. document length, one panel per dataset, all visibly linear:

| Dataset | Document-length axis range | Total-token axis range | Implied ratio (graph-read) |
|---|---|---|---|
| QASPER | 0 → ~30,000 | 0 → ~40,000+ | ~1.3–1.4× |
| NarrativeQA | 0 → ~430,000 | 0 → ~800,000 | ~1.8–1.9× |
| QuALITY | ~2,000 → ~8,000 | ~3,000 → ~12,000 | ~1.5× |

Paper's own words: "a clear linear correlation between the initial document length and the total
token expenditure, emphasizing that RAPTOR maintains a **linear token scaling** regardless of
document complexity or length."

**Read:** build cost is roughly **1.3–2× the corpus token count, one pass, through a cheap model**
(`gpt-3.5-turbo`). At 2024-era 3.5-turbo pricing this is trivial; at any modern cheap-tier model it
is trivial. **The build cost is not the blocker.** (These ratios are read off log-free scatter plots;
the paper prints no numeric table for them.)

### 4.2 Build time (Figure 6, p.16)

Single curve, "Time in seconds" (0–~1500+) vs "Length of document in tokens" (0–80,000). Read off
the plot: near-zero up to ~10k tokens, ~250s at ~20k, a local peak ~850s around ~33k, a **dip to
~600s at ~40k**, then ~1250s at ~60k and ~1700s at ~78k. The paper calls this "a consistent linear
trend"; the printed curve is visibly non-monotonic, so "linear" is a fit, not the data.

**Read:** ~20 ms per input token ⇒ **~25–30 minutes to build a tree for an 80k-token document on one
laptop, serially.** This is API round-trip latency on serial `gpt-3.5-turbo` summarization calls, not
compute. It is embarrassingly parallel within a layer (every cluster in a layer is independent) and
the paper does not appear to have parallelized it. A parallel implementation should collapse this by
the layer's cluster count. **Latency is a solvable engineering problem; do not read Figure 6 as a
fundamental cost.**

### 4.3 Index size blow-up (Appendix C, Table 10, p.17) — transcribed

| Dataset | Avg. Summary Length (tokens) | Avg. Child Node Text Length (tokens) | Avg. # Child Nodes Per Parent | Avg. Compression Ratio (%) |
|---|---|---|---|---|
| All Datasets | 131 | 85.6 | 6.7 | .28 |
| QuALITY | 124.4 | 87.9 | 5.7 | .28 |
| NarrativeQA | 129.7 | 85.5 | 6.8 | .27 |
| QASPER | 145.9 | 86.2 | 5.7 | .35 |

Header text: "The average ratio of the summary length to the sum of child node lengths across all
datasets is 0.28, indicating a **72% compression rate**. On average, the summary length is 131 tokens
and the average child node length is 86 tokens."

**Derived, and this is the number that decides adoption:** branching factor ≈ 6.7 ⇒ each layer is
~1/6.7 the size of the one below ⇒ total nodes ≈ `n_leaves × (1 + 1/6.7 + 1/6.7² + …) ≈ 1.18 ×
n_leaves`. **The collapsed index is only ~18% larger than the flat chunk index.** Vector-store cost,
ANN latency, and memory are all ~18% deltas. That is cheap.

Also note: avg child text 85.6 tokens vs the stated 100-token chunk target — consistent with the
sentence-boundary-safe splitter under-filling chunks.

### 4.4 Query cost

Unchanged. Same 2000-token (or 400-token for UnifiedQA) budget as the baselines. RAPTOR spends
**zero extra inference tokens at query time** — it spends them at build time. For a
high-query-volume system this is exactly the right place to move the cost.

---

## 5. Results — transcribed tables

### Table 1 (p.7) — NarrativeQA, with vs. without RAPTOR, reader = UnifiedQA-3B

| Model | ROUGE | BLEU-1 | BLEU-4 | METEOR |
|---|---|---|---|---|
| **SBERT with RAPTOR** | **30.87%** | **23.50%** | **6.42%** | **19.20%** |
| SBERT without RAPTOR | 29.26% | 22.56% | 5.95% | 18.15% |
| **BM25 with RAPTOR** | **27.93%** | **21.17%** | **5.70%** | **17.03%** |
| BM25 without RAPTOR | 23.52% | 17.73% | 4.65% | 13.98% |
| **DPR with RAPTOR** | **30.94%** | **23.51%** | **6.45%** | **19.05%** |
| DPR without RAPTOR | 29.56% | 22.84% | 6.12% | 18.44% |

Footnote 2: Tables 1 and 2 use `dpr-multiset-base`; the rest of the paper uses `dpr-single-nq-base`.

### Table 2 (p.8) — QuALITY accuracy & QASPER Answer F1, with vs. without RAPTOR, reader = UnifiedQA-3B

| Model | Accuracy (QuALITY) | Answer F1 (QASPER) |
|---|---|---|
| **SBERT with RAPTOR** | **56.6%** | **36.70%** |
| SBERT without RAPTOR | 54.9% | 36.23% |
| **BM25 with RAPTOR** | **52.1%** | **27.00%** |
| BM25 without RAPTOR | 49.9% | 26.47% |
| **DPR with RAPTOR** | **54.7%** | **32.23%** |
| DPR without RAPTOR | 53.1% | 31.70% |

**The pattern across Tables 1+2 is the most transferable result in the paper: RAPTOR improves *every*
retriever it is bolted onto — sparse (BM25), dense-supervised (DPR), dense-unsupervised (SBERT) — on
*every* dataset and *every* metric.** Deltas: QuALITY +1.7 / +2.2 / +1.6; QASPER F1 +0.47 / +0.53 /
+0.53; NarrativeQA ROUGE +1.6 / +4.4 / +1.4. Note QASPER's deltas are tiny (~0.5 F1) — the wins are
concentrated where documents are long and questions are thematic (NarrativeQA, QuALITY), not where
they are technical-extractive (QASPER, under a weak reader).

### Table 3 (p.8) — QASPER F1, controlled across readers

| Retriever | GPT-3 F1 Match | GPT-4 F1 Match | UnifiedQA F1 Match |
|---|---|---|---|
| Title + Abstract | 25.2 | 22.2 | 17.5 |
| BM25 | 46.6 | 50.2 | 26.4 |
| DPR | 51.3 | 53.0 | 32.1 |
| **RAPTOR** | **53.1** | **55.7** | **36.6** |

Deltas over DPR: +1.8 (GPT-3), +2.7 (GPT-4), +4.5 (UnifiedQA). Over BM25: +6.5, +5.5, +10.2.

### Table 4 (p.8) — QuALITY **dev** set accuracy

| Model | GPT-3 Acc. | UnifiedQA Acc. |
|---|---|---|
| BM25 | 57.3 | 49.9 |
| DPR | 60.4 | 53.9 |
| **RAPTOR** | **62.4** | **56.6** |

### Table 5 (p.8) — QASPER F1 Match, vs. published systems

| Model | F1 Match |
|---|---|
| LongT5 XL (Guo et al., 2022) | 53.1 |
| CoLT5 XL (Ainslie et al., 2023) | 53.9 |
| **RAPTOR + GPT-4** | **55.7** |

### Table 6 (p.9) — NarrativeQA, vs. published systems

| Model | ROUGE-L | BLEU-1 | BLEU-4 | METEOR |
|---|---|---|---|---|
| BiDAF (Kočiský et al., 2018) | 6.2 | 5.7 | 0.3 | 3.7 |
| BM25 + BERT (Mou et al., 2020) | 15.5 | 14.5 | 1.4 | 5.0 |
| Recursively Summarizing Books (Wu et al., 2021) | 21.6 | 22.3 | 4.2 | 10.6 |
| Retriever + Reader (Izacard & Grave, 2022) | **32.0** | **35.3** | **7.5** | 11.1 |
| **RAPTOR + UnifiedQA** | 30.8 | 23.5 | 6.4 | **19.1** |

**RAPTOR loses ROUGE-L, BLEU-1, and BLEU-4 to Izacard & Grave and wins only METEOR.** The paper's
prose ("RAPTOR excels across multiple metrics") is doing a lot of work; the honest statement is
"new SOTA on METEOR only", which the table caption does concede.

### Table 7 (p.9) — QuALITY test set + hard subset

| Model | Test Set Acc. | Hard Subset Acc. |
|---|---|---|
| Longformer-base (Beltagy et al., 2020) | 39.5 | 35.3 |
| DPR and DeBERTaV3-large (Pang et al., 2022) | 55.4 | 46.1 |
| CoLISA (DeBERTaV3-large) (Dong et al., 2023a) | 62.3 | 54.7 |
| **RAPTOR + GPT-4** | **82.6** | **76.2** |

This is the abstract's "improve the best performance on QuALITY by 20% in absolute accuracy"
(82.6 − 62.3 = 20.3), and "outperforms CoLISA by 21.5% on QuALITY-HARD" (76.2 − 54.7 = 21.5).
**See §7.1 — this headline is mostly the reader, not the retriever.**

### Table 8 (p.9) + Tables 14–17 (Appendix I, p.21–22) — layer ablation, per story, QuALITY

Caption semantics: "Columns represent different starting points (highest layer) and rows represent
different numbers of layers queried."

Story 1 (Table 8):

| Layers Queried / Start Layer | Layer 0 (Leaf Nodes) | Layer 1 | Layer 2 |
|---|---|---|---|
| 1 layer | 57.9 | 57.8 | 57.9 |
| 2 layers | – | 52.6 | 63.15 |
| 3 layers | – | – | **73.68** |

Story 2 (Table 14):

| Layers Queried / Start Layer | Layer 0 | Layer 1 | Layer 2 |
|---|---|---|---|
| 1 layer | 58.8 | 47.1 | 41.1 |
| 2 layers | – | **64.7** | 52.9 |
| 3 layers | – | – | 47.1 |

Story 3 (Table 15):

| Layers Queried / Start Layer | Layer 0 | Layer 1 | Layer 2 |
|---|---|---|---|
| 1 layer | 66.6 | 61.1 | 61.1 |
| 2 layers | – | 66.6 | 66.6 |
| 3 layers | – | – | **83.3** |

Story 4 (Table 16):

| Layers Queried / Start Layer | Layer 0 | Layer 1 |
|---|---|---|
| 1 layer | **94.7** | 84.2 |
| 2 layers | – | 89.4 |

Story 5 (Table 17):

| Layers Queried / Start Layer | Layer 0 | Layer 1 |
|---|---|---|
| 1 layer | 57.9 | 47.3 |
| 2 layers | – | **68.4** |

**This ablation does not support the claim the paper draws from it.** The paper says (p.9) "a
full-tree search, utilizing all layers, outperformed retrieval strategies that focused only on
specific layers." That holds for Stories 1 and 3. It **fails for Story 2** (3-layer 47.1 < 2-layer
64.7 < leaf-only 58.8 — the full tree is the *worst* config) and **fails for Story 4** (leaf-only
94.7 > 2-layer 89.4). n = 5 stories, per-story accuracies on ~20-question multiple-choice sets, no
error bars, no aggregate. **Read this as: "upper layers matter *sometimes*, with huge variance", not
"more layers is better".**

### Table 9 (Appendix B, p.17) — clustering ablation, QuALITY

| Configuration | Accuracy |
|---|---|
| **RAPTOR + SBERT embeddings + UnifiedQA** | **56.6%** |
| Recency-based tree + SBERT embeddings + UnifiedQA | 55.8% |

Methodology (B.1, p.16): the alternative "involved creating a **balanced tree by recursively encoding
and summarizing contiguous text chunks**. We determined the window size for this setup based on the
average cluster size observed in RAPTOR, which is approximately 6.7 nodes. Hence, we chose a **window
size of 7 nodes**. The collapsed tree approach was applied for retrieval in both models."

**This is the most decision-relevant number in the entire paper and the authors bury it in an
appendix.** The whole UMAP + GMM + BIC + soft-clustering apparatus is worth **0.8 accuracy points**
over sliding a window of 7 contiguous chunks and summarizing. The value is in the *recursive
summarization + multi-level retrieval*, not in the clustering. A v1 that skips clustering entirely
gets ~99% of the benefit for ~5% of the implementation complexity and none of the
non-determinism.

### Table 18 (Appendix I.2, p.22) — % of retrieved nodes that are non-leaf (collapsed tree)

| Dataset | DPR | SBERT | BM25 |
|---|---|---|---|
| NarrativeQA | 57.36% | 36.78% | 34.96% |
| Quality | 32.28% | 24.41% | 32.36% |
| Qasper | 22.93% | 18.49% | 22.76% |

"We observe that between 18.5% to 57% of the retrieved nodes come from non-leaf nodes."

### Tables 19–21 (p.23) — per-layer share of retrieved nodes

DPR (Table 19):

| Layer | NarrativeQA | Quality | Qasper |
|---|---|---|---|
| 0 | 42.64% | 67.71% | 77.07% |
| 1 | 45.00% | 29.43% | 21.88% |
| 2 | 10.57% | 2.85% | 1.05% |
| 3 | 1.78% | – | – |
| 4 | 0.003% | – | – |

SBERT (Table 20):

| Layer | NarrativeQA | Quality | Qasper |
|---|---|---|---|
| 0 | 63.22% | 75.59% | 81.51% |
| 1 | 31.51% | 22.78% | 17.84% |
| 2 | 4.85% | 1.63% | 0.65% |
| 3 | 0.42% | – | – |

BM25 (Table 21):

| Layer | NarrativeQA | Quality | Qasper |
|---|---|---|---|
| 0 | 65.04% | 67.64% | 77.24% |
| 1 | 28.79% | 28.85% | 21.57% |
| 2 | 5.36% | 3.51% | 1.19% |
| 3 | 0.81% | – | – |

Figure 7 (p.22) is the histogram of the same data.

**Read:** almost all the non-leaf value is **layer 1** — the first summarization pass. Layer ≥ 2
contributes 0.65–10.6% of retrieved nodes; layer ≥ 3 is noise (≤ 1.8%). With NarrativeQA/DPR being
the striking exception (45% of retrieved nodes are layer-1, more than leaves at 42.6%). **Depth 2
(leaves + one summary layer) captures the overwhelming majority of the benefit for the medium-length
corpora.** Deeper trees earn their keep only on book-length text.

### Qualitative study (§3 "Qualitative Study" p.6, Figure 4 p.7, Appendix G p.18–20, Tables 12/13)

1500-word Cinderella. Two questions: "What is the central theme of the story?" and "How did
Cinderella find a happy ending?". RAPTOR retrieves nodes from different layers per question; DPR
retrieves only leaves. Transcribed outcome for the multi-hop question: with DPR's context GPT-4 says
"Based on the given context, it is not possible to determine how Cinderella finds a happy ending, as
the text lacks information about the story's conclusion." With RAPTOR's context GPT-4 answers it.
For the thematic question, DPR's context yields an answer covering "only ... the first portion of the
story", RAPTOR's covers the whole arc. Also: "the information that would be retrieved by DPR is more
often than not included in the context retrieved by RAPTOR, either directly as a leaf node or
indirectly as part of a summary from a higher layer" — i.e. RAPTOR's context **dominates** DPR's.

A second qualitative case (p.20): a 2600-word story "The Eager Writer", where an upper-level node
contains "This story is about the power of human connection... inspiring and uplifting each other as
they pursued their passions" — a sentence **"not explicitly present in the original text"** that
"almost directly answers the question". That is precisely the abstractive-synthesis-at-index-time
mechanism, stated cleanly. It is also precisely the provenance hazard.

---

## 6. Defects, gaps, and inconsistencies I found in the text

### 6.1 Algorithm 2's token budget accounting is wrong

```
if total_tokens + node.token_size < max_tokens then
    result.append(node)
end if
total_tokens ← total_tokens + node.token_size    ← OUTSIDE the if
```

`total_tokens` accumulates for **skipped** nodes too. Once one node fails to fit, `total_tokens`
keeps growing, so every subsequent node also fails. Net effect: it is a strict **prefix fill** that
stops at the first node too large to fit, not a greedy knapsack that keeps trying smaller nodes.
Given fairly uniform node sizes (86–146 tokens) the practical difference is small, but a
reimplementation should move the accumulator inside the branch (or keep the paper's semantics
deliberately — it is more deterministic and arguably better for ordering-coherence).

### 6.2 Algorithm 1 starts at `tree.layer[0]`, but the prose says start at the root

Appendix I's tables define **Layer 0 = Leaf Nodes**. Algorithm 1 sets `S_current ← tree.layer[0]` and
then iterates `for layer in range(tree.num_layers)`, never actually indexing into children — it
re-scores the same `S_current` shrinking set each iteration. As printed, Algorithm 1 does not
implement the prose algorithm at all (it never descends to `node.children`). The prose (steps 1–6) is
the correct spec; the pseudocode is broken. Since tree traversal is the *losing* strategy and is not
used for any headline result, this matters little, but do not copy Algorithm 1.

### 6.3 `cosine_similarity` (prose) vs `dot_product` (both pseudocodes)

Reconciled by the `-cos-v1` SBERT checkpoint producing normalized embeddings, where the two coincide.
Worth pinning explicitly in any reimplementation, because with an un-normalized encoder dot product
silently biases toward long summaries.

### 6.4 Missing hyperparameters required to reimplement

- GMM soft-membership posterior threshold — **not printed**.
- UMAP `n_neighbors` for the global and local passes — **not printed**.
- UMAP output dimensionality — **not printed**.
- BIC candidate-K range — **not printed**.
- The `feasible_to_cluster` termination predicate — **not printed**.
- Summarizer token threshold that triggers recursive re-clustering — **not printed** (implied by
  gpt-3.5-turbo's window, which was 4k/16k in early 2024).
- `k` for the collapsed tree — implied only as "2000 max tokens ≈ top-20 nodes".
- Chunk overlap — never mentioned; presumably zero.

### 6.5 Cross-table arithmetic that does not reconcile

p.7: "in the NarrativeQA dataset, as presented in Table 6, RAPTOR excels ... For ROUGE-L, it
surpasses BM25 and DPR by **7.3 and 2.7** points". Table 6 has no DPR row. Against Table 1's
`BM25 without RAPTOR` (23.52) the 7.3 checks out vs RAPTOR's 30.8; against Table 1's
`DPR without RAPTOR` (29.56) the delta is 1.24, not 2.7. Probably a different DPR checkpoint
(`dpr-single-nq-base` vs the `dpr-multiset-base` used in Tables 1–2, per footnote 2), but the paper
never prints that row. **The claim is unverifiable from the printed tables.**

### 6.6 The NarrativeQA metrics are not comparable to prior work

Appendix H (p.20–21) documents **three modifications to AllenNLP's NarrativeQA evaluation script**:

1. **Added smoothing** so zero-n-gram-match BLEU scores don't collapse to 0.
2. **Modified BLEU-4 weighting** from `(0, 0, 0, 1)` to `(0.25, 0.25, 0.25, 0.25)` — i.e. their
   "BLEU-4" is now an evenly-weighted 1–4-gram average, which is a *different metric*.
3. **Tokenization before mapping in METEOR**.

Table 6 then compares their modified-script numbers against BiDAF / BM25+BERT / Wu et al. /
Izacard & Grave numbers that were computed with the *original* script. **Their headline "new
state-of-the-art METEOR" (19.1 vs 11.1) is exactly the metric they modified.** The authors do not
flag this. I consider it the most serious methodological problem in the paper.

---

## 7. What actually holds up

### 7.1 The 20-point QuALITY headline is the reader, not the retriever

Table 7's 82.6% is `RAPTOR + GPT-4` vs `CoLISA + DeBERTaV3-large` at 62.3%. There is **no
`GPT-4 + DPR` or `GPT-4 + BM25` row on the QuALITY test set**. The only place retrieval is isolated
on QuALITY is Table 4 (dev set, GPT-3 reader), where RAPTOR beats DPR by **2.0 points** (62.4 vs
60.4). So the retrieval-attributable share of the 20.3-point headline is plausibly ~2 points; the
other ~18 are GPT-4 replacing DeBERTaV3-large. **The abstract's framing is a confound.** Anyone
budgeting engineering effort against the "+20%" number will be disappointed by roughly an order of
magnitude.

The defensible retrieval-attributable effect sizes, aggregated across every controlled comparison in
the paper:

- vs. the *same* retriever without the tree (Tables 1, 2): **+0.5 to +4.4 points**, always positive,
  across 3 retrievers × 3 datasets × 6 metrics.
- vs. DPR at equal reader and equal token budget (Tables 3, 4): **+1.8 to +4.5 points**.
- vs. BM25 at equal reader and equal token budget: **+2.7 to +10.2 points**.

**A consistent low-single-digit to low-double-digit improvement, reliably positive, never
transformative.** That is a real and useful result and it is what the paper actually demonstrates.

### 7.2 The three claims I'd bet on

1. **Adding LLM-written summary nodes to a flat vector index reliably improves retrieval, for every
   retriever family, at ~18% index growth and ~1.5× one-time corpus token cost.** Strongly supported
   (Tables 1, 2, 3, 4; 3 retrievers × 3 datasets, all positive).
2. **Query-time abstraction selection beats fixed-abstraction traversal.** Supported by Figure 3 and
   by the mechanism argument (fixed d,k pins the thematic:granular ratio regardless of query). The
   evidence base is thin (20 QASPER stories) but the mechanism is convincing and the deployment
   consequence — you don't need a tree walk — is what makes it cheap.
3. **The gains concentrate on long, narrative, thematic corpora.** NarrativeQA and QuALITY show
   +1.6 to +4.4; QASPER shows +0.5 under UnifiedQA. Consistent with Table 18: NarrativeQA pulls 35–57%
   of nodes from non-leaves, QASPER only 18–23%.

### 7.3 The claim I'd bet against

**"Full-tree search outperforms layer-restricted search."** Two of five stories contradict it
outright (Tables 14, 16), and Tables 19–21 show layers ≥ 2 supply < 11% of retrieved nodes on the
best case and < 4% typically. **Build depth 2 (leaves + one summary layer) unless the corpus is
book-length.**

---

## 8. Relevance read for the consuming repo (retrieval-fusion, RAG-projection, KG strand)

### 8.1 RAPTOR is a *fusion input*, not a competing architecture

Tables 1 and 2 are literally an argument for fusion: the tree improved SBERT, BM25, **and** DPR. The
tree does not replace a retriever; it augments the corpus every retriever runs over. Concretely, for
a fusion stack:

- `all_nodes` (leaves + summaries) is one candidate pool. Existing sparse/dense arms score it
  unchanged.
- `layer` becomes a candidate feature. You can fuse a leaf-only arm and a summary-only arm with RRF
  and get explicit control over the thematic:granular mix — which is exactly the knob Figure 3 says
  matters, but *learned/tuned* rather than hard-coded like tree traversal.
- The token-budget greedy fill (Algorithm 2) is a **reranker-adjacent packing step**, not a
  retrieval step. It belongs after fusion, not inside it.

### 8.2 Where a summary tree beats a graph walk

- **Gestalt / thematic queries.** "What is the central theme?" has no answer in any chunk and no
  answer on any edge path. A summary node *contains* the synthesized answer verbatim (the
  "power of human connection" example, p.20). A graph walk has nowhere to walk to.
- **Multi-hop where the hops are narrative, not relational.** "How did Cinderella reach her happy
  ending" requires stitching a temporal arc. Entity-relation edges don't encode arcs; a summary does.
- **Zero-schema corpora.** RAPTOR needs no entity extraction, no ontology, no relation typing, no
  disambiguation. Build cost is one summarization pass. A KG build is extraction + typing +
  resolution + dedup, dramatically more expensive and more brittle per document.
- **Latency.** Collapsed-tree retrieval is one ANN query. A graph walk is k rounds of neighborhood
  expansion.

### 8.3 Where a summary tree loses to a graph walk

- **Precise relational multi-hop.** "Which claims of patent X cite prior art assigned to Y?" — the
  answer is a join over typed edges. A 131-token abstractive summary will not preserve it, and 72%
  compression will drop it.
- **Provenance and attribution.** A summary node is derived text with a **4% hallucination rate**
  (Appendix E). Citing it to a user is citing a paraphrase that may contain fabricated relations
  ("Ajor, Co-Tan's sister"). The `children` pointers *do* give you a structural path back to source
  leaves — provenance is **structurally available but never evaluated in the paper**. Any legal /
  patent / compliance surface must resolve summary hits down to leaf spans before display. This is
  the sharpest constraint for this repo's OIP-adjacent work.
- **Incremental update.** RAPTOR is a **batch build**. GMM + UMAP + BIC are global fits over the
  whole layer. Adding one document changes the clustering, which changes every summary above it. The
  paper says **nothing** about incremental ingestion, invalidation, or partial rebuild. A KG
  supports incremental node/edge insertion natively. **This is the largest practical gap for a live
  system and the paper does not acknowledge it at all.**
- **Cross-document queries at corpus scale.** All experiments are effectively *per-document* trees
  (QuALITY passages ~5,000 tokens; QASPER papers; NarrativeQA books). "Corpus" in the paper means one
  long document. Whether one tree over a whole multi-document corpus behaves the same is **untested**.
  A KG is natively cross-document via entity coreference; RAPTOR has no coreference notion.
- **Contradiction and temporality.** Summarization silently smooths conflicting sources into one
  fluent paragraph. A graph can carry contradictory edges with distinct provenance.

### 8.4 Do they compose? Yes, cleanly, and the seam is obvious

The tree and the graph live on different axes: the tree is an **abstraction hierarchy over text
spans**; the graph is an **entity-relation network over extracted assertions**. They share the same
leaves.

- Model summary nodes as first-class graph nodes with a typed `summarizes` / `abstracts` edge to
  their children. The tree becomes a subgraph. Retrieval-fusion then has three arms: dense-over-leaves,
  dense-over-summaries, graph-walk-over-entities.
- Run entity extraction over *summary* nodes as well as leaves. A layer-1 summary states relations
  that no single chunk states; extracting from summaries is a cheap way to materialize
  cross-chunk edges without a multi-hop extraction pass. (Risk: the 4% hallucination rate becomes
  hallucinated *edges*, which are far more damaging than hallucinated prose. Gate this behind
  leaf-grounding verification.)
- Use graph structure as the clustering signal instead of UMAP+GMM. Table 9 says the clustering
  method is worth 0.8 points, so *any* reasonable grouping works — including "nodes sharing an
  entity" or "nodes in the same community". This is the direct bridge to GraphRAG-style community
  summarization, and RAPTOR's own ablation is the license to swap the clustering out.

### 8.5 Concrete build recommendation if this graduates

Given Table 9 (clustering worth 0.8 pts), Tables 19–21 (layer ≥ 2 worth < 4%), and Figure 3
(collapsed > traversal):

**v0 — 90% of the value, ~2 days of work:**
- Reuse the existing 100-token sentence-safe chunker and the existing embedder.
- One summarization pass over **contiguous windows of ~7 chunks** (no UMAP, no GMM, no BIC).
- Write summary nodes into the **existing vector store** with `layer=1` and `childIds`.
- Retrieval unchanged; just a token-budget packing step and a `layer` feature for fusion weighting.
- Index growth ~15%. Build cost ~1.2× corpus tokens through a cheap model. Fully incremental
  (contiguous windows are local — inserting a document only rebuilds its own summaries).

**v1 — add depth and clustering only if measured:**
- Depth 3 only for book-length inputs.
- Swap contiguous windows for graph-community or embedding clustering only after v0 is measured, and
  only if the 0.8-point-equivalent delta is worth losing incrementality.

The thing to *not* copy is the UMAP + GMM + BIC pipeline. It is the most complex, most
non-deterministic, most globally-coupled, and least incrementally-updatable part of the system, and
the authors' own ablation prices it at 0.8 accuracy points.

---

## 9. Limitations — stated and understated

**Stated by the authors:**
- Collapsed tree requires similarity search over all nodes (p.6; they offer FAISS as the answer).
- ~4% of summaries contain minor hallucinations (Appendix E).
- GMM's Gaussian assumption "may not perfectly align with the nature of text data, which often
  exhibits a sparse and skewed distribution" (p.4).

**Understated or unstated, in descending severity:**
1. **The 20% QuALITY headline confounds retriever with reader** — no GPT-4 baseline retriever row
   exists (§7.1).
2. **The NarrativeQA evaluation script was modified in three ways, including the METEOR computation
   they claim SOTA on**, and compared against prior work computed with the unmodified script
   (Appendix H).
3. **No incremental-update story whatsoever.** Global GMM/UMAP fits make the build all-or-nothing.
   Not mentioned once.
4. **The layer ablation contradicts the conclusion drawn from it** on 2 of 5 stories, n=5, no error
   bars (§5, Tables 8/14/16).
5. **The clustering ablation shows the headline mechanism is worth 0.8 points** and is buried in
   Appendix B with no discussion of the complexity/benefit tradeoff.
6. **Only one summarizer (`gpt-3.5-turbo`) and one embedder (`multi-qa-mpnet-base-cos-v1`) tested.**
   No sensitivity analysis on either.
7. **Retrieval-strategy comparison rests on 20 QASPER stories** with no table, only a figure.
8. **No latency-at-query-time measurement**, only build time. The claim that FAISS solves
   collapsed-tree search cost is asserted, not measured.
9. **"Corpus" always means one long document.** Cross-document tree behaviour, coreference, and
   duplicate-content handling are untested.
10. **No provenance evaluation.** Summary nodes are what get retrieved 18–57% of the time; the paper
    never asks whether a user can trace a summary-derived answer to source text, despite `children`
    making that trivially possible.
11. **Statistical significance is never reported** anywhere in the paper. Deltas of 0.47 F1
    (SBERT/QASPER, Table 2) are presented in bold as improvements.
12. **Figure 6's build-time curve is visibly non-monotonic** and is described as "a consistent linear
    trend."
