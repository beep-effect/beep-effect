# Harness Architecture Map — harvey-labs

Date: 2026-08-08
Agent: map-harness (opus-5)
Clone: `~/YeeBois/research/harvey-labs` (all paths below are relative to the clone)
Scope read: `harness/**`, `sandbox/**`, `docs/architecture.md`, `tests/test_sandbox.py`,
`utils/sweep.py`, `scripts/setup.sh`, `evaluation/{run_eval,compare,report}.py` (metrics
surfaces only). **No file under `tasks/firm-knowledge/dms/` was opened.** One `.docx` under
`tasks/corporate-ma/.../documents/` was parsed to prove a grep claim.

---

## 1. Shape of the thing

Filesystem-first, no DB, no service. Three phases (`docs/architecture.md:3-34`): **run** →
**evaluate** → **report**. The whole agent side is ~2,200 lines of Python:

| File | Lines | Role |
|---|---|---|
| `harness/agent_loop.py` | 151 | the loop; message shuttling only |
| `harness/run.py` | 395 | task load, adapter factory, skill load, sandbox lifecycle, metrics |
| `harness/tools.py` | 668 | 6 tool defs + `ToolExecutor` dispatch + host-side glob/grep |
| `harness/system_prompt.md` | 31 | capability preamble (no task content) |
| `harness/adapters/*.py` | 992 | 6 providers behind a 4-method interface |
| `harness/skills/*/SKILL.md` | 158 / 86 / 95 | docx / xlsx / pptx manuals (+ 25 scripts, ~1,770 lines) |
| `sandbox/sandbox.py` | 581 | per-task Podman container, bind mounts, path discipline |
| `sandbox/parsers/parse_doc.py` | 90 | in-container docx/pdf/pptx/xlsx → text |

```
task.json (+ docs_dir) ─┐
                        ├─> run.py ─> Sandbox.start() ─> podman run (per task)
system_prompt.md ───────┤              │
skills/*/SKILL.md ──────┘              ├─> ToolExecutor ──┬─ bash / parse-doc → IN container
                                       │                  └─ read/write/glob/grep → HOST bind mount
                        run_agent() <──┴─> ModelAdapter.chat() → provider API
                                       │
                        results/<run-id>/{config,transcript.jsonl,metrics.json,output/,workspace/}
```

---

## 2. Agent loop

`harness/agent_loop.py:20-121`. Deliberately dumb — the docstring says so
(`agent_loop.py:1-10`): "the model does the thinking, the loop just shuttles messages".

- Seeds exactly two messages: system (preamble + concatenated skill manuals) and user (the task
  `instructions`). `run.py:331-340` is explicit that the system prompt carries **capabilities
  only, no task content**, "so the model treats them as an assignment, not as additional ambient
  context."
- Loops to `max_turns` (default **200**, `run.py:232`). Every turn: `adapter.chat` → append
  response → log → if no `tool_calls`, **stop**. There is no `finish` tool
  (`docs/architecture.md:119`); termination is "the model stopped calling tools".
- Tool calls in a turn execute **sequentially**, results batched into one
  `adapter.make_tool_result_messages` call (`agent_loop.py:88-102`). No parallel tool execution,
  no concurrency, no cancellation.
- Only one error is handled specially: context overflow, matched by **substring sniffing** on the
  exception message (`agent_loop.py:70`: `"prompt is too long" in err_msg or
  "context_length_exceeded" in err_msg`) → sets `context_overflow`, breaks, run ends. Every other
  provider exception propagates and kills the run.
- **No context management at all**: no compaction, no summarization, no tool-result truncation,
  no history windowing, no sub-agents, no memory. The loop's entire state is a growing `messages`
  list. This is a *measurement* decision, not an oversight — see §10.
- Return value carries `turn_count`, token totals, `wall_clock_seconds`, `finished_cleanly`,
  `context_overflow`, `tool_metrics`, and a permanently-`None` `finish_summary`
  (`agent_loop.py:110-121`) — vestigial from an earlier finish-tool design.

