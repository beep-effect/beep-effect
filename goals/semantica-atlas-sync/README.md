# Semantica Atlas Sync

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Write the ratified positive `Verdict` and `Beep counterpart` values into the
Notion `@beep/semantica` atlas from a schema-validated verdicts file
(`atlas-verdicts/v1`) through the P5 method — render, diff against a live
33-catalog read, one canary write, apply, SQL read-back — on exactly the rows
the file lists and with zero Notion schema. The IR facts lane stays a gated
P2 on semantica 0.6.7+.

Graduated 2026-09-03 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.1 re-entry packet A, ratified 2026-09-03 as R3 with R3.a–R3.g).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/semantica-atlas-sync/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative scope, constraints, acceptance, and
   stop conditions; every section back-links the exploration instead of
   restating it.
3. [`PLAN.md`](./PLAN.md) - P0-P3 execution plan (access check + live
   baseline, verdict lane, gated facts lane, close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - goal-side mirror of the
   exploration's provenance ledger.
6. Exploration contracts in force:
   [`MAP.md` §A](../../explorations/semantica-lab/MAP.md#a-semantica-atlas-sync--split-d5-into-a-verdict-lane-and-a-facts-lane)
   v1.1,
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) (Current
   law table: Atlas writes, Atlas backlog, Verdict map; the 2026-09-03
   ratification grill R3.a–R3.g).
7. [`goals/semantica-canary/history/p5-atlas-sync.md`](../semantica-canary/history/p5-atlas-sync.md)
   - the proven method, the six rows written, and the four rows declined.
8. [`history/`](./history/) - access receipt, baseline, apply plan, receipts
   and the closeout reflection.

## Current phase

P0 Access check + live baseline — not started. First action: a one-catalog
Notion read from the operating session's own connection; then the live
`Verdict` read across the 33 catalogs and the exact-row enumeration in
the exploration's `research/atlas/verdicts.json`.

## Latest evidence

Not started.

## Notes

- **Sequencing.** First of the three re-entry packets: hours of docs plus
  Notion, no code risk; it settles the atlas vocabulary the two spikes later
  write into.
- **Scope ceiling.** At most the four P5-declined rows (`Oxigraph
  (embedded)`, embedding-model `OpenAI`, `pattern`, `llm`) plus `already-have`
  rows that each have a dated, row-specific `DECISIONS.md` entry (R3.b,
  R3.d); the park baseline comes from the live read, reconciling the six P5
  parks with the thirteen 2026-08-24 D10 auto-parks.
- **Access.** Notion access was not live-verified on 2026-09-03; the Codex
  Notion MCP grant was revoked on 2026-09-02. The writes come from the
  operating session's own connection, as P5's did.
- **After P1.** In the verdict-lane PR itself the packet is set `paused` with the resume condition
  "semantica 0.6.7+ ships, recorded in a dated `DECISIONS.md` entry"; the
  extractor (git history `fd560ca8e5`) and its home wait for that lane.
