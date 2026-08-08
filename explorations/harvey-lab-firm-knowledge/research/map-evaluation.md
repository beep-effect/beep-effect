# Map: the harvey-labs evaluation pipeline

Date: 2026-08-08
Agent: eval-pipeline mining agent (Opus 5)
Source clone: `~/YeeBois/research/harvey-labs` @ working tree as cloned 2026-08-08
Citations are **relative to the clone root**, `file:line` where practical.
Nothing under `tasks/firm-knowledge/dms/` was read (100M-token corpus, hard rule).

---

## 0. TL;DR — what is actually portable

The eval side of LAB is ~1,900 lines of Python with no database, no service, and
no golden-answer files. Its whole leverage comes from five decisions, all of
which port cleanly to beep's LLM-judge gates (`bun run beep qa` judge
inventories, `quality-review-fix-loop`, future eval harnesses):

1. **The rubric is the gold standard.** `match_criteria` prose *is* the
   evaluation standard — no reference output to maintain or drift
   (`docs/eval-strategies.md:222`, `:231`).
2. **One judge call per criterion**, never one call per task
   (`evaluation/scoring.py:342-381`). Isolation kills cross-criterion
   interference and makes every verdict individually attributable.
3. **Criterion-scoped context.** Each criterion declares which output files the
   judge may see; the judge sees nothing else
   (`evaluation/scoring.py:343-358`).
4. **All-pass task scoring** with a *criterion-pass diagnostic* kept alongside
   it (`evaluation/scoring.py:384-386`, `evaluation/run_eval.py:116-137`).
   Binary gate for the decision, fraction for the debugging.
5. **Structured-output ladder with graceful degradation** — schema-constrained
   JSON on early attempts, unconstrained + brace-matching salvage on the last
   (`evaluation/judge.py:99-105`, `:232-259`).

Two things are *not* portable as-is and are documented below as traps: the
dual-judge aggregate arithmetic disagrees with its own HTML report (§7.3), and
the deliverable-scoping mechanism is bypassed by 29% of criteria including
**every single firm-knowledge task** (§5.3).

---

## 1. Pipeline shape

Filesystem-first, three phases, no DB, no web service
(`docs/architecture.md:3`).

```
harness.run        →  results/<run-id>/{config.json, transcript.jsonl, metrics.json, output/}
evaluation.run_eval →  results/<run-id>/{scores.json | scores_<judge>.json + scores_dual.json}
evaluation.report   →  results/<run-id>/report.html
evaluation.compare  →  results/comparisons/<scope>/comparison.html
```

Canonical run-dir layout: `docs/architecture.md:255-263`; created at
`harness/run.py:278-284`.

Module inventory (`evaluation/`):

| File | Lines | Role |
|---|---|---|
| `judge.py` | 259 | Provider-agnostic LLM-judge wrapper + JSON salvage |
| `scoring.py` | 392 | Criterion scoring, deliverable resolution, file→text extraction |
| `run_eval.py` | 330 | CLI, task validation, single + dual judge orchestration |
| `report.py` | 210 | Per-run HTML report; dual→single normalization |
| `compare.py` | 699 | Multi-run dashboards at task / area / global scope, cost model |
| `charts.py` | 655 | 9 matplotlib/seaborn chart generators |
| `prompts/rubric_criterion.txt` | 26 | The **only** judge prompt template in the repo |

Entry points are `python -m evaluation.run_eval` / `.report` / `.compare`;
`scripts/evaluate_submission.py` and `scripts/run_model_sweep.py` are thin
compatibility shims (`scripts/evaluate_submission.py:1-19`).

---

## 2. Rubric schema

### 2.1 Code-enforced contract

`evaluation/run_eval.py:27-28`:

```python
REQUIRED_TASK_KEYS = {"title", "instructions", "criteria"}
REQUIRED_CRITERION_KEYS = {"id", "title", "match_criteria"}
```

`validate_task_config` (`evaluation/run_eval.py:32-56`) is the single gate, and
it is called by **both** the harness (`harness/run.py:53`) and the evaluator
(`evaluation/run_eval.py:100`) — a task that cannot be graded cannot be run.
That bidirectional gate is the cheapest good idea in the whole repo.

### 2.2 Full field set

