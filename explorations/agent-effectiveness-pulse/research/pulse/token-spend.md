# Token Spend Pulse

Data snapshots: Claude Code `2026-07-14T05:21:56Z`; Codex
`2026-07-14T05:22:24Z`. This report exports only structural aggregates, model
names, token counts, dates, and the minimum file identifiers needed to verify
the Codex cumulative-counter rule. No prompt, response, reasoning, tool input,
or recorded session command was extracted.

## Headline — who eats the tokens

Across the available source window, the two harnesses recorded **53,260,359,700
tokens**. Codex accounts for **29,201,667,796 (54.83%)** and Claude Code for
**24,058,691,904 (45.17%)**. These are comparable as traffic volume, not as
billing units: Codex's `cached_input_tokens` is a subset of `input_tokens`,
whereas Claude records cache reads and uncached input separately.

The model split is concentrated:

| Harness | Model | Sessions/messages | Recorded tokens | Share of combined |
| --- | --- | ---: | ---: | ---: |
| Codex | `gpt-5.5` | 1,232 sessions | 20,220,489,941 | 37.97% |
| Claude Code | `claude-opus-4-8` | 35,230 messages | 13,416,943,183 | 25.19% |
| Claude Code | `claude-fable-5` | 29,043 messages | 10,641,684,481 | 19.98% |
| Codex | `gpt-5.6-sol` | 303 sessions | 8,977,941,217 | 16.86% |
| Codex | `gpt-5.3-codex-spark` | 1 session | 2,285,030 | <0.01% |
| Codex | unattributed | 23 sessions | 951,608 | <0.01% |
| Claude Code | `claude-haiku-4-5-20251001` | 2 messages | 64,240 | <0.01% |

Claude's “recorded tokens” is
`input + output + cache_read + cache_creation`. Codex uses the recorded
`total_tokens`; its `reasoning_output_tokens` is reported separately below and
is not added again.

Canonical project totals combine nested package cwd values and named
worktrees with their owning `beep-effectN` checkout. The residual Codex
worktree/evaluation paths are kept separate.

| Project | Claude Code | Codex | Combined |
| --- | ---: | ---: | ---: |
| `beep-effect2` | 6,768,646,024 | 7,787,788,371 | 14,556,434,395 |
| `beep-effect6` | 2,871,543,681 | 9,540,774,078 | 12,412,317,759 |
| `beep-effect` | 5,018,624,110 | 7,373,941,730 | 12,392,565,840 |
| `beep-effect3` | 3,156,280,020 | 1,340,482,604 | 4,496,762,624 |
| `beep-effect7` | 2,128,324,180 | 981,221,263 | 3,109,545,443 |
| `beep-effect5` | 1,843,961,603 | 1,236,365,821 | 3,080,327,424 |
| `beep-effect9` | 1,300,199,490 | 240,509,471 | 1,540,708,961 |
| `beep-effect8` | 971,112,796 | 482,409,722 | 1,453,522,518 |
| other matching worktree/evaluation paths | 0 | 218,174,736 | 218,174,736 |

The largest model × harness × project cells are:

| Rank | Harness | Model | Project | Recorded tokens |
| ---: | --- | --- | --- | ---: |
| 1 | Codex | `gpt-5.5` | `beep-effect6` | 8,253,900,883 |
| 2 | Codex | `gpt-5.5` | `beep-effect` | 4,423,866,605 |
| 3 | Codex | `gpt-5.5` | `beep-effect2` | 3,997,723,786 |
| 4 | Codex | `gpt-5.6-sol` | `beep-effect2` | 3,789,879,616 |
| 5 | Claude Code | `claude-fable-5` | `beep-effect2` | 3,439,993,531 |
| 6 | Claude Code | `claude-opus-4-8` | `beep-effect2` | 3,328,652,493 |
| 7 | Codex | `gpt-5.6-sol` | `beep-effect` | 2,949,480,876 |
| 8 | Claude Code | `claude-opus-4-8` | `beep-effect3` | 2,670,206,485 |
| 9 | Claude Code | `claude-fable-5` | `beep-effect` | 2,637,694,415 |
| 10 | Claude Code | `claude-opus-4-8` | `beep-effect` | 2,380,929,695 |

No API-equivalent dollar estimate is reported. The observed model identifiers
do not all map confidently to current public API price-card SKUs, so applying
prices would introduce a fabricated precision. Actual marginal cash is
approximately **$0 on subscriptions**; any amortized subscription or operator
cost framing belongs to the operator.

## Monthly trend

