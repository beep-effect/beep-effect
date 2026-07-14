# Data-Source Feasibility Probe — tested extractors per mining lane

> Provenance: pre-exploration codex lane (GPT-5.6 Sol, medium effort,
> read-only; DuckDB opened `READ_ONLY`, no WAL created, no files modified),
> 2026-07-13. All commands below were executed live and their sample output
> verified.

Summary: all five lanes are feasible to some degree. Claude/Codex transcripts
are the richest sources; DuckDB has useful turn/session history but major
duplication and empty tool/model tables.

## (a) DuckDB — Verdict: partial

Database: `.beep/ai-metrics/derived/ai-metrics.duckdb`, 1,658,597,376 bytes.
Opened through the installed `@duckdb/node-api` package with
`{access_mode:"READ_ONLY"}`.

| Table | Rows | Key columns |
|---|---:|---|
| `ai_metrics_agent_tasks` | 677 | `agent_task_id`, `source_kind`, `source_path_hash`, timestamps |
| `ai_metrics_benchmark_cases` | 2 | case ID, prompt hash/ref, expected checks |
| `ai_metrics_benchmark_runs` | 3 | case/config IDs, `elapsed_ms`, `passed`, quality gate |
| `ai_metrics_ingest_runs` | 1,222 | start/end, file/archive/turn counts |
| `ai_metrics_model_calls` | 0 | provider, model, `total_tokens`, `latency_ms` |
| `ai_metrics_outcome_labels` | 2 | rating, passed, intervention count, follow-up fix |
| `ai_metrics_raw_archive_objects` | 6,120 | source/content hashes, archive path, encryption timestamp |
| `ai_metrics_schema_migrations` | 3 | migration ID, applied timestamp |
| `ai_metrics_scorecards` | 30 | total/outcome/flow/`cost_score`, task/label counts |
| `ai_metrics_sessions` | 6,120 | session/task IDs, source, started-at, parent/fork hashes |
| `ai_metrics_source_files` | 6,120 | line/event counts, timestamp range, source/session hashes |
| `ai_metrics_tool_invocations` | 0 | tool name, duration, exit code |
| `ai_metrics_turns` | 5,432,724 | session, event, `raw_event_hash`, timestamp, source path |

Tested read-only runner, from repo root:

```sh
DB=.beep/ai-metrics/derived/ai-metrics.duckdb SQL='SELECT ...' \
bun -e 'import {DuckDBInstance} from "@duckdb/node-api";
const d=await DuckDBInstance.create(process.env.DB,{access_mode:"READ_ONLY"});
const c=await d.connect();
console.log(JSON.stringify((await c.runAndReadAll(process.env.SQL)).getRowObjectsJson()));
c.closeSync(); d.closeSync();'
```

The five tested SQL queries:

```sql
-- 1. Deduplicated turn volume
SELECT CAST(date_trunc('day', try_cast(timestamp AS timestamp)) AS date) day_bucket,
       count(DISTINCT raw_event_hash) turns
FROM ai_metrics_turns
WHERE try_cast(timestamp AS timestamp) IS NOT NULL
GROUP BY 1 ORDER BY 1 DESC LIMIT 7;

-- 2. Tool frequency
SELECT tool_name, count(*) invocations, round(avg(duration_ms), 1) avg_ms
FROM ai_metrics_tool_invocations
GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20;

-- 3. Duration by canonical source path
WITH s AS (
  SELECT source_path_hash,
         date_diff('millisecond',
           min(try_cast(timestamp AS timestamp)),
           max(try_cast(timestamp AS timestamp))) duration_ms
  FROM ai_metrics_turns
  WHERE try_cast(timestamp AS timestamp) IS NOT NULL
  GROUP BY 1
)
SELECT count(*) source_sessions,
       round(quantile_cont(duration_ms, .5)/1000, 1) median_s,
       round(quantile_cont(duration_ms, .9)/1000, 1) p90_s,
       round(quantile_cont(duration_ms, .99)/1000, 1) p99_s
FROM s;

-- 4. Calls by model
SELECT provider, model, count(*) calls, sum(total_tokens) total_tokens,
       round(avg(latency_ms), 1) avg_latency_ms
FROM ai_metrics_model_calls
GROUP BY 1,2 ORDER BY 3 DESC;

-- 5. Discover token/cost fields
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE regexp_matches(lower(column_name), 'token|cost|price|usd')
ORDER BY 1,2;
```

Sample results:

```text
turns: 2026-06-08=143,023; 2026-06-07=17,805; 2026-06-06=47,205
duration: 671 source sessions; median=361.7s; p90=8,446.6s; p99=152,743.4s
tools: []
models: []
fields: model_calls.total_tokens; scorecards.cost_score
```

Gotchas:

- The 5.43M turn rows represent only 515,812 distinct event hashes and 671
  source paths across 1,222 ingest runs. Raw counts severely overstate
  volume — always dedup by `raw_event_hash`.
- Recorded timestamps span 2026-05-05 through 2026-06-08; the database is not
  current through July.
- `model_calls` and `tool_invocations` were never populated.
- No USD/price/raw-cost field exists. All 30 `cost_score` values equal `0.5`
  — a placeholder/default, not measured cost.

## (b) Claude Code transcripts — Verdict: rich

Measured 50 files totaling 88,859,275 bytes in
`~/.claude/projects/-home-elpresidank-YeeBois-projects-beep-effect/`. Two
files (19.8MB, 11.8MB) sampled with `head`/line-oriented `jq`.

Assistant records generally have:

