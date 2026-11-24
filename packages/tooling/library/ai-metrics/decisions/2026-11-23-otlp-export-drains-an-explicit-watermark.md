---
title: OTLP export drains every turn whose explicit export watermark is still open
date: 2026-11-23
reversal: Drop otlp_exported_at_epoch_ms and select only the turns whose ingest_run_id is the current run.
governs:
  - src/derived-storage.ts#migrationColumns
  - src/otlp.ts#readUnexportedTurnRows
enforcedBy: []
---

Each turn carries `otlp_exported_at_epoch_ms`, NULL until a delivered chunk closes it, and the
exporter reads every turn whose mark is NULL regardless of the run that wrote it.
A failed or interrupted export heals itself: the next run picks the turns up.
Rejected: inferring export state from `ingest_run_id`. That only worked while every run
re-minted its rows; once ingestion became idempotent, a run that committed turns and died
before exporting left them on a run the exporter never revisits, so they never reached Phoenix.
