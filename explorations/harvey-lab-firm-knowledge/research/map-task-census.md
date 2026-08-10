# Task Census — harvey-labs `tasks/firm-knowledge` (all 250 tasks)

**Date:** 2026-08-08
**Agent:** map-task-census (Opus 5)
**Source:** `/home/elpresidank/YeeBois/research/harvey-labs` @ MIT license.
Paths below are relative to that clone root.
**Scope:** all 250 `tasks/firm-knowledge/tasks/*/task.json` read and aggregated
programmatically; 20 tasks deep-read verbatim. **The `dms/` corpus was never
touched** (hard rule) — every corpus claim here is inferred from rubric text and
marked UNVERIFIED where it depends on the corpus.

---

## 0. Executive summary

The 250 firm-knowledge tasks are **not a Q&A set — they are a rubric corpus**.
The instruction is 33 words on average; the rubric behind it is 12.4 atomic
criteria and, in the tail, up to 122. All 3,098 criteria share one three-field
shape (`id`, `title`, `match_criteria`), and grading is **all-pass**
(`evaluation/scoring.py:score_rubric` → `score = 1.0 if n_passed == n_total`).

That combination is the whole difficulty story, and it is arithmetic, not
mystery: at the announced ~50% per-criterion satisfaction rate, the expected
number of all-pass tasks across the set is **10.19 of 250** — and **0.00 for the
19 tasks with 31+ criteria**. The blog's "regress to 0% all-pass as enumeration
size grows" is a restatement of `0.5^n`.

The highest-value transferable assets for beep-effect are (a) the **criterion
role taxonomy** (7 roles, one of which — *precision* — is the closure/stopping
test that no ordinary rubric has), (b) the **`ACCEPTABLE EITHER WAY` construct**
that makes a strict all-pass rubric survive genuine boundary ambiguity, and
(c) the **methodology criteria** that grade *how* the answer was computed, not
just the number.

---

## 1. Corpus shape (mechanical facts)

| Fact | Value | Evidence |
|---|---|---|
| Task dirs | 250, contiguous `001`–`250` | `tasks/firm-knowledge/tasks/` |
| Files per task | exactly 1 (`task.json`, 2–40 KB) | `ls tasks/firm-knowledge/tasks/001/` |
| Top-level keys | `id`, `title`, `instructions`, `docs_dir`, `criteria` — **all 250, no variance** | aggregate |
| Criterion keys | `id`, `title`, `match_criteria` — **all 3,098, no variance** | aggregate |
| `docs_dir` | `"../../dms"` on all 250 | aggregate |
| Total criteria | **3,098** | aggregate |

### 1.1 No `deliverables` — this slice is a different evaluation mode

Every *other* LAB slice carries `work_type`, `tags`, `deliverables` (a
`{name: filename}` map) and per-criterion `deliverables: [...]`. Example:
`tasks/antitrust-competition/draft-leniency-application/task.json` has
`work_type: "draft"`, a two-file deliverables map, and criteria like
*"PASS if the agent produces a document that is a draft leniency application…"*.

**Firm-knowledge tasks have none of these.** Consequence, per
`evaluation/scoring.py`:

- `deliverables_map` is `None` → `resolved_map` is `None`
- therefore `_load_all_output(output_dir)` runs and **every criterion is judged
  against the agent's entire output directory**, concatenated

So drafting slices get *criterion-scoped* context (a judge sees only the one
`.docx` the criterion is about); firm-knowledge gets *whole-transcript* context.
That is the correct design for retrieval/enumeration answers, and it is the
distinction to copy: **scope judge context to the artifact when the artifact is
the answer; give the judge everything when the answer is a claim about a corpus.**

### 1.2 The shared-corpus mechanism is one `if`

`harness/run.py:56-63`:

```python
# a task may point at a shared corpus instead via a `docs_dir` field in
# task.json (path relative to the task dir), e.g. firm-knowledge tasks set
# "../../dms" to share one DMS across the whole task set.
docs_dir = task_dir / "documents"
if config.get("docs_dir"):
    docs_dir = (task_dir / config["docs_dir"]).resolve()
```

