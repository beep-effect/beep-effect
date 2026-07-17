# Goal Portfolio Driver

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Autonomously drain every locked portfolio goal through implementation, quality gates, merged PR,
reflection, and `completed-retained` while preserving resumable state and strict safety rails.

## Launch

Use this command in a Claude Fable execution session:

```text
/goal follow the instructions in goals/goal-portfolio-driver/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact Fable driver launcher.
2. [`SPEC.md`](./SPEC.md) - normative loop contract.
3. [`PLAN.md`](./PLAN.md) - phased execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - approved design and supporting research.
6. [`history/`](./history/) - final evidence and closeout reflections.

## Current Phase

P0 — Harden. Finish the remaining flaky-test and browser-QA smoke proofs, then fresh-read all P0
exit criteria before locking the queue in P1.

## Latest Evidence

PR #409 merged through the gated auto-merge pipeline on 2026-07-14; see
[`ops/status.md`](./ops/status.md) for the current heartbeat.

## Notes

The queue locked at P1 (2026-07-14): `ops/queue.json` carries 25 goals as immutable ordering and
dependency data (grill D1/D2). `goals/INDEX.md` remains lifecycle truth; remaining work is always
`queue ∩ INDEX.active`, derived fresh each wake.
