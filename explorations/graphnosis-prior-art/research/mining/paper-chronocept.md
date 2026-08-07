# Chronocept — mining note

**Source PDF:** `/home/elpresidank/YeeBois/projects/beep-effect15/explorations/graphnosis-prior-art/assets/chronocept-sense-of-time.pdf` (20 pages, read in full: 1-10, 11-20 including all appendices A-H)

**Citation, transcribed from the title page and arXiv sidebar:**

> Krish Goel\*, Sanskar Pandey\*, KS Mahadevan, Harsh Kumar, Vishesh Khadaria.
> "Chronocept: Instilling a Sense of Time in Machines."
> arXiv:2505.07637v1 [cs.CL], 12 May 2025. (\*Equal contribution.)
> Contact emails printed on the title page: krish@projectendgame.tech, pandeysanskar854@gmail.com,
> mahadevanks26@gmail.com, kumarharsh3014@gmail.com, khadariavishesh@gmail.com

**No venue is printed anywhere in the PDF.** There is no conference/journal banner, no camera-ready
footer, no DOI. It is an arXiv preprint only. Do not attribute it to ACL/EMNLP — the ACL-style
formatting is just the `acl_natbib` template, which anyone can use.

**Licensing / artifacts, transcribed:**
- Dataset: Creative Commons Attribution 4.0 International (CC-BY 4.0), `https://creativecommons.org/licenses/by/4.0`
- Dataset location: `https://huggingface.co/datasets/krishgoel/chronocept`
- Baseline implementations + training scripts + the reusable `DataLoader` with log conversion:
  `https://github.com/krishgoel/chronocept-baseline-models`
- No license is printed for the *code*. Only the dataset license is stated.
- No personal/identifying information collected; all source text is synthetic.

---

## 1. What the formal object actually is

This is the load-bearing question for us, so I'll be precise.

### 1.1 The stated formalism (§3.1)

Let `T ⊆ ℝ≥0` be the time domain where `t ≥ 0` is **elapsed time since publication of information `i`**.
(Not calendar time. Not absolute. Relative to a single anchor: publication.)

Define a binary random variable

```
validity_i(t) ∈ {0, 1}                            (Eq 2)
```

Rather than predicting `validity_i(t)` directly, TVP learns a continuous function

```
p_i(t) = P(validity_i(t) = 1),   p_i : T → [0,1]  (Eq 3)
```

and then they write

```
P(∀t ∈ [a,b], validity_i(t) = 1) = ∫_a^b p_i(t) dt   (Eq 4)
```

**Eq 4 is wrong and it matters.** The probability that a statement is valid *throughout* an interval is
not the integral of a pointwise marginal probability. The integral of a `[0,1]`-valued function over a
long interval routinely exceeds 1. They are conflating "a probability density over the time axis" with
"a pointwise probability of validity at each time," and Eq 4 only typechecks under the density reading,
which then contradicts Eq 3's codomain claim. This confusion propagates: Appendix D admits the final
released curve is **not** a probability distribution at all (see §1.4). So the paper's headline framing
("temporal validity as a continuous probability distribution") is not what the released artifact is.

### 1.2 The parametric family: skew-normal

```
f(x; ξ, ω, α) = (2/ω) · φ((x − ξ)/ω) · Φ(α · (x − ξ)/ω)          (Eq 5)
```
- `φ(z)` = standard normal PDF, `Φ(z)` = standard normal CDF
- `ξ` (location) — the time at which the statement is most likely valid ("peak validity")
- `ω` (scale) — the duration over which validity is maintained
- `α` (shape/skewness) — asymmetry; `α > 0` right skew, `α < 0` left skew

Explicitly **no boundary constraints**: they do *not* impose `p_i(0) = 1` and do *not* impose monotonic
decay. That's the deliberate design point — it permits delayed onset, non-monotonic plateaus, and
intermittent resurgences (their claim; the last one is impossible under a unimodal family, see §7).

### 1.3 The log time axis — the genuinely reusable trick

```
t' = log_1.1(t)  ,  t in MINUTES ,  generally t' = ln(t)/ln(b)   (Eq 6)
```

Base 1.1 is the default; the datasets are released in base 1.1. Base conversion between bases `m` and `b`:

```
t'^(b) = (ln m / ln b) · t'^(m)
ξ^(b)  = (ln m / ln b) · ξ^(m)
ω^(b)  = (ln m / ln b) · ω^(m)
α      is INVARIANT under base change
```

That last line is the nice bit: skewness is scale-free, so a base change is a pure affine rescale of two
of three parameters. The encoding is base-agnostic and losslessly convertible.

**Table 9 — Compression analysis (transcribed verbatim).** `CR = t'/t`, `Compression % = 100 × (1 − CR)`.

| Timestamp | Linear t | b=1.1: t' | CR | % | b=2: t' | CR | % | b=10: t' | CR | % |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 minute | 1 | 0.0 | 0.000 | 100 | 0.0 | 0.000 | 100 | 0.0 | 0.000 | 100 |
| 1 hour | 60 | 42.96 | 0.716 | 28.4 | 5.91 | 0.099 | 90.1 | 1.78 | 0.030 | 97.0 |
| 1 day | 1440 | 76.30 | 0.053 | 94.7 | 10.47 | 0.007 | 99.3 | 3.16 | 0.002 | 99.8 |
| 1 week | 10080 | 96.73 | 0.010 | 99.0 | 13.30 | 0.001 | 99.9 | 4.00 | 3.968e-4 | 99.9 |
| 1 month | 43200 | 111.97 | 0.003 | 99.7 | 15.39 | 3.563e-4 | 99.9 | 4.63 | 1.072e-4 | ~100 |
| 1 year | 525600 | 138.23 | 2.623e-4 | ~100 | 19.00 | 3.615e-5 | ~100 | 5.72 | 1.088e-5 | ~100 |
| 1 decade | 5256000 | 162.25 | 3.087e-5 | ~100 | 22.33 | 4.249e-6 | ~100 | 6.72 | 1.279e-6 | ~100 |

The rationale for base 1.1 over base 2/10: it preserves *quasi-linear spacing* across the canonical
human intervals (minute → decade lands in `[0, 162]`, with ~43 units per order-of-magnitude-ish step),
so a Gaussian-family bump of width `ω ≈ 10` is a *meaningful* width. At base 10 the whole minute-to-decade
range is `[0, 6.72]` and any sensible `ω` is a fraction, which is numerically nasty and visually useless
for annotation UIs. That is a real, defensible engineering justification, and it is the single most
directly portable idea in the paper.

### 1.4 What the released curve actually is (Appendix D) — read this before believing "distribution"

The fitting pipeline:
1. Each temporal profile is a **smooth freehand curve** drawn by an annotator, from which **five points**
   are sampled: one at the peak, two mid-validity, two low-validity.
