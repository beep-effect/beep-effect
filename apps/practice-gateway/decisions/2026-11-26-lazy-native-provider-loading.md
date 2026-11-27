---
title: Load the native knowledge-graph modules only when selected
date: 2026-11-26
reversal: Import the knowledge-graph engine into the gateway static module graph.
governs:
  - src/PracticeKgProvider.ts#importPracticeKgModules
enforcedBy: []
---

Dynamically load the knowledge-graph modules when the profile selects that provider.
Reason: those modules evaluate DuckDB native bindings and PGlite at import time; a missing sidecar must not prevent unrelated gateway setup and providers from starting.
Rejected: static module imports that make native availability a prerequisite for the entire gateway.
