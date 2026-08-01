# Agent Effectiveness Pulse

## Status

Stage: `graduate`
Status: `graduated` (wave 2 cut 2026-07-31)

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The repo has a full AI-metrics stack (Phoenix on dankserver, DuckDB pipeline,
weekly scorecards) that quietly decayed, and nobody can currently answer:
which skills get used, where agent time goes, what blocks PRs from mergeable,
and what eats token spend. Get a data-driven pulse, then decide improvements.

## Next Open Question

None — fully graduated. Wave 1 (2026-07-14) →
[`goals/harness-otel-adoption`](../../goals/harness-otel-adoption/README.md),
[`goals/harness-hygiene-mechanical`](../../goals/harness-hygiene-mechanical/README.md).
Wave 2 (2026-07-31) → one packet,
[`goals/coding-agent-effectiveness-evidence-loop`](../../goals/coding-agent-effectiveness-evidence-loop/README.md),
absorbing the `yeet-verdict-instrumentation` + `repo-replay-evals` splits
named in [`MAP.md`](./MAP.md) (see the 2026-07-31 entry in
[`DECISIONS.md`](./DECISIONS.md)); H8 browser-proof is owned there.
Forwarder durability still rides `ai-metrics-stack` P7f.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
7. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-31 (wave-2 graduation): the 2026-07 Codex bottleneck audit plan
  was amended via a five-frame `/adhd` run + two-round operator interview,
  then graduated as one packet
  `goals/coding-agent-effectiveness-evidence-loop` (absorbing the ratified
  `yeet-verdict-instrumentation` + `repo-replay-evals` splits). Decision +
  amendment inventory: `DECISIONS.md` 2026-07-31 entry and the packet's
  `research/2026-07-31-adhd-amendments.md`. Status → `graduated`.
- 2026-07-14 (graduation): shape sign-off after second grilling round (four
  decisions incl. the OTel routing amendment — dankserver
  `monitoring_otel_collector` hub; the originally cited "local collector"
  was trustgraph's). Packet PR #398 merged. Wave-1 graduated:
  `goals/harness-otel-adoption` + `goals/harness-hygiene-mechanical`
  scaffolded with inherited SOURCES ledgers; `ai-metrics-stack` gains P7f
  Forwarder Durability (v1-blocking, gates P7e). Stage → `graduate`; packet
  stays active for wave 2.
- 2026-07-14 (later): Phase 1+2 done same session. Pipeline revived: 2,924
  files backfilled in byte-capped batches (bulk-transaction limit found >
  ~160MB/run; parquet export broken — both filed as candidates), 1.0M spans
  re-exported to Phoenix (endTime now current), weekly scorecard regenerated
  (2,741 tasks, claude covered), systemd timer installed+enabled. Pulse
  mined: five lane reports in `research/pulse/` + synthesis
  `research/pulse-report.md` (4 questions answered, H1–H9 verdicts, 7
  improvement candidates). Stopped at **Checkpoint A** for operator
  grilling; packet not yet committed/published.
- 2026-07-14: packet opened at `research` — capture recorded; five
  pre-exploration codex briefs (GPT-5.6 Sol) materialized into `research/`;
  kickoff decisions logged (new packet, durable revival, whole-fleet mining,
  grill checkpoints, codex-medium subagent economy). Next: pipeline revival,
  then pulse mining.
