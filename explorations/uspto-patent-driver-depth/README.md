# USPTO Patent Driver Depth

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The graduated patent-docketing spine needs official USPTO depth from the
hand-rolled `@beep/uspto` driver: first a known-application, provenance-bearing
prosecution observation, then a separately sequenced `PTMNFEE2` maintenance-fee
snapshot ingest. Extend the existing driver and shipped USPTO MCP host in place;
keep legal interpretation and reliability orchestration in their owning goals.

## Next Open Question

None while graduated. `uspto-search-structured`, EPO OPS, Google Patents
BigQuery, the SerpApi lane, and the approval-gated `uspto-ppubs-experiment`
remain MAP re-entry points; a fired gate reopens
this packet at `decompose`.

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — traceability ledger joining each
of the 26 mined gold nuggets to its upstream repo + `file:line`, the upstream
license + port discipline (AGPL CourtListener = clean-room only; MIT pattern
sources = port-with-attribution), the external research citations, and the
`@beep/*` capabilities this packet composes. Derived from the gold-intake cluster
`USPTO/patent driver depth` ([ROUTING.md](../_gold-intake/ROUTING.md),
[GOLD_SYNTHESIS.md](../_gold-intake/GOLD_SYNTHESIS.md)).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-08-13: holding-pen convention ratified; the packet flipped to
  `graduated`. Its spike-gated and consumer-pulled MAP lanes remain re-entry
  points, and a fired gate reopens this packet at `decompose`.
- 2026-07-14: shape gate signed off as drafted; graduated
  [`goals/uspto-prosecution-read`](../../goals/uspto-prosecution-read/README.md)
  and
  [`goals/uspto-ptmnfee2-ingest`](../../goals/uspto-ptmnfee2-ingest/README.md);
  packet stays active for queued and parked candidates.
- 2026-07-14: align closed with eight locked decisions; the `PTMNFEE2` research hole closed the same day; BRIEF.md and MAP.md drafted for shape sign-off.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'USPTO/patent driver depth (ODP, query DSL, File Wrapper, EPO, BigQuery)' (26 nuggets).
