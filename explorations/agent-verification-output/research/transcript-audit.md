# Transcript Audit: What Verification Output Costs

Dated 2026-11-18. Window: the seven days ending that morning. This is the
baseline the packet's work is measured against.

## Method

- **Corpus.** Claude Code transcripts (JSONL) for every project directory whose
  name contains `beep-effect`, subagent transcripts included, plus Codex
  rollout files whose session working directory is under a beep-effect
  checkout. Records older than the window were ignored by timestamp.
  342 Claude files were scanned; 223 contexts had activity in the window
  (127 sessions, 96 subagents). 32 Codex sessions matched.
- **Attribution.** Each tool result was joined to the tool call that produced
  it. Shell commands were classified by regular expression on the command
  text, first match wins: CI logs, Yeet, CI status, quality, test, check,
  lint, docgen, build, turbo, install, other `beep`, `gh`, `git`,
  search/read (`rg`, `grep`, `cat`, `sed`, `ls`, `find`, `jq`), other.
  A compound command lands in its first matching class.
- **Carried cost.** A tool result is re-read on every later API call until the
  context is compacted. Carried cost is result size multiplied by the number
  of later calls in the same context before the next compaction boundary
  (104 boundaries were present and honoured).
- **Chars per token.** Measured, not assumed: for each API call that followed
  exactly one tool result larger than 3,000 chars, context growth (input plus
  cache tokens, minus the previous call's output tokens) was regressed on
  result size. 9,038 samples.
- **Turn accounting.** A second pass classified each API call by what its tool
  calls did: ran a verification command, read a log file an earlier
  verification command had written, fetched a CI log, re-ran an identical
  verification command with no edit in between, edited, or other.

The scripts were session-local JavaScript and are not tracked. A repeatable
`beep` command for this census is a candidate deliverable (see the packet
`README.md`).

## Limits

- Classification is by command text. Codex numbers are rougher because Codex
  batches several shell commands inside one JavaScript tool call.
- Carried cost assumes a result stays in context until compaction. Any
  harness-side clearing of old tool results would lower it.
- Re-run detection requires the command text before the first pipe to match
  exactly, so it undercounts.

## Totals

| Harness | API calls | Context tokens read | Tool output received |
| --- | ---: | ---: | ---: |
| Claude sessions | 34,085 | 14.8B | 48.8M chars |
| Claude subagents | 16,793 | 6.4B | 42.3M chars |
| Codex | n/a | 524M input (516M cached) | 12.2M chars |

Claude contexts read 21.3B tokens across 51k calls, 418k tokens per call on
average. The twelve heaviest sessions peaked near 966k tokens of context and
ran 650 to 2,300 calls each.

Measured density: **2.28 chars per token** (least squares:
tokens = 127 + chars / 2.28; binned medians 2.21 to 2.27 from 3k to 20k+
chars). Tool output costs about 1.75 times what a 4-chars-per-token estimate
predicts.

## Where tool output goes (Claude, sessions plus subagents)

| Class | Chars | Share of tool output | Carried (char-turns) | Share of context read |
| --- | ---: | ---: | ---: | ---: |
| Shell search/read | 41.3M | 45% | 8.02B | 16.5% |
| Read tool | 13.7M | 15% | 2.21B | 4.6% |
| Verification, all kinds | 16.8M | 18% | 3.04B | 6.3% |
| `git` | 8.0M | 9% | 1.20B | 2.5% |
| All tool output | 91.1M | 100% | 16.73B | 34% |

Verification by kind (chars): Yeet 4.3M, test 3.7M, check 2.3M, lint 2.3M,
CI logs 1.1M, turbo 1.1M, quality 0.8M, CI status 0.8M, install 0.2M,
docgen 0.2M, build 0.05M. Tests are 22% of verification output and 1.4% of
context read.

Codex: verification output was 3.7M of 12.2M chars (30%).

## How agents already cope

| Kind | Runs | Piped to `tail` | `head` | `grep` | Unfiltered |
| --- | ---: | ---: | ---: | ---: | ---: |
| Yeet | 4,404 | 42% | 22% | 45% | 4% |
| Test | 4,162 | 21% | 37% | 36% | 6% |
| Check | 1,905 | 23% | 27% | 20% | 6% |
| Lint | 1,781 | 34% | 39% | 29% | 11% |
| Quality | 1,106 | 46% | 26% | 39% | 3% |
| CI logs | 805 | 15% | 68% | 62% | 0% |

The average verification result that reaches context is about 1k chars.
18% of runs redirect output to a file first.

## What the turns cost (Claude)

| Turn class | Turns | Share of turns | Share of context read |
| --- | ---: | ---: | ---: |
| Run a verification command | 10,117 | 19.9% | 21.6% |
| Dig through a captured log | 1,533 | 3.0% | 3.4% |
| Fetch a CI log | 747 | 1.5% | 1.6% |
| Re-run, no edit since | 132 | 0.3% | 0.3% |

9% of verification runs were followed by at least one log dig; 1% by three or
more; the worst case was eleven.

## What is in the output that survives filtering

Share of chars across all verification output (20.4M, Codex included):

| Line class | Share |
| --- | ---: |
| Lines carrying a failure keyword (error, FAIL, TS code, warning) | 28.9% |
| Unclassified | 60.4% |
| `zsh -ic` prompt-plugin noise | 2.7% |
| Script echo lines (`$ bun run ...`) | 2.5% |
| Exact repeats of an earlier line in the same output | 2.5% |
| Turbo banners, cache lines and task prefixes | 1.7% |
| Test-runner banners | 1.2% |

Prompt noise is 5.5% of check output and 9.6% of docgen output.

Specific repeat offenders, by share of their own class:

- `error TS6305: Output file ... has not been built from source file`:
  701 lines, 5.1% of check, lint and quality output. One root cause, unbuilt
  workspace dependencies in a fresh lane.
- Gate-table rows polled repeatedly: about 6% of Yeet output.
- Single-line JSON envelopes written to stdout (monitor job submit,
  `[beep-quality-task-lane-run]`, `[beep-github-check-run]`): about 8% of
  Yeet output.
- Global-flag boilerplate on every `--help`: at least 2% of Yeet output.
- `Tests N passed` and `Test Files N passed` lines appeared 3,206 times: the
  verdict the agent was looking for, found by guessing a filter.

## Reading

1. Raw bytes are already suppressed, by the agent, with a guessed filter. The
   packet's target is the guess, not the byte count.
2. A turn costs far more than the output it returns: 418k tokens re-read
   against roughly 440 tokens of new output. Anything that saves one
   follow-up turn pays for a great deal of output.
3. Verification is one fifth of all turns. The contract for what a gate
   prints is therefore one of the most-executed interfaces in the repo.
4. Three quarters of verification output is produced by the repo's own CLI.