That six-line generalization is what turns a per-task-documents benchmark into a
**persistent-corpus** benchmark. It is also the *only* documentation of the
firm-knowledge slice in the repo: `grep -rn -i "firm.knowledge" README.md docs/*.md
CONTRIBUTING.md` returns **zero hits**. The 517 MB / 100M-token slice ships
undocumented except for this comment.

---

## 2. Criteria-count distribution

```
criteria/task: min 1  p25 4  median 7  p75 15  max 122  mean 12.39
instructions:  min 81 chars / 14 words   median 189 / 32   max 425 / 61
```

| Bucket | Tasks | % | All-pass prob @ p=0.5 (median n) |
|---|---|---|---|
| 1–3 criteria | 40 | 16% | 0.125 |
| 4–7 | 91 | 36% | 0.031 |
| 8–15 | 55 | 22% | 0.0005 |
| 16–30 | 45 | 18% | ~0.00002 |
| 31+ | 19 | 8% | ~0 |

Full histogram (criteria → task count): 1→1, 2→13, 3→26, 4→33, 5→19, 6→21,
7→18, 8→8, 9→10, 10→5, 11→8, 12→8, 13→8, 14→4, 15→4, 16→2, 17→3, 18→4, 19→5,
20→4, 21→3, 22→5, 23→1, 24→1, 26→5, 28→7, 30→5, 31→3, 32→1, 34→1, 35→1, 38→1,
39→1, 40→1, 41→2, 45→1, 47→1, 48→1, 51→1, 52→1, 53→1, 69→1, 122→1.

**The all-pass arithmetic** (Σ over all 250 tasks of `p^n`):

| Uniform per-criterion pass rate | Expected all-pass tasks / 250 |
|---|---|
| 0.50 (announced baseline) | **10.19** |
| 0.80 | 57.1 |
| 0.90 | 105.5 |
| 0.95 | 152.6 |

This is the single most useful number in the census. A model must reach
**~95% per-criterion reliability just to all-pass 61% of the set**, and the
122-criterion task (`188`) needs 99.4% per-criterion to reach a coin flip.
Reporting "criteria satisfied" and "all-pass" as if they were the same metric
is a category error; the gap between them is `p^n`.

---

## 3. Task-shape taxonomy (n = 250)

Classification: rule-based over `title + instructions`, hand-corrected on 25
misroutes (e.g. "want to check our track record **first**" false-matching the
superlative rule). Counts are exact and sum to 250.

| Shape | n | med crit | max crit | Σ all-pass @p=.5 | Signature |
|---|---|---|---|---|---|
| **enumeration / precedent-bank** | **105** | 11 | 53 | 1.91 | "pull every matter where X, along with the executed agreements" |
| **superlative / extremum** | 43 | 4 | 9 | 4.62 | "most recent / largest / first / shortest / longest-running" |
| **count / tally** | 23 | 7 | 69 | 0.63 | "how many of our X…" |
| **distribution / mix** | 12 | 25 | 122 | 0.03 | "what's the mix / breakdown by / split between" |
| **frequency / rate** | 11 | 11 | 30 | 0.30 | "how often do our X include Y" |
| **existence check** | 11 | 3 | 9 | 1.28 | "have we ever…?" |
| **portfolio hygiene / status** | 10 | 5.5 | 52 | 0.45 | dormant, stale-signed, closed-in-2023, withdrawn |
| **client-relationship mining** | 8 | 9.5 | 26 | 0.35 | full matter list for a client / sponsor portfolio / cross-sell |
| **staffing / people** | 6 | 6.5 | 28 | 0.12 | "which associates have X experience", "matters staffed by A and B" |
| **trend (time series)** | 5 | 28 | 45 | **0.00** | "year over year", "by opened year", "2022–2024" |
| **conflicts / adversity** | 5 | 6 | 31 | 0.17 | "have we ever been adverse to X", "deals opposite Y" |
| **single-document / clause retrieval** | 4 | 4.5 | 6 | 0.17 | "pull the ROFR clause from that lease" |
| **aggregate statistic** | 4 | 14.5 | 19 | 0.03 | "average / typical / spread of" |
| **phrase-sweep (full-text)** | 3 | 19 | 22 | 0.13 | "documents mentioning 'change of control'", "referencing OFAC" |

Task ids per shape (for follow-up sampling):

