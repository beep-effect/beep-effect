# Greptile Remediation Dispatch

## Safety preamble

Do not run `git commit` or `git push`. Do not edit `.github/workflows/**` or
`docs/_internal/**`. Never claim done without running every named verification command below.
Obey all safety rails in `goals/goal-portfolio-driver/SPEC.md`.

Goal: `SLUG`
Stage: `greptile-remediate`
Round: `N`
Lane root: `LANE_ROOT`
Budget already used: `BUDGET_USED`

Read the delegated Greptile report, not driver context. Classify every assigned issue as fix,
evidence-backed rebuttal, or stale; P1 security issues must be fixed. Implement bounded fixes and
draft replies in a separate report for Fable review. Do not post replies, resolve threads, or make
any GitHub write. Preserve thread IDs as evidence identifiers without copying thread bodies.

Named verification commands:

```text
NAMED_VERIFICATION_COMMANDS
```

End by writing exactly:

`goals/goal-portfolio-driver/ops/state/runs/SLUG/greptile-remediate-rN.verdict.md`

The verdict must be at most 60 lines and use:

```yaml
---
status: pass|fail|blocked
goal: SLUG
stage: greptile-remediate
round: N
budgetUsed: BUDGET_USED
nextAction: ONE_CONCRETE_ACTION
---
```

After frontmatter, include at most 15 finding bullets and `Evidence paths`. Cite changed files,
tests, draft-reply reports, and thread IDs only. Never dump logs, diffs, transcripts, source bodies,
or Greptile content.
