# P0 Test Baseline — @beep/repo-cli

Recorded: 2026-07-07, branch `repo-cli-modularization`, after landing the
pre-existing in-flight edits (schema-first S.Class conversions in
AIMetrics/AgentEffectiveness, Corpus/Fallow touch-ups, dependency bumps).

## Baseline

- `bun run --cwd packages/tooling/tool/cli check` — **green** (tsgo -b clean)
- `bun run --cwd packages/tooling/tool/cli test` — **green**:
  39 test files passed, 547 tests passed, 0 failed (vitest 4.1.10, ~79s)

## Gate for every subsequent wave

The package is fully green at P0, so the SPEC's "no NEW failures" gate reduces
to: `check` stays clean and all test files/tests stay passing. Any failure in a
wave is a regression introduced by that wave.

## Notes

- `docgen:local` at P0 escalated to the full docgen proof because the wave 0
  dependency bumps (bun.lock/package.json) change global docgen inputs; result
  recorded in the wave 0 commit.
