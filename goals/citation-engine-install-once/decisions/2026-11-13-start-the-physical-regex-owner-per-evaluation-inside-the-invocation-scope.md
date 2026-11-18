---
title: "Start the physical regex owner per evaluation inside the invocation Scope"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Restore per-helper-call makeCitationRegexWorker construction with its owner snapshot and reap."
---

installCitationRegexEvaluator holds only engine constants: limits, runtime, timing, the shared native admission, Clock, spawner, Digest, descriptor registry, job preparation and the control-frame preflight. The process owner captures a Scope, a birth lock and a process list, so it is not shared: each evaluate reads CitationInvocation and starts one owner in the invocation Scope, then runs the unchanged withCitationNativeProcess sequence (one child per job, protocol v2, lease released only on confirmed retirement). Before A3 one owner served each helper call; now one serves each evaluation. The owner-level snapshot and reap had no production reader and are removed; the quarantine refusal a later evaluation sees now comes from the shared native admission with the same reason, quarantined. CitationRegexWorker.test.ts asserts the admission snapshot where it asserted the owner snapshot.

Superseded in review round 1 by "Hold one regex process owner per invocation, created on its first evaluation".
