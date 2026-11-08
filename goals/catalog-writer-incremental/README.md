# Incremental Catalog Writer

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Latest evidence (2026-11-08): closeout `completed-retained` adopted after re-final #2940 verified (b30f73300e1). PR #2924 makes the scoped schema-catalog writer splice per file;
five-fixture run 5.31 GB / 15.3 s to 0.63 GB / 2.1 s with byte-identical shards
(`research/2026-11-08-rss-measurements.md`). Proposed closeout `completed-retained`; #2924 merged 2026-11-08 as 1f682563312 (S11 over an inherited coverage red), the goals-only re-final #2940 carries the completion gate;
reflection `history/reflections/2026-11-08-claude.md`.

## Mission

Per-file incremental shard splice for the lefthook catalog writers so a commit costs ~1 GB on any host (5.3 GB today for a repo-cli touch); graduated from `explorations/compute-profile-gate-routing` (D2, D7).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/catalog-writer-incremental/GOAL.md
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

- Baseline table (seven variants) in `explorations/compute-profile-gate-routing/RESEARCH.md`; reuse the same five fixture files for before/after.
- Sibling goal `compute-profile-gate-routing` skips these hooks on worker hosts until this lands; its MAP.md gated re-entry removes the skip once a dankserver commit measures ≤ 1.5 GB.
