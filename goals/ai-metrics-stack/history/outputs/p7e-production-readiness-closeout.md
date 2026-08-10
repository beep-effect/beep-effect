# P7e Production Readiness Closeout

## Status

V1 completed on 2026-08-10. This output supersedes the pre-closeout topology
and waiting-window claims in the packet's manifest, SPEC, PLAN, and README.
Historical P6 outputs remain evidence of what was true during the May proof.

## Production Topology

- `beep-ai-metrics-forwarder.timer` is enabled and active with
  `OnUnitInactiveSec=360m`, `Persistent=true`, and a randomized delay of two
  minutes.
- The latest observed scheduled run began 2026-08-10 03:30 CDT and finished in
  2 minutes 28 seconds with exit status 0 and a 7.5 GB memory peak.
- The service executes
  `packages/tooling/tool/cli/src/bin.ts -- ai-metrics forwarder run` from
  `/home/elpresidank/YeeBois/projects/beep-effect` with a per-source cap of 50
  files, a 32 MiB file cap, OTLP enabled, and `--parquet-mode none`.
- Every durable artifact is under
  `/home/elpresidank/.local/state/beep/ai-metrics`: encrypted raw archives,
  config snapshots, DuckDB, reports, and forwarder status. A filesystem scan
  confirmed that no checkout under `~/YeeBois/projects` contains
  `.beep/ai-metrics`.
- The current data root is about 20 GB: about 15 GB raw plus 4.8 GB derived at
  closeout. The DuckDB file contains 10,339,046 turn rows; current ingestion
  uses content-addressed identity while historical pre-fix rows remain retained.
- Runtime secrets remain in the mode-0600 systemd environment file; checked-in
  commands and evidence retain only `op://TBK/ai-metrics/hash-salt` and
  `op://TBK/ai-metrics/raw-archive-key` references.

The timer's execution checkout is clean on
`research/nightly-routine-p0-docs` at `bced3879f7`, three commits ahead and ten
behind `origin/main` at recon time. Staleness was not the OTLP cause: the
checkout's `otlp.ts` SHA-256 matched `origin/main` exactly, so the merged
content-addressed and at-least-once implementation was already present. The
checkout remains an explicit code-deployment surface, but it no longer owns or
fragments production state.

## Source-Cap Disposition

The failed 03:30 forwarder status included 50 of 150 Codex candidates and all
30 Claude candidates. That run created 36 new/changed encrypted objects and
only 9,458 turns were newly pending even though it projected 24,170 turns. The
fixed-branch closeout pass later included 50 of 179 Codex candidates plus all
36 Claude files, created 66 objects, and exported all 27,453 newly pending
turns. The candidate count is a bounded rolling recent-file rescan, not an
unprocessed queue, so the memory-heavy production cap was not raised.

## OTLP Failure Diagnosis And Repair

The latest timer status recorded `otlpExport.status="failed"` for ingest run
`forwarder-1786350614909`, while a GET/health probe still answered. A correct
empty protobuf `POST /v1/traces` exposed the real state: HTTP 503 with
`Server is at capacity and cannot process more requests`.

Phoenix 15.5.0's official source ties that response to a full span queue, and
the version's default queue capacity is 20,000 spans:

