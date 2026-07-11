# Ontology Agent Surface

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Expose the ontology workbench to agents through a curated, task-oriented MCP
toolkit on the professional-desktop sidecar: stateless over saved Turtle files,
CAS-safe, authenticated, gated, attributed, budgeted, and proven against the
real ontology engine stack.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ontology-agent-surface/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (locked constraints).
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 hardening to P3 close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited implementation
   source corpus and provenance.
6. [`history/`](./history/) - evidence, benchmarks, closeouts, and reflections.

## Current Phase

P1 Toolkit Definition is complete locally. The nine worker-safe schema tools,
thin real-engine handlers, semantic rdfc-1.0 CAS, static budgets, typed
recoverable refusals, and shared ingestion classifier are implemented and
tested. P0's ROBOT interop command remains an inherited host gate; P2 transport,
TierGate, and authenticated actor attribution have not begun.

## Latest Evidence

[`history/2026-07-11-p1-toolkit.md`](./history/2026-07-11-p1-toolkit.md)
records the P1 contracts, semantic CAS decision, budgets, typed errors,
real-engine proof, local gates, and P2 risks. P0 ROBOT evidence remains in
[`history/2026-07-11-p0-hardening.md`](./history/2026-07-11-p0-hardening.md).

## Notes

- The source exploration resolved five decisions and approved one goal packet.
- The first live proof is `capability-metadata` + `sparql-query` over the real
  authenticated `/mcp` endpoint from an actual MCP client.
- This packet is not complete until its PR work is driven to mergeable through
  `bun run beep yeet` and the P3 reflection gate passes.
