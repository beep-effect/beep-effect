---
title: "PR 1 merged; PR 2a Postgres Platform for aggregates and policies"
date: 2026-11-06
kind: checkpoint
lane: "alchemy-postgres-driver worktree"
reversal: "Revert the PR 2a squash commit; no stored data exists yet"
---

Foundations PR #2810 merged 2026-11-06 (7f7cb719ba): beta.85 pin, driver scaffold, P0 spikes, doctrine, entity-kit freeze. PR 2a ships `AlchemyPostgresPlatform.layer`: driver tables with provenance and `schema_version`, single-writer commits (instance row lock in one transaction), commandId dedupe, outbox delivery to policies, durable schedule/unschedule. Views, projections and streams fail with `AlchemyPostgresUnsupported` until PR 2b (with the Cluster workflow engine, catch-up over `Backfill`, upcasting at read, real-Postgres integration project). Conformance suite green on `Domain.InMemory` and PGlite (27 tests).