**Transcript is lossy by construction.** `_log_turn` writes `response.text[:500]`;
`_log_tool` writes `result[:1000]` as `result_preview` (`agent_loop.py:124-151`). The full
assistant text and full tool outputs are never persisted. Trajectory analysis (and
`utils/playback.py`) works off previews only.

---

## 3. Tool surface

Six tools, closed universe, no web access (`tools.py:1-24`). Definitions are canonical JSON
Schema (`tools.py:36-195`); each adapter translates.

| Tool | Runs where | Notable semantics |
|---|---|---|
| `bash` | **in container** | cwd persists across calls (container stays alive); `$WORKSPACE_DIR`/`$DOCUMENTS_DIR`/`$OUTPUT_DIR` injected; 60s default timeout |
| `read` | host (text) / **container** (office/pdf) | format dispatch by extension; optional `offset`/`limit` **in lines** |
| `write` | host | relative paths forced under `/workspace/output` (`tools.py:301-316`) |
| `edit` | host | exact-string replace; refuses ambiguous match unless `replace_all` |
| `glob` | host | mtime-desc sort, **hard cap 100 results** |
| `grep` | host | Python `re` over `read_text()`, **hard cap 250 results** |

### Path resolution (three different orders — deliberate)

- read: workspace → documents → output, fallback documents (`tools.py:282-299`)
- glob/grep: **documents** → workspace → output, default root documents (`tools.py:318-329`)
- edit: **output** → workspace → documents (`tools.py:515-526`)

Each order encodes intent: reads are usually corpus, searches are always corpus, edits are always
your own output.

### Every tool call returns a string, never raises

`ToolExecutor.execute` has a four-tier catch (`tools.py:376-392`) ending in a bare `except
Exception` whose comment is worth quoting: a corrupt `.docx`, a podman hiccup or a disk-full
`OSError` "would crash the run mid-flight… Surfacing the exception type lets the agent reason
about whether to retry, try a different tool, or give up on a particular file." Twelve tests in
`tests/test_sandbox.py:177-233` assert exactly this for bad paths, missing files, corrupt
docx/pdf/xlsx, write-to-readonly, invalid regex, unknown tool, and malformed JSON args.

### The two silent truncations (most consequential finding)

`tools.py:576` returns `matches[:100]`; `tools.py:629` returns `results[:250]`. **Neither says it
truncated.** On a 9,288-file corpus, `glob "**/*.docx"` returns 100 paths with no indication that
9,188 were dropped — and since the sort key is mtime, on a git checkout the surviving 100 are
arbitrary. Measured on this clone: 1,312 non-dms files, 338 distinct mtimes, total spread
**0.07 s** — i.e. checkout-time stamps, no meaningful ordering. (The `dms/` tree came from the
same checkout, so the same holds there; not re-measured, per the no-sweep rule.)

Harvey's blog diagnoses agents "regressing to 0% all-pass as enumeration size grows" and calls it
a stopping failure. Part of that is a **harness artifact**: the enumeration tools lie by omission,
so an agent that correctly believes its tool output is complete is wrong.

### grep is blind on this corpus — proven

`_grep` never dispatches on format; it does `fpath.read_text(encoding="utf-8",
errors="replace")` (`tools.py:613`) on whatever the glob matched. On an OOXML zip that yields
deflate noise. Measured on
`tasks/corporate-ma/analyze-change-of-control-provisions-across-targets-material-contracts/documents/apex-distribution-agreement.docx`:
52,904 raw bytes contain **82** five-letter ASCII runs (`Content`, `Types`, `docProps`, then
random noise like `dUnLp`); the parsed document contains **47,720** characters of real text. So
Jeff Huber's "ripgrep 100M tokens in <500ms" reply (CAPTURE.md) is answering a different question:
the bytes are there, the *text* is not greppable without parsing.

Worse, grep over the DMS is blind **and** expensive: default glob `**/*` walks every file and
`read_text`s ~517 MB of zip binary per call, host-side, single-threaded.

The agent *can* work around this — the image ships pandoc, ripgrep, python+markitdown, LibreOffice
— by scripting extraction through `bash`. That path is bounded by 60s/call, 2 CPUs, 2 GB.

