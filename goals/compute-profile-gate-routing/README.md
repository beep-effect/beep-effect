# Compute-Profile Gate Routing

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Typed `workstation | worker` compute profile per `beep` process; worker hosts defer hosted-only gates, catalog hooks and local proof to hosted CI by construction (graduated from `explorations/compute-profile-gate-routing`, D1–D9).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/compute-profile-gate-routing/GOAL.md
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

P2 Verify. Implementation slices P0 (#2925), P1 (#2959, fix #2972) and P2 (#3226)
are merged. The 2026-11-13 dankserver acceptance run (#3267) failed criterion 3; #3276
fixed its findings, and the repeat run of 2026-11-13 (#3277) closed findings 1, 2, 4 and 6.
This lane settles criterion 2b by measurement: a forced gate on a worker completes
serially or refuses with its measured reason (decision 2026-11-13). Before the goal's
final PR with the reflection and closeout record: one short dankserver run showing a forced gate (coverage over a small package) completing with forceLocal: true on its receipt, and the lane's own draft-to-ready flip through yeet ready.

## Latest Evidence

- `research/2026-11-13-worker-host-acceptance-repeat.md`: criteria 1, 2a, 3 (except the lane's own ready flip) and 5 pass; forced fallow and coverage stopped by the slice-pressure watchdog.
- `research/2026-11-13-worker-host-acceptance.md`: failed criterion 3, forced-gate and admission gaps; repeat on dankserver after these fixes.

- `research/2026-11-08-p0-probe-evidence.md`: probe readings on DankStation and a capped scope.
- `research/2026-11-08-p1-yeet-lefthook-evidence.md`: yeet posture, final-check skips, hook skip.
- `research/2026-11-08-p2-hosted-regeneration.md`: the regeneration workflow, the Palantiri line,
  the docs touched and the 2026-11-13 takeover.

## Notes

- Sibling goal `catalog-writer-incremental` lands independently; merge `main` after it lands before touching `lefthook.yml`.
- Measured on 2026-11-07: Bun `constrainedMemory()` = slice `memory.high`, Node = `memory.max` (exploration RESEARCH.md).
- P1 (#2959) made the catalog hook skip profile-driven; the interim `LEFTHOOK_EXCLUDE=schema-catalog,instrumentation-catalog` in the dankserver worker accounts' environment is no longer needed.
