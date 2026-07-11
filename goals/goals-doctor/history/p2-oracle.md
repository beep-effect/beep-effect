# P2 Oracle — Index

Date: 2026-07-11. Branch: `feat/goals-doctor`.

Oracle (from `PLAN.md`): `bun run beep goals index --check` exits 0; a
scratch-edit of a manifest makes it exit 1 (evidence recorded, edit reverted).

## Actual output

```text
=== check on clean tree ===
[goals:index] OK: goals/INDEX.md matches the manifests.
=== scratch-edit a manifest (canvas title) ===
[goals:index] goals/INDEX.md drifts from goals/*/ops/manifest.json; run `bun run beep goals index --write`.
error: script "beep" exited with code 1
=== revert ===
[goals:index] OK: goals/INDEX.md matches the manifests.
```

Exact exit codes (drift edit re-applied, then reverted):

```text
drift_exit=1
clean_exit=0
```

## Deliverables in this phase

- `goals/INDEX.md` generated and committed: 83 packets — 21 active, 8 paused,
  44 completed-retained, 7 superseded, 3 reference; ~3.8k tokens (budget
  ≤ 25k).
- `goals/README.md`: hand-written "Current Goals Snapshot" deleted and
  replaced by the generated-index policy; Lifecycle section amended to the D1
  vocabulary (D8: `superseded` added, `paused` covers authored-but-not-started,
  `removed` demoted to an archive operation, `complete` no longer a valid
  declaration).
- `goals/_template/ops/manifest.json` bumped to `initiative-manifest/v2` with
  a `mission` placeholder; this packet's own manifest bumped to v2.
