---
title: "P6: one literal Operation.run span; nlp-processing telemetry takes its own package label and beep.nlp instruments"
date: 2026-11-24
lane: "p6"
reversal: "Restore the per-function span names, the @beep/nlp package label at np/src/internal/observability.ts:16 and the nlp_*_total and nlp_*_duration metric names"
---

SPEC Constraints name spans Concept(.Sub)*.action with ids, digests and counts as attributes, never quote or matter text. The instrumentation harvester records only literal Effect.fn names (Observability.harvest.ts), so a per-operation span name would be invisible to the catalog. withActivity's run is Effect.fn("Operation.run") with attributes beep.operation.term, beep.activity.id, beep.activity.used_count and beep.activity.generated_count; plain arrows emit no span, and every Operation run emits a prov:Activity is read as every attributed run. np/src/internal/observability.ts:16 labels nlp-processing spans package @beep/nlp, which is wrong and is fixed. The nlp_*_total counters and nlp_*_duration timers become declared instruments in np/src/NlpProcessing.instruments.ts named beep.nlp.<noun> with UCUM units and one counter per concept with a bounded beep.outcome attribute (standards/architecture/12-observability.md:43-44). A repo search for the old metric names finds only that file, so no dashboard breaks. Of the 11 non-conforming span names, only those row 3 rewrites (applyOne, cacheResult, runStrategy) are renamed; the others keep their pre-domain names as the catalog allows. Answers O11 and F10.

Amended after independent review. The span carries an `outcome` attribute, `completed` or `failed`, matching the activity record (decision `2026-11-24-p6-a-failed-attributed-run-records-its-activity`). The `@beep/nlp` observability shard is removed in row 2, where the package is deleted, and the catalog run in that row proves the orphan check; what this decision called row 3 is row 4 in the revised row table.
