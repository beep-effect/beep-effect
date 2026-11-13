# Skill Effect Probe

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Measure whether loading the `schema-first-development` skill changes what Opus 5.5
produces on the 12 archived SkillOpt tasks. Three cells per task (bare prompt, code
laws, code laws plus skill), about 180 runs through `claude plugin eval`, scored by
the retained law scorer, and a verdict against a rule fixed before any scored run.

Graduated from
[`explorations/skillopt-corpus-headroom`](../../explorations/skillopt-corpus-headroom/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/skill-effect-probe/GOAL.md
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

P2 Verify — blocked on the Claude plan's seven-day limit, which resets
2026-11-15 23:00 America/Chicago. P0 passed and P1 is in: the probe commands
(`beep agent-effectiveness evals probe stage|preflight|score|report`), the
preflight (12 of 12 pass under scorer profile v2), the
[analysis rule](./research/2026-11-12-analysis-rule.md) and its
[amendment](./research/2026-11-13-analysis-rule-amendment.md), both
committed before any scored run record. The first P2 attempt ended on the
plan limit and is [void](./history/p2-attempt-1/README.md). Next after the
reset: the cell A headroom pilot, its go or no-go, then the scored run.

## Latest Evidence

- [P0 slice receipt](./history/p0-slice/README.md)
- [Preflight](./history/preflight.json)
- [Analysis rule](./research/2026-11-12-analysis-rule.md) and
  [amendment](./research/2026-11-13-analysis-rule-amendment.md)
- [Void first P2 attempt](./history/p2-attempt-1/README.md)

## Notes

- This is a measurement. The SkillOpt retirement disposition (no replacement
  optimizer) still stands.
- Runs spend the Anthropic plan. Check `bun run beep accounts` before the
  scored run and pass a cost ceiling on every invocation.
- A null result is a legitimate verdict. It closes the trainer question for
  lint-enforceable skills and produces a prune proposal for a human.
