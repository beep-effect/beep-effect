# Agent Fleet Layout

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `shape`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Twenty-three operator clones and 223 checkouts of one monorepo share a
workstation; 18 are live. Agents and the operator both pick where work lands
by convention, and the convention has drifted into six empty worktree roots,
eleven ad hoc sibling worktrees, 88 GB of per-lane `node_modules`, and timers
scattered across three clones. Replace the clone-numbered sprawl with a
lane-first fleet: a few role-named seats, one flat lanes directory, an
authored registry over the existing fleet mirror, shared caches by default,
and drain-on-empty retirement.

## Next Open Question

None blocking. Sixteen decisions are logged; the external landscape sweep is
DEFERRED into `shape`. Next session: run that sweep, reconcile the
`beep-effect0-worktrees` census mismatch (35 dirs vs 1 mirrored checkout),
census `beep-effect-private` and the ai-metrics data root by class, then
draft `BRIEF.md`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`DECISIONS.md`](./DECISIONS.md) - the sixteen settled decisions and one deferral.
3. [`RESEARCH.md`](./RESEARCH.md) - workstation census, path-dependent surfaces, capability inventory.
4. [`research/fleet-census-2026-10-05.md`](./research/fleet-census-2026-10-05.md) - raw fleet mirror snapshot tables.
5. [`CAPTURE.md`](./CAPTURE.md) - the operator's original dump.

## Trail

- 2026-10-05: packet opened in lane `beep-effect8-worktrees/agent-fleet-layout`. Capture filed; in-repo and workstation research done (external sweep deferred); align closed in five grilling rounds, registry decision amended after `fleet-mirror` was found. Stopped at the start of `shape`.
