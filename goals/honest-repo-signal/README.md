# Honest Repo Signal

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

One-night honesty pass: delete VERSION-only driver packages, keep their owning
goals as follow-ups, stop coverage and history from lying, and ship the cheap
public-repo and agent-kernel files.

## Launch

```text
/goal follow the instructions in goals/honest-repo-signal/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) — cut/keep, one-night checklist, locked decisions.
3. [`PLAN.md`](./PLAN.md) — phases and execution notes.
4. [`research/FOLLOW-UPS.md`](./research/FOLLOW-UPS.md) — deleted stubs mapped
   to the goals that still owe the real drivers.
5. [`research/SOURCES.md`](./research/SOURCES.md) — provenance.
6. [`ops/manifest.json`](./ops/manifest.json) — machine routing.

## Current Phase

P2 verified. Tree change is in this checkout. P3 Yeet / P4 Close are not
part of this execution.

## Latest Evidence

2026-08-13: three VERSION-only drivers deleted; identity `compose()` slugs
match `bun run topo-sort` (minus `@beep/root`); unused better-auth catalog
removed; public files and AGENTS.md Touch table landed. Identity
`shape-stable` tests: 10/10 pass.