2. Since these are *relative* probabilities, AUC is unconstrained. During optimization a free scaling
   factor `S` is fitted, then **Trapezoidal Rule normalization** enforces `AUC = 1` while preserving shape.
3. **Then** — "to reduce computational overhead over long-tailed domains" — they rescale the fitted curve
   by its maximum to constrain it to `[0,1]`. This "avoids instability from very small values in
   AUC-normalized densities."
4. The result, in their own words: *"while no longer a true probability distribution, retains shape and
   relative comparisons. We refer to it as a **proportional validity curve**, useful in applications
   prioritizing ranking or visualization over strict probabilistic semantics."*

Exact post-fit arithmetic as printed:
```
N        = ∫_{xmin}^{xmax} f_fit(x) dx
f_norm   = f_fit / N
f_max    = max_x f_norm(x)
S_final  = S_fit / (N · f_max)
```

Optimization: **Trust Region Reflective (TRF)** minimizing `SSR(θ) = Σ_{i=1..N} (y_i − f(x_i; θ))²`,
implemented via `scipy.optimize.curve_fit`. Goodness-of-fit metric: **RMSE**.

**So the honest characterization of the object is:** a max-normalized, unimodal, 3-parameter *shape*
over log-elapsed-minutes-since-publication, whose y-value is an ordinal plausibility score in `[0,1]`
with no calibrated probabilistic meaning. It is a **relevance/plausibility profile**, not a probability
distribution and not a survival function. Treat every "probability" claim in the abstract as marketing.

---

## 2. The "axes" — and why they are NOT temporal subaxes

This is the thing most likely to be mis-read from the abstract. "Semantically decomposed temporal axes"
sounds like a decomposition of *when*. It is not.

They adopt the **multi-axis annotation scheme of Ning et al. (2018) (MATRES)**, which partitions each
sentence into eight semantically coherent axes. The eight axes, with the paper's own definitions (§4.5):

| Axis | Definition as printed |
|---|---|
| **Main** | Core verifiable events (verifiable events along a timeline, objective truths) |
| **Intention** | Future plans or desires |
| **Opinion** | Subjective viewpoints |
| **Hypothetical** | Conditional or imagined events |
| **Negation** | Denied or unfulfilled events |
| **Generic** | Timeless truths or habitual patterns |
| **Static** | Unchanging states in context |
| **Recurrent** | Repeated temporal patterns |

These are **modality / speech-act / epistemic-status categories over text segments**, not finer
subdivisions of the time axis. Chronocept segments a sentence, labels each segment with one of the eight,
and then fits **one** curve for the whole parent text. There is no per-axis curve. The axis labels are
used purely as *auxiliary structured input features* (concatenated axis embeddings) to help predict the
single `(ξ, ω, α)` triple.

The "key questions" from the annotation guidelines (Fig 3, Appendix A) make the modality reading explicit:
- Main: *"Does this event occur within the primary timeline of the narrative?"*
- Intention: *"Is this event stated as an intended action or goal, regardless of its realization?"*
- Opinion: *"Does this event represent a belief or expectation rather than a verified fact?"*
- Hypothetical: *"Is this event dependent on a condition?"*
- Negation: *"Is this event explicitly stated as unfulfilled or negated?"*
- Generic: *"Is this event a universal truth or a habitual occurrence that transcends specific contexts?"*
- Static: *"Is this event context-specific and static within the described situation?"*
- Recurrent: *"Does this event represent a recurring action or pattern?"*

**This taxonomy is the most transferable idea in the paper for a claim-graph, and it is not the paper's
contribution** — it's Ning et al. 2018, which Chronocept cites and reuses.

### 2.1 The axis taxonomy is empirically shaky

Appendix B is an honest self-critique that undercuts the axis scheme. Generic and Static are chronically
confused. **Table 8, transcribed:**

| Axis Setting | Precision | Cohen's Kappa |
|---|---|---|
| Original (Generic and Static distinct) | 0.4443 | 0.3291 |
| Merged (Generic + Static as one class) | 0.5243 | 0.3866 |

Text: precision improved 18.0%, Cohen's Kappa 17.47%.

**Micro-averaged inter-annotator precision on axis labels is 0.44, and Cohen's κ is 0.33 — "fair"
agreement at best. Even after merging the two worst-confused classes, κ = 0.39.** The abstract's
"strong inter-annotator agreement (84% and 89%)" refers *only* to ICC on the three curve parameters and
conveniently omits this.

**Figure 4(a) — axis co-occurrence/confusion matrix, Generic and Static distinct (transcribed):**

| | Intention | Opinion | Hypo. | Negation | Generic | Static | Recurrent |
|---|---|---|---|---|---|---|---|
| Intention | 0 | 32 | 21 | 8 | 21 | 37 | 14 |
| Opinion | 32 | 0 | 49 | 31 | 10 | 70 | 12 |
| Hypo. | 21 | 49 | 0 | 12 | 4 | 19 | 5 |
| Negation | 8 | 31 | 12 | 0 | 17 | 63 | 50 |
| Generic | 21 | 10 | 4 | 17 | 0 | **102** | 41 |
| Static | 37 | 70 | 19 | 63 | **102** | 0 | **90** |
| Recurrent | 14 | 12 | 5 | 50 | 41 | **90** | 0 |

**Figure 4(b) — after merging Generic + Static (transcribed):**

| | Intention | Opinion | Hypo. | Negation | Static+Generic | Recurrent |
|---|---|---|---|---|---|---|
| Intention | 0 | 32 | 21 | 8 | 58 | 14 |
| Opinion | 32 | 0 | 49 | 31 | 80 | 12 |
| Hypo. | 21 | 49 | 0 | 12 | 23 | 5 |
| Negation | 8 | 31 | 12 | 0 | 80 | 50 |
| Static+Generic | 58 | 80 | 23 | 80 | 0 | 131 |
| Recurrent | 14 | 12 | 5 | 50 | 131 | 0 |

Note: the text says *"we treat them here as confusion matrices by including agreement counts along the
diagonal, enabling standard metric computation"* — **but the printed diagonals are all zero.** Either the
figure or the text is wrong. Given that, the printed κ of 0.33 cannot be reproduced from the printed
matrix. Sloppiness, not fraud, but it means the axis-agreement numbers are unverifiable from the paper.

Confusion pairs that matter beyond Generic↔Static: **Static↔Recurrent (90)**, **Static↔Opinion (70)**,
**Static↔Negation (63)**, **Opinion↔Hypothetical (49)**, **Negation↔Recurrent (50)**. "Static" is a
garbage-collector class absorbing everything the annotator couldn't place. If you port this taxonomy,
drop or redefine Static.

---

## 3. The dataset

### 3.1 Generation

