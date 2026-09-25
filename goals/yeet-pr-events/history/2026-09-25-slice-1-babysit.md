# Slice 1 babysit proof (PR #1270)

The slice-1 PR proves its own W1 + W2 contract on the canonical detached babysit, as
`PLAN.md` "First vertical slice" step 4 requires. Times are UTC on 2026-09-25.

## Setup

- Branch `feat/yeet-pr-events-slice-1`, PR
  [#1270](https://github.com/beep-effect/beep-effect/pull/1270), checkout
  `$HOME/YeeBois/projects/beep-effect3-worktrees/yeet-pr-events-slice-1`.
- Publish: `bun run beep yeet publish --detach --start-pr-early --monitor --pr` pushed
  `75d62cfa43` and opened the PR; its local proof (job `9721fe0d`) sat behind the
  merged-preview admission queue and was cancelled (hosted checks prove the PR).
- Monitor: `bun run beep yeet monitor --until-ready --detach` submitted job
  `b3bdcfdd-8d95-43bc-8e51-e9db46186afe` (unit `beep-proof-b3bdcfdd-….service`).
- Synthetic required red: commit `c051bba853` added a unit test that asserts `1 === 2`
  (committed 18:09:52, pushed 18:09:58).

## Push -> row -> wave -> ack

| # | `job wait` armed | Returned | Exit | Wave content |
| --- | --- | --- | --- | --- |
| 1 | 18:10:05 | 18:14:33 | 2 | P1 review thread `PRRT_kwDOPbO_N86mG4QO` (reviewer comment 18:14:04) `[review-thread-0b7553a7f40b]` |
| 2 | 18:15:44 | 18:15:55 | 2 | P1 review thread `PRRT_kwDOPbO_N86mG5_Y` (comment 18:15:28) `[review-thread-247171178d06]`; wave 1's row was not re-returned |
| 3 | 18:16:52 | 18:27:51 | 2 | P0 `JSDoc Ratchet` `[JSDoc_Ratchet-f345ff1e37a4]`, row `ts` 18:27:50.483, link `actions/runs/36171682086/job/108193454161` |
| 4 | 18:30:01 | 18:35:18 | 2 | P0 `Test Unit` `[Test_Unit-3941d0e98b44]`, row `ts` 18:35:17.960, link `actions/runs/36171682086/job/108200015217` |

- The wave record `.beep/inbox/dispatch.json` stayed pinned to `c051bba853` with the six
  capsule ids of that head and a `redSetKey`; `updatedAt` 18:35:17.960.
- Hook injection: a `PreToolUse` dry run of `.claude/hooks/yeet-inbox.sh` against the
  checkout at 18:28:48 injected
  `P0 JSDoc Ratchet [JSDoc_Ratchet-f345ff1e37a4] PR #1270 <link>` and stamped
  `firstSeenAt["JSDoc_Ratchet-f345ff1e37a4"] = 2026-09-25T18:28:48Z` in the session file,
  `schemaVersion` and `seenIds` unchanged.
- The `Test Unit (repo-cli-2)` shard red became a P1 row at 18:32:09 and did not wake the
  waiter (optional reds never wake, ttc ruling 42); the required aggregate `Test Unit`
  did, as row 4.
- Wave 3 was a real red, not the synthetic one: the JSDoc totals baseline written before
  the second `origin/main` merge (3332) was two below the merged tree (3334).

## Observations

- Wave 4's gate line listed both P0 rows as new because the red set changed at the same
  head (ruling: a changed red set is a new wave); the already-returned JSDoc row was
  re-listed. Candidate follow-up: name the changed red set instead of re-listing rows.
- The hook renders one P0 incident at a time (ship-velocity A2-A3), so the second P0 queues
  behind the first until it is acknowledged or superseded.
- Reviewer thread 1 (same-head base-conflict cannot re-wake after `cleared`) was a real
  gap; fixed in `f3a2b5b427` with a per-head conflict generation.

## First W1 measurement (head `c051bba853`, required red `JSDoc Ratchet`)

| Stage | Time (UTC) | Delta |
| --- | --- | --- |
| pushed (committer date) | 18:09:52 | - |
| red observed by GitHub (`completedAt`) | 18:26:36 | +16m 44s (runner queue) |
| P0 row written (`ts`) | 18:27:50.483 | +1m 14s (30 s poll + status fetch) |
| `job wait` returned exit 2 | 18:27:51 | +1s |
| row injected (hook `firstSeenAt`) | 18:28:48 | +58s (next tool call) |
| acked | - | rows were superseded by the fix push, not acked |

The monitor's own line at the head change read
`push→row→ack c051bba: pushed 18:09:52.000Z, red 18:26:36Z (+16m 44s), row 18:10:18.811Z (+0), injected -, acked -`:
its `row` and `injected` stages followed the head's first row (an optional Vercel red at
18:10:18) instead of the required red's P0 row. Fixed on this PR so the chain follows the
first required red's P0 row. The figure above is the input to W10 and to the receiver gate
in `explorations/pr-event-awareness/MAP.md`.

## Fix push -> ready

- Fix head `e2b7f07997` pushed 18:38:24 (deletes the synthetic test, adds the base-conflict
  generation fix from thread 1, retightens the JSDoc baseline to 3334). The monitor logged
  `head moved to e2b7f07; the 6-capsule wave for c051bba is superseded.` and printed the
  head's timeline line; both review threads were answered and resolved with
  `bun run beep yeet reply`, and their rows acknowledged with `--thread-url`.
- Timeline fix head (this commit): the chain now follows the first required red's P0 row
  (`redAt` counts only required checks; optional P1 rows never join).
- `bun run beep yeet job wait b3bdcfdd-8d95-43bc-8e51-e9db46186afe` re-armed on the fix
  head; its `ready` exit 0 with `merge-ready: yes` is recorded below once hosted checks settle.
- ready: pending
