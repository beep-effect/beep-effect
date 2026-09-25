# Effect Reference Workspace

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Consolidate the upstream Effect clones agents read as truth into
`~/YeeBois/references/effect/`, index them with graft in workspace mode with a nightly
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

P2 Verify. S1–S3 landed on `feat/refs-workspace-impl` (Codex astra-medium lanes) and S4 ran on
2026-09-25 with the operator present: clones moved, workspace built and checked, fleet relinked,
`beep-refs-refresh` timer installed and seeded once. Next concrete action: confirm the deep tier
from `~/.local/state/beep/refs/last-refresh.json` the morning of 2026-09-26, then re-point the
timer owner to `beep-effect0` after the PR merges (see `history/2026-09-25-s4-move.md`).

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
- Graft facts the design depends on were read from `~/YeeBois/dev/Graft` at v0.18.0; re-verify
  `discoverWorkspaceChildren` and `isWorkspaceBuildRoot` if graft is upgraded before S4.
