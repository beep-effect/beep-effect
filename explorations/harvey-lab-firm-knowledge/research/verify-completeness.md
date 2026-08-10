# Completeness critique of the harvey-labs mining run

**Date:** 2026-08-08
**Agent:** verify-completeness (Opus 5)
**Clone:** `/home/elpresidank/YeeBois/research/harvey-labs` @ `55510f0e6`.
Paths in §1–§3 are **relative to the clone root** unless prefixed `[beep]`.

**Inputs read in full:** `research/map-{harness,evaluation,task-census,corpus,pipeline-docs}.md`,
`research/mine-{benchmark-integration,synthetic-corpus,eval-methodology,dms-taxonomy}.md`,
`research/verify-facts.md`, `research/SOURCES.md`, `CAPTURE.md`, `DECISIONS.md`,
`README.md`, `RESEARCH.md`, `BRIEF.md`, `MAP.md`, `ops/manifest.json`, the scraped X post.

**Independent checks run for this report:** repo-wide task census across all 27 areas
(2,010 `task.json`), name-level document census of the **non**-firm-knowledge task tree
(51,683 files), OOXML tracked-change probes on 13 documents outside `dms/`, `LICENSE` /
`README` / `.github` / `tests/` / `utils/` / `scripts/` surface enumeration, local runtime
prerequisite check, sibling-exploration inventory, and one bounded web search on Engram.
**Nothing under `tasks/firm-knowledge/dms/` was opened.**

---

## 0. Verdict

The run is **excellent on what it aimed at and narrow in what it aimed at.** Ten reports,
~370 KB, and `verify-facts` resolved 286 checks with no structural claim falsified — that is
a genuinely high-quality evidence base and the packet should trust it.

But the scope was set to `tasks/firm-knowledge` on day one and never re-examined. Measured
against the artifact actually sitting on disk:

| | mined | unmined | run coverage |
|---|---|---|---|
| tasks | 250 | 1,760 | **12.4%** |
| rubric criteria | 3,098 | 111,814 | **2.7%** |
| task-attached documents | 9,288 | 51,683 | **15.2%** |
| on-disk bytes | 517 MB | 4.8 GB | **9.8%** |

Three consequences, in order of how much they should move the align stage:

1. **The unmined 97% is a different and more product-relevant genre.** Firm-knowledge is
   retrieval-only (no `work_type`, no `deliverables`, all 250 judged against whole output).
   The other 1,760 tasks are **444 draft / 306 review / 488 analyze** with criterion-scoped
   deliverable maps — the *deliverable-producing* mode, which is both the mechanic the packet
   wants to port and the product surface beep actually ships (`@beep/editor`, `@beep/pandoc-ast`,
   `apps/oip-web`).
2. **A new first-order defect sits in the unmined slice** and is arguably a sharper wedge for
   beep than the amortized-index bet the packet currently ranks #1 (§3.1).
3. **The rank-1 recommendation has an unverified hard prerequisite that is currently absent**
   from this machine (§3.2).

Recommendation counts below: **7 mine now · 5 defer to align · 3 ignore.**

---

## 1. Coverage map — clone surface vs. report coverage

| Path | Size / count | Covered by | Verdict |
|---|---|---|---|
| `harness/` | 2,206 LOC | map-harness (line-by-line) | **complete** |
| `sandbox/` | 670 LOC + Dockerfile | map-harness, map-pipeline-docs | **complete** |
| `evaluation/` | 2,545 LOC | map-evaluation (line-by-line) | **complete** |
| `docs/` (3 files) | architecture, eval-strategies, tutorial | map-pipeline-docs, map-evaluation | **complete** |
| `README.md`, `CONTRIBUTING.md`, `pyproject.toml`, `.github/` | — | map-pipeline-docs | **complete** |
| `utils/sweep.py`, `list_tasks.py`, `describe_task.py` | 1,076 LOC | map-pipeline-docs, map-evaluation | **complete** |
| `utils/playback.py` | 1,708 LOC | structural inventory only | **partial** (G14) |
| `scripts/` | 513 LOC | named, `setup.sh` not read at line level | **partial**, low value |
| `tests/test_{sandbox,task_integrity,scoring,eval_integration,compare,checkpoint_resume}.py` | 1,522 LOC | map-harness, map-evaluation, map-pipeline-docs | **complete** |
| `tests/test_{pipeline,eval_strategies,adapters,live}.py`, `adapter_smoke.py`, `conftest.py`, `test_utils_discovery.py` | **1,944 LOC** | **nobody** | **GAP (G6)** |
| `tasks/firm-knowledge/tasks/` | 250 / 3,098 criteria | map-task-census (all 250), mine-dms-taxonomy | **complete** |
| `tasks/firm-knowledge/dms/` | 9,288 files | map-corpus (6 matters, 11 docs sampled) + verify-facts probes | **complete to the extent the hard rule allows** |
| **`tasks/contracts/`** | **498 tasks / 30,779 criteria / 5,128 docs / 248 MB** | **nobody** | **GAP (G1, G11)** |
| **`tasks/diligence/`** | **11 tasks / 7,359 criteria / 37,623 docs / 2.0 GB** | **nobody** | **GAP (G1)** |
| **`tasks/intellectual-property/`** | **147 tasks / 8,683 criteria / 918 docs / 47 MB** | **nobody** | **GAP (G1)** |
| other 23 practice areas | 1,104 tasks / 64,993 criteria | counted only (`map-evaluation` §2.3) | **GAP (G1)** |
| Engram (external) | — | **nobody** | **GAP (G4)** |
| Harvey announcement blog | — | SOURCES.md: "not yet scraped" | **GAP (G10)** |
| beep sibling explorations | 58 packets | SOURCES.md cross-links 6 | **GAP (G5)** |

