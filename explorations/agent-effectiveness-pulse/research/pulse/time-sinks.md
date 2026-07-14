# Agent wall-clock time sinks

Data captured 2026-07-14. All dates and week boundaries below are UTC.

## Headline

Across 1,776 usable beep-effect fleet sessions, the two harnesses account for
an estimated **856.2 agent-active hours** after removing gaps longer than five
minutes. Codex accounts for the majority: **611.9 hours (71.5%)**, versus
Claude Code's **244.3 hours (28.5%)**.

The distribution is dominated by its long tail, not the typical session. The
harness-specific top decile accounts for **56.8% of Claude active time** and
**71.6% of Codex active time**. Branch attribution is coarse: `other` holds
589.8 hours (68.9% of all active time), while `feat` holds 242.8 hours (28.4%).
Because `other` includes default, detached, missing, and non-canonical branch
names, this is an attribution finding rather than an activity classification.

The combined median session is 6.5 minutes, p90 is 46.3 minutes, and p99 is
7.9 hours. In other words, a small population of multi-hour sessions consumes
most measured agent time.

## Methodology

- Claude input: all 194 files matching
  `~/.claude/projects/*beep*/*.jsonl`; 190 contained timestamps and were
  usable.
- Codex input: all 2,098 rollout JSONL files under
  `~/.codex/sessions/2026/{06,07}`; 1,586 had a `session_meta.cwd` containing
  `beep-effect`, 511 were out of scope, and one malformed file was skipped.
- Each JSONL file was read one line at a time. Only timestamps, record count,
  model name, cwd/project family, and branch were retained. Prompt, response,
  reasoning, command, and tool-result content was never exported.
- Timestamps were sorted within each session before gap analysis. This was
  necessary because Claude files contained 3,921 timestamp regressions caused
  by record emission order. Only the scalar timestamps were buffered.
- Span is earliest through latest timestamp. An adjacent gap strictly greater
  than 300 seconds is wholly idle; active time is the sum of the remaining
  gaps, equivalently span minus those idle gaps.
- Claude branch is the most frequent non-empty `.gitBranch` in the file
  (lexicographic tie-break). Codex branch comes from `session_meta.payload.git`.
  Branches map to `feat`, `fix`, `goals`, `chore`, or `other` by prefix.
- Project directories are privacy-normalized to the repository family
  (`beep-effect`, `beep-effect2`, and so on), folding worktrees and nested cwd
  variants into their parent fleet project.
- Percentiles use linear interpolation over session active seconds. Weekly
  totals split each active interval at Monday UTC boundaries rather than
  assigning an entire session to its start week.
- No sampling was used, and
  `.beep/ai-metrics/derived/ai-metrics.duckdb` was not opened.

## Distributions by project dir

Percentiles are active minutes per session.

| Harness | Project dir | Sessions | Active hours | p50 min | p90 min | p99 min |
|---|---|---:|---:|---:|---:|---:|
| Claude | `beep-effect` | 51 | 51.0 | 13.2 | 167.7 | 561.6 |
| Claude | `beep-effect2` | 41 | 72.0 | 37.7 | 271.0 | 662.9 |
| Claude | `beep-effect3` | 17 | 32.8 | 65.5 | 369.7 | 545.7 |
| Claude | `beep-effect5` | 17 | 20.4 | 15.4 | 273.2 | 384.5 |
| Claude | `beep-effect6` | 25 | 20.8 | 0.8 | 187.3 | 394.4 |
| Claude | `beep-effect7` | 23 | 22.0 | 11.5 | 128.0 | 486.0 |
| Claude | `beep-effect8` | 7 | 10.7 | 6.9 | 238.3 | 432.7 |
| Claude | `beep-effect9` | 9 | 14.5 | 41.6 | 316.1 | 406.6 |
| Codex | `beep-effect` | 466 | 170.3 | 5.1 | 34.1 | 343.9 |
| Codex | `beep-effect2` | 543 | 186.4 | 8.6 | 25.0 | 318.9 |
| Codex | `beep-effect3` | 85 | 61.5 | 7.7 | 97.5 | 438.5 |
| Codex | `beep-effect5` | 57 | 51.7 | 8.4 | 126.7 | 684.7 |
| Codex | `beep-effect6` | 273 | 84.4 | 3.9 | 12.0 | 480.6 |
| Codex | `beep-effect7` | 80 | 33.1 | 7.4 | 37.0 | 295.7 |
| Codex | `beep-effect8` | 47 | 15.5 | 14.1 | 42.5 | 56.2 |
| Codex | `beep-effect9` | 35 | 9.0 | 7.7 | 17.8 | 162.7 |

`beep-effect2` is the largest project family by combined active time (258.4
hours), followed by `beep-effect` (221.3 hours) and `beep-effect6` (105.2
hours). The most extreme Codex project tail is `beep-effect5` at p99 11.4
hours; the largest Claude project p99 is `beep-effect2` at 11.0 hours.

## Distributions by branch prefix

