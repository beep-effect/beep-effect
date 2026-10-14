---
name: reflect
description: >
  Write a structured agent reflection for a goal packet. Trigger on: a goal's P3
  Close phase, the user invoking `/reflect <goal-slug>`, or when you notice a TODO
  worth codifying. Produces a schema-valid
  `goals/<slug>/history/reflections/<YYYY-MM-DD>-<agent>.md` enforced by
  `bun run beep lint reflection-artifacts`.
metadata:
  version: "0.1.0"
  status: active
---

# Reflect

Use this skill to capture a durable, **information-rich** reflection on a goal
packet's execution. Reflections compound into reusable knowledge; the research
(`goals/agent-reflection-loop/research/reflection-frontier-report.md`) shows that
specific, structured reflections grounded in real tooling/CI signals far
outperform terse free-text advice.

## When to run

- **Automatic (P3 Close):** the agent closing a goal packet writes one before
  flipping `ops/manifest.json` `initiative.status` to `completed-retained` /
  `complete`. Packets with `reflectionRequired: true` are gated — a missing or
  invalid reflection blocks closeout.
- **On demand:** `/reflect <goal-slug>` — reflect on any packet now.
- **TODO codification:** when you spot something that should become a standard,
  skill, lint rule, or issue, capture it as a `codification-todo` finding.

## How to write one

1. Resolve the goal slug. Read the packet's `SPEC.md`, `PLAN.md`, `README.md`,
   `history/`, and the real execution evidence (PRs, CI runs, review threads,
   commits). Ground claims in that evidence — not unaided self-critique.
2. Copy `goals/_template/history/reflections/_TEMPLATE.md` to
   `goals/<slug>/history/reflections/<YYYY-MM-DD>-<agent>.md` (today's date;
   `<agent>` lowercase, e.g. `claude`, `codex`).
3. Fill the YAML frontmatter — it is the machine-validated block
   (`ReflectionFrontmatter`):
   - `goal`, `agent`, `date` (`YYYY-MM-DD`)
   - `trigger`: `closeout` | `on-demand` | `todo-codify`
   - `confidence` (overall): `high` | `medium` | `low`
   - `findings[]`: each `{ category, confidence, instruction, explanation }`
     where `category` ∈ `tooling-friction` | `implementation-improvement` |
     `goal-critique` | `prompt-critique` | `codification-todo`. Make `instruction`
     concrete (what to change) and `explanation` evidence-backed (why).
   - `todos[]`: items worth codifying.
4. Fill the body rubric: **Summary**, **Tooling experience** (worked / didn't /
   frustrating / wished existed), **Implementation improvement opportunities**,
   **Goal & prompt critique** (would you revise the GOAL/prompt to be clearer,
   easier, more efficient?), **TODOs worth codifying**, and **Lessons**
   (confidence-tiered: HIGH critical / MEDIUM best-practice / LOW consideration).
5. Update packet `README.md` (latest evidence) and `ops/manifest.json` status.

## Verify

```sh
bun run beep lint reflection-artifacts   # blocking_findings=0
git diff --check -- goals/<slug>
```

## Related skills

- `yeet` — commit/push/PR after the reflection is written.
- `quality-review-fix-loop` — late-initiative closure + reviewer/fixer loop.
