# IPRally invention graphs (arXiv 2610.01553): a close read of the paper, its repo and its lineage, and what it means for beep-effect

## TL;DR

- **The release.** The repo is MIT-licensed. It contains a pydantic graph model, a token-label-to-graph builder, a metrics library and two 5,000-document archives. The "gold-standard" graphs in it are the teacher's (rule parser's) output, not human annotation.
- **A finding the paper doesn't state.** The released graph JSON does not keep the part-of / example-of edge type. Those labels (`meronym`, `hyponym`) exist only in the word-level `targets/*.csv` `edge` column. The headline IoU is computed over untyped `(parent_string, child_string)` pairs, so an edge with the wrong type still counts as correct.
- **Lineage.**
  - SIGIR 2023 (Tree-LSTM): I could only get its abstract.
  - PatentSemTech'25 (Graph Transformer, arXiv 2508.10496): defines the graph schema and the training signal (about 31.7M examiner X/A/Y citations).
  - 2610.01553: replaces only the parser.
- **For beep-effect.** `PatentClaim` stores `preamble` / `transition` / `body`, but `body` is a single `S.NonEmptyString`, so we have no claim-element layer. An invention graph would fill that gap. It would also give `Distinction.missing_limitation` (today free text) a structured element to point at.
- **Caveats.** The effect sizes are small (+0.0020 and +0.0037 absolute Recall@3). The intrinsic metric only measures agreement with the teacher. The corpus is proprietary. US prosecution relevance is assumed, never tested.

---

## 1. Released repo: `github.com/iprally/invention_graph_eval`

Source: https://github.com/iprally/invention_graph_eval, read through the alphaXiv GitHub reader. I did not download or extract the data archives, because downloads need user approval. Archive contents below come from the README and the validation tests, not from opening the tarballs.

### License and packaging

