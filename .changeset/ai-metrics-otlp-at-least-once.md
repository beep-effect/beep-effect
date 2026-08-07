---
"@beep/repo-ai-metrics": patch
---

Deliver AI metrics spans at-least-once with content-addressed span ids instead of
inferring delivery from a local watermark.

Export emitted one `Effect.withSpan` per projection and then marked those turns
exported. Emission there is asynchronous and fire-and-forget, so a batch the collector
rejected was indistinguishable from one it stored: the watermark recorded an intention,
not an outcome, and a rejected batch was silently lost. Before the ingest dedup that
failure self-healed, because the duplication was acting as an accidental retry.

Projections now carry deterministic ids. `traceId` and the session `spanId` are seeded
from the transcript the session belongs to — `sourceKind`, `sourceRole`, and
`sourcePathHash` — and turn spans are parented to their session span, so one transcript
keeps one trace across every ingest run. The seed deliberately avoids `agent_session_id`,
which still embeds the ingest run and would hand each run its own trace id. Identical
content always produces identical ids, so a redelivered span collapses into the row the
collector already holds; Phoenix enforces `uq_spans_span_id`. Correctness no longer
depends on the watermark being accurate, which demotes it to an optimisation whose worst
failure is a redundant send.

Delivery runs through `@opentelemetry/exporter-trace-otlp-proto` behind a new
`AiMetricsOtlpSpanSender` service, whose export callback is real delivery confirmation.
Protobuf is not optional here: Phoenix answers OTLP/JSON with HTTP 415. The watermark
closes only on `ExportResultCode.SUCCESS`.

Sends are chunked at 512 and sequential. A drain can carry tens of thousands of turns,
and one request that large is the backpressure collapse this work exists to prevent —
the `BatchSpanProcessor` this replaces had been doing that chunking. A mid-drain failure
re-sends already-delivered chunks on the next run, which is safe only because the ids are
stable.

`runAiMetricsOtlpExport` is now the single export entry point for both the forwarder and
the standalone `ai-metrics otlp export` command, so no caller can deliver spans and then
forget to record that it did. The Node SDK trace layer is unwound from the CLI export
path, since nothing emits through the ambient tracer any more.

The export path also ensures the derived schema itself. It reads
`otlp_exported_at_epoch_ms`, a migration-added column whose only other caller was the
ingest write, so a store written by an earlier release failed with a bare DuckDB binder
error until an unrelated forwarder run happened to migrate it.

The watermark backfill now excludes the newest ingest run *that actually committed
turns*. A later zero-turn discovery pass was shadowing the real one, marking exactly the
rows most likely to be unexported.
