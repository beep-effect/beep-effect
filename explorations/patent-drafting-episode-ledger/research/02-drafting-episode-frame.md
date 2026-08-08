# Research Lane B — Bounded Public-Source Grounding (Drafting-Episode Frame)

<!--
Stage 1 artifact. Lane B of the 2026-08-06 research-depth decision
(`../DECISIONS.md`). Two frames only — (a) the written-description/new-matter
legal frame and (b) the episode-memory/retrieval research frame. Nothing here
reopens remo2/remo3, and nothing here amends a composed goal SPEC.
-->

**Date:** 2026-08-06
**Lane:** B (bounded public-source grounding)
**Scope authority:** [`../DECISIONS.md`](../DECISIONS.md) § "2026-08-06 — research depth"
**Binding boundaries respected, never re-litigated:** remo2 (rows-first
`PracticeKgQuery`; lineage only via disposable in-memory `@beep/rdf` sessions
through the bounded `SparqlQueryService`; no persistent graph store; no
projection becomes authority) and remo3 (`DraftingEpisode` ledgers are
law-practice product records — repo-native, authoritative, append-only;
operator dev-memory is operator-level only and may carry at most a lossy
rebuildable projection with recent-raw-episode fallback). The 2026-08-06
operator-memory role change from Cognee to basic-memory + codegraph leaves the
operator/product boundary unchanged, so every "memory engine" statement below
is engine-agnostic.

**Confidentiality:** no client or pre-publication patent material is involved.
Every source below is public statutory text, public USPTO guidance, or a
public paper. Repo claims cite `path:line`; web claims cite URL + access date.

**Citation discipline used here.** A claim marked **[fetched]** was verified by
opening the primary source during this lane on the stated access date. A claim
marked **[distillate]** is carried from the parent campaign's on-disk mined
distillate with its internal page/section cite, and the primary source's public
URL is recorded but the specific figure was not re-read from the primary during
this lane. Failures are in § 12, never silently substituted.

---

## 1. Legal frame (a) — the never-compute boundary for written description and new matter

### 1.1 The operative statutory text

**35 U.S.C. § 112(a) — In General** [fetched 2026-08-06,
`https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title35-section112&num=0&edition=prelim`]:

> "The specification shall contain a written description of the invention, and
> of the manner and process of making and using it, in such full, clear,
> concise, and exact terms as to enable any person skilled in the art to which
> it pertains, or with which it is most nearly connected, to make and use the
> same, and shall set forth the best mode contemplated by the inventor or joint
> inventor of carrying out the invention."

**35 U.S.C. § 112(d) — Reference in Dependent Forms** [fetched, same URL] — the
statutory basis for dependency closure (ADHD-2):

> "Subject to subsection (e), a claim in dependent form shall contain a
> reference to a claim previously set forth and then specify a further
> limitation of the subject matter claimed. A claim in dependent form shall be
> construed to incorporate by reference all the limitations of the claim to
> which it refers."

**35 U.S.C. § 112(e) — Reference in Multiple Dependent Form** [fetched, same
URL]:

> "A multiple dependent claim shall be construed to incorporate by reference
> all the limitations of the particular claim in relation to which it is being
> considered."

**35 U.S.C. § 132(a)** [fetched 2026-08-06,
`https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title35-section132&num=0&edition=prelim`;
reproduced identically in MPEP § 608.04]:

> "No amendment shall introduce new matter into the disclosure of the
> invention."

### 1.2 What the exact-span/anchor computation may decide

Given a claim limitation and a source-versioned description, an anchor engine
can decide exactly one class of question: **does this character span exist,
verbatim, in this version of this document?** That is a lexical/positional fact.
Everything the § 112(a) and § 132 apparatus actually turns on is, by the
Office's own words, a different kind of question.

### 1.3 What it may NEVER decide — proved two-sided from the primary sources

**MPEP § 2163 [R-01.2024]** (fetched 2026-08-06,
`https://www.uspto.gov/web/offices/pac/mpep/s2163.html`) states the governing
character of the inquiry:

> "Compliance with the written description requirement is a question of fact
> which must be resolved on a case-by-case basis." (MPEP § 2163, subsection I,
> citing *Vas-Cath, Inc. v. Mahurkar*, 935 F.2d at 1563, 19 USPQ2d at 1116
> (Fed. Cir. 1991))

A question of fact resolved case by case is not a string comparison. The two
halves of the never-compute boundary follow directly:

**(i) An exact anchor is NOT NECESSARY — support can exist with zero matching
span.** Three independent MPEP passages establish this:

> "The subject matter of the claim need not be described literally (i.e., using
> the same terms or *in haec verba*) in order for the disclosure to satisfy the
> description requirement." (MPEP § 2163.02 [R-07.2022]) [fetched]

> "While there is no *in haec verba* requirement, newly added claims or claim
> limitations must be supported in the specification through **express,
> implicit, or inherent** disclosure." (MPEP § 2163 [R-01.2024], subsection I.B
> "New or Amended Claims") [fetched; emphasis added]

> "By disclosing in a patent application a device that inherently performs a
> function or has a property, operates according to a theory or has an
> advantage, a patent application necessarily discloses that function, theory
> or advantage, **even though it says nothing explicit concerning it**. The
> application may later be amended to recite the function, theory or advantage
> without introducing prohibited new matter." (MPEP § 2163.07(a) [R-07.2022],
> citing *In re Reynolds*, *In re Smythe*, and *Yeda Research and Dev. Co. v.
> Abbott GMBH & Co.*, 837 F.3d 1341 (Fed. Cir. 2016)) [fetched; emphasis added]

MPEP § 2163.07(a) is the decisive case for this wedge: the specification "says
nothing explicit" about the inherent property, so an anchor engine returns
**zero spans**, and the law nevertheless finds written-description support. An
`Unsupported` verdict computed from anchor absence would be legally wrong here
and would suppress a legitimate amendment.

**(ii) An exact anchor is NOT SUFFICIENT — support can fail with a perfect
verbatim match.** MPEP § 2163.03, subsection V ("ORIGINAL CLAIM NOT SUFFICIENTLY
DESCRIBED") [fetched]:

> "The written description requirement is not necessarily met when the claim
> language appears *in ipsis verbis* in the specification. 'Even if a claim is
> supported by the specification, the language of the specification, to the
> extent possible, must describe the claimed invention so that one skilled in
> the art can recognize what is claimed. The appearance of mere indistinct
> words in a specification or a claim, even an original claim, does not
> necessarily satisfy that requirement.'" (quoting *Enzo Biochem, Inc. v.
> Gen-Probe, Inc.*, 323 F.3d 956, 968, 63 USPQ2d 1609, 1616 (Fed. Cir. 2002))

**Boundary language for the wedge (both halves together):** exact-span/anchor
fidelity is neither necessary nor sufficient for written-description support.
It is therefore not a truth-functional input to a support verdict at all — it is
*evidence presented to an attorney*. `ClaimLimitationSupport` may compute
`AnchorPresent | AnchorAbsent` and may compute a dependency-closure traversal;
it may never compute `Supported`, `Unsupported`, `Ambiguous`, or
`CandidateNewMatter` as a legal conclusion. Those four are attorney
dispositions.

**Terminology equivalence is expressly excluded from the anchor engine.**
The possession test is stated as:

> "An applicant shows that the inventor was in possession of the claimed
> invention by describing the claimed invention with all of its limitations."
> (MPEP § 2163, subsection II.A.1, citing *Lockwood v. American Airlines,
> Inc.*, 107 F.3d at 1572, 41 USPQ2d at 1966) [fetched]

and the standard as:

> "does the description clearly allow persons of ordinary skill in the art to
> recognize that he or she invented what is claimed" (MPEP § 2163.02, quoting
> *In re Gosteli*, 872 F.2d 1008, 1012 (Fed. Cir. 1989)) [fetched]

Both are indexed to *a person of ordinary skill in the art*, not to a string
index. Judging whether "fastener" and "threaded member" are the same limitation
is a POSITA judgment; nothing in the retrieval or anchor stack may resolve it.

### 1.4 Independent and dependent claims are evaluated separately (T4-F1)

Two independent authorities converge:

- **MPEP § 2163, subsection II.A.1** [fetched]: "Claim construction is an
  essential part of the examination process. **Each claim must be separately
  analyzed** and given its broadest reasonable interpretation in light of and
  consistent with the written description." (emphasis added)
- **35 U.S.C. § 112(d)** [fetched]: a dependent claim "shall be construed to
  incorporate by reference all the limitations of the claim to which it refers."

Read together these give the wedge its exact gate shape: the unit of support
analysis is *the claim as a whole* (per-claim, separately), and the limitation
set of a dependent claim is the *closure* of its own added limitations plus
every limitation of its antecedent chain. A support set that evaluated only the
literally-recited text of a dependent claim would under-scope the analysis by
construction. **Dependency closure is therefore not a nicety of the gate — it
is the statutory construction rule** (ADHD-2's "dependency closure is part of
the gate," now grounded in § 112(d) rather than only in the play).

Multiple dependent claims add a further wrinkle: § 112(e) says the construction
is "in relation to which it is being considered" — i.e., one multiple-dependent
claim yields *N* distinct limitation closures, one per referenced parent. A
support model with a single closure per claim id is under-specified for
multiple dependent form.

Corroborating research evidence for separating the two populations: the
description-to-claims study reports that "LLMs can produce high-quality first
independent claims, but their performances markedly decrease for subsequent
dependent claims" (arXiv:2406.19465; published NAACL Findings 2025)
[fetched abstract + PDF, § 8 below], and the distillate records first-claim vs
remaining-claim ROUGE-L falling 59.24 → 42.58 for `Llama-3-FT`
(`../../legal-patent-kg-deepening/research/mined/P027.md:55`) [distillate].
Note the confound the same distillate flags: "a description may quote the
independent claim verbatim, so strong first-claim performance can be extraction
rather than drafting competence" (`P027.md:70`). That confound is *also* an
argument for separate evaluation.

### 1.5 New matter: the objection/rejection split (T4-F1, amendment lane)

**MPEP § 608.04 [R-10.2019]** [fetched 2026-08-06,
`https://www.uspto.gov/web/offices/pac/mpep/s608.html`]:

> "While amendments to the specification and claims involving new matter are
> ordinarily entered, such matter (i.e., subject matter not present in the
> specification, claims, or drawings on the application filing date) is
> required to be canceled from the descriptive portion of the specification,
> and the claims affected are rejected under 35 U.S.C. 112(a)."

> "When new matter is introduced into the specification, the amendment should
> be objected to under 35 U.S.C. 132 (35 U.S.C. 251 if a reissue application)
> and a requirement made to cancel the new matter. **The subject matter which is
> considered to be new matter must be clearly identified by the examiner.**"
> (emphasis added)

**MPEP § 608.04(a) [R-10.2019]** [fetched] — new matter is not only addition:

> "New matter includes not only the addition of wholly unsupported subject
> matter, but may also include adding specific percentages or compounds after a
> broader original disclosure, **or even the omission of a step from a
> method**." (citing *In re Wertheim*, 541 F.2d 257 (CCPA 1976); emphasis added)

**MPEP § 608.04(c) [R-11.2013]** [fetched] — the review path differs by locus:

> "Where the new matter is confined to amendments to the specification, review
> of the examiner's requirement for cancelation is by way of petition. But
> where the alleged new matter is introduced into or affects the claims, thus
> necessitating their rejection on this ground, the question becomes an
> appealable one."

**MPEP § 2163.06 [R-07.2022]** [fetched] ties the two together and names the
symmetry that makes the anchor engine safe *as evidence*:

> "information contained in any one of the specification, claims or drawings of
> the application as filed may be added to any other part of the application
> without introducing new matter."

**Boundary language for the wedge.** Three consequences bind the drafting
episode:

1. *New matter is a diff against the as-filed disclosure*, not a diff against
   the latest draft. The episode ledger must therefore pin the **as-filed**
   document version distinctly from the working version; a support anchor
   resolved against the wrong version answers the wrong legal question.
2. *Omission can be new matter.* A support model that only checks "is each
   recited limitation anchored" cannot detect the § 608.04(a) omission case at
   all. The gate must not claim new-matter coverage it does not have.
3. *New matter has two distinct dispositions* — objection (specification, § 132,
   petitionable) and rejection (claims, § 112(a), appealable). A single boolean
   `CandidateNewMatter` flag flattens a distinction the Office itself keeps.
   If the disposition vocabulary carries a locus (`Specification | Claim`), it
   stays faithful; if it does not, the gate must say so rather than imply a
   completeness it lacks.

The Office's own instruction — "must be clearly identified by the examiner" —
is the exact analogue of the append-only attorney disposition: the *identity*
of the disputed matter is recorded evidence; the *holding* is a human act.

---

## 2. Raw episodes as audit authority, projections as lossy, and the fallback trigger (T3-F10)

**Primary source:** Rasmussen, Jain, Sinha, Shah, Chan, Rasmussen. *Zep: A
Temporal Knowledge Graph Architecture for Agent Memory.* arXiv:2501.13956v1,
submitted 20 January 2025. [fetched 2026-08-06 — abstract page
`https://arxiv.org/abs/2501.13956`, full PDF `https://arxiv.org/pdf/2501.13956`]

### 2.1 Exact boundary language the paper supports

The three-tier separation is explicit and load-bearing [fetched, § 2.1]:

> "Episode Subgraph *G_e*: Episodic nodes (episodes), *n_i ∈ N_e*, contain raw
> input data in the form of messages, text, or JSON. **Episodes serve as a
> non-lossy data store from which semantic entities and relations are
> extracted.**" (emphasis added)

and the derivation is bidirectionally traceable [fetched, § 2.2]:

> "Episodes and their derived semantic edges maintain bidirectional indices that
> track the relationships between edges and their source episodes. This design
> reinforces the non-lossy nature of Graphiti's episodic subgraph by enabling
> both forward and backward traversal: semantic artifacts can be traced to their
> sources for citation or quotation, while episodes can quickly retrieve their
> relevant entities and facts."

**Usable boundary language:** *raw episodes are the non-lossy store; entities,
semantic edges, summaries, and communities are extractions from them, and every
extraction retains a back-link to its source episode.* That is precisely the
authority/projection split remo3 fixes at product level — and the paper
supports the *architecture*, which is what the wedge borrows.

### 2.2 The critical caveat the paper states about its own audit claim

Immediately after the traversal passage [fetched, § 2.2]:

> "While these connections are not directly examined in this paper's
> experiments, they will be explored in future work."

**This is a hard boundary.** The episode→fact citation traversal — the exact
property the wedge calls "raw episodes as audit authority" — is **asserted
architecturally and never evaluated** in the cited benchmark. The wedge may
cite Zep as *architectural precedent for the split*; it may not cite Zep as
*evidence that episode-backed audit works*. In this repo the audit property has
to be earned by a delete-and-rebuild proof over the `DraftingEpisode` ledger,
not inherited.

### 2.3 What the benchmark actually showed about the regression (the fallback trigger)

The LongMemEval per-question-type table, verified line-by-line against the PDF
[fetched, § 5.2 table]:

| Question type | Model | Full-context | Zep | Delta |
|---|---|---:|---:|---|
| single-session-preference | gpt-4o-mini | 30.0% | 53.3% | 77.7% ↑ |
| **single-session-assistant** | gpt-4o-mini | **81.8%** | **75.0%** | **9.06% ↓** |
| temporal-reasoning | gpt-4o-mini | 36.5% | 54.1% | 48.2% ↑ |
| multi-session | gpt-4o-mini | 40.6% | 47.4% | 16.7% ↑ |
| **knowledge-update** | gpt-4o-mini | **76.9%** | **74.4%** | **3.36% ↓** |
| single-session-user | gpt-4o-mini | 81.4% | 92.9% | 14.1% ↑ |
| single-session-preference | gpt-4o | 20.0% | 56.7% | 184% ↑ |
| **single-session-assistant** | gpt-4o | **94.6%** | **80.4%** | **17.7% ↓** |
| temporal-reasoning | gpt-4o | 45.1% | 62.4% | 38.4% ↑ |
| multi-session | gpt-4o | 44.3% | 57.9% | 30.7% ↑ |
| knowledge-update | gpt-4o | 78.2% | 83.3% | 6.52% ↑ |

The authors' own reading [fetched, § 5.2]:

> "The decrease in performance for single-session-assistant questions — 17.7%
> for gpt-4o and 9.06% for gpt-4o-mini — represents a notable exception to
> Zep's otherwise consistent improvements, and suggest further research and
> engineering work is needed."

**Exact boundary language for the fallback trigger.** The regression is
*question-type-scoped and direction-specific*: graph-projected retrieval lost
to full raw context on **single-session-assistant** questions under both models
(and additionally on **knowledge-update** under gpt-4o-mini), while beating it
on every cross-session and temporal type. The honest statement of the trigger
is therefore:

> When the answerable evidence lies inside a single recent episode, projected
> retrieval can *underperform* simply reading the recent raw episodes; the
> fallback must fire on **recency/locality of the required evidence**, not on a
> confidence score, and must supply **raw episode tails**, not better summaries.

### 2.4 Three corrections to the nugget's wording

1. **"Short-horizon recall" is a gloss, not the paper's term.** The paper's
   category is `single-session-assistant`. The gloss is defensible (the
   question is answerable within one session) but the wedge should carry the
   benchmark's own label so the claim stays checkable.
2. **The nugget under-reports the regression surface.** There are **two**
   regressed cells for gpt-4o-mini (single-session-assistant *and*
   knowledge-update at 76.9% → 74.4%), not one. Knowledge-update regressing is
   directly relevant to a drafting ledger, where "the description changed since
   the last retrieval" is the dominant update pattern.
3. **The recent-raw fallback is a beep-side inference, not the paper's
   prescription.** The paper's only recent-episode mechanism is *seeding graph
   traversal*: "This functionality proves particularly valuable when using
   recent episodes as seeds for the breadth-first search, allowing the system to
   incorporate recently mentioned entities and relationships into the retrieved
   context" [fetched, § 3.1]. The paper prescribes **no remedy at all** for the
   regression — it says "further research and engineering work is needed." The
   recent-raw fallback is therefore an *unvalidated design response to a
   verified failure mode*. See § 10.

### 2.5 Reproducibility boundary carried forward

Zep is a vendor-authored v1 arXiv preprint evaluating the authors' own hosted
production system, with GPT-4o as the judge
(`../../legal-patent-kg-deepening/research/mined/P099.md:18,62,70`)
[distillate]. The absolute numbers are not independent evidence; the
*architecture* and the *direction of the regression* are the transferable parts.

---

## 3. Deterministic identity/hierarchy/scope/language/point-in-time resolution BEFORE ranking, and the per-answer policy disclosure (T3-F4)

**Primary sources:**
- de Martim, Hudson. *An Ontology-Driven Graph RAG for Legal Norms: A
  Structural, Temporal, and Deterministic Approach.* arXiv:2505.00039 (v5 HTML
  read). [fetched 2026-08-06, `https://arxiv.org/html/2505.00039v5`] Published
  as *"…: A Hierarchical, Temporal, and Deterministic Approach"*, JURIX 2025,
  Frontiers in Artificial Intelligence and Applications vol. 416, DOI
  `10.3233/FAIA251598`. [see § 11 drift note]
- de Martim, Hudson. *Beyond Probabilistic Similarity: Structural, Temporal,
  and Causal Limitations of Retrieval-Augmented Generation in the Legal Domain.*
  arXiv:2606.09724v1, submitted 8 June 2026. [fetched 2026-08-06,
  `https://arxiv.org/abs/2606.09724`]

### 3.1 Deterministic resolution precedes ranking — the exact ordering

The unified execution strategy is an ordered eight-step pipeline
[fetched, arXiv:2505.00039v5 § 4.4]:

> "1. canonicalization of structural, temporal and textual constraints;
> 2. scope resolution over the legal hierarchy (**with a declared membership
> policy**); 3. strategy selection (structure-first / span-first / time-first)
> by the planner; 4. **deterministic CTV selection according to a stated
> temporal policy** (e.g., SnapshotLast); 5. **scoped retrieval of Text Units
> (structural + temporal filters followed by vector/lexical ranking)**;
> 6. causal aggregation of Action nodes…; 7. provenance chain assembly (DAG of
> Actions) and 8. fact-grounded generation with **explicit disclosure of the
> policies and a machine-readable annex (JSON) containing the provenance trace
> and confidence scores**." (emphasis added)

Step 5 is the literal proof of the ordering claim: **structural + temporal
filters run first; vector/lexical ranking runs only over what survives them.**
Identity/hierarchy/scope/point-in-time are resolved deterministically *before*
any similarity score is computed. The point-in-time rule is stated exactly
[fetched, § 4.2]:

> `tv.valid_start ≤ t < coalesce(tv.valid_end, +∞)`

with an explicit tie-break policy when several versions fall in the interval,
and — the operative sentence for the annex — "**The policy is disclosed with the
answer.**"

Language resolution is present but weaker: the framework "naturally supports …
(iii) multilingual retrieval **with fallback policies**" [fetched, § 4.2
robustness notes]. Language fallback is named as a policy; its mechanics are not
specified.