| Field | Level | Required | Meaning |
|---|---|---|---|
| `title` | task | yes | Passed to the judge as `task_description` |
| `instructions` | task | yes | First user message (not system prompt) — `harness/run.py:340` |
| `criteria` | task | yes | Non-empty list; the inline rubric |
| `docs_dir` | task | no | Relative corpus redirect; firm-knowledge sets `"../../dms"` (`harness/run.py:56-62`) |
| `deliverables` | task | recommended | Expected-filename → canonical-name map (`docs/eval-strategies.md:53-67`) |
| `work_type` | task | no | `analyze` / `draft` / `review` / `research` (metadata only; no code reads it except the integrity test) |
| `tags` | task | no | metadata only |
| `id` | criterion | yes | e.g. `C-001`; must be unique (`tests/test_task_integrity.py:177-183`) |
| `title` | criterion | yes | Passed to the judge as `criterion_title` |
| `match_criteria` | criterion | yes | **The evaluation standard itself** |
| `deliverables` | criterion | no | Filenames this criterion may see; absent ⇒ judge sees all output |
| `sources` | criterion | no | Source doc filenames; **declared in docs, never read by any code** |
| `evaluation_options` | criterion | no | Only `include_docx_redlines` is honored (`evaluation/scoring.py:352-353`) |
| `weight` | criterion | **banned** | Legacy; integrity test fails the build if present (`tests/test_task_integrity.py:157-160`) |

`weight` being *actively banned by test* is the tell that all-pass grading was a
deliberate migration away from weighted means, not an initial simplification.

### 2.3 Corpus census (measured, this clone, 2026-08-08)

```
tasks/**/task.json                     2,010 files
  total criteria                     114,912
  firm-knowledge                         250 tasks /   3,098 criteria
  all other practice areas             1,760 tasks / 111,814 criteria
tasks with top-level `deliverables`     1,262
criteria carrying `deliverables`       81,035  (70.5%)
criteria with a NON-EMPTY `sources`          0  (219 declare it; all empty arrays)
task-dir nesting depth                   2: 1,143 | 3: 575 | 4: 292
```

firm-knowledge rubric distribution (250 tasks, 3,098 criteria):

```
min 1  median 7  mean 12.4  max 122
heavy tail: 122 (task 188 "Average Deal Size by Practice Area"),
            69 (204), 53 (155), 52 (186), 51 (136), 48 (145), 47 (041), 45 (189)
`docs_dir` = "../../dms" on all 250 (single shared persistent corpus)
```

Two rubric idioms measured across firm-knowledge, both worth stealing (§13.2):

- **175 "precision" criteria** — a terminal criterion that fails the task if the
  answer asserts anything *outside* the ground-truth set. Example
  `tasks/firm-knowledge/tasks/200/task.json:28-31`.
- **61 tasks carry `ACCEPTABLE EITHER WAY` clauses** — explicitly neutral items
  the judge must not reward *or* penalize. Example
  `tasks/firm-knowledge/tasks/001/task.json:60`.

**Doc drift (verified):** `docs/eval-strategies.md:183` claims "1,660 tasks …
~101,000 rubric criteria"; the tree holds 2,010 / 114,912. Packet `CAPTURE.md`
inherits a third number (1,671). Treat all published counts as stale.

---

## 3. Judge invocation

### 3.1 Construction and provider routing

`Judge(model="claude-sonnet-4-6")` (`evaluation/judge.py:46`). The provider is
inferred from the **model-name prefix**, not configured
(`evaluation/judge.py:30-41`):

```
claude*                 → anthropic
gemini*                 → google
gpt* | o1|o3|o4|o5*     → openai
mistral*                → mistral
otherwise               → ValueError
```

**Capability gap:** the *harness* routes six providers including Fireworks
(`kimi*`, `glm*`, `nemotron*`) and Baseten (`harness/run.py:98-180`), but the
*judge* only knows four. Open-weight models can be evaluated, never used as
judges. If beep copies this, make judge-provider routing share one table with
run-provider routing.

### 3.2 The single prompt template

`evaluation/prompts/rubric_criterion.txt` (26 lines) is the entire judge
surface. Four `{}` variables, formatted via `str.format`
(`evaluation/judge.py:80`):

| Variable | Source |
|---|---|
| `task_description` | `task.json` → `title` (`evaluation/run_eval.py:106`) |
| `agent_output` | criterion-scoped concatenation (§5) |
| `criterion_title` | criterion `title` |
| `match_criteria` | criterion `match_criteria` |

Body reduces to: *"PASS: output satisfies the criterion. FAIL: it does not.
Respond with JSON only: `{verdict, reasoning}`"*
(`evaluation/prompts/rubric_criterion.txt:14-26`). No rubric-wide persona, no
few-shot examples, no chain-of-thought scaffolding, no severity ladder. All
domain nuance lives in `match_criteria`.