Packet hygiene checked and **clean**: `ATLAS.md:43` carries the entry, `ops/manifest.json` is
well-formed at stage `research`, and `DECISIONS.md` records the two mid-run directives.

---

## 2. Prioritized gap list

Each gap: what is missing → evidence → why it matters → **recommendation**.

---

### G1 — 97% of the graded artifact was never opened, and it is the deliverable-producing half *(mine now)*

**Missing.** No report touched `tasks/contracts` (498 tasks), `tasks/diligence` (11), or
`tasks/intellectual-property` (147) — nor the other 23 practice areas beyond a headcount.

**Evidence (this pass).** Repo-wide census over all 2,010 `task.json`:

```
area                        tasks  criteria  crit/task   documents   size
diligence                      11     7,359      669.0      37,623   2.0 G
contracts                     498    30,779       61.8       5,128   248 M
intellectual-property         147     8,683       59.1         918    47 M
firm-knowledge                250     3,098       12.4       9,288   517 M
work_type: analyze 488 | draft 444 | review 306 | research 24 | absent 748
tasks with a top-level `deliverables` map: 1,262
distinct `tags` across the tree: 3,413
```

`tasks/diligence/rail-horizontal-merger/` alone is **1,114 criteria over 4,061 documents**,
organised as a numbered virtual-data-room index (21 categories, `1. Corporate Organization &
Governance` … `21. Miscellaneous`). That is a **controlled folder vocabulary** — the exact
thing `map-corpus.md` §1 concluded does not exist ("559 distinct names… no controlled
vocabulary"), true of C&H and false of the diligence rooms.

**Why it matters — three ways it can re-rank the packet.**

1. **Affordability.** The packet's rank-1 experiment is throttled by a 100M-token corpus and
   3,098 whole-output judge calls, forcing a "stratified 40-task subsample"
   (`mine-benchmark-integration.md` §4). One diligence data room is ~3,400 documents — a
   corpus beep can ingest, index, and run **end-to-end, whole, in an afternoon**, with a
   ground-truth rubric attached. Same thesis, one order of magnitude cheaper, and it is a
   *closed* corpus so doc-coverage is exactly measurable.
2. **Product fit.** 444 `draft` + 306 `review` tasks with per-criterion `deliverables` grade
   *produced documents*. That is `explorations/full-document-editor`,
   `explorations/docx-roundtrip-interop`, `goals/rich-text-foundation`, `@beep/pandoc-ast`,
   `apps/oip-web`. `mine-synthetic-corpus.md` O2 wants a `@beep/pandoc` docx **writer** and
   proposes proving it with a self-made 3-matter fixture; there are 444 externally-graded
   drafting tasks sitting unused.
3. **OIP relevance was understated.** `mine-synthetic-corpus.md` §2.3 states "C&H does not
   cover prosecution… its closest matter is `1014-00003`, patent *litigation*." True of the
   corpus, but it silently generalises to the repo. `tasks/intellectual-property/` holds 147
   rubrics including `draft-complaint-for-patent-infringement` (90 criteria),
   `draft-claim-construction-brief`, `compare-asserted-patent-claims-against-accused-product`,
   `compare-source-code-documentation-against-patent-claims`,
   `draft-international-trade-commission-section-337-complaint`,
   `draft-ip-assignment-agreement`, `draft-motion-for-enhanced-damages`. Prosecution is still
   absent; **patent work is not**, and 147 graded IP rubrics are prior art for how to write one.

**Recommendation: MINE NOW.** One bounded agent, task.json + name-level documents only,
mirroring `map-task-census.md`'s method on `contracts` + `diligence` + `intellectual-property`
(656 tasks / 46,821 criteria). Explicit deliverable: does a diligence data room beat C&H as
the first beep experiment target? That question gates the whole shaping stage and cannot be
answered from the current reports.

---

### G2 — The harness is redline-blind, and nobody connected it to the 393 tasks that grade redlines *(mine now — new defect, likely the sharpest wedge in the repo)*

**Missing.** Two separate observations exist in the reports and were never joined:

- `map-harness.md` §5 notes docx → pandoc, "tracked changes/comments not surfaced as such."
- `map-evaluation.md` §5.4 notes `evaluation_options.include_docx_redlines` flips the judge's
  `--track-changes` from `accept` to `all`, and flags "**UNVERIFIED in practice:** zero
  task.json in this clone uses `evaluation_options`" — filed as trivia.
- `map-corpus.md` §5.1 notes redlines "are recoverable by a tracked-changes-aware reader and
  invisible to a flatten-to-text reader — a real capability discriminator."

**Evidence (this pass).**

- Agent read path: `sandbox/parsers/parse_doc.py:26-33` runs
  `pandoc <path> -t markdown --wrap=none` with **no `--track-changes` flag** — pandoc's docx
  reader defaults to `accept`: insertions are folded into the text, deletions are dropped.
- Judge path: `evaluation/scoring.py:31` signature is
  `_read_file_as_text(path, *, track_changes: DocxTrackChanges = DocxTrackChanges.ACCEPT)`,
  and `:352-353` selects `ALL` only when a criterion sets `include_docx_redlines`.
- **`grep -rl evaluation_options tasks/` → 0 of 2,010 tasks.** The flag is dead in practice.
- **5,945 criteria across 393 tasks** have `match_criteria` mentioning redline / tracked
  changes / markup.
- **480 non-firm-knowledge `.docx` across 371 tasks** carry `redline|markup|marked-up` in the
  filename. A random sample of 12 was probed for OOXML revision marks: **12 of 12 carry real
  `<w:ins>`/`<w:del>`** (e.g. `contracts/banking/credit-support-annex-term-negotiation/documents/csa-draft-v4-redline.docx`
  = 102 ins / 276 del; `employment-labor/analyze-counterparty-markup-of-executive-employment-agreement/documents/counterparty-re…docx`
  = 248 ins / 198 del).
- Worked case: `tasks/intellectual-property/analyze-counterparty-markup-of-saas-agreement/`
  ships `cumulus-redline-markup.docx` (**170 ins / 133 del**) alongside
  `thorngate-saas-template-clean.docx`. The instruction asks the agent to analyse the
  counterparty's markup. **The agent's `read` tool renders that file with every revision
  silently accepted.**

**Why it matters.**

1. **Upstream defect.** On the input side the redline channel is destroyed before the model
   sees it; the task is only solvable by inferring the diff against the clean template that
   happens to be in the same folder. On the output side, criteria like
   `draft-markup-of-counterparty-saas-agreement` C-002 ("PASS if the redline proposes changing
   the liability cap to at least 12 months of fees") cannot distinguish a tracked-change
   redline from a silent rewrite, because the judge also reads with `accept`. The requirement
   "produce a redline" is, as shipped, **ungradeable**.
2. **It is a capability discriminator beep can win on, cheaply.** A tracked-changes-aware
   ingest has information the stock LAB agent *cannot obtain at any budget*. That is a
   stronger claim than "our index helps", it needs no 100M-token build, and the graded testbed
   is 371 tasks we just found.
3. **It re-ranks an existing decision.** `mine-synthetic-corpus.md` §4.5 lists tracked-change
   **authoring** as "NET-NEW, hard — name it, defer it." Correct. But tracked-change
   **reading** is the near-term win, it lands in an existing packet
   (`explorations/docx-roundtrip-interop`), and it is directly load-bearing for OIP: claim
   amendments are redlines.

**Recommendation: MINE NOW** (1–2 hours: quantify the 371 tasks by shape, confirm the
`--track-changes` semantics against pandoc's docs, and write the finding up as an
upstream-reportable defect), **then defer the productisation choice to align.**

---

### G3 — The rank-1 experiment's runtime prerequisites are absent on this machine *(mine now — 30-minute smoke test)*

**Missing.** Every report says "no run was executed (no podman invocation, no API keys)".
Nobody checked whether a run is *possible* here.

**Evidence (this pass).**

```
podman   NOT FOUND        ← sandbox.py shells `podman run`; Docker is explicitly not used
docker   29.7.2           ← present, and useless to this harness as written
pandoc   NOT FOUND        ← required on the HOST by evaluation/scoring.py:38, and by the image build
uv       0.11.19          ✔
python3  3.14.6           ✔
cgroup controllers: cpuset cpu io memory hugetlb pids rdma misc dmem   ✔ (delegated)
disk: 2.3 T free          ✔
```

**Why it matters.** `mine-benchmark-integration.md` opens with "Run the amortized-index
experiment on their harness, unmodified" and its whole case rests on `docs_dir` needing no
patch. That is true of the *code* and untrue of the *environment*: the harness cannot start
without podman, and `evaluation.run_eval` cannot grade a `.docx` deliverable without host
pandoc. Installing podman needs `sudo` → a physical YubiKey touch (machine rule), so it is an
operator action, not an agent action. Separately this closes `mine-synthetic-corpus.md` §7's
first open item ("`pandoc` availability… unchecked; O2's appetite assumes installing a binary
is not itself a project") — **it is absent**, which is cheap to fix but must be scheduled.

**Recommendation: MINE NOW.** Install podman + pandoc (announce the sudo), run
`scripts/setup.sh`, pull `ghcr.io/harveyai/lab-sandbox:latest`, and execute **one** cheap task
end-to-end (`utils.describe_task` → `harness.run --max-turns 20` → `evaluation.run_eval`).
Until that green exists, every appetite in `mine-benchmark-integration.md` is an estimate over
an unproven substrate.

---

### G4 — Engram is unmined, and it is the collaborator with a published, competing answer to the packet's central bet *(mine now — bounded external pass)*

**Missing.** Engram appears in `CAPTURE.md` (as a name), in `SOURCES.md` §5 (as a cross-link
to `agent-memory-tiers-bitemporal-edges`), and **nowhere in any of the ten reports.** No
report opened the announcement blog either.

**Evidence (bounded web search, this pass — treat as snippet-level, UNVERIFIED).** Engram
emerged from stealth ~June 2026 with $98M; co-founders Dan Biderman and Jessy Lin (both
credited in the X post); CTO Sabri Eyuboglu (Stanford, Chris Ré) is credited with
**"Cartridges" — a method for turning a large body of documents into a small, reusable
memory**; Jessy Lin is credited with **"Active Reading"**. The thesis is baking organisational
knowledge into model weights / reusable memory rather than retrieving per query.

**Why it matters.** The X post's conclusion — "allow them to build richer representations of
the corpus up front — indexes, summaries, memory — and amortize the cost… We'll be sharing
more about our work here soon" — is not a neutral research direction. It is **Engram's product
thesis**, and Cartridges is a published instantiation of it. The packet's rank-1 and rank-2
opportunities (`CorpusDigest` / `MatterSummary`, a structural index) are one point in that
design space, and the packet currently has **no idea what the other points are, what they
cost, or how they score**. Two specific risks:

- We may spend an appetite re-deriving a weaker version of a published method.
- If we publish a result on C&H, the obvious reviewer question is "versus Cartridges?" and we
  have no answer.

`explorations/agent-memory-tiers-bitemporal-edges` is the sibling packet that should inherit
this, and it is named in SOURCES.md without a single fact attached.

**Recommendation: MINE NOW.** One bounded research pass (2–3 hours, `firecrawl-search` /
`deep-research`): Cartridges and Active Reading — what they are, what they claim, on what
benchmarks, what they cost to build, and whether they are complementary to or competing with a
structural index. Deliverable: one page in `research/` plus a decision-log entry answering
"what is our amortized representation, and why is it not Cartridges?"

---

### G5 — No cross-packet collision check against beep's 58 explorations *(mine now — mechanical, cheap)*

**Missing.** `SOURCES.md` §5 cross-links six siblings. At least five more are direct landing
zones for mined opportunities, and none is cited by any report:

| Sibling packet | Mined opportunity that lands there | Cited? |
|---|---|---|
| `agent-execution-sandbox` | `map-harness.md` §9.2/§9.3 — two-plane sandbox, `_is_under` as a typed guard, symlink-escape test trio | **no** |
| `full-document-editor` + `docx-roundtrip-interop` | `mine-synthetic-corpus.md` O2 (`@beep/pandoc` writer); G1's 444 draft tasks; G2's redline reading | **no** |
| `rag-retrieval-projection` | the retrieval bet itself (its graduated goal `hybrid-retrieval-fusion-core` is cited; the packet is not) | **no** |
| `skillopt-training-pilot` | `mine-eval-methodology.md` #3 lands squarely in its `corpus/tasks/*.json` and `EvalScoring.ts` | **no** |
| `solo-firm-docketing` | `mine-dms-taxonomy.md` O2 (matter lifecycle / vigilance overlay) — it cites the *doc*, not the packet | **no** |

**Why it matters.** The graduation contract (`explorations/README.md`) requires every major
component to cite an existing capability or be marked NET-NEW. A `MAP.md` written from the
current reports would mint goal packets that overlap live explorations — the most expensive
failure mode in this pipeline. `agent-execution-sandbox` is the clearest case: map-harness
ranked the sandbox contract as its #2 portable pattern and there is already a packet whose
entire spark is "model-generated code should not inherit ambient host authority."

**Recommendation: MINE NOW.** Mechanical: read the READMEs of the 11 candidate siblings, add
a "collides with / feeds" column to `SOURCES.md` §5, and note for each mined opportunity
whether it graduates here or as an increment to an existing packet.

---

### G6 — 1,944 lines of test surface unread, including the executable spec for the eval methodology *(mine now — free)*

**Missing.** `tests/test_eval_strategies.py` (396), `tests/test_pipeline.py` (567),
`tests/test_adapters.py` (356), `tests/conftest.py` (221), `tests/test_live.py` (188),
`tests/adapter_smoke.py` (182), `tests/test_utils_discovery.py` (34).

**Evidence (this pass).** `test_eval_strategies.py` test names are the eval contract in
executable form: `test_rubric_perfect_score`, `test_rubric_zero_score`,
`test_rubric_partial_pass_fails_task`, `test_rubric_judge_called_per_criterion`,
`test_rubric_judge_receives_correct_prompt`, `test_rubric_judge_receives_correct_variables`,
`test_rubric_cost_from_metrics`, `test_multi_deliverable_scoring`, plus a `TestValidation`
class. `test_pipeline.py` adds `TestToolDefinitions::test_tool_count`, `test_no_legacy_tools`,
`TestJudge::test_parse_json_from_fences` / `test_parse_json_bare`.

**Why it matters.** `DECISIONS.md` commits to rolling our own Effect-native eval framework
using theirs as reference. **This file is the acceptance-test list for that framework**, free,
and one report even proposes exactly these assertions from first principles
(`mine-eval-methodology.md` §4's schema sketch). `test_parse_json_bare` is notable: LAB tests
the unfenced-JSON salvage rung that `mine-eval-methodology.md` §2.4 identifies as beep's
"single highest value-per-line" missing behaviour in `JudgeCheck.ts:357-394`.

**Recommendation: MINE NOW** — fold into whichever agent handles G1 (same session, ~30 min).

---

### G7 — Attribution and redistribution obligations are recorded imprecisely *(mine now — 15 minutes, closeout hygiene)*

**Missing / wrong.**

- `SOURCES.md` records "MIT / port-with-attribution" but **pins no commit SHA**, despite
  `mine-dms-taxonomy.md` §5.3 explicitly instructing: "Pin a commit sha in any packet that
  cites it." Head is `55510f0e6`.
- `LICENSE` is a plain MIT © 2026 Harvey AI covering the whole repo. **There is no separate
  data licence** — the 9,288-file corpus and the 2,010 rubrics are under the same MIT grant.
  That is more permissive than SOURCES.md's cautious "reference (sample-only)" disposition
  implies, and it is what makes the C&H defect files committable as beep fixtures
  (`mine-benchmark-integration.md` O4). Worth stating positively.
- `README.md` requests a bibtex citation with `version = {v1.0}` and
  `url = .../tree/v1.0` — and `verify-facts.md` P28 establishes that **v1.0 does not contain
  firm-knowledge** (HEAD is 8 commits past the only tag). Any beep publication that cites
  their bibtex verbatim cites a tree that lacks the dataset it is reporting on.
- Track A (`mine-benchmark-integration.md` §3.1) **redistributes modified copies of 250
  MIT-licensed `task.json`** into a derived task set. MIT permits it; the notice-retention
  obligation ("The above copyright notice… shall be included in all copies or substantial
  portions") is not recorded anywhere, and this repo is public.

**Recommendation: MINE NOW.** Amend `SOURCES.md`: pin `55510f0e6`, state the single-MIT-grant
fact, record the citation deviation (cite the SHA, not `tree/v1.0`), and name where the MIT
notice lands if we redistribute derived tasks.

---

### G8 — Upstream contribution was never considered as an option *(defer to align — it is a strategy call)*

**Missing.** The packet frames harvey-labs purely as a source to extract from. Nobody asked
whether we give anything back, yet the run has accumulated a genuinely valuable defect ledger:

| Finding | Source |
|---|---|
| `metrics.json` always reports `finished_cleanly: true` (dict-spread clobber) | map-harness Defect 1 |
| Two path mappers disagree on prefix boundary | map-harness Defect 3 |
| `glob`/`grep` truncate silently at 100/250 | map-harness §3 |
| Dual-judge aggregate disagrees with its own report (mean vs intersection) | map-evaluation §7.3 |
| Judge provider table narrower than run provider table | map-evaluation §3.1 |
| Hidden second model in the deliverable matcher | map-evaluation §12.4 |
| Doc drift: 1,671/1,660 vs 2,010 tasks; 5 vs 6 adapters; `--difficulty` flag does not exist | map-pipeline-docs §6 |
| firm-knowledge silently opts out of half the integrity suite | map-pipeline-docs §1 |
| **A rubric↔corpus cross-check that is clean, and a script to keep it that way** | verify-facts §F |
| **The redline-blind read/judge path** | **this report, G2** |

`.github/CODEOWNERS` requires review from five Harvey admins, so there is no external merge
path by default — but PRs are accepted in principle, and `verify-facts` §F's cross-check is
exactly the regression test that three prior commits (`81b7c068c`, `438183bbd`, `a30c248c5`)
existed to fix by hand.

**Why defer, not decide.** It is a genuine trade: upstream credibility and visibility for the
OIP practice against publicising a defect (G2) that is currently an unclaimed beep advantage.
That is Benjamin's call, not an agent's.

**Recommendation: DEFER TO ALIGN**, with the ledger above as the input.

---

### G9 — No decision-grade cost model *(defer to align)*

`mine-benchmark-integration.md` §4 gives orders of magnitude and marks throughput UNVERIFIED.
Nobody produced a number using the price table that ships in the repo
(`evaluation/compare.py:29-69` `MODEL_INFO`, incl. `claude-fable-5` at $10/$50 per 1M). The
inputs are all known: 3,098 criteria × whole-output judge calls, 250 tasks × 5+ min × N
conditions, and the already-proposed 40-task stratified subsample. **Defer** — it is an
appetite question that belongs in `BRIEF.md`, and G1 may change the corpus it is computed over.

---

### G10 — Every performance claim traces to a marketing post *(defer to align)*

`results/` is gitignored; no scored artifact ships; the announcement blog was never scraped
(SOURCES.md §3 says so). Both `map-evaluation.md` §14 and `mine-benchmark-integration.md` §8
already flag this and already require re-running our own baseline arm, which is the correct
mitigation. **Defer**: scrape the blog at align (cheap, may carry charts the X post dropped),
and keep treating "~half of criteria, 5+ min/task, regression to 0% all-pass" as
vendor-reported.

---

### G11 — The multi-turn negotiation genre in `contracts/` is invisible to the packet *(mine now — fold into G1)*

**Evidence (this pass).** `tasks/contracts/` contains a task family the firm-knowledge slice
has no analogue for: `*-first-turn-redline`, `*-subsequent-turn-redline`,
`*-playbook-escalation`, `*-term-negotiation`, with `scenario-02` / `scenario-03`
sub-directories — e.g.
`contracts/banking/isda-master-pack-subsequent-turn-redline/scenario-02/`,
`contracts/banking/repo-securities-lending-subsequent-turn-redline/scenario-02/`,
`contracts/corporate-ma/loi-mou-playbook-escalation/`.

**Why it matters.** These are **stateful, multi-episode** tasks — round N of a negotiation
conditioned on rounds 1..N-1 — the only such family in the repo. They map directly onto
`explorations/patent-drafting-episode-ledger` and `agent-memory-tiers-bitemporal-edges`, and
they are the natural graded testbed for episodic memory, which is the *other* half of the
amortization thesis nobody is testing. **Fold into G1's census** with an explicit sub-question:
is the scenario axis a real multi-turn dependency or independent variants?

---

### G12 — Skills as a measurable ablation axis, never routed *(defer to align)*

`--skills` is a first-class ablation flag (`harness/run.py:239`, `map-pipeline-docs.md` §3.1)
and `map-harness.md` §9.4 extracted the SKILL.md rhetorical template. What nobody did is turn
it around: **beep ships ~40 skills and has never measured whether any of them help**, and
`explorations/skillopt-training-pilot` exists precisely to do that. LAB supplies both the
ablation methodology and an anti-trigger/mandatory-gate authoring template beep's skill
frontmatter does not enforce. **Defer** — real value, but it is a different initiative and
would fork this packet's appetite.

---

### G13 — 3,413 authored `tags` are an unmined practice taxonomy *(defer / fold)*

`mine-dms-taxonomy.md` built a 14-shape taxonomy by classifying firm-knowledge instructions.
Meanwhile 1,262 tasks carry hand-authored `tags` (3,413 distinct: `private-equity` 168,
`due-diligence` 163, `Mergers & Acquisitions` 153, `redline-markup` 41, `issue-spotting` 72…)
— a human-authored vocabulary that is *evidence rather than inference*. **Fold into G1**;
worth one paragraph, not a report.

---

### G14 — `utils/playback.py` (1,708 lines) read structurally only *(ignore for now)*

A trajectory-replay renderer "designed for non-technical reviewers", plus
`build_message_history_from_transcript()` for checkpoint resume. Genuinely interesting prior
art for beep's own session/QA timeline surfaces, but not decision-bearing for any current
opportunity, and `map-pipeline-docs.md` D7 already established its tests are inert and stale.
**Ignore** — revisit only if a transcript-review surface graduates.

---

### G15 — Residual cosmetics *(ignore)*

`harness/adapters/mistral.py` not read line-by-line; `scripts/setup.sh` not verified at line
level; `docs/assets/`; `uv.lock`. All self-declared, none load-bearing.

---

## 3. What this pass added that no report contains

1. **§G2 — the redline-blind path.** New defect, verified: agent read (`parse_doc.py:26-33`,
   no `--track-changes`) and judge read (`scoring.py:31`, default `ACCEPT`) both destroy
   revision marks; `evaluation_options` is used by 0 of 2,010 tasks; 393 tasks / 5,945 criteria
   grade redline work; 480 redline-named docx across 371 tasks, 12/12 sampled carry real
   `w:ins`/`w:del`.
2. **§G3 — podman and pandoc are absent from this machine.** Closes
   `mine-synthetic-corpus.md` §7's first open item and blocks
   `mine-benchmark-integration.md`'s rank-1 recommendation.
3. **§G1 — the repo-wide census**: 27 areas, per-area criteria density, the
   `work_type` split (444 draft / 306 review / 488 analyze / 24 research / 748 absent), 1,262
   deliverable-bearing tasks, 3,413 tags, and 51,683 non-firm-knowledge documents.
4. **The diligence data rooms** — 11 corpora of 2,600–4,061 documents with a *numbered
   controlled VDR taxonomy*, and `rail-horizontal-merger` at 1,114 criteria (the largest rubric
   in the repo; `map-task-census.md`'s "hardest archetype" #1 at 122 criteria is ninth-order by
   comparison).
5. **A scope correction**: "C&H does not cover patent work" is true of the corpus and false of
   the task set — 147 IP rubrics exist, including patent-litigation drafting.
6. **Engram sizing** — Cartridges / Active Reading exist as published prior art for the exact
   amortization thesis (snippet-level, UNVERIFIED).

---

## 4. Claims still unverified that a decision would rest on

Beyond `verify-facts.md` §H (which is thorough and should be read as-is), these are the ones
where an align-stage decision would inherit the uncertainty:

| # | Unverified claim | Who depends on it | Severity |
|---|---|---|---|
| U1 | **The 14 task shapes and 7 criterion roles are classifier outputs whose classifier was not published** (`verify-facts` §H1/H2 — "hand-corrected on 25 misroutes"; the report's own role table and per-shape table disagree by one column) | `mine-dms-taxonomy.md` builds its **entire** 10-capability catalog, its "3 of 14 shapes servable" verdict, its O5 acceptance matrix, and its 14-task/52-criterion smoke suite on top of it | **HIGH** — a downstream report treats an UNVERIFIABLE input as fact, and no report flags the dependency |
| U2 | `ACCEPTABLE EITHER WAY` is honoured by the judge (the prompt is a bare PASS/FAIL with no special handling) | `mine-eval-methodology.md` #4 and `mine-synthetic-corpus.md` §4.6 both design *around* it being a real weakness | **MED** — testable in one judge call once G3 unblocks |
| U3 | `PracticeKgToolResult.truncated` is honestly set end-to-end (`goals/practice-kg-mcp` P7 B-6 lists it as pending) | `mine-benchmark-integration.md` O5's entire premise ("beep already models the fix") | **MED** |
| U4 | `@beep/pandoc-ast` preserves tracked changes (`rg` found no `w:ins`/`track`/`redline`) | O4 in benchmark-integration; O2 in synthetic-corpus; **and now G2, which makes it the wedge** | **HIGH** — promoted by G2 from footnote to gating question |
| U5 | Extraction throughput of `beep corpus extract` over 9,288 files / 515 MB | every wall-clock estimate in `mine-benchmark-integration.md` §4 | **MED** |
| U6 | The Track A `docs_dir` seam does not expose `tasks/` inside the mount | invalidates every number if wrong; already flagged as trap #1, never tested | **HIGH** — must be a test before the first run |
| U7 | Harvey's published baselines came from this public harness | comparability of any number we publish | **MED** — mitigated by re-running our own arm |
| U8 | `p^n` all-pass expectations assume independent criterion errors | every "expected all-pass" figure quoted downstream; `map-task-census.md` §9 concedes real correlated-error all-pass is lower on trend/distribution tasks | **LOW-MED** — quote with the assumption attached |
| U9 | The 250 firm-knowledge rubrics were never cross-checked for *content* (only names) | `verify-facts` §F is explicit that it is a name-level check | **LOW** |

---

## 5. Sharpest questions for the align stage to grill

Ordered by how much the answer re-shapes everything downstream.

**Q1. Which corpus is the first experiment run against — C&H firm-knowledge or one diligence
data room?** C&H matches the published thesis and the frontier baselines, and is unaffordable
to sweep whole. A diligence room is ~3,400 documents with 438–1,114 attached criteria,
runnable end-to-end, and closed (so doc-coverage is exact) — but it is a *review/deliverable*
task, not a retrieval task, so it tests a different claim. **This single choice re-ranks every
opportunity in the packet.**

**Q2. Is beep's wedge "amortized structural representation" or "tracked-changes-aware
ingest"?** The first is the thesis Harvey and Engram both named, so we are entering a crowded
race with a $98M competitor (G4). The second is unclaimed, has a 371-task graded testbed
(G2), lands in an existing packet, is information the stock agent cannot obtain at any budget,
and is directly OIP-load-bearing. Are they sequenced, or does one win?

**Q3. Do we run their harness at all?** `DECISIONS.md` already rejected porting their eval
code. Running their *harness* means installing podman (sudo/YubiKey), accepting a Python stack
we will not maintain, and inheriting `finished_cleanly` and silent-truncation defects — in
exchange for the only externally-comparable number available. The alternative (grade with our
own eval from day one) is cheaper and non-comparable. Which, and for how long?

**Q4. How many goal packets does this graduate into?** Benchmark integration, the synthetic
corpus generator, the Effect-native eval framework, and the DMS capability rungs are four
appetites with one shared corpus. Only one of them (benchmark integration) produces an
external falsifiable number; only one (the eval framework) is a dependency of the other three.
What is the first bet, and what is explicitly deferred?

**Q5. What does "standing test asset" (DECISIONS, 2026-08-08) operationally mean?** A 5.3 GB
out-of-repo clone, a gitignored derived index, recurring API spend, and a CI lane that cannot
run it. Where does the corpus live, what is pinned, what runs in CI vs. on demand, and what is
the containment against the OIP corpus (`mine-benchmark-integration.md` §7.7)?

**Q6. Do we contribute the defect ledger upstream?** (G8.) Credibility and visibility versus
publicising G2 while it is still an advantage.

**Q7. Do we accept the 14-shape taxonomy as a requirements document given its classifier was
never published?** (U1.) Either re-derive it with a stated rule, or downgrade
`mine-dms-taxonomy.md`'s capability catalog from "requirements" to "hypothesis" before it
seeds a SPEC.

**Q8. For OIP specifically: generator or rungs?** `mine-synthetic-corpus.md` (build a
prosecution corpus generator, 2–3 weeks + a pandoc driver) and `mine-dms-taxonomy.md` O1/O2
(conflicts edges + matter lifecycle, small schema deltas on live `LiteralKit` domains) compete
for the same appetite and serve the same practice. The second is far cheaper and unblocks
`goals/practice-kg-mcp`; the first is the only path to a graded OIP eval that can ever be
shared. Which first?

---

## 6. UNVERIFIED in this report

- **Engram / Cartridges / Active Reading** — one web search, snippet-level only. Nothing was
  read at source. Treat every characterisation in G4 as a lead, not a fact.
- **The pandoc `--track-changes` default is `accept`** — asserted from the documented pandoc
  contract and from LAB's own code (`scoring.py` names `ACCEPT` as its default and `ALL` as the
  opt-in), **not** executed here, because pandoc is not installed (G3). The observable facts —
  no flag in `parse_doc.py`, `ACCEPT` default in `scoring.py`, zero tasks setting
  `evaluation_options`, 12/12 sampled files carrying real revision marks — stand regardless;
  the *consequence* should be confirmed by one command once pandoc exists.
- **12 of 12 redline sample** is a seeded random sample of 12 from 480; the 100% rate is
  indicative, not exact.
- **Per-area document counts** are name-level `os.walk` over `tasks/*/**/documents/**`; a task
  laying documents out differently would be undercounted.
- **`work_type` "absent 748"** includes all 250 firm-knowledge tasks; the remaining 498 absences
  are entirely `tasks/contracts` (unexamined here beyond the count).
- I did **not** re-verify any claim already adjudicated in `verify-facts.md`; §4 above inherits
  its verdicts.
- Nothing under `tasks/firm-knowledge/dms/` was opened.

---

## 7. Reproduction

```bash
cd ~/YeeBois/research/harvey-labs

# repo-wide task census (all 27 areas; task.json only)
python3 - <<'PY'
import json, glob, collections
areas=collections.Counter(); crit=collections.Counter(); wt=collections.Counter(); n=0
for f in glob.glob('tasks/**/task.json', recursive=True):
    a=f.split('/')[1]; t=json.load(open(f))
    areas[a]+=1; crit[a]+=len(t.get('criteria',[])); wt[t.get('work_type','<none>')]+=1; n+=1
print(n, sum(crit.values())); [print(a,c,crit[a]) for a,c in areas.most_common()]
print(dict(wt))
PY

# non-firm-knowledge document census (NAME LEVEL ONLY)
python3 - <<'PY'
import os, glob, collections
ext=collections.Counter(); n=0
for a in glob.glob('tasks/*/'):
    if a.split('/')[1]=='firm-knowledge': continue
    for dp,dn,fn in os.walk(a):
        if os.sep+'documents' not in dp+os.sep: continue
        for x in fn: ext[os.path.splitext(x)[1].lower()]+=1; n+=1
print(n, ext.most_common())
PY

# the redline finding
sed -n '26,33p' sandbox/parsers/parse_doc.py          # no --track-changes
sed -n '31,33p;352,353p' evaluation/scoring.py        # ACCEPT default; opt-in ALL
grep -rl evaluation_options tasks/ | wc -l            # 0
python3 -c "
import zipfile,re
x=zipfile.ZipFile('tasks/intellectual-property/analyze-counterparty-markup-of-saas-agreement/documents/cumulus-redline-markup.docx').read('word/document.xml').decode('utf8','replace')
print(len(re.findall(r'<w:ins ',x)), len(re.findall(r'<w:del ',x)))"   # 170 133

# runtime prerequisites
for c in podman docker uv python3 pandoc; do printf '%-8s ' $c; command -v $c >/dev/null && $c --version|head -1 || echo NOT FOUND; done
```
