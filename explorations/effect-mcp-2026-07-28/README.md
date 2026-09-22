# Effect MCP 2026-07-28 Stateless Protocol Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Effect-TS/effect#7265 merged the MCP `2026-07-28` protocol adapter (stateless `server/discover`,
`McpRequestContext`, multi-round-trip tool results, `subscriptions/listen`, JSON
`structuredContent`). Every in-repo MCP server still pins `McpProtocol.v2025_06_18` through
`@beep/mcp-kit`, and the upstream handler-requirement change breaks the kit before any protocol
switch.

## Next Open Question

Should G4 (`McpProtocol.v2026_07_28` only) be reopened at the align grill? Verified research shows
a 2026-only list rejects `initialize` from every in-repo wire client and leaves `GovernedTierGate`
with no server-minted identity, while upstream supports mixed lists with one stateless adapter.
(Research stage: all ten lanes and Gate B verification complete; synthesis and Gate C next.)

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-09-16: packet opened from a plan-mode grounding grill; G1–G9 scope decisions logged;
  stage set to research with native grok CLI lanes.
- 2026-09-16: Gate A plan review (28 findings, briefs rewritten); ten grok research lanes and the
  orchestrator snapshot spike (`research/25-r4-spike-census.md`) complete.
- 2026-09-17: Gate B verification complete: 184 claims, 175 survive, 9 struck
  (`research/verification/README.md`). Manifest open questions reseeded for the align grill.