Note `str.format` on a template that also contains literal JSON braces — the
template escapes them as `{{`/`}}` (`:22`,`:26`). That is a real footgun for
anyone authoring new templates.

### 3.3 Response contract and the degradation ladder

`_VERDICT_SCHEMA` (`evaluation/judge.py:20-28`): strict object,
`verdict ∈ {"pass","fail"}` + `reasoning: string`, `additionalProperties: false`.

Every provider path implements the same ladder (`_retries = 2` default,
`evaluation/judge.py:68`):

- **attempt 0** — send with provider-native structured output
  (`output_config.format.json_schema` for Anthropic `:99-105`;
  `response_schema` for Google `:140-142`; `text.format` + `strict: true` for
  OpenAI `:170-178`; `response_format: json_object` for Mistral `:202-203`).
- **attempt 1 (last)** — **drop the schema** and parse free text. The comment at
  `:109-111` is the reason: 500s on the structured-output path were observed to
  succeed unconstrained.
- Failure after both ⇒ `ValueError` naming the last error (`:128-130`).

`temperature=0.0` everywhere and `evaluate_from_file` never overrides it
(`evaluation/judge.py:218-230`), so judging is deterministic by construction.
Anthropic client is built with `max_retries=1` (`:56`) so the ladder, not the
SDK, owns retry semantics.

### 3.4 JSON salvage parser

