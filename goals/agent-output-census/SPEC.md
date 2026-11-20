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

### Each census run is one JSON file under standards/agent-output-census/runs, 2026-11-19

The baseline is a tracked standard other goals cite, so it sits beside the repository's other measured baselines. One file per run, named by the window end and the rule version, decoded by the baseline file schema; the command refuses to overwrite an existing file, so no run edits another's. The reproduction run is the first file.

Lane goals/agent-output-census-library

Reverse: Move the run files and update the command's default directory.

### Chars-per-token samples are API calls inside the window, 2026-11-19

The reference run fitted 9,038 samples because it sampled every call in its modification-time file set, including 2,316 calls from before the window start. The census samples calls inside the window only: 6,704 on the reproduction run. It also treats a user message whose content is a plain string as a text entry that breaks a sample, as the reference did. The fitted density is 2.297 chars per token against the reference's 2.281, inside the 0.05 tolerance, and the binned medians agree (2.22 to 2.27). The sample count is therefore not compared against the reference.

Lane goals/agent-output-census-library

Reverse: Sample every call in each scanned file up to the window end and accept a sample count that depends on file history.

### The census command takes --baseline-dir for the directory --write-baseline writes to, 2026-11-19

The default stays standards/agent-output-census/runs under the repository root. The flag lets the render test write a run into a temporary directory, and lets an operator record a run outside the checkout, without changing the default. The write opens with the exclusive-create flag, so a second run for the same window end and rule version fails and leaves the first file untouched.

Lane goals/agent-output-census-library

Reverse: Remove the flag and always write under standards/agent-output-census/runs at the repository root.

### Compaction boundaries count context resets inside the window, 2026-11-19

The audit's figure of 104 boundaries came from a count that did not survive; neither the scripts nor the summary hold it. The census counts what its carried-cost flush honours: a compact_boundary system record, or a compacted summary that does not immediately follow one, inside the window. That is 113 on the reproduction run (72 compact_boundary records plus 41 summaries that open a resumed context). The flush rule itself is the reference's: carried char-turns over all Claude tool output match within 0.01% (16.730B against 16.729B).

Lane goals/agent-output-census-library

Reverse: Count compact_boundary system records only and accept that a context resumed from a summary is not counted.

### A file is scanned when one of its own timestamps falls inside the window, 2026-11-19

This amends the selection rule in reproduction-window. The reference run counted 342 Claude files: every file whose modification time was inside the window when it ran. That set cannot be rebuilt later. The harness appends untimestamped records to old transcripts, so a file can be modified without gaining a record in the window; on 2026-11-19, 870 files had a modification time at or after the window start and 780 also started before its end. The census counts a file as scanned when one of its own record timestamps falls inside the window: 226 files on the reproduction run. Active contexts, the count the audit's tables rest on, match exactly (223: 127 sessions, 96 subagents). The modification time is still the walk's pre-filter, and a file with no timestamp in the window contributes nothing.

Lane goals/agent-output-census-library

Reverse: Count every file whose modification time is at or after the window start, and accept a count that grows as old files are touched.

### Filter habits are read from the whole command, not its first 600 characters, 2026-11-19

The reference measured filter habits on its verification capture, which stored each command cut to its first 600 characters; 2,009 of the 4,404 Yeet commands and 2,013 of the 4,162 test commands reached the cut. Re-running the reference's pipe patterns over that capture reproduces the audit's shares exactly (Yeet: tail 42.3%, head 22.1%, grep 45.0%). The census reads the whole command, so the tail, head and grep shares rise: Yeet 56.2%, 32.8% and 54.9%. Run counts per kind and the unfiltered share, which the reference already computed on the whole command, match (Yeet 4,404 runs, 3.7% unfiltered against 4%). The census numbers are the corrected baseline; the audit's pipe shares undercount.

Lane goals/agent-output-census-library

Reverse: Truncate each verification command to 600 characters before matching the tail, head and grep pipes.

### The census lives in four flat modules of @beep/repo-ai-metrics and runs as beep ai-metrics census, 2026-11-19

The library's sources are flat kebab-case modules, so the census follows: census-report.ts (the agent-output-census/v1 report and baseline file schemas), census-rules.ts (the closed class domains with each member's matching rule and the rule version), census-projection.ts (the in-memory projection of one record into calls, results and usage, internal), and census.ts (the Census Context.Service contract and its layer). The command is census under the existing ai-metrics group, with --since and --until for the window, --claude-root, --codex-root and --repository for selection, --json for the encoded report, and --write-baseline to add the run's file.

Lane goals/agent-output-census-library

Reverse: Move the census into its own tooling library and re-point the command.

### The named repeat offenders are measured by written rules, and the JSON envelope rule names the audit's three envelopes, 2026-11-19

The audit's offender figures came from ad-hoc queries that did not survive. The census writes each rule into census-rules. On the reproduction run: TS6305 lines (an error TS6305 line in check, lint or quality output) number 819 against the audit's 701, a 4.5% share of those kinds against 5.1%; test verdict lines (a Test Files or Tests line reporting passes) number 3,782 against 3,206; gate-table rows repeated in the same context are 3.3% of Yeet output against about 6%; global-flag help sections are 2.0% against at least 2%. Counting variants over the reference capture (any TS6305 mention, per-output dedupe, untrimmed lines, Claude only, Tests lines only, any later poll, repeats by pull request number) give 833, 842, 3,774, 3,567 and 2,564, or 8.4% to 9.1%, so none reproduce the prose figures. The JSON envelope rule is narrowed to the three envelopes the audit names: a bracketed tag before a JSON object, and the monitor submission envelope that opens with schemaVersion. That gives 7.3% of Yeet output against about 8%. The wider pattern also caught unrelated JSON lines and gave 13.7%.

