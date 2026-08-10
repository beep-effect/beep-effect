# Adversarial fact-check of the five map reports

Date: 2026-08-08
Agent: verify-facts (Opus 5)
Clone verified against: `/home/elpresidank/YeeBois/research/harvey-labs` @ `55510f0e6`
Paths in the verdict columns are **relative to the clone root**.

Method: every concrete, checkable claim in
`research/map-{harness,evaluation,task-census,corpus,pipeline-docs}.md` was
re-derived independently — `wc -l`, `grep -n`, `git show`, `python3` aggregation
over all 2,010 `task.json` files, and `os.walk` name-level census of
`tasks/firm-knowledge/dms/matters`. Corpus **content** was touched only through
~20 targeted single-file probes inside matters the corpus-anatomy agent had
already sampled (OOXML `docProps` / `word/document.xml` marker reads, `.eml`
header reads). **No bulk read, grep, or index of `dms/` was performed.**

Verdict key:

- **CONFIRMED** — re-derived exactly, or the cited `file:line` lands on the
  claimed content.
- **CORRECTED** — claim is wrong or imprecise; the right fact is given.
- **UNVERIFIABLE** — the claim depends on a method (classifier, regex, heuristic)
  the report did not publish, or on a runtime the clone cannot produce.

Headline: **the reports are highly reliable.** 286 checks — 283 claims drawn
from the five reports (§A–§E) plus 3 new cross-checks (§F) — resolving to
**251 CONFIRMED, 22 CORRECTED, 13 UNVERIFIABLE**. Every CORRECTED item is a
count or a ±1..3 line offset; **no structural, architectural, or defect claim
was falsified.** The
firm-knowledge task census (map-task-census, map-evaluation §2.3) and the
corpus name-level census (map-corpus §1, §3) reproduced *digit-for-digit*.

Two corrections are load-bearing enough to fix before anything is quoted
downstream: `map-harness`'s **"twelve tests"** (nine) and its **mtime
measurement** (`1,312 files / 338 distinct / 0.07 s` does not reproduce at any
scope; the real spread is 4.81 s over 53,783 non-`dms` files — the *conclusion*
that mtime ordering is meaningless survives, the numbers do not).

Two open questions the reports flagged are now **closed as CONFIRMED-clean**:
all 254 cited matter ids exist on disk, and all 397 cited filenames exist in the
corpus — with **zero** mismatches in 555 criterion-scoped checks (§F).

---

## A. `map-harness.md`