---

## 4. Sandbox

`sandbox/sandbox.py`, `sandbox/Dockerfile`, `sandbox/README.md`. Per-task Podman container,
rootless, chosen over Docker explicitly because it needs no Desktop GUI/daemon so
`scripts/setup.sh` can bootstrap end-to-end (`sandbox.py:28-31`).

### Mounts — sibling host dirs presented as a nested tree

| Sandbox path | Mode | Host source (`run.py:278-296`) |
|---|---|---|
| `/workspace` | rw | `results/<run-id>/workspace/` |
| `/workspace/documents` | ro | task `docs_dir` (firm-knowledge: `tasks/firm-knowledge/dms`) |
| `/workspace/output` | rw | `results/<run-id>/output/` |

Mount order matters and is commented (`sandbox.py:361-369`): workspace mounts first as parent,
then documents/output overlay subdirectories of it. On the host they are siblings; only inside the
container do they nest. The single-root layout exists so `bash ls` from the default cwd shows the
agent the entire run at a glance (`sandbox/README.md:77-82`).

### Hardening

`--network=none --cap-drop=ALL --security-opt=no-new-privileges` (`sandbox.py:345-351`), plus
`--cpus=2.0 --memory=2g --pids-limit=256` — each gated on
`_cgroup_controller_available()` (`sandbox.py:60-81`), which parses `/proc/self/cgroup` and
`cgroup.controllers` to check the controller is actually delegated to the user session, returning
`True` (let podman try) on non-Linux or on detection failure. That is careful, unglamorous
portability work.

`--user` is deliberately **skipped on Linux** and applied on macOS/Windows
(`sandbox.py:352-353`), with a 12-line comment explaining rootless podman's uid mapping: passing
`--user=<host-uid>` under rootless Linux breaks writes to bind mounts with EACCES.