```text
top level: type, timestamp, cwd, sessionId, gitBranch, message, ...
message: id, role, model, content[], usage, stop_reason, diagnostics, ...
content kinds: thinking, text, tool_use
usage: input_tokens, output_tokens, cache_read_input_tokens,
       cache_creation_input_tokens, service_tier, server_tool_use, ...
```

A tool call appears as a `message.content[]` element with:

```json
{"type":"tool_use","name":"Skill","input":{"skill":"...","args":"..."}}
```

Tool results appear later as user records containing `tool_result`. Model IDs
and ISO timestamps are present. Both sampled files had per-assistant-message
usage; sample models were `claude-fable-5` and `claude-opus-4-8`.

Tested all-file Skill counter:

```sh
jq -r '
  select(.message?.content? | type=="array")
  | .message.content[]
  | select(.type=="tool_use" and .name=="Skill")
  | (.input.skill // "(missing)")
' ~/.claude/projects/-home-elpresidank-YeeBois-projects-beep-effect/*.jsonl |
sort | uniq -c | sort -nr
```

Sample aggregate (main repo project dir only):

```text
38 total Skill calls across 15 names
9 grill-with-docs
6 reflect
5 yeet
3 explore
2 each: deep-research, cognee-memory:cognee-remember,
        codex:codex-cli-runtime, claude-in-chrome
```

Gotchas: transcripts contain prompts, responses, thinking, tool
inputs/results, commands, paths, and attachments. Mining must whitelist
structural fields, never export whole records. Stream; individual files
approach 20MB.

## (c) Codex home — Verdict: rich

`~/.codex/history.jsonl`: 7,237,830 bytes, 9,419 lines. Every sampled record
has only `session_id`, `ts` (epoch seconds), and `text` (sensitive user
text).

Tested safe history extraction:

```sh
head -n 3 ~/.codex/history.jsonl |
jq -c '{session_id,timestamp:(.ts|todateiso8601)}'
```

Sessions tree: ~5,781 JSONL files / 8.08GB, laid out as
`~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<session-id>.jsonl`.
Rollout records include `session_meta`, `turn_context`, `response_item`, and
`event_msg`. Tested sample extraction:

```sh
f=~/.codex/sessions/2026/07/01/rollout-2026-07-01T09-09-16-<session-id>.jsonl

jq -c 'select(.type=="session_meta") |
 {timestamp:.payload.timestamp,cwd:.payload.cwd,
  model_provider:.payload.model_provider,source:.payload.source}' "$f"

jq -c 'select(.type=="event_msg" and .payload.type=="token_count"
              and .payload.info!=null) |
 {timestamp,total:.payload.info.total_token_usage}' "$f" | tail -1

jq -r 'select(.type=="response_item" and .payload.type=="function_call") |
 .payload.name' "$f" | sort | uniq -c
```

Sample: cwd `/home/elpresidank/YeeBois/projects/beep-effect`; model `gpt-5.5`
in `turn_context`; token fields input / cached input / output / reasoning
output / total; 71 `exec_command` calls in the sampled session.

`exec_command` stores JSON-encoded arguments containing the full command and
workdir, so command mining is feasible; tested sanitization reduces commands
to verbs (`bun`, `git`, `rg`, `sed`).

Gotchas: `history.jsonl` cannot attribute cwd by itself — join through
`session_id` to rollout `session_meta`. Rollouts contain sensitive prompts,
outputs, reasoning, commands, patches, and possibly credentials echoed by
tools.

## (d) Yeet telemetry — Verdict: partial

31 run directories in `.beep/yeet/runs/`. The inspected run had
`state.json`, `verdict.json`, and `status.json`.

Tested extraction:

```sh
run=.beep/yeet/runs/<run-dir>
jq -n --slurpfile s "$run/state.json" \
      --slurpfile v "$run/verdict.json" \
      --slurpfile t "$run/status.json" '
 {run_id:$v[0].runId, proof_tier:$s[0].proofTier,
  verified_at:$s[0].verifiedAt, verdict_created_at:$v[0].createdAt,
  outcome:$v[0].outcome,
  lanes:($v[0].lanes|map({label,phase,status})),
  remote:{checked:$t[0].remote.checked,
          failing_checks:$t[0].remote.failingCheckCount,
          pending_checks:$t[0].remote.pendingCheckCount},
  closeout:{state:$t[0].closeout.state,
            issue_count:$t[0].closeout.issueCount}}'
```

Available: proof tier/command identity, artifact timestamps, overall outcome,
lane label/phase/status, commit/push flags, worktree counts, remote check
counts, merge/closeout state.

Across 29 verdicts: six verify failures, five publish failures, two monitor
failures, one closeout failure. Failure labels included `full:pre-push`,
`full:review-fix`, and `monitor:pr-checks:watch`.

Gotchas: **no `duration`, `elapsed`, `retry`, or `attempt` fields exist.**
Artifact timestamps permit coarse gaps only, not step timing. Failed versus
not-run is recorded; retry counts are dead.

## (e) Fleet — Verdict: partial

Directory presence and disk/count measurements only:

```text
repo          ai-metrics   yeet bytes   run directories
beep-effect2  absent       2,628,179    24
beep-effect3  absent       1,457,877    15
beep-effect5  absent       2,310,850    11
beep-effect6  absent       2,781,088    12
beep-effect7  absent       2,320,363    12
beep-effect8  absent         937,770    17
beep-effect9  absent       1,750,854     2
```

Every sibling has Yeet data worth basic outcome/lane mining; none has an
`ai-metrics` directory. The main `beep-effect` checkout is the only fleet
member with the derived AI-metrics database.
