---
"@beep/repo-ai-metrics": patch
---

Restore the shipped OTLP export watermark migration and correct it with a new one.

`ai-metrics-otlp-export-watermark-v1` shipped excluding the newest ingest run outright,
which let a later zero-turn discovery pass shadow the newest run that had actually
committed turns — burying exactly the rows most likely to be unexported. The correction
was applied by editing that migration's SQL in place, which fixes nothing: the
`ai_metrics_schema_migrations` ledger records a migration *id*, not its text, and
`ensureAiMetricsDerivedStorage` skips any id it finds there. Every store that had already
run v1 kept its buried turns, permanently — the watermark reads as closed and nothing
reopens it.

v1 is restored to exactly the SQL it shipped with and is now marked immutable in place,
and `ai-metrics-otlp-export-watermark-v2` carries the correction. It reopens the turns v1
should have spared, keyed on the backfill sentinel: v1 writes a literal `0`, a real export
writes the wall-clock epoch, and rows ingested after v1 are `NULL`. So
`otlp_exported_at_epoch_ms = 0` identifies the backfilled rows exactly, and among those the
newest run by `started_at_epoch_ms` is the run v1 should not have marked — every run newer
than it at v1 time had no turns, which is the bug condition.

Both paths converge. On a store that already applied v1, v2 reopens the buried run. On a
fresh store, v1 buries it and v2 immediately reopens it. The worst case either way is one
run's worth of re-sent spans, and those carry content-addressed span ids the collector
deduplicates.
