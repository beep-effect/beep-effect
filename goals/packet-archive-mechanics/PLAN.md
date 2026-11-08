# Packet Archive Mechanics Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Tooling | complete | Schemas (`ArchiveRecord`, `retentionReason`, harvest row), `beep goals harvest`, `beep goals archive`, doctor check, INDEX column, README doctrine, closeout-skill step; public-CLI smoke on one packet. | Tooling PR merged; ledger committed under the exploration's `research/harvest/` at a named `main` SHA. |
| P1 Archive repo | complete | Create `beep-effect/beep-effect-goals-archive` (public, mirrored paths, generated index, projection README); add the `beep refs` member. | Repo exists; `beep refs provision` links `.repos/goals-archive`. |
| P2 Sweep | in-progress | Batches of about 50 packets, one PR at a time, goals then explorations; each PR = archive output + link rewrites for its batch, opened after hash verification. | Every terminal packet tombstoned; tag `archive/packets-2026-11` on the last batch. |
| P3 Yeet | pending | Each PR driven to mergeable behind its review window; inherited reds attributed. | All batch PRs merged. |
| P4 Close | pending | Reflection, `proposedCloseout`, adoption PR; this packet itself is archived by its own command after adoption. | `closeout.status == initiative.status` on `origin/main`. |

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

<!-- beep:decisions:end -->