Timeouts are enforced **inside** the container by wrapping every command in coreutils `timeout
--kill-after=2 N bash -lc <cmd>` (`sandbox.py:427-432`), with the host `subprocess.run` given
+5s slack. The comment records the failed earlier design (a second `podman exec` sending SIGTERM
to reparented PIDs "return[ed] success without actually delivering the signal in some
PID-namespace configurations"). `tests/test_sandbox.py:303-323` asserts no `sleep 999` survives.

Cleanup is belt-and-braces: `finally: sandbox.stop()` in `run.py:361-362`, `atexit` handler held
by **weakref** so an explicitly-stopped sandbox isn't kept alive by atexit's strong refs
(`sandbox.py:105-118, 193`), and `--rm` as the last backstop if `podman rm -f` times out.

### The security model is two-plane, and that is the subtle part

Only `bash` and **document parsing** actually execute inside the container. `read` (text),
`write`, `edit`, `glob`, `grep`, `exists`, `list_files` all operate on the **host** through the
bind-mount paths, for speed (`tools.py:482-498`, `sandbox.py:474-542`). So the container is not a
perimeter around the filesystem — it is a perimeter around **code execution and untrusted-content
parsing**. Filesystem safety on the host plane rests on two string/path guards:

1. `Sandbox.assert_sandbox_path` + `_to_host` — path must be absolute and under one of the three
   canonical roots, then `resolve(strict=False).relative_to(host_root)` or `PermissionError`
   (`sandbox.py:476-499, 553-569`). Covers `..` traversal and symlink escape for read/write/exists.
2. `ToolExecutor._is_under` — per-file resolve-under-root check inside glob/grep traversal
   (`tools.py:631-644`). Its docstring names the attack: the agent runs
   `ln -s /etc/passwd /workspace/output/leak` inside the container (benign there), then calls
   `grep`, which resolves the link **on the host**. Three tests pin the behavior:
   `test_grep_does_not_follow_symlink_outside_root`, `test_glob_does_not_list_symlink_target_outside_root`,
   and the anti-regression `test_grep_still_finds_files_via_inside_mount_symlinks`
   (`tests/test_sandbox.py:239-348`).

`ro` on documents means the corpus cannot be mutated by the agent; `--network=none` means nothing
exfiltrates. Writes land with correct host ownership by design.

### Image

`python:3.12-slim` + apt (pandoc, libreoffice, ripgrep, poppler-utils, **tesseract-ocr**,
nodejs/npm, jq, gcc) + pip (pdfplumber, pandas, openpyxl, markitdown, python-docx, python-pptx,
docxtpl, defusedxml, diff-match-patch) + npm `docx`, `pptxgenjs` with `NODE_PATH` baked at build
time. Everything ships in the image precisely because the container has no network
(`Dockerfile:4-7`). Pulled from `ghcr.io/harveyai/lab-sandbox:latest`, local build as fallback
(`sandbox.py:276-323`); CI builds it via `.github/workflows/build-sandbox-image.yml`.

---

## 5. Document parsing (`read`)

Dispatch by extension (`tools.py:436-480`). For `docx|pdf|pptx|xlsx` the harness shells
`parse-doc <ext> <path>` **inside the container** — the stated reason is that "pdfplumber /
pandas / markitdown have a non-trivial vulnerability surface" and the host must never touch
attacker-controlled document bytes (`tools.py:441-449`). Outer timeout 120s; parser failures come
back as strings, not exceptions.

| Format | Engine (`sandbox/parsers/parse_doc.py`) | Output shape | Fidelity gotchas |
|---|---|---|---|
| `.docx` | `pandoc -t markdown --wrap=none`, 30s inner timeout (`:26-33`) | markdown | tracked changes/comments not surfaced as such |
| `.pdf` | `pdfplumber` per page: `extract_text()` then `extract_tables()` tab-joined (`:36-48`) | text + TSV-ish tables | **no OCR** — scanned PDFs return empty even though tesseract is in the image |
| `.pptx` | `markitdown` `.text_content` (`:51-52`) | text | no slide images, no layout, no speaker-note distinction |
| `.xlsx` | `pandas.read_excel(sheet_name=None)` → `df.to_string(index=False)` per sheet with `=== Sheet: <name> ===` headers (`:55-61`) | aligned text tables | **formulas lost** (cached values only); first row forced to header → `Unnamed: 0` columns on title-row sheets; whitespace-padded alignment is token-expensive |
| everything else | host `read_file` + `utf-8` replace | raw text | `.eml` lands here as plain text |

**`read` has no size cap.** `offset`/`limit` exist but the model must choose them; unbounded by
default, a single large document can consume the context window, and the only backstop is the
overflow substring sniff in the loop. Contrast Claude Code's read, which truncates by default.

---

## 6. Skill-manual pattern

Anthropic-Skills-shaped, with one big divergence.

Structure: `harness/skills/<fmt>/SKILL.md` (YAML frontmatter: `name`, `description`) +
`scripts/`. `run.py:200-223` discovers every `*/SKILL.md`, concatenates the **full body** of each
under a `## Skill: <name>` heading into the system prompt, and `shutil.copytree`s each `scripts/`
into `<workspace>/skills/<name>/scripts/` so the agent invokes them via `bash`.

The manuals are unusually good and share a rigid rhetorical shape worth copying:

1. **Frontmatter description states triggers AND anti-triggers** — every one ends with an explicit
   negative: "For READING existing .docx files, use the harness `read` tool — do not invoke this
   skill… Does NOT apply to .pdf, .xlsx, .pptx, or .doc (legacy Word)" (`docx/SKILL.md:3`).
2. **Read/write split restated in the body** as a blockquote (`docx/SKILL.md:8`), so the model
   cannot miss that reading is the tool's job, not the skill's.
3. **Quick-reference table first** — goal → script, one row per intent.
4. **Decision guidance, not just capability**: "When unsure, prefer the markdown + reference-doc
   path — Pandoc handles the OOXML correctness so you don't have to" (`docx/SKILL.md:33`).
5. **Named failure modes with mechanism**: run-merging across `<w:r>` boundaries, smart-quote
   escaping, `xml:space="preserve"`, "use `defusedxml.minidom`, NOT `xml.etree.ElementTree` —
   ElementTree corrupts presentation namespaces" (`pptx/SKILL.md:59`), EMU units, numbering `numId`
   references.
6. **A mandatory validation gate**: "**Always run `validate.py` before declaring the task
   complete**" — schema-validates against ECMA-376 XSDs, checks rIds and content-type registration
   (`docx/SKILL.md:129-142`, `xlsx/SKILL.md:76-77`, `pptx/SKILL.md:85-87`). pptx adds a
   *deterministic* QA pass (bbox overflow, >50% shape overlap, min font sizes, unfilled
   placeholders, ≤7 bullets) with vision QA explicitly deferred: "(A vision-model QA pass is
   intentionally out of scope for v1…)" (`pptx/SKILL.md:65-83`).