Percentiles are active minutes per session. A zero-session Claude `goals` row
is retained to make the canonical prefix set explicit.

| Harness | Branch prefix | Sessions | Active hours | p50 min | p90 min | p99 min |
|---|---|---:|---:|---:|---:|---:|
| Claude | `feat` | 45 | 92.0 | 38.9 | 409.7 | 735.7 |
| Claude | `fix` | 1 | 0.8 | 47.2 | 47.2 | 47.2 |
| Claude | `goals` | 0 | 0.0 | — | — | — |
| Claude | `chore` | 9 | 10.8 | 13.2 | 154.2 | 369.4 |
| Claude | `other` | 135 | 140.7 | 15.4 | 177.9 | 552.1 |
| Codex | `feat` | 526 | 150.8 | 9.2 | 27.5 | 205.6 |
| Codex | `fix` | 7 | 0.6 | 5.4 | 8.4 | 9.3 |
| Codex | `goals` | 3 | 3.1 | 41.9 | 117.3 | 134.3 |
| Codex | `chore` | 11 | 8.3 | 5.8 | 117.8 | 273.8 |
| Codex | `other` | 1,039 | 449.1 | 5.4 | 37.5 | 456.8 |

Claude `feat` sessions are much longer at the center and tail than Claude
`other` sessions, but the larger `other` population still contributes more
Claude hours. Codex is more sharply concentrated in `other`: 449.1 of 611.9
hours (73.4%).

## Top-10 longest active sessions

Claude Code only, as requested. The table contains no session identifiers,
project paths, branch names, or transcript content. Duration is active time
after removing idle gaps; message count is the number of valid JSONL records.

| Rank | Branch prefix | Date | Active duration | Message count |
|---:|---|---|---:|---:|
| 1 | `feat` | 2026-07-06 | 12.4 h | 6,345 |
| 2 | `feat` | 2026-07-05 | 12.1 h | 7,798 |
| 3 | `other` | 2026-07-08 | 9.6 h | 6,183 |
| 4 | `other` | 2026-06-21 | 9.3 h | 5,309 |
| 5 | `other` | 2026-06-17 | 9.0 h | 5,305 |
| 6 | `other` | 2026-07-07 | 8.7 h | 5,100 |
| 7 | `other` | 2026-07-07 | 8.0 h | 6,203 |
| 8 | `feat` | 2026-07-09 | 7.6 h | 5,075 |
| 9 | `feat` | 2026-07-12 | 7.1 h | 7,403 |
| 10 | `feat` | 2026-07-08 | 6.9 h | 4,602 |

## Claude vs Codex comparison

| Harness | Sessions | Active hours | Raw span hours | Idle removed | p50 active | p90 active | p99 active | Maximum |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Claude | 190 | 244.3 | 1,523.5 | 84.0% | 23.1 min | 4.4 h | 9.9 h | 12.4 h |
| Codex | 1,586 | 611.9 | 1,267.3 | 51.7% | 6.2 min | 31.2 min | 7.0 h | 20.3 h |

Codex produces 8.3 times as many matching sessions and shorter typical
sessions, yet its p99 remains multi-hour and its maximum exceeds Claude's.
Claude sessions are fewer and much longer at p50 and p90. The higher Claude
idle fraction indicates that Claude transcript files more often span long
dormant periods; it does not establish that one harness is intrinsically more
or less efficient.

Observed dominant per-session models were `claude-opus-4-8` (79 Claude
sessions), `claude-fable-5` (51), `gpt-5.5` (1,254 Codex sessions), and
`gpt-5.6-sol` (306). Model was absent or non-production/synthetic in the
remaining small set; no performance claim is inferred from this mix.

## Weekly trend (8 weeks, by harness)

Hours are sums of active intervals, so concurrent agents contribute
concurrently. The week beginning 2026-07-13 is partial through capture on
2026-07-14.

| Week starting | Claude hours | Codex hours | Combined hours |
|---|---:|---:|---:|
| 2026-05-25 | 0.0 | 0.0 | 0.0 |
| 2026-06-01 | 0.0 | 115.2 | 115.2 |
| 2026-06-08 | 1.9 | 98.6 | 100.5 |
| 2026-06-15 | 65.9 | 100.8 | 166.7 |
| 2026-06-22 | 5.2 | 3.5 | 8.7 |
| 2026-06-29 | 35.5 | 42.3 | 77.8 |
| 2026-07-06 | 131.0 | 224.5 | 355.5 |
| 2026-07-13 | 4.8 | 27.0 | 31.8 |

The week of 2026-07-06 dominates the window with 355.5 active hours, 41.5%
of the measured total. The 2026-06-22 trough is real in the available files,
but the May boundary is constrained by the requested Codex June–July scope.

## Long-tail concentration

Long-tail means sessions at or above each harness's p90 threshold.

| Harness | p90 threshold | Tail sessions | Tail active hours | Share of harness time |
|---|---:|---:|---:|---:|
| Claude | 4.4 h | 19 | 138.7 | 56.8% |
| Codex | 31.2 min | 159 | 438.3 | 71.6% |