### 3.2 The per-answer policy-disclosure fields, source-by-source

[fetched, arXiv:2505.00039v5 § 4.4]:

> "The planner records the chosen policies (**membership, temporal policy,
> retrieval *k*, etc.**) with every response to ensure auditability and
> reproducibility."

> "Fundamentally, **all answers generated by the system should explicitly state
> the temporal and membership policies used for that specific query and attach
> a machine-readable JSON provenance annex** when Action nodes are part of the
> result. These defaults should be configurable, and their disclosure is
> essential to preserve determinism and user trust."

Mapping the wedge's seven proposed `AnswerProvenanceAnnex` fields against what
the primary sources actually license:

| Annex field | Source status | Evidence |
|---|---|---|
| **temporal** | **Source-grounded** | "explicitly state the temporal … policies"; `SnapshotLast` named as the default [fetched] |
| **membership** | **Source-grounded** | "declared membership policy"; "snapshot-anchored membership" [fetched] |
| **retrieval** (k, similarity fn, embedding model+dim) | **Source-grounded** | "retrieval *k*"; operational defaults "Qwen-3 with 256 dimensions", "cosine similarity with *k* = 8" [fetched] |
| **language** | **Weakly source-grounded** | Only "multilingual retrieval with fallback policies" — named, not specified [fetched] |
| **fallback** | **Weakly source-grounded** | Same single sentence; no fallback-record schema in the paper [fetched] |
| **rejected-candidate** | **NOT in the source** | Zero occurrences of "rejected" in arXiv:2505.00039v5 [fetched, verified by search] |
| **incompleteness** | **NOT in the source** | Zero occurrences of "incomplete" in arXiv:2505.00039v5 [fetched, verified by search] |

**Correction to carry into align.** Four of the seven annex fields
(`language`, `fallback` partially, `rejected-candidate`, `incompleteness`) are
**net-new beep-side extensions**, not inherited from the SAT-Graph paper. Three
are fully grounded. This does not weaken the design — it relocates the burden:
the extensions need their own justification and their own fixtures.

The nearest public warrant for the `incompleteness` field is the companion
paper's insistence that a legal retriever must expose *what it could not
establish*: arXiv:2606.09724 derives "four architectural commitments … :
ontological primacy, event reification, bitemporal correctness, and
deterministic interaction protocols" [fetched, abstract] and its distillate
records the typed-failure posture — "expose typed failures — outside modeled
jurisdiction, no represented state, unresolved authority, or incomplete lineage
— rather than one generic low-confidence answer"
(`../../legal-patent-kg-deepening/research/mined/P078.md:79`) [distillate;
recorded there as a beep-relevance hook, i.e. an inference from the paper, not
a paper quote — see § 12].

### 3.3 What the determinism claim does NOT buy

The paper's own limits are explicit and must ride with the annex [fetched,
arXiv:2505.00039v5 § 5]:

> "The framework's determinism amplifies the advantages of structured data but
> also propagates upstream errors more visibly. Erroneous validity intervals or
> incorrect Action metadata will lead to [incorrect answers]"

