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

P4 Close. PR #1257 merged to `main` (`217e308592`, 2026-09-25); the lint-policy follow-up is PR #1271.
The seed deep pass finished 16:50 UTC (effect 15943/19938 cards, effect-tsgo 5257/5908) and the
`beep-refs-refresh` timer owner is `beep-effect0` (next run 2026-09-26 03:35 CDT). Remaining: closeout
reflection, remove the session symlink, retire the worktree (see
`history/2026-09-25-p2-p3-closeout.md`).

## Latest Evidence

[`history/2026-09-25-s4-move.md`](./history/2026-09-25-s4-move.md): move, worktree repair, structural
build (`effect/` 19937 nodes / 1679 cards, `effect-tsgo/` 5908 nodes / 1153 cards, `graft check` OK),
fleet relink (140 of 152 checkouts fully linked; 12 vendored-directory holdouts listed), timer
installed for 03:30, seed started 07:39 CDT. Federated and narrowed `graft ask` verified through
`.repos/effect-workspace` and `.repos/effect`; `beep worktree new` probe linked all three.

## Notes

- `beep-effect0` is the read-only graft owner clone; this packet was authored from a worktree of
  `beep-effect2` and must not run lanes in `beep-effect0`.
- The move itself (PLAN S4) is executed by the orchestrating session with the operator present,
  never by a Codex lane, and the deep seed runs once under systemd, never in the foreground.
- Graft facts the design depends on were read from the machine-local Graft checkout at v0.18.0
  (recorded in the frozen current-state report); re-verify `discoverWorkspaceChildren` and `isWorkspaceBuildRoot` if graft is upgraded before S4.
