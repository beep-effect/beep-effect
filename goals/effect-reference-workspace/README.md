# Effect Reference Workspace

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Consolidate the upstream Effect clones agents read as truth into
the manifest-configured reference root, index them with graft in workspace mode with a nightly
`claude-opus-5` deep tier, and reach them from every beep-effect checkout through stable
`.repos/effect`, `.repos/effect-tsgo`, and `.repos/effect-workspace` links provisioned from a
checked-in manifest.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-reference-workspace/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan (slices S1–S4).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/2026-09-25-00-aligned-design.md`](./research/2026-09-25-00-aligned-design.md) -
   rulings R1–R14 from the 2026-09-25 grill.
6. [`research/2026-09-25-01-current-state.md`](./research/2026-09-25-01-current-state.md) -
   live census: clones, existing graft state, provisioner, nightly env, toolchain gotcha.
7. [`research/2026-09-25-02-fleet-census.md`](./research/2026-09-25-02-fleet-census.md) -
   per-checkout `.repos/effect` link table (144 checkouts, 104 missing).
8. [`research/SOURCES.md`](./research/SOURCES.md) - source ledger.
9. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

P1 Implement, slice S1 (manifest + provisioner) not started. Next concrete action: a Codex
`gpt-6-astra` medium lane implements S1 from `PLAN.md` in this worktree.

## Latest Evidence

Not started. P0 evidence is the three research files above.

## Notes

- `beep-effect0` is the read-only graft owner clone; this packet was authored from a worktree of
  `beep-effect2` and must not run lanes in `beep-effect0`.
- The move itself (PLAN S4) is executed by the orchestrating session with the operator present,
  never by a Codex lane, and the deep seed runs once under systemd, never in the foreground.
- Graft facts the design depends on were read from the machine-local Graft checkout at v0.18.0
  (recorded in the frozen current-state report); re-verify `discoverWorkspaceChildren` and `isWorkspaceBuildRoot` if graft is upgraded before S4.