For Claude, `feat` contributes 72.7 tail hours (52.4%), `other` 59.5 hours
(42.9%), and `chore` 6.6 hours (4.7%). The largest project concentrations are
`beep-effect2` at 40.1 hours (28.9% of the Claude tail), `beep-effect3` at
22.2 hours (16.0%), and `beep-effect` at 18.7 hours (13.5%).

For Codex, `other` contributes 352.9 tail hours (80.5%), `feat` 74.7 hours
(17.1%), `chore` 7.6 hours (1.7%), and `goals` 3.0 hours (0.7%). The largest
project concentrations are `beep-effect` at 129.7 hours (29.6%),
`beep-effect2` at 108.9 hours (24.8%), `beep-effect6` at 64.0 hours (14.6%),
and `beep-effect3` at 53.2 hours (12.1%).

Taken together, the two harness-specific top deciles contribute 577.0 hours,
or 67.4% of all measured active time. This is the principal time sink visible
without inspecting private session content.

## Reproducible commands

Candidate counts and byte volumes (these patterns cannot reach the DuckDB):

```sh
find ~/.claude/projects -mindepth 2 -maxdepth 2 -type f \
  -path '*beep*/*.jsonl' -printf '%s\n' |
awk '{n++; b+=$1} END {print n, b}'

find ~/.codex/sessions/2026/06 ~/.codex/sessions/2026/07 \
  -type f -name 'rollout-*.jsonl' -printf '%s\n' |
awk '{n++; b+=$1} END {print n, b}'
```

The core privacy-preserving reducer used for each file was equivalent to the
following. The production pass additionally grouped the emitted rows and
linearly interpolated p50/p90/p99; it never emitted `path`, cwd, full branch,
or any content field.

```python
import json
from collections import Counter
from datetime import datetime

def classify(branch):
    if not isinstance(branch, str):
        return "other"
    for prefix in ("feat", "fix", "goals", "chore"):
        if branch == prefix or branch.startswith((prefix + "/", prefix + "-")):
            return prefix
    return "other"

def epoch(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()

def reduce_jsonl(path, branch_field=False):
    timestamps, branches, records = [], Counter(), 0
    with open(path, encoding="utf-8") as stream:
        for line in stream:                 # JSONL is streamed
            record = json.loads(line)
            records += 1
            if isinstance(record.get("timestamp"), str):
                timestamps.append(epoch(record["timestamp"]))
            if branch_field and isinstance(record.get("gitBranch"), str):
                branches[record["gitBranch"]] += 1

    timestamps.sort()                       # scalar timestamps only
    gaps = [b - a for a, b in zip(timestamps, timestamps[1:])]
    span = timestamps[-1] - timestamps[0]
    idle = sum(gap for gap in gaps if gap > 300)
    active = sum(gap for gap in gaps if gap <= 300)
    branch = branches.most_common(1)[0][0] if branches else None
    return {"span_s": span, "idle_s": idle, "active_s": active,
            "records": records, "branch_prefix": classify(branch)}
```

Claude discovery used `glob('~/.claude/projects/*beep*/*.jsonl')`. Codex used
recursive globs under `sessions/2026/06` and `sessions/2026/07`, retaining a
file only when its `session_meta.payload.cwd` contained `beep-effect`.
`classify` returned `feat`, `fix`, `goals`, or `chore` only for an exact or
`/`/`-`-prefixed match, and `other` otherwise. Active intervals were split at
Monday UTC boundaries before weekly summation.

## Limitations

- The five-minute rule is a heuristic. Removing the whole gap can undercount
  unattended computation that produces no records for more than five minutes;
  retaining every shorter gap can overcount pauses under five minutes.
- Aggregate agent-active hours are additive across concurrent sessions and do
  not represent human attention or elapsed calendar time.
- Four Claude files had no usable timestamp and were skipped. One Codex file
  was malformed and skipped. The 511 well-formed Codex files with unrelated
  cwd values were filtered, not failures. No readable in-scope file was
  sampled out.
- Claude record timestamps were not always emitted monotonically. Sorting
  fixes negative/repeated gap attribution but discards emission-order
  semantics.
- Codex coverage is intentionally limited to June and July 2026. Therefore
  the zero Codex value in the week beginning 2026-05-25 is a scope boundary,
  not evidence of no fleet activity. The final week is partial.
- Project-family normalization folds worktrees and nested directories into a
  parent repo. It improves privacy and fleet attribution but hides differences
  between those execution contexts.
- Branch mode can misattribute a session that switched branches. `other` is
  especially heterogeneous, so it must not be treated as a task class.
- Message count means valid JSONL records, not conversational turns; the two
  harnesses record different event types and are not directly comparable on
  that field.
- Privacy constraints intentionally prevent activity-level characterization
  of the long sessions. The report can locate the tail by harness, project
  family, branch prefix, date, and duration, but cannot say what the agents
  were doing inside those sessions.
