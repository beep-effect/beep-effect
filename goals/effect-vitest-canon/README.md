# Canonical Effect Vitest tests

## Status

Lifecycle: `paused`. P0a through P0.5 are complete. P0f adversarial review is incomplete.
Benjamin requested an early draft PR and a pause on 2026-09-09; resume from
history/2026-09-09-pause-and-pr.md only when requested.
The machine-readable state is in [ops/manifest.json](./ops/manifest.json).

## Mission

Bring every in-scope test to canonical Effect Vitest rc.112 idioms, prove resource
and timing behavior, and enforce the result through a syntax-only lint ratchet.

## Read first

1. [GOAL.md](./GOAL.md) is the compact launcher.
2. [SPEC.md](./SPEC.md) contains the normative contract and D1-D14.
3. [PLAN.md](./PLAN.md) records phase gates and current work.
4. [DECISIONS.md](./DECISIONS.md) records decisions and dated exceptions.
5. [research/SOURCES.md](./research/SOURCES.md) records provenance.
6. [research/OPPORTUNITIES.md](./research/OPPORTUNITIES.md) records friction.

## Launch

```text
/goal follow the instructions in goals/effect-vitest-canon/GOAL.md
```

## Latest evidence

The isolated proposal contains all 15 detector rules, the 85-entry pinned API
graph, four lens charters, and the instrumented runner with Node/Bun proof.
The latest recorded census contains 970 test/spec files and 105 support modules;
the starting baseline has 5,016 findings awaiting inventory and migration.

[PR #1047](https://github.com/beep-effect/beep-effect/pull/1047) promoted the
conformant MemoryFileSystem and was merged by Benjamin on 2026-09-09 after all
18 required checks passed, Greptile reached 5/5, and every review thread closed.
The first of three P0f review rounds has an accepted immutable input corpus and
20 sampled tests. See PLAN.md and the dated receipts in history for proof and
limits. P0g plan ratification and merge are required before P1; Benjamin must
acknowledge the full inventory before P2 begins.
