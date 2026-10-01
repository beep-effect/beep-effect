# Cloud Agent Readiness

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make a fresh hosted agent container — Claude Code on the web today, any
ephemeral runner tomorrow — able to clone, install, prove, and publish from this
repo without a workstation: the pinned bun, reachable registries, a harness
that knows which host it is on, and a publish handoff that works where `gh`,
the systemd user manager, and 1Password do not exist.

## Why now

Opened at the operator's request on 2026-10-01. The first cloud probe session
could not install dependencies: the container's bun cannot read the lockfile,
the official bun installer host is denied, and the proxy denies `pkg.pr.new`,
which serves every Effect 4.0.0 snapshot package — so no `bun run beep`
command, typecheck, or test can run there. The full probe is
[`research/2026-10-01-container-probe.md`](./research/2026-10-01-container-probe.md).

This packet passes the roadmap's two accelerator tests. Named consumers: every
cloud session on every packet (the Lane 3 queue and the Lane 2 unlocks were
being sized for cloud lanes when the probe failed). Payback before horizon:
the operator's cloud credits expire 2026-10-08, and nothing else in the
portfolio can spend them until this lands.

## Launch

```text
/goal follow the instructions in goals/cloud-agent-readiness/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including decisions D1–D7.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/2026-10-01-container-probe.md`](./research/2026-10-01-container-probe.md) - the evidence (F1–F14).
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
7. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

P0 Research is complete (the probe). Next concrete action: P1 Toolchain
bootstrap — author `scripts/cloud-session-setup.sh` so one command takes a
fresh container from clone to a green `bun install --frozen-lockfile` and a
working `bun run beep --help`, and fails fast with a named remedy when the
environment's network policy denies a host.

## Latest Evidence

[`research/2026-10-01-container-probe.md`](./research/2026-10-01-container-probe.md):
bun `1.3.14` in the container versus the pinned `1.4.2`; `bun.sh` denied
(403); the GitHub release archive and `npm install bun@1.4.2` both work;
`pkg.pr.new` denied (403) so the install is silently incomplete and
`effect` is missing; the `GH_TOKEN` is invalid; no systemd user bus; no `op`;
three `.mcp.json` servers fail at session start.

## Notes

- The roadmap's machinery-first clause says no new machinery packet starts a
  lane slot while it holds. The operator opened this packet explicitly; it
  runs in parallel under the accelerator principle and does not take a slot.
  Its roadmap row lands in P4 in the same PR as the `AGENTS.md` section.
- The volume-pool doctrine is unchanged. A cloud session runs on the Anthropic
  pool and spends the operator's cloud credits — a fourth meter the runbook
  names alongside Opus, Cursor, and Codex.
- No secret enters a cloud container under this packet. Packets whose proof
  needs an `op://` env file stay outside the cloud lane (D5).
- Moving Effect off the `pkg.pr.new` snapshot onto a published release is a
  dependency-policy decision, not this packet's (non-goal); this packet makes
  the snapshot reachable and the failure loud.