`Judge._parse_json` (`evaluation/judge.py:232-259`) is a three-stage rescue:
fenced ```` ```json ```` block → balanced-brace scan from each `{` → raise. This
is the piece most directly reusable in beep — it makes the unconstrained
fallback attempt actually pay off rather than just failing differently.

### 3.5 Context-overflow guard

`evaluation/judge.py:114-121` turns `stop_reason == "max_tokens"` into an
explicit, *diagnostic* error rather than a garbage verdict:

> "Judge response truncated (stop_reason=max_tokens, input_tokens=…,
> max_tokens=16384). The agent output is likely too large for the judge context
> window. **Ensure criteria have deliverables lists to scope output.**"

`max_tokens` is hard-coded to 16384 on all four provider paths. The guard exists
only on the Anthropic path; Google/OpenAI/Mistral truncation falls through to
the parser and surfaces as an unparseable-response error instead.

---

## 4. Scoring: all-pass

`score_rubric` (`evaluation/scoring.py:298-392`) fans criteria out across a
`ThreadPoolExecutor(max_workers=max(parallel,1))` (`:380-381`), then:

```python
n_total  = len(criteria_results)
n_passed = sum(1 for c in criteria_results if c.verdict == "pass")
score    = 1.0 if n_total > 0 and n_passed == n_total else 0.0
```
— `evaluation/scoring.py:383-386`

Rationale, stated verbatim at `docs/eval-strategies.md:98`: *a diligence memo
that catches 95% of issues but misses one material one is not 95% useful — it's
wrong.* The operational question is "how often does the agent get **everything**
right?"

The corollary that beep should adopt with it (`docs/eval-strategies.md:110`,
`CONTRIBUTING.md:97`): under all-pass, *nice-to-have criteria are actively
harmful* — they depress the headline without adding signal. Rubrics should
contain exactly what a supervising reviewer would check before shipping.

### 4.1 Diagnostic fields

`scores.json` shape (`evaluation/run_eval.py:125-154`):

```jsonc
{
  "score": 0.0, "max_score": 1.0,          // the binary gate
  "all_pass": false, "n_criteria": 12, "n_passed": 8,   // the diagnostics
  "summary": "8/12 criteria passed.  Missed 4 — task FAIL.",
  "criteria_results": [{ "id", "title", "verdict", "reasoning" }],
  "run_id", "task", "judge_model", "scored_at",
  "cost":         { "input_tokens", "output_tokens", "wall_clock_seconds" },
  "doc_coverage": { "documents_read", "total_documents", "documents_skipped",
                    "documents_read_list", "documents_skipped_list" }
}
```

`cost` and `doc_coverage` are **lifted from `metrics.json`**, not recomputed
(`evaluation/run_eval.py:139-154`) — the scorer is a pure function of
(rubric, output dir, judge) plus a metrics passthrough. That separation is what
makes re-grading a saved trajectory cheap.

Every verdict's `reasoning` is persisted, which is what makes post-hoc review of
borderline calls possible (`docs/eval-strategies.md:232`).

---

## 5. Criterion-scoped deliverables

### 5.1 Mechanism

Per criterion (`evaluation/scoring.py:343-358`): if the criterion declares
`deliverables`, build `agent_output` from *only* those resolved files, each
prefixed `## Agent Output: <name>`; otherwise fall back to `full_output`, the
entire output directory pre-loaded once (`:337-340`).

Purpose stated at `docs/eval-strategies.md:67`: a criterion about DDQ-response
accuracy sees only the DDQ file, never the issues memo — "focused context and
prevents cross-contamination between unrelated deliverables."

### 5.2 The four-rung filename resolver

Agents do not reliably name their files. `_match_deliverables`
(`evaluation/scoring.py:135-193`) resolves expectation → reality:

1. **Exact** filename present ⇒ use it (`:151-155`).
2. **Sole file of that extension** (excluding the thread export `output.*`,
   `_is_thread_export` `:101-103`) ⇒ use it (`:164-168`).
3. **Fuzzy keyword overlap** — stem lowercased, `-`/`_`→space, set-intersection
   size wins (`_fuzzy_match_filename` `:106-132`).
4. **LLM matcher** — remaining unmatched deliverables go to a second, separate
   Anthropic call with 500-char previews of each candidate and a dynamically
   built JSON schema whose properties are exactly the deliverable keys
   (`_llm_match_deliverables` `:196-265`).

Each rung marks the file `used`, so no file satisfies two deliverables
(`tests/test_scoring.py:321`). The LLM matcher hardcodes `claude-sonnet-4-6`
(`evaluation/scoring.py:251`) independent of `--judge-model` — a second,
invisible model dependency in what looks like a single-judge run.

### 5.3 Trap: the fallback is the majority path for firm-knowledge

Measured: **0 of 250** firm-knowledge `task.json` files carry `deliverables` at
either level; repo-wide 33,877 of 114,912 criteria (29.5%) lack them. Those
criteria hit `_load_all_output` (`evaluation/scoring.py:276-295`), which
concatenates *every* file in `output/` (minus `node_modules`, `.venv`,
lockfiles, sourcemaps — `:271-273`) for **every** criterion.

Consequence: firm-knowledge task 188 issues **122 judge calls, each carrying the
full agent output**, and the truncation guard's own advice ("ensure criteria
have deliverables lists to scope output") is unactionable for that task family.
This is the sharpest inconsistency in the pipeline and the first thing beep
should not replicate: **make the scoping contract mandatory, not optional.**

### 5.4 File→text extraction parity

`_read_file_as_text` (`evaluation/scoring.py:31-74`) deliberately mirrors
`harness/tools.py` so judge and agent read identically: pandoc for `.docx`
(`--wrap=none --track-changes=accept|all`), pandas per-sheet for `.xlsx`,
markitdown for `.pptx`, pdfplumber (text + tables) for `.pdf`, UTF-8 read
otherwise. Errors degrade to `"(error reading …)"` strings rather than raising —
a missing deliverable yields `"(File not found: …)"` and the criterion still
gets judged (`:349-351`, `tests/test_scoring.py:127`).

`evaluation_options.include_docx_redlines` flips `--track-changes` from `accept`
to `all` so a redlining criterion can see the markup while sibling criteria read
clean text (`:352-353`). **UNVERIFIED in practice:** zero task.json in this
clone uses `evaluation_options`; only `tests/test_scoring.py:139` exercises it.

---

## 6. Judge-model configuration

| Knob | Default | Where |
|---|---|---|
| `--judge-model` | `claude-sonnet-4-6` | `evaluation/run_eval.py:274-277` |
| `--dual` | off | `evaluation/run_eval.py:278-285` |
| `--parallel` (judge calls per run) | 6 | `evaluation/run_eval.py:286-291` |
| judge temperature | 0.0 | `evaluation/judge.py:68` (not CLI-exposed) |
| judge `max_tokens` | 16384 | hardcoded per provider path |
| deliverable-matcher model | `claude-sonnet-4-6` | hardcoded, `evaluation/scoring.py:251` |
| API keys | `.env` auto-loaded with `setdefault` | `evaluation/run_eval.py:69-81` |
| sweep judge fan-out | `min(parallel, 4)` per task / `min(parallel, 8)` global | `utils/sweep.py:499`, `:530` |

Note the sweep invokes the evaluator with `--parallel 1` (`utils/sweep.py:467`)
and parallelizes at the *run* level instead — judge-API rate limits are managed
at one layer only.

---

## 7. Dual-judge profile

### 7.1 Definition

`JUDGE_MODELS = ("claude-sonnet-4-6", "gpt-5.5")` — `evaluation/run_eval.py:29`.
Cross-vendor by construction; `--dual` grades one saved trajectory
independently with both (`evaluate_run_dual`, `:163-225`).

### 7.2 Artifact atomicity (the good part)

- `scores_dual.json` is **unlinked before** grading so a failed re-grade cannot
  leave a stale complete aggregate behind (`:178-179`).
- After each judge, `scores.json` is **renamed** to `scores_<judge>.json` so the
  next judge cannot clobber it (`:191-194`).
- The aggregate is written **only after both judges succeed** (`:221-224`).

Enforced by test: a mid-run judge failure leaves judge-1's artifact, no judge-2
artifact, no aggregate, and no `scores.json`
(`tests/test_eval_integration.py:265-294`).

### 7.3 The arithmetic — and where it disagrees with itself

Aggregate (`evaluation/run_eval.py:196-220`):

```
dual_criterion_pass = mean over judges of (n_passed / n_criteria)
dual_all_pass_rate  = mean over judges of (1.0 if judge all-passed else 0.0)   # ∈ {0, 0.5, 1}
all_pass            = (dual_all_pass_rate == 1.0)                              # strict AND
```

But the **report** flattens dual differently: `_normalize_dual_scores`
(`evaluation/report.py:19-71`) marks a criterion `pass` only if **every judge**
passed it (`:53`) — an AND-merge — while setting the headline `score` to
`dual_criterion_pass`, the **mean** (`:68`).

So for one task a dual report can show `Score 0.875` beside `Criteria Passed
7/8` — a fraction from the mean and a count from the intersection. Verified
numerically by `tests/test_eval_integration.py:257-259` (0.875 / 0.5 for one
disagreeing criterion across two judges). **Portability caution:** pick one
reconciliation rule (mean *or* intersection) and use it in both the aggregate
and the render; do not ship two.

Judge reasoning is preserved and prefixed per model (`[gpt-5.5] …`) so
disagreements are readable (`evaluation/report.py:47-49`, asserted at
`tests/test_eval_integration.py:322-324`).

### 7.4 Cross-task rollup

`compare._comparison_scores` (`evaluation/compare.py:111-149`) tags each run
`judge_profile: "single" | "lab-standard-dual-v1"`. For dual it **sums passed
and total across both judges** (`:134-140`) — so an 8-criterion task reports
`16/16` in the leaderboard "Passed" column. Intentional pooling, trivially
misread.

`_aggregate_across_tasks` (`:226-340`) then emits three rates:

- `all_pass_rate` — headline; dual tasks contribute 0/0.5/1 (`:296-301`)
- `criterion_pass_rate_pooled` — Σpassed / Σcriteria; every criterion equal weight
- `criterion_pass_rate_macro` — mean of per-task fractions; every task equal weight
- `all_pass_both_agree_rate` — strict both-judges-all-passed (`:302-303`)

`criterion_pass_rate` is kept as an **alias for pooled** for backward
compatibility (`:313`, documented `docs/eval-strategies.md:142-144`). Single-judge
aggregates coerce `all_pass_count` back to `int` to preserve legacy consumers
(`:297-300`). This is disciplined metric-versioning worth copying: add rates,
never redefine an existing key.

---

## 8. Reports and dashboards

### 8.1 Per-run `report.html`

`evaluation/report.py:74-193`. Self-contained HTML with inline CSS. Reads
`scores.json`, falling back to `scores_dual.json` via normalization
(`:76-86`). Four stat tiles — Score, Criteria Passed, Doc Coverage,
`ALL PASS` / `MISSED N` badge (`:173-183`) — then one collapsible
`<details>` per criterion showing the judge's verdict badge, title, id, and full
reasoning (`:101-114`).

Doc Coverage as a first-class report tile (documents-read / total in corpus) is
the reason the "stopping-failure" diagnosis in the announcement was legible at
all: it separates *did not look* from *looked and got it wrong*.

### 8.2 Four dashboard scopes

`evaluation/compare.py:1-14`:

| View | Command | Output |
|---|---|---|
| 1 single run | `python -m evaluation.report --run-id <id>` | `results/<id>/report.html` |
| 2 per task | `compare --task <area/slug>` | `results/comparisons/<task>/comparison.html` |
| 3 per area | `compare --area <area>` | `results/comparisons/<area>/comparison.html` |
| 4 global | `compare --all [--save-images]` | `results/comparisons/_global/comparison.html` |

`collect_runs` (`:152-223`) rglobs both `scores.json` and `scores_dual.json`,
requires a sibling `config.json`, applies task/area filters, and **dedupes to
the latest timestamp per (model-label, task)** (`:216-223`). Dual runs get a
`" [dual]"` label suffix (`:184-185`) so they rank as a separate config.

`_write_html` (`:632-674`) base64-inlines every PNG into one file — dashboards
are portable single artifacts with zero external requests. (Directly relevant to
beep's Artifact CSP constraints.)

### 8.3 Chart inventory (`evaluation/charts.py`)

| Function | Line | What it shows |
|---|---|---|
| `leaderboard_table` | 51 | rank, model, score, all-pass, passed, docs, tokens, time, cost (`:64`) |
| `criterion_heatmap` | 132 | models × criterion-ids, green/red pass matrix |
| `pareto_scatter` | 189 | quality vs cost/latency, x-axis reversed so upper-right = ideal; `y_field` swappable to `all_pass_rate` |
| `bump_chart` | 272 | rank movement across tasks |
| `grouped_bars` | 331 | score by task |
| `radar_plot` | 376 | model profile across tasks or practice areas |
| `task_heatmap` | 422 | models × tasks |
| `rubric_vs_allpass_bars` | 476 | all-pass vs criterion-pass diagnostics side by side; **4 series when any dual run is present** (adds both-agree + macro, `:497-531`) |
| `all_pass_distribution` | 587 | stacked bands `100% / 95-99 / 90-94 / 80-89 / <80` (`:606-607`) |

`all_pass_distribution` is the single most transferable visualization: it makes
the 95%-is-not-95%-useful argument visible — a config can own the 95-99% band
and still have a near-zero 100% column. Colors are provider-coded
(`PROVIDER_COLORS`, `:20-25`).

### 8.4 Cost model

`MODEL_INFO` (`evaluation/compare.py:29-69`) maps model → (display name, $/1M
input, $/1M output) across Anthropic / OpenAI / Google / Fireworks / Baseten.
Resolution is **longest-prefix match** so `GLM-5.2` does not fall back to
`GLM-5` (`_model_info` `:78-91`, comment `:56-57`), and an unknown model
**raises** rather than silently costing $0 (`:90`) — asserted by
`tests/test_compare.py:25`. Long-context multipliers are explicitly excluded, so
costs are estimates (`:27-28`).

---

## 9. Trajectory storage

Written by the harness, consumed by the evaluator and playback.

| Artifact | Writer | Contents |
|---|---|---|
| `config.json` | `harness/run.py:301-313` | model, task, run_id, max_turns, temperature, shell_timeout, **reasoning_effort**, skills, sandbox_image, started_at |
| `transcript.jsonl` | `harness/agent_loop.py:124-151` | one line per assistant turn + one per tool call |
| `metrics.json` | `harness/run.py:364-378` | turns, in/out tokens, wall clock, `finished_cleanly`, plus all `tool_metrics` |
| `output/` | agent (`$OUTPUT_DIR`) | the graded deliverables |
| `scores*.json`, `report.html` | evaluator | §4, §7, §8 |

Run id is deterministic and hierarchical: `<task>/<model>[-effort]/<timestamp>`
(`harness/run.py:266-271`; sweep mirrors it in `make_config_id` /
`make_run_id`, `utils/sweep.py:271-280`).

**Transcript is lossy by design** — assistant text truncated to 500 chars
(`harness/agent_loop.py:132`), tool results to a 1000-char `result_preview`
(`:148`), flushed per line so a killed run keeps a readable prefix. Tool call
*arguments* are kept in full.

`tool_metrics` from `ToolExecutor.get_metrics` (`harness/tools.py:646-668`)
supplies the coverage numbers: `documents_read` + `documents_read_list`,
`documents_skipped` + `documents_skipped_list`, `total_documents` (rglob of the
corpus), `bash_commands`, `files_written`, `files_edited`, `glob_searches`,
`grep_searches`. The **skipped-document list** is the artifact that makes
"stopping failure, not search failure" a measurable claim rather than a vibe.

Failure taxonomy is recorded, not just success: `context_overflow` is detected
by matching `"prompt is too long"` / `"context_length_exceeded"` and breaks the
loop cleanly (`harness/agent_loop.py:68-74`), and `finished_cleanly` is
`not overflow and no-pending-tool-calls` (`:116-118`).

Two consumers:

- `utils/playback.py` (1,708 lines) — renders a trajectory as a human timeline
  in terminal or HTML for non-technical reviewers, grouping steps into phases
  and re-hydrating truncated transcript args from saved skill-output files
  (`_enrich_transcript`, `:133`).
- `build_message_history_from_transcript` (`utils/playback.py:1632`) —
  reconstructs message history up to turn N so a run can be **replayed and
  resumed** from a checkpoint (`tests/test_checkpoint_resume.py:1-8`).

---

## 10. Sweep orchestration

`utils/sweep.py` (766 lines), three phases + preflight
(`docs/architecture.md:235-240`).

Idempotence is the design centre:

- Agent phase skips a config entirely if any prior run exists
  (`find_latest_run`, `utils/sweep.py:283-297`, used at `:328`).
- Eval phase skips if `scores.json` already exists (`:454-456`).
- Timeouts: 7200s per agent run (`:352`), 1800s per eval (`:474`).
- Subprocesses are run in managed process groups with signal handlers so a
  Ctrl-C tears down the whole tree (`:40-90`).

`run_preflight` (`:582+`) validates every task loads, config ids are unique
(truncation collisions are a real hazard — `_model_short` clips to 20 chars,
`:266-267`), and rubric criteria exist — **before** spending any API budget.

---

## 11. Rubric integrity gate

`tests/test_task_integrity.py` parametrizes over **every** `task.json` in the
tree (2,010 of them) and asserts: valid JSON, title > 5 chars, non-empty
`criteria`, unique criterion ids; and for "standard" tasks (those whose first
criterion has `deliverables`, `:41-53`) also: required criterion keys,
`deliverables` is a *list* of non-empty strings, and **no `weight` field**
(`:157-160`).

CI runs the whole offline suite on every PR and push to main
(`.github/workflows/validate-task-schema.yml`). The rubric corpus is treated as
**source under test**, not as data. This is the single most directly adoptable
practice for beep: our judge inventories (`qa-inventory/v1`) are already
schema-validated, but the *rubrics that drive them* are not lint-gated the same
way.

---

## 12. Defects and cautions found (for anyone porting this code)

1. **Dual score/criteria mismatch** — mean vs intersection in the same report
   (§7.3). `evaluation/report.py:53` vs `:68`.
2. **Deliverable scoping is optional but the guard assumes it's mandatory** —
   29.5% of criteria, and 100% of firm-knowledge, bypass it (§5.3).
3. **Truncation guard is Anthropic-only** — Google/OpenAI/Mistral truncation
   surfaces as a parse error with no diagnosis (`evaluation/judge.py:114`).
4. **Hidden second model** — `_llm_match_deliverables` always calls
   `claude-sonnet-4-6` regardless of `--judge-model`
   (`evaluation/scoring.py:251`), so a "pure GPT-5.5 judge" run isn't one.
5. **`response.content[0].text`** assumes the first Anthropic content block is
   text (`evaluation/judge.py:123`) — breaks the moment extended thinking is
   enabled on a judge model.
6. **Judge provider table narrower than run provider table** (§3.1).
7. **`sources` is vestigial** — declared in the docs (`docs/eval-strategies.md:28`),
   present on 219 criteria, all empty, read by nothing.
8. **Doc drift** on task/criteria counts (§2.3).

---

## 13. Portable mechanics for beep's LLM-judge gates

Mapped against what beep already has: `bun run beep qa` (record → extract →
judge) with schema-validated `qa-inventory/v1` inventories, the
`quality-review-fix-loop` reviewer panel, and `motion-evidence-review`.

### 13.1 Adopt directly

| Mechanic | Harvey evidence | beep landing zone |
|---|---|---|
| **One judge call per criterion** | `evaluation/scoring.py:342-381` | Vision-judge findings today are produced per-session; making each *required finding class* its own call would make verdicts independently attributable and re-runnable |
| **Scoped evidence per criterion** | `:343-358` | A judge criterion about grip-resize should see only that gesture's frame strip + event slice, not the whole contact sheet — cuts tokens and cross-contamination |
| **All-pass gate + criterion-pass diagnostic** | `:384-386`, `run_eval.py:116-137` | `beep qa` judge-gate is already binary; persist `n_criteria` / `n_passed` so "how close" is queryable without re-judging |
| **Structured-output ladder + JSON salvage** | `judge.py:99-105`, `:232-259` | Any beep judge calling a provider-native JSON mode should degrade to unconstrained + brace-scan rather than failing the gate |
| **Reasoning persisted per verdict** | `scoring.py:373-378` | Already the norm in QA inventories; keep it non-optional |
| **Rubric corpus as source under test** | `tests/test_task_integrity.py` + CI | Add a `beep lint` rule over judge rubrics: unique ids, required fields, banned legacy fields, mandatory evidence scoping |
| **Cost table that raises on unknown models** | `compare.py:90` | Prevents silent $0 rows in any beep eval leaderboard |
| **Single-file dashboards with inlined images** | `compare.py:632-674` | Matches the Artifact CSP constraint exactly (no external hosts) |

### 13.2 Adopt with adaptation — the two rubric idioms

These are the genuinely novel bits and they are *prose conventions*, not code:

- **Precision criterion.** A terminal criterion whose `match_criteria` reads
  "the answer does not assert any item outside this list: …". Without it,
  all-pass rewards shotgunning — enumerate everything and you hit every
  recall criterion. 175 of 3,098 firm-knowledge criteria are this shape.
  *beep analogue:* a "no fabricated findings" criterion in QA judge rubrics,
  failing the gate when the judge reports issues not present in the evidence.
- **`ACCEPTABLE EITHER WAY` clause.** Explicitly names borderline items the
  judge must neither reward nor penalize
  (`tasks/firm-knowledge/tasks/001/task.json:60`). This is how they keep
  all-pass from becoming a coin flip on genuinely ambiguous ground truth. 61
  of 250 tasks use it. *beep analogue:* judge inventories should carry an
  explicit neutral band for findings that are style-dependent, so the judge
  cannot fail a round on taste.

### 13.3 Fix on the way in

- Make evidence scoping **required** by schema, not optional (§5.3).
- Pick one dual-judge reconciliation rule and use it in aggregate *and* render
  (§7.3).
- Share one provider table between run-routing and judge-routing (§3.1).
- Version metrics additively (`criterion_pass_rate` kept as an alias) — copy
  this discipline verbatim (`compare.py:313`).

### 13.4 Schema-first sketch (design order: schema → service → impl)

If this graduates, the beep shape is not a port of the Python but a redecl:

```
JudgeVerdict      = LiteralKit("pass", "fail")
Criterion         = { id: CriterionId, title: NonEmptyString,
                      matchCriteria: NonEmptyString,
                      evidence: NonEmptyArray<EvidenceRef>,   // REQUIRED, unlike LAB
                      options?: CriterionOptions }
Rubric            = { title, instructions, criteria: NonEmptyArray<Criterion> }
CriterionResult   = { id, title, verdict: JudgeVerdict, reasoning }
RubricResult      = { score: 0|1, allPass: boolean, nCriteria, nPassed,
                      criteriaResults: ReadonlyArray<CriterionResult> }
JudgeProfile      = LiteralKit("single", "dual")   // dual carries per-judge results
```

with the judge itself a `Context.Service` over `effect/unstable/http` (never
`node:http`), criterion fan-out as a bounded `Effect.forEach({ concurrency })`,
and the salvage parser as a `S.Codec` decode with a fallback branch rather than
a try/except ladder. Judge-provider routing belongs in a `LiteralKit` domain
shared with run-provider routing so §3.1 cannot recur.

---

## 14. UNVERIFIED / out of scope

- **`evaluation_options.include_docx_redlines` in production** — supported by
  code and unit-tested, but zero task.json in this clone uses it.
- **Actual baseline numbers** (GPT-5.6-sol, Opus-4.8 ~half criteria, 5+ min/task,
  regression to 0% all-pass) come from the announcement post, not from any
  artifact in the clone — `results/` is gitignored (`docs/architecture.md:265`)
  and absent here. No scored run was available to inspect.
- **`utils/playback.py` HTML rendering** — read structurally (function
  inventory, `load_run`, `_enrich_transcript`, `build_message_history_from_transcript`);
  the 1,700-line render path was not read line-by-line.
- **`harness/adapters/*`** — out of brief; only the factory in `harness/run.py`
  was read.
- **Judge prompt variants** — only one template exists in `evaluation/prompts/`;
  `evaluate_from_file` is generic over `prompts/<name>.txt`
  (`evaluation/judge.py:218-230`), so more templates are anticipated but none
  are shipped.
- **`tasks/firm-knowledge/dms/`** — not read (hard rule). All corpus claims here
  are from `task.json` metadata only.
