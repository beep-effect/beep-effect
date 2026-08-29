# Agent Reflection Loop

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

P1 (goal-closeout reflection system) is complete. P2 and P3 are intentionally
descoped until a packet closes without usable reflections.

## Mission

Make agent **reflection** a first-class, schema-validated, enforced part of the
goal-packet lifecycle. Agents reflect at P3 Close (and on demand via `/reflect`)
on the repo's tooling, the implementation they produced, and the goal/prompt they
were given — persisted as structured `history/reflections/<date>-<agent>.md`
artifacts that compound into durable, reusable knowledge.

## Closeout

The schema, command routing, skill, focused test, glossary term, dogfood
reflection, and Yeet issue routing are present. No follow-up implementation is
active: reopen P2 (Yeet self-healing reflection) or P3 (memory consolidation)
only after a packet closes without usable reflections.

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

`completed-retained`. P1 is retained as the working closeout system. P2 and P3
are won't-do until a packet closes without usable reflections.
