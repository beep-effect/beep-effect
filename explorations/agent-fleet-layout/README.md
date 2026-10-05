# Agent Fleet Layout

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `decompose`
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

None blocking. Brief confirmed by the operator and `MAP.md` names five goal
packets. Next session: run the definition-of-ready and graduate
`fleet-root-registry` first (others follow its sequencing), or hold at
`decompose` if the operator wants to review the map before scaffolding.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`DECISIONS.md`](./DECISIONS.md) - the sixteen settled decisions and one deferral.
3. [`BRIEF.md`](./BRIEF.md) - the confirmed pitch.
4. [`MAP.md`](./MAP.md) - five candidate goals, sequencing, first slice.
5. [`RESEARCH.md`](./RESEARCH.md) - workstation census, path-dependent surfaces, capability inventory.
6. [`research/fleet-census-2026-10-05.md`](./research/fleet-census-2026-10-05.md) - raw fleet mirror snapshot tables.
7. [`CAPTURE.md`](./CAPTURE.md) - the operator's original dump.

## Trail

- 2026-10-05 (second session): closed the deferred external sweep and the four census follow-ups (Bun already hardlinks; `beep-effect-private` is a separate repo; ai-metrics `raw` is 22 GB / 97% older than 30 d; mirror undercounts `beep-effect0-worktrees`). Amended deps-disk. Brief drafted and confirmed; `MAP.md` written. Stopped at `decompose`, ready for definition-of-ready.
- 2026-10-05: packet opened in lane `beep-effect8-worktrees/agent-fleet-layout`. Capture filed; in-repo and workstation research done (external sweep deferred); align closed in five grilling rounds, registry decision amended after `fleet-mirror` was found. Stopped at the start of `shape`.
