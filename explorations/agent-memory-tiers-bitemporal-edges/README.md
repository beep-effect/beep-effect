# Agent Memory Tiers & Bitemporal Edges

## Status

Stage: `research`
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

**Q2: What does this packet own versus consume or defer?** — the keystone fork:
it sets ownership against `rag-retrieval-projection` (the single RRF owner) and
`goals/trustgraph-port` (FalkorDB/GraphRAG), and getting it wrong duplicates
retrieval infrastructure across three packets. DECISIONS.md pre-drafts a
recommended answer for this and 6 sibling forks (build-vs-buy, first-slice,
storage/authority, package placement, conflict representation, invariant
enforcement), all left open. Resolve via
`run /grill-with-docs agent-memory-tiers-bitemporal-edges`.

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

- 2026-07-11: 2026-07-08 memory-stack research input recorded in DECISIONS.md (Q1/Q2/Q4/Q6 strengthened, forks stay open); packet's bitemporal port is now the gate for graphiti-memory decommission.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Four-tier agent-memory schema w/ confidence + conflict edges' (15 nuggets).
