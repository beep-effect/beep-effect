---
goal: runner-trust-boundary
agent: claude
date: YYYY-MM-DD
trigger: closeout
confidence: medium
findings:
  - category: tooling-friction
    confidence: high
    instruction: What to change.
    explanation: The friction observed and the evidence for it.
todos:
  - Concrete item worth codifying as a standard, skill, or tracked issue.
---

# Reflection: runner-trust-boundary (<date>, <agent>)

> Copy this file to `<YYYY-MM-DD>-<agent>.md` and fill it in. The YAML
> frontmatter above is the machine-validated block. The
> `ReflectionFrontmatter` schema is enforced by
> `bun run beep lint reflection-artifacts`.
>
> Frontmatter field domains:
>
> - `trigger`: `closeout` | `on-demand` | `todo-codify`
> - `confidence`: `high` | `medium` | `low`
> - `findings[].category`: `tooling-friction` |
>   `implementation-improvement` | `goal-critique` | `prompt-critique` |
>   `codification-todo`
> - each finding carries an `instruction` and an evidence-backed `explanation`

## Summary

<One to three sentences describing what the goal accomplished and the overall
verdict.>

## Tooling experience

- **Worked:** <Which tools, skills, or commands moved the work forward.>
- **Didn't:** <What got in the way or behaved unexpectedly.>
- **Frustrating:** <Friction, papercuts, or confusing behavior.>
- **Wished existed:** <A capability that would have helped.>

## Implementation improvement opportunities

- <Concrete improvements to the result.>

## Goal and prompt critique

Would you revise the goal or prompt to make it clearer or more efficient? Name
the exact edit.

- <Proposed edit.>

## TODOs worth codifying

- <An item that should become a standard, skill, lint rule, or issue.>

## Lessons by confidence

- **HIGH, critical:** <Instruction and evidence.>
- **MEDIUM, best practice:** <Instruction and evidence.>
- **LOW, consideration:** <Instruction and evidence.>
