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

P1 Implement — publish and pull run unattended on beep-worker and dankserver (#2705, #2719), both linked on the agent plane. tom-pc-1's WSL distro `t3-agent` is provisioned and kept alive; its tailnet join, T3 install, link and the desktop-app pairing of dankserver wait on the operator (login approval, YubiKey touch).

## Latest Evidence

2026-11-06: `history/2026-11-06-dankserver-link.md` (Serve route and link) and `history/2026-11-06-tom-pc-1-wsl.md` (distro provisioned, keep-alive task, tailnet join pending); runbook gained the WSL host, client-plane pairing and gated tbk-worker sections.

## Notes

Host order: beep-worker (done), dankserver (linked), tom-pc-1 (WSL distro provisioned; tailnet join pending). tbk-worker is gated on the operator releasing its latch. grok-bot-box-1 is out of scope.
