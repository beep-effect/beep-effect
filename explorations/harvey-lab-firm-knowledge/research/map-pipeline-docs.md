# Map: docs, tooling, and generation-pipeline evidence — harvey-labs

Date: 2026-08-08
Agent: map-pipeline-docs (Opus 5)
Clone under study: `~/YeeBois/research/harvey-labs` @ `55510f0e6` (2026-08-07)
Citations are **relative to the clone root** (`file:line` where practical).

Scope: `README.md`, `CONTRIBUTING.md`, `docs/`, `pyproject.toml`, `utils/`,
`scripts/`, `tests/`, `.github/workflows/`, `harness/`, `sandbox/`,
`evaluation/`, and `git log`. **No file under `tasks/firm-knowledge/dms/` was
read** — only directory names were listed (266 entries, cheap `ls`), per the
packet's hard rule.

---

## 0. TL;DR

1. **The spec→feature→render generation pipeline is not in the repo, and its
   absence is deliberate and documented in a commit message.** The
   firm-knowledge drop stripped provenance keys (`_source_id`, `_family`) out
   of the ported `task.json` files (commit `55510f0e6` body). Only rendered
   output ships.
2. **The entire 250-task / 9,288-file drop touched exactly one line of code**
   — a 7-line `docs_dir` override in `harness/run.py:56-63`. Zero docs, zero
   tests, zero README, zero `tasks/firm-knowledge/README.md`. The word
   `firm-knowledge` appears in **one** place outside `tasks/`: a code comment
   (`harness/run.py:57`).
3. **The public repo is a projection of a larger internal repo.** Two stale
   internal path conventions leak: `markets/<segment>/<area>/<slug>/documents/`
   (`sandbox/README.md:11`, `sandbox/README.md:25`) and `--task
   <segment>/<area>/<slug>` (`scripts/setup.sh:24`). The public taxonomy is
   only two levels (`<area>/<slug>`), so `<segment>` is an internal axis that
   was flattened away.
4. **Task authoring is schema-lite by design**: 5 required keys, no JSON
   Schema file, validation is a hand-rolled `validate_task_config`
   (`evaluation/run_eval.py:32-56`) plus a parameterized pytest sweep
   (`tests/test_task_integrity.py`). CI is one workflow running the whole
   offline suite (`.github/workflows/validate-task-schema.yml`).
5. **firm-knowledge tasks silently opt out of half the integrity suite.** They
   carry no per-criterion `deliverables`, so `discover_standard_tasks()`
   (`tests/test_task_integrity.py:41-57`) excludes all 250 from the
   required-field, deliverables-list, and deliverable-ref tests.
6. **Docs are materially stale relative to the code.** Counts, adapter tables,
   and at least one CLI flag are wrong (§6). The published `v1.0` tag predates
   the firm-knowledge drop by 8 commits — the drop is **unversioned**.
7. Highest-value steal targets, in order: the **sandbox contract**
   (`sandbox/`), the **criterion-scoped judge** (`evaluation/scoring.py`), the
   **preflight-then-sweep** discipline (`utils/sweep.py:582-655`), and the
   **skill-manual-as-system-prompt-appendix** pattern
   (`harness/run.py:197-223`).

---

## 1. The synthetic generation pipeline: present, partial, or withheld

### 1.1 Verdict: **withheld, with a legible negative space**

| Pipeline stage (per the X post / blog) | In repo? | Evidence |
|---|---|---|
| Firm structure (46 clients, practice areas, 266 matters) | Output only, as directory names | `tasks/firm-knowledge/dms/matters/` = 266 dirs, ids `<client>-<seq>`, clients `1001`–`1046` (46 distinct) |
| Matter **specification** (~1,000 tokens) | **Absent** | no spec files anywhere; no `spec`/`specification` token in any non-task source file |
| **Features** (10% escrow, HSR second request, dismissed litigation) | **Absent as data**; survive only as prose inside `match_criteria` | e.g. `tasks/firm-knowledge/tasks/001/task.json` C-001: "the FTC issued an HSR Second Request on July 16, 2024" |
| Feature→document **pinning** | **Absent as data**; survives as prose | task 001 C-005: "Includes or identifies `second-request-strategy-memo.docx` for Harrowgate PE, matter 1003-00001" |
| **Renderer** (spec → 10–200 Office files) | **Absent** | no generator module; `python-docx`/`python-pptx` are in `pyproject.toml:14-15` under a `# Document generation` comment but are used only by the agent-facing **skills** (`harness/skills/docx/scripts/*`), not by any corpus builder |
| Ground-truth **derivation** from feature mix | **Absent** | criteria are hand-shaped prose; no computation code |
| Task **enumeration** against specs | **Absent** | no enumerator; the 250 `task.json` are terminal artifacts |

