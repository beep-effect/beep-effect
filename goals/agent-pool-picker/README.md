# Agent Pool Picker

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

Authored, not started. Resumes when `goals/agent-pool-doctrine` ships; its seat map and floors are
this packet's input.

## Mission

Ship `beep agent-pool pick [--tier volume|review|mechanical]`: read the Codex meter, apply the pool
floors, and print the exact lane command the doctrine implies, or `hold` with reasons.

## Launch

```text
/goal follow the instructions in goals/agent-pool-picker/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md) 2. [`SPEC.md`](./SPEC.md) 3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json) 5. [`research/SOURCES.md`](./research/SOURCES.md)
6. `goals/agent-pool-doctrine/SPEC.md` and `explorations/cursor-agent-pool/MAP.md`.

## Current Phase

Not started (gated on Goal A's merge).

## Latest Evidence

Not started. The Codex meter probe it wraps is proven in
`explorations/cursor-agent-pool/RESEARCH.md`.

## Notes

- Schema → service → command order: `PoolSnapshot`, `Tier`, `Seat`, `LaneCommand` first, then a
  `CodexMeter` service over `codex app-server` stdio JSON-RPC, then the command.
- Cursor status is fail-open plus a dry-marker file written by the lane wrapper on the limit signature.
- Proxy-account meters join only if CLIProxyAPI's management API exposes quota (NOT FOUND today).
