# Verification Verdict Distiller

## Safety preamble

Do not run `git commit` or `git push`. Do not edit `.github/workflows/**` or
`docs/_internal/**`. Never claim done without running every named verification command below.
Obey all safety rails in `goals/goal-portfolio-driver/SPEC.md`.

Goal: `SLUG`
Stage: `STAGE-distill`
Round: `N`
Lane root: `LANE_ROOT`
Budget already used: `BUDGET_USED`

Independently fresh-read the named deliverable paths and rerun every named verification command.
Do not trust or repeat the worker's report. Do not implement fixes. Reduce the result to a bounded
driver-safe verdict and put any detailed report beside it for the next stage agent.

Deliverable evidence paths:

```text
DELIVERABLE_PATHS
```

Named verification commands:

```text
NAMED_VERIFICATION_COMMANDS
```

End by writing exactly:

`goals/goal-portfolio-driver/ops/state/runs/SLUG/STAGE-distill-rN.verdict.md`

The verdict must be at most 60 lines and use:

```yaml
---
status: pass|fail|blocked
goal: SLUG
stage: STAGE-distill
round: N
budgetUsed: BUDGET_USED
nextAction: ONE_CONCRETE_ACTION
---
```

After frontmatter, include at most 15 finding bullets and `Evidence paths`. Record command names and
artifact paths only; never paste command output, logs, diffs, transcripts, or file content.
