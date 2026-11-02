# Wake Service

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Port skulk to Effect as a durable wake service that delivers one wake per time or event through the agent-message router, with a quota-only fallback dispatcher and a workstation daemon behind a dead-man check.

Graduated 2026-10-31 from
[`explorations/expiring-repo-facts`](../../explorations/expiring-repo-facts/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/wake-service/GOAL.md
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

Starts after `goals/hold-ledger` has a working ledger. Port skulk with MIT attribution; read the skulk section of the exploration `RESEARCH.md` first.
