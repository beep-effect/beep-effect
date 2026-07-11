# Agent Reflection Loop

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

P1 (goal-closeout reflection system) in progress.

## Mission

Make agent **reflection** a first-class, schema-validated, enforced part of the
goal-packet lifecycle. Agents reflect at P3 Close (and on demand via `/reflect`)
on the repo's tooling, the implementation they produced, and the goal/prompt they
were given — persisted as structured `history/reflections/<date>-<agent>.md`
artifacts that compound into durable, reusable knowledge.

## Next action

Finish P1: `QualityIssueIndex` routing category, the `/reflect` skill, the
reflection lint test, the GLOSSARY entry, and this packet's own dogfood reflection.

## Launcher

```
/goal follow the instructions in goals/agent-reflection-loop/GOAL.md
```

## Reading order

1. `SPEC.md` — scope, decisions, acceptance, stop conditions (anchor).
2. `PLAN.md` — phases + the P1 checklist.
3. `GOAL.md` — compact execution launcher.
4. `research/reflection-frontier-report.md` — the cited evidence base.

## Evidence pointers

- Rule + schema: `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts`.
- Routing: `Lint/Lint.command.ts`, `Quality/Tasks.ts`, `bin-main.ts`.
- Convention: `goals/_template/history/reflections/_TEMPLATE.md`, `goals/README.md`.
- Reflections: `history/reflections/`.

## Lifecycle

`active`. P1 lands the goal-closeout system; P2 (Yeet self-healing reflection) and
P3 (memory consolidation) are designed in `SPEC.md` and built in follow-up slices.
