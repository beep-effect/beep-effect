---
title: Ontology tool mutations serialize on one in-process semaphore
date: 2026-11-26
reversal: Replace mutationSemaphore with a cross-process file lock or a stateful session repository.
governs:
  - src/tools/OntologyToolService.ts#makeOntologyToolService
enforcedBy: []
---

The desktop sidecar is the only v1 write authority for files exposed through `/mcp`, so one in-process `mutationSemaphore` closes the compare, apply and write TOCTOU window for every tool mutation.
Rejected: a cross-process lock or a stateful session repository, which v1 does not need while a single sidecar process owns the writes. Accepted limit: a second writer process would race these mutations.
