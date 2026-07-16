# Frontend QA Round Dispatch

## Safety preamble

Do not run `git commit` or `git push`. Do not edit `.github/workflows/**` or
`docs/_internal/**`. Never claim done without running every named verification command below.
Obey all safety rails in `goals/goal-portfolio-driver/SPEC.md`.

Goal: `SLUG`
Stage: `frontend-qa`
Round: `N`
Lane root: `LANE_ROOT`
Budget already used: `BUDGET_USED`

Use Codex with the Chrome browser extension against the explicitly named lane URL and PID/port
manifest. Verify the requested user flows, console/network health, accessibility basics, and visual
regressions. Test only the named lane. Do not edit implementation in this QA round; write full QA
artifacts beside the verdict for the next Fable frontend-fix agent.

Named verification commands and flows:

```text
NAMED_VERIFICATION_COMMANDS_AND_FLOWS
```

End by writing exactly:

`goals/goal-portfolio-driver/ops/state/runs/SLUG/frontend-qa-rN.verdict.md`

The verdict must be at most 60 lines and use:

```yaml
---
status: pass|fail|blocked
goal: SLUG
stage: frontend-qa
round: N
budgetUsed: BUDGET_USED
nextAction: ONE_CONCRETE_ACTION
---
```

After frontmatter, include at most 15 finding bullets and `Evidence paths`. Cite screenshots,
browser artifacts, and reports by path only. Never paste logs, diffs, DOM dumps, transcripts, or
source/review content.