Lane goals/agent-output-census-library

Reverse: Drop the offender rows from the report and cite the audit's prose figures.

### The census ships as one pull request, not a library PR followed by a command PR, 2026-11-19

The plan named two pull requests. In goals/gate-report-core three stacked lanes over squash merges each cost a wall of add/add conflicts and a regeneration pass, and a final waited hours at the merge gate; the command PR would wait on the library PR the same way. The library has no consumer but the command, the change is a single tooling library plus one command group, and the reproduction run is what proves both. One PR carries P1 to P4 and the closeout.

Lane goals/agent-output-census-library

Reverse: Split the branch at the library boundary and open the command as a second PR stacked on the first.

### The surviving audit scripts are the method reference, and their rules move into the class domain unchanged, 2026-11-19

The scripts that produced the 2026-11-18 tables survive in the authoring session's scratch directory: a first pass that attributes tool results, carried cost and the calibration samples; a second pass that classifies turns; and a pass over the captured verification output that measures filter habits and line classes. They are not tracked and are not copied into the repository. The census ports their behaviour: the first-match command rules, the filter rule, the verification set, the turn rules, the shell-prefix stripping used for re-run detection, the redirect-target extraction used for log digs, and the line-class rules, all under the rule version census-rules/2026-11-18. The full-precision numbers that run wrote (calls, token totals, 127 sessions, 96 subagents, 32 Codex sessions, 9,038 calibration samples) are the comparison target in P4 beside the audit's rounded tables. Where the audit's prose and the scripts differ, the scripts win, because they made the numbers.

Lane goals/agent-output-census-library

Reverse: Rewrite the class rules from the audit's prose and re-attribute every row that moves.

### A transcript belongs to the repository by its Claude project directory name or its Codex session working directory, 2026-11-19

Claude: every directory under the Claude projects root whose name contains the repository name (beep-effect), walked three levels deep, skipping tool-results directories, taking every .jsonl file. A file is a subagent context when its path has a subagents directory or its name starts with agent-. Codex: every .jsonl file under the Codex sessions root whose first session_meta record has a working directory, or a runtime workspace root, containing the repository name; a file whose first records are not a match is abandoned after six records. Both rules are part of the rule version. The repository name is a flag with the reference value as its default, and roots default to the harnesses' own directories, printed with a tilde.

Lane goals/agent-output-census-library

Reverse: Match on a recorded working directory for both harnesses instead of the project directory name.

### The reproduction window is 2026-11-11T11:56:00Z to 2026-11-18T11:57:45Z, 2026-11-19

The reference run took its cutoff as seven days before it started and had no upper bound. Its summary was written at 2026-11-18T11:57:57Z and the latest record it counted is 2026-11-18T11:57:44Z, so it started within a few minutes before that, and its cutoff fell near 2026-11-11T11:56Z. The earliest record it counted is 2026-11-12T18:58Z, so any start between those points selects the same Claude records. The census takes the window as two explicit timestamps. A record belongs to the window when its timestamp is within both bounds; a record with no timestamp takes the time of the record before it in the same file, so an append after the window end is never counted. A file is opened when its modification time is at or after the window start, and reading stops once its first timestamped record is after the window end. Opening is not counting: the reported files-scanned count is the files with a record timestamp inside the window, as files-scanned-counts-files-touching-the-window records, and a file opened without one contributes nothing. Codex token totals take the last token-count record at or before the window end, where the reference took the last one in the file.

Lane goals/agent-output-census-library

Reverse: Pin a different pair of timestamps and re-run the reproduction.

### Review findings that would change the reference method are declined under this rule version, 2026-11-20

Review of the final pull request raised four changes to what the census measures. Each is declined for rule version census-rules/2026-11-18, because the surviving scripts are the method and the first baseline was recorded under it. One: re-run detection is not cleared at a compaction marker; the turn pass has no notion of compaction, and a re-run with no edit since is redundant work whether or not the earlier output is still in context. Two: each output line is measured with its separator, so a result with no trailing newline sums to one character more than its length, and the ansi and turbo-prefix classes overlap the exclusive classes as the class domain documents; the excess is at most one character per result, under 0.1 percent of verification output. Three: a Codex file is abandoned at the seventh record with no session_meta, not the sixth, as the reference did. Four: a Codex custom tool call is a shell call; Codex batches its shell commands inside one custom call, so excluding them would drop most Codex shell output. The same review's other findings were fixed, and none moves a number on the reproduction window: a message counts once on the call clock, a record after the window end never replaces usage counted inside it, each file is staged and merged only when read and inside the window, stat and listing failures are counted as unreadable, and a root that cannot be inspected or is not a directory fails the census. The command also takes --repo-root, the directory the repository root is searched from for the default baseline directory.

Lane goals/agent-output-census-library

Reverse: Adopt the four changes together under a new rule version and record a new baseline run.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
