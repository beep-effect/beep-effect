# Effect-Native Observability Findings

## Recommendation

Use stable Effect observability APIs and `@effect/opentelemetry` for v1.

The production path should use:

- core `Metric` for counters, gauges, frequencies, histograms, summaries, and
  timers
- core `Tracer` and `Effect.withSpan` for trace structure
- core `Logger`, `LogLevel`, and log annotations for structured diagnostics
- core `ErrorReporter` for report-and-continue parser, collector, and gateway
  failure boundaries
- core `Clock` and test clocks for deterministic windows and duration tests
- `Redacted` and explicit schemas for sensitive values
- `@effect/opentelemetry/NodeSdk.layer` as the v1 OTLP bridge

## Stable V1 Posture

Use `@effect/opentelemetry` because it composes official OpenTelemetry trace,
metric, and log processors/readers/providers while keeping instrumentation in
normal Effect APIs. This fits the repo observability doctrine: spans mirror
architecture boundaries, metrics are bounded and low-cardinality, logs are
diagnostic, and CLI output remains user-facing console output.

Default metric temporality should be cumulative unless a selected backend
requires delta temporality.

Prefer histograms for latency dashboards. Summaries may export as separate
series and are less portable for backend dashboards.

## Unstable Modules

`effect/observability` has useful ideas: a unified OTLP layer,
resource config, export intervals, batching, retry handling, JSON/protobuf
serialization, log/trace correlation, and Prometheus output. It should be a
reference or later adapter, not the v1 deploy-critical path.

`effect/devtools` is a local live-dev websocket protocol. It sends
Effect-native spans and metric snapshots, not OTLP. It should not be used for
deploy-ready metrics.

`effect/eventlog` is valuable for immutable events and replayable
projections. For this initiative, use it only as an internal projection proof
until its API risk is acceptable.

## Practical Mapping

Live process metrics:

- source files scanned
- lines accepted and rejected
- sessions discovered
- active collector queue depth
- gateway enrichment success and failure counts
- provider and model frequencies
- benchmark duration histograms
- report generation durations

Trace spans:

- `ai_metrics.source.discover`
- `ai_metrics.transcript.scan`
- `ai_metrics.jsonl.decode`
- `ai_metrics.redaction.apply`
- `ai_metrics.archive.write`
- `ai_metrics.derived.materialize`
- `ai_metrics.gateway.enrich`
- `ai_metrics.benchmark.run`
- `ai_metrics.report.weekly`
- `ai_metrics.otlp.export`

Log annotations:

- source kind
- target
- privacy mode
- config snapshot hash
- benchmark case id
- redaction result

## Caveats

Do not attach raw prompts, transcript bodies, secrets, filesystem paths with
private content, or unbounded error strings as OTLP attributes. Hash or bucket
instead.

Treat `ErrorReporter` severity defaults carefully and test the exact local
Effect behavior before relying on severity routing.

EventLog entry IDs use UUID v7 time internally, so deterministic tests should
assert ordering and projection outcomes unless a narrow entry creation seam is
added.
