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

P0 Research — not started.

## Latest Evidence

2026-11-18 baseline, from the exploration's transcript audit: verification is 19.9% of agent
turns; agents pipe more than nine in ten verification runs through `tail`, `head` or `grep`; 9% of
runs are followed by a log dig; tool output measures 2.28 characters per token.

## Notes

Graduated 2026-11-18 from `explorations/agent-verification-output` (MAP candidate 2). It has no
dependency and gates nothing. Goals that finish before it cite output-size fixtures; goals that
finish after it also cite its rows.

The census reads private transcripts and the repository is public. Its output and every tracked
file it writes hold numbers and closed class names only.
