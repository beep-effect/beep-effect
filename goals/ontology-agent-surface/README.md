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

P2 Transport + Safety is complete locally. The sidecar mounts strict-Origin,
bearer-authenticated `/mcp`; read-only registration is independent of the
mutation feature gate; TierGate fails mutations closed; and authenticated MCP
caller identity is retained in each mutation's PROV-O journal. The sandbox
blocked node socket listen with `EPERM`, so the node-socket and live-sidecar
client transcripts remain host gates alongside P0's inherited ROBOT command.

## Latest Evidence

[`history/2026-07-11-p2-transport.md`](./history/2026-07-11-p2-transport.md)
records the mount policy, first-slice gate, TierGate precedent, attribution
path, HTTP fallback proof, host commands, and P3 risks. P1 evidence remains in
[`history/2026-07-11-p1-toolkit.md`](./history/2026-07-11-p1-toolkit.md), and P0 ROBOT evidence remains in
[`history/2026-07-11-p0-hardening.md`](./history/2026-07-11-p0-hardening.md).

## Notes

- The source exploration resolved five decisions and approved one goal packet.
- The first live proof is `capability-metadata` + `sparql-query` over the real
  authenticated `/mcp` endpoint from an actual MCP client.
- This packet is not complete until its PR work is driven to mergeable through
  `bun run beep yeet` and the P3 reflection gate passes.