| Harness | Month | Sessions/messages | Input | Cache read/cached input | Cache creation | Output | Reasoning output | Recorded total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Claude Code | 2026-06 | 20,689 messages | 6,665,056 | 7,511,441,326 | 139,145,892 | 44,762,580 | — | 7,702,014,854 |
| Claude Code | 2026-07 | 43,674 messages | 12,399,730 | 16,026,132,588 | 267,032,317 | 51,112,415 | — | 16,356,677,050 |
| Codex | 2026-06 | 489 sessions | 14,863,793,107 | 14,263,697,024 | — | 47,377,221 | 16,053,534 | 14,911,428,728 |
| Codex | 2026-07 | 1,070 sessions | 14,252,889,573 | 13,853,548,032 | — | 36,397,887 | 14,498,337 | 14,290,239,068 |

Combined recorded traffic is **22,613,443,582** in June and
**30,646,916,118** in July. These are partial, unequal windows rather than a
growth rate: Claude data starts `2026-06-14` and ends `2026-07-14`; July is
only through the snapshot date. Claude month is taken from each assistant
message timestamp. Codex month is taken from the session's `session_meta`
timestamp, then the last cumulative token event in that session is assigned
to that month.

Codex model movement is visible inside July: `gpt-5.5` contributes
5,309,061,213 tokens, `gpt-5.6-sol` 8,977,941,217,
`gpt-5.3-codex-spark` 2,285,030, and 951,608 are unattributed. June's
14,911,428,728 tokens are all attributed to `gpt-5.5`.

## Cache economics

The cache signal is strong in both harnesses, but the fields have different
semantics and therefore different formulas.

| Harness | Formula | Overall | 2026-06 | 2026-07 |
| --- | --- | ---: | ---: | ---: |
| Claude Code | `cache_read / (cache_read + input)` | 99.9191% | 99.9113% | 99.9227% |
| Codex | `cached_input / input` | 96.5675% | 95.9627% | 97.1982% |

Claude model ratios are 99.9208% for `claude-fable-5`, 99.9177% for
`claude-opus-4-8`, and 0% for the two-message Haiku sample. Codex ratios are
95.9477% for `gpt-5.5`, 97.9610% for `gpt-5.6-sol`, and 95.7236% for the
single `gpt-5.3-codex-spark` session. The 23 unattributed Codex sessions expose
only 951,608 total tokens, so no cache ratio can be computed for them.

Raw component totals:

| Harness | Input | Cached/cache read | Cache creation | Output | Reasoning output | Recorded total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Claude Code | 19,064,786 | 23,537,573,914 | 406,178,209 | 95,874,995 | — | 24,058,691,904 |
| Codex | 29,116,682,680 | 28,117,245,056 | — | 83,775,108 | 30,551,871 | 29,201,667,796 |

The ratios are prompt-cache discipline indicators, not direct savings
estimates. Cache creation, read, and ordinary input may have different prices,
and subscription usage does not expose a per-call cash charge here.

## Reproducible commands

All extraction was line-streamed and whitelisted structural fields only. The
active DuckDB file was never opened.

Claude safe structural stream (the first TSV field is the project directory):

```sh
find ~/.claude/projects -mindepth 2 -maxdepth 2 -type f \
  -path '*beep*/*.jsonl' -print0 |
xargs -0 jq -r '
  select(.message?.role == "assistant" and (.message.usage? | type == "object"))
  | [input_filename | split("/")[-2], .timestamp[0:7], .message.model,
     (.message.usage.input_tokens // 0),
     (.message.usage.output_tokens // 0),
     (.message.usage.cache_read_input_tokens // 0),
     (.message.usage.cache_creation_input_tokens // 0)]
  | @tsv'
```

Group the TSV by directory/model/month and sum fields 4–7. The Claude cache
ratio is field 6 divided by fields 6 + 4.

Codex safe per-file reducer (it retains only metadata, current model, and the
last cumulative token object):

```sh
find ~/.codex/sessions/2026/06 ~/.codex/sessions/2026/07 \
  -type f -name '*.jsonl' -print0 |
while IFS= read -r -d '' file; do
  jq -nrc --arg file "$file" '
    reduce inputs as $r
      ({cwd:null, month:null, model:null, last:null};
       if $r.type == "session_meta" then
         .cwd = $r.payload.cwd | .month = $r.payload.timestamp[0:7]
       elif $r.type == "turn_context" then
         .model = $r.payload.model
       elif ($r.type == "event_msg" and
             $r.payload.type == "token_count" and
             $r.payload.info.total_token_usage != null) then
         .last = ($r.payload.info.total_token_usage + {model:.model})
       else . end)
    | select(.cwd != null and (.cwd | contains("beep-effect")))
    | select(.last != null)
    | [$file, .month, (.last.model // "(unattributed)"),
       (.last.input_tokens // 0), (.last.cached_input_tokens // 0),
       (.last.output_tokens // 0),
       (.last.reasoning_output_tokens // 0), (.last.total_tokens // 0)]
    | @tsv' "$file"
done
```

