# Gov Legal MCP

## Status

Lifecycle: `active`

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

P0 Contract audit: inventory the exported GovInfo/eCFR operations, freeze the
wire-name normalization/cap/report schema, and verify the shipped MCP kit’s
`none|soft|hard`, sanitized-span, annotation, and toolkit-composition surfaces.

## Latest Evidence

Promotion gate cleared: `@beep/govinfo` and `@beep/ecfr` are proven current
consumers of the promoted `@beep/api-transport` substrate.

## Notes

This packet does not resume the paused delivery goal or absorb Federal Register,
DOL, or CourtListener breadth. Driver expansion remains owned by
[`gov-legal-data-driver-delivery`](../gov-legal-data-driver-delivery/README.md).
