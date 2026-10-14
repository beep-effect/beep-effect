---
goal: <goal-slug>
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

# Reflection — <goal-slug> (<date>, <agent>)

> Copy this file to `<YYYY-MM-DD>-<agent>.md` and fill it in. The YAML frontmatter
> above is the machine-validated block (schema: `ReflectionFrontmatter`, enforced by
> `bun run beep lint reflection-artifacts`); the body below is the human narrative.
>
> Frontmatter field domains:
> - `trigger`: `closeout` | `on-demand` | `todo-codify`
> - `confidence` (overall and per finding): `high` | `medium` | `low`
> - `findings[].category`: `tooling-friction` | `implementation-improvement` |
>   `goal-critique` | `prompt-critique` | `codification-todo`
> - each finding carries an `instruction` (what to change) and an `explanation`
>   (why) — information-rich reflections measurably outperform terse advice.

## Summary

<1–3 sentences: what this goal accomplished and the overall verdict.>

## Tooling experience

- **Worked:** <which tools/skills/commands moved the work forward.>
- **Didn't:** <what got in the way or behaved unexpectedly.>
- **Frustrating:** <friction, papercuts, confusing surfaces.>
- **Wished existed:** <capabilities you reached for that weren't there.>

## Implementation improvement opportunities

- <Concrete improvements to what was built in this packet.>

## Goal & prompt critique

Would you revise the `GOAL.md` / prompt you were given to be clearer, easier, more
efficient, or less confusing? Be specific — propose the actual edit.

- <…>

## TODOs worth codifying

- <Agent-detected items that ought to become a standard, skill, lint rule, or issue.>

## Lessons (confidence-tiered)

- **HIGH — Critical:** <instruction> — <explanation>
- **MEDIUM — Best practice:** <instruction> — <explanation>
- **LOW — Consideration:** <instruction> — <explanation>
