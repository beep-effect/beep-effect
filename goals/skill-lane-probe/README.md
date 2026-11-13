# Skill Lane Probe

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Measure whether loading the `schema-first-development` skill changes the
lane-fraction score Opus 5.5 earns on the 12 archived SkillOpt tasks: the laws
prompt with the skill against the laws prompt without it, 120 fresh scored
runs, and a verdict against a rule that is on `main` before any of them.

Graduated from
[`explorations/skillopt-corpus-headroom`](../../explorations/skillopt-corpus-headroom/README.md).
It follows [`goals/skill-effect-probe`](../skill-effect-probe/README.md), which
returned Insensitive and left the tooling this goal reuses.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/skill-lane-probe/GOAL.md
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

Not started. Authored 2026-11-13.

## Notes

- The primary measure was chosen after the first probe's pilot contrast was
  seen. The defence is in `SPEC.md`: fresh runs only, and a rule merged
  before the first scored run.
- The verdict covers these 12 tasks and Opus 5.5 only.
