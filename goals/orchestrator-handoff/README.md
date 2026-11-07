# Orchestrator Hand-off

## Status

Lifecycle: `completed-retained`. All three phases are complete. Final PR #2812 merged as 6d99cb00b5, and `goals completion refresh` verified it.

Source: [`ops/manifest.json`](./ops/manifest.json)

Evidence (2026-11-06): P2 shipped `bun run beep yeet gate-table`, `session handoff`,
`session ruling add|list` and `session register convert`, plus an `owner-merge-hold` hold in
`yeet merge-gate`. P3 was a read-only take-over drill a fresh session ran from the files alone
while the holder stayed live. It refused the take-over correctly, and its findings (carry-over
of hand-typed rows, a holder thread line, hold labels) were fixed in the same PR. See
[`history/reflections/2026-11-06-claude.md`](./history/reflections/2026-11-06-claude.md) and
[`decisions/`](./decisions/).

## Mission

Codify the orchestrator session role (AGENTS.md "Autonomy": one session coordinates the rest) so
a successor session can take it over from files alone, without orphaning the sessions, agents,
lanes, jobs and people it coordinates.

## Launch

```text
/goal follow the instructions in goals/orchestrator-handoff/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract and Decision Log.
3. [`PLAN.md`](./PLAN.md) - phases.
4. [`../../.claude/skills/orchestrate/SKILL.md`](../../.claude/skills/orchestrate/SKILL.md) - the three procedures.
5. [`../../.claude/skills/orchestrate/HANDOFF.template.md`](../../.claude/skills/orchestrate/HANDOFF.template.md) - the hand-off document format.
