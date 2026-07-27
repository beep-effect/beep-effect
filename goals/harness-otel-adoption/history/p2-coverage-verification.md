# P2 coverage-verification note — 2026-07-25

One-day comparison of native harness OTLP telemetry (dankserver collector →
Prometheus/Phoenix) against local ground truth (Claude transcripts, Codex
rollouts), per the SPEC acceptance criterion "coverage-verification note".

- **Window**: 2026-07-24T08:30Z → 2026-07-25T08:30Z (03:30 → 03:30 CDT).
- **Query side**: Prometheus HTTP API via `docker exec monitoring_prometheus`
  over `ssh dankserver-yubi`; Phoenix REST `/v1/projects/default/spans`
  (GraphQL span queries time out at current volume — see operational notes).
- **Local side**: `~/.claude/projects` transcripts (main sessions +
  `subagents/**` transcripts), `~/.codex/sessions` rollouts. Token usage
  deduplicated by `message.id` (streamed chunks repeat the same usage
  object; naive line-summing overcounts ~2.2×).

## Claude Code — session coverage

Prometheus (`claude_code_session_count_total`, distinct `session_id` in
window): **194 sessions** — 46 ghostty + 11 pycharm (interactive), 137
non-interactive (subagents, `claude -p`, companion drivers).

Session-id join against local transcripts:

- 66 local main sessions started in window → **65 present in Prometheus
  (98.5%)**. The single miss (`a1ee2c80`, dankserver project) begins with a
  `queue-operation` event — a queued-operation resume artifact, not a fresh
  session launch. Effectively **100% of real session starts exported**.
- The 129 Prometheus-only session ids correspond to subagent/non-interactive
  processes (284 local subagent transcripts started in window); native
  session counting includes them, so main-session counts are the wrong
  denominator for that population — explained, not a gap.
- **Every Claude-harness execution mode in use exported**: native `claude`
  (19 sessions with claude-* model labels), `claudex` proxy (9 sessions,
  `gpt-5.6-sol`/`luna` labels), `claudeg` proxy (16 sessions, `grok-4.5`),
  plus 21 wrapper sessions with no model calls. Proxy-routed sessions export
  identically to native ones (the harness reports usage from proxy
  responses).

Attribution: 40/57 interactive sessions carried `beep_*` labels spanning 11
distinct `beep_repo` values (main checkout + worktree clones `beep-effect2..9`,
`tvs-monorepo`, `effect-jetbrains-plugin`, `scratchpad`), with
`beep_branch`, `beep_task_class`, and `beep_goal_slug` where launched on a
goal branch (e.g. `beep_goal_slug="openclaw-workstation-agent"` observed live
in-window). Unattributed sessions are the non-wrapper population
(subagents/non-interactive) — the launcher-wrapper design boundary, as
documented in `research/p0-attribute-contract.md`.

## Claude Code — token totals

Per-model window totals, Prometheus (`sum(max_over_time(
claude_code_token_usage_tokens_total[24h]))` at window end, all types) vs
local (deduped by `message.id`, all types):

| Model | Prometheus | Local | Ratio |
| --- | ---: | ---: | ---: |
| claude-opus-4-8[1m] | 7,238,317 | 7,612,605 | 0.95 |
| claude-haiku-4-5 | 5,906,862 | 5,654,368 | 1.04 |
| grok-4.5 (claudeg) | 14,547,128 | 15,354,103 | 0.95 |
| gpt-5.6-sol (claudex) | 3,331,334 | 4,348,847 | 0.77 |
| claude-sonnet-5 | 418,423,980 | 550,825,387 | 0.76 |
| claude-fable-5 | 266,957,317 | 537,474,238 | 0.50 |
| claude-opus-5[1m] | 25,014,412 | 75,819,168 | 0.33 |
| gpt-5.6-luna (claudex subs) | 1,592,189 | 34,932 | 45.6 |
| **Total** | **743,011,539** | **1,197,123,648** | **0.62** |

By type (Prometheus / local): input 5.61M / 2.65M · output 4.71M / 6.50M ·
cacheRead 698.3M / 1,139.6M · cacheCreation 34.4M / 48.4M. Window cost
counter: $812.33 (nominal API-price equivalent; informational only under
subscription routing).

Reading, against a named tolerance (the SPEC criterion names none, so this
note defines one): a lane is **within tolerance** iff its Prometheus/local
ratio falls in **0.90–1.10 (±10%)**. Per-lane verdicts: opus-4.8 (0.95),
haiku (1.04), and grok (0.95) are within tolerance; sol (0.77), sonnet
(0.76), fable (0.50), opus-5[1m] (0.33), and luna (45.6) are **out of
tolerance** and are recorded as explicit exceptions — not claimed as
passing. The divergence concentrates in the heavy long-context lanes.
Recorded hypotheses for the exceptions, not conclusions:

1. Long-running sessions whose exporter dies mid-session (network hiccup,
   harness restart) stop metering while transcripts keep recording —
   plausible for multi-hour Fable/1M-context sessions (fable, opus-5[1m],
   sonnet).
2. Local-side residual overcount where `message.id` dedupe cannot collapse
   (retried calls get fresh ids that re-bill cacheRead) — plausible
   contributor for sol and sonnet.
3. The luna reverse-anomaly (metrics ≫ transcripts) is the mirror image:
   background claudex subagent traffic metered natively whose transcripts
   fall outside the scanned window/mtime filters.

