---
title: The bundle PGlite graph store is created by raw DDL, not drizzle-kit migrations
date: 2026-11-23
reversal: Generate and apply drizzle-kit migrations for the bundle kg tables instead of the hand-written CREATE statements.
governs:
  - src/PracticeKg.projections.ts#createKgTables
enforcedBy: []
---

The bundle's PGlite store tables are created from hand-written CREATE statements run through the injected SqlClient.

Reason: the bundle store is disposable and rebuilt whole on every run, so there is no migration history to manage. The Drizzle declarations in `@beep/law-practice-tables` stay the schema authority, and the projections test keeps the hand-written DDL's column sets equal to those declarations.

Rejected: drizzle-kit migrations for a store that is never upgraded in place.
