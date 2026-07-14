# Capture

<!-- Append-only. New material goes under a new dated heading. -->

## 2026-07-14 — Living vision, detached from dead anchors

### The picture

The workspace is a human-editable knowledge environment whose durable truth is
an immutable event journal. Nodes, edges, edits, removals, provenance changes,
and source-derived assertions enter as events. The visible graph is a
materialized projection: disposable, rebuildable, and replaceable without
losing the journal.

One event stream can feed several views independently: graph traversal,
backlinks, search indexes, visual elements, statistics, and future domain
projections. Live subscribers see accepted events as they land; a damaged or
redesigned projection can be dropped and replayed.

Lexical is the authoring surface. `[[wiki links]]` are first-class editor
semantics that resolve to pages and project into typed edges/backlinks. The
editor and graph are two views of one knowledge fabric, not separate products
joined by a periodic importer.

Time is part of the experience. A reader should be able to scrub to an earlier
journal boundary, watch the graph evolve, compare projections across time,
and trace a visible connection back to the event, source, and actor that made
it. Replay should support both audit and product understanding, not merely
disaster recovery.

### Invariants worth researching

- Journal entries are append-only, typed, ordered, attributable, and sufficient
  to rebuild every authoritative projection.
- Projection state is never silently promoted to source of truth.
- Wiki-link resolution has deterministic identity, explicit unresolved-link
  behavior, and provenance when links are inferred rather than authored.
- Current and historical views share query semantics; an “as of” boundary is
  explicit rather than hidden in UI state.
- Rich editor state may have its own durable representation, but graph facts
  derived from it remain reproducible and source-linked.
- Compaction or synchronization must preserve semantic replay and auditability.

### History pointer

The detailed former design remains in repository history at
`goals/knowledge-workspace/{00-event-sourced-graph.md,01-data-model.md,02-real-time-and-replay.md,03-ui-architecture.md,04-lexical-integration.md}`.
Consult the last revision before deletion for design archaeology only.

### Explicitly not carried

Do not revive the old package names, file paths, UI component choices, database
layout, Effect unstable API spellings, or specialist-agent inventory merely
because they appeared in the paused packet. Re-ground the vision against the
live architecture before shaping it.
