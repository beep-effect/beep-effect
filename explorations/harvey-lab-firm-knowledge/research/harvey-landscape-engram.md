# Engram as prior art for amortized corpus representations

**Date:** 2026-08-08
**Packet:** `explorations/harvey-lab-firm-knowledge`
**Lens:** external landscape — verify and characterize Engram (the C&H collaborator),
its published research lineage, its likely productization path, and where a
schema-first deterministic-KG approach is differentiated vs dominated.
**Closes:** [`verify-completeness.md`](./verify-completeness.md) §G4 ("Engram is
unmined, and it is the collaborator with a published, competing answer to the
packet's central bet").

Every external claim below carries a URL that was actually fetched in this pass.
Claims that could not be verified are marked **UNVERIFIED**. Arithmetic that is
mine (not from a source) is marked **[own calc]**.

---

## 0. Recommendation up front

**Engram is real, funded, technically strong, and betting on train-time
distillation — and it does not dominate beep on the axes beep actually needs.**

Three findings drive the judgment:

1. **The "$98M" in the prior pass is CONFIRMED**, and the picture is sharper than
   the snippet: $98M Series A, ~$600M post, 13 people, six founders including
   Chris Ré and Scott Linderman, customers Microsoft / Notion / **Harvey**.
   Engram is not a peer-of-beep; it is a research-lab-shaped infrastructure
   company selling *into* Harvey.
2. **Their method is a lossy, amortized, opaque representation.** Cartridges is
   a trained KV cache (prefix-tuning), model frozen, ~30 min on an 8×H100 node
   per corpus, validated at **100k–484k tokens**. C&H is **~100M tokens** — about
   **200× beyond the published operating point** [own calc]. Nothing in the
   published work addresses provenance, completeness guarantees, targeted
   deletion, or per-user permission scoping.
3. **The C&H rubric design is adversarial to exactly that weakness.** The
   benchmark's signature idiom is the terminal **closure/precision criterion**
   ("does not assert any matter outside this list" — 140 singleton instances per
   [`map-task-census.md`](./map-task-census.md) / [`map-evaluation.md`](./map-evaluation.md))
   and enumeration tasks. A distilled cache has no notion of *extent*; it cannot
   certify "these are all of them." A deterministic projection over a typed table
   can, by construction.

**Strategic posture: complement, not compete.** The Cartridges paper's own
ablations show that the *structure of the self-study curriculum* is a first-order
lever (seed-prompt diversity alone: 24.1 → 32.0 chrF on MTOB; context distillation
vs next-token: 24.9 → 33.5). A schema-first KG with provenance is a *better
self-study curriculum generator* than raw OOXML. beep's differentiated position is
**the deterministic, auditable substrate underneath an amortized representation** —
not a competing amortized representation.

---

## 1. Engram, the company — verified facts

| Fact | Value | Source |
|---|---|---|
| Funding | **$98M** | [PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html), [Kleiner Perkins](https://www.kleinerperkins.com/perspectives/engram-giving-enterprise-ai-a-memory/), [VKTR](https://www.vktr.com/ai-news/engram-launches-with-98m-to-give-enterprise-ai-memory/) |
| Round type | **Series A** | [Kleiner Perkins](https://www.kleinerperkins.com/perspectives/engram-giving-enterprise-ai-a-memory/) ("$98M Series A"); [VKTR](https://www.vktr.com/ai-news/engram-launches-with-98m-to-give-enterprise-ai-memory/) |
| Valuation | **$600M** | [VKTR](https://www.vktr.com/ai-news/engram-launches-with-98m-to-give-enterprise-ai-memory/) |
| Headcount at launch | **13** | [VKTR](https://www.vktr.com/ai-news/engram-launches-with-98m-to-give-enterprise-ai-memory/) |
| Emergence from stealth | **2026-06-23** | [PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html), [Kleiner Perkins](https://www.kleinerperkins.com/perspectives/engram-giving-enterprise-ai-a-memory/), [General Catalyst](https://www.generalcatalyst.com/stories/our-investment-in-engram) |
| Co-leads | General Catalyst + Modern Capital | [VKTR](https://www.vktr.com/ai-news/engram-launches-with-98m-to-give-enterprise-ai-memory/) |
| Other investors | Kleiner Perkins, Sequoia, Factory, Amplify Partners, Neo | [PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html) |
| Angels / advisors | Andrej Karpathy, Assaf Rappaport (Wiz), Pieter Abbeel (BAIR) | [PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html) |
| Customers / partners | **Microsoft** (M365 pilot), **Notion** (custom agents), **Harvey** (firm knowledge) | [PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html), [engram.com](https://engram.com) |
| Founding year | 2025 (Sequoia listing) — precise month **UNVERIFIED** (one secondary source says "founded in October") | [Sequoia](https://sequoiacap.com/companies/engram/) |

### Founders (six)

| Person | Background | Signature work |
|---|---|---|
| **Dan Biderman** — CEO | Columbia PhD (Center for Theoretical Neuroscience); Stanford postdoc under Chris Ré | LoRA-scaling / continual-learning line |
| **Sabri Eyuboglu** — CTO | Stanford PhD under Chris Ré | **Cartridges** (first author) |
| **Jessy Lin** | Berkeley PhD; Meta FAIR | **Active Reading**, **Sparse Memory Finetuning** (first author on both) |
| **Jack Morris** | Cornell PhD; Meta FAIR | embedding inversion / retrieval + memorization |
| **Scott Linderman** | Tenured Stanford professor (statistics + neuroscience) | state space models |
| **Chris Ré** | Stanford; Hazy Research | BASED, Monarch, the whole Hazy efficiency line |

Sources: [PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html),
[Kleiner Perkins](https://www.kleinerperkins.com/perspectives/engram-giving-enterprise-ai-a-memory/),
[Sequoia](https://sequoiacap.com/companies/engram/).

### The C&H contributor list, resolved

The five Engram names in the C&H acknowledgments
(`assets/x-post-itsjuliopereyra-2085772997944803682.md:66`) resolve as:

- **Dan Biderman** — CEO (above).
- **Jessy Lin** — founder (above).
- **Mayee Chen** — Stanford CS PhD, Hazy Research; data-mixing work (**Skill-it!**
  NeurIPS 2023, **Aioli** ICLR 2025 [arXiv:2411.05735](https://arxiv.org/abs/2411.05735)).
  She is also in the *Cartridges* acknowledgments (p.12). Her specialty — choosing
  what data to train on, in what proportion — is precisely the "what do we feed
  self-study" problem.
- **Neel Guha** — **Associate Professor of Law, Columbia Law School** (joined
  2026-07-01), completing a Stanford CS PhD; co-author of **LegalBench** (NeurIPS
  2023 D&B) — [Columbia faculty page](https://www.law.columbia.edu/faculty/neel-guha).
  He is *also* a **Cartridges co-author** (arXiv:2506.06266, author #4). The
  Columbia page does not mention Engram; the C&H post lists him as
  "Columbia Law School / Engram". So the single person who wrote the standard
  legal-reasoning benchmark is on both the amortized-memory method paper and the
  legal-corpus benchmark. **This is the most important structural fact in this
  report** — it is not a coincidence that the benchmark's conclusion is Engram's
  product thesis.
- **Shizhe He** — LinkedIn headline reads "teaching machines at Engram". Other
  affiliation details surfaced in search are inconsistent and **UNVERIFIED**.

### Engram's own words on mechanism

From [engram.com](https://engram.com) (headline verbatim): *"AI has learned the
world. Now it should learn yours."* The site describes starting "from strong
pre-trained models" and spending "training compute on the context you care
about", running "a single training algorithm that can absorb arbitrary amounts of
data into a model that gets continually better", and states they currently
**retrain on all company data daily, moving to hourly and eventually minute-level**.

From the [Sequoia *Training Data* podcast](https://sequoiacap.com/podcast/memory-and-continual-learning-engrams-dan-biderman-and-jessy-lin/)
(episode 90):

- Lin: *"we do a lot of adapter fine-tuning, so adapters of many types...whether
  it's LoRAs or prefixes or sparse architectures."*
- Training signal: *"supervised fine-tuning, RL, on-policy distillation."*
- Biderman on the motivating waste: a KV cache for a single Wikipedia article
  *"will be like 80 gigabytes of HBM memory"*, with offline compression proposed
  to make the cache *"1,000x smaller"*.
- Crucially, on retrieval: Biderman — *"our models always work under the
  assumption that some knowledge is externalized, some tools are always there."*
  **They do not claim to replace retrieval.**
- Governance, deletion, permissions, provenance, knowledge graphs, structured
  indexes: **not addressed anywhere in the episode.**

[General Catalyst](https://www.generalcatalyst.com/stories/our-investment-in-engram)
states the thesis as *"a bigger filing cabinet is not the same as learning"* and
names the research lineage explicitly: **BASED, Cartridges, LoRA, Minions, Active
Reading, and Sparse Memory Finetuning**.

### ⚠ Namesake disambiguation

Several unrelated things are called "Engram". None of the following are verified
as the company:

- [arXiv:2606.14997](https://arxiv.org/abs/2606.14997) "AI Engram: In Search of
  Memory Traces in Artificial Intelligence" (Kwon, Kim, Kim, Kim, Kook, Cha;
  2026-06-12; ICML 2026 oral) — **different group; no Engram-company author
  appears on the abstract page.** Ironically its content (composing/erasing
  memories by linear arithmetic) is closer to what beep would want than Engram's
  own work is.
- arXiv:2511.12960 "ENGRAM: Effective, Lightweight Memory Orchestration for
  Conversational Agents" — acronym collision, **UNVERIFIED** relation.
- `engram.org`, `engram-ai.dev`, `engramme.com`, MCP servers named "engram" —
  unrelated. The company is **`engram.com`**, X handle **@EngramLab**.

---

## 2. The research lineage, actually read

### 2.1 Cartridges — [arXiv:2506.06266v3](https://arxiv.org/abs/2506.06266) (full PDF read)

**Eyuboglu, Ehrlich, Arora, Guha, Zinsley, Liu, Tennien, Rudra, Zou, Mirhoseini, Ré**
(Stanford / Caltech / Buffalo), v1 2025-06-06, v3 2025-06-13. Code:
[HazyResearch/cartridges](https://github.com/HazyResearch/cartridges), Apache-2.0.

**What it actually is** (§3.2, verbatim): *"We parameterize Z using a simplified
version of prefix-tuning... Critically, we freeze all parameters of the model,
only training the key and value vectors in Z."* A Cartridge is **a trained KV
cache**, not a weight delta, not an index, not embeddings. At inference it is
loaded into the KV-cache slots of an ordinary inference server — §3.3 notes this
*"contrasts with other methods like LoRA, which require custom infrastructure to
serve efficiently to multiple users."*

**SELF-STUDY** = (1) chunk the corpus into 512–4096-token subcorpora, put a chunk
in context, and have the model **converse with itself** about it using one of five
generic seed prompt types (structuring / summarization / question / use cases /
creative); (2) train Z with a **context-distillation** (KL to the in-context
teacher) objective, not next-token prediction.

**Headline results** (abstract): match ICL while using **38.6× less memory** and
**26.4× higher throughput**; extend effective context **128k → 484k** on MTOB;
Cartridges **compose at inference time without retraining**.

**Details that matter for our judgment:**

| Fact | Value | Where |
|---|---|---|
| Corpus sizes evaluated | **100k–484k tokens** | §5 Datasets |
| Benchmarks | LongHealth, MTOB, QASPER, GenConvo (from FinanceBench) | §5 |
| Base models | Llama-3.2-3B, Llama-3.1-8B | §5, Fig 3 |
| One cartridge per dataset | *"we train a single Cartridge per dataset"* | §5 Datasets |
| **Training cost** | *"training an ICL-quality Cartridge takes ∼ 30 minutes on a single 8×H100 node (for Llama-8B)"* | §6 |
| Naive next-token training | memorizes *perfectly*, 107× less memory, **but "degrade[s] the LM's ability to respond to diverse questions beyond regurgitating the corpus"** | §1 |
| Memory savings vs ICL | up to **10×** (LongHealth), up to **100×** (QASPER) | §5.1 |
| MTOB gain over ICL | **+11.0 chrF** over ICL on first 130k tokens | §1, §5.2 |
| KV-cache vs LoRA ablation | prefix-tuning **beats** memory-matched LoRA by **4.5 chrF** on MTOB; and LoRA catastrophically damages off-corpus ability — MMLU **54.7 → 45.3** as size grows, vs prefix-tuning **54.7 → 54.3** | §5.3 |
| Initialization is critical | LongHealth **29.9%** (random vectors) → **51.3%** (random-token KV) → **55.3%** (first-p-token KV) | §5.3 |
| Seed-prompt diversity | MTOB **24.1 → 32.0** chrF; LongHealth **43.6 → 48.4** | §5.3 |
| Objective ablation | context-distillation vs next-token: MTOB **24.9 → 33.5** chrF | §5.3 |
| Composition | two independently trained 10-K cartridges concatenated, **no retraining**: composed **1.2 GB** beats truncated ICL at **39.8 GB** on multi-doc QA | §5.4, Fig 7 |
| Stated limitation | *"SELF-STUDY is not without limitations. Using SELF-STUDY to produce a KV-cache is much more costly than simply running standard ICL pre-fill... our work does not provide a drop-in replacement for ICL"* | §6 |

**What the paper never mentions:** provenance / citation of a source span,
completeness or coverage guarantees, corpus updates (what happens when a document
changes), deletion or unlearning, per-user access control, or auditability. Not
as unsolved problems — they are simply outside its frame. The word "amortized" in
the abstract refers only to compute cost across queries.

**Independent follow-up:** [arXiv:2508.17032](https://arxiv.org/abs/2508.17032)
"Learned Structure in Cartridges: Keys as Shareable Routers in Self-Studied
Representations" (Maurizio Diaz, 2025-08-23, rev 2025-11-07 — **not an Engram
author**) finds that cartridge *keys* act as stable, transferable retrieval
routers while *values* carry the compression, reports up to 40× inference memory
reduction, and introduces Sampled Chunk Initialization for faster convergence.
Read charitably: a cartridge is *learning an implicit index*. That is a real
convergence signal with beep's explicit-index approach — the difference is that
theirs is uninspectable.

### 2.2 Active Reading — [arXiv:2508.09494](https://arxiv.org/abs/2508.09494)

**Jessy Lin, Vincent-Pierre Berges, Xilun Chen, Wen-Tau Yih, Gargi Ghosh, Barlas
Oğuz** (FAIR at Meta / UC Berkeley), 2025-08-13.

A *different* mechanism from Cartridges: this trains **weights**, not a KV cache.
Models are trained to "study a given set of material with **self-generated
learning strategies**". Verbatim results from the abstract:

- expert **8B** models reach **66%** on a Wikipedia-grounded subset of SimpleQA
  (**+313% relative** over vanilla finetuning);
- **26%** on FinanceBench (**+160% relative**);
- released **Meta WikiExpert-8B**, trained on **1 trillion generated tokens**,
  which *"outcompetes models with hundreds of billions of parameters on factual QA"*.

Note the scale asymmetry: **1 trillion synthetic tokens** to make one 8B model a
Wikipedia expert. This is the pre-training-scale end of the same idea. The
framing is explicitly about the reliability problem — *"Practitioners are lacking
tools which will allow them to ensure that the models learn a given body of
knowledge reliably and consistently."* That is an honest statement that
parametric knowledge is *not* currently reliable, from the person who built the
best fix for it.

Even after the fix: **66%** on a Wikipedia-grounded SimpleQA subset. For a
conflicts check, 66% is not a number you can practice law on.

### 2.3 Sparse Memory Finetuning — [arXiv:2510.15103](https://arxiv.org/abs/2510.15103)

**Jessy Lin, Luke Zettlemoyer, Gargi Ghosh, Wen-Tau Yih, Aram Markosyan,
Vincent-Pierre Berges, Barlas Oğuz**, 2025-10-16. Updates only memory slots highly
activated by new knowledge relative to pretraining usage. Forgetting on
NaturalQuestions F1 after learning new facts: **full finetuning −89%**, **LoRA
−71%**, **sparse memory finetuning −11%**.

This is the *continual update* leg of the product — the answer to "what happens
when the firm files a new brief." It is also, notably, the closest published work
to *targeted* memory manipulation, which is what deletion/revocation would need.
But an 11% collateral drop is still collateral damage: a system that forgets 11%
of unrelated capability every time you update it is not a records system.

### 2.4 Team's adjacent work (context, not core)

- **Mayee Chen** — Skill-it! (NeurIPS 2023), Aioli
  ([arXiv:2411.05735](https://arxiv.org/abs/2411.05735), ICLR 2025), Olmix.
  Data-mixing optimization: which data, in what proportion, when.
- **Jack Morris** — "Text Embeddings Reveal (Almost) As Much As Text"
  ([arXiv:2310.06816](https://arxiv.org/abs/2310.06816), EMNLP 2023 Outstanding
  Paper; recovers 92% of 32-token inputs exactly). This is the **embedding
  inversion / privacy** expertise — relevant because it means Engram knows
  perfectly well that a learned representation can leak its source text. A firm-wide
  cartridge is, on this team's own published evidence, a potential
  confidentiality-boundary object.
- **Neel Guha** — LegalBench; Columbia Law; Cartridges co-author (see §1).

---

## 3. What this implies they will productize

**Verdict: train-time distillation, continuously re-run, served as adapters
alongside (not instead of) retrieval and tools.**

Evidence, ordered by strength:

1. **Their own site:** "a single training algorithm that can absorb arbitrary
   amounts of data into a model that gets continually better", retraining
   **daily → hourly → minute-level** ([engram.com](https://engram.com)).
2. **The CTO's podcast answer:** adapters of many types — *"LoRAs or prefixes or
   sparse architectures"* — trained via SFT / RL / on-policy distillation
   ([Sequoia podcast](https://sequoiacap.com/podcast/memory-and-continual-learning-engrams-dan-biderman-and-jessy-lin/)).
   "Prefixes" is Cartridges; "sparse architectures" is Sparse Memory Finetuning;
   "LoRAs" is the fallback. They are shipping a *portfolio* of parameterizations,
   not one.
3. **The investor lineage list:** BASED, Cartridges, LoRA, Minions, Active
   Reading, Sparse Memory Finetuning ([General Catalyst](https://www.generalcatalyst.com/stories/our-investment-in-engram)) —
   every item is a training-time method. **No index, no graph, no store.**
4. **The pitch metric is tokens, not accuracy:** "1–10% of the tokens", "up to
   100× fewer tokens" ([PRNewswire](https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html),
   [engram.com](https://engram.com)). The wedge they are selling into Microsoft/
   Notion/Harvey is **inference economics at enterprise-context scale**, with
   quality parity as the constraint — not quality *above* frontier.
5. **They explicitly keep retrieval:** Biderman — *"our models always work under
   the assumption that some knowledge is externalized, some tools are always
   there."* So the product is a *learned prior over your corpus* that reduces how
   much you must retrieve, not a replacement for the corpus.

**What they are NOT building, on all public evidence:** a governed store of
facts/entities/decisions with revocation. A third-party consultancy page markets
an "Engram Enterprise" with "governable and revocable" facts and a "15% to 92%"
accuracy claim; that page is **not** engram.com and its relationship to the
company is **UNVERIFIED** — do not repeat those numbers.

**Timeline for the legal wedge.** The C&H post ends *"We'll be sharing more about
our work here soon"* (`assets/x-post…md:62`), the partnership
[predates the dataset release](https://cryptobriefing.com/engramlab-harvey-open-source-synthetic-law-firm/)
(2026-08-07), and Harvey is a named Engram customer at launch. **Expect an
Engram+Harvey result on C&H within the next few months.** If beep publishes on
C&H, that is the comparison it will be read against — exactly the risk
[`verify-completeness.md`](./verify-completeness.md) §G4 flagged.

---

## 4. The scale gap — [own calc]

The C&H corpus is ~**100M tokens** (announcement; corroborated at
["more than 100 million tokens"](https://cryptobriefing.com/engramlab-harvey-open-source-synthetic-law-firm/)).
Cartridges' largest evaluated corpus is **484k tokens**.

- **Ratio:** 100,000,000 / 484,000 ≈ **206×**.
- **Naive linear training-cost extrapolation:** 206 × 30 min ≈ **103 hours on an
  8×H100 node** ≈ **~825 H100-hours** per full-firm cartridge. At daily retraining
  ([engram.com](https://engram.com)), that is a continuously-occupied 8×H100 node
  per firm.
- **Why this is a floor, not an estimate:** Figure 5 shows quality still climbing
  with training steps at every cartridge size — the 30-minute figure is
  "ICL-quality" *for that corpus at that cache size*. Holding per-fact recall
  fixed while the corpus grows 206× plausibly needs **superlinear** steps and a
  larger `p`. And a larger `p` eats the memory win: the paper's cartridges live at
  ~0.15–1.2 GB; scaling the cache proportionally to a 206× corpus reinstates the
  ICL problem it was invented to solve.
- **Nothing in the paper validates the regime.** The method has never been shown
  at 100M tokens, and Figure 4 shows quality falling as the cache shrinks — the
  exact direction 100M tokens forces.

**This is not a claim that Engram cannot do it.** Composition (§5.4) is the
obvious escape: train ~266 per-matter cartridges and compose per query. But
composition was demonstrated on **two** ~100k-token 10-Ks. Composing hundreds is
unvalidated, and "which cartridges do I load for this query?" is a **retrieval**
problem — which returns the architecture to needing a good index over matters.
That index is a thing beep already builds.

---

## 5. Differentiated vs dominated

### 5.1 Where beep is DOMINATED (say so plainly)

| Axis | Why they win |
|---|---|
| **Inference token economics** | 38.6× memory / 26.4× throughput, verified, published, productized. beep has no answer and should not try to acquire one. |
| **Open-ended synthesis over prose** | "What does market standard look like for this clause?" has no schema. Distillation absorbs the unschematizable residue; a KG drops it. |
| **Capital and compute** | $98M and 8×H100-node-hours as a routine unit of work vs one dual-R9700 workstation. |
| **Absorbing corpora nobody will model** | Self-study needs no ontology. beep's approach needs a schema per shape — that is a real per-domain cost. |
| **Evaluation credibility** | The LegalBench author is on their method paper and the benchmark. Any beep result on C&H is graded on their rubric, on their instrument. |
| **Distribution** | Microsoft, Notion, Harvey at launch. |

### 5.2 Where beep is DIFFERENTIATED (and it is not close)

Each of these is a property a lossy distilled representation **cannot have in
principle**, not merely one Engram hasn't shipped yet.

1. **Extent / closure.** The single most load-bearing C&H rubric idiom is the
   terminal precision criterion — "does not assert any matter outside this list"
   (140 singleton instances, [`map-task-census.md`](./map-task-census.md)). A
   trained KV cache has no representation of *coverage*: it cannot distinguish
   "there are no more" from "I compressed the rest away." A `SELECT … WHERE`
   over a typed projection can, because the table has a known extent and the query
   plan is a proof object. **This is beep's sharpest structural advantage and it
   maps 1:1 onto the packet's rank-1 opportunity** (closure/precision +
   neutral-band schema, [`RESEARCH.md`](../RESEARCH.md) §Verified Opportunity Ledger).
2. **Provenance to a span.** Cartridges carries no source pointer; the paper never
   raises the topic. beep's judge machinery already mandates evidence as
   `NonEmptyArray` with `EvidenceCrossCheck` ([`mine-eval-methodology.md`](./mine-eval-methodology.md)).
   For an IP practice, "which document, which paragraph" is the deliverable, not a
   nicety.
3. **Revocation, ethical walls, legal hold.** Deleting one matter from a
   deterministic store is a `DELETE`. Deleting it from distilled parameters is
   retraining — and the best published targeted-update result still costs **−11%**
   on unrelated capability ([arXiv:2510.15103](https://arxiv.org/abs/2510.15103)).
   A single firm-wide cartridge is an ethical-wall violation by construction
   unless you train one per access scope, which multiplies the §4 cost by the
   number of distinct scopes. [own analysis — Engram publishes nothing on this;
   searched and **NOT FOUND**.] Jack Morris's own inversion work
   ([arXiv:2310.06816](https://arxiv.org/abs/2310.06816)) makes the confidentiality
   question sharper, not softer.
4. **Bitemporality.** "What did the conflicts check show *as of* the engagement
   date" is unanswerable from a cache retrained daily — the prior state is gone.
   This is the `agent-memory-tiers-bitemporal-edges` sibling packet's whole thesis,
   and it is orthogonal to compression.
5. **Determinism and replay under audit.** A KG query is a replayable artifact
   with a stable answer. A distilled model's answer is a sample. Malpractice
   exposure is asymmetric here.
6. **Redline / tracked-changes ingest.** Completely orthogonal to the memory axis:
   a cartridge self-studied over redline-stripped text is blind no matter how good
   the distillation. Per [`verify-completeness.md`](./verify-completeness.md) §G2,
   both the LAB harness *and* its judge strip `w:ins`/`w:del` while 393 tasks /
   5,945 criteria grade redline work. **This axis is unclaimed by both Harvey and
   Engram** and is OIP-load-bearing (claim amendments *are* redlines).
7. **Unit economics at solo-firm scale.** OIP is one small practice. An 8×H100
   node per retrain cycle is not a viable unit for it. SQLite/Postgres projections
   on a workstation are.

### 5.3 The synthesis: be their curriculum, not their competitor

The Cartridges ablations are the argument. Two of the three biggest single wins in
the paper come from **structuring the self-study data**, not from the model:
seed-prompt diversity **24.1 → 32.0** chrF, context-distillation objective
**24.9 → 33.5** chrF (§5.3). Initialization from *actual corpus tokens* rather
than random vectors moves LongHealth **29.9% → 55.3%**. The method is
conspicuously sensitive to how well the corpus is chunked, seeded, and organized
before training starts.

A schema-first KG produces exactly that: typed entities, matter boundaries,
adverse-party edges, and provenance spans that make high-coverage,
non-redundant, structurally-aware seed conversations — instead of naive 512–4096
token chunks with five generic prompts. **The beep-shaped bet is not "our index
beats their cartridge"; it is "a cartridge self-studied over our projections
beats one self-studied over raw OOXML."** That claim is testable on C&H with the
zero-patch `docs_dir` seam already identified in
[`mine-benchmark-integration.md`](./mine-benchmark-integration.md), and it is a
claim Engram has no incentive to test and Harvey has no artifact to test with.

It also answers the reviewer question §G4 worried about ("versus Cartridges?")
without racing them: *not versus — underneath.*

---

## 6. Corrections to prior packet claims

| Prior claim | Location | Status |
|---|---|---|
| "$98M" Engram funding, snippet-level, UNVERIFIED | [`verify-completeness.md`](./verify-completeness.md) §G4 | **CONFIRMED** — $98M Series A, ~$600M valuation, 13 people, 2026-06-23 |
| "Sabri Eyuboglu (Stanford, Chris Ré) is credited with Cartridges" | §G4 | **CONFIRMED** — first author, arXiv:2506.06266 |
| "Jessy Lin is credited with Active Reading" | §G4 | **CONFIRMED** — first author, arXiv:2508.09494 |
| "The thesis is baking organisational knowledge into model weights" | §G4 | **CORRECTED (partially)** — Cartridges trains a **KV cache with weights frozen**, not weights; Active Reading trains weights; the product ships **both plus LoRA and sparse memory**. "Into model parameters or activations" is the accurate phrasing. |
| "Cartridges is a published instantiation of [Harvey's stated direction]" | §G4 | **CONFIRMED**, and stronger than stated: **Neel Guha is an author of both Cartridges and the C&H acknowledgment list, and of LegalBench.** |
| "We would be entering a claimed race on that axis" | [`RESEARCH.md`](../RESEARCH.md) §External Landscape | **CONFIRMED for the compression axis; REFRAMED** — the closure/provenance/revocation axes are *not* claimed, and §5.3 offers a complement rather than a race. |
| "the redline-ingest axis is unclaimed" | [`RESEARCH.md`](../RESEARCH.md) | **CONFIRMED** — nothing in Engram's published work or product copy touches document-format fidelity. |

---

## 7. UNVERIFIED / not-found register

- **Engram's deployment model** (SaaS / VPC / on-prem), data-residency,
  permission scoping, deletion policy, and whether customers own the resulting
  adapters: **searched, NOT FOUND** in any primary source. `engram.com` says
  memories are "owned by you" with no mechanism described.
- **Precise founding month.** Sequoia says 2025; a secondary report says
  "October". **UNVERIFIED.**
- **Shizhe He's current affiliation** beyond the LinkedIn headline "teaching
  machines at Engram". **UNVERIFIED.**
- **"15% to 92% accuracy" and "governable and revocable" Engram claims** appearing
  on third-party consultancy pages: **UNVERIFIED, do not cite.** Not from
  engram.com.
- **CNBC's launch coverage** (`cnbc.com/2026/06/23/...`) returned **HTTP 403** to
  this pass's fetcher; every fact it would have supplied is sourced elsewhere
  above. Same for `citybiz.co`.
- **Whether Engram has published anything since the 2026-06-23 launch post.**
  `engram.com/blog` shows one post. No post-launch technical paper found.
- **Any Engram result on C&H.** None published as of 2026-08-08.
- **DeepSeek "Engram" memory architecture** (headline collision seen in search):
  **UNVERIFIED**, not investigated.

---

## 8. Open questions this pass raises for align

1. **Does the packet want to run the "KG-as-self-study-curriculum" experiment?**
   It is the only framing found that turns Engram from a competitor into a
   substrate consumer. It needs a cartridge training rig (8×H100-class) that
   DankStation does not have — a hard precondition on top of the podman/pandoc/
   metered-key gaps already in [`RESEARCH.md`](../RESEARCH.md) §Constraints.
2. **Does closure/extent become the packet's headline claim?** §5.2(1) says it is
   the strongest defensible axis *and* it is already rank-1 in the ledger. That
   is unusually clean convergence — but it makes the deliverable "an auditable
   completeness guarantee", not "a faster agent".
3. **Publish-vs-hold on the redline defect (G2)** now interacts with a funded
   competitor's roadmap. It is the one axis where beep is ahead of both parties
   and it is cheap for them to close once named.
4. **Does `agent-memory-tiers-bitemporal-edges` inherit this file?** §5.2(4) is
   that packet's thesis and Engram is its clearest prior art / foil.

---

## Sources

**Fetched in this pass (2026-08-08):**

- Engram launch release — https://www.prnewswire.com/news-releases/engram-launches-with-98m-to-build-ai-that-actually-knows-your-organization-302807126.html
- Engram company site — https://engram.com
- Engram blog index — https://engram.com/blog
- Sequoia company profile — https://sequoiacap.com/companies/engram/
- Sequoia *Training Data* ep. 90, "Memory and Continual Learning: Engram's Dan Biderman and Jessy Lin" — https://sequoiacap.com/podcast/memory-and-continual-learning-engrams-dan-biderman-and-jessy-lin/
- Kleiner Perkins, "Engram: Giving Enterprise AI a Memory" (2026-06-23) — https://www.kleinerperkins.com/perspectives/engram-giving-enterprise-ai-a-memory/
- General Catalyst, "Our Investment in Engram" (2026-06-23) — https://www.generalcatalyst.com/stories/our-investment-in-engram
- VKTR, "Engram Launches with $98M to Give Enterprise AI Memory" — https://www.vktr.com/ai-news/engram-launches-with-98m-to-give-enterprise-ai-memory/
- CryptoBriefing, "EngramLab and Harvey open source synthetic law firm dataset" (2026-08-07) — https://cryptobriefing.com/engramlab-harvey-open-source-synthetic-law-firm/
- Cartridges (abstract) — https://arxiv.org/abs/2506.06266
- Cartridges (full PDF, v3, read pp. 1–12) — https://arxiv.org/pdf/2506.06266
- Cartridges code — https://github.com/HazyResearch/cartridges
- Learning Facts at Scale with Active Reading — https://arxiv.org/abs/2508.09494
- Continual Learning via Sparse Memory Finetuning — https://arxiv.org/abs/2510.15103
- Learned Structure in Cartridges (independent follow-up) — https://arxiv.org/abs/2508.17032
- Aioli (Mayee Chen) — https://arxiv.org/abs/2411.05735
- Text Embeddings Reveal (Almost) As Much As Text (Jack Morris) — https://arxiv.org/abs/2310.06816
- AI Engram (namesake, different group) — https://arxiv.org/abs/2606.14997
- Neel Guha, Columbia Law School faculty page — https://www.law.columbia.edu/faculty/neel-guha
- Harvey blog index — https://www.harvey.ai/blog

**Attempted and blocked (HTTP 403; no claim in this report rests on them):**

- https://www.cnbc.com/2026/06/23/ai-memory-startup-focused-on-cutting-token-costs-raises-98-million.html
- https://www.citybiz.co/article/864393/engram-emerges-from-stealth-with-98m-to-build-enterprise-ai-memory-layer/

**In-packet sources reused (not re-derived):**

- [`../assets/x-post-itsjuliopereyra-2085772997944803682.md`](../assets/x-post-itsjuliopereyra-2085772997944803682.md) — the C&H announcement (amortization thesis at `:62`, Engram contributor list at `:66`)
- [`verify-completeness.md`](./verify-completeness.md) §G2 (redline blindness), §G4 (the Engram gap this file closes)
- [`verify-facts.md`](./verify-facts.md) §E75 (baselines are announcement-sourced, self-declared UNVERIFIED)
- [`map-task-census.md`](./map-task-census.md), [`map-evaluation.md`](./map-evaluation.md) (closure criterion, neutral band)
- [`mine-eval-methodology.md`](./mine-eval-methodology.md) (beep judge evidence machinery)
- [`mine-benchmark-integration.md`](./mine-benchmark-integration.md) (`docs_dir` zero-patch seam)
- [`../RESEARCH.md`](../RESEARCH.md), [`SOURCES.md`](./SOURCES.md)
