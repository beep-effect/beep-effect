---
title: A shipped migration is corrected by a later migration, never edited in place
date: 2026-11-23
reversal: Edit the ai-metrics-otlp-export-watermark-v1 statement to exclude the newest turn-bearing run and delete v2.
governs:
  - src/derived-storage.ts#derivedStorageMigrations
enforcedBy: []
---

`ai-metrics-otlp-export-watermark-v1` (#578) backfills the watermark once, before the run's
inserts, so a store already exported many times over does not flush its whole history to
Phoenix in one burst. It spares the newest ingest run, the one crash before it that no later
run could rescue, but a later zero-turn run shadows the newest run that committed turns and
buries exactly the turns most likely unexported. The SQL stays verbatim: the migration ledger
records the id, not the text, so an edit fixes no applied store and changes fresh ones.
`-v2` reopens the newest run among rows holding v1's sentinel `0` (real exports write the wall
clock, later rows are NULL). It runs after v1 everywhere, so both orders converge; the worst
case is one run of re-sent spans, which carry content-addressed ids the collector deduplicates.
Rejected: editing v1 in place; leaving the history unbackfilled.
