---
title: Citation stages install once and replay the install Exit on each request
date: 2026-11-23
reversal: Move each stage install back inside the per-request handler, or let an install failure fail engine construction.
governs:
  - src/internal/Citation/AnnotationEntry.ts#ownCitationAnnotationEntry
  - src/internal/Citation/DocumentExtraction.ts#ownStages
  - src/internal/Citation/ExtractionEntry.ts#own
  - src/internal/Citation/ExtractionLoop.ts#makeCitationExtractionLoop
  - src/internal/Citation/SemanticExtraction.ts#ownStages
  - src/internal/Citation/SourceExtraction.ts#ownCitationSourceExtraction
  - src/internal/Citation/TokenizedExtraction.ts#own
  - src/internal/Citation/VerifiedExtraction.ts#own
  - src/internal/Citation/HtmlDiscovery.ts#discover
  - src/internal/Citation/ReferencePatterns.ts#installCitationReferencePatterns
enforcedBy: []
---

Each child stage is installed once, when its owner is built, and the result is kept as an `Exit` (`Effect.exit(install)`). Every request yields that `Exit`, so a failed install surfaces at the same request and with the same error that a per-request install used to produce. A value that depends only on installed configuration (the reference-pattern rejection fingerprint) is computed and replayed the same way.

Reason: installation authenticates assets and spawns or verifies native backends; repeating it per request costs time and native capacity, while the request-time failure surface is part of the observable contract.

Rejected: installing per request (repeated authentication and spawn cost), and failing owner construction on the first install error (moves the failure from the request to the Layer build and changes which error a caller sees).