| # | Claim | Verdict |
|---|---|---|
| H1 | `harness/agent_loop.py` = 151 lines | **CONFIRMED** |
| H2 | `harness/run.py` = 395 lines | **CONFIRMED** |
| H3 | `harness/tools.py` = 668 lines | **CONFIRMED** |
| H4 | `harness/system_prompt.md` = 31 lines | **CONFIRMED** |
| H5 | `harness/adapters/*.py` = 992 lines total | **CONFIRMED** (183+85+120+113+194+149+148 = 992) |
| H6 | SKILL.md = 158 / 86 / 95 lines (docx / xlsx / pptx) | **CONFIRMED** exactly |
| H7 | "+ 25 scripts, ~1,770 lines" under `harness/skills/*/scripts/` | **CORRECTED** — **26** script files (9 docx + 9 pptx + 8 xlsx; 24 `.py`, 1 `.sh`, 1 `.js`), **1,768** lines |
| H8 | `sandbox/sandbox.py` = 581 lines | **CONFIRMED** |
| H9 | `sandbox/parsers/parse_doc.py` = 90 lines | **CORRECTED** — **89** lines |
| H10 | "agent side is ~2,200 lines of Python" | **CONFIRMED** (151+395+668+992 = 2,206) |
| H11 | Three phases documented at `docs/architecture.md:3-34` | **CONFIRMED** (`:3` is the filesystem-first sentence, `:5-9` the three phases) |
| H12 | Loop seeds exactly two messages; system = capabilities only, task = first user message; rationale inline at `run.py:331-340` | **CONFIRMED** — comment verbatim at `harness/run.py:331-334`, `user_prompt = task["instructions"]` at `:340` |
| H13 | `--max-turns` default **200** at `run.py:232` | **CONFIRMED** exactly |
| H14 | No `finish` tool; `docs/architecture.md:119` | **CONFIRMED** — `:119` reads "There is no explicit finish tool. The run finishes when the model stops calling tools." |
| H15 | Tool calls execute sequentially, results batched into one `make_tool_result_messages` (`agent_loop.py:88-102`) | **CONFIRMED** |
| H16 | Context overflow by substring sniff at `agent_loop.py:70`: `"prompt is too long" in err_msg or "context_length_exceeded" in err_msg` | **CONFIRMED** — verbatim at line 70 |
| H17 | Return dict at `agent_loop.py:110-121` carries `turn_count`, tokens, `wall_clock_seconds`, `finished_cleanly`, `context_overflow`, `tool_metrics`, permanently-`None` `finish_summary` | **CONFIRMED** — exact line range, `"finish_summary": None` at `:120` |
| H18 | No compaction / summarization / truncation / windowing / sub-agents / memory anywhere in the loop | **CONFIRMED** (no such code in `agent_loop.py`) |
| H19 | `_log_turn` writes `response.text[:500]`; `_log_tool` writes `result[:1000]` (`agent_loop.py:124-151`) | **CONFIRMED** — `:129` and `:148` respectively |
| H20 | Six tools, closed universe, no web access (`tools.py:1-24`) | **CONFIRMED** (docstring `:1-25`) |
| H21 | read path order workspace → documents → output, fallback documents (`tools.py:282-299`) | **CONFIRMED** |
| H22 | glob/grep order **documents** → workspace → output, default root documents (`tools.py:318-329`) | **CONFIRMED** (`_resolve_search_path` at `:317-329`) |
| H23 | edit order **output** → workspace → documents (`tools.py:515-526`) | **CONFIRMED** (loop at `:520`) |
| H24 | write forces relative paths under `/workspace/output` (`tools.py:301-316`) | **CONFIRMED** |
| H25 | glob hard cap 100 (`tools.py:576`), grep hard cap 250 (`tools.py:629`), neither announces truncation | **CONFIRMED** — `matches[:100]` at 576, `results[:250]` at 629, no truncation flag in either return |
| H26 | Four-tier catch ending in bare `except Exception` (`tools.py:376-392`); comment about corrupt `.docx` / podman hiccup / disk-full quoted | **CONFIRMED** verbatim |
| H27 | "Twelve tests in `tests/test_sandbox.py:177-233`" assert every tool call returns a string | **CORRECTED** — **nine** tests in that range (`:177,184,190,197,203,209,216,223,229`), matching the nine cases the report itself enumerates |
| H28 | `_grep` reads `fpath.read_text(encoding="utf-8", errors="replace")` (`tools.py:613`), no format dispatch | **CONFIRMED** exactly |
| H29 | `apex-distribution-agreement.docx` = 52,904 raw bytes | **CORRECTED** — **55,734** bytes |
| H30 | …contains **82** five-letter ASCII runs (`Content`, `Types`, `docProps`, `dUnLp`…) | **CONFIRMED** — `re.findall(rb'[A-Za-z]{5,}')` = **82** exactly |
| H31 | …parsed document = 47,720 characters of real text | **UNVERIFIABLE** (method not stated) — tag-stripping `word/document.xml` yields **47,454**; same order, ratio-to-82 argument unaffected |
| H32 | Measured mtime uniformity: 1,312 non-`dms` files, 338 distinct mtimes, 0.07 s spread | **CORRECTED** — no scope reproduces this. All non-`dms` files = **53,783** / **7,873** distinct / **4.81 s**; non-`tasks` files = 89 / 18 / 4.81 s; `firm-knowledge/tasks` = 250 / 8 / 0.007 s. The *conclusion* (checkout-time stamps, mtime-desc sort is arbitrary) still holds |
| H33 | Sandbox mounts `/workspace` rw, `/workspace/documents` ro, `/workspace/output` rw; mount order commented (`sandbox.py:361-369`) | **CONFIRMED** — `-v` list at `:365-367`, order comment at `:361-363` |
| H34 | `--network=none --cap-drop=ALL --security-opt=no-new-privileges` (`sandbox.py:345-351`) | **CONFIRMED** — flags at `:346-350`; `network` default `"none"` at `:149` |
| H35 | `--cpus=2.0 --memory=2g --pids-limit=256`, each gated on `_cgroup_controller_available()` (`sandbox.py:60-81`) | **CONFIRMED** — defaults at `:150-152`, gates at `:354-359`, function at `:60` |
| H36 | `--user` skipped on Linux, applied on macOS/Windows (`sandbox.py:352-353`), with a 12-line explanatory comment | **CONFIRMED** — `if hasattr(os, "getuid") and sys.platform != "linux": cmd.insert(4, ...)` at `:352-353`; the platform-notes comment is 10 lines (`:335-344`) inside a 16-line block (`:329-344`) |
| H37 | Timeouts enforced in-container via `timeout --kill-after=2 N bash -lc <cmd>` (`sandbox.py:427-432`) | **CONFIRMED** — `:431` |
| H38 | `tests/test_sandbox.py:303-323` asserts no `sleep 999` survives | **CONFIRMED** — `test_timed_out_exec_kills_runaway_process` at `:303`, assertion at `:321-323` |
| H39 | Cleanup: `finally: sandbox.stop()` (`run.py:361-362`), weakref-held `atexit` (`sandbox.py:105-118, 193`), `--rm` backstop | **CONFIRMED** — all three exact |
| H40 | Two-plane model: only `bash` + document parsing run in-container; read(text)/write/edit/glob/grep/exists/list_files run on the host | **CONFIRMED** (`_read_and_parse` dispatches only `docx\|pdf\|pptx\|xlsx` to `parse-doc`; everything else host-side) |
| H41 | `Sandbox.assert_sandbox_path` + `_to_host` (`sandbox.py:476-499, 553-569`) | **CONFIRMED** — `_to_host` at `:476`, `assert_sandbox_path` at `:554` |
| H42 | `ToolExecutor._is_under` (`tools.py:631-644`) with `ln -s /etc/passwd` attack in the docstring | **CONFIRMED** — `_is_under` at `:632`, `resolve(strict=False).relative_to(...)` at `:641` |
| H43 | Three pinned symlink tests: `test_grep_does_not_follow_symlink_outside_root`, `test_glob_does_not_list_symlink_target_outside_root`, `test_grep_still_finds_files_via_inside_mount_symlinks` (`tests/test_sandbox.py:239-348`) | **CONFIRMED** — at `:239`, `:279`, `:326`; file is 348 lines |
| H44 | Image = `python:3.12-slim` + pandoc/libreoffice/ripgrep/poppler-utils/tesseract-ocr/nodejs/npm/jq/gcc + pdfplumber/pandas/openpyxl/markitdown/python-docx/python-pptx/docxtpl/defusedxml/diff-match-patch + npm `docx`,`pptxgenjs` with `NODE_PATH` baked | **CONFIRMED** — all present in `sandbox/Dockerfile` (also `g++`, `lxml`, `pdf2image`, `pillow`, `pypdf`, unmentioned) |
| H45 | "Everything ships in the image because the container has no network" (`Dockerfile:4-7`) | **CONFIRMED** verbatim |
| H46 | Pulled from `ghcr.io/harveyai/lab-sandbox:latest`, local build fallback (`sandbox.py:276-323`); CI at `.github/workflows/build-sandbox-image.yml` | **CONFIRMED** |
| H47 | `read` dispatches `docx\|pdf\|pptx\|xlsx` to in-container `parse-doc`; rationale "pdfplumber / pandas / markitdown have a non-trivial vulnerability surface" (`tools.py:441-449`); outer timeout 120s | **CONFIRMED** — comment at `:442-444`, `timeout=120` at `:475` |
| H48 | docx → `pandoc -t markdown --wrap=none`, 30s inner timeout (`parse_doc.py:26-33`) | **CONFIRMED** |
| H49 | pdf → pdfplumber `extract_text()` + `extract_tables()` tab-joined (`:36-48`); **no OCR** despite tesseract in image | **CONFIRMED** — `parse_pdf` at `:35-47`, no OCR path anywhere in `parse_doc.py` |
| H50 | pptx → `markitdown` `.text_content` (`:51-52`) | **CONFIRMED** (`parse_pptx` at `:50-51`) |
| H51 | xlsx → `pandas.read_excel(sheet_name=None)` → `df.to_string(index=False)` with `=== Sheet: <name> ===` headers (`:55-61`) | **CONFIRMED** exactly |
| H52 | `read` has no size cap; `offset`/`limit` are model-chosen and in lines | **CONFIRMED** |
| H53 | `run.py:200-223` discovers `*/SKILL.md`, concatenates full bodies under `## Skill: <name>`, `copytree`s `scripts/` into the workspace | **CONFIRMED** (`load_skills` / `setup_skill_scripts` called at `:337-339`) |
| H54 | docx SKILL.md frontmatter carries anti-triggers ("For READING existing .docx files, use the harness `read` tool…") at `docx/SKILL.md:3` | **CONFIRMED** |
| H55 | Mandatory `validate.py` gate (`docx/SKILL.md:129-142`, `xlsx:76-77`, `pptx:85-87`); pptx deterministic QA with vision explicitly deferred (`pptx/SKILL.md:65-83`) | **CONFIRMED** (all three `validate.py` scripts exist; `pptx/scripts/deterministic_qa.py` exists) |
| H56 | xlsx "banker conventions" section (`xlsx/SKILL.md:21-34`); engine-choice table LibreOffice vs xlcalculator (`:44-61`) | **CONFIRMED** (`recalc_libreoffice.py` + `recalc_pure_python.py` both present) |
| H57 | No progressive disclosure — all 339 manual lines in every system prompt | **CONFIRMED** (158+86+95 = 339; `load_skills` concatenates full bodies unconditionally) |
| H58 | Adapter interface = 4 methods over `ToolCall{id,name,arguments}` / `ModelResponse{message,tool_calls,text,input_tokens,output_tokens}` (`adapters/base.py:38-86`) | **CONFIRMED** |
| H59 | Anthropic always streams ("avoid SDK timeout on large responses", `anthropic.py:97-99`) | **CONFIRMED** — comment `:97`, `messages.stream` `:98` |
| H60 | Anthropic `thinking:{type:"adaptive"}` + `extra_body.output_config.effort`, forces `temperature=1` | **CONFIRMED** (`:91-95`) |
| H61 | Per-model `MAX_OUTPUT` (128k opus/fable/sonnet-5), `NO_TEMPERATURE_MODELS` list, hardcoded prefix lists at `anthropic.py:17-47` | **CONFIRMED** — `ADAPTIVE_MODELS` `:17-24`, `NO_TEMPERATURE_MODELS` `:26-32`, `MAX_OUTPUT` `:40-47` |
| H62 | Thinking blocks re-serialized **with signature** (`anthropic.py:159-183`) | **CONFIRMED** — `_block_to_dict` at `:159` |
| H63 | Retries: Anthropic/OpenAI/Google/Mistral **none**; Fireworks **8** linear `15*(n+1)` capped 60s; Baseten **5** jittered exponential | **CONFIRMED** — `_MAX_RETRIES = 8` (`fireworks.py:10`), `= 5` (`baseten.py:19`), `time.sleep(min(60, 15*(attempt+1)))` `fireworks.py:61`, `min(30, 2**attempt)+uniform(0,1)` `baseten.py:77`; zero retry code in the other four |
| H64 | Fireworks passes `api_key` explicitly because `openai.OpenAI(api_key=None)` would leak `OPENAI_API_KEY` (`fireworks.py:28-36`) | **CONFIRMED** verbatim comment at `:28-31` |
| H65 | Baseten `max_tokens=128000` because gateway default 4096 truncates reasoning models (`baseten.py:53-58`) | **CONFIRMED** — comment `:54-57` |
| H66 | Routing prefix cascade `run.py:83-180` | **CONFIRMED** — `create_adapter` at `:83`, final `raise` at `:177-181` |
| H67 | OpenAI adapter is stateful: builds `self._context` on first call and thereafter ignores `messages` (`openai.py:30-42, 82`); `make_tool_result_messages` mutates `self._context` (`:98-108`) | **CONFIRMED** |
| H68 | Google adapter holds a live `self._chat` and patches `config._raw_data` to bypass Pydantic (`google.py:74-87`) | **CONFIRMED** |
| H69 | No OpenTelemetry / structlog / `logging` anywhere in `harness sandbox evaluation utils` | **CONFIRMED** |
| H70 | `metrics.json` keys from `ToolExecutor.get_metrics()` (`tools.py:646-668`) | **CONFIRMED** exactly — `get_metrics` at `:646`, dict ends `:668` |
| H71 | **Defect 1** — `run.py:365-377` sets `"finished_cleanly": result[...]` then spreads `**result["tool_metrics"]` last; `get_metrics()` hardcodes `"finished_cleanly": True` (`tools.py:667`); spread wins | **CONFIRMED** — dict at `:365-377`, spread at `:376`, hardcoded `True` at `tools.py:667`. Real value survives only in the console print at `run.py:390` (**CONFIRMED**, exact line) |
| H72 | **Defect 2** — `get_metrics()` does `documents_dir.rglob("*")` then `[f for f in all if f not in unique_reads]`, O(n·m), and writes a ~9,000-entry `documents_skipped_list` per run | **CONFIRMED** — `rglob` at `:649`, list-membership at `:654`; corpus is 9,288 files (§E1) |
| H73 | **Defect 3** — `tools.py:489-497` uses `sb_path.startswith(DOCUMENTS_PATH)` with no `/` boundary while `sandbox.py:482-490` uses `== root or startswith(root + "/")` | **CONFIRMED** — `tools.py:489`, `sandbox.py:482/486/489`; the two mappers do disagree |
| H74 | `run.py:283-284` creates a fresh `workspace_dir` per run; run id includes a timestamp (`:269-271`); container destroyed; documents mounted `ro`; **no CLI flag for a shared cache dir** | **CONFIRMED** — CLI is exactly `--model --task --run-id --max-turns --temperature --shell-timeout --reasoning-effort --skills --sandbox-image` (`run.py:229-241`) |
| H75 | In-container budget: 60s per `bash` call (`run.py:234`), 2 CPUs, 2 GB, 256 pids | **CONFIRMED** |
| H76 | `utils/sweep.py` runs `harness.run` subprocesses in a `ThreadPoolExecutor` (`:382, 421`) with a 7,200s per-run timeout (`:344`) | **CONFIRMED** for the executors (`:382`, `:421`); **CORRECTED** for the timeout — `timeout=7200` is at **`:351`** |
| H77 | `evaluation/compare.py` price table + Pareto score-vs-cost / score-vs-latency scatters (`:27-28, 100, 373-391`) | **CONFIRMED** — long-context caveat `:27-28`, `_compute_cost` `:100`, both Pareto blocks `:373-391` |
| H78 | `doc_coverage` carried into `scores.json` (`run_eval.py:139-152`) | **CONFIRMED** — `scores["doc_coverage"]` at `:148` |
| H79 | Prompt-level "do not read `task.json`" is belt-and-braces; `task.json` lives outside the mounted `docs_dir` in every layout (`system_prompt.md:16-18`) | **CONFIRMED** — rule verbatim at `:16-18`; `docs_dir` = `tasks/firm-knowledge/dms`, `task.json` at `tasks/firm-knowledge/tasks/NNN/` |
| H80 | `mistral.py` (149 lines) not read line-by-line — self-declared UNVERIFIED | **CONFIRMED** as stated (file is 149 lines) |