### 1.2 The smoking gun: provenance keys were explicitly stripped

Commit `55510f0e6` ("Add firm-knowledge enterprise-search benchmark (250 tasks
over a shared DMS) (#130)") body:

> "Provenance-only keys (`_source_id`, `_family`) were stripped from the
> ported `task.json` files; macOS `.DS_Store` cruft was excluded from the
> corpus."

This is direct evidence that the internal task objects carry at least two more
fields:

- `_source_id` — a pointer back to the generating spec/feature record.
- `_family` — a task-family grouping key. This is almost certainly the
  enumeration axis the blog describes ("tasks are enumerated against the
  short-form specifications … ground truths computed as matters or documents
  containing a particular mix of features"): one *family* = one feature-mix
  query template, instantiated across the matter set.

Verification of the strip: a census of all 250 files shows exactly five
top-level keys and exactly three criterion keys, with no underscore-prefixed
survivors.

```
top-level keys: {id:250, title:250, instructions:250, docs_dir:250, criteria:250}
criterion keys: {id:3098, title:3098, match_criteria:3098}
docs_dir values: {"../../dms": 250}
work_type / tags / deliverables: absent from all 250
criteria: 3,098 total — min 1, median 7, max 122
```

(reproduce: `python3` over `tasks/firm-knowledge/tasks/*/task.json`, counting
`Counter(c.keys())`.)

### 1.3 What the shipped shape still tells us about the pipeline

- **Matter identity is a computable key, not a name.** `1003-00001` =
  client `1003`, matter `00001`. Every criterion in task 001 and task 200
  cites the pair `(client display name, matter id)`. The generator clearly
  minted client ids first (1001..1046), then matter sequences per client.
- **Criteria are mechanically derived, then prose-rendered.** Three recurring
  criterion archetypes are visible in the two tasks sampled:
  1. *qualifying-member* (one criterion per matter in the ground-truth set),
  2. *cardinality* ("States that 3 matters drew an issued HSR Second
     Request"),
  3. *precision / anti-over-enumeration* ("The answer does not assert any
     matter outside this list: …").
  Archetype 3 is the negative half of a set-equality assertion. A generator
  that knows the ground-truth **set** can emit all three from one template —
  which is exactly what `_family` would key.
- **The generator also encodes grading tolerances.** task 001 C-004: "A higher
  count that also includes the acceptable-either-way cross-practice
  second-request matters is equally acceptable." That is a spec-level
  *ambiguity annotation* surviving into rendered prose — meaning the internal
  feature model distinguishes strict members from borderline members.
- **No corpus index ships.** `tasks/firm-knowledge/` contains exactly two
  entries: `dms/` and `tasks/`. There is no client list, no matter manifest,
  no practice-area map, no `README.md`. That is the benchmark's thesis made
  structural: the agent must *build* the intermediate representation the blog
  says today's agents fail to build.

### 1.4 Port note for beep-effect

The withheld half is precisely the half worth rebuilding schema-first: a
`MatterSpec` schema (client ref + shape + feature set), a `Feature` tagged
union with document pinning, a `TaskFamily` that enumerates ground truths as a
*set-valued query over features*, and a renderer that emits OOXML. The
criterion archetypes above are the derivation rule set — three generators over
one ground-truth set. Harvey shipped the output; the schema is inferable from
the output and the two leaked key names.

---

## 2. Task authoring + schema-validation workflow

### 2.1 Authoring contract

`CONTRIBUTING.md:41-101` is the authoring spec. Directory-per-task under
`tasks/<practice-area>/<task-or-workflow>/<optional-scenario>/` with
`task.json` + `documents/`. Task IDs are the slash path under `tasks/`
(`CONTRIBUTING.md:34-39`).

Required / recommended fields (`CONTRIBUTING.md:78-85`,
`docs/architecture.md:58-67`): `title`, `instructions`, `criteria` required;
`deliverables`, `work_type`, `tags` recommended/optional. **`docs_dir` is
documented nowhere** — it exists only in `harness/run.py:56-63` and
`utils/describe_task.py:70-71`.

Rubric-writing law (`CONTRIBUTING.md:87-99`, `docs/eval-strategies.md:110`):
name the fact/clause/number, state failure modes in `FAIL if` language, scope
each criterion to its deliverables, **no "nice-to-have" padding** (all-pass
scoring makes padding actively harmful), and **no legacy `weight` field**.

### 2.2 Validation is two-layer, hand-rolled, no JSON Schema

**Layer 1 — runtime gate.** `validate_task_config()`
(`evaluation/run_eval.py:32-56`) is called by *both* the runner
(`harness/run.py:53`) and the evaluator (`evaluation/run_eval.py:100`).
It enforces `REQUIRED_TASK_KEYS = {"title","instructions","criteria"}`
(`evaluation/run_eval.py:27`), `REQUIRED_CRITERION_KEYS =
{"id","title","match_criteria"}` (`:28`), non-empty criteria list, and
`deliverables` list-ness when present. That is the entire schema. There is no
`schema.json`, no pydantic model, no `jsonschema` dependency.

**Layer 2 — repo-wide pytest sweep.** `tests/test_task_integrity.py`
parameterizes over every discovered `task.json` (2,010 of them today):
- `TestTaskJsonSchema` — parseable JSON, `title` longer than 5 chars.
- `TestInlineRubric` — `criteria` present/non-empty; unique criterion ids;
  required fields; **`weight` explicitly banned** (`:157-160`).
- `TestDeliverableRefs` — deliverables are lists of non-empty strings.
- `TestCrossTaskConsistency` — ≥2 distinct `work_type` values repo-wide.

**The two-tier gate.** `discover_standard_tasks()` (`:41-57`) splits tasks:
"standard" means `criteria[0]` has a `deliverables` key; everything else is
"legacy BLB-imported" and gets relaxed checks. Since firm-knowledge criteria
carry only `{id,title,match_criteria}`, **all 250 fall into the relaxed
bucket** and skip `test_criteria_have_required_fields`,
`test_criteria_have_deliverables_list`, and `test_deliverable_refs_valid`.
They are covered only by JSON-parseability, title length, criteria presence,
and id uniqueness.

Dead code worth noting: `VALID_TIERS = {1,2,3,4}` (`tests/test_task_integrity.py:18`)
is defined and never used — residue of a difficulty/tier concept that also
survives in `docs/tutorial.md:108` as a `--difficulty medium` flag that
`utils/list_tasks.py` does not implement (it accepts only `--area` and
`--work-type`, `:103-111`).

### 2.3 The author's loop

`CONTRIBUTING.md:103-124` prescribes:

```
uv run python -m utils.describe_task <area>/<task-id>
uv run python -m pytest tests/test_task_integrity.py
uv run python -m harness.run --model anthropic/claude-haiku-4-5-20251001 --task <id> --max-turns 20
uv run python -m evaluation.run_eval --run-id <run-id> --task <id> --judge-model claude-sonnet-4-6
```

Plus a docs-drift guard (`CONTRIBUTING.md:174-182`): when docs mention counts,
model IDs, or tool names, verify against code with `utils.list_tasks | tail -5`
and a ripgrep. **This guard is documented and not enforced** — see §6.

### 2.4 CI

Two workflows only (`.github/workflows/`):

- `validate-task-schema.yml` — on every PR and push to `main`: `uv sync
  --frozen` then `uv run pytest tests/ -v`. Name says "task schema", job runs
  the *whole* offline suite (renamed in `1da475017`, "[tests] Run full offline
  test suite in CI"). Note this now checks out a ~5.3 GB repo and
  parameterizes ~2,010 tasks × 6 test methods per PR.
- `build-sandbox-image.yml` — path-filtered on `sandbox/**`, buildx
  multi-arch (`linux/amd64,linux/arm64`), pushes `ghcr.io/harveyai/lab-sandbox`
  with `latest` + short-sha tags, GHA cache.

Governance: `.github/CODEOWNERS` is a single line — every path requires review
from one of five Harvey admins. No external merge path.

---

## 3. How sweeps and runs are configured

### 3.1 The run unit

`harness/run.py` CLI (`:228-241`): `--model`, `--task` required; `--run-id`,
`--max-turns` (200), `--temperature` (0.0), `--shell-timeout` (60),
`--reasoning-effort`, `--skills`, `--sandbox-image`. Run IDs default to
`{task}/{model-short}{-effort}/{timestamp}` (`:266-271`).

Three design decisions worth lifting:

- **System prompt = capabilities only; task = first user message.**
  `harness/run.py:331-340` with the rationale inline: "The per-task
  instructions go in the first user message so the model treats them as an
  assignment, not as additional ambient context."
- **Skills are markdown manuals + copied scripts.**
  `harness/run.py:197-223`: every `harness/skills/*/SKILL.md` is appended to
  the system prompt, and `skills/<name>/scripts/` is `copytree`'d into the
  run workspace so the agent can `bash` them. `--skills` with no args disables
  them — a first-class ablation axis.
- **No finish tool.** The loop terminates when the model stops calling tools
  (`harness/agent_loop.py:84-86`, `harness/tools.py:3-7`).

### 3.2 The sweep unit

`utils/sweep.py` is the matrix driver.

- `SWEEP_MATRIX` (`:199-257`) is a flat list of `{model, reasoning[, temperature]}`
  dicts — 46 entries across Anthropic / OpenAI / Google / Mistral / Fireworks.
  Reasoning effort is a *first-class sweep dimension*, not a model attribute:
  `claude-opus-4-8` appears five times (low/medium/high/xhigh/max).
- Resolution: `all` | practice area | workflow dir | exact task
  (`:126-194`), matching `docs/architecture.md:242-249`.
- **Preflight before spend** (`:582-655`): config-id collision detection, task
  loadability, rubric presence — abort the sweep on any failure (`:711-713`);
  `--preflight-only` exits after. This is the single best-engineered idea in
  the repo for a benchmark that costs real money per run.
- **Idempotent resume** (`:328-330`): a config whose latest run already exists
  is skipped, so a killed sweep re-runs only the gaps. Same for eval
  (`:454-456` skips when `scores.json` exists).
- **Process-group hygiene** (`:35-121`): every child runs with
  `start_new_session=True`; SIGINT/SIGTERM/atexit kill the whole registered
  pgid set with TERM→0.2s→KILL. Agent runs get a 7,200 s timeout, evals 1,800 s.
- **Asymmetric parallelism**: agent runs use `--parallel` as given; eval
  parallelism is clamped (`min(parallel, 4)` in the per-task path `:499`,
  `min(parallel, 8)` in the all-tasks path `:530`) because the judge is
  API-rate-bound.
- Three phases in one command (`:718-748`): runs → eval → report, with
  `--eval-only` / `--report-only` skips.

Gap: `--dual` (dual-judge) exists on `evaluation.run_eval` but **is not
plumbed through `utils/sweep.py`** — sweeps are single-judge only, hard-coded
to `--judge-model claude-sonnet-4-6` (`:672`, `:462-468`).

### 3.3 Evaluation configuration

- Judge default `claude-sonnet-4-6`, temperature 0.0, one criterion per call,
  JSON-schema-constrained verdict (`evaluation/judge.py:19-27`).
- Prompt is a 4-slot template, 25 lines: `evaluation/prompts/rubric_criterion.txt`
  (`task_description`, `agent_output`, `criterion_title`, `match_criteria`).
- Dual judge (`evaluation/run_eval.py:163-225`): runs both judges, renames
  `scores.json` → `scores_<judge>.json` between passes, deletes any stale
  aggregate *first* (`:179`) so a failed re-grade can't leave a lying
  `scores_dual.json`. Aggregate `all_pass` requires both judges to all-pass.
- **Deliverable scoping degrades to whole-output for firm-knowledge.**
  `score_rubric` (`evaluation/scoring.py:322-340`) builds the deliverable map
  from per-criterion `deliverables`; when a criterion has none it falls back to
  `_load_all_output()` — the entire `output/` tree concatenated. Consequence:
  a firm-knowledge task with 122 criteria sends the full agent output **122
  times**. The criterion-scoping cost control that the methodology doc
  advertises (`docs/eval-strategies.md:67`) does not apply to the new task set.

---

## 4. Versioning and roadmap signals

- **Single tag, and it predates the drop.** `git tag -l` → `v1.0` only,
  pointing at `1da475017` (2026-07-24). HEAD is 8 commits later. The
  firm-knowledge release is untagged; the citation block still says
  `version = {v1.0}` and links `tree/v1.0` (`README.md:41-50`) — which does
  **not** contain firm-knowledge.
- **README's stated posture**: "LAB is an ongoing project and we expect to
  consistently add to and refine the task set and execution harness"
  (`README.md:21`).
- **The "we'll be sharing more soon" line lives only in the blog/X post**
  (announcement text §Conclusion: richer up-front corpus representations —
  indexes, summaries, memory — amortized across runs). **Nothing in the repo
  states that roadmap.** No design doc, no issue templates, no ROADMAP.md.
  UNVERIFIED whether an internal branch carries it.
- **Adapter-surface roadmap is visible in the pricing table, not the docs.**
  `evaluation/compare.py:29-71` `MODEL_INFO` carries entries the sweep matrix
  does not use, including `claude-fable-5` ("Fable 5", $10/$50 per 1M) and a
  full Baseten catalogue (GLM 5.2/5.1/5, Kimi K2.7 Code, DeepSeek V4 Pro,
  Nemotron 3 Ultra/Super). Pricing is added ahead of sweep entries — that
  ordering is the tell for which providers are being onboarded next.
- **Sandbox extensibility is explicitly staged.** `sandbox/README.md:14-18`:
  "If/when a second backend (k8s, modal, …) is needed, the abstract methods
  write themselves from the existing concrete one — for now there is one, and
  the indirection isn't worth the friction." Stated inspirations: Inspect AI's
  `SandboxEnvironment` and Princeton's HAL Harness
  (`sandbox/README.md:118-121`).
- **Internal-repo residue = roadmap of what is *not* public.** `markets/<segment>/`
  (`sandbox/README.md:11,25`) and `--task <segment>/<area>/<slug>`
  (`scripts/setup.sh:24`) show a third taxonomy level upstream. The blog's
  "current version of C&H covers only part of the work performed by a law
  firm" maps onto that missing `<segment>` axis.
- **Dev-process residue** in `.gitignore:209-217`: `results/`, `.claude/`,
  `sweep.log`, `sandboxing-plan.md`, `.commit-message-draft.md`. Harvey builds
  this with Claude Code, keeps a sandboxing design doc out of the public tree,
  and drafts commit messages in-repo.

---

## 5. Worth stealing (ranked, with beep-effect port notes)

**S-tier**

1. **`sandbox/` — the three-axis contract.** "Task / Agent / Sandbox vary
   independently" (`sandbox/README.md:9-18`), one canonical filesystem
   (`/workspace` rw, `/workspace/documents` ro, `/workspace/output` rw), and
   *every* tool routed through it (`harness/tools.py:9-24`). The security
   argument is the good part: attacker-controlled `.docx` is parsed **inside**
   the container via `parse-doc` (`harness/tools.py:436-480`,
   `sandbox/Dockerfile` COPY of `parsers/parse_doc.py`), because
   pdfplumber/pandas/markitdown have real CVE surface. Port target: any
   beep-effect agent tool that parses untrusted documents.
2. **Preflight-before-spend** (`utils/sweep.py:582-655`). Validate ids for
   collision, loadability, and rubric presence, then abort the whole matrix.
   Direct analogue: `beep qa` / evidence-loop should preflight scenario
   inventories before burning a recording lane.
3. **Criterion-scoped, one-call-per-criterion judging**
   (`evaluation/scoring.py:342-368`, `docs/eval-strategies.md:224-232`). Each
   criterion sees only its declared deliverables — "prevents cross-contamination
   between unrelated deliverables". Our QA judge inventories currently judge
   whole evidence bundles; scoping is a cheap precision win.
4. **All-pass scoring with a diagnostic** (`evaluation/scoring.py:383-386`,
   `evaluation/run_eval.py:116-123`). Headline is binary; `n_passed/n_criteria`
   is reported alongside so a near-miss is legible. The rationale sentence is
   worth quoting in our own docs: a diligence memo that catches 95% of issues
   but misses a material one is not 95% useful.

**A-tier**

5. **Skill manuals as system-prompt appendix + copied scripts**
   (`harness/run.py:197-223`, `harness/skills/*/SKILL.md`). YAML frontmatter
   with `name` + a trigger-laden `description`, an explicit *negative* scope
   ("Reading is not in scope — use the harness `read` tool"), a
   goal→script quick-reference table, and gotchas that only come from
   experience (the OOXML **run-merging gotcha**, `harness/skills/docx/SKILL.md`).
   `validate.py` is a *mandatory final step* per skill. This is our own skill
   grammar, independently arrived at — and their "unpack → mutate XML → pack →
   validate" triple is directly reusable for any OOXML work in beep.
6. **Structured-output LLM fallback for fuzzy matching**
   (`evaluation/scoring.py:196-265`). Deliverable resolution ladder: exact →
   single-file-of-extension → keyword-overlap fuzzy → **LLM match with a
   generated JSON Schema whose properties are the exact unresolved keys**.
   Every rung prints what it did. Good pattern for any "agent named the file
   something else" reconciliation.
7. **Process-group lifecycle management** (`utils/sweep.py:35-121`). Our
   long-running fan-outs leak orphans (see auto-memory
   `workspace-slowness-orphaned-quality-runs`); this is the fix, in 90 lines.
8. **`utils/playback.py`** (1,708 lines) — renders a `transcript.jsonl` as a
   human timeline, terminal or HTML, "designed for non-technical reviewers"
   (`utils/playback.py:1-12`). Also hosts
   `build_message_history_from_transcript()` (`:1632`) for
   replay-to-turn-N checkpoint resume. Concept is strong; see the caveat in §6.
9. **Chart vocabulary** (`evaluation/charts.py`): leaderboard table, criterion
   heatmap, **Pareto scatter** (quality vs cost/latency), bump chart, task
   heatmap, all-pass distribution. The Pareto scatter is the one our CI/quality
   dashboards lack.

**B-tier / notable**

10. `scripts/setup.sh` (360 lines) — idempotent cross-platform bootstrap
    including a WSL2 install-and-ask-for-reboot path
    (`scripts/setup.sh:109-144`) and a rootless-Podman rationale
    (`:218-223`). Reference for "one script, works on three OSes, safe to
    re-run".
11. `scripts/remap_results.py` — a results-layout migration (model-first →
    task-first) that also rewrites `run_id` inside `config.json`/`scores.json`
    and prunes emptied parents. The pattern (move + rewrite embedded
    self-references + `--dry-run`) is the correct shape for our own artifact
    re-layouts.
12. `evaluation/compare.py:78-90` — longest-prefix model-id matching that
    **raises** on an unknown model rather than defaulting a price. Fail-loud
    on unpriced models is the right call.
13. `sandbox/Dockerfile` — a deliberately non-minimal agent image: ripgrep,
    jq, pandoc, libreoffice, poppler, **tesseract-ocr**, node + `docx`/
    `pptxgenjs`, with `NODE_PATH` baked so `require('docx')` works from any
    cwd. Useful shopping list if we ever ship a beep agent sandbox.
14. `harness/tools.py:631-644` `_is_under()` — symlink-escape guard for
    host-side traversal, with the attack spelled out in the docstring
    (`ln -s /etc/passwd /workspace/output/leak`, then grep from the host).

---

## 6. Doc/code drift and defects (verified)

These matter because they tell us which parts of the repo are load-bearing and
which are decoration.

| # | Claim | Reality | Evidence |
|---|---|---|---|
| D1 | firm-knowledge is documented | It is not. Not in README, tutorial, architecture, eval-strategies, or CONTRIBUTING. `docs_dir` appears in zero doc files. | ripgrep over `README.md CONTRIBUTING.md docs/ evaluation/ utils/ tests/ scripts/ sandbox/ harness/` |
| D2 | "1,671 tasks" (badge) / "1,660 tasks" (docs) | 2,010 `task.json` on disk | `README.md:13`, `docs/tutorial.md:424`, `docs/eval-strategies.md:183` vs `find tasks -name task.json \| wc -l` |
| D3 | 24 practice areas + contracting | 27 top-level dirs containing tasks (adds `diligence`, `contracts`, `firm-knowledge`) | `find tasks -name task.json \| cut -d/ -f2 \| sort -u` |
| D4 | 5 adapters | 6 — Baseten missing from the table | `docs/architecture.md:160-170` vs `harness/run.py:104-108`, `harness/adapters/baseten.py` |
| D5 | `utils.list_tasks --difficulty medium` | Flag does not exist | `docs/tutorial.md:108` vs `utils/list_tasks.py:103-111` |
| D6 | `transcript.jsonl` = "full turn-by-turn model and tool trace" | Lossy: assistant text truncated to 500 chars, tool results to 1,000 | `docs/tutorial.md:168` vs `harness/agent_loop.py:129`, `:148` |
| D7 | Checkpoint-resume is tested | The tests are inert and stale: gated on a `results/sonnet-46-full` dir that `results/` gitignores, and they assert on a `finish` tool and `executor.finished` that no longer exist | `tests/test_checkpoint_resume.py:15-18`, `:83-121` vs `harness/tools.py:3-7` |
| D8 | firm-knowledge is schema-validated in CI | Only weakly — 250 tasks fall in the relaxed bucket | `tests/test_task_integrity.py:41-57` + the census in §1.2 |
| D9 | `utils.list_tasks` reports document counts | Reports **0 documents** for all 250 firm-knowledge tasks: it ignores `docs_dir` and only looks at `task_dir/documents` | `utils/list_tasks.py:34-39` vs `utils/describe_task.py:66-85` |
| D10 | grep is a viable corpus search tool | Near-blind on this corpus: `_grep` reads files as UTF-8 text on the host (`read_text(errors="replace")`), and 8,055 of 9,288 corpus files are OOXML zip archives | `harness/tools.py:601-629` |
| D11 | metrics scale to the shared DMS | `get_metrics()` enumerates the entire documents tree and writes a `documents_skipped_list` — ~9,000 paths embedded in every firm-knowledge `metrics.json`, computed with an O(n·m) list membership scan | `harness/tools.py:646-668` |
| D12 | "Do not read `task.json` … automatically fail the task" | Prompt-level rule with **no enforcement anywhere in the code**; it holds only because `task.json` is outside the bind-mounted `documents/` | `harness/system_prompt.md:16-18`; no matching check in `harness/` or `evaluation/` |

D10 is the direct rebuttal to Jeff Huber's "ripgrep 100M tokens in <500ms"
reply in the X thread (`assets/x-post-…md:93`): the harness `grep` never
decompresses OOXML, so keyword search over the DMS is structurally
near-useless — which is the benchmark's whole point, not an oversight.
(The sandbox image *does* ship `ripgrep`, so an agent could in principle
`bash` its way to a smarter search — but it would hit the same zip problem
without unzipping first.)

---

## 7. Open questions / UNVERIFIED

- **UNVERIFIED**: the exact schema of `_family` and `_source_id`. Inferred to
  be (task-family template key, generating-spec pointer) from the commit
  message plus criterion archetypes; no artifact in the public tree confirms it.
- **UNVERIFIED**: whether the generation pipeline is a separate private repo or
  a private directory of the same internal monorepo. `markets/<segment>/…`
  suggests the latter.
- **UNVERIFIED**: whether the blog's baseline numbers (GPT-5.6-sol, Opus-4.8,
  ~half of criteria, 5+ min/task) were produced with this public harness or an
  internal one. `results/` is gitignored and no scores ship; the sweep matrix
  does contain both models.
- **UNVERIFIED**: whether any firm-knowledge criterion cites a document that
  does not exist in `dms/` (rubric/corpus desync). Three prior commits fixed
  exactly that class of bug for other task sets (`81b7c068c`, `438183bbd`,
  `a30c248c5`), and firm-knowledge shipped with no cross-reference test. This
  is a cheap, high-value check for the corpus-anatomy agent: task 001 names
  six specific filenames under three named matters.
- **UNVERIFIED**: whether `--dual` was ever run over firm-knowledge (sweep does
  not plumb it).

---

## 8. Evidence appendix — commands used

```bash
# repo shape, no corpus traversal
find . -maxdepth 2 -not -path './.git/*' -not -path './tasks/*'
wc -l harness/*.py harness/adapters/*.py evaluation/*.py utils/*.py scripts/*.py

# the drop
git log --oneline -40
git show 55510f0e6 --stat -- . ':!tasks/firm-knowledge/dms'   # -> harness/run.py only
git show 55510f0e6 -- harness/run.py
git tag -l && git rev-list --count v1.0..HEAD                  # v1.0, 8 commits behind

# task census (task.json only; dms never opened)
find tasks -name task.json | wc -l                             # 2010
find tasks -name task.json | cut -d/ -f2 | sort | uniq -c
python3 -c "…Counter over tasks/firm-knowledge/tasks/*/task.json…"

# corpus structure by directory name only
ls tasks/firm-knowledge/dms/matters | wc -l                    # 266
ls tasks/firm-knowledge/dms/matters | cut -d- -f1 | sort -u | wc -l   # 46
```
