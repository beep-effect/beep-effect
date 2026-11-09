---
title: "MemoryLog sits on effect/eventlog with SqlEventJournal over @beep/sqlite"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Replace the EventLog facade with a store-owned append table by decision file, citing the Effect module gap that forced it"
---

Repo law: never hand-roll what an Effect module provides. effect/eventlog ships EventLog (typed Event groups with tag, payload schema and primaryKey), EventJournal (time-ordered EntryId, memory and SQL backends via SqlEventJournal), opt-in compaction and remote set-union sync, and @beep/duckdb already builds on it. NodeEvents are typed Events in one EventGroup with primaryKey = NodeId; the journal is SqlEventJournal over the @beep/sqlite driver; no compaction is registered for node events, so the log stays Layer 2's exact record; MemoryLog is a thin typed facade over EventLog and projections read entries and reactivity. Rejected: EventJournal-only writes (re-implements tag and payload plumbing) and an own append-only table (forbidden by the law).