- [trace route capacity guard](https://github.com/Arize-ai/phoenix/blob/arize-phoenix-v15.5.0/src/phoenix/server/api/routers/v1/traces.py)
- [default queue configuration](https://github.com/Arize-ai/phoenix/blob/arize-phoenix-v15.5.0/src/phoenix/config.py)

The local DuckDB watermark showed 166,152 pending turns across several runs,
not merely the latest run. The sender already used sequential 512-span HTTP
requests, but `runAiMetricsOtlpExport` marked turns only after the entire
backlog succeeded. Phoenix could therefore accept a prefix, fill its queue,
reject a later request, and make the next scheduled retry resend the same
prefix. Stable span ids prevented duplicate storage but did not let the tail
advance.

The repair moves the durable acknowledgement boundary to the delivery boundary:
after each successful 512-span request, the corresponding turn ids receive
`otlp_exported_at_epoch_ms` before the next request begins. A later 503 now
leaves the accepted prefix closed and the rejected tail pending. The regression
test proves a partially acknowledged send leaves only the unacknowledged turn
for the next attempt.

One Phoenix service restart was performed before any progressive checkpoint was
written, discarding the pre-fix duplicate in-memory prefix. No persisted data
was deleted. Once progressive delivery began, Phoenix was not restarted again.
Live retries proved monotonic progress from 166,152 pending turns to zero
without a reset. The final resume sent 12,712 turn spans plus seven session
spans, after which all 10,339,046 then-existing turns were marked exported and
an empty protobuf admission probe returned HTTP 200.

Remote inspection also found that Phoenix's queue is shared with
`monitoring_otel_collector`, which independently retries coding-harness traces.
Phoenix held about 100% CPU while block writes grew beyond 5 GB, and both direct
AI-metrics requests and collector retries alternated between HTTP 200 and 503.
That shared pressure explains the uneven drain rate and makes queue/rejection
telemetry a follow-up, but it does not change the progressive-delivery fix.

The other July P7f claims were dispositioned against current source and runtime:
content-addressed ingest is merged; the timer's 50-file/32-MiB limits are the
production transaction bound; oversized historical backfills remain explicitly
chunked; and `--parquet-mode none` is compatible with P7e because mirror build
exports its own allowlisted Parquet from DuckDB. Clearer sanitized OTLP error
causes remain a non-blocking diagnostics follow-up.

## Local Repair Proof

- `bun run --filter @beep/repo-ai-metrics check`: passed
- `bunx --bun vitest run packages/tooling/library/ai-metrics/test/ingest.test.ts`:
  50 tests passed
- the focused partial-acknowledgement regression: passed
- historical live watermark: `166152` pending to `0`
- fixed-branch forwarder: `forwarder-1786367142894`, 86 source files, 66 new
  archive objects, 30,317 projected turns, 27,453 exported turn spans, 66
  session spans, `otlpExport.status="exported"`
- post-forwarder watermark: 10,366,499 exported turns, zero pending

## Final Credited Report

The final report was generated against the explicit credited window, not a
rolling current week:

```text
2026-05-09T02:26:00-05:00 through 2026-05-16T02:26:00-05:00
```

Artifacts:

- Markdown:
  `/home/elpresidank/.local/state/beep/ai-metrics/reports/weekly-1778311560000-1778916360000.md`
- JSON:
  `/home/elpresidank/.local/state/beep/ai-metrics/reports/weekly-1778311560000-1778916360000.json`

Credited config result:

- config snapshot:
  `config-6c5738fd0e1932ced6043ab52c7df04e52278b1024470769243b724c265f7d52`
- scorecard:
  `scorecard-a7a98a4d575689edd932c890bbea9dc1ab8143e8766e1bbb75c03ffb33226b7c`
- tasks: `161`
- human labels: `1`
- benchmark runs: `2`
- total score: `0.741304347826087`
- completion ready: `true`

The restarted P6a config also remained completion-ready with five tasks, one
label, and one benchmark run. The only report-wide gaps are the explicit
`model_call_metrics_unavailable_not_scored`,
`tool_invocation_metrics_unavailable_not_scored`, and
`cost_metrics_unavailable_not_scored` fields permitted by the V1 contract.

## Sanitized Derived Mirror

The V1 mirror is built directly from the current DuckDB store, so the live
timer's `--parquet-mode none` is not a blocker. The bundle contains a sanitized
manifest, mirror status, and allowlisted Parquet tables. It excludes raw archive
objects, transcript bodies, prompt/output text, local paths, ciphertext, nonce,
and key material. Workstation report files are not copied; sanitized scorecard
rows are included through the scorecard Parquet table.

The final production build and confirmed sync completed with:

- bundle: `p7-mirror-1786367539589`
- local bundle root:
  `/home/elpresidank/.local/state/beep/ai-metrics/mirror/bundles/p7-mirror-1786367539589`
- remote root: `/srv/data/ai-metrics/p7-derived-mirror`
- sync confirmation: `p7-derived-mirror`
- remote status: `available`
- privacy proof: `safe=true`, `forbiddenMatches=[]`
- omitted table: `ai_metrics_raw_archive_objects`

The remote manifest read back these row counts:

| Table | Rows |
| --- | ---: |
| `ai_metrics_ingest_runs` | 1,334 |
| `ai_metrics_source_files` | 17,422 |
| `ai_metrics_agent_tasks` | 6,661 |
| `ai_metrics_sessions` | 4,666 |
| `ai_metrics_turns` | 10,366,499 |
| `ai_metrics_model_calls` | 0 |
| `ai_metrics_tool_invocations` | 0 |
| `ai_metrics_outcome_labels` | 2 |
| `ai_metrics_benchmark_cases` | 2 |
| `ai_metrics_benchmark_runs` | 3 |
| `ai_metrics_scorecards` | 33 |

The configured remote root did not exist before closeout. Its parent was
root-owned and not writable by the SSH account, so an operator-authorized
`sudo install -d` created only the exact mirror leaf with owner `elpresidank`
and mode `0750`. The CLI then completed both `ssh mkdir -p` and
`rsync -az --delete`, and `mirror status` independently decoded the remote
manifest above.

## V1 Disposition

P0 through P6, P7a/b, P7f, and P7e are complete. P7c provider/gateway metrics
and P7d dashboard/backend expansion remain deferred non-blocking work. Model,
tool, token, latency, and cost fields remain explicit unavailable/not-scored
coverage gaps rather than simulated measurements.
