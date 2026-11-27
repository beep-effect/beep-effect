# Closeout evidence, 2026-11-27

The readings behind the acceptance criteria the closeout PR ticks. Every reading ran on main at 32db77c222f (#3609)
or read a hosted run; aggregates and run ids only. Raw outputs stayed in a scratch directory outside the
repository.

## Per-attempt job reads (criterion 1)

- Run 42646019844 (Check, three attempts): `attempts/<n>/jobs` read 60, 60 and 60 jobs, 180 in all, with no 502.
  `beep ci lane-timings --window --head-sha <its head> --preview` over the run's hour exited 0, and its preview
  banner named only the short span, with no `partial-read` reason.
- Run 42655574858 (Heavy Admit, two attempts): the union of the per-attempt reads and the `filter=all` listing are
  the same 22 `(id, run_attempt)` tuples.

## Route receipt replay (criterion 4)

The 2026-09-01..10-30 receipt (corpus sha256 `e840ea6d…`), restored beside a scratch `RECEIPTS.json` and run with
`beep ci route replay --corpus <scratch receipt> --json`, gives 5,083 heads, 242 skipped lane runs, 0 skipped reds,
0 base-unknown, 0 unresolved and 0 unknown-red heads, with recall 1 and `recallCertain: true`.

## Fleet economics across lane retirements (criterion 5)

`beep yeet economics --fleet --json`, three ways:

| Roots | Checkouts read | T3 lanes | Finished attempts (incl. monitor) | Duplicate (runId, attemptId) |
| --- | ---: | ---: | ---: | ---: |
| Derived (no `roots.json` on the workstation) | 46 | 0 | 2,929 | 0 |
| `BEEP_FLEET_ROOTS` set to the runbook's intended list | 62 | 18 | 3,157 | 0 |
| A `roots.json` holding that list, in a scratch `BEEP_FLEET_STATE_ROOT` | 62 | 18 | 3,157 | 0 |

Each count of checkouts read includes the workstation store partition, which is read as one `(retained)` checkout.
With the list, the T3 lanes add 245 attempts. The derived census also read a sibling clone of the private
repository and its lanes; the configured census drops them, because they do not share this clone's origin (the
runbook's membership rule).

The retained store held 367 run journals. 34 of them were filed on 2026-11-26 UTC by that day's
`yeet sweep --retire` and lane removals. All 34 runs, 116 attempts in all, appear in the census once, every one
through `(retained)`. No attempt is counted twice in any of the three censuses.

The workstation itself has no `roots.json` yet, so a plain `--fleet` run still uses derived mode and leaves T3
lanes out. The runbook (`docs/runbooks/fleet-roots-and-registry.md`) records the intended list. Installing it is a
workstation step and changes no code.

Fleet-host journals were not read live. The read-only command is shown on fixtures in
`yeet-economics-fleet-hosts.test.ts`, as slice 9 recorded.

## Refusal attribution and terminations (criterion 6)

The configured census (3,157 attempts) gives `redAttempts` 878 and an `actionableLaneMix` total of 878. No red is
charged to `publish:00-head-install-preflight`. The refusal rows are `refusal:stale-base` 118,
`refusal:closeout` 92, `refusal:lock-bounce` 46, `refusal:publish-input` 35, `refusal:review-threads` 8 and
`refusal:moved-tree` 5. The rest are `unexecuted` 114, `unlocated` 6 and `unrecorded` 1. Class mix: green 1,803,
red 878, terminated 314, monitor 162. Under v2, `redAttempts` would have been red plus terminated, 1,192, so the
v3 count of 878 is 26% lower. The baseline set's 321 → about 243 was 24% lower.

The 2026-11-09 one-checkout journal set behind the SPEC's 181 and 321 can no longer be read as it was: lanes
retired before #3263 took their journals with them. Today's journal set is used in its place.

## Final-check, admission history and unit timings (criterion 7)

- Final-check row of `modeDurations` (configured census): 922 attempts, 179 red, 144 terminated, 778 measured,
  p50 8.6 min and p95 21.9 min. The SPEC baseline was p50 6.3 and p95 50 min.
- `beep quality scheduler history`: 2,064 rows, 1,435 of them from 13 archive segments (2026-11-13 to 2026-11-27)
  and 629 from the live journal, with 0 duplicates and 0 undecodable rows. Of 677 admitted rows, 311 carry pressure
  stamps.
- Main Check run 45921347285 (f891554d0cd, success): 24 Test Unit partitions executed (2 skipped) and 24
  `unit-timings-*` artifacts were uploaded. Together they hold 232 rows over 210 package invocations, all sealed and
  passed. When the shards of each sharded package are added together, 209 invocations execute exactly the
  selection their manifest named. `@beep/storybook` executed 0 files and its manifest names no selection.

## Tests (Node and Bun)

`npx vitest run` and `bunx --bun vitest run` over `ci-lane-timings`, `ci-route-census`, `ci-cost-ledger`,
`ci-lane-jobs`, `yeet-attempt-journal-store`, `yeet-economics-fleet-roots`, `yeet-economics-fleet-hosts`,
`yeet-economics`, `yeet-economics-adjudicated`, `yeet-final-check-journal`, `quality-scheduler`,
`ci-unit-timings` and `ci-certainty` (all under `packages/tooling/tool/cli/test/`): 13 files and 460 tests pass on
each runner.
