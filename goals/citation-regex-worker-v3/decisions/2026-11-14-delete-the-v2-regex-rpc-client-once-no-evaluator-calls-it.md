---
title: "Delete the v2 regex RPC client once no evaluator calls it"
date: 2026-11-14
reversal: "Restore RegexWorkerClient.ts from main if a v2 evaluator returns"
---

Owner ruling for PR 3352: RegexWorkerClient.ts has no production importer after evaluator migration to CitationRegexSession. Delete it and the client-only out-of-order-control and failed-write test blocks, whose shared test can no longer exercise a production caller. Retain all other v2 tests, program, protocol and RPC schemas. Hosted coverage lost its old evaluator-driven reachability; adding coverage for this unused client would preserve dead production code. The remaining v2 program importers and coverage-baseline deletion handling are recorded in the PR review round 1 evidence.

Remove only its coverage baseline file row: CoverageRegression.perFileDroppedMetrics fails closed for vanished covered paths, as for the earlier CleanerOperation.ts deletion (2026-11-13 decision). Preserve package aggregates and all surviving file floors. RegexWorkerProgram.ts has only CitationRegexWorker.test.ts as a runtime importer and is retained for B3; RegexWorkerProtocol.ts and RegexWorkerRpc.ts remain imported by production session modules.
