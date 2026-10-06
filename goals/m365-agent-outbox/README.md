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
server) landed in [PR #1471](https://github.com/beep-effect/beep-effect/pull/1471)
on 2026-10-06; its live smoke passed on the firm tenant. Slice 3 (reply and
forward drafts) remains future work. The research D-28 reconciliation and
versioned audit follow-up also remain unimplemented.

## Latest Evidence

- 2026-10-06: packet and registration runbook (slice 0).
- 2026-10-06: slices 1 and 2. `bun run beep quality package-verify` passes for
  `@beep/m365` and `@beep/m365-mcp`.
- 2026-10-06: live smoke passed on the firm tenant, read, write and one
  self-send (`history/2026-10-06-live-smoke.md`).

## Notes

- The operator-attended registration is
  `docs/runbooks/m365-agent-outbox-registration.md`; it goes to the operator
  through the orchestrator session in one sitting with workstream A's.
- The claude.ai Microsoft 365 connector cannot attach files even with its
  write scopes; do not plan around it for attachments.

Research intake: [unknown send-outcome correction](research/RESEARCH-CORPUS-2026-10.md)
from [research-corpus-synthesis](../../explorations/research-corpus-synthesis/README.md),
with SPEC D-28 and a fixture-phase checkpoint. Lifecycle is unchanged.
