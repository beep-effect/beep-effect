---
title: The strict spool and its sink run untraced
date: 2026-11-26
reversal: Replace Effect.fnUntraced with Effect.fn on the spool append and the sink record.
governs:
  - src/strict/StrictSpool.service.ts#makeStrictSpool
  - src/strict/StrictSpool.layer.ts#layerStrictSpoolSink
enforcedBy: []
---

The spool's `append` and the spool sink's `record` use `Effect.fnUntraced`. Both run inside
the strict OTLP exporter, so a span of their own would only be exported in the next window,
where the strict gate refuses it, and would add refusal counts without any telemetry value.

Rejected: `Effect.fn` with a span name, the repo's usual form for a named effect function.