and the evaluation is qualitative: a trace-based case study on the Brazilian
Federal Constitution with **no quantitative baseline comparison, no retrieval
benchmark, and no error analysis** (`P018.md:52-53`) [distillate, consistent
with the fetched § 5 text]. A disclosed policy makes an answer *checkable*; it
does not make it *correct*. The annex is an auditability artifact, never a
quality claim.

---

## 4. The inference-event reification claim, and why its retrieval gain remains a hypothesis (T3-F5)

**Primary source:** Kondo, Matsuoka, Yoshida, Yamasawa, Hisano. *Capturing
Legal Reasoning Paths from Facts to Law in Court Judgments using Knowledge
Graphs.* arXiv:2508.17340; published in *Proceedings of the 13th Knowledge
Capture Conference (K-CAP 2025)*, DOI `10.1145/3731443.3771354`. [fetched
2026-08-06 — `https://arxiv.org/abs/2508.17340`, full PDF
`https://arxiv.org/pdf/2508.17340`]

### 4.1 The reification claim, stated exactly

[fetched, § 2.1]:

> "Our approach treats these inferential steps as **first-class elements in the
> graph**, enabling downstream tasks such as a traceable legal search and
> fine-grained legal reasoning." (emphasis added)

The schema reifies `LegalApplication` as a node (subclassed from
`schema:Action`) with typed edges `appliesNorm : LegalApplication → LegalNorm`
and the fact linkage `Fact → LegalApplication`, so a reasoning step becomes an
addressable object with premises rather than an untyped text-to-text edge
(`P028.md:36-38`) [distillate]. Graph scale, verified against the paper's
tables [fetched, Tables 3-5]: 44,447 nodes / 51,296 edges; 10,552 Provision,
15,445 Norm, 8,957 Application, 11,199 Fact nodes; 18,814 Provision→Norm,
15,356 Norm→Application, 19,242 Fact→Application edges; density 2.59 × 10⁻⁵;
1,478 weakly connected components of diameter ≥ 2.

### 4.2 Why the retrieval gain is a hypothesis — verified directly

The paper's retrieval comparison is against **three non-graph baselines**
[fetched, § 3.3]:

> "For comparison, we implemented three baselines using GPT 4o. In the **GPT
> Simple** setting, the model receives only a single fact sentence…
> The **GPT With Context** baseline augments the input with a case overview…
> The **GPT With RAG** configuration incorporates RAG."

**The string "ablation" does not appear anywhere in the paper** [fetched,
verified by full-text search of the extracted PDF: zero matches]. There is no
arm in which the graph exists but `LegalApplication` is *not* reified — e.g. a
flat Fact→Provision graph, or Fact→Norm→Provision without the Application node.

**Exact boundary language:** the paper establishes that *a structured legal
knowledge graph beats flat RAG and bare-LLM baselines at provision retrieval
from facts*. It does **not** establish that *reifying the inference event* is
the cause of that gain. The measured contrast is `structure vs no structure`,
not `reified event vs unreified structure`. Any beep claim of the form
"reifying the drafting inference improves retrieval" is unsupported by this
source and must be labelled a hypothesis until an internal reification ablation
is run.

Two further couplings weaken causal attribution even for the structure claim:
the retrieval gold labels are themselves derived from the constructed LKG
(`P028.md:74`) [distillate], and the Fact-Masked protocol removes only the
query fact's own outgoing edges (`P028.md:33`) [distillate], leaving
same-judgment leakage paths unquantified.

---

## 5. Atomic normative rows, and why the anti-hub-prefilter result supports only a study fixture (T1-F10)

**Primary source:** Nanda, Marcos, Westermann, Schutz Veiga. *A Hohfeldian
Knowledge Base for LLM-Assisted Legal Information Retrieval in Marine
Biodiversity Law.* In *Legal Knowledge and Information Systems* (JURIX 2025,
Turin, 9-11 December 2025), Frontiers in Artificial Intelligence and
Applications vol. 416, pp. 318-323, DOI `10.3233/FAIA251604`, CC BY-NC 4.0.
[landing page + full abstract fetched 2026-08-06,
`https://ebooks.iospress.nl/doi/10.3233/FAIA251604`; **full text NOT retrieved
— see § 12**]

### 5.1 The atomic-row pattern

Verbatim abstract [fetched]:

> "Governance of marine genetic resources is fragmented across overlapping
> treaties, creating uncertainty about which obligations apply in specific
> situations. We address this by mapping treaty provisions into a normative
> structure based on Hohfeld's framework, the Hohfeld-Structured Normative
> Knowledge Base (HSNKB), and by constructing a dataset of **15 fact-pattern
> questions** with expert gold answers. We evaluate four recent large language
> models (LLMs) on retrieving rows that contain the relevant rules to answer the
> fact-pattern questions. The results indicate that reasoning LLMs achieved
> **modest precision and middling recall**. Hohfeldian representations help
> avoid false positives, but improving recall without degrading precision
> remains an open problem for cross-treaty retrieval." (emphasis added)

Row structure and scale from the on-disk distillate, with the distillate's own
page cites [distillate, `P002.md:36-41,81-83`]: 377 normative rows (193 BBNJ-A,
96 CBD, 88 NP); each row carries unique identifier, treaty, provision number,
actor-holder, legal position/action, actor-affected, and an expert-written
tripartite sentence; "Each row in the HSNKB represents a single operative
clause" (p. 320, sec. 3); multi-prescription provisions are split so each row
carries one dominant relation, "giv[ing] retrieval an atomic target."

**Usable boundary language:** *stable-identifier atomic rows make retrieval
inspectable — a retrieval result is a set of row ids an expert can check, not a
paraphrase.* That is the property the wedge's `NormativeRow` fixture borrows.

### 5.2 Why the anti-hub result supports only a study fixture

The distillate records the mechanism precisely [distillate, `P002.md:52-55,83`]:
actor-constrained retrieval (predict relevant actors → filter rows to those
actors → select rows) did not improve on full-scope retrieval — GPT-5 0.74/0.50/0.57
actor-constrained vs 0.77/0.53/0.59 full-scope; models retrieved 23.9-35.6
actors per question against 6.2 gold; and "**Actor-constrained filtering narrows
the search space but does not substantially improve retrieval performance**"
(p. 322, sec. 5). The stated cause is structural: "Actor filtering removes only
about 15% of rows because `Contracting Party` appears in every fact pattern and
dominates the KB."

**Exact boundary language.** The evidence base is **15 expert-authored questions
over 377 rows from three treaties in one legal subdomain**, with a single expert
supplying question-level gold and no inter-annotator validation
(`P002.md:61-64`) [distillate]. Under that N, the finding warrants exactly one
thing: **a study fixture that reproduces the negative result** — i.e. a
regression fixture asserting that a high-degree-actor prefilter does not become
a default retrieval gate — and nothing broader. It is **not** a general law
about hub prefiltering, and it must never be generalized to patent retrieval,
where the degree distribution of the analogous "hub" (e.g. an assignee, a CPC
class, a boilerplate limitation) is entirely unmeasured. The abstract's own
framing — "remains an open problem" — is the ceiling.

---

## 6. The replayable drafting-episode ledger contents, and "memory proposes precedents but never supplies current-disclosure support" (T4-F7)

**Primary sources:**
- Knappich, Hätty, Razniewski, Friedrich. *PAP2PAT: Benchmarking Outline-Guided
  Long-Text Patent Generation with Patent-Paper Pairs.* Findings of ACL 2025,
  pp. 9524-9554. [fetched 2026-08-06, `https://aclanthology.org/2025.findings-acl.496/`
  and PDF `https://aclanthology.org/2025.findings-acl.496.pdf`; preprint
  arXiv:2410.07009]
- Srinivas, Vaikunth, Runkana. *Towards Automated Patent Workflows:
  AI-Orchestrated Multi-Agent Framework for Intellectual Property Management and
  Analysis (PatExpert).* arXiv:2409.19006; Workshop on Open-World Agents,
  NeurIPS 2024. [fetched 2026-08-06, `https://arxiv.org/abs/2409.19006`]
