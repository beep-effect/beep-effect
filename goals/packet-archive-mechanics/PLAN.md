# Packet Archive Mechanics Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Tooling | in-progress | Schemas (`ArchiveRecord`, `retentionReason`, harvest row), `beep goals harvest`, `beep goals archive`, doctor check, INDEX column, README doctrine, closeout-skill step; public-CLI smoke on one packet. | Tooling PR merged; ledger committed under the exploration's `research/harvest/` at a named `main` SHA. |
| P1 Archive repo | pending | Create `beep-effect/beep-effect-goals-archive` (public, mirrored paths, generated index, projection README); add the `beep refs` member. | Repo exists; `beep refs provision` links `.repos/goals-archive`. |
| P2 Sweep | pending | Batches of about 50 packets, one PR at a time, goals then explorations; each PR = archive output + link rewrites for its batch, opened after hash verification. | Every terminal packet tombstoned; tag `archive/packets-2026-11` on the last batch. |
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

<!-- beep:decisions:end -->
