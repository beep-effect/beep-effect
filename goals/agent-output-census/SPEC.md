# Agent Output Census Spec

## Objective

Make the transcript census a repeatable command so every other goal is judged with the instrument
that set the baseline.

The 2026-11-18 baseline in `explorations/agent-verification-output/research/transcript-audit.md`
was produced by session-local scripts that no longer exist. This goal rebuilds that census as a
planned `census` subcommand of the repo CLI's `ai-metrics` group, backed by a new report in the
`@beep/repo-ai-metrics` library (`packages/tooling/library/ai-metrics`). It reads local Claude Code
and Codex transcripts for this repository's checkouts and prints aggregates only. A tracked
baseline holds the 2026-11-18 numbers and each later run. Ruling:
`explorations/agent-verification-output/DECISIONS.md`, entry
`census-is-the-acceptance-instrument`.

## Non-Goals

- Transcript text, command text, file names, session identifiers or absolute home paths in any
  output, tracked file or log (BRIEF no-go: no transcript text in any tracked file or command
  output).
- Sending census data anywhere. The census is local; it uses none of the library's forwarder, OTLP
  or mirror paths.
- Changing the existing intake pipeline (`transcript-page.ts`, `transcript-sweep.ts`,
  `transcript-intake.ts`, `transcript-discovery.ts`) beyond extracting a shared helper.
- A CI lane or required check. Transcripts exist only on workstations.
- Fixing what the census measures. Shell search-and-read output is a measured row here and a
  deferred problem elsewhere (decision `search-read-output`, `explorations/INBOX.md`).
- Transcripts of other repositories and harnesses other than Claude Code and Codex.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

What `@beep/repo-ai-metrics` already provides, verified for this spec:

| Module | Provides | Census use |
| --- | --- | --- |
| `src/transcript-page.ts` (`readTranscriptPage`, `TranscriptMetadata`, `TranscriptFrame`) | Bounded incremental read of one JSONL file. Each record becomes a metadata frame: kind (`session`, `message`, `tool-call`, `tool-result`, `usage`, `other`), hashed session, model and working directory, source time, token usage (input, output, cache read, cache write), and byte offsets. Never a prompt or tool payload. Lines over 262,144 bytes become `Rejected` frames. | Reuse the source literal, time parsing and usage projection. The metadata frames alone cannot classify a command. |
| `src/transcript-sweep.ts` (`runTranscriptSweep`, `TranscriptSweepReport`) | Fair processing of at most 32 declared sources per sweep, committing cursors to a SQLite journal. | Reference only. The census is a one-pass batch over a window, not an incremental intake. |
| `src/transcript-intake.ts` (`makeTranscriptIntakeJournal`) | Atomic page acceptance and cursors on an owned SQLite connection. | Not used. |
| `src/transcript-discovery.ts` (`makeTranscriptDiscovery`) | Streaming discovery under at most 8 declared roots. | Reference for root declaration and symlink exclusion. |
| `src/internal/source-event-time.ts` (`parseSourceEventTime`) | Strict timestamp parsing. | Reuse for the window filter. |
| `src/models.ts` (`ClaudeTranscriptLine`, `CodexTranscriptLine`, `AiMetricsTranscriptSource`) | Minimal external line shapes and the source literal. | Extend with the content blocks the census reads. |
| `src/privacy.ts` (`hashPrivateIdentifier`) | Salted hashing of private identifiers. | Reuse for in-memory joins only; no hash reaches the report. |

What the census adds (NET-NEW, per the MAP):

- A content projection that, in memory, joins each tool result to its tool call (Claude
  `tool_use`/`tool_result` blocks inside messages; Codex `function_call`/`function_call_output`
  records), classifies the command text into a closed class, measures the result in characters,
  and drops the text.
- Carried-cost accounting: result size times the later API calls in the same context before the
  next compaction boundary.
- Turn classification, filter-habit detection, line-class shares of verification output, and the
  chars-per-token regression, each as `transcript-audit.md` "Method" defines it.
- The report schemas, the census service, and the command.

Other surfaces:

- `packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts`: the `ai-metrics`
  command group that gains `census`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` and `Economics.schemas.ts`
  (`YEET_ECONOMICS_SCHEMA_VERSION`): reference for a census-shaped report command.
- `@beep/jsonl` (`packages/foundation/modeling/jsonl/src/Line.ts`): line reading, reused.
- The tracked baseline directory, one file per run. P0 settles its location; the default is
  the `agent-output-census` directory under the standards root.

## Constraints

- **Aggregates only.** The report is counts, sizes, shares and fitted constants. Every string
  field is a closed literal domain, an ISO date or timestamp, or the schema version. Transcript
  text and command text exist only inside the function that classifies them. The census never
  writes an intermediate file.
- **The method is the audit's method.** Corpus selection, tool-result attribution with first-match
  classes, carried cost with compaction boundaries honoured, chars per token by least squares over
  single-result calls above 3,000 characters, and turn accounting follow
  `transcript-audit.md` "Method". Where the audit names a class by example only, the census writes
  the rule down in its class domain, and a decision file records any rule that knowingly differs.
- **Closed domains.** Tool-output classes (CI logs, Yeet, CI status, quality, test, check, lint,
  docgen, build, turbo, install, other `beep`, `gh`, `git`, search/read, Read tool, other), filter
  habits (`tail`, `head`, `grep`, unfiltered, redirect to file), turn classes (run a verification
  command, dig through a captured log, fetch a CI log, re-run with no edit, edit, other) and line
  classes are `LiteralKit` domains. A compound command lands in its first matching class.
- **Honest corpus.** The corpus row (files scanned, contexts active in the window, sessions,
  subagents, Codex sessions, compaction boundaries) prints first. An empty corpus exits non-zero.
  A missing harness root is reported as absent, never as zero activity.
- **Bounded memory.** Files are streamed line by line; memory is bounded by the largest line, not
  the corpus. A line over the page reader's 262,144-byte bound is counted by size and class, not
  rejected.
- **Window and selection are explicit.** The window is two timestamps; records outside it are
  ignored by timestamp. Roots default to the harnesses' own transcript directories and are written
  in output with `~`. The repository match rule (Claude project directory name; Codex session
  working directory under a checkout) is part of the report's rule version.
- **Schema, then service, then implementation**, the repo's design order. The census is a
  `Context.Service` in `@beep/repo-ai-metrics`; the command only parses flags and renders. Effect
  modules are imported as `effect/<Module>` leaves; `effect/HashMap` and `effect/MutableHashMap`
  replace `Map`.
- **Package ceilings.** `@beep/repo-ai-metrics` is a tooling library and may depend on foundation
  and tooling libraries only (`standards/ARCHITECTURE.md`). `@beep/repo-cli` already depends on it.
- **Public repository.** Test fixtures are synthetic. A tracked baseline holds numbers only.

## Acceptance Criteria

- [ ] **AC1 Typed report.** An `agent-output-census/v1` report schema exists in
  `@beep/repo-ai-metrics` with the closed domains above. A test walks the schema and fails when any
  string field is not a literal domain, a date or the version.
- [ ] **AC2 Privacy.** A synthetic corpus plants canary strings in prompt text, command text, tool
  output, file paths under a fake home directory and session identifiers. The text output, the
  `--json` output and the written baseline file contain none of them, and contain no home-directory prefix or
  `/Users/` path.
- [ ] **AC3 The tables.** The text output prints, in the audit's order: corpus and totals by harness
  (API calls, context tokens read, tool output characters); where tool output goes (characters,
  share of tool output, carried char-turns, share of context read) by class; verification output by
  kind; filter habits by kind; turn classes with the log-dig follow-up distribution; line classes of
  verification output with the named offenders (TS6305 lines, JSON envelopes, `--help` boilerplate,
  gate-table repeats, `Tests N passed` lines); chars per token with slope, intercept and sample
  count. `--json` prints the same report value encoded.
- [ ] **AC4 Reproduction.** On the 2026-11-18 window pinned in P0, the census matches
  `transcript-audit.md` within tolerance: corpus counts (342 Claude files, 223 active contexts, 32
  Codex sessions) and character and call totals within 2% relative; every share within 1.5
  percentage points; chars per token within 0.05 of 2.28. A row outside tolerance is traced to a
  named rule difference recorded in a decision file.
- [ ] **AC5 Baseline file.** The tracked baseline directory holds the reproduction run with its
  window, rule version and numbers, and decodes with the report schema. A later run adds its own
  file; no run edits another's.
- [ ] **AC6 Headline rows.** The report names the rows other goals cite: share of verification runs
  piped through a filter, log digs per verification run, verification characters per run by kind,
  and turns per verdict (the run turn plus its dig, CI-fetch and no-edit re-run turns).
- [ ] **AC7 Oversized lines.** A fixture line larger than 262,144 bytes is counted by size and
  class.
- [ ] **AC8 Packages verified.** `bun run beep quality package-verify` passes for
  `@beep/repo-ai-metrics` and `@beep/repo-cli`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/agent-output-census/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/agent-output-census/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/agent-output-census` | Passes |
| AC1, AC2, AC7 | Census schema and fixture tests in `@beep/repo-ai-metrics` | Pass |
| AC3, AC6 | Command render test in `@beep/repo-cli` over the fixture corpus | Passes |
| AC4 | The planned `census` command on the pinned window, compared row by row with `transcript-audit.md`; comparison written to `history/` | Within tolerance or each miss attributed |
| AC5 | Baseline file decodes with the report schema | Passes |
| AC8 | `bun run beep quality package-verify @beep/repo-ai-metrics` and `@beep/repo-cli` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add agent-output-census --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug agent-output-census`; add a `kind: decision` file there, never edit this block._

### The census is the acceptance instrument and emits aggregates only, 2026-11-18

The transcript census becomes a repeatable command on the repo CLI. Its 2026-11-18 numbers are the baseline, and each sibling goal's acceptance names the census rows it moves. Transcripts are private and the repository is public, so the command and every tracked file it writes carry counts, sizes and shares only, never transcript text. Ruling: explorations/agent-verification-output/DECISIONS.md, entry census-is-the-acceptance-instrument.

Reverse: Delete the census command and judge goals by output-size fixtures alone

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
