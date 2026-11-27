---
title: makeHttpApiMetrics takes only a prefix
date: 2026-11-26
reversal: Add descriptionPrefix back to the exported signature as a second string parameter, without a dual.
governs:
  - src/server/HttpApiTelemetry.ts#makeHttpApiMetrics
enforcedBy: []
---

`makeHttpApiMetrics` is unary by contract. `descriptionPrefix` keeps its runtime default
("HTTP API request") but is removed from the public type, so no caller can supply it.

A dual over `(prefix, descriptionPrefix)` is undecidable: both are strings, so a lone string
cannot be told apart from a data-last call. The parameter had no callers when it was narrowed.

Rejected: exporting `(prefix: string, descriptionPrefix?: string)`. It widens the API for no
caller and re-arms the missing-dual diagnostic on a multi-argument export.
