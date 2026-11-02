# T3 Code Harness MCP

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Register `t3-hub` (the DankStation T3 environment, Full-access OAuth) in every harness that runs outside T3 on every live host, prove T3-launched sessions do not double-load it, and remind before the 30-day grants and links expire.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/t3code-harness-mcp/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

DankStation can start before the fleet rollout finishes; remote hosts follow as each one comes up. The operator approves each pairing request in T3 Settings.
