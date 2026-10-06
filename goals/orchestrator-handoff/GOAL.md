# Goal: Orchestrator Hand-off

Read `goals/orchestrator-handoff/SPEC.md` first, then `PLAN.md`. Laws: `AGENTS.md`.

## Objective

Make the orchestrator role (AGENTS.md "Autonomy") transferable between sessions from files alone.
The role is defined by four files and one CLI gate:

- the session ledger row with `--role orchestrator` (`bun run beep session open` names the holder);
- the register (`bun run beep session register add|list`): one row per coordinated unit with an
  orphan plan;
- `~/.cache/beep/orchestrator/HANDOFF.md` in the template's format;
- the `orchestrate` skill's take-over, run and hand-off procedures;
- `bun run beep yeet merge-gate <pr> <sha>`.

## Phases

- P1 (this packet's first PR): schemas, CLI, skill, template, AGENTS.md pointer, tests on
  recorded GitHub fixtures.
- P2: `beep session handoff` renderer, `yeet merge-gate --table` (port of `gate.sh`),
  `session register convert`, Codex-lane comment helper.
- P3: perform one real take-over from files alone; record it as the reflection; close.

## Rules

- Schema -> service contract -> implementation. Effect v4. No live GitHub calls in tests.
- Decisions go in `SPEC.md` Decision Log with reason and reversal path.
- Draft PR via `bun run beep yeet publish`; ready at content-final; the orchestrator merges after
  the 20-minute window.
