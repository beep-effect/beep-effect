# T3 Code Fleet Rollout

## Status

Lifecycle: `completed-retained`

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

Closed by the single closeout PR (operator ruling 2026-11-08). Five hosts run `0.1.7-fork.20261108.758`, linked from DankStation at Full access until 2027-05-07. Open exception: reboot proof on tbk-worker and tom-pc-1 (`SPEC.md`, Exception Ledger).

## Latest Evidence

2026-11-08: `history/2026-11-08-closeout-verify.md` (version parity, reachability, one delegated turn per host, reboot evidence).

2026-11-07: `history/2026-11-07-p2-verify.md` (version parity, reachability, per-host turns, beep-worker MCP-approval fix, tom-pc-1 restart-path proof).

2026-11-06: `history/2026-11-06-dankserver-link.md` (Serve route and link) and `history/2026-11-06-tom-pc-1-wsl.md` (distro provisioned, keep-alive task, service, hub link, delegated turn); runbook gained the WSL host, client-plane pairing and gated tbk-worker sections.

## Notes

All hosts are linked: beep-worker, dankserver, tom-pc-1, tbk-worker (latch released 2026-11-07) and grok-bot (brought into scope 2026-11-08, decision `grok-bot-vm-in-scope`).
