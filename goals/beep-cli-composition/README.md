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

P0 Research is complete: the operator grill settled D1 to D20 (2026-10-21 to
2026-10-28) and an adversarial pass verified the package map. P1 starts with
the gate fix lanes G1 to G4 and the W0 retirements.

## Latest Evidence

- [`research/g4-task-fingerprint.md`](./research/g4-task-fingerprint.md): G4
  per-task policy fingerprint; 0 stale-green replays over 400 commits and
  task-instance invalidations halved, with the replay script in
  [`ops/g4-fingerprint-replay.ts`](./ops/g4-fingerprint-replay.ts).
- [`research/design-record.md`](./research/design-record.md): measured gate
  costs, coupling, the verified package map, the invalidation simulation, and
  the overlap with `goals/effected-promotion`.
- `standards/architecture/DECISIONS.md`, entry 2026-10-28 "One beep App
  Composes beep-Prefixed Command Tools".

## Notes

- W1 onward waits for `goals/effected-promotion` to close (D16). Its remaining
  waves edit the same repo-cli files.
- Supersedes `goals/repo-cli-modularization`.
