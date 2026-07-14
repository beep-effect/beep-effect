---
goal: law-doc-structure-oa-slice
agent: claude
date: YYYY-MM-DD
trigger: closeout
confidence: medium
findings:
  - category: tooling-friction
    confidence: high
    instruction: What to change.
    explanation: Why — the friction observed and the evidence for it.
todos:
  - Concrete item worth codifying as a standard, skill, or tracked issue.
---

# Reflection — law-doc-structure-oa-slice (<date>, <agent>)

> Copy this file to `<YYYY-MM-DD>-<agent>.md` and fill it in. The YAML
> frontmatter above is machine-validated by `ReflectionFrontmatter` through
> `bun run beep lint reflection-artifacts`.
>
> Field domains:
> - `trigger`: `closeout` | `on-demand` | `todo-codify`
> - `confidence`: `high` | `medium` | `low`
> - `findings[].category`: `tooling-friction` |
>   `implementation-improvement` | `goal-critique` | `prompt-critique` |
>   `codification-todo`

## Summary

<What this goal accomplished and the overall verdict.>

## Tooling experience

- **Worked:** <Tools, skills, and commands that moved the work forward.>
- **Didn't:** <What behaved unexpectedly or blocked progress.>
- **Frustrating:** <Papercuts or confusing surfaces.>
- **Wished existed:** <Missing capabilities.>

## Implementation improvement opportunities

- <Concrete improvements to what was built.>

## Goal & prompt critique

- <A specific edit that would make the launcher or prompt clearer.>

## TODOs worth codifying

- <A standard, skill, lint rule, or tracked issue worth creating.>

## Lessons (confidence-tiered)

- **HIGH — Critical:** <Instruction and evidence.>
- **MEDIUM — Best practice:** <Instruction and evidence.>
- **LOW — Consideration:** <Instruction and evidence.>