- Jiang, Zhang, Nguyen, et al. *Can Large Language Models Generate High-quality
  Patent Claims?* arXiv:2406.19465; Findings of NAACL 2025. [fetched
  2026-08-06, `https://arxiv.org/abs/2406.19465` and PDF
  `https://aclanthology.org/2025.findings-naacl.70.pdf`]
- Ren, Ma, Luo. *Large Language Model for Patent Concept Generation*
  (**previously titled** *PatentGPT: A Large Language Model for Patent Drafting
  Using Knowledge-based Fine-tuning Method*), arXiv:2409.00092v3, accepted in
  *Advanced Engineering Informatics*. [fetched 2026-08-06,
  `https://arxiv.org/abs/2409.00092` — see § 11 drift note]

### 6.1 The ledger contents list, item by item, with its warrant

Assembling the T4-F7 list against what the sources actually establish:

| Ledger item | Warrant |
|---|---|
| **Matter + document versions** | § 1.5 above: new matter is a diff against the *as-filed* disclosure, so the version pin is a legal requirement, not a convenience (MPEP § 608.04(a), § 2163.06) [fetched] |
| **Outline (nodes + hierarchy)** | PAP2PAT's envisioned setting: "we envision a practical setting in which the attorney, given a paper, **provides an outline** for the patent. This outline acts as a flexible mechanism to control the document structure and content" [fetched, § 1] |
| **Section budgets** | "The input data provides the desired output length in characters per section" (PAP2PAT § 3.2) [distillate `P066.md:85`, phrase located in fetched PDF at line 235] |
| **Retrieval spans** | PAP2PAT COPGEN retrieves paper paragraphs by BM25 per outline chunk (`P066.md:28`) [distillate]; § 1.3 above makes the span the *evidence*, never the verdict |
| **Model configuration** | Required by the reproducibility posture of § 3.2 (embedding model + dim, similarity fn, *k*) [fetched, arXiv:2505.00039v5] |
| **Chunks** | COPGEN is chunk-based by construction; chunk count is the length-control knob (`P066.md:28-30`) [distillate] |
| **Plan / stage I/O** | PatExpert's four orchestration stages — task planning, expert selection, expert invocation, response generation (`P084.md:24`) [distillate] |
| **Validators** | AgentODRL's generate-validate-correct loop with SHACL (`P016.md:29-30`) [distillate]; see § 9 |
| **Attorney feedback** | § 1.3 above: the disposition *is* the legal act; PAP2PAT's own attorney study is the empirical form (`P066.md:55`) [distillate] |

### 6.2 "Memory proposes precedents but never supplies current-disclosure support"

This is the sharpest line in the wedge and it has a direct primary-source
warrant. The claim-generation paper's framing [fetched, arXiv:2406.19465 /
NAACL Findings 2025]: earlier work conditioned claim generation on *abstracts*,
"although abstracts intentionally omit details and **cannot legally add subject
matter beyond the description**" (`P027.md:14`) [distillate]. The paper
reframes the task as description-to-claims for exactly that reason and the
abstract reports "Generating claims based on patent descriptions outperforms
previous research relying on abstracts" [fetched].

Generalizing correctly: **if the abstract of the same patent cannot supply
support, then a fortiori no prior matter, no precedent draft, no attorney
style-memory, and no cross-matter projection can.** Only the current
description of the current matter, at a pinned version, can. The distillate's
own hook states the rule the wedge should adopt verbatim: "retain invention
terminology and feature-link decisions across drafting turns, but **reject
memory-derived limitations unless the current description provides an exact
support span**" (`P027.md:78`) [distillate].

Combine with § 1.3: memory may not supply support, **and** an exact span does
not by itself establish support. The two rules stack — memory proposes;
anchors evidence; the attorney decides. Nothing in the chain shortcuts to a
legal conclusion.

### 6.3 Replayability's real hazard, from the sources

PAP2PAT's benchmark outlines are LLM-generated from the *target* patents, which
"leak[s] target structure and summarized content that a real attorney must
create without that reference" (`P066.md:62`) [distillate]. The analogue for
this wedge is ADHD-3's own stated risk: a fixture can replay perfectly while
freezing nothing real. A ledger that replays only intake plumbing proves
schema mechanics, not drafting fidelity. **Boundary language:** replay
stability is a *schema* proof; it is not a *drafting* proof, and the two must
not be conflated in the packet's success criteria.

---

## 7. Outline / budget / retrieval / chunk / assembly traceability — WITHOUT claiming chunking or budgets cause quality (T4-F2)

**Primary source:** PAP2PAT, Findings of ACL 2025 [fetched, as § 6].

### 7.1 What is auditable

COPGEN makes five artifacts durable and inspectable per generated section:
the outline node, the section budget in characters, the BM25 retrieval query
and selected paper paragraphs, the generated chunk, and the concatenation/
de-duplication step that assembles them (`P066.md:28-30`) [distillate;
outline/budget phrases located in fetched PDF]. Every technical assertion in a
generated section can be traced to the paper paragraphs that were in its
context window. That is the whole of the traceability claim.

### 7.2 Why the causal claim is not licensed — the paper's own counter-evidence

The evidence runs *against* a simple "more structure ⇒ better output" story
[distillate `P066.md:50-54`, consistent with the fetched paper's results
section]:

- Length calibration raises surface metrics but **lowers factuality**: default
  COPGEN Qwen2-72B outputs 8.1k tokens at coverage 44.1 / factuality 62.5 /
  67.9; length-calibrated reaches 18.1k tokens, BERTScore 71.7, ROUGE-L 50.8,
  coverage 46.8 — and factuality *falls* to 59.7 / 65.3.
- "The length/coverage/factuality trade-off shows that matching reference
  length can amplify unsupported content" (`P066.md:68`).
- Fine-tuning "improves style by more than 20 points but lowers factuality by
  more than 10 points; standard similarity metrics reward the stylistic match
  and repetition" (`P066.md:54`). Fine-tuned Llama-3 8B emits 27.5k tokens with
  repetition rate 53.7 (`P066.md:53`).
- The paper's own conclusion [fetched, abstract]: "LLMs can effectively leverage
  information from the paper, but still struggle to provide the necessary level
  of detail. Finetuning leads to more patent-style language, but also to more
  hallucination."

And the attorney study is tiny: two AI patent attorneys, 15 evaluations over 10
samples, one technical field, no inter-rater or blinded comparison
(`P066.md:55,61`) [distillate]. Its finding is a *time* finding, not a *quality*
finding: "the attorneys saw substantial time savings in 8 cases" (§ 6, p. 9531)
[distillate `P066.md:86`; phrase located in fetched PDF at line 498]. The
attorneys named "insufficient non-limiting patent language and inadequate
enabling detail" as the two main obstacles (`P066.md:56`).

**Exact boundary language.** The chunk/outline/budget machinery is licensed as
a **control and audit surface**: it makes the drafting process reconstructable
and makes each section's evidence set inspectable. It is **not** licensed as a
quality mechanism. Section budgets in particular are a *length* control whose
measured effect on factuality is **negative**. A `DraftingOutline` /
`SectionBudget` schema in this repo therefore records what was done and with
what evidence — it must never be read, in docs or in tests, as an assertion
that the budget improved the draft.

Related, from the same distillate: "High DiscoScore does not establish
cross-section consistency, claim support, enablement, written description,
novelty, or prosecution fitness" (`P066.md:69`), and PAP2PAT generates only
descriptions — "legally central claims and their dependency on description
support are outside the task" (`P066.md:70`). The wedge's rung sits exactly in
the gap PAP2PAT declares out of scope.

---

## 8. Why reference overlap cannot accept a draft — the separate provenance-bearing gates (T4-F3)

**Primary sources:** arXiv:2406.19465 / NAACL Findings 2025 [fetched];
Kalyani/Mehta et al., *PATENTWRITER: A Benchmarking Study for Patent Drafting
with LLMs*, arXiv:2507.22387, submitted 30 July 2025 [fetched 2026-08-06,
`https://arxiv.org/abs/2507.22387`]; PAP2PAT [fetched]; PatExpert
[fetched].

### 8.1 The decisive dissociation

