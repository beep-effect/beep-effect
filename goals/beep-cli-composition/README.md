# beep CLI composition

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Split @beep/repo-cli into apps/beep over beep-* command tools and repo-* libraries, after the gate fixes land

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/beep-cli-composition/GOAL.md
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

P1 Implement: G1 to G4 and W0 are done; W1 is running in two PRs (D25).
W1a clears every library-to-tool edge in `src/internal/**` and adds the
full-edge census; W1b carves the whole library map and holds the census at
zero library-to-tool edges (D27). W2 starts next.

## Latest Evidence

- [`research/w1-edge-census.md`](./research/w1-edge-census.md): the W1 full-edge
  census (`ops/edge-census.ts`); library-to-tool edges 7 to 0, cross-tool
  edges 127 to 124.
- [`research/g4-task-fingerprint.md`](./research/g4-task-fingerprint.md): G4
  per-task policy fingerprint; 0 stale-green replays over 400 commits and
  task-instance invalidations halved, with the replay script in
  [`ops/g4-fingerprint-replay.ts`](./ops/g4-fingerprint-replay.ts).
- [`research/design-record.md`](./research/design-record.md): measured gate
  costs, coupling, the verified package map, the invalidation simulation, and
  the overlap with `goals/effected-promotion`.
- [`research/g3-lazy-dispatch.md`](./research/g3-lazy-dispatch.md): G3 lazy
  dispatch design, the 501-path help surface diff and the startup timings
  (`beep --help` 1.61 s / 511 MB to 0.25 s / 115 MB).
- [`research/g2-coverage-shards.md`](./research/g2-coverage-shards.md): G2
  repo-cli coverage split into four Vitest shards, with before/after timings and
  the merged-coverage equality proof.
- `standards/architecture/DECISIONS.md`, entry 2026-10-28 "One beep App
  Composes beep-Prefixed Command Tools".

## Notes

- `goals/effected-promotion` closed (#2476), so W1 onward is unblocked (D16).
- Supersedes `goals/repo-cli-modularization`.