- enumeration: 001,003,006,009,011,019,021,024,027,028,032,035,036,037,038,039,045,046,047,048,050,053,058,059,060,063,064,067,068,071,074,075,076,077,078,080,087,090,091,092,094,095,096,097,098,101,102,105,106,107,108,110,113,114,116,120,122,123,125,126,127,128,129,130,132,133,134,135,136,137,139,140,143,145,146,149,152,155,158,159,160,167,169,174,190,194,195,198,199,217,218,222,224,227,230,231,232,233,234,238,241,242,245,249,250
- superlative: 004,008,015,020,023,026,029,034,040,044,055,056,057,066,069,073,081,093,104,111,112,131,148,151,154,157,161,162,163,164,165,166,185,207,209,211,219,226,229,240,244,247,248
- count: 002,007,014,022,025,030,033,054,070,072,083,103,147,156,204,206,220,225,228,235,239,243,246
- distribution: 041,049,052,062,084,117,118,124,142,188,223,237
- frequency: 005,017,018,031,043,065,085,119,141,150,153
- existence: 010,012,051,061,079,088,089,138,203,205,215
- hygiene: 109,168,170,171,172,173,177,184,186,197
- client-relationship: 175,176,178,210,212,213,214,216
- staffing: 115,180,181,182,183,208
- trend: 016,100,144,187,189
- conflicts: 082,179,200,201,202
- single-doc: 013,196,221,236
- aggregate-stat: 042,086,099,121
- phrase-sweep: 191,192,193

**Practice-area coverage** (tasks may hit more than one; 55 are multi-area):
Litigation (General) 51, M&A/Corporate 45, Banking & Finance 35, Capital
Markets 25, IP 25, firm-ops/cross-practice 23, Labor & Employment 15, Real
Estate 14, Funds & Asset Management 13, Antitrust 12, Healthcare & Life
Sciences 11, White Collar 10, Tax 9, Bankruptcy & Restructuring 8, Privacy &
Data Security 3, unclassified 14.

**Systematic triads.** The set is built by a template: for most features there
is an *enumeration* task, a *count* task, and a *most-recent* task over the same
predicate. Clean examples: 006/007/008 (HSR filings), 021/022/023 (secured
facilities), 024/025/026 (revolvers), 028/030/029 (DIP financing),
146/147/148 (disclosure schedules), 149/150/151 (working-capital),
152/153/154 (earnouts), 155/156/157 (no-shops), 224/225/226 (title insurance),
227/228/229 (SNDA), 242/243/244 (litigation holds), 245/246/247 (government
cooperation). **This is the reusable generator**: one ground-truth feature set
yields three tasks at three difficulty tiers (median 11 / 7 / 4 criteria)
against the same corpus evidence, at near-zero marginal authoring cost.

---

## 4. Criterion role taxonomy (n = 3,098)

| Role | n | % | What it grades |
|---|---|---|---|
| matter identification | 1,540 | 49.7% | one matter must be named, with its qualifying reason |
| document identification | 548 | 17.7% | one named file must be produced or cited |
| other / fact | 491 | 15.8% | a specific fact (date, party, amount, provision) |
| count assertion | 209 | 6.7% | "states that N matters…" |
| **precision (negative / closure)** | **175** | **5.6%** | the answer asserts *nothing outside* the list |
| statistic / aggregate | 76 | 2.5% | share, average, tier, per-year value |
| set-completeness | 59 | 1.9% | the full set is put forward as the full set |