- Two benchmarks. **Benchmark I:** 1,254 samples, simple single-sentence texts with clear temporal
  relations. **Benchmark II:** 524 samples, complex multi-sentence texts with temporally interdependent
  elements.
- **Fully synthetic.** Generated with **GPT-o1** (OpenAI o1, cited as OpenAI 2024, `https://openai.com/o1`)
  in **batches of 50 samples per prompt**. Full prompts reproduced as Figures 7 (BI) and 8 (BII).
- **No real-world data at all.** "No real-world or personally-identifying data was used, ensuring
  complete privacy."
- **Pre-filtering / dedup:** SBERT (`all-MiniLM-L6-v2`) embeddings + TF-IDF embeddings computed for all
  samples, pairwise cosine similarities. **Samples with SBERT or TF-IDF similarity > 0.7 removed** to
  reduce semantic and lexical redundancy.
- Generation prompt structure (Fig 7/8): sentences must be present tense (all four present forms),
  must incorporate at least one (BI) or two (BII) "Event-Related Axes" (Temporal Overlap, Causality,
  Subordination, Unrelated) and two (BI) or four+ (BII) "Annotation Axes," one of which must be Main.
  Note: the **Event-Related Axes never appear in the released schema** — they are a generation-prompt
  device only.

### 3.2 Annotation workflow (§4.2)

Three steps:
1. **Temporal Segmentation** — partition text into coherent subtexts preserving temporal markers.
2. **Axis Categorization** — assign each segment to one of the eight axes.
3. **Temporal Validity Distribution Plotting** — annotate a skew-normal `(ξ, ω, α)` over the log time axis.

Hard constraints applied to every sample:
- All parent texts written in the **present tense**.
- All distributions **anchored at `t = 0`**.
- **Multimodal curves excluded** — this is enforced at annotation time, so the dataset cannot contain
  the seasonal/recurring phenomena they later list as a limitation. The limitation is by construction.
- Samples without a clearly assignable main timeline, or violating these constraints, were **flagged and
  discarded**.

Annotation UI: custom **Streamlit** interface (`https://streamlit.io`), guidelines continuously accessible.

**From the guidelines figure (Fig 3), the actual plotting UI spec:**
- X-axis labeled with intervals: **1 minute, 15 minutes, 30 minutes, 1 hour, 12 hours, 1 day, 1 week,
  1 month, 1 year, 1 decade, and infinite validity**.
- Y-axis: probability, 0 (not valid) to 1 (fully valid).
- **Place 3–5 points** on the timeline indicating probability of validity at specific times.
- *"Do not worry about making an ideal probability distribution with AUC = 1. Instead, plot proportions
  relative to the temporal belief with the highest probability (Maximum Likelihood Estimate, MLE)."*
- A skewed curve is **automatically fitted** through the plotted points.

So the human never touches `(ξ, ω, α)` directly. They click 3–5 points on a log-time chart and the
curve fitter derives the parameters. That is a good UX decision and worth stealing if we ever ask a human
to express graded validity.

### 3.3 Annotators and quality control (§4.3)

- **Eight third-year B.Tech students** with coursework in NLP, ML, and IR.
- **1-hour training session** plus a supervised warm-up on **50 samples**.
- Warm-up agreement thresholds set at: **ICC > 0.90** (numerical annotations), **Jaccard Index > 0.75**
  (segment-level labels), **P_k < 0.15** (segmentation consistency).
- **Each sample annotated independently by two annotators.**
- Quality control: daily reviews of 10% of annotations; **cap of 70 samples per annotator per day** to
  mitigate fatigue; automated flagging of samples with segmentation mismatches, **target deviations > 2σ**,
  or **P_k > 0.2**. Discrepancies adjudicated or, if unresolved, discarded.
- **Resolution rule:** for segmentation and axis labels, a **union-based approach retained all plausible
  interpretations**. For the target values `(ξ, ω, α)`, **annotator values were averaged** to yield smooth
  probabilistic supervision rather than discrete target selection.

The union-based axis resolution is important and under-discussed: it means the released axis labels are a
*union of two annotators' opinions*, so a segment can carry an axis label that only one annotator
endorsed. Combined with κ = 0.33, the axis field is noisy by construction.

### 3.4 Inter-annotator agreement — Table 1, transcribed

| IAA Metric | Benchmark I | Benchmark II |
|---|---|---|
| **ICC** (on `ξ, ω, α`) | 0.843 | 0.893 |
| **Jaccard Index** (axis categorization) | 0.624 | 0.731 |
| **P_k Metric** (segmentation; lower is better, 0 = perfect, 1 = chance) | 0.233 | 0.009 |

`P_k` is Beeferman et al. (1997). The paper reports **only ICC as the benchmark-wide IAA**, arguing
segmentation and axis categorization "enrich the dataset structure" but "do not directly impact the core
prediction task, which depends solely on the parent text and its annotated temporal validity distribution."
That argument is self-undermining: their own ablations (§5.4, Appendix F/G) claim axis features and axis
*ordering* matter for the prediction task. You cannot both say axis labels don't affect the task and that
removing/shuffling them degrades it by 4.6–13.4%.

