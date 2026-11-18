# External landscape: agent-legible verification output

Research date 2026-11-18. Every claim cites a URL that was fetched, read from a search result, or
read from source through the GitHub API. "Source" means the file was read at `main` on
2026-11-18. Versions come from `npm view` on the same day: vitest 5.1.1, oxlint 1.94.0,
@biomejs/biome 2.6.8, turbo 2.11.12, nx 24.0.6, @playwright/test 1.65.1, typescript 7.0.2,
std-env 4.3.0, @vercel/detect-agent 1.2.7, bun 1.4.4 (GitHub release 2026-10-22).

## 1. Built-in agent modes in the tools we use

### Vitest (MIT): auto-detected `minimal` reporter, alias `agent`

- **What:** "Outputs a minimal report containing only failed tests and their error messages.
  Console logs from passing tests and the summary section are also suppressed." It is "enabled
  automatically when Vitest detects it is running inside an AI coding agent"
  (https://vitest.dev/guide/reporters, docs for v5.1.1).
- **How it is selected (source):** `packages/vitest/src/defaults.ts` sets
  `reporters: [isAgent ? 'minimal' : 'default', ...(GITHUB_ACTIONS === 'true' ? ['github-actions']
  : [])]` and `watch: !isCI && stdin.isTTY && !isAgent`. `isAgent` is re-exported from `std-env`
  (`src/utils/env.ts`). The default applies only when `reporters` is unset. When coverage uses the
  `text` reporter under an agent, `resolveConfig.ts` sets `skipFull: true` and adds `text-summary`.
  (https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/defaults.ts)
- **History:** the agent reporter arrived in 4.1 (InfoQ, 2026-05-01,
  https://www.infoq.com/news/2026/05/vitest-4-1-ai-agents/). Release aggregators report that 4.1.5
  (2026-04-21) renamed it to `minimal` and kept `agent` as an alias (https://releases.sh/vitest/vitest.md,
  from a search excerpt; not checked against the official changelog).
- **Side effect:** issue #10046 reports that 4.1.2 turned off colours in user test code whenever
  `isAgent` is true (https://github.com/vitest-dev/vitest/issues/10046, from a search excerpt).
  Other reporters: `json`, `junit`, `tap`, `blob`, `html`, `github-actions`, `dot`.
- **Fit:** enable it today by leaving `reporters` unset under agents, or select `minimal`
  explicitly. It prints no verdict line and no log pointer, so it covers only part of the need.

### Bun test runner (MIT): quiet mode keyed on three environment variables

- **What:** with `CLAUDECODE=1`, `REPL_ID=1` or `AGENT=1`, "only test failures are displayed in
  detail", passing, skipped and todo indicators are hidden, and "summary statistics remain intact"
  (https://bun.com/docs/test). A regression test in the repo confirms this
  (`test/cli/test/claudecode-flag.test.ts`). Reporters: `--reporter=junit --reporter-outfile`,
  `--dots`.
- **Gap:** Bun checks no `AI_AGENT` and no `CODEX_*` variable, so Codex triggers nothing unless the
  harness sets `AGENT=1`. Bun's own source (`src/bun_core/env_var.rs`) declares `CLAUDECODE` and
  `CURSOR_TRACE_ID`.
- **`bun check` (on main, release unverified):** a built-in type checker that "reports the same
  errors as `tsc` from TypeScript 7". It was merged 2026-10-06 (oven-sh/bun#44361) and is not
  mentioned in any release note up to 1.4.4. Under `AGENT=1`, `CLAUDECODE=1` or `REPL_ID=1` it
  prints each error as a tagged block, `<error file=… line=… column=… code="TS2322">` with
  `<source>` and `<related>` children and no colour
  (https://github.com/oven-sh/bun/blob/main/docs/runtime/check.mdx).
- **Fit:** works today for `bun test`. The XML-ish error block from `bun check` is a model worth
  borrowing for typecheck diagnostics.

### Turborepo (MIT): output controls exist, but detecting an agent changes no output

- **Flags** (https://turborepo.dev/docs/reference/run, lastUpdated 2026-11-17):
  `--output-logs=full|hash-only|new-only|errors-only|none`; `--log-order=stream|grouped|auto`
  (`auto` means grouped in CI); `--log-prefix=task|none|auto`; `--summarize` writes run metadata as
  JSON under `.turbo/runs`; `--dry=json`. `--json` writes NDJSON to stdout with `timestamp`,
  `source` (`turbo` or `<pkg>#<task>`), `level` (`info|warn|error|stdout|stderr`) and `text` with
  ANSI stripped, and it "disables the TUI". It combines with `--log-file`. `--profile` can
  "Output a Markdown file to simplify consumption for LLMs".
- **Agent detection:** the `turborepo-ai-agents` crate matches `@vercel/detect-agent`, checking
  `AI_AGENT` first and then vendor variables
  (https://github.com/vercel/turborepo/blob/main/crates/turborepo-ai-agents/src/lib.rs). Detection
  only maintains an `AGENTS.md` block (`"agentGuidance": true`) and feeds telemetry. It does not
  alter task output (https://turborepo.dev/docs/guides/ai).
- **Fit:** `--output-logs=errors-only --log-order=grouped`, or `--json` piped into our own
  renderer, is available today. Turbo prints no verdict line of its own.

### Nx (MIT): the closest built-in match to our target

- The `--outputStyle=summary` style "prints only run counts and one line per failing task, naming
  the file on disk that holds its full output. No task output is printed inline, so the size of a
  run's output does not depend on how much its tasks logged. This is the default when Nx detects
  it is being driven by an AI agent." `static-failures-only` is the CI default
  (https://nx.dev/docs/reference/nx-commands.md).
- Agent mode for `create-nx-workspace`, `init` and `import` emits JSON events and a `needs_input`
  message listing `missingFields`, `availableOptions` and `exampleCommand`. The stated principle is
  "informative, not instructive" (https://nx.dev/blog/making-nx-agent-ready, 2026-03-05).
- Detection in `packages/nx/src/native/utils/ai.rs` (source) checks `CLAUDECODE`, `CLAUDE_CODE`,
  `REPL_ID`, Cursor's `PAGER`+`CURSOR_TRACE_ID`+`COMPOSER_NO_INTERACTION`, `OPENCODE`,
  `GEMINI_CLI`, `VSCODE_AGENT`, `CODEX_THREAD_ID` and `COPILOT_CLI`. `AI_AGENT` was not among the
  variables matched.
- **Fit:** not in our stack, but `summary` is the closest spec for our console shape.

### Biome (MIT/Apache-2.0): many reporters, no agent detection

- `--reporter=default|concise|summary|json|json-pretty|github|gitlab|junit|checkstyle|rdjson|sarif`,
  repeatable, with `--reporter-file=PATH`, `--max-diagnostics` (default 20, or `none`) and
  `--diagnostic-level`. `json` and `json-pretty` are marked experimental and "may change in patch
  releases" (https://biomejs.dev/reference/reporters/).
- No `CLAUDECODE`/`AI_AGENT` handling in the repo (code search, 2026-11-18). **Fit:** `sarif` or
  `rdjson` as the machine input, `concise` for the console; do not build on experimental `json`.

### oxlint (MIT): an `agent` format, selected automatically

- `-f/--format`: `checkstyle, default, agent, github, gitlab, json, junit, sarif, stylish, unix`
  (https://oxc.rs/docs/guide/usage/linter/cli.html). `agent` is "a brief format intended for
  consumption by AI agents", for example `test.js:5:1: error eslint(no-debugger): … help: Remove
  the debugger statement` (https://oxc.rs/docs/guide/usage/linter/output-formats).
- **Auto-selection (source):** `default_output_format()` in `apps/oxlint/src/command/lint.rs`
  returns `Agent` when `agent_detection::is_agent()` is true, and only then falls back to `Github`
  when `GITHUB_ACTIONS=true`. The detector "mirrors the environment-based detection used by
  `std-env`". The feature landed in #22068 (2026-05-17).
- The coding-agents guide recommends `npx oxlint --deny-warnings --format=agent` before finishing
  (https://oxc.rs/docs/guide/usage/coding-agents.html). **Fit:** works today with no configuration.

### TypeScript 7 / tsgo (Apache-2.0): text output only

- `pretty` "Stylize[s] errors and messages using color and context, this is on by default"
  (https://www.typescriptlang.org/tsconfig/pretty.html). `--pretty false` prints
  `file(line,col): error TSxxxx: msg`.
- There is no JSON or SARIF output. microsoft/TypeScript#63632 ("machine-readable (JSONL)
  diagnostics output", 2026-06-29) is open. A team member wrote "I doubt we are going to stick
  this into 7.0" and named the API as the supported route. #55890 (SARIF, 2023) is also still
  open. A search found no agent detection in microsoft/typescript-go.
- **Fit:** parse `--pretty false` lines keyed on TS codes, or call the compiler API. Bun's tagged
  block shows a target rendering.

### Playwright (Apache-2.0): agent detection only suppresses browser opening

- Reporters are `list` (local default), `line`, `dot` (CI default), `html`, `blob`, `json`, `junit`
  and `github`, with `PLAYWRIGHT_{JSON,JUNIT,…}_OUTPUT_FILE` variables
  (https://playwright.dev/docs/test-reporters).
- `isCodingAgent()` in `packages/utils/env.ts` checks only `CLAUDECODE` and `COPILOT_CLI`. The HTML
  reporter and trace viewer use it to skip auto-opening a browser (source:
  `packages/playwright/src/reporters/html.ts`). Console output does not change.
- **Fit:** `dot` or `line` plus `json` to a file, rendered by us.

### GitHub Actions: annotations, summaries, problem matchers, logs API

- **Annotations:** `::error|warning|notice file=,line=,endLine=,col=,endColumn=,title=::msg`
  (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands). Limits are
  10 errors, 10 warnings and 10 notices per step and 50 per job
  (https://raw.githubusercontent.com/actions/toolkit/HEAD/docs/problem-matchers.md).
- **Job summary:** `GITHUB_STEP_SUMMARY` allows 1 MiB per step, and at most 20 step summaries are
  shown per job (workflow-commands page). Problem matchers map log lines to annotations with
  regexes (toolkit doc).
- **Checks API:** each annotation has `path`, `start_line`, `end_line`, optional columns,
  `annotation_level` (`notice|warning|failure`), `message` (up to 64 KB), `title` (up to 255
  characters) and `raw_details`. The API takes 50 annotations per request, and `output.summary`
  and `output.text` take up to 65,535 characters each (https://docs.github.com/en/rest/checks/runs).
- **Logs:** `GET /repos/{o}/{r}/actions/jobs/{job_id}/logs` answers 302 with a plain-text URL
  that "expires after 1 minute"
  (https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run).
- **Fit:** the annotation caps mean the on-runner renderer has to rank and truncate diagnostics,
  so the Checks API, which accepts more annotations, is the better place for the full set.

## 2. How tools detect an agent

- **std-env (MIT):** exports `isAgent`, `agent`, `agentInfo` and `detectAgent()`
  (https://unpkg.com/std-env@4.2.0/README.md). In `src/agents.ts` (source), `AI_AGENT` wins and is
  lowercased; then the first match from this table: claude `CLAUDECODE|CLAUDE_CODE`; replit
  `REPL_ID`; gemini `GEMINI_CLI`; codex `CODEX_SANDBOX|CODEX_THREAD_ID`; opencode; pi (`PATH`);
  auggie; goose; junie `JUNIE_DATA|JUNIE_SHIM_PATH`; copilot `COPILOT_AGENT|COPILOT_CLI`; devin
  (`EDITOR`); cursor `CURSOR_AGENT`; kiro (`TERM_PROGRAM`, non-TTY only)
  (https://github.com/unjs/std-env/blob/main/src/agents.ts). Vitest and oxlint inherit this table.
- **@vercel/detect-agent:** puts `AI_AGENT` first. Turborepo's crate states that it matches it.
- **Emerging standard:** agentsmd/agents.md#136, "Standardize AI_AGENT for agent runtime
  detection" (open, opened 2026-01-08, last verified 2026-10-02). Producers MUST set `AI_AGENT`
  matching `^[A-Za-z0-9_-]{1,64}$` and SHOULD NOT overwrite an inherited value ("outermost agent
  wins"). Consumers MUST treat any value other than `0/false/no/off` as an agent and MUST NOT use
  the variable for authorization. `AGENT` is a legacy fallback. Its adoption table lists Claude
  Code as setting `AI_AGENT=claude-code_<version>_agent` (Changelog 2.1.120) plus `CLAUDECODE=1`
  and `CLAUDE_CODE_CHILD_SESSION=1`, and Codex CLI as "requested" with only `CODEX_CI=1` and
  `CODEX_THREAD_ID` (https://github.com/agentsmd/agents.md/issues/136). The Codex request is
  openai/codex#36883, open since 2026-08-04.
- **Observed in this session:** a Claude Code child process had `AI_AGENT=claude-code_2-1-327_agent`,
  `CLAUDECODE=1` and `CLAUDE_CODE_CHILD_SESSION=1`. The Claude Code docs say `CLAUDECODE` is set
  "in subprocesses Claude Code spawns (Bash and PowerShell tools, … hook commands, … stdio MCP
  server subprocesses)" (https://code.claude.com/docs/en/env-vars).
- **Caveat:** each tool keeps its own list (Bun: `AGENT`/`CLAUDECODE`/`REPL_ID`; Playwright:
  `CLAUDECODE`/`COPILOT_CLI`; Nx: a custom list). A Codex shell turns on agent mode in Vitest and
  oxlint but not in Bun or Playwright. Pattern write-up:
  https://agentpatterns.ai/tool-engineering/agent-aware-cli-via-env-var/ (reviewed 2026-06-03).

## 3. Dedicated tools and libraries

- **vitest-agent** (https://github.com/spencerbeggs/vitest-agent, MIT; renamed from the deprecated
  `vitest-agent-reporter` 1.3.1, whose npm notice says "Try the even better @vitest-agent/plugin").
  A Vitest plugin, reporter, CLI, MCP server and Claude Code plugin built on Effect services with
  SQLite at `$XDG_DATA_HOME/vitest-agent/<workspaceKey>/data.db`. It classifies tests as
  `stable | new-failure | persistent | flaky | recovered` and uses a per-executor console matrix
  (`human`, `agent`, `ci`). In agent mode it prints one markdown frame (counts, classifications,
  coverage, and a footer naming the next MCP tool) plus a stderr failure summary capped at 15
  lines. It writes `.vitest/vitest-agent/run.json` (versioned envelope, Draft-07 schema) and
  `summary.md`, which also feeds the step summary (repo `website/docs/en/guide/*.mdx`).
  Maintenance: very active, with `@vitest-agent/plugin@6.0.15` published 2026-11-16 and a peer
  dependency of `vitest ^5.0.0`. Adoption: 2 GitHub stars and one maintainer. **vitest-agent.dev
  did not resolve in DNS from two clients on 2026-11-18, so the site is unverified.** The unscoped
  npm name `vitest-agent` is now an npm "security holding package" (versions 1.0.0 to 1.0.6 were
  published 2026-06-25 to 07-01 and then replaced on 2026-07-02), so install only the
  `@vitest-agent/*` scope. Fit: the strongest prior art for history and classification, and its
  architecture is close to what we plan, but it covers Vitest only.
- **alchemy-test** (https://alchemy.run/blog/2026-07-22-a-test-runner-for-agents/, 2026-07-22; repo
  path `alchemy-run/alchemy/packages/alchemy-test`, licence not stated in the post). A
  Vitest-compatible runner on Effect fibers in a single Bun process. Passing tests are silent.
  A failure prints its error and buffered output inline. A stall notice fires after 10 s. The
  run ends with counts and repeats the failures. It prints the per-run log path "with its line
  count and size" so the agent can decide whether to read it, and keeps a TUI for humans. Key
  line: "The console is the summary; the log is the record." Fit: the closest Effect-native
  design, but it is a runner, not a library.
- **rtk** (https://github.com/rtk-ai/rtk, Apache-2.0, about 87k stars, v1.2.0 on 2026-11-08,
  pushed daily). A Rust CLI proxy that claims "60-90%" token reduction. `rtk init --global`
  installs a Claude Code PreToolUse hook that rewrites commands such as `git status` to
  `rtk git status`. Only Bash calls pass through it (https://code.morphllm.com/rtk-ai/rtk/raw/branch/master/README.md,
  from a search excerpt). Fit: generic compression after the fact. It cannot know which lines
  matter for our verdicts.
- **tokf** (https://github.com/mpecan/tokf, MIT, crate 0.2.54, about 200 stars, pushed
  2026-11-16). A config-driven compressor with TOML filters that strips passing tests and
  collapses repeated errors. It credits rtk and includes a `tokf gain` report
  (https://docs.rs/crate/tokf/0.1.8). Fit: same category as rtk. Its declarative filter format is
  worth studying.
- **Jest:** a 2026-02-09 write-up measured a 215-suite run at about 3,500 tokens of output, almost
  all "PASS" lines. Switching to `summary` with `summaryThreshold: 0` cut output by 96%. It selects
  reporters from `CLAUDECODE=1` or `CI=true` because agents forget flags
  (https://magarcia-io.pages.dev/your-test-output-is-burning-tokens).
- **pytest:** pytest-agent-digest (Markdown digest, "No ANSI escape codes in any output",
  `## Failures` first, zero counts omitted, `test-results.md` by default,
  https://callowayproject.github.io/pytest-agent-digest/specs/agent-digest-v1/). A search also
  surfaced pytest-markdown-report, pytest-verdict (JSONL output and a token budget, where a
  100-token budget reduces output to a verdict line), pytest-beacon (TOON format) and
  agent-output (https://pypi.org/project/jaymd96-pytest-verdict/0.1.1/,
  https://pypi.org/project/pytest-beacon/). All are young and their savings are self-reported;
  licences were not checked.
- **Go:** gotestsum `short-with-failures` prints a line per package plus failed-test output
  (https://pkg.go.dev/gotest.tools/gotestsum@v0.4.0). We found no Go reporter built for agents.
- **Bazel Build Event Protocol (Apache-2.0):** each event has an id, announced `children` and a
  payload (which may be `Aborted`). "All events, except for the first event, are announced by a
  previous event". The build is complete when every announced child is posted or accounted for.
  The final event sets `last_message`. `BuildFinished` carries the authoritative exit code.
  `TestResult` is emitted per attempt, shard and run, and `TestSummary` per target. Output goes
  to `--build_event_json_file` or a varint-delimited binary file (https://bazel.build/remote/bep;
  https://bazel.build/remote/bep-glossary.md). Fit: a model for our event stream, especially
  announced children as a completeness proof, `Aborted` as a first-class outcome, and a single
  authoritative verdict event.

## 4. Interchange schemas

| Schema | Scope | Licence | Maintenance | Typecheck/lint fit |
| --- | --- | --- | --- | --- |
| CTRF | JSON test results | MIT | spec 0.2.0, 2026-10-10, Working Draft | Tests only |
| JUnit XML | test suites/cases | none (de facto) | no official spec | Poor (Biome/oxlint emit it anyway) |
| TAP 14 | line-oriented test stream | Artistic-2.0 | 2022 spec | Poor |
| SARIF 2.1.0 | static-analysis results | OASIS RF on RAND | OASIS Standard + Errata 01, 2023-08-28 | Native |
| GitHub Checks annotation | per-line annotations + summary | GitHub API | live | Native, capped |

- **CTRF** (https://github.com/ctrf-io/ctrf, `spec/ctrf.md`; https://ctrf.io/docs/specification/overview):
  required fields are `reportFormat: "CTRF"`, a semver `specVersion` and `results` (`tool`,
  `summary`, a flat `tests[]`, `environment`). `status` is one of
  `passed|failed|skipped|pending|other`. A test counts as flaky only if it passes after failed
  attempts. Per-test fields include `message`, `trace`, `snippet`, `ai`, `line`, attempt history
  and attachments. Run-level `insights` and a `baseline` are also defined. Unknown fields are
  forbidden outside `extra` (namespaced keys), times are in milliseconds, and reports are
  immutable. Before 1.0, minor versions may break compatibility (CHANGELOG). Reporters exist for
  Playwright and Jest (0.2.0, Oct 2026); `vitest-ctrf-json-reporter` is stale (0.0.3, 2025-09). Fit: the
  best schema for test results, with history built in, but it has no diagnostic or location model
  for lint or typecheck.
- **JUnit XML:** "no official specification", "various tools generate and support different
  flavors" (https://github.com/testmoapp/junitxml). An export target for CI dashboards only.
- **TAP 14:** version line, `1..N` plan, `ok`/`not ok`, YAML diagnostics with no schema, and
  `# SKIP`/`# TODO` (https://testanything.org/tap-version-14-specification.html). Easy to stream,
  but its semantics are too weak.
- **SARIF 2.1.0:** "a standard format for the output of static analysis tools"
  (https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html). Results carry `ruleId`,
  `level` (`error|warning|note|none`), `message`, `locations` (artifact URI plus region) and
  `partialFingerprints` for deduplication. Biome and oxlint already emit it. Fit: the best schema
  for lint and typecheck diagnostics, but a poor fit for test runs (no pass, skip or duration
  model).
- **GitHub Checks annotations** (see §1): a sink, not a source of truth.

## 5. Published guidance and measurements

- **Anthropic, "Writing effective tools for AI agents"** (2025-09-11,
  https://www.anthropic.com/engineering/writing-tools-for-agents): "For Claude Code, we restrict tool
  responses to 25,000 tokens by default". It recommends "pagination, range selection, filtering,
  and/or truncation with sensible default parameter values" and a `response_format` enum
  (concise or detailed; in its Slack example the concise form used about a third of the tokens).
  Tools should return "high signal information" with natural-language identifiers rather than
  UUIDs, give actionable errors "rather than opaque error codes or tracebacks", and use truncation
  notices to steer the agent toward targeted follow-up calls.
- **Claude Code Bash limits** (https://code.claude.com/docs/en/tools-reference; env-vars page):
  a valid result is kept "inline up to roughly 30,000 characters". Past that, the output is saved
  to a file (truncated past 64 MiB) and Claude gets the path "plus a preview of up to the first
  2,000 characters". **A failing result is kept inline "up to roughly 10,000 characters; past
  that, a head-and-tail excerpt … with no file path".** Every non-zero exit counts as a failure
  except exit 1 from `grep`, `rg`, `find`, `diff`, `git diff` and similar. `BASH_MAX_OUTPUT_LENGTH`
  sets the read-back window (default 30,000, maximum 150,000). `bashOutputMaxChars` (v2.1.261+, up to
  128,000) sizes the inline limit. `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` defaults to 25,000.
  Hook output over 10,000 characters is saved to a file with a 2,000-character preview (from a
  search excerpt of https://code.claude.com/docs/en/hooks).
- **Context editing (API):** `clear_tool_uses_20250919` clears the oldest tool results past
  `trigger` (default 100,000 input tokens) and keeps the last 3 by default; options include
  `clear_at_least`, `exclude_tools` and `clear_tool_inputs`, behind the beta header
  `context-management-2025-06-27`. Clearing invalidates the prompt cache
  (https://platform.claude.com/docs/en/build-with-claude/context-editing). Anthropic measured a
  29% improvement from context editing alone, 39% with the memory tool, and an 84% cut in tokens
  on a 100-turn web-search evaluation (https://claude.com/blog/context-management, 2025-09-29).
- **Codex truncation** (source, `codex-rs/utils/string/src/truncate.rs`): middle truncation keeps
  head and tail on UTF-8 boundaries with the marker `…N tokens truncated…`, estimated at
  `APPROX_BYTES_PER_TOKEN = 4`. The budget comes from each model's `truncation_policy` (bytes or
  tokens), overridden by `tool_output_token_limit`, which the schema describes as "Token budget
  applied when storing tool/function outputs in the context manager". The default for Codex models
  was raised to 10k tokens in v0.60.0 (https://github.com/openai/codex/issues/7867, 2025-12). The
  current per-model default for gpt-6.1-sol is unverified. MCP tools also take a per-tool
  `mcp_servers.<id>.tools.<tool>.output_token_limit`
  (https://learn.chatgpt.com/docs/config-file/config-reference). The older limit was line-based
  (256 lines or 10 KB) and lost tails (https://github.com/openai/codex/pull/6476).
- **Share of context taken by tool output:** "The Complexity Trap" reports that "observation
  tokens make up around 84% of an average SWE-agent turn" in preliminary SWE-bench Lite-50 runs.
  Simple observation masking roughly halves cost and matches LLM summarization
  (https://arxiv.org/abs/2508.21433; figures differ between v1 and v3, from a search excerpt).
- **Tokens per character for logs:** we found no published measurement for logs. The only hard
  constant is Codex's 4 bytes per token heuristic. ANSI-escape overhead is unmeasured, so we
  should measure it with the provider's token counter.

## Design principles extracted

1. **Verdict first, in one line, from one authoritative source.** Print counts and pass or fail,
   derived from the exit code, before anything else. This follows the `BuildFinished` exit code and
   `last_message` in BEP, Nx `summary` ("run counts"), alchemy-test's closing count, and
   vitest-agent's counts frame.
2. **Silence on success, detail only on failure.** Vitest `minimal`, Bun quiet mode, oxlint
   `agent`, alchemy-test ("Passing tests stay silent") and Jest `summary` (96% less output) all
   do this.
3. **Fit the failure path inside 10k characters.** Claude Code gives a failing command only about
   10,000 characters, as a head-and-tail excerpt with no file path, and Codex also cuts the middle
   (`…N tokens truncated…`). The verdict and failure index must sit at the head and be repeated
   at the tail, never in the middle.
4. **Point to the full log by path, with its size.** Nx names "the file on disk that holds its
   full output", alchemy-test prints the log path with line count and size, and Claude Code itself
   spills large output to a file with a 2,000-character preview. "The console is the summary; the
   log is the record."
5. **Bound output size by design, not by the amount tasks logged.** Nx `summary` is explicitly
   size-independent. Biome defaults `--max-diagnostics` to 20, vitest-agent caps its stderr summary
   at 15 lines with "… N more", and GitHub caps annotations at 10 per level per step.
6. **One line per diagnostic, keyed on stable codes.** Use the oxlint `agent` line shape
   (`file:line:col: severity rule: message help: …`) and match TypeScript diagnostics on TS codes,
   not wording. Use Bun's `<error file line column code>` block where source context matters.
7. **Detect agents with `AI_AGENT` first, then the std-env table, and set variables for child
   tools too.** Follow agents.md#136 semantics: any value except `0/false/no/off` means an agent,
   the outermost agent wins, and the variable never authorizes anything. Because Bun and
   Playwright miss Codex, our wrapper should export `AGENT=1` to child processes. Always allow an
   explicit override flag.
8. **Strip ANSI, TUI and interactivity under agents.** Vitest disables watch and colour, Turbo
   `--json` disables the TUI and strips ANSI, Playwright skips opening a browser, and
   pytest-agent-digest forbids escape codes.
9. **Separate the console view from the machine record.** Write a versioned artifact (vitest-agent
   `run.json` with `$schema`, Turbo `--summarize`, BEP JSON file) and render the console from it.
   Treat the record as immutable, as CTRF does.
10. **Use two schemas: CTRF-shaped for tests, SARIF-shaped for diagnostics.** CTRF has flat tests,
    a closed status set, flakiness, attempt history and an `extra` namespace. SARIF has `ruleId`,
    `level`, regions and fingerprints. Our model should project losslessly to both, and to
    GitHub Checks annotations, which accept 50 per request, as a lossy sink.
11. **Classify against history, not just this run.** vitest-agent's
    `new-failure | persistent | flaky | recovered`, CTRF `insights` and `baseline`, and BEP's
    per-attempt `TestResult` all tell an agent whether a red is its own or inherited.
12. **End with an informative next step, not an order.** vitest-agent's footer names the tool to
    call next, Nx's `needs_input` lists the flags and an example command, and Anthropic recommends
    actionable errors and truncation notices that steer toward targeted follow-up calls. Nx's rule
    applies: "informative, not instructive".