Per-shape composition (share of that shape's criteria):

| Shape | matter-id | document | statistic | count | precision | set-complete | methodology | other |
|---|---|---|---|---|---|---|---|---|
| enumeration | 41% | 32% | 1% | 6% | 5% | 2% | 4% | 9% |
| superlative | 24% | 20% | 0% | 1% | 21% | 2% | 2% | 31% |
| count | 73% | 0% | 0% | 10% | 6% | 3% | 3% | 5% |
| distribution | 42% | 0% | 9% | 10% | 3% | 0% | 4% | 32% |
| conflicts | 85% | 0% | 0% | 4% | 4% | 1% | 3% | 1% |
| staffing | 68% | 0% | 3% | 13% | 3% | 0% | 0% | 13% |
| phrase-sweep | 43% | 39% | 0% | 5% | 7% | 0% | 7% | 0% |

Read the `count` row carefully: a **count** task is 73% matter-identification
criteria. Asking "how many?" grades "name all of them" — the number alone earns
1 of 7 criteria. That is a deliberate anti-guessing design and it is the single
cheapest pattern to steal.

---

## 5. Rubric-authoring conventions worth copying (exact phrasings)

### 5.1 The five canonical templates

**(a) Qualifying-matter criterion** — identity + *reason*, never bare identity:

> `Identifies Harrowgate PE, matter 1003-00001, as qualifying because the FTC
> issued an HSR Second Request on July 16, 2024.` — `tasks/.../001/task.json` C-001

The `because <evidence>` tail means a lucky guess at the matter number fails.
792 criteria across 154 tasks use the `Identifies …` opener.

**(b) Document criterion** — backticked filename, disjunctive verb:

> `Includes or identifies \`second-request-strategy-memo.docx\` for Harrowgate PE,
> matter 1003-00001.` — `001` C-005

295 criteria in 50 tasks carry a backticked office filename; 397 distinct
filenames are cited 663 times. Top repeats: `closing-checklist.xlsx` (21),
`merger-agreement-execution-version.docx` (19),
`asset-purchase-agreement-execution.docx` (17).

**(c) Count criterion with an upward tolerance:**

> `States that 3 matters drew an issued HSR Second Request. A higher count that
> also includes the acceptable-either-way cross-practice second-request matters
> is equally acceptable.` — `001` C-004

"equally acceptable" appears in 28 criteria. 183 criteria in 141 tasks open with
`States that`.

**(d) The precision criterion** — the closure/stopping test (127 tasks carry the
canonical form, 140 carry some `does not assert`):

> `The answer does not assert any matter outside this list: 1003-00001
> (Harrowgate PE); 1038-00001 (Cascade Retail); 1041-00001 (Solara Digital).
> Additionally, the following matters are ACCEPTABLE EITHER WAY — they are NOT
> required, and the answer must NOT be penalized for including OR omitting them
> (a second request they drew sits in a deal we filed outside our antitrust
> practice): 1003-00003 (Harrowgate PE); 1032-00005 (Halcyon Semi);
> 1038-00009 (Cascade Retail).` — `001` C-011

**This is the pattern to steal wholesale.** It does three things at once:
(1) makes over-inclusion fail, so an agent cannot pass enumeration by dumping
everything; (2) makes the *boundary* explicit as data rather than leaving it to
judge discretion; (3) documents *why* each boundary case is ambiguous. 61
criteria use the `ACCEPTABLE EITHER WAY` block; 55 of them cite the same
justification, `borderline by practice-filing convention`, and the other six are
bespoke (e.g. `under a reading that counts dormant matters as open, these older
dormant matters are the longest-running` in task `209`).

**(e) Methodology criterion** — grades the *procedure*, and always sits at C-001:

> `Defines the population as executed/live Banking & Finance financings, assigns
> each financing to its operative year based on the executed/controlling credit
> agreement, and counts springing financial maintenance covenants as maintenance
> covenants.` — `016` C-001

> `The calculation excludes valued matters that never executed, including
> prospective matters, dormant matters, and closed_terminated matters withdrawn
> or abandoned before signing.` — `188` C-002
> `The calculation retains a valued deal if it was signed or otherwise executed
> before later terminating or unwinding.` — `188` C-003

Every analytic task (trend / distribution / aggregate-stat / frequency) leads
with 1–3 methodology criteria before any number. The rubric refuses to grade an
answer whose derivation is unstated.

### 5.1b Opener census — two competing voice conventions

Criteria are written in one of two grammatical voices, and the split is not
random — it tracks authoring batches:

| Opening string | criteria | tasks |
|---|---|---|
| `Identifies …` | 792 | 154 |
| `The answer identifies …` | 443 | 64 |
| `Provides or identifies …` | 184 | 28 |
| `States that …` | 183 | 141 |
| `The answer does not assert …` | **140** | **140** |
| `The answer states …` | 69 | 59 |
| `Reports …` | 63 | 11 |
| `Pulls or provides …` | 53 | 3 |
| `Includes or identifies …` | 34 | 3 |
| `Limits …` | 24 | 24 |
| `Puts forward …` | 15 | 15 |

Two observations. First, `The answer does not assert` is **exactly one criterion
per task in exactly 140 tasks** — the precision criterion is a singleton by
construction and 56% of tasks carry one (another 35 use `Limits …` / `Puts
forward …` phrasing for the same job, so ~70% of tasks have a closure test).
Second, the imperative voice (`Identifies`) and the referential voice (`The
answer identifies`) do the same work; if we port this, **pick one** and enforce
it, because a judge prompt that concatenates both is being asked to normalize
grammar as well as evaluate.

### 5.2 Four rarer patterns that are the actual gold

**Definitional-fork consistency.** Instead of forcing one answer where the data
genuinely admits two, grade the *coherence and disclosure* of the choice:

> `Treats convertible or equity-linked deals (Optiwave 1014-00001, GenomeDx
> 1013-00002) consistently — either both counted or both excluded — and notes
> that the reported rate depends on that definitional choice.` — `043` C-012

> `States a greenshoe rate consistent with the identified set: 7 of 9 executed
> equity or equity-linked offerings (about 78%), or 6 of 7 (about 86%) if
> convertible/equity-linked deals are excluded from both the numerator and the
> denominator.` — `043` C-001

**Mandatory data caveat.** The rubric requires the agent to flag that its own
answer is unreliable:

> `The answer flags Funds & Asset Management as anomalous or unreliable because
> the available metadata supports only the executed $25 million matter
> 1027-00002 after the gate, not a three-matter population averaging $775
> million.` — `188` C-121

> `Flags that the substantive market signal is increased use of springing or
> covenant-lite structures … rather than a decline in the existence of any
> financial maintenance covenant.` — `016` C-027

**Zero-result / distractor-rejection tasks.** 28 tasks contain a criterion whose
ground truth is "nothing qualifies" or "this near-miss is not the thing." The
purest examples are `013`, `221`, `236`:

> `States that the executed credit agreement \`credit-agreement-execution.docx\`
> in Lumos Analytics Inc. matter 1008-00001 contains no MFN or most-favored-
> nation provision, so there is no provision to pull.` — `013` C-003

> `Explains that Article 13 grants an Expansion Option over Floors 39–40 and is
> a space-leasing right, not a right of first refusal to purchase the real
> property.` … `Explains that Article 15 grants a Right of First Offer … not a
> right to match a third-party purchase offer` … `States that the full
> qualifying set is empty` — `221` C-004/C-005/C-006

Task `221` is a masterclass: 6 criteria, correct answer is *"no"*, and 3 of the
6 grade the agent's ability to explain why two plausible-looking clauses (an
Expansion Option and a ROFO) are **not** the requested ROFR. Sycophantic
retrieval fails outright.

