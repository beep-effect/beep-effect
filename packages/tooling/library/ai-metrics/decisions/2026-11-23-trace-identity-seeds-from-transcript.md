---
title: OTLP trace and session span ids seed from the transcript, including source role
date: 2026-11-23
reversal: Derive trace and session span ids, and the export grouping key, from agent_session_id.
governs:
  - src/otlp.ts#sessionSeed
  - src/otlp.ts#spanProjectionsFor
enforcedBy: []
---

The seed is sourceKind, sourceRole and sourcePathHash, and export rows are grouped by it.
Until `ai-metrics-agent-session-id-v2` has run, a store migrated in place still holds per-run
`agent_session_id` values; seeding from the transcript keeps such a store tracing correctly and
keeps trace ids stable across the migration. Grouping by the column there would emit one
session projection per legacy row with one shared span id, and a request holding a duplicate
span id may be rejected outright rather than deduplicated.
The seed keeps `sourceRole` although the session row key drops it: removing it would change
every transcript's trace id and detach future spans from traces Phoenix already holds.
Rejected: `agent_session_id` as seed or grouping key; dropping `sourceRole` from the seed.
