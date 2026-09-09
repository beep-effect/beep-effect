# Complexity Ceiling Burn-Down

Lifecycle: `active`. Source: [`ops/manifest.json`](./ops/manifest.json).

## Outcome

All 49 functions in the refreshed P0 cognitive-over-15 inventory have executed
verdicts: 30 real refactors and 19 overrides with reasons and review dates.
No ignores or inline suppressions were added. The global cognitive ceiling
remains 8, and the health baseline ratchet is blocking in CI and local pre-push.

The final review wave shrinks the health baseline from 189 to 185 entries.
Three consecutive checks match every entry, with no stale entries or
regressions. The unbaselined scan finds zero unwaived functions above cognitive
15. Two critical estimated-CRAP labels remain below that ceiling; the user
explicitly kept the 7-15 band outside the campaign's scope.

`ChartTooltipContent` retains its cohesive adapter boundary. Its waiver now
allows cognitive 17 and 77 lines for an implementation measuring 16 and 76;
the previous CRAP allowance is removed. Runtime-coverage CRAP and `fallow impact`
remain deferred with evidence in the inventory.

## Publication and remaining acceptance

[PR #1021](https://github.com/beep-effect/beep-effect/pull/1021) carries the
campaign. The user requested immediate publication of ready fixes and, on
2026-09-08, explicitly skipped the full local proof queue. Publication uses
`bun run beep yeet publish --fast --monitor`; if its pre-push admission still
queues, push the reviewed commit directly and continue Yeet monitoring.
Hosted checks, Greptile 5/5 with
zero issues, and no unresolved review threads must prove the final published
head before lifecycle closure. P2, P3, and final P4 reconciliation remain open.

The latest code fix, `4c6352111a`, supplies Recharts' required `graphicalItemId`
in the tooltip fixture. The package test compiler and full UI audit/docgen
pass. The epistemic-server package's full audit/docgen also passes after its
review fixes. All nine review threads were resolved before the final ratchet
update; the published-head monitor remains the authority for new feedback.

## Evidence

| Requirement | Evidence |
| --- | --- |
| Every tail verdict executed; feature adopt/defer decisions | [`research/tail-inventory.md`](./research/tail-inventory.md) |
| Three clean runs, baseline digest, dated earlier full proof | [`reports/clean-runs.md`](./reports/clean-runs.md) |
| Real refactor seams and waiver rationale | [`research/calibration.md`](./research/calibration.md), `.fallowrc.jsonc` |
| Review and CI failure attribution | [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) |
| Closeout lessons | [`history/reflections/2026-09-08-codex.md`](./history/reflections/2026-09-08-codex.md) |
| Acceptance and required commands | [`SPEC.md`](./SPEC.md), [`PLAN.md`](./PLAN.md) |

Browser QA round 9 used the actual tooltip and Recharts components. Its five
scenarios passed 17 assertions, including default output and formatter returns
of null, undefined, and zero. The independent visual judge found no required
issues. All 50 judge artifacts were inspected; clock alignment was low
confidence, so this evidence makes no precise latency claim. Hosted Storybook
verification on `29e4618939` passed 77 files and 489 tests without the previous
HMR WebSocket errors. Later changes only supply a test payload field and tighten
configuration; production tooltip behavior is unchanged.

Main's ONNX replacement uses fflate and private download/staging directories.
The temporary advisory exception is removed. Three installer regressions cover
replacement identity, planted-symlink isolation, permissions, and failure
cleanup; the security lane requires these checks before OSV.

The suppression comparator is the latest-main total of 207, with zero missing
or stale reasons and no campaign-added suppressions. The original 194-count
P0 inventory and the 2026-07-30 calibration remain historical provenance.
The revisit-6 decision retains the ceiling of 8 and is recorded in the
2026-07-30 entry of `standards/architecture/DECISIONS.md`.

## Launch

```text
/goal follow the instructions in goals/complexity-ceiling-burn-down/GOAL.md
```

[`GOAL.md`](./GOAL.md) is the compact launcher; [`SPEC.md`](./SPEC.md) is the
normative contract. Historical execution receipts remain in the clean-run
report, inventory, friction ledger, and earlier reflections.
