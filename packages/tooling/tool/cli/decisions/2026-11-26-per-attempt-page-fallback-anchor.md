---
title: The route corpus runner retries a failed job listing once in smaller pages
date: 2026-11-26
reversal: Drop the ROUTE_CORPUS_JOB_FALLBACK_PAGE retry so a transport failure on full pages fails the call.
governs:
  - src/commands/Ci/RouteCorpus.ts#makeRouteGithubRunner
enforcedBy: []
---

Anchor for `goals/certainty-scorecard/decisions/2026-11-10-per-attempt-page-fallback.md`.
