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

P3 Yeet — closeout proposed in PR #3167. **Verdict: Insensitive.** On the
laws-prompt pilot (24 B, 24 C runs), no task had an all-lanes or law pass, so
under the amended rule there was no scored run: this corpus cannot measure
the skill at Opus 5.5 without tools. The fired rate (17 of 24, 0.71) fired
the activation gate, and the source exploration reopened at `decompose`.
No prune proposal.

## Latest Evidence

- [Findings and verdict](./history/FINDINGS.md)
- [Laws-prompt pilot](./history/p1-laws-pilot/README.md) and
  [cell A pilot](./history/p1-headroom-pilot/README.md)
- [P0 slice receipt](./history/p0-slice/README.md),
  [preflight](./history/preflight.json),
  [void first P2 attempt](./history/p2-attempt-1/README.md)
- Analysis rule: [2026-11-12](./research/2026-11-12-analysis-rule.md),
  [amendment](./research/2026-11-13-analysis-rule-amendment.md),
  [amendment 2](./research/2026-11-13-analysis-rule-amendment-2.md),
  [primary selection](./research/2026-11-13-primary-selection.md)
- [Closeout reflection](./history/reflections/2026-11-13-claude.md)

## Notes

- This is a measurement. The SkillOpt retirement disposition (no replacement
  optimizer) still stands.
- Runs spend the Anthropic plan. Check `bun run beep accounts` before the
  scored run and pass a cost ceiling on every invocation.
- A null result is a legitimate verdict. It closes the trainer question for
  lint-enforceable skills and produces a prune proposal for a human.