The claim-generation paper's expert rubric has exactly five axes, verified
against the published PDF [fetched, `2025.findings-naacl.70.pdf`, § 4 and
Table header at line 374-376]: **Feature Completeness**, **Conceptual
Clarity**, **Terminology Consistency**, **Correctness of Feature Linkage**,
**Overall Quality**.

The dissociation between overlap and expert judgment is direct
[distillate `P027.md:53-54`, consistent with the fetched paper]: GPT-4 earns
the best human ratings (completeness 5.4, clarity 6.3, terminology 7.4, feature
linkage 5.9, overall 6.0) while scoring **BLEU 15.73** — far below Llama-3-FT's
ROUGE-L 47.35 and BLEU-leading systems. The distillate's summary is exact:
"Human quality and reference similarity are distinct relations: GPT-4 is judged
best by experts despite low lexical-overlap scores" (`P027.md:42`).

PatentWriter independently makes overlap look *even less* diagnostic: across all
model/domain combinations BERTScore is ≥ 0.85 while BLEU ranges 0.04-0.19
(`P069.md:47`) [distillate] — a metric family that barely discriminates. And
generated abstracts *outscored the human originals* on a downstream subclass
classifier (0.59/0.55/0.59 vs 0.56/0.53/0.57, `P069.md:51-52`) [distillate],
which the distillate correctly reads as classifier preference, not superior
drafting. PatentWriter's own conclusion [distillate `P069.md:87-88`]:
"traditional NLP metrics alone are insufficient" (§ 4.6) and "Patent generation
should not be fully automated" (§ 6).

### 8.2 The gate list, and why each must be separate and provenance-bearing

T4-F3's eight gates, each with its source warrant:

1. **Support** — MPEP § 2163 possession/limitations test; anchor is evidence,
   attorney disposition is the verdict (§ 1.3) [fetched].
2. **Completeness** — expert axis "Feature Completeness"; measured separately
   from overlap and moves independently of it (`P027.md:56`: fine-tuning raises
   completeness 4.0 → 5.3) [distillate + fetched rubric].
3. **Clarity** — expert axis "Conceptual Clarity"; **moves in the opposite
   direction from another axis under the same intervention**: multi-task
   fine-tuning scores 5.4 overall vs 5.6 single-task *and lowers conceptual
   clarity from 5.8 to 4.9* (`P027.md:52`) [distillate]. A single aggregate
   score would have hidden this.
4. **Terminology** — expert axis "Terminology Consistency"; an
   entity-normalization constraint, not a similarity measure (`P027.md:37`).
5. **Dependency** — 35 U.S.C. § 112(d)/(e) closure (§ 1.4) [fetched]; a
   structural check no text metric performs.
6. **Feature linkage** — expert axis "Correctness of Feature Linkage"
   (`P027.md:38`).
7. **Repetition** — a *pathology* gate, not a quality gate: repetition rate
   53.7 with 29.3% of windows above 80 for fine-tuned Llama-3 8B, and removing
   repetition improved ROUGE-L by 6.8 points (`P066.md:53`) [distillate] —
   i.e. the similarity metric was *rewarding* the pathology until it was
   stripped.
8. **Attorney adjudication** — the terminal gate; § 1.3, plus PatentWriter's
   "should not be fully automated" and PAP2PAT's ethics statement, which
   "rejects full automation … but the pipeline has no technical safeguards
   enforcing professional oversight" (`P066.md:71`) [distillate]. The absent
   safeguard is precisely what a `RuntimeApprovalGate`-bound episode supplies.

**Exact boundary language.** Reference overlap measures *resemblance to one
historical drafting choice*. It cannot accept a draft because (a) it dissociates
from expert judgment in the measured direction (best-expert system, worst
overlap), (b) it actively rewards a known pathology (repetition), and (c) the
eight properties above move independently under the same intervention — so any
single scalar destroys the signal a gate needs. Each gate must therefore carry
its own provenance (which evidence, which version, which validator, which
human) rather than roll up.

One structural caution to carry: the claim-generation corpus keeps only granted
patents, creating "survivorship and drafting-quality bias; gold claims are not
necessarily optimal claim strategy" (`P027.md:67`) [distillate]. Granted text is
not a quality oracle.

---

## 9. Routing as a persisted fallible decision — candidate routes, rationale, stage I/O, validator results, retries, overrides (T4-F4)

**Primary sources:** Liu et al., *AgentODRL: A Large Language Model-based
Multi-agent System for ODRL Generation*, arXiv:2512.00602, submitted 29
November 2025, Renmin University of China [fetched 2026-08-06,
`https://arxiv.org/abs/2512.00602`]; PatExpert, arXiv:2409.19006 [fetched].

### 9.1 Routing is measurably fallible — the number that makes the case

AgentODRL's orchestrator classifies input complexity (Simple / Parallel /
Recursive) and selects one of three paths: Orchestrator→Generator;
Orchestrator→Splitter→Generator; Orchestrator→Rewriter→Splitter→Generator
(`P016.md:21-24`) [distillate].

The workflow study is the decisive evidence [distillate `P016.md:55-56`]:

> **Automated orchestration scores 80.22 semantic overall versus 72.35 for
> Generator only, but trails fixed Splitter and full paths at 84.02 and 88.07.**

The automatic router beats no-routing by ~8 points and **loses to a fixed
hand-chosen path by ~8 points** — while consuming ~46.2M tokens against ~33.9M
for Generator-only. The distillate states the failure mode plainly: "The
orchestrator does not reach the best manually selected workflow and sometimes
reduces grammar score while improving semantics" (`P016.md:65`).

**Exact boundary language:** routing is a *model decision that is measurably
wrong a material fraction of the time, in a domain with an objective validator*.
It is workflow state to be recorded and overridden, not an architecture whose
superiority is established. The routing-seed caution — "Specialist routing is
evidence-bearing workflow state, not proof that a specialist architecture is
universally superior" (`../CAPTURE.md:223`) — is confirmed by the source's own
numbers, and by the fact that a human-fixed path won.

### 9.2 The six persisted fields, each with a source warrant

| Field | Warrant |
|---|---|
| **Candidate routes** | Three enumerated paths exist by construction; the router picks among them and demonstrably mis-picks (`P016.md:21-24,55`) [distillate] |
| **Rationale** | The router's input is a complexity classification (Simple/Parallel/Recursive) — a recordable, checkable, falsifiable judgment (`P016.md:37`) |
| **Stage inputs and outputs** | AgentODRL "separates routing, dependency resolution, semantic segmentation, graph generation, syntactic validation, and semantic checking into auditable stages" (`P016.md:42`); PatExpert's expert protocols "declare usage metadata, argument requirements, and input/output schemas" (`P084.md:23`) |
| **Validator results** | The SHACL generate-validate-correct loop: "This loop persists until the policy successfully passes validation" (p. 5, § 4.2) (`P016.md:83`) — validation is a *typed report*, not a score |
| **Retries** | The loop is bounded: at most 8 reflections in Experiment 1 (`P016.md:50`); a bounded retry count is a recordable fact |
| **Overrides** | Implied by § 9.1's headline result — the human-fixed path outperformed the router, so an override channel is the measured remedy |

### 9.3 What the routing sources do NOT license

- **Provenance is missing at source.** "The paper does not define provenance
  links from ODRL nodes or checkpoints back to exact source spans"
  (`P016.md:43`) [distillate]. Span lineage through routing stages is a
  beep-side requirement, not an inherited one.
- **Rewriting can destroy legal identity.** "Clause inlining can erase the
  significance of citation, amendment, exception scope, or versioned
  incorporation unless provenance and temporal identity are preserved
  separately" (`P016.md:67`) [distillate]. Directly relevant: a drafting
  "rewrite" stage that inlines or normalizes description text before anchoring
  can silently break the as-filed correspondence § 1.5 requires.
- **The evaluation is largely synthetic and model-judged.** 700 of 770 cases
  are LLM augmentations of 70 seeds; ground truth is LLM-extracted and judged
  by two LLM jurors (`P016.md:61-62`). Grammar score normalizes SHACL violation
  counts, so "a high percentage is not necessarily equivalent to complete
  conformance, executability, or legal validity" (`P016.md:63`).
