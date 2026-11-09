# Packet Archive Mechanics Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Tooling | complete | Schemas (`ArchiveRecord`, `retentionReason`, harvest row), `beep goals harvest`, `beep goals archive`, doctor check, INDEX column, README doctrine, closeout-skill step; public-CLI smoke on one packet. | Tooling PR merged; ledger committed under the exploration's `research/harvest/` at a named `main` SHA. |
| P1 Archive repo | complete | Create `beep-effect/beep-effect-goals-archive` (public, mirrored paths, generated index, projection README); add the `beep refs` member. | Repo exists; `beep refs provision` links `.repos/goals-archive`. |
| P2 Sweep | complete | Batches of about 50 packets, one PR at a time, goals then explorations; each PR = archive output + link rewrites for its batch, opened after hash verification. | Every terminal packet tombstoned; tag `archive/packets-2026-11` on the last batch. |
| P3 Yeet | in-progress | Each PR driven to mergeable behind its review window; inherited reds attributed. | All batch PRs merged. |
| P4 Close | in-progress | Reflection, `proposedCloseout`, adoption PR; this packet itself is archived by its own command after adoption. | `closeout.status == initiative.status` on `origin/main`. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add packet-archive-mechanics --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/packet-archive-mechanics/GOAL.md)" -le 4000
jq . goals/packet-archive-mechanics/ops/manifest.json
rg -n "packet-archive-mechanics|GOAL.md|agentLaunchers|packetAnchorDocument" goals/packet-archive-mechanics
git diff --check -- goals/packet-archive-mechanics
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug packet-archive-mechanics`; add a `kind: checkpoint` file there, never edit this block._

### P0 tooling implemented locally: harvest, archive plan/write, doctor advisory, INDEX column, doctrine text, 2026-11-06

Reverse: n/a

### P0 tooling PR #2801 open; P1 archive repo created and provisioned, 2026-11-06

Draft PR #2801 carries harvest, archive, doctor, INDEX, doctrine and the goals-archive refs member. beep-effect/beep-effect-goals-archive exists with main at 4ca1a37 and .repos/goals-archive provisions. Next: merge #2801, regenerate the ledger at a main SHA in a ledger PR, then sweep batch 1.

PR #2801

Reverse: n/a

### P0 complete: tooling merged in #2801; harvest ledger regenerated at main 322792fea0, 2026-11-07

#2801 merged as 322792fea09591b6a03cb5f1d9e078d6db2db8ad with harvest, archive, doctor, INDEX, doctrine and the goals-archive refs member; #2803 landed the ledger's gitleaks allowlist first. The ledger is regenerated on main so every one of its 6,651 rows and its header cite sourceCommit 322792fea0. Archive batch 1 opens only after this ledger PR merges.

PR #2801

Reverse: n/a

### Sweep batch 1: 50 goals archived at f77d312, verified and pushed, 2026-11-07

beep goals archive --kind goals --batch 50 (plan 736f91a4) mirrored 50 goals from main c19514e0d0 into beep-effect/beep-effect-goals-archive at f77d312 (index 4f122e9), pushed before the tombstone PR. An independent check matched every recorded contentHash to git rev-parse <commit>:<path> on origin/main. The batch exposed a researchReports projection gap in goal tombstones; the writer now reprojects it, and this batch's manifests were reprojected with goals manifest --write.

Reverse: Revert the batch PR on main to restore the 50 packets; the archive repo keeps its copies

### Batch 2 archived and verified on the public archive, 2026-11-08

Plan 2fc4f570 archived 50 goal packets from main 19c9aa06b0. Archive commits 87fc463 and 2feb1eb reached the remote on 2026-11-08 after the operator granted write access, and all 50 manifest content hashes matched the remote trees. Batch 3 follows this PR's merge.

Lane `feat/packet-archive-batch-2b`

Reverse: Revert the batch 2 tombstone PR to restore the packets on main; the archive commits stay public

### Batch 3 archived and verified on the public archive, 2026-11-08

Plan a11eb819 archived 50 goal packets from b628348e0d. Archive commits 2323b2c and 68b4d99 are on the remote, and all 50 manifest content hashes matched the remote trees. This was the first batch through the code-span rewriter: knowledge semantic-delta reported 0 introduced and 54 resolved on the committed tree. 41 goals and 79 explorations remain.

Lane `feat/packet-archive-batch-3`

Reverse: Revert the batch 3 tombstone PR to restore the packets on main; the archive commits stay public

### Batch 4 archived and verified, ending the goal packet sweep, 2026-11-09

Plan 00922606 pushed 40 terminal goal packets to the archive from e3a763cad8. Archive commits 94b8d15 and 73619b4 are on the remote, and all 40 manifest content hashes matched the remote trees. 37 became tombstones on main; semantica-canary, schema-opaque-default and speed-loop were then retained after hosted reds, as the retention decision records.  turborepo-task-qualification stays on main with a retentionReason. 79 explorations remain.

Lane `feat/packet-archive-batch-4b`

Reverse: Revert the batch 4 tombstone PR to restore the packets on main; the archive commits stay public

### Batch 5 archived and verified on the public archive, 2026-11-09

Plan a5296fe6 archived 50 explorations from deb7d0c5ef. Archive commits 28c4a59 and 3b5e47d are on the remote, and all 50 manifest content hashes matched the remote trees. knowledge semantic-delta reported 0 introduced and 128 resolved. This was the first batch to push the archive after every gate. 27 explorations remain.

Lane `feat/packet-archive-batch-5`

Reverse: Revert the batch 5 tombstone PR to restore the packets on main; the archive commits stay public

### Batch 6 archived and verified, ending the sweep, 2026-11-09

Plan 9e9e11f9 archived the last 26 explorations from 0b459d8674. Archive commits 1604d51 and 6187b83 are on the remote, and all 26 manifest content hashes matched the remote trees. knowledge semantic-delta reported 0 introduced and 38 resolved. The planner reports no packets left to archive. The tag archive/packets-2026-11 goes on the merge commit.

Lane `feat/packet-archive-batch-6`

Reverse: Revert the batch 6 tombstone PR to restore the packets on main; the archive commits stay public

<!-- beep:decisions:end -->
