# Agent Memory Tiers & Bitemporal Edges

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A four-tier agent-memory schema (working/episodic/semantic/procedural) where
every consolidated fact carries confidence + source links, memories decay and
get evicted, and the knowledge-graph edges are bitemporal + never-overwritten —
versioned, supersedable, and conflict-aware. This is the net-new capability the
completed `epistemic-claim-lifecycle-gate` explicitly deferred (bitemporal store,
rejected/superseded states, RRF retrieval), so it graduates into a *fresh* goal
extending the epistemic slice rather than an in-place edit of the closed gate.

## Next Open Question

The retention lane's shape was ratified 2026-08-13 (see DECISIONS.md):
mechanism now with tier/decay/threshold policy as schema-validated data behind a
calibration-evidence phase gate; repo-native algorithm (agentmemory cited
reference-only); first slice is a standalone operator tier/memory-pressure
report with a delete-and-rebuild drill. Next action: scaffold
`epistemic-memory-retention-projections` as a goal in the ceremony PR, then
flip this packet to `graduated`. Contradiction triage cleared its gate
when the core landed and graduated 2026-07-25 into
[`goals/epistemic-contradiction-triage`](../../goals/epistemic-contradiction-triage/README.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — the provenance ledger joining
every design decision to its mined gold nugget (upstream repo + file:line), the
upstream license + port discipline, the external research citation, and the
in-repo `@beep/*` brick it composes. Derived from the gold-intake cluster
"Four-tier agent-memory schema w/ confidence + conflict edges" (15 nuggets);
see [`explorations/_gold-intake`](../_gold-intake/).

## Trail

- 2026-08-13: operator chose to SPIN the optional retention lane now and
  ratified its shape (policy-as-data, repo-native, standalone tier report
  first); goal scaffold queued for the ceremony PR, packet flips at scaffold.
- 2026-07-25: order-2 gate cleared — `epistemic-bitemporal-edge-core` closed `completed-retained`, so contradiction triage graduated into [`goals/epistemic-contradiction-triage`](../../goals/epistemic-contradiction-triage/README.md) with Deferred spike B as its P0 hard gate. MAP row marked GRADUATED, manifest `links.goals` extended. Retention/tier projections remain the only queued lane.
- 2026-07-14: shape gate ratified as drafted; graduated only `epistemic-bitemporal-edge-core`, with contradiction triage queued behind the core and retention queued behind real-usage calibration; no product prose page created.
- 2026-07-14: align gate closed; seven decisions plus the controlling product-memory scope recorded LOCKED, two spikes deferred to goal P0s, and the packet advanced to shape with BRIEF/MAP drafts awaiting sign-off.
- 2026-07-11: 2026-07-08 memory-stack research input recorded in DECISIONS.md (Q1/Q2/Q4/Q6 strengthened, forks stay open); packet's bitemporal port is now the gate for graphiti-memory decommission.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Four-tier agent-memory schema w/ confidence + conflict edges' (15 nuggets).
