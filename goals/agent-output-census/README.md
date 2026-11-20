# Agent Output Census

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the transcript census a repeatable command so every other goal is judged with the instrument
that set the baseline.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agent-output-census/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth. Its Target Surfaces table says what
   `@beep/repo-ai-metrics` already reads and what the census adds.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, inherited from the exploration.
6. [`decisions/`](./decisions/) - the exploration ruling this goal carries.
7. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

All phases complete. `bun run beep ai-metrics census` runs the census; the reproduction run is the first baseline file.

## Latest Evidence

2026-11-19 reproduction ([history/2026-11-19-reproduction.md](./history/2026-11-19-reproduction.md)):
the census reproduces the 2026-11-18 audit on its window. 157 of 181 compared rows are within tolerance.
Each of the other 24 is attributed to a named rule difference in `decisions/`. The run file is
[`standards/agent-output-census/runs/2026-11-18T11-57-45Z--census-rules-2026-11-18.json`](../../standards/agent-output-census/runs/2026-11-18T11-57-45Z--census-rules-2026-11-18.json).
Headline rows on that run:

- verification is 19.9% of Claude turns;
- 92.3% of verification runs are piped through a filter;
- 0.148 log digs follow each verification run;
- a verdict costs 1.24 turns;
- tool output measures 2.30 characters per token.

## Notes

Graduated 2026-11-18 from `explorations/agent-verification-output` (MAP candidate 2). It has no
dependency and gates nothing. Goals that finish before it cite output-size fixtures; goals that
finish after it also cite its rows.

The census reads private transcripts and the repository is public. Its output and every tracked
file it writes hold numbers and closed class names only.
