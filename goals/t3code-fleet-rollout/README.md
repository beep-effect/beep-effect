# T3 Code Fleet Rollout

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run the fork build of T3 Code as a tailnet-only systemd service on every live worker host, distributed by a DankStation publish and a hash-verified host pull, linked hub-and-spoke to DankStation.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/t3code-fleet-rollout/GOAL.md
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

P1 Implement — the host profiles landed (#2594), P0 host facts are recorded in `PLAN.md`; the DankStation publish step and the host pull timer are written under `ops/` and are being rolled to beep-worker and dankserver. tom-pc-1 (WSL distro) and the agent-plane links follow.

## Latest Evidence

2026-11-05: P0 live reads of beep-worker and dankserver (official `t3@0.1.5` services); publish and pull scripts in `ops/`; runbook `docs/runbooks/t3code-fleet.md`.

## Notes

Host order: beep-worker (already runs T3), dankserver, tom-pc-1 (new WSL distro; restore an access route first). tbk-worker is gated on the operator releasing its latch. grok-bot-box-1 is out of scope.
