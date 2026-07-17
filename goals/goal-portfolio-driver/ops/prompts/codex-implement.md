# Codex Implementation Dispatch

## Safety preamble

Do not run `git commit` or `git push`. Do not edit `.github/workflows/**` or
`docs/_internal/**`. Never claim done without running every named verification command below.
Obey all safety rails in `goals/goal-portfolio-driver/SPEC.md`.

Goal: `SLUG`
Stage: `STAGE`
Round: `N`
Lane root: `LANE_ROOT`
Budget already used: `BUDGET_USED`

Read the goal packet, assigned phase/PR-unit brief, and evidence paths from the prior verdict. Make
only the smallest in-scope implementation. Preserve unrelated changes. Do not perform GitHub
writes, resolve review threads, change repository settings, or weaken any quality gate.

Named verification commands:

```text
NAMED_VERIFICATION_COMMANDS
```

Run each command from the lane root. If one fails, record the command and an evidence path; do not
dump its output. End by writing exactly:

`goals/goal-portfolio-driver/ops/state/runs/SLUG/STAGE-rN.verdict.md`

The verdict must be at most 60 lines and use this contract:

```yaml
---
status: pass|fail|blocked
goal: SLUG
stage: STAGE
round: N
budgetUsed: BUDGET_USED
nextAction: ONE_CONCRETE_ACTION
---
```

After the frontmatter, include at most 15 finding bullets and an `Evidence paths` list. Use paths
only—never paste logs, diffs, transcripts, source bodies, or review-thread content.
