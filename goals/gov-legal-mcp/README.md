# Gov Legal MCP

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship a thin Effect-native `gov-legal-mcp` sibling over the two proven drivers,
`@beep/govinfo` and `@beep/ecfr`, with per-source credential gates and a
deterministic generated-tool-name collision contract.

## Launch

```text
/goal follow the instructions in goals/gov-legal-mcp/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains normative.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - P0–P3 execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - routing and lifecycle.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`mcp-kit`](../mcp-kit/README.md) and [`uspto-mcp`](../uspto-mcp/README.md) - shipped conventions.

## Current Phase

Closed 2026-07-31. All four phases are complete; the host shipped through the
Yeet PR flow with the collision contract, gated composition, and offline proofs.

## Latest Evidence

- P0 contract audit (240 live citations, frozen naming/report contract):
  [`history/2026-07-31-p0-contract-audit.md`](./history/2026-07-31-p0-contract-audit.md).
- `packages/drivers/gov-legal-mcp` ships `govinfo_search` (hard gate) and
  `ecfr_list_titles` / `ecfr_search_results` / `ecfr_get_structure` (none gate)
  through one stdio server; 12/12 offline tests, byte-stable
  `src/_generated/tool-name-collision-report.json`, package check/lint/docgen green.
- Closeout reflection:
  [`history/reflections/2026-07-31-claude.md`](./history/reflections/2026-07-31-claude.md).

## Notes

This packet does not resume the paused delivery goal or absorb Federal Register,
DOL, or CourtListener breadth. Driver expansion remains owned by
[`gov-legal-data-driver-delivery`](../gov-legal-data-driver-delivery/README.md).