**Disjunctive credit.** Where an identifier has two equally valid spellings:

> `Credit the matter number OR the client name.` — `034` C-001 (the only
> 1-criterion task in the set)

### 5.3 Scope narrowing lives in the *instruction*, not only the rubric

22 of 250 instructions carry an explicit exclusion clause, e.g.:

- `016`: "Keep it to our core Banking & Finance credit facilities — exclude
  warehouse, repurchase, and other securitization-structured facilities and
  real-estate-secured project financings."
- `129`: "…that we actually pursued — whether prosecuting or defending — rather
  than one that appeared only as boilerplate in the complaint"
- `063`: "every commingled, multi-investment fund … not single-asset or
  single-deal co-investment SPVs"
- `167`: "over a billion dollars in guaranteed (base) consideration, setting
  aside contingent earnout or CVR value"

These are the tasks where a *semantic* filter (boilerplate vs. pursued) sits
between retrieval and the answer — no keyword survives the distinction.

### 5.4 Curation artifacts (evidence of human review)

Six tasks have non-contiguous criterion ids — criteria were **deleted without
renumbering**, preserving stable criterion identity across rubric revisions:

- `041` n=47, max C-049, missing C-019 and C-040
- `091` n=3, max C-004, missing C-002
- `102` n=4, max C-006, missing C-002 and C-005
- `122` n=4, max C-005, missing C-001
- `133` n=12, max C-014, missing C-003 and C-010
- `146` n=28 (contiguous but out of sorted order)

Copy that discipline: **criterion ids are permanent keys, not array indices.**

### 5.5 Generator-schema leakage (a bug worth noting)

