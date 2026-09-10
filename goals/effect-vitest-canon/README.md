# Canonical Effect Vitest tests

## Status

Lifecycle: `active`. P0a through P0.5 are complete. P0f adversarial review is incomplete.
Benjamin resumed PR #1067 closeout on 2026-09-09. Continue from
history/2026-09-09-pr1067-resume.md; merge and later-phase gates remain.
The machine-readable state is in [ops/manifest.json](./ops/manifest.json).

## Mission

Bring every in-scope test to canonical Effect Vitest rc.113 idioms, prove resource
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

The current proposal contains all 15 detector rules, the 100-entry rc113 API
graph, four lens charters, and the instrumented runner with Node/Bun proof.
The adopted census contains 996 test files and 110 support modules; its 8,026
open findings are the starting candidates for later inventory and migration.
Three normal adopted-baseline commands pass below ten seconds with recorded
workstation resource context. Round one is closed and round two is active.
The final CLI coverage and remaining adversarial, aggregate, hosted and review
gates are still open. Continue from the September 10 integration record.

[PR #1047](https://github.com/beep-effect/beep-effect/pull/1047) promoted the
conformant MemoryFileSystem and was merged by Benjamin on 2026-09-09 after all
18 required checks passed, Greptile reached 5/5, and every review thread closed.
See PLAN.md and the dated receipts in history for current proof and limits.
P0g plan ratification and merge are required before P1; Benjamin must acknowledge
the full inventory before P2 begins.
