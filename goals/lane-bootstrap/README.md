# Lane Bootstrap

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

`beep worktree add` creates, registers and wires a lane under the fleet lanes dir with shared caches; desktop-app and Codex lanes are adopted on sight.

Depends on: [`goals/fleet-root-registry`](../../goals/fleet-root-registry/README.md)
Graduated from [`explorations/agent-fleet-layout`](../../explorations/agent-fleet-layout/README.md) on 2026-10-05.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lane-bootstrap/GOAL.md
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

P0 complete; P1 blocked until `goals/fleet-root-registry` merges its roots list, registry overlay and scan adoption (operator ruling `order-registry-first`). See `research/p0-live-source-scope.md`.

## Latest Evidence

P0 scope check: `research/p0-live-source-scope.md` (2026-11-06) maps the live creator (`worktree new`), sibling-root derivation, install, turbo cache and graft surfaces, and records the dependency blocker in `decisions/2026-11-07-p0-complete-p1-blocked.md`.

P0 research: `research/worktrunk-evaluation.md` (2026-11-06) evaluates Worktrunk, records the do-not-adopt verdict, and lands two decision files under `decisions/`.

## Notes

Decisions that shaped this goal live in the exploration's `DECISIONS.md`; do not re-litigate them here. Workstation facts (223 checkouts, 18 live, timers on beep-effect0/5/7, 22 GB ai-metrics raw) are in the exploration's `RESEARCH.md` and dated 2026-10-05.