Group that TSV by month/model and sum fields 4–8. Codex's cache ratio is field
5 divided by field 4. Project grouping used the first cwd path component
matching `beep-effect` plus optional digits; separate `beep-effect-worktrees`
and evaluation cwd values were placed in the residual row.

The cumulative-counter rule was checked before aggregation against three
concrete rollouts. The first/middle/last `total_tokens` samples were:

| Session file | Token events | First | Middle | Last |
| --- | ---: | ---: | ---: | ---: |
| `2026/06/01/rollout-2026-06-01T17-21-24-019e8547-0469-7d71-8143-018ff602c08d.jsonl` | 9 | 25,741 | 151,499 | 310,758 |
| `2026/07/06/rollout-2026-07-06T00-35-15-019f35ec-6ef7-73e2-8aa4-6e7b7a562154.jsonl` | 42 | 23,446 | 1,802,472 | 5,502,072 |
| `2026/07/13/rollout-2026-07-13T23-45-29-019f5ef1-c1b2-7da2-85ec-b97241552b45.jsonl` | 17 | 23,706 | 340,387 | 774,734 |

All three samples were monotone and their last event was the maximum. Across
all 1,559 matching sessions with usage, the last event was the maximum in
every file. Two sessions did contain internal decreases—one decrease in a
276-event June 18 file and 50 decreases in a 917-event July 6 file—but both
later reached their maximum at the final event. This verifies “take the last
event per file” while avoiding the stronger, false claim that every cumulative
sequence is strictly monotone. No matching session changed model within its
`turn_context` records.

`bunx ccusage@latest --help` was attempted as the requested Claude cross-check
and failed immediately with `Unexpected accessing temporary directory`.
Because redirecting its installer/cache would write additional files, no
second attempt was made; the ccusage comparison is therefore skipped.

## Limitations

- Claude scan scope was every direct `*.jsonl` file under all 23 directories
  matching `~/.claude/projects/*beep*/`: **194 files**, **427,706,398 bytes**,
  **157,221 lines**, and **64,363 assistant messages with usage**, spanning
  `2026-06-14T05:58:16Z` through `2026-07-14T05:17:44Z`. There were no
  malformed lines, missing usage objects, or unreadable files. Directory/file
  counts were: `beep-effect` 51; its named worktree 1; its fixture and tmp
  directories 0 each; `beep-effect2` 36; its five named worktrees 2/2/1/2/1;
  its two nested package directories 0/0; `beep-effect3` 16; its atlas and
  evaluation-output directories 0/0; its scratchpad directory 1;
  `beep-effect5` 17 and nested form directory 0; `beep-effect6` 25;
  `beep-effect7` 23 and nested dependency directory 0; `beep-effect8` 7; and
  `beep-effect9` 9.
- Codex scan scope was every recursive `*.jsonl` file under
  `~/.codex/sessions/2026/06` and `2026/07`: **2,099 files**,
  **2,892,604,514 bytes**, and **1,239,611 lines**. The
  `session_meta.cwd` filter retained 1,588 sessions containing `beep-effect`;
  1,559 had token events, 29 did not, and 511 files were excluded by cwd.
  No file was unreadable. One malformed line was skipped in
  `2026/06/04/rollout-2026-06-04T20-36-23-019e956c-9a3a-7872-82a9-81045bfa3760.jsonl`.
- Twenty-three Codex sessions with usage had no usable preceding
  `turn_context.model`; their 951,608 recorded total tokens remain explicitly
  unattributed. Component fields were absent/zero, so they are excluded from
  the Codex cache-ratio denominator. The 29 matching sessions without a token
  event contribute no token totals.
- Claude “project” is derived from its transcript directory. Codex “project”
  is derived from `session_meta.cwd`. Canonicalization joins nested cwd values
  and named worktrees to the owning checkout, which is suitable for fleet
  direction but intentionally suppresses task-level detail.
- The source window is only about one month on the Claude side, despite the
  requested approximately eight-week view. June and July are incomplete and
  should not be read as equal-duration monthly cohorts. The July Codex tree
  can also contain an active session at snapshot time.
- Per-message Claude usage sums can include provider-side accounting details
  that are not semantically identical to Codex's cumulative session counters.
  Cross-harness totals answer “where token traffic goes,” not exact relative
  compute or cost.
- No transcript text, session content, or recorded command was inspected for
  reporting, so this report cannot attribute spend to task class. Pricing is
  intentionally deferred for the model-mapping reason stated above.
