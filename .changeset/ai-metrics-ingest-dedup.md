---
"@beep/repo-ai-metrics": patch
---

Make derived-storage turn ingestion idempotent. `turn_id` is now content-addressed
and no longer mixes in `ingestRunId`, and repeated turns are `INSERT OR IGNORE`d so
the first-seen `ingest_run_id` is retained as lineage. Re-ingesting the same
transcript no longer multiplies rows, and because the OTLP export selects
`WHERE ingest_run_id = <this run>`, it now exports only genuinely new turns instead
of the whole store on every run.
