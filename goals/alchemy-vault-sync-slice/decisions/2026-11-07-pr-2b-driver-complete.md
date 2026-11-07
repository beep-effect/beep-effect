---
title: "PR 2b: views, projections, streams, Backfill catch-up, upcasting, Cluster engine, real Postgres"
date: 2026-11-07
kind: checkpoint
lane: "alchemy-postgres-views worktree"
reversal: "Revert the PR 2b squash commit; driver tables are created idempotently and no product data uses them yet"
---

AlchemyPostgres.layer now provides Platform plus WorkflowEngine (effect/cluster ClusterWorkflowEngine over a SQL SingleRunner and Digest.layerWebCrypto), the same surface as Domain.InMemory. Views, projections and streams are hosted with InMemory's semantics; ModelHost.start/history run upstream Backfill over Postgres-backed Storage (advisory-locked KV) and Jobs. Upcasting: event classes may declare static schemaVersion (default 1) and static upcast(fromVersion, json), applied one version at a time on read. Saga crash-and-resume passes on PGlite. The conformance suite passes on Domain.InMemory and PGlite (79 tests) and on real Postgres 17 (32 integration scenarios, run against a throwaway container); the real-Postgres run found that @effect/sql-pg decodes int8 as native bigint, now accepted by the Int8 schema. Found along the way: in beta.85 Domain.InMemory, reading a view key before its first delivery keeps it out of the backfill directory, so a consumer added later skips that key; candidate for the D16 upstream offer.
