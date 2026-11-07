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

P2 Verify complete — all four hosts on `0.1.7-fork.20261106.1401`, every link reachable, desktop pairings confirmed, one delegated turn per host (beep-worker after approving its project MCP state). Residual: tom-pc-1 reboot proof at the PC user\'s next sign-in (restart path already exercised). Next: P4 Close.

## Latest Evidence

2026-11-07: `history/2026-11-07-p2-verify.md` (version parity, reachability, per-host turns, beep-worker MCP-approval fix, tom-pc-1 restart-path proof).

2026-11-06: `history/2026-11-06-dankserver-link.md` (Serve route and link) and `history/2026-11-06-tom-pc-1-wsl.md` (distro provisioned, keep-alive task, service, hub link, delegated turn); runbook gained the WSL host, client-plane pairing and gated tbk-worker sections.

## Notes

Host order: beep-worker (done), dankserver (linked), tom-pc-1 (linked). tbk-worker is gated on the operator releasing its latch. grok-bot-box-1 is out of scope.
