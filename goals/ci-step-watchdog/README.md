# CI Step Watchdog

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

This packet is authored but not yet started. Resume by setting the packet to
`active` and launching the command below.

## Mission

Bound every captured CI step with a per-step watchdog that converts runtime
hangs (the bun#27766/#34069 busy-spin class) into a forensic dump plus one
retried step, so no lane ever again burns a 50-minute timeout blind.

## Launch

Use this command after the packet is activated:

```text
/goal follow the instructions in goals/ci-step-watchdog/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth and decision log.
3. [`PLAN.md`](./PLAN.md) - W1-W4 execution sequence and proof gates.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - carried research corpus.
6. [`history/`](./history/) - evidence and closeouts, when present.

## Current phase

Paused before W1. On activation, begin with the W1 split-await lifecycle
events, then keep W1-W3 joined as the first Lint Policy vertical slice.

## Latest evidence

Not started. The operator-confirmed brief, decomposition, decisions, and root
cause evidence remain in the source
[`ci-hang-observability`](../../explorations/ci-hang-observability/README.md)
exploration.

## Notes

- W1-W3 must first prove watchdog fire, dump, group kill, one retry, and a
  green lane through the existing fake-spawner test pattern.
- W4 follows that slice. The planned Bun 1.4.0 canary was superseded by PR
  #769's ungated pin bump (2026-08-23); W4 records a post-bump soak instead —
  7 calendar days AND at least 30 Lint Policy runs on 1.4.0.
- Coordinate before editing `.github/workflows/check.yml`; its only planned
  structural change is the `always()` watchdog-artifact upload step.
