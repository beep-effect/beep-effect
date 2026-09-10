# Canonical Effect Vitest tests

## Status

Lifecycle: `active`. P0a through P0f are complete. P0g PR verification and
ratification are in progress.
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

The proposal contains all 15 detector rules, the 100-entry rc113 API graph, four
lens charters and the instrumented runner. Main through 8cb18e6, including #1060
and #1082, is integrated. Published checkpoint b721a248a9 passed hosted unit
tests, type checks, lint policy and docgen; this follow-up closes its coverage
regressions and the remaining adversarial findings.

The adopted inventory contains 8,138 open candidates across 1,000 tests and 110
support modules. The third-round repair preserves 7,748 previous row payloads,
updates 27 outcome hints, and adds 363 reviewed scope/provider findings without
removing a row or transferring an exception. All 29 generated declarations remain.
The final ordinary commands pass in 9.563s, 9.630s and 9.926s with unchanged
source and canonical artifacts. Earlier failed timing cohorts remain recorded
in history/2026-09-10-r3-performance.md; no measurement is adjusted for load.

The runner's 52 registrations and scoped Node 22 coverage remain green on its
unchanged source. The detector and Knowledge checkpoint passes 288 focused
cases, compiler, lint, Fallow and full CLI package verification. Final scoped
Node 22 coverage passes 3,656 tests across 181 files with five existing skips;
both prior file-metric regressions are fixed without changing their floors.
All three adversarial rounds are closed, with every finding fixed and verified
in history/2026-09-10-adversarial-round-3-closure.md. See [PR #1067](https://github.com/beep-effect/beep-effect/pull/1067) for
exact-head full local, hosted and review closeout evidence. The superseded
aggregate run ended intentionally before edits and is not accepted proof.

[PR #1047](https://github.com/beep-effect/beep-effect/pull/1047) promoted the
conformant MemoryFileSystem and was merged by Benjamin on 2026-09-09 after all
18 required checks passed, Greptile reached 5/5, and every review thread closed.
See PLAN.md and the dated receipts in history for current proof and limits.
P0g plan ratification and merge are required before P1; Benjamin must acknowledge
the full inventory before P2 begins.
