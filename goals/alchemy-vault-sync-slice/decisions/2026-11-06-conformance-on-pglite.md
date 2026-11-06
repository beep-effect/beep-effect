---
title: "Conformance suite runs on InMemory and PGlite; real Postgres as integration project"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Drop the PGlite project and run the suite against a docker Postgres only"
---

`@beep/pglite` ships `PgliteTestLayer` (Postgres dialect in-process), so the driver's conformance scenarios run three ways: `Domain.InMemory`, PGlite, and a real Postgres `test/integration` project reusing the same scenario module. The workflow engine is `effect/cluster/ClusterWorkflowEngine.layer` over `effect/cluster/SingleRunner.layer()` (SqlMessageStorage + SqlRunnerStorage) on the same SqlClient (D6).