**The achieved IAA misses the paper's own a-priori thresholds.** Threshold ICC > 0.90; achieved 0.843 (BI)
and 0.893 (BII) — both below. Threshold Jaccard > 0.75; achieved 0.624 and 0.731 — both below. Threshold
P_k < 0.15; achieved 0.233 on BI — above (BII's 0.009 is fine). The paper never acknowledges this. The
abstract's "strong inter-annotator agreement (84% and 89%)" is the only agreement number a casual reader
sees, and it is the *one* metric they chose to report benchmark-wide.

Also note the P_k asymmetry (0.233 vs 0.009): Benchmark II's multi-sentence texts have obvious sentence
boundaries to segment on, so segmentation is near-trivial; Benchmark I requires splitting *within* a single
sentence, which is genuinely hard. The "harder" benchmark is easier on two of three IAA metrics.

### 3.5 Splits — Table 2, transcribed

Stratified sampling over the axes distribution, 70/20/10.

| Benchmark | Training | Validation | Test |
|---|---|---|---|
| Benchmark I | 878 | 247 | **129** |
| Benchmark II | 365 | 104 | **55** |

**Test sets are 129 and 55 samples.** Every headline number in Table 6 is computed on ≤129 examples.
Differences of 0.01–0.05 in MSE across models on 129 samples are noise. No confidence intervals, no
multiple seeds, no significance tests anywhere in the paper.

### 3.6 Axis distribution — Table 3, transcribed

Computed on non-null annotations per sample.

| Temporal Axis | Benchmark I | Benchmark II |
|---|---|---|
| Main Axis | 1254 | 524 |
| Static Axis | 516 | 513 |
| Generic Axis | 228 | 116 |
| Hypothetical Axis | 136 | 182 |
| Negation Axis | 240 | 200 |
| Intention Axis | 165 | 522 |
| Opinion Axis | 328 | 519 |
| Recurrent Axis | 348 | 198 |

Main is present in 100% of samples in both (1254/1254, 524/524) — enforced by the generation prompt.
Benchmark II is near-saturated on Intention (522/524) and Opinion (519/524) and Static (513/524), again
by prompt construction ("four or more Annotation Axes").

### 3.7 Sentence length — Table 4, transcribed

Tokenization via SpaCy `en_core_web_sm`.

| Benchmark | Mean Length (μ) | SD (σ) |
|---|---|---|
| Benchmark I | 16.41 tokens | 1.56 tokens |
| Benchmark II | 56.21 tokens | 6.21 tokens |

The SDs are remarkably tight (1.56 tokens on a 16.41-token mean) — a fingerprint of single-model synthetic
generation from one prompt template.

### 3.8 Target parameter statistics — Table 5, transcribed

| Parameter | Location (ξ) mean | ξ SD | Duration (ω) mean | ω SD | Skewness (α) mean | α SD |
|---|---|---|---|---|---|---|
| Benchmark I | 54.2803 | 20.4169 | 11.5474 | 3.7725 | −0.0158 | 1.3858 |
| Benchmark II | 46.1511 | 13.3839 | 9.5553 | 2.5725 | 0.0275 | 1.1773 |

**I converted these back to wall-clock, because it is decisive for our use case.** With `ln(1.1) = 0.0953102`
and t in minutes:

- BI `ξ = 54.2803` → `exp(54.2803 × 0.0953102) = exp(5.1735) ≈ 176 minutes ≈ **2.9 hours**`
- BI `ξ ± 1σ` → `[33.86, 74.70]` → `≈ 25 minutes` to `≈ 21 hours`
- BI `ω = 11.5474` → a multiplicative scale of `1.1^11.55 ≈ **3.0×** in time`
- BII `ξ = 46.1511` → `exp(4.3987) ≈ 81 minutes ≈ **1.4 hours**`
- BII `ω = 9.5553` → `≈ 2.5×`
- `α ≈ 0` on average in both, with SD ≈ 1.2–1.4 — so the corpus is symmetric *on average* with individual
  samples skewing both ways. The skewness that motivates the whole skew-normal choice is, at the corpus
  level, a zero-mean nuisance parameter.

**The entire benchmark lives in the minutes-to-a-day regime.** Recall the log axis is defined out to a
decade (`t' = 162.25`); the observed mean is `54.3`, i.e. barely past 1 hour (`42.96`) and well short of
1 day (`76.30`). This is a direct consequence of generating present-tense sentences about people making
coffee and websites crashing. For any domain where claim validity is measured in months and years
(legal status, patent term, contractual state, employment, ownership), this dataset carries **no signal
whatsoever** — the models are fit to a distribution centered three hours after publication.

### 3.9 The released sample schema — Figure 1, transcribed verbatim

```json
{
  "_id": "H0028",
  "parent_text": "They are discussing a philosophical concept, whereas an online forum simultaneously erupts in debate over similar ideas. They believe open dialogue fosters clarity, yet they recognize tensions may escalate. They intend to document their conclusions, hoping to contribute thoughtfully to the discussion.",
  "axes": {
    "main_outcome_axis": "They are discussing a philosophical concept,",
    "intention_axis": "They intend to document their conclusions, hoping to contribute thoughtfully to the discussion.",
    "opinion_axis": "They believe open dialogue fosters clarity,",
    "hypothesis_axis": "",
    "generic_axis": "",
    "negation_axis": "",
    "static_axis": "whereas an online forum simultaneously erupts in debate over similar ideas. yet they recognize tensions may escalate.",
    "recurrent_axis": ""
  },
  "target_values": { "location": 39.865, "scale": 13.265, "skewness": 4.25 }
}
```

Observations on the shape:
- `axes` is a **fixed-key record of eight string fields**, empty string for absent. Not a list of spans.
  **There are no character offsets** — the axis value is a copied substring. Multiple non-contiguous
  segments are concatenated into one string (see `static_axis` above: two clauses joined by a space).
  So the mapping back to the parent text is lossy and ambiguous. If you port this format, use spans.
- Key naming is inconsistent with the prose: `main_outcome_axis` vs "Main Axis", `hypothesis_axis` vs
  "Hypothetical Axis".
- `target_values` is a flat `{location, scale, skewness}` triple with no base recorded. The base-1.1
  convention is implicit in the corpus, not in the record. That's a correctness hazard given they publish
  base-conversion formulas — a record carrying `location: 39.865` is meaningless without its base.
- Decoding this example: `location 39.865` → `exp(3.7994) ≈ 45 minutes`; `scale 13.265` → `≈ 3.5×`;
  `skewness 4.25` → strong right skew (long decay tail). So: "peaks ~45 min after publication, decays
  slowly." Sane.

---

## 4. Models, training, and results

### 4.1 Setup (§5.2)

- Task framed as **structured regression over three low-dimensional parameters** `(ξ, ω, α)`, jointly
  predicted.
- Inputs: **BERT-based embeddings of the parent text and the temporal subtexts**; axis-specific embeddings
  are **concatenated in a fixed order** to the parent-text embedding.
- **Targets Z-score normalized** to standardize learning across all models. (This single fact explains
  most of the metric pathologies below.)
- **Segmentation and axis labels are treated as preprocessing and are NOT modeled at inference.** In other
  words the models are fed **gold segmentation and gold axis labels**. The pipeline is not end-to-end.
- Evaluation spans three claimed dimensions: regression accuracy (MSE, MAE, R²), calibration (NLL), and
  rank correlation (Spearman ρ). CRPS appears in the appendix ablations.
- "Encoder-only models suffice. Decoder architectures are unnecessary, as Chronocept operates at the
  application layer, interfacing with downstream systems without altering core language models."
- Hardware: Intel Core i9-14900K, 16GB DDR5, NVIDIA RTX 4060.
- All non-BERT neural models trained 100 epochs with early stopping on validation loss; BERT 50 epochs.
- **BERT training loss plateaued after 2 epochs on both benchmarks (Figure 2)** — the loss curves flatline
  at roughly 150 (train ~50, val ~150 for BI; train ~50, val ~150 for BII, per the plotted axes).

### 4.2 Main results — Table 6, transcribed verbatim

Test-set performance. Lower is better for MSE, MAE, NLL; higher is better for R² and Spearman ρ. Each
reported metric is the **mean score across the three predicted parameters**. BI = Benchmark I, BII = Benchmark II.

| Baseline | MSE BI | MSE BII | MAE BI | MAE BII | R² BI | R² BII | NLL BI | NLL BII | Spearman BI | Spearman BII |
|---|---|---|---|---|---|---|---|---|---|---|
| LR | 1.3610 | 1.1009 | 0.9179 | 0.8361 | −0.3610 | −0.1009 | 1.5730 | 1.4670 | 0.2338 | 0.3279 |
| XGB | 0.8884 | 0.9580 | 0.7424 | 0.8011 | 0.1116 | 0.0420 | 1.3598 | 1.3975 | 0.2940 | 0.2331 |
| SVR | 0.9067 | 0.8889 | 0.7529 | 0.7740 | 0.0933 | 0.1111 | 1.3700 | 1.3601 | 0.3281 | 0.3293 |
| **FFNN** | **0.8763** | 0.8715 | **0.7284** | **0.7583** | **0.1237** | 0.1285 | **1.3529** | 1.3502 | **0.3543** | 0.3437 |
| **Bi-LSTM** | 0.9203 | **0.8702** | 0.7571 | 0.7646 | 0.0797 | **0.1298** | 1.3774 | **1.3494** | 0.2367 | **0.3535** |
| BERT | 145.8611 | 68.1507 | 6.7570 | 4.6741 | −0.0090 | −0.1122 | 3.9103 | 3.5299 | −0.0485 | −0.2407 |

(Bold in the original marks the best value per column; FFNN wins BI across the board, Bi-LSTM wins BII on
MSE, R², NLL, and Spearman.)

### 4.3 What these numbers actually mean — the metric-collapse problem

**This is the most important thing to take away from the results section, and the paper does not say it.**

Because targets are Z-score normalized, the target variance is 1, so **R² = 1 − MSE identically**. Check it:

- LR BI: `1 − 1.3610 = −0.3610` ✓ (exact)
- XGB BI: `1 − 0.8884 = 0.1116` ✓
- SVR BI: `1 − 0.9067 = 0.0933` ✓
- FFNN BI: `1 − 0.8763 = 0.1237` ✓
- Bi-LSTM BI: `1 − 0.9203 = 0.0797` ✓
- Every BII row: ✓ likewise

**R² is not an independent metric. It is MSE, restated.** Reporting both as if they are separate evidence
inflates the apparent thoroughness of the evaluation.

**NLL is also a deterministic function of MSE.** For a unit-variance Gaussian,
`NLL = 0.5·ln(2π) + 0.5·MSE = 0.9189 + MSE/2`:

- FFNN BI: `0.9189 + 0.4382 = 1.3571` vs reported `1.3529` (Δ 0.004)
- Bi-LSTM BI: `0.9189 + 0.4602 = 1.3791` vs reported `1.3774` (Δ 0.002)
- Bi-LSTM without-axes (Table 12): `0.9189 + 0.4813 = 1.4002` vs reported `1.3998` (Δ 0.0004)

So the claimed "calibration" dimension carries **no information beyond MSE**. There is no calibration
evaluation in this paper. The models emit point estimates; a point estimate has no predictive
distribution to calibrate.

**CRPS ≡ MAE.** In Tables 12 and 13, the CRPS column is *character-for-character identical* to the MAE
column in every single row (Bi-LSTM without axes: MAE 0.7659, CRPS 0.7659; FFNN without axes: MAE 0.7531,
CRPS 0.7531; Bi-LSTM erroneous axes: MAE 0.7984, CRPS 0.7984; FFNN erroneous axes: MAE 0.7591, CRPS 0.7591).
This is expected — CRPS of a deterministic forecast reduces exactly to absolute error — but it means CRPS
is padding, not evidence.

**Net:** of the six reported metrics `{MSE, MAE, R², NLL, Spearman, CRPS}`, only **three** are independent
(`MSE`, `MAE`, `Spearman`), and `NLL`/`R²`/`CRPS` are algebraic restatements. The evaluation is one third
as broad as it appears.

**And on the substance: the task is essentially unsolved.** Best R² across the whole table is **0.1298**
(Bi-LSTM, Benchmark II). Best MSE is 0.8702 against a trivial predict-the-mean baseline of MSE = 1.0
(Z-normalized). So the best model explains **~13% of variance** and beats "always predict the mean" by
~13%. Best Spearman is 0.3543. Linear regression is *worse than the mean predictor* (R² = −0.36).
This is a hard, largely unlearned task at these dataset sizes, and the paper's framing ("FFNNs paired with
pretrained embeddings yield state-of-the-art performance") badly oversells a ~13%-of-variance result on a
129-sample test set.

### 4.4 The BERT row is broken, not merely weak

BERT BI: MSE = 145.8611 but R² = −0.0090. **Every other row in the table satisfies R² = 1 − MSE exactly.**
If BERT's MSE were really 145.86 under the same normalization, its R² would be −144.86. The two numbers
in the same row are computed under mutually incompatible scalings. Same story for BII (MSE 68.15,
R² −0.1122). Combined with the loss curves flatlining after 2 epochs at ~150 (Figure 2) and MAE of 6.76
on Z-normalized targets (i.e. the model is predicting values ~7 standard deviations off), the conclusion
is not "BERT underperforms due to sensitivity to overfitting on small regression datasets" (the paper's
explanation, citing Mosbach et al. 2021, Peters et al. 2019, Lee et al. 2020). The conclusion is **the
BERT regression head was never correctly scaled or trained**, most likely a target-normalization bug in
that one path. The paper reports it as a finding and even builds a narrative around it ("Surprisingly,
fine-tuned BERTs do not outperform simpler architectures"). That claim should be discarded.

### 4.5 Ablations

Two ablations on **Benchmark I only**, on Bi-LSTM and FFNN: (1) remove all axis-level information from the
input, keeping only the parent-text embedding; (2) randomly **shuffle the axis embedding order** during
training while keeping correct ordering in the test set (parallels perturbation-robustness testing,
Moradi & Samwald 2021).

**Table 7 (main text), Bi-LSTM, relative to original MSE 0.9203:**

| Ablation Type | Ablated MSE | Increase |
|---|---|---|
| Exclusion of Axes | 0.9625 | 4.59% |
| Erroneous Labeling | 1.0107 | 9.83% |

**Table 12 (Appendix F) — axis removal, Benchmark I:**

| Model | Setting | MSE | MAE | R² | NLL | CRPS |
|---|---|---|---|---|---|---|
| Bi-LSTM | Without Axes | 0.9625 | 0.7659 | 0.0375 | 1.3998 | 0.7659 |
| Bi-LSTM | Absolute Change (Δ) | 0.0422 | 0.0088 | 0.0422 | 0.0224 | 0.0088 |
| Bi-LSTM | *Improvement* | 4.59% | 1.16% | **112.53%** | 1.63% | 1.16% |
| FFNN | Without Axes | 0.9368 | 0.7531 | 0.0632 | 1.3863 | 0.7531 |
| FFNN | Absolute Change (Δ) | 0.0605 | 0.0247 | 0.0605 | 0.0334 | 0.0247 |
| FFNN | *Improvement* | 6.91% | 3.39% | **95.71%** | 2.47% | 3.39% |

**Table 13 (Appendix G) — erroneous/shuffled axis labelling, Benchmark I:**

| Model | Setting | MSE | MAE | R² | NLL | CRPS |
|---|---|---|---|---|---|---|
| Bi-LSTM | Erroneous Axes | 1.0107 | 0.7984 | −0.0107 | 1.4243 | 0.7984 |
| Bi-LSTM | Absolute Change (Δ) | 0.0904 | 0.0413 | −0.0904 | 0.0469 | 0.0413 |
| Bi-LSTM | *Performance Drop* | 9.81% | 5.46% | **113.43%** | 3.40% | 5.46% |
| FFNN | Erroneous Axes | 0.9933 | 0.7591 | 0.0067 | 1.4156 | 0.7591 |
| FFNN | Absolute Change (Δ) | 0.1170 | 0.0307 | −0.1170 | 0.0627 | 0.0307 |
| FFNN | *Performance Drop* | 13.36% | 4.21% | **94.58%** | 4.63% | 4.21% |

**The R² percentages are an artifact and should be ignored.** Since R² = 1 − MSE, the *absolute* change in
R² is identical to the absolute change in MSE — look at the Δ rows: Bi-LSTM axis-removal Δ is 0.0422 for
both MSE and R²; FFNN 0.0605 for both. The "112.53% R² boost" is the same 0.0422 divided by a
near-zero baseline R² of 0.0375. **The honest statement of the ablation is: removing axis features costs
4.6% (Bi-LSTM) / 6.9% (FFNN) MSE; shuffling axis order costs 9.8% / 13.4% MSE — on a model that explains
~12% of variance in the first place, measured on 129 test samples, single run, no seeds, no CIs.**
The paper leads with "R² nearly doubles" in three separate places (§5.4, Appendix F conclusion,
Appendix G conclusion). That is the paper's weakest rhetorical move.

**Numerical inconsistencies across the paper's own tables** (worth logging, they indicate low care):
- §3.2 main text: "removing axis features increases MSE by **4.57%**." Table 7 and Table 12: **4.59%**.
- §5.4 / Appendix G text: "Bi-LSTM MSE increases by **9.81%**." Table 7: **9.83%**. Table 13: **9.81%**.
- Figure 4 diagonals are 0 while the text claims agreement counts are on the diagonal.
- Appendix H says FFNN hyperparameters were grid-searched over dropout / L1 / weight decay, then says
  "Other parameters were fixed at: dropout = 0.0, L1 = 0.001, weight decay = 0.0."

The *directional* finding — that structured auxiliary input helps, and that scrambling its order hurts
more than removing it — is plausible and the shuffle control is a genuinely good cheap experiment design.
The effect sizes are not trustworthy.

### 4.6 Distribution-family selection — Table 11 (Appendix D), transcribed

Average RMSE across six synthetic scenarios. All fitted with a free scaling factor `S` enforcing AUC = 1.
Lower is better. Bold = best (skew-normal in all six).

| Distribution | S1 | S2 | S3 | S4 | S5 | S6 | Parameters |
|---|---|---|---|---|---|---|---|
| Gaussian | 0.0709 | 0.0673 | 0.0424 | 0.0273 | 0.1193 | 0.0806 | (μ, σ) |
| Exponential | 0.2103 | 0.2291 | 0.2312 | 0.2704 | 0.2126 | 0.2212 | (λ) |
| Log-normal | 0.0844 | 0.0597 | 0.0804 | 0.0325 | 0.0872 | 0.0919 | (μ, σ) |
| Gamma | 0.0827 | 0.0623 | 0.0668 | 0.0307 | 0.0968 | 0.0899 | (k, θ) |
| **Skewed Normal** | **0.0514** | **0.0357** | **0.0407** | **0.0224** | **0.0505** | **0.0247** | (ξ, ω, α) |

**Table 10 — the six scenarios, transcribed verbatim** (each is 5 annotation points on a base-1.1 log axis):

| Scenario | Sample Sentence | Annotation Points (x, y) |
|---|---|---|
| S1: Early Onset | "He is making coffee for himself right now." | (14.91, 0.19), (21.64, 0.41), (27.64, 0.77), (31.64, 0.41), (34.91, 0.20) |
| S2: Late Onset | "The movie is going to hit the theaters in a few weeks." | (93.75, 0.21), (100.67, 0.80), (106.57, 0.42), (112.73, 0.20), (98.0, 0.63) |
| S3: Short Duration | "The site has been crashing for a few minutes as there is some server maintenance work going on." | (12.73, 0.21), (28.19, 0.80), (41.28, 0.20), (32.19, 0.60), (18.91, 0.40) |
| S4: Long Duration | "The ruling government brings growth and progress." | (1, 0.05), (130.38, 0.81), (147.84, 0.21), (111.29, 0.42), (138.38, 0.60) |
| S5: Rapid Rise, Slow Decay | "The advertisement's impact peaks immediately and lingers." | (42.73, 0.21), (46.91, 0.40), (53.10, 0.80), (63.46, 0.56), (81.83, 0.27) |
| S6: Slow Rise, Rapid Decay | "The news slowly gains attention but quickly becomes outdated." | (43.28, 0.20), (58.01, 0.40), (76.92, 0.79), (84.92, 0.40), (88.92, 0.17) |

The scenarios vary along three declared dimensions: **offset** (peak position), **duration** (span of
validity), and **asymmetry** (skew in rise and decay). Figure 6 plots all five candidate fits per scenario.

**Why this comparison proves almost nothing:** each scenario is **5 hand-drawn points**. Skew-normal has
**3 free parameters** plus the scaling factor `S`; Gaussian has 2 plus `S`; Exponential has 1 plus `S`.
Fitting 4 free parameters to 5 points is near-interpolation. No held-out points, no cross-validation, no
information criterion (AIC/BIC would have been trivial and would have penalized the extra parameter). The
"skew-normal consistently yields the lowest RMSE" conclusion is exactly what you'd predict from parameter
counting alone. The one thing the table does show honestly is that **Exponential is badly wrong** (RMSE
0.21–0.27, 4–10× worse than everything else) — i.e. **pure memoryless decay from t=0 does not describe
how humans think validity behaves.** That negative result is the useful part, and it is a real argument
against the naive "confidence decays exponentially from assertion time" heuristic.

### 4.7 Hyperparameters (Appendix H) — transcribed for reproducibility

All models grid-searched on the validation split of each benchmark. Non-BERT neural models: 100 epochs
with early stopping on validation loss. BERT: 50 epochs.

- **SVR:** searched `C ∈ {0.1, 1, 10}`, `ε ∈ {0.01, 0.1, 1}`, `kernel ∈ {linear, rbf}`.
  Final (both benchmarks): **rbf, C = 1, ε = 1** (Table 14).
- **Linear Regression:** searched `fit_intercept ∈ {True, False}`. Final: **False** on both (Table 15).
- **XGBoost:** searched `n_estimators ∈ {50, 100}`, `max_depth ∈ {3, 5}`, `lr ∈ {0.1, 0.01}`.
  Final (both): **n = 50, depth = 3, lr = 0.1** (Table 16).
- **FFNN:** searched hidden `∈ {64, 128, 256}`, dropout `∈ {0.0, 0.2, 0.5}`, lr `∈ {0.01, 0.001, 0.0001}`,
  L1 `∈ {0.0, 0.0001, 0.001}`, weight decay `∈ {0.0, 0.001, 0.01}`.
  Final: **BI hidden 64, lr 0.001; BII hidden 256, lr 0.01**; others fixed at dropout 0.0, L1 0.001,
  weight decay 0.0 (Table 17).
- **Bi-LSTM:** searched hidden `∈ {64, 128, 256}`, lr `∈ {0.01, 0.001, 0.0001}`.
  Final (both): **hidden 64, lr 0.0001** (Table 18).
- **BERT Regression:** searched dropout `∈ {0.0, 0.2, 0.4}`, lr `∈ {0.0001}`.
  Final: **no dropout, lr 0.0001**. (The "grid" over lr is a single value.)

---

## 5. Limitations

### 5.1 The authors' own (§7, verbatim headings)

1. **Unimodal Temporal Representation.** Single-peaked distribution; cannot represent events with
   multiple distinct periods of relevance, such as seasonal or recurring phenomena. (They justify it as
   aiding interpretability and efficient annotation.)
2. **Sentence-Level Context Only.** Short, self-contained sentences without document-level or historical
   context. Limits modeling of long-range temporal dependencies and evolving narratives; constrains
   discourse-level temporal reasoning.
3. **No Atemporality Indicators.** No explicit labels for atemporal or universally valid facts,
   introducing ambiguity between permanently valid and time-sensitive information.
4. **Minimum Validity Constraint from Log Time Scale.** The logarithmic axis imposes a lower bound of one
   minute, making it unsuitable for events that become instantly obsolete (flash updates, ephemeral
   statements).

Note the internal contradiction: limitation 1 (no multimodality) directly contradicts §3.1's claim that
the model permits "intermittent resurgences." A unimodal skew-normal cannot express a resurgence. Also,
having a `Recurrent` axis in the taxonomy while forbidding multimodal curves is incoherent — a recurrent
event's validity profile is definitionally multimodal, and they simply discard those samples.

### 5.2 Limitations they understate or omit

5. **Everything is synthetic and nothing is externally validated.** All 1,778 samples are GPT-o1 output.
   All target curves are undergraduate students' *intuitions* about how long a made-up sentence stays true,
   drawn freehand on a chart. There is no corpus of real statements with observed expiry, no gold
   ground truth about when any fact actually ceased holding, and no downstream task validating that a
   better `(ξ, ω, α)` prediction improves anything. The benchmark measures agreement with student
   intuition about LLM-generated sentences. That is a legitimate first step, but it is not "a sense of time."
6. **The achieved IAA misses the paper's own thresholds** (§3.4 above): ICC 0.843/0.893 vs threshold > 0.90;
   Jaccard 0.624/0.731 vs > 0.75; P_k 0.233 (BI) vs < 0.15. Never acknowledged.
7. **Axis-label agreement is only "fair."** Cohen's κ = 0.3291, precision 0.4443; even after merging the
   two worst classes, κ = 0.3866. The abstract's "84% and 89%" hides this entirely.
8. **The evaluation suite is three metrics dressed as six.** R² = 1 − MSE identically; NLL ≈ 0.9189 + MSE/2;
   CRPS ≡ MAE. "Calibration" is claimed as an evaluation dimension but is not evaluated.
9. **Headline effect sizes are denominator artifacts.** "R² boosts of 95–113%" are 4.6–13.4% MSE changes
   divided by a baseline R² of 0.0375–0.0632.
10. **The BERT result is a probable bug reported as a finding** (§4.4 above), and a narrative is built on it.
11. **Distribution-family selection is parameter counting on 5 points per scenario** (§4.6), with no AIC/BIC,
    no held-out points, no cross-validation.
12. **Statistical power is absent.** Test sets of 129 and 55, single runs, no seeds, no confidence intervals,
    no significance testing. FFNN vs Bi-LSTM on BII differs by 0.0013 MSE — meaningless at n = 55.
13. **Models are given gold segmentation and gold axis labels at inference.** "Segmentation and axis labels
    are treated as preprocessing and not modeled at inference." So the reported numbers presuppose an
    oracle upstream annotator whose real-world agreement is κ = 0.33. An end-to-end system would be
    substantially worse, and the paper never estimates by how much.
14. **Eq. 4 is mathematically incorrect** (§1.1) and the object's identity is unstable across the paper —
    "probability distribution" (abstract, §3.1) → AUC-normalized density (Appendix D step 2) → max-rescaled
    "proportional validity curve" that is explicitly *not* a distribution (Appendix D step 3).
15. **The time origin is publication, and there is only one of them.** No absolute calendar anchoring, no
    notion of when a claim was *recorded* vs when it was *true*, no revision, no supersession. A curve is
    fixed at annotation time and never updated by later evidence. This is the decisive gap for us.
16. **The temporal center of mass is ~3 hours** (§3.8). The corpus carries no signal about validity
    horizons measured in months or years.
17. **The released JSON has no character spans and no recorded log base** (§3.9) — both are correctness
    hazards for any reuse.

---

## 6. Relevance verdict for a bitemporal claim/edge authority

The question I was asked: does Chronocept's temporal object add anything a two-axis bitemporal interval
model does not already capture?

**Short answer: mostly no. It is a refinement of ONE of the two bitemporal axes, and it is silent on the
other. Verdict: largely orthogonal, with two extractable ideas and one anti-pattern to avoid.**

### 6.1 The axis mapping, stated precisely

A bitemporal model carries two independent axes:
- **Valid time** `[vt_start, vt_end)` — when the claim was true in the world.
- **Transaction time** `[tt_start, tt_end)` — when the system believed it.

Chronocept carries **one** axis: `t = elapsed time since publication`, with a graded profile `p(t)` on it.
There is a single anchor ("publication") which conflates assertion and onset, and there is **no transaction
axis at all**. Nothing in the paper models revision, supersession, retraction, correction, or "what did we
believe on date D." Contradiction is never mentioned. There is no notion of two claims disagreeing.

So Chronocept is not a competing or richer temporal model. It is a **soft replacement for the valid-time
interval's shape**: instead of a crisp `[start, end)`, a unimodal plausibility bump over log-elapsed-time.

### 6.2 What it genuinely adds over a crisp valid-time interval

Three things, and they are real:

1. **Gradedness with an explicit rise, not just a decay.** A crisp `[vt_start, vt_end)` has hard edges. A
   skew-normal has a *rise* (delayed onset — the claim becomes true some time after it was asserted, e.g.
   "the movie hits theaters in a few weeks") and an *asymmetric decay*. Delayed onset is expressible in
   bitemporal (`vt_start > tt_start`), but the *uncertainty about where the edges are* is not. Chronocept's
   `ω` and `α` are, in effect, a compact encoding of edge fuzziness plus decay asymmetry.
2. **Three floats instead of two timestamps, comparable and rankable.** `(ξ, ω, α)` is cheap to store,
   cheap to compare, cheap to rank. If we ever want a "how confident are we that this claim still holds at
   time T" score for retrieval ranking or staleness triage, a parametric shape gives it directly, whereas
   a crisp interval gives a step function.
3. **The log-time axis with base-invariance.** `t' = ln(t)/ln(b)`, base 1.1 in minutes, with the exact
   conversion rules `ξ^(b) = (ln m/ln b)·ξ^(m)`, `ω^(b) = (ln m/ln b)·ω^(m)`, `α` invariant. This makes
   minutes-to-decades commensurable in a bounded numeric range where a Gaussian-family width is meaningful
   at every scale. **This is the single most portable piece of the paper** and it is completely independent
   of everything else in it — you can adopt the log-time parameterization without adopting the skew-normal,
   the axes, the dataset, or the benchmark. If we ever attach a decay/staleness profile to a claim, this is
   how to parameterize it, and the base should be a recorded field on the record (which they failed to do).

### 6.3 What it does NOT add

- **No transaction time.** Not modeled, not mentioned, not a limitation they list.
- **No decomposition of "when" into subaxes.** The eight "temporal axes" are modality categories, not
  temporal subaxes. Anyone reading only the abstract will get this wrong.
- **No multimodality** — explicitly excluded at annotation time, so "valid, then invalid, then valid again"
  (the exact shape of an amended claim, a reinstated status, a renewed term) is out of scope by construction.
- **No absolute calendar anchoring.** Everything is relative to a single publication instant. There is no
  way to say "true from 2019-03-01 to 2021-11-14."
- **No revision, supersession, or contradiction.** A curve is stamped once and never updated. There is no
  operation for "new evidence arrived; update the profile."
- **No edge/relationship temporality.** Everything is sentence-level. There is no graph, no edge, no
  entity, no relation.
- **No atemporality.** Their own limitation 3: no way to mark a claim as permanently valid.
- **No signal at our time horizons.** Corpus mean peak ≈ 3 hours (§3.8).

### 6.4 The one idea worth stealing for contradiction triage

The MATRES eight-axis modality taxonomy is a **claim-modality gate** and it maps directly onto
contradiction triage, which is our actual problem:

Two claims that textually conflict are **not** a contradiction if they sit on different modality axes.
"They intend to file by March" (Intention) does not contradict "the filing occurred in June" (Main).
"Experts believe the market will grow" (Opinion) does not contradict "the market shrank" (Main).
"If funding arrives, the printer will be replaced" (Hypothetical) contradicts nothing. "The company did
not expand into Asia" (Negation) is a claim about a non-event and needs different handling than a positive
claim. **A modality label on each claim is a cheap pre-filter that should suppress a large fraction of
false-positive contradictions before any expensive reconciliation runs.**

Caveats before porting it:
- Drop or redefine **Static**. Their own confusion matrix shows it absorbing everything (102 with Generic,
  90 with Recurrent, 70 with Opinion, 63 with Negation). It is a catch-all.
- Their **Generic + Static merge** is the right call — do it from the start (their Table 8 shows precision
  0.4443 → 0.5243 and κ 0.3291 → 0.3866 from the merge alone).
- Even merged, human κ = 0.39. Do not expect a classifier to do better than the label noise. Treat the
  modality label as a **soft prior on triage routing**, never as a hard gate that silently drops a real
  contradiction.
- The taxonomy's provenance is Ning et al. 2018 (ACL), not Chronocept — cite the source if we adopt it.

### 6.5 The evaluation methodology — one good idea, one anti-pattern

**Good:** the **shuffle ablation** (Appendix G). Removing a structured feature tells you whether the model
uses it at all; *shuffling its order while keeping it present* tells you whether the model uses the
*structure* or just the bag of content. Shuffling hurt more than removing (9.8% vs 4.6% for Bi-LSTM;
13.4% vs 6.9% for FFNN), which is the interesting result: misaligned structure is worse than no structure,
because it injects inductive noise. That control is cheap and worth adopting for any structured-input
model we build.

**Anti-pattern to avoid:** their metric suite. Do not report R² alongside MSE on Z-normalized targets
(they are the same number), do not report NLL for a point-estimate model and call it calibration, do not
report CRPS for a deterministic forecast (it is MAE), and never headline a relative percentage change in a
quantity whose baseline is near zero. If we ever build a temporal-confidence regressor, report MSE, MAE,
Spearman, an explicit predict-the-mean baseline, and confidence intervals over seeds.

### 6.6 Bottom line

**Orthogonal, low-to-moderate value.** Chronocept does not challenge or extend a two-axis bitemporal model;
it refines the *shape* of one axis while ignoring the other entirely, on a corpus whose temporal horizon is
hours and whose ground truth is undergraduate intuition about GPT-generated sentences. Its models explain
~13% of variance. Nothing about its benchmark, dataset, or results transfers.

Three concrete takeaways worth carrying forward, in descending order of value:
1. **The log-time parameterization** (`t' = ln(t)/ln(1.1)` over minutes, with `α` base-invariant and the
   base recorded on the record) — if we ever attach a graded staleness/confidence profile to a claim,
   this is the right encoding. Adopt independently of everything else here.
2. **The MATRES eight-axis modality taxonomy as a contradiction-triage pre-filter** (merge Generic+Static,
   drop or redefine Static, treat as a soft prior). Credit Ning et al. 2018.
3. **The shuffle-vs-remove ablation pair** as a standard control for any structured-input model.

One negative result worth remembering: **exponential decay from t=0 fits human intuition badly** (Table 11,
RMSE 0.21–0.27 vs 0.02–0.05 for every other family, across all six scenarios). If we ever reach for a
"confidence decays exponentially since assertion" heuristic, this is a cheap citation against it.
