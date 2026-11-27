---
title: The route corpus runner retries a job listing once in 30-job pages after a transport failure
date: 2026-11-26
reversal: Drop the ROUTE_CORPUS_JOB_FALLBACK_PAGE retry so a transport failure on 100-job pages fails the call.
governs:
  - src/commands/Ci/RouteCorpus.ts#makeRouteGithubRunner
enforcedBy: []
---

Anchor for `goals/certainty-scorecard/decisions/2026-11-10-per-attempt-page-fallback.md`, which records the runs that answer 502 on every 100-job page yet read cleanly at 30.