Snake_case field names from the generation pipeline leak into a handful of
rubrics — `matter_type` and `deal_value_usd` (`188` C-001), `closed_date` /
`closed_completed` / `closed_terminated` (`204` C-002, `188` C-002), `status`
(13 criteria across 10 tasks), and person ids `PER-0048`/`PER-0049`/`PER-0050`
(`208`). This confirms ground truths were computed from a **structured matter
spec layer** and hand-rendered into prose, and it means those rubrics
half-instruct the agent in the generator's vocabulary. UNVERIFIED whether that
metadata is exposed inside `dms/` — flagged for the corpus-anatomy agent, since
if a machine-readable matter index ships in the corpus, several 30+-criterion
tasks collapse from "search 100M tokens" to "read one index and aggregate."

---

## 6. Ground-truth coverage of the corpus

Extracted from rubric text alone (no corpus access):

- **254 distinct matter ids** cited across all rubrics, spanning **45 distinct
  client prefixes** (`1001`–`1046`). The announcement says 266 matters / 46
  clients, so the task set touches roughly **95% of matters and 98% of clients**.
- Only **15 matters are cited exactly once** — the ground truth is densely
  overlapping, not a thin sample.
- Most-cited matters (these are the corpus's load-bearing documents):
  `1003-00003` (64 citations), `1041-00003` (62), `1006-00008` (62),
  `1038-00009` (59), `1001-00003` (58), `1001-00007` (56), `1001-00004` (54),
  `1013-00006` (52), `1008-00008` (51), `1042-00004` (50).
- **397 distinct filenames** cited 663 times.

Implication for the amortized-index thesis: a single correct matter-level index
(matter id → client, practice area, status, dates, value, feature set,
key documents) would be **reused across essentially the whole task set**, since
the same ~250 matters recur in overlapping subsets. That is the strongest
quantitative argument in this census for the "build the representation once,
amortize it" direction — and it is the argument beep-effect's knowledge-engine
bet already makes.

---

## 7. Hardest archetypes (ranked)

Ranked by `p^n` collapse plus structural difficulty, not by criteria count alone.

1. **`188` — Average Deal Size by Practice Area (122 criteria, distribution).**
   The extreme. Requires: a stated methodology, an *occurrence gate* with two
   opposing rules (exclude never-executed; retain executed-then-terminated), 13
   practice-area averages **each paired with a matter count**, ~100
   matter-attribution criteria, a mandatory anomaly flag, and a precision
   criterion enumerating an 84-matter population. Needs 99.4% per-criterion
   reliability for a coin-flip all-pass.
2. **`204` — Count of Matters Closed in 2024 (69 criteria).** The instruction is
   **17 words**: "how many matters did we actually close in 2024?" The rubric is
   a 66-matter roll call plus a closure-definition criterion plus a 66-entry
   precision list. Highest instruction-to-rubric asymmetry in the set and the
   cleanest demonstration that *counting* is enumeration in disguise.
3. **Trend tasks (`016`, `100`, `144`, `187`, `189` — median 28 criteria,
   Σ all-pass @p=.5 ≈ 0.00).** Worst shape in the set: every year is a separate
   criterion (share **and** numerator **and** denominator), plus methodology,
   plus a market-interpretation criterion, plus precision. A single mis-binned
   matter fails 2–3 criteria at once — errors are *correlated*, so real all-pass
   is below the independent `p^n` estimate.
4. **Mega-enumerations `155` (53), `136` (51), `145` (48), `021` (40),
   `130` (39), `149` (38).** ~41% matter-id + ~32% document-id criteria: the
   agent must name every matter *and* pull the right execution-copy filename
   from each. Document criteria are where enumeration compounds — one matter
   found but wrong file cited fails 2 criteria.
5. **Compound-predicate enumerations (`063`, `087`, `145`, `249`, `250`).**
   "both X and Y" with an explicit SPV/scope carve-out. The intersection is
   small, so precision dominates; `063` C-016 even grades *which section* of an
   LPA counts as the qualifying clawback, rejecting a plausible substitute.
6. **Zero-result / distractor tasks (`013`, `221`, `236`, `061`).** Small
   rubrics (2–6 criteria) but adversarial: the correct answer is "no" and the
   corpus contains near-misses engineered to be found. Failure mode is
   over-eager retrieval, the exact opposite of the enumeration failure mode —
   which makes them the cheapest diagnostic in the set.
7. **`202` — Conflict Check: Matters Adverse to Government Entities (22).**
   85% matter-id criteria, each with a *distinct* adversity rationale (state AG,
   FERC, DOJ, FDA, IRS, SEC…), a 20-matter total, and a 7-matter
   acceptable-either-way tail. This is the OIP-shaped task and the one whose
   failure has real-world consequences.
8. **`208` — Partner with the Most IP Matters (28, staffing).** Requires a
   *ranking* under a stated counting rule (led + billed), the full 16-matter IP
   population, per-partner counts for three partners, and a tie-handling
   criterion. Firm-graph reasoning, not document retrieval.

**The counter-intuitive easy tail:** 40 tasks have ≤3 criteria and 91 have 4–7.
The superlative shape (43 tasks, median 4) has the highest expected all-pass
contribution in the set (4.62 of the 10.19 total at p=0.5). If a leaderboard
number moves, check whether it moved on superlatives before believing it moved
on enumeration.

---

## 8. Direct transfers to beep-effect

1. **Precision criterion → stopping test.** Our `beep qa` vision-judge
   inventories and evidence-loop rubrics grade what was found. Add the mirror:
   *"the inventory asserts no finding outside this list."* Over-reporting is a
   failure mode we do not currently measure.
2. **`ACCEPTABLE EITHER WAY` → schema field, not prose.** Model a criterion as
   `{ required: Set<Id>, acceptableEitherWay: Set<Id>, justification: string }`
   rather than embedding the boundary in judge prose. It makes rubric ambiguity
   *diffable* and reviewable — and this is a schema-first modelling exercise the
   repo is already equipped for (`LiteralKit`, `S.Class`, `HashSet`).
3. **All-pass + `p^n` reporting.** Any judge-scored gate we ship must publish
   both per-criterion pass rate and all-pass, with `p^n` shown, or the two
   metrics will be conflated exactly as they are in most benchmark write-ups.
4. **Methodology criteria.** For any analytic output (coverage ratchets, CI
   metrics, quality reports), grade the stated derivation as its own criterion.
   `188` C-002/C-003 (an inclusion gate with an explicit exception) is the model.
5. **The enumeration/count/most-recent triad.** A cheap task-generation
   multiplier for any synthetic eval corpus we build: one feature set → three
   difficulty tiers over the same ground truth.
6. **Criterion ids as permanent keys.** Six tasks prove Harvey treats them that
   way; our reflection/finding artifacts should too.

---

## 9. What this census did NOT establish (UNVERIFIED)

- Whether `dms/` ships a machine-readable matter index. Rubric leakage of
  `matter_type` / `deal_value_usd` / `closed_date` / `status` / `PER-NNNN`
  strongly suggests a structured layer existed at generation time, but the
  corpus was not inspected. **Hand-off to the corpus-anatomy agent.**
- Whether the 397 cited filenames actually exist at the cited paths.
- Actual per-shape baseline scores. The `p^n` figures here are *expectations
  under an independence assumption* using the announcement's ~50% figure; no
  baseline run artifacts ship in the repo. Real correlated-error all-pass will be
  **lower** than these estimates on trend/distribution tasks and **higher** on
  small superlative tasks.
- Whether `ACCEPTABLE EITHER WAY` text is actually honored by the judge. The
  judge prompt (`evaluation/prompts/rubric_criterion.txt`) is a bare
  PASS/FAIL with no special handling — the hedge is enforced only by the
  judge model reading the criterion prose. **This is a soft spot in the
  methodology worth flagging in the packet's decisions log.**

---

## Appendix — reproduction

All aggregates in this report come from `python3` over the 250 `task.json`
files (no external deps). Key one-liner shapes used:

```python
files = sorted(glob.glob('tasks/firm-knowledge/tasks/*/task.json'))
tasks  = [json.load(open(f)) for f in files]
# criteria distribution
[len(t['criteria']) for t in tasks]
# all-pass expectation
sum(0.5 ** len(t['criteria']) for t in tasks)     # -> 10.19
# ground-truth coverage
{m for t in tasks for c in t['criteria']
   for m in re.findall(r'\b\d{4}-\d{5}\b', c['match_criteria'])}   # -> 254
```