- **License:** MIT, "Copyright (c) 2026 IPRally".
- **Package:** `invention-graph-eval` v1.0.0. Python ≥3.10. Depends on numpy, pandas, pydantic≥2 and annotated-types.
- **Cite as:** LNCS pp. 533–549, doi 10.1007/978-3-032-37682-4_31 (https://link.springer.com/chapter/10.1007/978-3-032-37682-4_31).

### Data

| Archive | Size | Contents |
|---|---|---|
| `data/evaluation.tar.gz` | 6,767,848 B | The 5,000-patent evaluation set, which the README calls "gold-standard" |
| `data/train_sample.tar.gz` | 7,668,972 B | A 5,000-patent sample of the 1M training set |

Each archive extracts to:

```
<dataset_root>/
    patent_meta.csv
    json/<ucid>.json
    targets/<ucid>.csv
```

**`patent_meta.csv` columns:** `ucid`, `id`, `family_id`, `country`, `ipc_codes` (pipe-separated), `coverage` ("Fraction of claim words in the graph"), `length` ("Number of tokens in the patent claim").

- The column descriptions talk about claim text. The paper (§3.4) says test documents were "processed at full length".
- So it is unclear whether the released eval inputs are claims only or full documents. Opening the tarball would settle it.

**`targets/<ucid>.csv` columns** (exactly `id,text,parent,edge,relation`; `test_all_csv_columns` checks this):

- `parent`: token index of the parent in the feature tree.
- `edge`: one of `none`, `normal`, `meronym`, `hyponym`, `syntactic`, `method`, `reference`.
- `relation`: index of the relation-root token (0 if none).
- Rows 0 and 1 are pseudo-tokens with text `_`. These are None and Root, matching paper §3.2.

### Is the "gold standard" human-labelled?

No. Paper §4.1: "Since no human-annotated corpus exists, intrinsic metrics measure teacher agreement". The released eval set is rule-parser output (https://arxiv.org/abs/2610.01553).

### Graph serialization (`invention_graph_eval/graph_model.py`)

```python
class NodeType(str, Enum): feature = "feature"; relation = "relation"
class TextPart(BaseModel): text: str
class NodeRef(BaseModel):  ref: int
class Node(BaseModel):
    id: int
    type: NodeType
    value: Union[list[Union[NodeRef, TextPart]], Annotated[str, Len(min_length=1)]]
    items: list[Node]
class Graph(BaseModel): items: list[Node]
```

How the structure maps onto the paper's model:

- **Feature nodes** have `value: str`, a multi-word span assembled from `syntactic` children.
- **Relation nodes** have `value: [ {ref}, {text}, {ref}, ... ]`, an interleaved sequence of feature references and connecting text, e.g. `[{"ref":1},{"text":"connects to"},{"ref":3}]`.
- **The feature hierarchy** is the nesting of `items`.
- **Relations** are attached as children of the first feature referenced in their token chain (`graph_builder.build_graph`).

What the JSON does not carry:

- **Edge type.** There is no field for it, so the part-of vs example-of distinction is lost. Typed labels survive only in the word-level `targets/*.csv` of the **training sample** (`train_sample`: `meronym`, `hyponym`, `normal`, `reference`, `syntactic`). The post-acquisition census found every evaluation-archive target row at `parent=0`/`edge=none`, so use `train_sample`, not the evaluation archive, for typed-edge tests.
- **Source offsets.** There are no character offsets and no token spans. Grounding a node back to the text means re-tokenizing with `tokenize.py` and aligning against the CSV token ids.
- **Shared node ids.** `build_node_map` raises `CyclicGraphException` when an id repeats, so the JSON is a strict tree of features. The DAG part exists only through `NodeRef`s inside relation values.

### How the metrics are computed (`metrics.py`)

1. **Resolve values.** `resolve_values` lowercases every feature value. A relation becomes `" ".join(...)` of its parts, with referenced features uppercased (e.g. "AT LEAST ONE INJECTION MANIFOLD in fluid communication with …").
2. **Build edge sets.** `_edges("##ROOT##", items, value_map)` produces a set of `(parent_value_string, child_value_string)` tuples. Root nodes pair with `"##ROOT##"`.
3. **Score.** `SetMetrics` computes per-document precision, recall and IoU (`TP/(|union|+eps)`, rounded to 3 decimals), then averages them.
   - `iou@100` and `iou@90` are the fraction of documents with IoU ≥ 1.0 or ≥ 0.9.
   - The primary metric is `whole graph iou`, which pools feature and relation edges.

Side metrics, off by default in `stats()`:
- `features` (feature edges only)
- `nodes` (set of resolved strings)
- `words` (bag-of-words over node text)

Graph-property metrics:
- `targets coverage` / `predictions coverage`: vocabulary of graph words divided by the input-document vocabulary, after `split_and_clean_token` (`[^a-zA-Z0-9]+` → space, lowercased).
- Feature and relation coverage reported separately.
- `targets graph depth` (mean branch depth), `targets relation count`, relation mean length, and the 99th percentile of relation length.

Consequences of computing the metric this way:

- **Type-blind edges.** IoU ignores edge type. A predicted `hyponym` where the teacher had `meronym` scores as correct.
- **String-keyed matching.** Duplicate feature strings under the same parent collapse in the set. One wrong token in a feature span also breaks every edge touching that node, including every relation string that references it.
- **No partial credit.** A one-word span-boundary or lemma difference gives zero credit for that node and all its relation edges. This makes 0.653 a harsh, lower-bound style number.

---

## 2. Lineage

### 2a. Björkqvist & Kallio, "Building a Graph-Based Patent Search Engine", SIGIR 2023, pp. 3300–3304

doi 10.1145/3539618.3591842 (https://dl.acm.org/doi/10.1145/3539618.3591842)

- **Access.** The ACM page returned 403. Semantic Scholar marks the paper closed access with no OA PDF; it confirms the authors, venue, year 2023, and 18 citations (https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145/3539618.3591842). The alphaXiv title lookup resolved to the 2025 paper, not this one. I could not read the full text, so the items below rest on its abstract and on later papers describing it.
- **Graph construction (from the abstract).** Each patent document is converted to a graph "that describes the parts of the invention and the relations between the parts".
- **Model and training.** A GNN trained on "novelty citation data from patent office search reports", framed as emulating a professional examiner.
- **Model detail (from the 2025 paper).** The GNN was a Tree-LSTM (Tai et al. 2015), trained for dense retrieval on examiner citations, with a 600-dim output and 20M parameters.
- **Origin of the parser.** The rule parser in 2610.01553 comes from this paper: spaCy linguistic analysis plus hand-written rules keyed on "comprising, connecting, containing". It has been in production for 5+ years and processed more than 150M documents.
- **Results.** I found no numbers from the 2023 paper itself; I could not read it.

### 2b. Daniell, Buzhinsky & Björkqvist, "Efficient Patent Searching Using Graph Transformers", PatentSemTech'25

arXiv 2508.10496 (https://arxiv.org/abs/2508.10496); CEUR Vol-4062 paper 5 (https://ceur-ws.org/Vol-4062/paper5.pdf); CC BY 4.0. Not in our seen list.

**Graph schema.** This paper states the schema most explicitly:
- Nodes are either "key feature of the invention" or "a text snippet indicating a relationship".
- Hierarchical edges are "part-of (meronym) or example-of (hyponym)". Functional edges link features "to describe how they interoperate".
- Three graphs are built per document:
  - **first claim graph**
  - **all claims graph**
  - **description graph** (claims plus full description)

**Model.**
1. A BPE tokenizer with FastText-pretrained embeddings feeds SWEM (mean+max pooling) per node.
2. A sparse Graph Transformer follows, with attention only over graph edges, QK-norm, Pre-LN and GEGLU.
3. Learned node-importance pooling, then a dense-gated MoE reduces the output from 2048 to 150 dimensions.

**Training signal.**
- Examiner citations in categories X (novelty-destroying), Y (obvious in combination) and A (relevant background), with a different triplet-loss margin per category.
- Scale: about 31.7M citations from about 8.7M applications and 14.2M cited documents, across more than 40 jurisdictions; about 90% are US/EP/WO/JP/CN.
- Query side is the first-claim graph; candidate side is the description graph.
- Augmentations: "trivial citations" (a patent's own claim paired with its description), graph-type swapping, and node dropout.
- Online hard-negative mining with IPC-grouped batches of about 2,100 anchors.
- Splits are family-disjoint.

**Results.** Test set of about 96k queries against about 161k candidates, scored as X-citation Recall@3 / nDCG@150:

| Model | Recall@3 | nDCG@150 |
|---|---|---|
| Graph Transformer, base | 0.4046 | 0.5564 |
| Graph Transformer, 150-d | 0.3861 | — |
| Tree-LSTM, retrained on the same data | 0.3151 | — |
| PaECTER | 0.2798 | — |
| Stella | 0.2734 | — |
| KaLM | 0.2211 | — |
| GTE-ModernBERT | 0.2003 | — |
| BM25 | 0.1866 | — |

The authors acknowledge the comparison is weak: the general-purpose embedders were not fine-tuned on patents, and no cross-encoder reranker was tested.

### 2c. The anchor paper (2610.01553): what it adds on top

- **Scope.** It replaces only the parser; the schema and the downstream Graph Transformer are unchanged.
- **Format lock.** The parser must emit graphs "structurally identical to rule-based output" so they can be A/B tested in production (§3.1).
- **Different eval split.** The downstream eval here is 90,082 queries against 168,809 documents, with X and Y citations both counted. So 0.4163 here is not directly comparable to 0.4046 in 2b.

### 2d. Other IPRally / Björkqvist / Kallio publications

- alphaXiv `get_researcher_papers` found no indexed researcher for "Sebastian Björkqvist", "Juho Kallio" or "Igor Buzhinsky".
- Web search turned up only the three papers above, plus company and press pages: TechCrunch 2023 (https://techcrunch.com/2023/03/21/iprally-a-patent-search-engine-powered-by-explainable-ai-raises-10-8m) and the Google Cloud customer story (https://cloud.google.com/customers/iprally).
- I found no further peer-reviewed invention-graph papers. PatentSemTech invites extended versions to *World Patent Information*, but I found no WPI article by these authors.

---

## 3. Bearing on beep-effect

### What the repo models today

Located via `graft ask "patent claim schema" --source` and `graft grep "Claim" --in packages/`, then the source files themselves.

**`@beep/law-practice-domain` / `values/PatentDocument/PatentDocument.model.ts`.** Shipped by the patent-document-schema goal (PR #867, now `completed-retained`; see `goals/patent-document-schema/README.md`).

- **`PatentClaim`** is a tagged union of `independent` and `dependent`. Each case carries `claimNumber`, `claimText`, `preamble`, `transition` and `body`.
  - `transition` is a `PatentClaimTransition` `LiteralKit`: "comprising", "consisting of", "consisting essentially of", "including", "having", "wherein".
  - `body` is a single `S.NonEmptyString`.
  - The dependent case adds `claimReferences: S.NonEmptyArray(PosInt)`, aligned with WIPO ST.96 ClaimReference.
- **`PatentClaims`** validates the claim-to-claim dependency DAG and reports issues through the `PatentClaimDependencyIssue` union: `missing-parent`, forward reference, self reference, cycle, duplicate, discontinuous.
- **`PatentApplicationDocument`** holds the 13 ordered sections with `sourceStart` / `sourceEnd` offsets plus the validated claims.

**`@beep/law-practice-use-cases` / `PatentClaimCandidate`.** Maps a `PatentClaim` to an epistemic `CandidateClaim` plus a character-exact evidence span. If the claim text can no longer be found in the source, it fails rather than guessing.

**`@beep/law-practice-domain` / `entities/Distinction`.** A distinction overcoming a rejection. Its only kind is `missing_limitation`, with `limitation: LawPracticeText`, a free string such as "a hinge coupling the lid to the base".

**`KgNodeKind`** is the closed set `client | docket_family | docket | application | patent | document | email_archive`. It has no technical-feature or element node kinds.

### Side-by-side

| Aspect | Our claim model | IPRally invention graph |
|---|---|---|
| Unit | Claim (numbered) | Feature span / relation phrase |
| Structure | Claim-to-claim dependency DAG | Feature tree (part-of, example-of, method) plus relation DAG via `NodeRef` |
| Inside a claim | `preamble` / `transition` / `body` (body is opaque text) | Body broken into features and functional relations |
| Legal semantics | Transition phrase kept (open vs closed claim scope) | None; "comprising" is just a cue for a part-of edge |
| Grounding | Character-exact offsets, fail-closed | None in the JSON; token ids only in the CSV |
| Scope | One application | Claims, all claims, or full description, any document |
| Output | Typed, validated, Effect Schema | Python pydantic, lowercased, possibly lemmatized |

The two models sit at different levels and overlap very little. Ours is the legal skeleton: claim numbering, dependency, scope-setting transitions. Theirs is the technical content inside a claim body. Neither replaces the other.

### What the paper establishes vs what we propose

**Established by the paper and its repo:**

- A feature-hierarchy-plus-relations graph, fed to a Graph Transformer trained on examiner citations, beats truncated dense retrievers on X/Y-citation Recall@3 at about 90k-query scale, in IPRally's own setup.
- Such graphs can be extracted from claims and long descriptions by a CPU-servable biaffine model distilled from rules.
- A concrete, MIT-licensed JSON schema and a 10k-document (teacher-labelled) sample are public.

**Our proposal (not tested anywhere):**

1. **Add a claim-element layer before any graph work.** This is the smallest useful step.
   - Decompose `PatentClaim.body` into an ordered list of `ClaimElement`s. Each element carries `elementId`, `text` and `sourceStart` / `sourceEnd` (char-exact, same invariant as `PatentClaimCandidate`), plus an optional `parentElementId`.
   - This is the classic limitation list behind claim charts.
   - Once it exists, `Distinction.missing_limitation` can reference an element instead of free text.
   - Design order per repo law: a schema in `law-practice/domain`, then a `Context.Service` "ClaimDecomposer" contract, then implementation.
2. **Add an `InventionGraph` value schema alongside `PatentClaim`, never inside it.** It should be bidirectionally convertible to IPRally's JSON, so their eval tool and the public data stay usable.
   - `FeatureNode`: `id`, `text`, `span`, and `kind` as a `LiteralKit(["normal","meronym","hyponym","method"])`. Unlike their JSON, we keep the edge type.
   - `RelationNode`: `parts` as a tagged union `ref | text`, plus `span`.
   - Recursion via `S.suspend`; `HashMap` for the node index.
   - Each element should record its producer (rule, neural, LLM or human) in the epistemic layer, so a machine-extracted element is a `CandidateClaim` with an `EvidenceSpan`, not ground truth.
3. **RDF projection (Oxigraph).**
   - Feature hierarchy edges become `partOf` / `exampleOf` predicates.
   - Relations become n-ary reified nodes. Their ordered parts do not fit a single triple.
   - Shape constraints in SHACL (the repo already has `drivers/shacl`): one hierarchical parent per feature, refs resolve, spans lie inside the claims section.
   - This is where neuro-symbolic checks become cheap. An example query: "every element of claim 1 has at least one mapped passage in reference D1".

**Where an invention graph would help, in order of payoff for a solo US practitioner:**

1. **Office-action response claim charts.** Element-by-element mapping of the examiner's cited passages against claim elements. A missing mapping is a candidate `missing_limitation` distinction. Here the graph's job is decomposition, not retrieval.
2. **Drafting QA.**
   - Every feature introduced in the claims ("a deceleration pool") should have description support.
   - Every relation endpoint should be an introduced feature, which is the antecedent-basis check, ours to build (§112(b)).
   - Dependent-claim features should hang off a feature in the parent.
   - All of these are graph-integrity checks of the kind the existing `PatentClaims` dependency validation already does at claim level.
3. **IDS and duty of candor.** Graph-to-graph similarity between our claims and references we know of, to triage what must be cited. This is weaker: it is a recall aid, not a materiality judgment.
4. **Prior-art search.** The paper's actual use case. Realistically we would consume a service (IPRally or others) rather than train a Graph Transformer on 31.7M citations, which we lack. A local graph is still useful as a structured query and as a reranking or explanation layer over results from any engine.

**Practical routes to a parser:**

- **(a) LLM extraction into our schema.** Affordable at our volume: one matter's claims and a few references, not 150M documents. The paper's cost argument does not apply to us.
- **(b) Their released 5k+5k teacher graphs as few-shot exemplars and a regression set.**
- **(c) Score our extractor with their `whole graph iou`**, keeping in mind that it rewards agreement with their teacher.

There is no released neural-parser checkpoint, only the eval toolkit.

---

## 4. Critical read: weaknesses and threats to validity

1. **The intrinsic metric only measures teacher agreement.**
   - 0.653 IoU says how closely the student copies the rule parser, not how right it is. Being "beyond the teacher" lowers IoU by construction.
   - The metric is type-blind and string-exact (§1), so it mixes span-boundary noise, lemma noise and real structural errors.
   - IoU@90 is only 0.142, so most documents differ materially from the teacher, in unknown proportions of better and worse.
2. **The lemmatized-vs-extractive mismatch biases the metric down.** The paper admits it (§4.1) but never quantifies it, for example by lemmatizing student output before scoring. The released toolkit offers no normalization, so the magnitude can't be checked from the repo either.
3. **The effect sizes are small.**
   - Claims config: +0.0020 absolute (0.4163→0.4183), one-sided McNemar p=0.04.
   - Descriptions config: +0.0037 (p<0.001), measured on a 3M-document re-parsed corpus subset, not the full index.
   - The abstract's "0.5% / 1.1%" are relative gains. With n≈90k, small gaps reach significance. Whether 0.2 points of Recall@3 matter in practice is not shown.
   - There are no confidence intervals, no seed variance, and no evidence that the Graph Transformer was retrained on neural graphs. It appears to have been trained on rule graphs, which could understate or distort the result.
4. **The chemical subset does not reach significance** (p=0.42 claims, p=0.14 descriptions; n=11,698), even though the qualitative showcase (Fig. 5) is chemical.
   - The paper's explanation ("too small") is a guess. The difference is +0.0009 on claims.
   - The paper also concedes Markush structures "remain difficult".
   - The showcase's own output has artifacts: a "weight% wt% ) : C 0.030" node, and `<` signs lost from ranges such as "C < 0.030". These would hurt any legal use where numeric limits matter.
5. **The corpus is proprietary and the evaluation can't be reproduced.**
   - The citation pairs, 168k-document index, Graph Transformer weights and neural-parser weights are not released. Only the intrinsic eval set and toolkit are.
   - Both the gold graphs and the training labels come from IPRally's closed parser, so third parties can reproduce IoU but not the downstream claim.
6. **Multiple test conditions.** Window size (Table 6), checkpoint choice by validation IoU, and the regex post-filter for jargon such as "according to claim 1" were all tuned on internal data. The window-size table uses a different query type (all-claims concatenation, Recall@3≈0.47), so it doesn't line up with Table 3.
7. **Transfer to US prosecution practice is assumed, not shown.**
   - Ground truth is X/Y categories, an EPO / PCT search-report convention. US examiners' 102/103 rejections are not natively labelled X/Y, so how US citations were categorized is unstated.
   - The 2025 paper says about 90% of citations come from US/EP/WO/JP/CN, but gives no per-office breakdown, and the 2026 paper doesn't report US-only recall.
   - The training mix is 60% US with 20% machine-translated Chinese, which adds translation noise.
   - Examiner citations are a biased proxy: they show what one examiner found, not all relevant art. Recall@3 against them understates true recall and favours models that imitate examiner search habits.
   - None of this says anything about claim construction, 112(f) means-plus-function, element-level mapping or obviousness reasoning. The graph is a retrieval feature, not a legal analysis.
8. **Schema expressiveness, for a legal use case.**
   - The schema has no claim-scope semantics: open vs closed transitions, "consisting essentially of", negative limitations, numeric ranges as typed values, or Markush groups.
   - Relations are untyped text snippets.
   - Every feature has exactly one hierarchical parent. A component that is "part of" two assemblies has to be duplicated or relegated to a relation.
   - For claim charting and §112 checks we would need more typing than IPRally does.
9. **Undisclosed release questions.** Whether the released eval inputs are claims or full texts (the `patent_meta.csv` column descriptions say claims), and whether the released JSON is pre- or post-lemmatization, can only be settled by opening the tarballs. I have not done that.

---

### Sources

- Anchor paper: https://arxiv.org/abs/2610.01553 · https://www.alphaxiv.org/abs/2610.01553 · VoR https://doi.org/10.1007/978-3-032-37682-4_31
- Repo: https://github.com/iprally/invention_graph_eval (files: `LICENSE`, `README.md`, `invention_graph_eval/graph_model.py`, `graph_builder.py`, `metrics.py`, `human_readable.py`, `tests/test_data_validation.py`)
- Graph Transformers (PatentSemTech'25): https://arxiv.org/abs/2508.10496 · https://ceur-ws.org/Vol-4062/paper5.pdf
- SIGIR 2023 metadata: https://dl.acm.org/doi/10.1145/3539618.3591842 · https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145/3539618.3591842 · https://unpaywall.org/10.1145%2F3539618.3591842
- Company context: https://techcrunch.com/2023/03/21/iprally-a-patent-search-engine-powered-by-explainable-ai-raises-10-8m · https://cloud.google.com/customers/iprally
- beep-effect files read: `goals/patent-document-schema/README.md`; `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts`; `packages/law-practice/use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts` (via graft summary); `packages/law-practice/domain/src/entities/Distinction/Distinction.{model,values}.ts`; `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts`

New arXiv ID found that is not in the seen list: **2508.10496** (lineage paper, reported above as lineage, not as a sweep candidate).

graft saved about 817,500 tokens (~$0.67) this turn.