- **PatExpert's metrics do not measure law.** Its orchestration numbers (0.94
  tool-usage awareness, 0.91 planning accuracy, 0.95 dependency-graph
  consistency) come with no participant count, K value, significance test, or
  independent legal validation (`P084.md:52-53,59`), several "ground truths"
  are Gold-LLM outputs (`P084.md:65`), and "BLEU and ROUGE-L measure overlap,
  not claim validity, antecedent basis, enablement, novelty, non-obviousness,
  claim scope, or legal drafting quality" (`P084.md:66`) [distillate]. Its
  critique loop "is still model-on-model evaluation and does not replace
  patent-attorney review" (`P084.md:72`).

---

## 10. Hypothesis-status ledger

| # | Claim as the wedge would state it | Status | Evidence that would upgrade it |
|---|---|---|---|
| H1 | Exact-span/anchor fidelity never decides written-description support, implicit disclosure, terminology equivalence, or new matter | **VERIFIED (legal, two-sided)** | Already settled: MPEP § 2163 I.B ("express, implicit, or inherent") + § 2163.02 + § 2163.07(a) (an anchor is not necessary) and § 2163.03 subsection V / *Enzo* (an anchor is not sufficient), plus § 2163 I "question of fact" [fetched] | 
| H2 | Independent and dependent claims are evaluated separately; dependency closure is part of the analysis | **VERIFIED (statutory)** | 35 U.S.C. § 112(d)/(e) + MPEP § 2163 II.A.1 "Each claim must be separately analyzed" [fetched] | 
| H3 | New matter is a diff against the as-filed disclosure, and can arise by omission as well as addition | **VERIFIED (guidance)** | MPEP § 608.04(a), § 2163.06 [fetched] | 
| H4 | Raw episodes are the non-lossy store; entities/edges/summaries/communities are lossy projections with back-links | **VERIFIED as architecture; UNVERIFIED as audit capability** | Zep § 2.1/2.2 states the design, then says the traversal is "not directly examined in this paper's experiments" [fetched]. Upgrade = a delete-and-rebuild proof over the repo's own `DraftingEpisode` ledger showing every projected retrieval fact resolves to a source episode |
| H5 | Graph/projected retrieval can lose to raw recent context on locality-bound questions | **VERIFIED (benchmark)** | LongMemEval per-type table: single-session-assistant 94.6→80.4 (gpt-4o) and 81.8→75.0 (gpt-4o-mini); knowledge-update 76.9→74.4 (gpt-4o-mini) [fetched] |
| H6 | A recent-raw-episode fallback is the correct remedy for H5 | **HYPOTHESIS — beep-side inference** | Zep prescribes no remedy ("further research and engineering work is needed") and uses recent episodes only as BFS seeds [fetched]. Upgrade = a repo fixture where the fallback measurably recovers the locality-bound case against the projection-only path |
| H7 | Deterministic identity/hierarchy/scope/point-in-time resolution runs before ranking | **VERIFIED (design, qualitatively evaluated)** | arXiv:2505.00039v5 § 4.4 step 5: "structural + temporal filters followed by vector/lexical ranking" [fetched]. Ceiling: the paper's evaluation is a qualitative trace study with no baseline comparison |
| H8 | The answer annex must disclose temporal, membership, and retrieval policy | **VERIFIED (source-prescribed)** | "The planner records the chosen policies (membership, temporal policy, retrieval k, etc.) with every response" [fetched] |
| H9 | The annex must also disclose language, fallback, rejected-candidate, and incompleteness | **HYPOTHESIS / NET-NEW** | `rejected` and `incomplete` have **zero** occurrences in arXiv:2505.00039v5; language/fallback appear in one clause [fetched]. Upgrade = design justification + fixtures in this repo, or a source that prescribes them |
| H10 | Reifying the legal inference event improves retrieval | **HYPOTHESIS — no ablation** | arXiv:2508.17340 baselines are GPT Simple / GPT With Context / GPT With RAG; the string "ablation" appears **zero** times [fetched]. Upgrade = a reification ablation (reified-event graph vs same graph without the Application node) on the same gold set |
| H11 | Atomic normative rows with stable ids are an inspectable retrieval substrate | **VERIFIED (as a representation property)** | HSNKB row schema, one operative clause per row [distillate, `P002.md:36-41,81`] |
| H12 | High-degree actor prefilters should not become a default retrieval gate | **VERIFIED as a small-benchmark negative result; NOT a general law** | 15 questions, 377 rows, three treaties, single-expert gold [distillate + fetched abstract]. Supports a study fixture only. Upgrade to generality would need a patent-domain replication with a measured degree distribution |
| H13 | Memory proposes precedents but never supplies current-disclosure support | **VERIFIED (legal), source-corroborated** | § 1.3 (support is a POSITA/attorney judgment over the current description) + arXiv:2406.19465's abstract-cannot-add-subject-matter framing [fetched] |
| H14 | Outline/budget/retrieval/chunk/assembly artifacts are auditable work products | **VERIFIED (they exist and are recordable)** | PAP2PAT COPGEN pipeline [fetched + distillate] |
| H15 | Chunking or section budgets independently cause draft quality | **REFUTED in the measured direction** | Length calibration *lowers* factuality (62.5/67.9 → 59.7/65.3); fine-tuning gains >20 style points and loses >10 factuality points [distillate, PAP2PAT results] |
| H16 | Reference overlap cannot accept a draft | **VERIFIED (dissociation measured)** | GPT-4 best expert ratings at BLEU 15.73; repetition removal *raises* ROUGE-L 6.8 points; multi-task tuning raises overall while lowering clarity [distillate + fetched rubric] |
| H17 | Specialist routing is a fallible decision that must be persisted and overridable | **VERIFIED (measured fallibility)** | AgentODRL: auto-orchestration 80.22 vs fixed-path 84.02/88.07 semantic [distillate] |
| H18 | A specialist/multi-agent architecture is superior for patent drafting | **NOT ESTABLISHED** | PatExpert's comparisons use frozen closed baselines against fine-tuned experts, conflating architecture with task-specific training (`P084.md:60`); no legal-expert validation [distillate] |
| H19 | Replay stability of the episode ledger proves drafting fidelity | **FALSE by construction** | Replay proves schema/fold mechanics only; ADHD-3 names the "false replayability" risk itself (`20-adhd-integration.md`, § Focus 3) |

---

## 11. Sources — every URL actually opened (access date 2026-08-06)

### Statutory and USPTO guidance (Frame a)

1. 35 U.S.C. § 112 — `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title35-section112&num=0&edition=prelim` (subsections (a)-(f) read verbatim; last amended Pub. L. 112-29, § 4(c), Sept. 16, 2011).
2. 35 U.S.C. § 132 — `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title35-section132&num=0&edition=prelim`.
3. MPEP § 2163 [R-01.2024] and subsections § 2163.01, § 2163.02 [R-07.2022], § 2163.03, § 2163.05 [R-01.2024], § 2163.06 [R-07.2022], § 2163.07(a) [R-07.2022] — `https://www.uspto.gov/web/offices/pac/mpep/s2163.html`.
4. MPEP § 608.04 [R-10.2019], § 608.04(a) [R-10.2019], § 608.04(b) [R-10.2019], § 608.04(c) [R-11.2013] — `https://www.uspto.gov/web/offices/pac/mpep/s608.html` (the section is served inside the Chapter-600 § 608 page; a summarizing fetch truncated before reaching it — full text was recovered by reading the whole page).

### Public papers (Frame b)