7. **An "Out of scope" section that names the escalation path** — legacy `.doc` → convert with
   soffice; PivotTables/DAX → "escalate (Windows-only via COM, not portable)".
8. **Domain conventions encoded as law** — the xlsx manual's "Banker conventions (mandatory for
   financial models)": inputs blue / formulas black / cross-sheet green / external red, negatives
   in parentheses, `0.0"x"` multiples, underline-only totals, no merged cells in input ranges,
   units in adjacent cells (`xlsx/SKILL.md:21-34`). A script applies them from a JSON spec.
9. **Engine-choice tables with honest coverage limits** — LibreOffice recalc (ground truth, 5-10s)
   vs pure-Python xlcalculator (0.5s, ~80% of functions, explicitly *not* XLOOKUP/LET/dynamic
   arrays/LAMBDA) (`xlsx/SKILL.md:44-61`).

**The divergence: no progressive disclosure.** Anthropic Skills load descriptions and fetch bodies
on demand; here all three full manuals (339 lines) are pasted into every system prompt of every
run regardless of task. That is a benchmark decision — identical prompt bytes for every model
eliminates skill-discovery variance as a confound — not a production one.

---

## 7. Provider adapters

Interface is four methods (`adapters/base.py:38-86`): `chat`, `make_tool_result_messages`,
`make_system_message`, `make_user_message`, over two dataclasses (`ToolCall{id,name,arguments}`,
`ModelResponse{message,tool_calls,text,input_tokens,output_tokens}`). `ModelResponse.message`
carries the **provider-native** message so the loop can append it blindly — the loop never
inspects message shape.

| Provider | Wire API | Reasoning knob | Retries | Notes |
|---|---|---|---|---|
| Anthropic | Messages, **always streamed** ("avoid SDK timeout on large responses", `anthropic.py:97-99`) | `thinking:{type:"adaptive"}` + `extra_body.output_config.effort`; forces `temperature=1` | none | per-model `MAX_OUTPUT` table (128k for opus/fable/sonnet-5); `NO_TEMPERATURE_MODELS` list; thinking blocks re-serialized **with signature** for multi-turn (`:159-183`) |
| OpenAI | **Responses API** | `reasoning:{effort, summary:"auto"}`, drops temperature | none | stateful `_context` accumulation |
| Google | genai `chats` session | `thinking_level` enum map + `include_thoughts` | none | patches `config._raw_data` to bypass Pydantic when the SDK lags (`google.py:74-87`); filters `part.thought` from text |
| Mistral | (149 lines) | — | — | not read in depth |
| Fireworks | OpenAI-compatible chat completions | `extra_body.reasoning_effort` | **8**, linear `15*(n+1)` capped 60s | expands bare `kimi/glm/nemotron` → `accounts/fireworks/models/<name>`; passes `api_key` explicitly because `openai.OpenAI(api_key=None)` would silently send `OPENAI_API_KEY` to Fireworks (`fireworks.py:28-36`) |
| Baseten | OpenAI-compatible / any vLLM | `chat_template_kwargs.enable_thinking` | **5**, jittered exponential | `max_tokens=128000` because the gateway default 4096 lets reasoning models spend the budget thinking and get cut off (`baseten.py:53-58`) |

Routing is a prefix cascade in `run.py:83-180`: explicit `provider/model`, else `claude*` /
`gpt*|o1|o3|o4` / `gemini*` / `mistral*` / `kimi|glm|nemotron`, else a helpful error.