Session-count coverage is the strong, verified claim; token totals meet the
±10% bound only on the bounded steady lanes, and the five exception lanes
are carried as recorded gaps with the hypotheses above. Follow-up
(non-gating): re-run the per-model comparison on a window with no
cross-boundary long sessions to isolate hypothesis 1; a future re-check
should treat a bounded-lane breach of ±10% as a real regression, not an
acceptable gap.

## Codex — mode coverage and limits

Prometheus label sets present in-window (`codex_thread_started_total`
series): `codex-tui/cli`, `codex-tui/subagent_thread_spawn_*` (5 distinct),
`codex-tui/internal_memory_consolidation`, `codex_exec/exec` (both
`gpt-5.6-sol` and `gpt-5.6-luna`), `Codex_Desktop/vscode` — all at
`app_version=0.145.0`, `auth_mode=Chatgpt`. Local ground truth: **208
rollouts** started in window (150 `codex_exec`, 32 `codex-tui`, 26
originator `"Claude Code"` = companion runs).

Recorded limits:

1. **Codex metrics cannot count sessions.** Each codex process exports
   per-process cumulative counters under identical label sets; the
   collector's prometheus exporter collapses them, and inter-scrape resets
   swallow counts — `increase(codex_thread_started_total[24h])` ≈ 4.2 vs
   208 real rollouts. Rollout files remain ground truth for codex session
   counts; codex token sums are lower bounds (window increase: input 307.1M,
   cached 293.9M, output 1.44M).
2. **Companion runs are not separable in OTLP.** Rollouts with originator
   `"Claude Code"` do not surface as a distinct originator label — they are
   either subsumed under `codex_exec/exec` or unexported. Distinguishing
   needs a controlled probe (residual; does not affect the accepted
   service-level-identity acceptance bar).
3. Per-repo/goal attribution on codex **metrics** remains the accepted v1
   gap (`research/p0-attribute-contract.md` "Known gap"): confirmed — no
   `beep_repo` on any codex metric series. The static trace-side
   `span_attributes` **do** apply: sampled codex spans in Phoenix carry
   `beep.schema_version="1"`.

## Phoenix traces + payload privacy spot-check

- Project `default` traceCount **585,023** (was ~1,300 at P1 rollout on
  2026-07-14) — collector→Phoenix trace fan-out is working at volume.
- **Privacy (codex spans)**: 560 spans sampled via REST (the most-recent
  pages — codex dominates span volume). The complete attribute-key
  inventory contains **no prompt/response/content keys** — only runtime
  attrs (`code.file.path`, `thread.id`, `codex.request.reasoning_effort`,
  `beep.schema_version`, timing counters; longest attribute value 80
  chars). Config side: `~/.codex/config.toml` sets
  `log_user_prompt = false`.
- **Privacy (claude spans — direct exported-payload inspection)**: a
  deeper recent-page scan (2026-07-25 ~11:50Z sample; 36,000 spans paged:
  33,399 codex / 110 claude / 2,491 other) surfaced **110 Claude Code
  spans** (`claude_code.tool`, `claude_code.tool.execution`,
  `claude_code.tool.blocked_on_user`, `claude_code.llm_request`,
  `claude_code.interaction`, `turn/start`, `thread/resume`). Their
  complete attribute-key inventory carries **no content keys** — identity
  and session ids, `gen_ai.*` metadata, token counts, and live `beep.*`
  attribution (`beep.repo`/`beep.branch`/`beep.goal_slug` observed on
  claude spans, re-proving slice-1 trace attribution); longest value 64
  chars (`user.id` hash). The only prompt-adjacent keys are
  `user_prompt_length` (numeric) and `user_prompt` capped at 10 observed
  characters — the `<REDACTED>` placeholder envelope, not prompt text —
  in-band confirmation that `OTEL_LOG_USER_PROMPTS=0` redaction is active
  in the exported payload itself. Config side: `~/.claude/settings.json`
  pins all four `OTEL_LOG_*` content flags to `0` with logs exporter
  `none`. (The sample post-dates the comparison window because recent-page
  REST is the only workable read path; payload shape is
  window-independent.)
- **Privacy (claude metric labels)**: all 1,364 `claude_code_*` series in
  the window carry 38 label keys, each a short structured value (uuids,
  model ids, enums; max 64 chars — the `user.id` hash) — the metric
  surface has no content-capable label.
- Slice-1 attribution on traces (`repo` + `goal-slug` in Phoenix) was proven
  on real data at P1 (2026-07-14 evidence); in-window attribution is
  re-proven on the metric side (40 attributed sessions incl. live
  `beep_goal_slug` values).

## Operational notes (non-gating)

- Phoenix GraphQL span queries time out at current volume, and REST
  `/v1/projects/{project}/spans` with `start_time`/`end_time` filters also
  hangs (>4 min) on historical windows; only unfiltered recent-page REST
  reads return promptly (documented here as the P2 "Phoenix 15.5 query
  shape" investigation result). Historical span reads need either the
  span-volume reduction below or direct database access.
- Phoenix span ingestion trails wall clock by ~90 minutes under codex span
  flood (newest ingested span 07:36Z at 09:05Z). Consider sampling or
  dropping codex runtime spans at the collector if lag grows.
- Prior polish items stand unchanged: Phoenix project header for harness
  traces, Grafana dashboard, prometheus scrape-job rename from `openclaw`.
