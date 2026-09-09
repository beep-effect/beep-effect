# Complexity Ceiling Burn-Down

Lifecycle: `completed-retained`. Source: [`ops/manifest.json`](./ops/manifest.json).

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

## Publication and closeout

[PR #1021](https://github.com/beep-effect/beep-effect/pull/1021) merged as
[`74efb548f1`](https://github.com/beep-effect/beep-effect/commit/74efb548f16aa2c37f14cb3ea8b71ef47d2315ab)
on 2026-09-09 at 03:33:07 UTC. Its 18 required checks passed on `3a5f52d669`;
Greptile reported 5/5 with no outstanding findings, and all nine review threads
were resolved. Yeet observed the merge and exited 0. Property Laws finished successfully at
03:36:56 UTC, leaving no pending or failed checks on the implementation head.

The closeout reflection landed with the implementation. The operator merged
before the final lifecycle update could be committed, so that metadata follows
in a small separate PR. The canonical goals status writer updates the manifest,
README lifecycle, and portfolio index. The follow-up's own hosted checks and
Yeet readiness must pass before the agent reports final completion.

The user requested immediate pushes and explicitly skipped the full local
proof queue. Fast publication initially pushed the fixture fix; when it later
queued before push, the reviewed commit was pushed directly and hosted Yeet
monitoring continued. Historical local passes remain supporting evidence.

The Recharts fixture fix supplies its required `graphicalItemId`. The owning
test compiler and full UI audit/docgen pass, as does the epistemic-server
package's full audit/docgen after the review fixes. The hosted Heavy / Check
job passed on `3a5f52d669`, confirming the reported compiler failure is fixed.

## Evidence

| Requirement | Evidence |
| --- | --- |
| Every tail verdict executed; feature adopt/defer decisions | [`research/tail-inventory.md`](./research/tail-inventory.md) |
| Three clean runs, baseline digest, dated earlier full proof | [`reports/clean-runs.md`](./reports/clean-runs.md) |
| Real refactor seams and waiver rationale | [`research/calibration.md`](./research/calibration.md), `.fallowrc.jsonc` |
| Review and CI failure attribution | [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) |
| Implementation and post-merge reflections | [`2026-09-08-codex.md`](./history/reflections/2026-09-08-codex.md), [`2026-09-09-codex.md`](./history/reflections/2026-09-09-codex.md) |
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
