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

P1 Implement, last slice. Slices P0 (profile probe, gate routing table, scheduler refusal; #2925)
and P1 (yeet posture, catalog hook skip; #2959) merged on 2026-11-08 with the fix #2972. Slice P2
(hosted `Catalog Regeneration` workflow, AGENTS.md, runbook and skill docs, Palantiri host-memory
line) is in the takeover PR from lane `goals/compute-profile-p2-takeover`. Remaining after it: the
worker-host end-to-end acceptance run (SPEC acceptance criterion 3), then the final PR with the
reflection and `proposedCloseout`.

## Latest Evidence

- `research/2026-11-08-p0-probe-evidence.md`: probe readings on DankStation and a capped scope.
- `research/2026-11-08-p1-yeet-lefthook-evidence.md`: yeet posture, final-check skips, hook skip.
- `research/2026-11-08-p2-hosted-regeneration.md`: the regeneration workflow, the Palantiri line,
  the docs touched and the 2026-11-13 takeover.

## Notes

- Sibling goal `catalog-writer-incremental` lands independently; merge `main` after it lands before touching `lefthook.yml`.
- Measured on 2026-11-07: Bun `constrainedMemory()` = slice `memory.high`, Node = `memory.max` (exploration RESEARCH.md).
- P1 (#2959) made the catalog hook skip profile-driven; the interim `LEFTHOOK_EXCLUDE=schema-catalog,instrumentation-catalog` in the dankserver worker accounts' environment is no longer needed.