5. **Zep / Graphiti** — arXiv:2501.13956v1, abstract `https://arxiv.org/abs/2501.13956`, full text `https://arxiv.org/pdf/2501.13956`. Vendor-authored preprint; treat absolute numbers accordingly.
6. **SAT-Graph RAG** — arXiv:2505.00039, v5 HTML `https://arxiv.org/html/2505.00039v5`. Published version: JURIX 2025, FAIA vol. 416, DOI `10.3233/FAIA251598` (`https://ebooks.iospress.nl/doi/10.3233/FAIA251598`, landing page seen via search index, not opened).
7. **Beyond Probabilistic Similarity** — arXiv:2606.09724v1, `https://arxiv.org/abs/2606.09724` (abstract + metadata read; PDF not opened).
8. **Capturing Legal Reasoning Paths** — arXiv:2508.17340, `https://arxiv.org/abs/2508.17340` and full text `https://arxiv.org/pdf/2508.17340`; ACM K-CAP 2025, DOI `10.1145/3731443.3771354`.
9. **Hohfeldian Knowledge Base (HSNKB)** — JURIX 2025, FAIA vol. 416, pp. 318-323, DOI `10.3233/FAIA251604`, CC BY-NC 4.0 — `https://ebooks.iospress.nl/doi/10.3233/FAIA251604` (landing page + full abstract; **full text not retrieved**, see § 12).
10. **PAP2PAT** — Findings of ACL 2025, pp. 9524-9554 — `https://aclanthology.org/2025.findings-acl.496/`, PDF `https://aclanthology.org/2025.findings-acl.496.pdf`; preprint arXiv:2410.07009; code/data `https://github.com/boschresearch/Pap2Pat` (URL recorded from the paper, not opened).
11. **Can LLMs Generate High-quality Patent Claims?** — arXiv:2406.19465 `https://arxiv.org/abs/2406.19465`; published Findings of NAACL 2025, PDF `https://aclanthology.org/2025.findings-naacl.70.pdf`.
12. **PatExpert** — arXiv:2409.19006 `https://arxiv.org/abs/2409.19006` (OWA workshop, NeurIPS 2024).
13. **AgentODRL** — arXiv:2512.00602 `https://arxiv.org/abs/2512.00602`.
14. **PATENTWRITER** — arXiv:2507.22387 `https://arxiv.org/abs/2507.22387`.
15. **PatentGPT / Patent Concept Generation** — arXiv:2409.00092v3 `https://arxiv.org/abs/2409.00092` (accepted, *Advanced Engineering Informatics*).
16. **LegalGraphRAG** — arXiv:2605.28120 `https://arxiv.org/abs/2605.28120` (URL confirmed via search index); also ACL 2026 `https://aclanthology.org/2026.acl-long.1738/`. Neither opened directly.
17. **SOLAR / On Verifiable Legal Reasoning** — arXiv:2509.00710 `https://arxiv.org/abs/2509.00710`; CIKM 2025, DOI `10.1145/3746252.3761057`. URL confirmed via search index; not opened directly.

### On-disk repo sources read

- `explorations/patent-drafting-episode-ledger/CAPTURE.md` (nuggets, resolved remo2/remo3 boundaries, cautions)
- `explorations/patent-drafting-episode-ledger/DECISIONS.md` (lane scope)
- `explorations/patent-drafting-episode-ledger/research/SOURCES.md`
- `explorations/legal-patent-kg-deepening/research/00-catalog.json` (per-paper catalog rows; **every `url` field is `null`** — no public URL was recorded at mining time, which is why this lane had to re-discover all seventeen)
- `explorations/legal-patent-kg-deepening/research/SOURCES.md`
- `explorations/legal-patent-kg-deepening/research/20-adhd-integration.md` § Focus 2 (lines 161-194), § Focus 3 (lines 195-234)
- `explorations/legal-patent-kg-deepening/research/mined/` — P002, P003, P005, P016, P018, P019, P025, P027, P028, P030, P048, P056, P066, P068, P069, P078, P084, P099

### Drift and corrections discovered

- **D1 — Title drift, SAT-Graph paper.** arXiv:2505.00039's current listing title
  is "…: A **Structural**, Temporal, and Deterministic Approach"; the JURIX 2025
  published version (DOI `10.3233/FAIA251598`) is "…: A **Hierarchical**,
  Temporal, and Deterministic Approach", which is the form the distillates
  P018/P019 carry. Both are the same work; cite the DOI to avoid ambiguity.
- **D2 — Title drift, PatentGPT.** The corpus file is titled "PatentGPT: A
  Large Language Model for Patent Drafting Using Knowledge-based Fine-tuning
  Method"; arXiv:2409.00092 was **retitled** to "Large Language Model for Patent
  Concept Generation" (v3, last revised 8 Apr 2025, Ren / Ma / **Luo** — a third
  author the corpus filename does not reflect). Note also a *different*
  "PatentGPT" exists (arXiv:2404.18255, *A Large Language Model for Intellectual
  Property*); the two must not be conflated.
- **D3 — P018/P019 are one work, not two sources.** The distillate says so
  itself (`P018.md:82`: "P019 is the HTML rendering of the same arXiv v4 work
  and should not be counted as independent empirical evidence"). T3-F4 lists
  both among its distillates; the evidence count for that nugget is therefore
  one source lower than it appears.
- **D4 — T3-F10's regression surface is under-reported.** See § 2.4.
- **D5 — Four of seven annex fields are net-new.** See § 3.2.
- **D6 — The recent-raw fallback has no source prescription.** See § 2.4 / H6.
- **D7 — The parent catalog carries no URLs.** `00-catalog.json` has
  `"url": null` for all seventeen paper rows consumed here. Every URL in § 11
  was re-discovered in this lane. If SOURCES.md is meant to be the durable
  provenance ledger, these URLs belong in it.

---

## 12. NOT FOUND / NOT VERIFIED

- **HSNKB full text (P002/P003) — NOT RETRIEVED.** `https://ebooks.iospress.nl/pdf/doi/10.3233/FAIA251604` returned an HTML consent/interstitial page (HTTP 200, `content_type: text/html`), not a PDF. The abstract and full bibliographic record **were** verified from the landing page. Consequently the 377-row count, the per-model precision/recall/F1 tables, the 23.9-35.6-actors-vs-6.2-gold figure, the ~15% filtering figure, and the quote "Actor-constrained filtering narrows the search space but does not substantially improve retrieval performance" (p. 322, sec. 5) are carried **from the on-disk distillate only** (`P002.md`), not re-verified against the primary. The paper is CC BY-NC 4.0, so a retrieval retry through a non-interstitial path is the obvious fix before the SPEC cites these numbers.
- **MPEP § 608.04 via summarizing fetch — INITIALLY NOT FOUND, then recovered.** Two `WebFetch` calls against `s608.html` reported the section absent because the page is ~875 KB and the summarizer truncated before reaching it. The section was recovered by reading the full page. Recorded because it is a live failure mode for any agent citing long MPEP pages: *a "section not present" answer from a summarizing fetch on a long MPEP page is not evidence of absence.*
- **arXiv:2606.09724 full text — NOT OPENED.** Abstract and metadata verified; the § 3.2 typed-failure language is carried from the distillate `P078.md:79`, which records it as a *beep-relevance hook* (an inference drawn during mining), **not** a quotation from the paper. Do not attribute "typed failures" to the paper as its own wording without opening the PDF.
- **LegalGraphRAG (P048), SOLAR (P056), P005, P025, P030 — URLs recorded, texts NOT OPENED.** These back T3-F4 and T3-F10 as corroborating rather than load-bearing sources; no § 2-§ 9 boundary statement rests on them. P005 (legal-dispute prompt/KG framework) and P025 (*AI in Legal Data Mining*) had no public URL discoverable within this lane's budget — **NOT FOUND**, recorded honestly.
- **Zep's episode→fact citation traversal — NOT EVALUATED BY THE SOURCE.** Stated explicitly by the authors [fetched, § 2.2]. This is a source limitation, not a lane failure, and it is the single most important caveat in § 2.
- **No reification ablation exists in arXiv:2508.17340 — VERIFIED ABSENT.** Zero matches for "ablation" across the full extracted PDF; the three baselines are all non-graph. This confirms the T3-F5 caution directly rather than inheriting it.
- **`rejected` / `incomplete` in arXiv:2505.00039v5 — VERIFIED ABSENT.** Zero matches for either token; see § 3.2 and H9.
- **Not attempted, by scope.** No source was opened on: patent claim construction case law beyond what MPEP quotes, Federal Circuit written-description doctrine beyond the MPEP's own citations, EPO/PCT equivalents, or any retrieval-fusion literature (owned by `goals/hybrid-retrieval-fusion-core`, never reopened here). No client or pre-publication patent material was touched at any point.
