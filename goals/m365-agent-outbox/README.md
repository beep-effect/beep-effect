# M365 Agent Outbox

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give agent sessions a firm-owned Microsoft 365 route that drafts mail, sends it with attachments, and writes calendar events, with every send explicit and audited.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/m365-agent-outbox/GOAL.md
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

P1 Implement. Slices 1 and 2 (driver mail verbs, the `beep-m365-outbox`
server) are written and package-verified. The live smoke waits on the
operator-attended registration; slice 3 (reply and forward drafts) follows it.

## Latest Evidence

- 2026-10-06: packet and registration runbook (slice 0).
- 2026-10-06: slices 1 and 2. `bun run beep quality package-verify` passes for
  `@beep/m365` and `@beep/m365-mcp`. The live smoke has not run.

## Notes

- The operator-attended registration is
  `docs/runbooks/m365-agent-outbox-registration.md`; it goes to the operator
  through the orchestrator session in one sitting with workstream A's.
- The claude.ai Microsoft 365 connector cannot attach files even with its
  write scopes; do not plan around it for attachments.
