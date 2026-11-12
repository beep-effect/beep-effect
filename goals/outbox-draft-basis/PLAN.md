# Outbox Draft Basis Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | in-progress | Freeze the pin, status and report schemas and the zone rule. Run the tenant proof for the draft category. Decide the message pin. Check the state of `m365-agent-outbox` slice 3. | One decision file each for the schemas, the category proof and the message pin; the sequencing with slice 3 is recorded. |
| P1 Implement | pending | Two pull requests. First: schemas, the pure comparison, the audit field, `create_draft` and `get_draft`. Second: the check-drafts tool, the category mark, the README and the runbook. | `SPEC.md` acceptance criteria are met. |
| P2 Verify | pending | Run the package handoff and the final gates on each head. | `bun run beep quality package-verify @beep/m365-mcp` and `bun run beep yeet final-check` pass. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

P1 order inside the first pull request: schema, then the service contract,
then handlers. The second pull request writes no category until the P0
category proof is recorded. If a third pull request would be needed, cut the
message pin by decision file.

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
  (`bun run beep goals decisions add outbox-draft-basis --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/outbox-draft-basis/GOAL.md)" -le 4000
jq . goals/outbox-draft-basis/ops/manifest.json
rg -n "outbox-draft-basis|GOAL.md|agentLaunchers|packetAnchorDocument" goals/outbox-draft-basis
git diff --check -- goals/outbox-draft-basis
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug outbox-draft-basis`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
