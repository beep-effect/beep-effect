# T3-Native Orchestration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make T3 Code the only cross-session messaging route: delete beep's agent-to-agent stack and its packets, and rewrite the orchestrator, handoff, remote-worker and closeout guidance around T3's MCP tools.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/t3-native-orchestration/GOAL.md
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

P0 Research — not started. Start by re-verifying the removal map against current `main` and reading the installed T3 server's `tools/list`.

## Latest Evidence

Not started.

## Notes

First slice of the T3 fleet driver. Launch it from a T3 session on DankStation. Follow removal-map §0 order so every commit builds; re-verify each row against the current tree before deleting.
