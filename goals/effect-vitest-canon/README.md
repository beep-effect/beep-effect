# Canonical Effect Vitest tests

## Status

Lifecycle: `active`. P0a through P0g are complete. PR1067 is merged and
Benjamin ratified continuation on 2026-09-11. P1 inventory is in progress;
P2 waits for acknowledgement of the completed inventory. See
[the ratification receipt](history/2026-09-11-p0g-ratification-p1-start.md).
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

## P1 starting inventory

The refreshed census has 1,122 files across 139 owners: 1,012 tests and 110
support files. The 8,228 detector candidates include 90 inherited additions
on starting main. The baseline remains unchanged; lens coverage and timings
are being collected before the P1 acknowledgement gate.

## Foundation evidence (P0)

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
P0g ratification and merge are complete. Benjamin must acknowledge the full
P1 inventory before P2 begins.

## P1 evidence in progress

The [timing baseline index](ops/inventory/timings/baseline-index.json) records all
139 first attempts, including failures and configured runner subsets. The
[hosted-history summary](ops/inventory/hosted-history-summary.json) contains
package job links and explicit evidence gaps. Source-audit progress and the
remaining human gate are tracked in [PLAN.md](PLAN.md); neither successful timing
nor a decoded finding row completes the full P1 inventory.
