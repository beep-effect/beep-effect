# Gate Run History Plan

## Status

Status: `active`

## Phases

Design order is the repo law: schema, then the Effect `Context.Service` contract, then
implementation. Lane history and the fix-loop delta ship first (P1 to P3); the hosted-main
baseline (P4) waits for the report upload in `goals/ci-gate-reports`. Every phase waits for the
model and the gate-run library from `goals/gate-report-core`.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm the store path and repository key, the window and deadline defaults, the driver under the narrow-adapter rule, and the state of the hosted-report carrier. | Decision files record each default and the guardian's reading of the driver edge; the carrier's status in `goals/ci-gate-reports` is noted. |
| P1 Schema | complete | Define the series key, observation, input fingerprint use, history configuration, label answer, delta, `GateHistoryError` and its reason domain, and the table schema with its first migration. | Schemas round-trip; the label and delta fixtures decode; the migration applies twice without change. |
| P2 Service contracts | complete | Define the history service that implements core's label and delta slot, and the baseline-import service, each with an in-memory test layer. | Contracts compile with schema-typed shapes; core's console renders labels and a delta through the test layer. |
| P3 Lane history | complete | Port the classifier and window with the fixed rules, implement the SQLite store, task-path ingestion after render, retention, quarantine reconciliation and the history queries. | `AC-H1` to `AC-H6` and `AC-H8` to `AC-H13` pass, the twelve-writer test included. |
| P4 Hosted-main baseline | pending | Import main's hosted reports for the lane's merge base through the carrier `goals/ci-gate-reports` ships, and label `red-on-main`. | `AC-H7` passes against reports uploaded by a hosted run. |
| P5 Port review | pending | Review each ported module against upstream and repo law, last. | Attribution, style laws and the persist invariant confirmed; findings fixed in place. |
| P6 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P7 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Phase Detail

### P0 Research

1. Read upstream `.repos/vitest-agent/packages/sdk/src/utils/classify-test.ts`,
   `.repos/vitest-agent/packages/engine/src/layers/HistoryTrackerLive.ts`,
   `.repos/vitest-agent/packages/engine/src/utils/persist-transaction.ts` and `.repos/vitest-agent/okf/limitations/concurrent-first-open-wal-switch.md` in `.repos/vitest-agent`.
2. Read `packages/tooling/library/agent-memory-store/src/MemoryLog.layer.ts` for how a tooling
   library opens `@beep/sqlite` and commits one transaction.
3. Confirm the repository key, the default `W = 10`, the 250 ms read deadline and the retry
   schedule, or record changed values with their reasons.
4. Read `FlakeQuarantine.ts` and fix the item key a quarantine incident maps to.
5. Record whether `goals/ci-gate-reports` has chosen its carrier. P4 starts when its upload lands.

### P1 Schema

The label domain is core's `LiteralKit`; this goal adds no member. The store's table schema keeps
result tables only: runs, checked units, observations.

### P2 Service contracts

The history service answers labels and a delta for a report under a deadline, records a run, and
serves the queries. The baseline-import service takes a merge base and returns the hosted reports
it found, with their distance from the merge base.

### P3 Lane history

In porting order: copy the upstream classifier and tracker with their tests, clear diagnostics,
change the rules to the spec's, then convert imports and identities. Then the store, ingestion on
the task path after the console flush, the quarantine reconciliation, and the `gate` command
family's history queries. Lane history ships as its own PR.

### P4 Hosted-main baseline

Wire the baseline import to the carrier, label `red-on-main`, and prove it against a hosted run's
uploaded reports.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status gate-run-history completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug gate-run-history` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add gate-run-history --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/gate-run-history/GOAL.md)" -le 4000
jq . goals/gate-run-history/ops/manifest.json
rg -n "gate-run-history|GOAL.md|agentLaunchers|packetAnchorDocument" goals/gate-run-history
git diff --check -- goals/gate-run-history
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-run-history`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