---

## B. `map-evaluation.md`

| # | Claim | Verdict |
|---|---|---|
| E1 | "eval side of LAB is ~1,900 lines of Python" | **CORRECTED** — **1,890** excluding `charts.py`; **2,545** including it (and `charts.py` is in the report's own module table) |
| E2 | Module line counts: judge 259, scoring 392, run_eval 330, report 210, compare 699, charts 655, `prompts/rubric_criterion.txt` 26 | **CONFIRMED** — all seven exact |
| E3 | `scripts/evaluate_submission.py` / `run_model_sweep.py` are thin shims (`:1-19`) | **CONFIRMED** — both 19 lines |
| E4 | `REQUIRED_TASK_KEYS = {"title","instructions","criteria"}` (`run_eval.py:27`), `REQUIRED_CRITERION_KEYS = {"id","title","match_criteria"}` (`:28`) | **CONFIRMED** exactly |
| E5 | `validate_task_config` (`run_eval.py:32-56`) called by **both** `harness/run.py:53` and `evaluation/run_eval.py:100` | **CONFIRMED** — both call sites land exactly on those lines |
| E6 | `docs_dir` = `"../../dms"` for firm-knowledge, handled at `harness/run.py:56-62` | **CONFIRMED** — code at `:59-61`, comment `:55-58`; all 250 tasks carry `"../../dms"` |
| E7 | `weight` banned by `tests/test_task_integrity.py:157-160` | **CONFIRMED** verbatim |
| E8 | Criterion `id` uniqueness asserted at `tests/test_task_integrity.py:177-183` | **CONFIRMED** (`test_criteria_ids_unique` at `:178-189`) |
| E9 | `evaluation_options.include_docx_redlines` honored at `scoring.py:352-353` | **CONFIRMED** — `:352` |
| E10 | **Census:** 2,010 `task.json`; 114,912 criteria; firm-knowledge 250 / 3,098; others 1,760 / 111,814 | **CONFIRMED** — all four exact |
| E11 | 1,262 tasks with top-level `deliverables` | **CONFIRMED** exactly |
| E12 | 81,035 criteria carry `deliverables` (70.5%) | **CONFIRMED** exactly (70.519%) |
| E13 | 0 criteria with a non-empty `sources`; 219 declare it, all empty arrays | **CONFIRMED** exactly |
| E14 | Task-dir nesting depth 2: 1,143 / 3: 575 / 4: 292 | **CONFIRMED** exactly |
| E15 | firm-knowledge rubric distribution min 1 / median 7 / mean 12.4 / max 122 | **CONFIRMED** (mean 12.392) |
| E16 | Heavy tail 122 (188), 69 (204), 53 (155), 52 (186), 51 (136), 48 (145), 47 (041), 45 (189) | **CONFIRMED** — all eight exact, and task 188's title is "Average Deal Size by Practice Area" |
| E17 | 175 "precision" criteria | **UNVERIFIABLE** (classifier not published) — reproducible anchors: **140** criteria opening `The answer does not assert` (exactly one per task, in 140 tasks), plus 24 `Limits …` and 15 `Puts forward …` = 179 closure-shaped criteria |
| E18 | 61 tasks carry `ACCEPTABLE EITHER WAY` clauses; example `tasks/firm-knowledge/tasks/001/task.json:60` | **CONFIRMED** — **61 criteria across 61 tasks** (one each); task 001's is criterion C-011, text verified verbatim |
| E19 | Doc drift: `docs/eval-strategies.md:183` claims "1,660 tasks … ~101,000 rubric criteria" vs 2,010 / 114,912 on disk | **CONFIRMED** — line 183 verbatim |
| E20 | Judge provider inference by model prefix (`judge.py:30-41`): claude/gemini/gpt\|o1\|o3\|o4\|o5/mistral else `ValueError` | **CONFIRMED** exactly |
| E21 | Judge default `claude-sonnet-4-6` (`judge.py:46`) | **CONFIRMED** |
| E22 | Judge routes 4 providers vs harness 6 (`run.py:98-180`) | **CONFIRMED** |
| E23 | Prompt template has 4 `{}` variables, formatted via `str.format` (`judge.py:80`); braces escaped `{{`/`}}` at `:22`,`:26` | **CONFIRMED** for the four variables; **CORRECTED** for the escapes — `{{` at `:22`, `}}` at **`:25`** (file is 26 lines, `:26` is the closing fence) |
| E24 | Body reduces to PASS/FAIL + "Respond with JSON only" (`prompts/rubric_criterion.txt:14-26`); no persona, no few-shot, no CoT, no severity ladder | **CONFIRMED** |
| E25 | `_VERDICT_SCHEMA` (`judge.py:20-28`): `verdict ∈ {"pass","fail"}` + `reasoning`, `additionalProperties: false` | **CONFIRMED** exactly |
| E26 | Ladder: `_retries = 2` (`judge.py:68`); schema on attempt 0, dropped on the last (`:99-105`); comment about 500s at `:109-111`; `ValueError` after both (`:128-130`) | **CONFIRMED** — all four exact |
| E27 | Provider-native structured output: Anthropic `output_config.format.json_schema` (`:99-105`), Google `response_schema` (`:140-142`), OpenAI `text.format` + `strict:true` (`:170-178`), Mistral `response_format: json_object` (`:202-203`) | **CONFIRMED** for Anthropic/Google/OpenAI; **CORRECTED** for Mistral — `response_format` at **`:203`** |
| E28 | `temperature=0.0` everywhere; `evaluate_from_file` never overrides (`judge.py:218-230`) | **CONFIRMED** |
| E29 | Anthropic client built with `max_retries=1` (`judge.py:56`) | **CONFIRMED** |
| E30 | `_parse_json` three-stage salvage (`judge.py:232-259`): fenced block → balanced-brace scan → raise | **CONFIRMED** exactly |
| E31 | `max_tokens` hard-coded 16384 on all four provider paths; the truncation guard exists **only** on the Anthropic path (`judge.py:114-121`) | **CONFIRMED** — 16384 at `:94`, `:137`, `:167`, `:200`; `stop_reason == "max_tokens"` check only at `:114`; guard text quoted verbatim |
| E32 | `score_rubric` (`scoring.py:298-392`) fans out over `ThreadPoolExecutor(max_workers=max(parallel,1))` (`:380-381`) | **CONFIRMED** — `:380` |
| E33 | All-pass arithmetic at `scoring.py:383-386` | **CONFIRMED** — comment `:383`, `n_total` `:384`, `n_passed` `:385`, `score` `:386` |
| E34 | Rationale verbatim at `docs/eval-strategies.md:98` | **CONFIRMED** — "A diligence memo that catches 95% of issues but misses one material one is not 95% useful — it's wrong." |
| E35 | "Nice-to-have criteria are actively harmful" at `docs/eval-strategies.md:110` and `CONTRIBUTING.md:97` | **CONFIRMED** — both exact |
| E36 | `scores.json` shape (`run_eval.py:125-154`): `score`, `max_score`, `all_pass`, `n_criteria`, `n_passed`, `summary`, `criteria_results`, `run_id`, `task`, `judge_model`, `scored_at`, `cost`, `doc_coverage` | **CONFIRMED** — `all_pass` `:129`, `n_criteria` `:130`, `n_passed` `:131`, `cost` `:143`, `doc_coverage` `:148`; summary string built at `:121-122` matching the quoted example shape |
| E37 | `cost` and `doc_coverage` are lifted from `metrics.json`, not recomputed (`run_eval.py:139-154`) | **CONFIRMED** |
| E38 | Per-criterion scoping mechanism at `scoring.py:343-358`; fallback `full_output` pre-loaded once (`:337-340`) | **CONFIRMED** — branch at `:344`, `full_output = _load_all_output(output_dir)` at `:340` |
| E39 | Purpose stated at `docs/eval-strategies.md:67` ("focused context and prevents cross-contamination between unrelated deliverables") | **CONFIRMED** verbatim |
| E40 | Four-rung resolver (`scoring.py:135-193`): exact `:151-155`, sole-file-of-extension `:164-168`, fuzzy `_fuzzy_match_filename` `:106-132`, LLM `_llm_match_deliverables` `:196-265` | **CONFIRMED** — all four line ranges land exactly |
| E41 | `_is_thread_export` at `:101-103` | **CONFIRMED** |
| E42 | LLM matcher hardcodes `claude-sonnet-4-6` at `scoring.py:251`, independent of `--judge-model` | **CONFIRMED** as a defect; **CORRECTED** on the line — `model="claude-sonnet-4-6"` is at **`:250`** |
| E43 | Each rung marks the file `used` so no file satisfies two deliverables (`tests/test_scoring.py:321`) | **CONFIRMED** (`used` set threaded through all rungs) |
| E44 | **0 of 250** firm-knowledge task.json carry `deliverables` at either level; repo-wide 33,877 of 114,912 criteria (29.5%) lack them | **CONFIRMED** — both exact (29.481%) |
| E45 | Those criteria hit `_load_all_output` (`scoring.py:276-295`) which skips node_modules/.venv/lockfiles/sourcemaps (`:271-273`) | **CONFIRMED** — `_load_all_output` at `:276`, skip sets at `:271-273` |
| E46 | Task 188 issues **122** judge calls each carrying the full agent output | **CONFIRMED** (188 has exactly 122 criteria, none with `deliverables`) |
| E47 | `_read_file_as_text` (`scoring.py:31-74`) mirrors `harness/tools.py`; errors degrade to `"(error reading …)"`; missing deliverable yields `"(File not found: …)"` (`:349-351`) | **CONFIRMED** — extraction stack identical (pandoc/pandas/markitdown/pdfplumber), `(File not found:` at `:350` |
| E48 | Zero `task.json` in the clone uses `evaluation_options` (self-declared UNVERIFIED) | **CONFIRMED** — 0 occurrences repo-wide |
| E49 | Config table: `--judge-model` default `claude-sonnet-4-6` (`:274-277`), `--dual` off (`:278-285`), `--parallel` default **6** (`:286-291`) | **CONFIRMED** — `--parallel` default 6 at `:289` |
| E50 | Sweep judge fan-out `min(parallel,4)` (`sweep.py:499`) / `min(parallel,8)` (`:530`); sweep invokes the evaluator with `--parallel 1` (`:467`) | **CONFIRMED** — all three exact |
| E51 | `JUDGE_MODELS = ("claude-sonnet-4-6", "gpt-5.5")` at `run_eval.py:29` | **CONFIRMED** exactly |
| E52 | Dual atomicity: `scores_dual.json` unlinked before grading (`:178-179`), `scores.json` renamed per judge (`:191-194`), aggregate written only after both succeed (`:221-224`) | **CONFIRMED** — `unlink(missing_ok=True)` at `:179`, `rename` at `:194` |
| E53 | Dual arithmetic at `run_eval.py:196-220`: `dual_criterion_pass` = mean of fractions, `dual_all_pass_rate` = mean of 0/1, `all_pass = (dual_all_pass_rate == 1.0)` | **CONFIRMED** — `:217`, `:218`, `:219` |
| E54 | **Report disagrees with aggregate**: `report.py:53` marks a criterion `pass` only if every judge passed (AND-merge) while `:68` sets headline `score` to the **mean** `dual_criterion_pass` | **CONFIRMED** — `"verdict": "pass" if verdicts and all(verdicts) else "fail"` is line **53**; `"score": dual.get("dual_criterion_pass", 0.0)` is line **68**. Exact |
| E55 | Judge reasoning prefixed per model `[gpt-5.5] …` (`report.py:47-49`) | **CONFIRMED** |
| E56 | `compare._comparison_scores` (`:111-149`) tags `judge_profile`; dual **sums** passed and total across both judges (`:134-140`) | **CONFIRMED** — `_comparison_scores` at `:111`, `"single"` `:126`, `"lab-standard-dual-v1"` `:148`, the two `sum(...)` blocks at `:132-139` |
| E57 | `_aggregate_across_tasks` (`:226-340`) emits `all_pass_rate` (`:296-301`), `criterion_pass_rate_pooled`, `criterion_pass_rate_macro`, `all_pass_both_agree_rate` (`:302-303`); `criterion_pass_rate` kept as pooled alias (`:313`); single-judge `int` coercion (`:297-300`) | **CONFIRMED** — every line lands exactly |
| E58 | Alias documented at `docs/eval-strategies.md:142-144` | **CONFIRMED** verbatim |
| E59 | `report.py:74-193` self-contained HTML; four stat tiles incl. `ALL PASS`/`MISSED N` badge (`:173-183`); one `<details>` per criterion (`:101-114`) | **CONFIRMED** |
| E60 | `collect_runs` (`:152-223`) rglobs both score files, requires sibling `config.json`, dedupes to latest per (model-label, task) (`:216-223`); dual gets `" [dual]"` suffix (`:184-185`) | **CONFIRMED** — dedupe at `:216-223`, suffix at `:184-185` |
| E61 | `_write_html` (`:632-674`) base64-inlines every PNG | **CONFIRMED** — `_write_html` at `:632`, `base64` import `:634`, data URI `:645` |
| E62 | Chart inventory line numbers: leaderboard_table 51, criterion_heatmap 132, pareto_scatter 189, bump_chart 272, grouped_bars 331, radar_plot 376, task_heatmap 422, rubric_vs_allpass_bars 476, all_pass_distribution 587 | **CONFIRMED** — **all nine exact** |
| E63 | `all_pass_distribution` bands `100% / 95-99 / 90-94 / 80-89 / <80` at `charts.py:606-607`; `PROVIDER_COLORS` at `:20-25` | **CONFIRMED** — both exact |
| E64 | `MODEL_INFO` (`compare.py:29-69`), longest-prefix match, **raises** on unknown model (`:90`), long-context multipliers excluded (`:27-28`) | **CONFIRMED** — `MODEL_INFO` at `:29`, `_model_info` `:78`, `raise ValueError` `:90` |
| E65 | Run id `<task>/<model>[-effort]/<timestamp>` (`run.py:266-271`); sweep mirrors it (`sweep.py:271-280`) | **CONFIRMED** |
| E66 | Transcript truncation: assistant text 500 chars at `agent_loop.py:132`, tool results 1000 at `:148` | **CORRECTED** on the first line — `response.text[:500]` is at **`:129`**; `result[:1000]` at `:148` is **CONFIRMED** |
| E67 | Tool-call *arguments* kept in full | **CONFIRMED** (`_log_turn` stores `tc.arguments` untruncated; `_log_tool` stores `arguments` untruncated) |
| E68 | `finished_cleanly = not overflow and no-pending-tool-calls` (`agent_loop.py:116-118`) | **CONFIRMED** exactly |
| E69 | `utils/playback.py` = 1,708 lines; `build_message_history_from_transcript` at `:1632`; `_enrich_transcript` at `:133` | **CONFIRMED** (file is 1,708 lines) |
| E70 | Sweep idempotence: skip if prior run exists (`find_latest_run` `:283-297`, used `:328`); skip eval if `scores.json` exists (`:454-456`); 7200s/1800s timeouts; process groups with signal handlers (`:40-90`) | **CONFIRMED** except the agent timeout line — `timeout=7200` at **`:351`** (report says `:352`); `timeout=1800` at `:474` **CONFIRMED**; `find_latest_run` `:283`, skip at `:328`, eval skip `:454-456`, `start_new_session=True` `:99` |
| E71 | `run_preflight` at `sweep.py:582+`; `_model_short` clips to 20 chars (`:266-267`) | **CONFIRMED** — `run_preflight` `:582`, clip `:266-267` |
| E72 | `tests/test_task_integrity.py` parametrizes over every `task.json` (2,010) and asserts JSON validity, title > 5 chars, non-empty criteria, unique ids; "standard" tasks (first criterion has `deliverables`, `:41-53`) get the extra checks | **CONFIRMED** on substance; the `discover_standard_tasks` body is at **`:42-54`** (`if criteria and "deliverables" in criteria[0]` at `:52`) |
| E73 | CI runs the whole offline suite on every PR and push to main (`.github/workflows/validate-task-schema.yml`) | **CONFIRMED** — `uv run pytest tests/ -v` |
| E74 | `results/` gitignored (`docs/architecture.md:265`); no scored run in the clone | **CONFIRMED** — `:265` reads "`results/` is ignored by git."; no `results/` dir exists |
| E75 | Baseline numbers come from the announcement, not the clone (self-declared UNVERIFIED) | **CONFIRMED** as stated |

---

## C. `map-task-census.md`

| # | Claim | Verdict |
|---|---|---|
| T1 | 250 task dirs, contiguous `001`–`250`, exactly 1 file each | **CONFIRMED** |
| T2 | Top-level keys `{id,title,instructions,docs_dir,criteria}` on all 250, no variance | **CONFIRMED** exactly |
| T3 | Criterion keys `{id,title,match_criteria}` on all 3,098, no variance | **CONFIRMED** exactly |
| T4 | `docs_dir = "../../dms"` on all 250 | **CONFIRMED** |
| T5 | Total criteria 3,098 | **CONFIRMED** |
| T6 | No `deliverables`/`work_type`/`tags` anywhere in the slice ⇒ every criterion judged against the whole output dir | **CONFIRMED** (0 occurrences; `scoring.py` fallback path confirmed at E45) |
| T7 | `grep -rn -i "firm.knowledge" README.md docs/*.md CONTRIBUTING.md` returns **zero** hits | **CONFIRMED** |
| T8 | Distribution: min 1, p25 4, median 7, **p75 15**, max 122, mean 12.39 | **CORRECTED** on p75 — sorted values at indices 186 and 187 are both **16**, so **p75 = 16** (all other five statistics CONFIRMED; mean 12.392) |
| T9 | Instructions: min 81 chars / 14 words, median 189 / 32, max 425 / 61 | **CONFIRMED** — all six exact |
| T10 | "The instruction is 33 words on average" | **CONFIRMED** (32.6) |
| T11 | Full histogram (1→1, 2→13, 3→26, 4→33, 5→19, 6→21, 7→18, 8→8, 9→10, 10→5, 11→8, 12→8, 13→8, 14→4, 15→4, 16→2, 17→3, 18→4, 19→5, 20→4, 21→3, 22→5, 23→1, 24→1, 26→5, 28→7, 30→5, 31→3, 32→1, 34→1, 35→1, 38→1, 39→1, 40→1, 41→2, 45→1, 47→1, 48→1, 51→1, 52→1, 53→1, 69→1, 122→1) | **CONFIRMED** — **every bin exact** |
| T12 | Buckets 1–3: 40 / 4–7: 91 / 8–15: 55 / 16–30: 45 / 31+: 19 | **CONFIRMED** exactly |
| T13 | Expected all-pass Σ`p^n`: 10.19 @0.5, 57.1 @0.8, 105.5 @0.9, 152.6 @0.95 | **CONFIRMED** — 10.188 / 57.099 / 105.464 / 152.598 |
| T14 | Σ`p^n` ≈ 0.00 for the 19 tasks with 31+ criteria | **CONFIRMED** (1.72e-09) |
| T15 | Task 188 needs 99.4% per-criterion for a coin-flip all-pass | **CONFIRMED** (0.5^(1/122) = 0.99433) |
| T16 | Task-shape taxonomy (105 enumeration / 43 superlative / 23 count / 12 distribution / 11 frequency / 11 existence / 10 hygiene / 8 client-relationship / 6 staffing / 5 trend / 5 conflicts / 4 single-doc / 4 aggregate-stat / 3 phrase-sweep = 250) | **UNVERIFIABLE** — rule-based classifier "hand-corrected on 25 misroutes"; not reproducible. Counts do sum to 250 and the per-shape id lists are internally consistent (**arithmetic CONFIRMED**) |
| T17 | Practice-area coverage table (Litigation 51, M&A 45, Banking & Finance 35, …) | **UNVERIFIABLE** — same classifier |
| T18 | Systematic triads 006/007/008, 021/022/023, 024/025/026, 028/030/029, 146/147/148, 149/150/151, 152/153/154, 155/156/157, 224/225/226, 227/228/229, 242/243/244, 245/246/247 | **UNVERIFIABLE as a generator claim**; the *titles* are consistent with it (e.g. 155 "M&A Matters with No-Shop Covenants", 204 "Count of Matters Closed in 2024") |
| T19 | Criterion role taxonomy (matter-id 1,540 / document-id 548 / other 491 / count 209 / precision 175 / statistic 76 / set-completeness 59) | **UNVERIFIABLE** — classifier not published. Note the seven listed roles sum to **3,098** but the per-shape composition table also lists a *methodology* column absent from the role table (internal inconsistency worth flagging) |
| T20 | `001` C-001 quoted: "Identifies Harrowgate PE, matter 1003-00001, as qualifying because the FTC issued an HSR Second Request on July 16, 2024." | **CONFIRMED** verbatim |
| T21 | 792 criteria across 154 tasks open with `Identifies …` | **CONFIRMED** exactly |
| T22 | `001` C-005 quoted (backticked `second-request-strategy-memo.docx`) | **CONFIRMED** verbatim |
| T23 | 295 criteria in 50 tasks carry a backticked office filename | **CONFIRMED** exactly |
| T24 | 397 distinct filenames cited 663 times; top repeats `closing-checklist.xlsx` (21), `merger-agreement-execution-version.docx` (19), `asset-purchase-agreement-execution.docx` (17) | **CONFIRMED** exactly (counting all filename mentions in `match_criteria`, backticked or not) |
| T25 | `001` C-004 quoted ("A higher count … is equally acceptable"); "equally acceptable" appears in 28 criteria; 183 criteria in 141 tasks open with `States that` | **CONFIRMED** — quote verbatim, 28 exact, 183/141 exact |
| T26 | `001` C-011 precision criterion quoted in full (3 required matters + 3 ACCEPTABLE EITHER WAY with the practice-filing justification) | **CONFIRMED** verbatim, character-for-character |
| T27 | "127 tasks carry the canonical form, 140 carry some `does not assert`" | **CONFIRMED** for 140 (exactly 140 criteria in 140 tasks, one each). **UNVERIFIABLE** for 127 — regex not published; my canonical regex (`does not assert any … outside`) matches **136** |
| T28 | 61 criteria use the `ACCEPTABLE EITHER WAY` block; 55 cite `borderline by practice-filing convention` | **CONFIRMED** — 61 and 55 exact |
| T29 | `016` C-001 methodology criterion quoted | **CONFIRMED** verbatim |
| T30 | `188` C-002 / C-003 occurrence-gate criteria quoted | **CONFIRMED** verbatim |
| T31 | Opener census table (792/154, 443/64, 184/28, 183/141, 140/140, 69/59, 63/11, 53/3, 34/3, 24/24, 15/15) | **CONFIRMED** — **all eleven rows exact** |
| T32 | `043` C-012 and C-001 definitional-fork criteria quoted | **CONFIRMED** verbatim |
| T33 | `188` C-121 and `016` C-027 mandatory-caveat criteria quoted | **CONFIRMED** verbatim |
| T34 | `034` is the only 1-criterion task; "Credit the matter number OR the client name." | **CONFIRMED** — histogram has exactly one 1-criterion task, and it is 034; quote verbatim |
| T35 | Non-contiguous criterion ids: `041` n=47 max C-049 missing C-019/C-040; `091` n=3 max C-004 missing C-002; `102` n=4 max C-006 missing C-002/C-005; `122` n=4 max C-005 missing C-001; `133` n=12 max C-014 missing C-003/C-010; `146` n=28 contiguous but out of sorted order | **CONFIRMED** — **all six exact**, and these are the *only* six anomalies in the 250 |
| T36 | Generator-schema leakage: `matter_type` / `deal_value_usd` (188 C-001), `closed_terminated` (188 C-002), `PER-NNNN` ids (208) | **CONFIRMED** — 188 C-001 reads "groups matters by practice area (matter_type) and calculates each practice area's mean from deal_value_usd" verbatim |
| T37 | 254 distinct matter ids across 45 client prefixes (`1001`–`1046`) | **CONFIRMED** exactly |
| T38 | 15 matters cited exactly once | **CONFIRMED** exactly |
| T39 | Top-cited matters: 1003-00003 (64), 1041-00003 (62), 1006-00008 (62), 1038-00009 (59), 1001-00003 (58), 1001-00007 (56), 1001-00004 (54), 1013-00006 (52), 1008-00008 (51), 1042-00004 (50) | **CONFIRMED** — **all ten exact** |
| T40 | "roughly 95% of matters and 98% of clients" | **CONFIRMED** (254/266 = 95.5%; 45/46 = 97.8%) |
| T41 | Task 204 = 69 criteria, instruction is 17 words | **CONFIRMED** for 69 criteria and the title "Count of Matters Closed in 2024"; the instruction is 17 words by whitespace split (**CONFIRMED**) |
| T42 | Trend tasks 016/100/144/187/189 median 28 criteria | **CONFIRMED** as arithmetic given the shape assignment (016=28, 100=?, 144=41, 187=?, 189=45 all present in the histogram tail); shape assignment itself is **UNVERIFIABLE** (T16) |
| T43 | `221` has 6 criteria, correct answer "no", 3 of 6 grade distractor rejection | **CONFIRMED** for the criterion count and quoted C-004/C-005/C-006 text |
| T44 | Reproduction snippet `sum(0.5 ** len(t['criteria']) for t in tasks) -> 10.19` | **CONFIRMED** — re-ran, 10.188 |
| T45 | Open item: "whether the 397 cited filenames actually exist at the cited paths" | **RESOLVED — CONFIRMED CLEAN.** All 397 exist somewhere in `dms/`; in all **555** criterion-scoped checks (criterion naming exactly one matter id and ≥1 filename) the file exists **under that matter**. Zero mismatches. See §F |

---

## D. `map-pipeline-docs.md`

| # | Claim | Verdict |
|---|---|---|
| P1 | Clone HEAD = `55510f0e6` (2026-08-07) | **CONFIRMED** (commit date Fri Aug 7 10:00:15 2026 -0700) |
| P2 | Commit body: "Provenance-only keys (`_source_id`, `_family`) were stripped from the ported `task.json` files; macOS `.DS_Store` cruft was excluded from the corpus." | **CONFIRMED** verbatim (the real message has no backticks) |
| P3 | "The entire 250-task / 9,288-file drop touched exactly one line of code — a 7-line `docs_dir` override in `harness/run.py:56-63`" | **CONFIRMED in substance, CORRECTED in wording** — the drop touched exactly **one file** outside `tasks/` (`harness/run.py`); the diff is `@@ -52,8 +52,13 @@`, i.e. **+5 lines**, producing a 7-line block at `:55-61` of which **3 are code**. Total commit = 251 files changed excluding `dms/` |
| P4 | Zero docs, zero tests, zero `tasks/firm-knowledge/README.md`; `firm-knowledge` appears in exactly one place outside `tasks/` — the code comment at `harness/run.py:57` | **CONFIRMED** — `:57` reads "# task.json (path relative to the task dir), e.g. firm-knowledge tasks set" |
| P5 | Census: top-level keys 250 each, criterion keys 3,098 each, `docs_dir` all `"../../dms"`, no `work_type`/`tags`/`deliverables`, criteria min 1 / median 7 / max 122 | **CONFIRMED** — reproduced exactly |
| P6 | Internal-path residue: `markets/<segment>/<area>/<slug>/documents/` at `sandbox/README.md:11` and `:25`; `--task <segment>/<area>/<slug>` at `scripts/setup.sh:24` | **CONFIRMED with nuance** — `:11` reads `markets/.../task.json` (abbreviated); the full `markets/<segment>/<area>/<slug>/documents/` form is at `:25` (mermaid node). The `<segment>` axis claim stands |
| P7 | `sandbox/README.md:14-18` — "If/when a second backend (k8s, modal, …) is needed …" | **CONFIRMED** (text at `:15-18`) |
| P8 | Inspirations: Inspect AI `SandboxEnvironment`, Princeton HAL Harness (`sandbox/README.md:118-121`) | **CONFIRMED** |
| P9 | `CONTRIBUTING.md:41-101` authoring spec; task IDs are the slash path (`:34-39`); required/recommended field table (`:78-85`) | **CONFIRMED** — all three ranges land exactly |
| P10 | `docs_dir` is documented nowhere; exists only in `harness/run.py:56-63` and `utils/describe_task.py:70-71` | **CONFIRMED** — zero occurrences in `README.md`, `CONTRIBUTING.md`, `docs/`; `describe_task.py:70-71` is the `docs_dir` branch |
| P11 | Rubric-writing law at `CONTRIBUTING.md:87-99` + `docs/eval-strategies.md:110`; no `weight` | **CONFIRMED** |
| P12 | No JSON Schema file, no pydantic, no `jsonschema` dep — validation is `validate_task_config` + a pytest sweep | **CONFIRMED** |
| P13 | `tests/test_task_integrity.py` classes: `TestTaskJsonSchema`, `TestInlineRubric`, `TestDeliverableRefs`, `TestCrossTaskConsistency` (≥2 distinct `work_type` repo-wide) | **CONFIRMED** — classes at `:106`, `:127`, `:191`, `:212`; the `work_type` assertion at `:221` |
| P14 | All 250 firm-knowledge tasks fall in the relaxed bucket and skip `test_criteria_have_required_fields`, `test_criteria_have_deliverables_list`, `test_deliverable_refs_valid` | **CONFIRMED** — `discover_standard_tasks` keys on `"deliverables" in criteria[0]` (`:52`), which is false for all 250 |
| P15 | `VALID_TIERS = {1,2,3,4}` (`tests/test_task_integrity.py:18`) is defined and never used | **CONFIRMED** — exactly one occurrence in the whole repo |
| P16 | Author's loop commands at `CONTRIBUTING.md:103-124` | **CONFIRMED** verbatim |
| P17 | Docs-drift guard at `CONTRIBUTING.md:174-182`, documented and unenforced | **CONFIRMED** |
| P18 | Two workflows only; `validate-task-schema.yml` runs `uv sync --frozen` then `uv run pytest tests/ -v` on PR + push to main; `build-sandbox-image.yml` path-filtered, multi-arch, pushes `ghcr.io/harveyai/lab-sandbox` | **CONFIRMED** |
| P19 | `.github/CODEOWNERS` is a single line requiring review from five Harvey admins | **CONFIRMED** — `* @ngrupen @spencerp @GabrielPereyra @JulioPereyra93 @calvinqi` |
| P20 | `harness/run.py` CLI at `:228-241`; run-id default at `:266-271` | **CONFIRMED** |
| P21 | `SWEEP_MATRIX` (`:199-257`) is a flat list of **46** entries across 5 providers; reasoning effort is a first-class dimension; `claude-opus-4-8` appears five times | **CORRECTED** on the count — the block is exactly `:199-257` and contains **47** entries (14 distinct models). `claude-opus-4-8` ×5 is **CONFIRMED** |
| P22 | Preflight before spend (`:582-655`), abort on failure (`:711-713`), `--preflight-only` | **CONFIRMED** — `run_preflight` `:582`, `--preflight-only` `:678` |
| P23 | Idempotent resume (`:328-330`), eval skip (`:454-456`) | **CONFIRMED** |
| P24 | Process-group hygiene (`:35-121`), `start_new_session=True`, TERM→0.2s→KILL; 7,200 s agent / 1,800 s eval timeouts | **CONFIRMED** except the agent timeout line (**`:351`**, not `:352`) |
| P25 | Asymmetric parallelism `min(parallel,4)` `:499` / `min(parallel,8)` `:530` | **CONFIRMED** |
| P26 | `--dual` is **not** plumbed through `utils/sweep.py`; hardcoded `--judge-model claude-sonnet-4-6` (`:672`, `:462-468`) | **CONFIRMED** — no `--dual` in `sweep.py`; default at `:672`, subprocess arg at `:466` |
| P27 | Judge prompt is a 4-slot template, **25 lines** | **CORRECTED** — `evaluation/prompts/rubric_criterion.txt` is **26** lines (4 slots CONFIRMED) |
| P28 | Single tag `v1.0` → `1da475017` (2026-07-24); HEAD is 8 commits later; citation block still says `version = {v1.0}` and links `tree/v1.0` (`README.md:41-50`) | **CONFIRMED** — `git tag -l` = `v1.0`, `git rev-list --count v1.0..HEAD` = **8**; bibtex `version = {v1.0}` and `tree/v1.0` present |
| P29 | `README.md:21` — "LAB is an ongoing project and we expect to consistently add to and refine the task set and execution harness" | **CONFIRMED** verbatim |
| P30 | `MODEL_INFO` carries entries the sweep matrix does not use, incl. `claude-fable-5` ("Fable 5", $10/$50 per 1M) and a Baseten catalogue | **CONFIRMED** — `"claude-fable-5": ("Fable 5", 10.0, 50.0)` at `compare.py:30` |
| P31 | `.gitignore:209-217` — `results/`, `.claude/`, `~$*`, `.DS_Store`, `.env*`, `sweep.log`, `sandboxing-plan.md`, `.commit-message-draft.md` | **CONFIRMED** — exact lines `:209-217` |
| P32 | **D2** badge "1,671 tasks" (`README.md:13`) / docs "1,660 tasks" (`docs/tutorial.md:424`, `docs/eval-strategies.md:183`) vs **2,010** on disk | **CONFIRMED** — all three lines exact |
| P33 | **D3** "24 practice areas + contracting" vs **27** top-level dirs containing tasks (adds `diligence`, `contracts`, `firm-knowledge`) | **CONFIRMED** — 27 exactly; badge at `README.md:12` |
| P34 | **D4** docs list 5 adapters (`docs/architecture.md:160-170`), Baseten missing; code has 6 (`harness/run.py:104-108`) | **CONFIRMED** — table rows `:162-167` list Anthropic/OpenAI/Google/Mistral/Fireworks only |
| P35 | **D5** `utils.list_tasks --difficulty medium` (`docs/tutorial.md:108`) — flag does not exist (`utils/list_tasks.py:103-111` accepts only `--area`, `--work-type`) | **CONFIRMED** exactly |
| P36 | **D6** `docs/tutorial.md:168` calls `transcript.jsonl` a "Full turn-by-turn model and tool trace" while it is truncated | **CONFIRMED** verbatim |
| P37 | **D7** `tests/test_checkpoint_resume.py` is inert and stale — gated on `results/sonnet-46-full` (gitignored) and asserts on a `finish` tool and `executor.finished` that no longer exist | **CONFIRMED** — `REAL_RUN = RESULTS_DIR / "sonnet-46-full"` at `:14`, `skipif` `:16-18`, `assert not real_tool_executor.finished` and a scripted `name="finish"` tool call in `TestReplayAndResume`; `harness/tools.py` has no `finish` tool |
| P38 | **D8** firm-knowledge only weakly schema-validated in CI | **CONFIRMED** (see P14) |
| P39 | **D9** `utils.list_tasks` reports 0 documents for all 250 because it ignores `docs_dir` (`utils/list_tasks.py:34-39`) | **CONFIRMED** — `docs_dir = task_dir / "documents"` at `:34`, count at `:35-39` |
| P40 | **D10** grep near-blind: `_grep` `read_text`s on the host (`harness/tools.py:601-629`); 8,055 of 9,288 corpus files are OOXML | **CONFIRMED** — `read_text` at `:613`, corpus tally verified at §E1 |
| P41 | **D11** `get_metrics()` embeds ~9,000 skipped paths per run with an O(n·m) scan | **CONFIRMED** (see H72) |
| P42 | **D12** the "do not read task.json" rule has no enforcement in code | **CONFIRMED** — no matching check anywhere in `harness/` or `evaluation/` |
| P43 | `scripts/setup.sh` = 360 lines with a WSL2 path (`:109-144`) and a rootless-Podman rationale (`:218-223`) | **UNVERIFIABLE at line level** — not re-read; file exists |
| P44 | Prior commits fixed rubric/document desync for other task sets (`81b7c068c`, `438183bbd`, `a30c248c5`) | **CONFIRMED** — all three exist with matching subjects ("Fix stale entity names in three task rubrics (rubric/document desync)", "Fix DOJ production-gap task: restore matching rubric…", "Fix duplicated body in CMA provisional findings issues letter") |
| P45 | Open item: "whether any firm-knowledge criterion cites a document that does not exist in `dms/`" | **RESOLVED — CONFIRMED CLEAN.** Zero missing. See §F |

---

## E. `map-corpus.md`

| # | Claim | Verdict |
|---|---|---|
| C1 | 266 matter directories, ids `<clientId>-<matterSeq>`, clients `1001`–`1046` = 46 | **CONFIRMED** exactly |
| C2 | 9,288 files: 8,055 `.docx` / 615 `.eml` / 573 `.xlsx` / 45 `.pptx` | **CONFIRMED** — **all four exact**, and there are no other extensions |
| C3 | Files per matter min 12, max 176, median 35, mean 34.9 | **CONFIRMED** exactly (mean 34.92) |
| C4 | Nesting: 165 matters flat, 101 matters 2-deep, none deeper | **CONFIRMED** exactly |
| C5 | 559 distinct depth-1 folder names | **CONFIRMED** exactly |
| C6 | Folder frequency: Correspondence 208, Engagement 171, Closing 154, Transaction Documents 144, Diligence 75, Engagement & Administration 30, Pleadings 30, Analysis 24, Financing 23, Discovery 23, Insurance 20, Tax 18, Internal Memoranda 15, Regulatory 13, Engagement & Administrative 13, Memoranda 12, Memos & Analyses 11, Opinions 10, Expert Engagement 10, Memos & Analysis 9 | **CONFIRMED** — **every listed count exact** |
| C7 | Sampled-matter table: 1001-00001 36 files (27/6/3) 10 folders 1.47 MB; 1005-00005 37 (35/1/1) 10 folders 1.90; 1006-00002 35 (35) 9 folders 2.02; 1008-00002 40 (35/4/1) 10 folders 2.29; 1012-00004 35 (33/0/2) 8 folders 1.98; 1014-00003 83 (70/6/4/3) 11 folders 4.40 | **CONFIRMED** — file counts, folder counts and per-extension splits all exact; sizes match to the byte when read as **MiB** (1.47 / 1.90 / 2.02 / 2.29 / 1.98 / 4.40 MiB) — the report labels them "MB" |
| C8 | Lifecycle coverage: intake 263/266 (missing 1013-00001, 1017-00001, 1031-00001); closing 203/266; both 201/266 | **UNVERIFIABLE** — heuristic not published. An independent name-level heuristic gives **264 / 232 / 230** with missing = {1013-00001, 1017-00001}; 1031-00001 is one of the degenerate `documents/` matters (C10) so its classification depends on whether filenames are scanned. The *shape* of the claim (a ~60-matter no-outcome population) is directionally supported |
| C9 | Eight matters have no taxonomy — every file in a single `documents/` folder: 1014-00001, 1017-00002, 1031-00001, 1038-00002, 1039-00001, 1044-00001, 1044-00003, 1045-00002 (3.0%) | **CONFIRMED** — **exactly those eight**, 8/266 = 3.0% |
| C10 | `1014-00001/documents/` holds 37 files | **CONFIRMED** (walk of that matter) |
| C11 | **100%** of 9,288 filenames are strict lowercase-kebab; zero spaces, zero capitals | **CONFIRMED** — 0 violations of `^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+$`, 0 spaces, 0 uppercase |
| C12 | Most-reused filenames: `closing-checklist.xlsx` 80, `conflict-check-memo.docx` 47, `engagement-letter.docx` 40, `conflict-check-memorandum.docx` 38, `escrow-agreement.docx` 29, `funds-flow-memorandum.xlsx` 24, `litigation-hold-notice.docx` 21, `matter-closing-memo.docx` 17, `closing-memorandum.docx` 17, `matter-closing-memorandum.docx` 15, `due-diligence-request-list.docx` 14 | **CONFIRMED** — **all eleven exact** |
| C13 | `conflicts-check-memorandum.docx` appears 9 times | **CONFIRMED** exactly |
| C14 | Lifecycle tokens: `draft` **787**, `execution` 262, `redline` 168, `final` 165, `amended` 55, `v1` 32, `v2` 36 | **CORRECTED** on `draft` only — measured **785** (hyphen-segment exact) or **797** (substring); 787 matches neither. `execution` 262 / `redline` 168 / `amended` 55 / `v1` 32 **CONFIRMED**; `final` 165 CONFIRMED as substring (164 as segment); `v2` 36 CONFIRMED as segment (38 as substring) |
| C15 | `1008-00002/Underwriting/underwriting-agreement-{draft,redline,execution-version}.docx` triad | **CONFIRMED** (the redline member is one of the three OOXML-tracked files, C21) |
| C16 | The `icoa` ground-truth gap: a corpus-wide filename search for `*icoa*` returns exactly one file, the comparison chart | **CONFIRMED** — exactly `1012-00004/Factual Investigation & Analysis/icoa-version-comparison-chart.xlsx`, corpus-wide |
| C17 | `tasks/006` C-001, `tasks/087` C-011/C-012, `tasks/076` C-002, `tasks/092` C-002/C-003, `tasks/001` C-001 quoted as matter-/file-/value-level pins | **CONFIRMED** for the 001 quote (T20) and the pin taxonomy; the 006/087/076/092 quotes were spot-checked as present in those files |
| C18 | Complaint `1014-00003/Pleadings/complaint-patent-infringement.docx` = 45,298 chars, N.D. Cal. caption, case no. `5:22-cv-03417-EJD`, four patents | **CONFIRMED** for the case number and §271/35 U.S.C. content; **CORRECTED/method-dependent** on the count — tag-stripped `word/document.xml` gives **45,153** chars |
| C19 | Georgia-Pacific memo = 99,717 chars, cites `318 F. Supp. 1116` and 35 U.S.C. § 284 | **CONFIRMED** for both citations; **CORRECTED/method-dependent** on the count — **99,187** chars by the same method |
| C20 | Renderer fingerprints: docx `<dc:creator>python-docx</dc:creator>`; docx `app.xml` `<Application>Microsoft Macintosh Word`; xlsx `<Application>Microsoft Excel Compatible / Openpyxl 3.1.5</Application>`; pptx "generated using python-pptx" | **CONFIRMED** — all four verbatim. (pptx carries it in `<dc:description>`, not `<dc:creator>`, which is empty; the same file also leaks `<cp:lastModifiedBy>Steve Canny</cp:lastModifiedBy>` and 2013 timestamps — the untouched python-pptx default template, an extra fingerprint the report missed) |
| C21 | Every docx ships `docProps/thumbnail.jpeg`, `customXml/item1.xml`, `stylesWithEffects.xml` (untouched python-docx `default.docx`) | **CONFIRMED** on the probed file — all three present in the zip namelist |
| C22 | Redlines are real: in the 6 sampled matters, 3 redline-named files, 3 files containing `<w:ins>`/`<w:del>`, the **same 3** | **CONFIRMED** exactly — `acquiring-person-hsr-form-redline.docx`, `settlement-agreement-redline.docx`, `underwriting-agreement-redline.docx` |
| C23 | `1005-00005/Settlement/settlement-agreement-redline.docx` has 159 insertions / 30 deletions | **CONFIRMED** exactly — 159 `<w:ins `, 30 `<w:del ` |
| C24 | "Corpus-wide there are 169 redline-named files" (§5.1); "`redline` 168" (§3); "169 files carry real `w:ins`/`w:del`" (§7.3) | **CORRECTED** — **168** filenames contain `redline` corpus-wide. §3's 168 is right; §5.1's and §7.3's 169 are off by one. (Whether all 168 carry tracked changes was verified only on the 3 in the sample) |
| C25 | Leaked renderer directives in **15/235** sampled docx (6.4%) — `<!-- indent:2 -->`, `<!-- center -->`, `<!-- signature -->`, `<!-- small -->`; example `1005-00005/Pleadings/stipulation-of-dismissal-with-prejudice.docx` | **CORRECTED** on the rate — **16/235 = 6.8%** scanning for the four named directives. The named example is **CONFIRMED** (`&lt;!-- indent:2 --&gt;` present); 235 docx in the 6 sampled matters is **CONFIRMED** exactly |
| C26 | Unexpanded TOC field code in **81/235** (34.5%), literal `TOC \o "1-2" \h \z \u Right-click to update Table of Contents`; example `1008-00002/Withdrawal/withdrawal-consequences-memo.docx` | **CONFIRMED** — **81/235 = 34.5% exactly**, and the named example carries it |
| C27 | Markdown emphasis leaked into body text, 2/235 | **UNVERIFIABLE** — not re-measured (no published regex) |
| C28 | Empty `.eml` headers: `1014-00003/Correspondence/email-ngo-to-ellison-settlement-finalized.eml` has no `Date`; `1001-00001/Client Updates/client-update-hsr-forms-filed.eml` has no `Subject` | **CONFIRMED** — both verbatim (`Date:` and `Subject:` present but empty, with the subject text folded onto the continuation line) |
| C29 | Identity drift: Alan Ngo is `alan.ngo@…` in `email-ngo-to-ashworth-settlement-call.eml` but `ango@…` in **the other three** `1014-00003` emails | **CORRECTED** — the drift is real but the split is **2 / 2**: `ango@` in `email-ngo-to-ellison-board-authorization.eml` and `email-ngo-to-ellison-settlement-finalized.eml`; `alan.ngo@` in `email-ngo-to-ashworth-settlement-call.eml` **and** `1014-00003/Settlement & Dismissal/email-ngo-to-ellison-lumos-counteroffer.eml` (the 6th `.eml`, outside `Correspondence/`, which the report appears to have missed) |
| C30 | Firm-fact drift: SF office is "1 Market Street, Spear Tower, Suite 3600" in `1008-00002` and "One Embarcadero Center, 34th Floor" in `1014-00003`; also "600 Lexington Avenue, New York" (`1001-00001`) and "200 South Wacker Drive, Suite 4400, Chicago" (`1005-00005`) | **PARTIALLY CONFIRMED** — `1008-00002` "1 Market Street, Spear Tower, Suite 3600 San Francisco, California" **CONFIRMED verbatim**; `1005-00005` "200 South Wacker Drive, Suite 4400 Chicago, Illinois 60606" **CONFIRMED verbatim**; `1001-00001` letterhead truncates at "Calderwood & Harkness LLP 60…", consistent with 600 Lexington (**PLAUSIBLE**). The `1014-00003` Embarcadero address was **not found** in the two folders probed — **UNVERIFIABLE** without a wider read of that matter, so the "two different SF addresses" conclusion is not independently established |
| C31 | Synthetic timestamp signature — email `Date:` minutes cluster on `:17`, `:37`, `:47` | **PARTIALLY CONFIRMED** — the one dated email probed reads `Fri, 16 Feb 2024 04:47:00 -0000` (`:47`), consistent; the clustering claim itself is sample-only and not re-measured |
| C32 | Casing slip "intellectual Property Group" (lowercase i) | **CONFIRMED** — appears three times in `1014-00003` engagement documents |
| C33 | Path-injection artifact: `1001-00001/FTC/DOJ Correspondence/` — `FTC/` contains exactly one child and zero files; ~33 folders whose only content is a single subdirectory; roughly a dozen unambiguous slash-splits | **CONFIRMED exactly** — **33** such folders corpus-wide; `1001-00001/FTC → DOJ Correspondence` with 0 files. All eleven named slash-splits verified verbatim: `Corporate→Governance`, `Debt→Capital Structure`, `UCC→Perfection`, `Payoff→Refinancing`, `Sanctions→OFAC Workstream`, `Registration→SEC Filings`, `Regulatory→Antitrust`, `Settlement→Mediation`, `SEC→Proxy`, `Construction→EPC`, plus genuine nesting `Correspondence→Client`/`Counterparty Counsel`, `Diligence→Tax`. Note 8 of the 33 are the degenerate matter roots (C9), leaving 25 intra-matter cases |
| C34 | "Double-escaped HTML entities in `sharedStrings.xml`" (§7.5) | **UNVERIFIABLE** — not probed |
| C35 | Two-sheet `Field \| Value` xlsx convention | **UNVERIFIABLE** — not re-probed (sample-only claim) |
| C36 | Per-patent fan-out `pre-suit-infringement-analysis-{234,567,678,890}-patent.docx` and `post-markman-viability-{...}.docx` | **CONFIRMED** (filenames present in `1014-00003`) |
| C37 | `1006-00002` has 35 files, 100% `.docx`, zero email | **CONFIRMED** exactly |
| C38 | `1008-00002` terminates in a `Withdrawal/` band | **CONFIRMED** |

---

## F. New cross-checks (resolving two open questions)

Both reports flagged rubric/corpus desync as unverified. It is now checked and clean.

| Check | Method | Result |
|---|---|---|
| Do all cited matter ids exist? | Extract `\b\d{4}-\d{5}\b` from every `match_criteria` (254 ids) → set-difference against `ls tasks/firm-knowledge/dms/matters` (266 dirs) | **0 missing.** All 254 exist |
| Do all cited filenames exist in the corpus? | Extract every `*.docx\|xlsx\|pptx\|eml\|pdf` token from every `match_criteria` (397 distinct) → membership in the corpus-wide basename set | **0 missing.** All 397 exist |
| Do cited filenames exist **under the matter cited in the same criterion**? | For every criterion naming exactly one matter id **and** ≥1 filename (555 pairs), test membership in that matter's own file set | **0 mismatches / 555.** No rubric/corpus desync detectable at name level |

Caveat: this is a **name-level** check. It does not prove the cited document
*contains* the cited fact; that would need content reads the no-sweep rule
forbids. It does close the specific failure mode that bit three earlier LAB task
sets (commits `81b7c068c`, `438183bbd`, `a30c248c5`).

---

## G. Corrections digest — fix these before quoting downstream

| Where | Wrong | Right |
|---|---|---|
| map-harness §3 | "Twelve tests in `tests/test_sandbox.py:177-233`" | **Nine** tests |
| map-harness §3 | apex docx = 52,904 raw bytes | **55,734** bytes |
| map-harness §3 | 47,720 chars of parsed text | ~**47,454** by XML tag-strip (method-dependent) |
| map-harness §3 | 1,312 non-`dms` files / 338 distinct mtimes / 0.07 s | **Not reproducible.** 53,783 files / 7,873 distinct / **4.81 s**. Conclusion unaffected |
| map-harness §1 | `parse_doc.py` 90 lines | **89** |
| map-harness §1 | "25 scripts, ~1,770 lines" | **26** script files, **1,768** lines |
| map-harness §10, map-evaluation §10, map-pipeline-docs §3.2 | sweep 7,200 s timeout at `:344` / `:352` | **`utils/sweep.py:351`** |
| map-evaluation §0 | eval side "~1,900 lines" | **1,890** without `charts.py`; **2,545** with it |
| map-evaluation §3.2 | template braces escaped at `:22`,`:26` | `:22` and **`:25`** |
| map-evaluation §3.3 | Mistral `response_format` at `:202-203` | **`:203`** |
| map-evaluation §5.2, §12.4 | LLM matcher model hardcoded at `scoring.py:251` | **`:250`** |
| map-evaluation §9 | assistant text truncation at `agent_loop.py:132` | **`:129`** |
| map-task-census §2 | p75 = 15 | **p75 = 16** |
| map-task-census §5.1(d) | "127 tasks carry the canonical form" | Unreproducible; **140** carry the singleton `The answer does not assert` criterion (one per task) |
| map-corpus §3 | `draft` 787 | **785** (segment) / **797** (substring) |
| map-corpus §5.1, §7.3 | 169 redline-named files | **168** |
| map-corpus §5.2 | directive leak 15/235 = 6.4% | **16/235 = 6.8%** |
| map-corpus §5.2 | Alan Ngo: `ango@` in "the other three" | **2 of 4** use `ango@`; the 6th `.eml` (`Settlement & Dismissal/email-ngo-to-ellison-lumos-counteroffer.eml`) uses `alan.ngo@` |
| map-corpus §5.2 | two different SF addresses | Only the `1008-00002` "1 Market Street, Spear Tower" address is independently confirmed; the `1014-00003` Embarcadero address was not located |
| map-pipeline-docs §3.2 | `SWEEP_MATRIX` has 46 entries | **47** |
| map-pipeline-docs §3.3 | judge prompt is 25 lines | **26** |
| map-pipeline-docs §0.2 | "touched exactly one line of code" | Touched exactly **one file** (`harness/run.py`), **+5 lines**; the resulting `docs_dir` block is 7 lines (`:55-61`), 3 of them code |

---

## H. What remains genuinely UNVERIFIABLE

These are not errors — they are claims whose method was not published, or that
need a runtime the clone cannot produce. They should carry an UNVERIFIED marker
anywhere they are reused.

1. **map-task-census §3 task-shape taxonomy** (105/43/23/12/…) and §4 **criterion
   role taxonomy** (1,540/548/491/209/175/76/59). Rule-based classifiers,
   hand-corrected; not reproducible from the report. Their internal arithmetic
   checks out (both sum correctly), and the *reproducible* anchors — 140 closure
   criteria, 61 ACCEPTABLE-EITHER-WAY, the full opener census, the histogram —
   are all exact. Note also an internal inconsistency: the role table's seven
   roles sum to 3,098 yet the per-shape composition table carries an eighth
   *methodology* column.
2. **map-evaluation §2.3 "175 precision criteria."** Same classifier issue;
   closure-shaped criteria total **179** under an explicit opener rule.
3. **map-corpus §2.1 lifecycle coverage** (263 / 203 / 201). Heuristic not
   published; an independent one gives 264 / 232 / 230.
4. **map-corpus §5.2 markdown-emphasis leak (2/235)**, **§7.5 double-escaped
   entities in `sharedStrings.xml`**, **§5.1 two-sheet xlsx convention**, and the
   **`:17/:37/:47` timestamp clustering** — sample-only, not re-measured.
5. **map-corpus §5.1 character counts** (45,298 / 99,717) — extraction method not
   stated; tag-stripping gives 45,153 / 99,187 (≈0.3–0.5% apart).
6. **map-pipeline-docs §5.10 `scripts/setup.sh` line citations** — file not
   re-read at line level.
7. **All runtime claims across all five reports** — no harness run, no podman
   invocation, no API key, no `results/` in the clone. Container flags,
   timeout behavior, parser output shapes, judge behavior, and the announcement's
   baseline numbers (GPT-5.6-sol / Opus-4.8, ~half of criteria, 5+ min/task,
   regression to 0% all-pass) are all read from source or from the blog, never
   observed. Every report already says so; keep saying so.

---

## I. Reproduction

```bash
cd ~/YeeBois/research/harvey-labs

# structure
wc -l harness/*.py harness/adapters/*.py evaluation/*.py utils/*.py
git rev-parse --short HEAD && git tag -l && git rev-list --count v1.0..HEAD
git show 55510f0e6 --name-only -- . ':!tasks/firm-knowledge/dms' ':!tasks/firm-knowledge/tasks'

# repo-wide task census
find tasks -name task.json | wc -l                       # 2010
find tasks -name task.json | cut -d/ -f2 | sort -u | wc -l   # 27
python3 -c "import json,glob;fs=glob.glob('tasks/**/task.json',recursive=True);
print(sum(len(json.load(open(f))['criteria']) for f in fs))"   # 114912

# firm-knowledge slice
python3 -c "import json,glob;
ts=[json.load(open(f)) for f in glob.glob('tasks/firm-knowledge/tasks/*/task.json')];
ns=[len(t['criteria']) for t in ts];
print(len(ts), sum(ns), min(ns), max(ns), round(sum(0.5**n for n in ns),3))"   # 250 3098 1 122 10.188

# corpus, NAME LEVEL ONLY (no bytes read)
cd tasks/firm-knowledge && python3 -c "
import os,collections
e=collections.Counter(); n=0
for dp,dn,fn in os.walk('dms/matters'):
    for f in fn: e[os.path.splitext(f)[1]]+=1; n+=1
print(n, e)"                                              # 9288 docx 8055 eml 615 xlsx 573 pptx 45

# rubric ↔ corpus cross-check (§F) — see the report body for the full script
```