**Two structural smells.** First, `reasoning_effort` is a bare `str | None` normalized ad hoc per
provider — five different encodings of one concept, no validation, unsupported values silently
ignored (Google's map lookup) or forwarded (Anthropic). Second, **OpenAI and Google adapters are
stateful**: `OpenAIAdapter` builds `self._context` on the first call and thereafter *ignores* the
`messages` argument (`openai.py:30-42, 82`), and `make_tool_result_messages` mutates `self._context`
as a side effect (`openai.py:98-108`); `GoogleAdapter` holds a live `self._chat` session
(`google.py:43-104`). So the loop's `messages` list is authoritative for Anthropic/Fireworks/Baseten
and merely a log for OpenAI/Google. Consequence: no mid-run adapter swap, no resume-from-transcript,
no deterministic replay for two of six providers.

---

## 8. Metrics / telemetry

No OpenTelemetry, no `logging`, no structured events — grep for `opentelemetry|structlog|import
logging` across `harness sandbox evaluation utils` returns nothing. Telemetry is four files per
run under `results/<run-id>/`:

- `config.json` — model, task, max_turns, temperature, shell_timeout, reasoning_effort, skills,
  sandbox_image, started_at.
- `transcript.jsonl` — per-turn assistant entries (text truncated 500 chars) and per-tool entries
  (result truncated 1,000 chars).
- `metrics.json` — `turn_count`, input/output/total tokens, `wall_clock_seconds`, plus
  `ToolExecutor.get_metrics()`: `documents_read` + full `documents_read_list`,
  `documents_skipped` + full `documents_skipped_list`, `total_documents`, `bash_commands`,
  `files_written`, `files_edited`, `glob_searches`, `grep_searches` (`tools.py:646-668`).
- `scores.json` / `report.html` from the eval phase; `evaluation/compare.py` builds dashboards
  with an in-repo per-model price table and Pareto score-vs-cost / score-vs-latency scatters
  (`compare.py:27-28, 100, 373-391`).

**Document coverage is the distinctive metric**: which corpus files the agent opened vs skipped,
carried into `scores.json` as `doc_coverage` (`run_eval.py:139-152`) and surfaced in reports.
That is the empirical instrument behind the "search coverage, not reasoning" diagnosis.

Gaps: no per-tool latency, no per-tool error counts, no retry/timeout counters, no cache-hit or
thinking-token accounting, no bytes-read. Token counts come from provider usage only.

### Defect 1 — `metrics.json` always reports `finished_cleanly: true`

`run.py:365-377` builds the dict with `"finished_cleanly": result["finished_cleanly"]` and then
spreads `**result["tool_metrics"]` **last**; `ToolExecutor.get_metrics()` hardcodes
`"finished_cleanly": True` (`tools.py:667`). Dict-literal semantics: the spread wins. The real
value (which encodes context-overflow and max-turns exhaustion) survives only in the console
print at `run.py:390`. Any downstream analysis that filters runs on `metrics.json`'s
`finished_cleanly` silently includes truncated runs.

### Defect 2 — coverage metric is O(corpus) per run and O(n·m) in Python

`get_metrics()` does `documents_dir.rglob("*")` then
`skipped = [f for f in all_documents_files if f not in unique_reads]` — a list membership test per
file (`tools.py:646-654`). On firm-knowledge that is a 9,288-file walk plus ~9,288×|reads| string
comparisons at the end of **every** run, and it writes a ~9,000-entry
`documents_skipped_list` into every `metrics.json`. (Same shape as the repo's own
`O(n²) A.append` perf law.)

### Defect 3 — prefix check without a boundary in the tools-side path mapper

`tools.py:489-497` uses `sb_path.startswith(DOCUMENTS_PATH)` (no `"/"` boundary), while
`sandbox.py:482-490` uses the correct `== root or startswith(root + "/")`. A path like
`/workspace/documents-notes` passes `assert_sandbox_path` (it is under `/workspace/`) and then
maps to `documents_dir / "-notes"` instead of `workspace_dir / "documents-notes"`. Not an escape —
`_is_under` and the non-existent root make it fail closed — but the two mappers disagree, which is
exactly the kind of divergence that becomes a hole after a refactor.

---

## 9. Portable patterns worth stealing for beep-effect

Ranked by value-to-effort. Each is a design, not a copy-paste.

1. **Enumeration tools must never truncate silently.** The single highest-leverage lesson here,
   and it generalizes far past benchmarks: any beep tool/CLI that returns a bounded list must
   return `{shown, total, truncated, nextCursor}` as *data*, not a prose suffix. Schema-first:
   model the result as a `TruncatedListing` codec so the "did I see everything" question is
   answerable by construction. Directly applicable to `beep qa` inventories, `knowledge refs`
   census output, `repo-symbol-discovery` helpers, and any MCP tool we ship.
2. **Two-plane sandbox: container for execution + untrusted parsing, host for bulk FS.** The
   split is the interesting part — they paid a `podman exec` round trip only where untrusted
   *bytes* get interpreted, and kept host speed for traversal, then paid down the resulting risk
   with one guard (`resolve().relative_to(root)`) and three pinned tests. If beep ever runs
   agent-authored code or parses user-supplied Office files, copy this exact shape, including the
   symlink-escape test trio.
3. **`_is_under` as a named, tested invariant.** Port as an Effect service method with a typed
   error (`PathEscapesRoot`) plus the anti-regression test that an *inside*-the-mount symlink
   still resolves. Guards are only trustworthy when the negative test exists.
4. **The SKILL.md rhetorical template.** Anti-triggers in the description; read/write split;
   quick-reference table; named failure mechanisms; a **mandatory validation gate** as the last
   step; an "Out of scope" section that names the escalation. Our skills already do some of this;
   the mandatory-gate and anti-trigger habits are the gaps. The pptx *deterministic* QA pass
   (geometry + typography rules, machine-checkable, vision explicitly deferred) is a direct
   template for cheap pre-vision checks in `browser-qa-loop`.
5. **Domain conventions encoded as a mandatory manual + a script that applies them.** The banker
   conventions are the model for how OIP/patent formatting law should ship: prose rule in the
   manual, executable enforcement in a script, validation gate before delivery.
6. **Capability normalization table across providers.** `reasoning_effort` → five wire encodings
   is the right *idea* with the wrong *type*. Port as a `LiteralKit` effort domain plus a
   per-provider encoder in the Effect AI layer, so an unsupported value is a decode error rather
   than a silent no-op. Same treatment for max-output-token defaults and "this model rejects
   temperature" (both currently hardcoded string-prefix lists in `anthropic.py:17-47`).
7. **Retry policy belongs to the layer, not the adapter.** Six adapters, three different policies,
   two with none. In Effect this is one `Schedule` provided by a layer (and note our own memory:
   `Schedule.max` does not bound retries — spell the bound explicitly).
8. **Document-coverage as a first-class metric.** "Which artifacts did the agent open vs skip"
   turned a vague "agents are bad at big corpora" into a falsifiable claim. The analogue for beep:
   for any knowledge/retrieval feature, log the candidate set and the touched set, and report
   coverage — that is the instrument that tells you whether a failure is retrieval or reasoning.
9. **Provider-native message passthrough.** `ModelResponse.message` stays in the provider's own
   shape and the loop never inspects it — the only normalized surface is `tool_calls` + usage.
   Cheap, and it dodges an entire class of lossy-normalization bugs (e.g. Anthropic thinking-block
   signatures, which must round-trip verbatim).
10. **The failure-mode comments.** `sandbox.py` records *why* the previous design failed
    (cross-exec SIGTERM on reparented PIDs), why `--user` is skipped on Linux, why the rm timeout
    was raised from 15s. This is the friction-receipt discipline our AGENTS.md asks for, applied
    at the code-comment level.

### Anti-patterns to avoid (found here, cheap to not repeat)

- Dict-spread clobbering an authoritative field (Defect 1) — in TS the analogue is a spread after
  an explicit key; a schema-encoded metrics record would have made the collision a type error.
- Two path mappers with different prefix-boundary rules (Defect 3) — one mapper, one law.
- Stateful adapters that ignore their own arguments (§7) — kills replay and resume.
- Error classification by substring sniffing on exception text (`agent_loop.py:70`) — tagged errors
  exist for this.
- O(n) corpus walk + O(n·m) membership test on every run's teardown (Defect 2).

---

## 10. Decisions that only make sense because it is a benchmark

Do **not** port these into a product harness:

- **No context management whatsoever** — no compaction, no summarization, no tool-result
  truncation. The measurement is precisely whether the *model* can build an intermediate
  representation of the corpus; harness-side compaction would contaminate the result. A product
  agent must do the opposite.
- **All skill manuals always loaded** — kills skill-discovery variance across providers; costs
  ~339 lines of prompt on every run.
- **No `finish` tool** — termination is "stopped calling tools", which is the behavior under test
  (the stopping failure). A product harness wants an explicit, auditable completion signal.
- **`temperature=0.0` default, no sampling, single run per config** — reproducibility over realism.
- **The prompt-level "do not read `task.json`" rule** (`system_prompt.md:16-18`) is
  belt-and-braces: only `docs_dir` is mounted, and `task.json` lives *outside* it in every layout
  (regular tasks: `<task>/task.json` vs mounted `<task>/documents/`; firm-knowledge:
  `tasks/firm-knowledge/tasks/NNN/task.json` vs mounted `tasks/firm-knowledge/dms/`). The rubric
  is physically unreachable; the prompt rule is a second lock.
- **Per-run fresh workspace** — see below, this is the structurally important one.

### The amortization gap (most relevant to our knowledge-engine bet)

Harvey's stated next direction is amortizing corpus understanding — indexes, summaries, memory —
across runs against a persistent corpus. **The harness as shipped cannot express that experiment.**
`run.py:283-284` creates `workspace_dir = results/<run-id>/workspace` fresh per run; the run id
includes a timestamp (`run.py:269-271`); the container is destroyed at the end; `documents` is
mounted `ro` so nothing can be written beside the corpus; and there is **no CLI flag** for a
shared cache dir (`run.py:228-241` exposes only `--model --task --run-id --max-turns --temperature
--shell-timeout --reasoning-effort --skills --sandbox-image`).

So anyone testing an amortized index — including us — must either (a) precompute outside the
harness and mount it as a fourth volume, or (b) patch `run.py`/`Sandbox` to accept a persistent
`--cache-dir` mounted rw. Both are small patches (Sandbox already takes arbitrary mounts only via
its three fixed `-v` flags, so (b) is ~10 lines). Worth flagging to the shaping stage: **the
cheapest credible beep experiment on this benchmark is "build the index once, mount it read-only,
measure all-pass + doc-coverage delta"**, and it needs that patch first.

Related: the in-container budget for any index-building strategy is 60s per `bash` call
(`run.py:234`), 2 CPUs, 2 GB, 256 pids — extraction must shard across many calls. `utils/sweep.py`
runs whole `harness.run` subprocesses in a `ThreadPoolExecutor` (`:382, 421`) with a 7,200s
per-run timeout (`:344`), so `--parallel 8` means 8 concurrent containers ≈ 16 CPUs / 16 GB.

---

## 11. UNVERIFIED

- `harness/adapters/mistral.py` (149 lines) was not read line-by-line; its row in §7 is inferred
  from the routing table and the shape of its siblings.
- mtime uniformity was measured on 1,312 non-`dms` files from this clone (338 distinct stamps,
  0.07 s spread) and **extended by inference** to `dms/`, which was not stat-ed per the no-sweep
  rule.
- No run was executed (no podman invocation, no API keys), so all runtime claims — timeout
  behavior, container flags taking effect, parser output shapes — are read from source and tests,
  not observed.
- `evaluation/{judge,scoring}.py` were inspected only for metric plumbing; rubric/judge design is
  another agent's brief.
- The claim that the pptx/xlsx skill scripts behave as their manuals describe was not verified by
  execution; script line counts and names were checked, contents mostly not.
