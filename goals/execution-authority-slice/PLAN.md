# Execution Authority Slice Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-verify the RESEARCH §1-§3 inventory against current main, search for an `OptionalDefect` equivalent, and record pre-move observable state (bound address, ledger row counts, column pins) plus a seeded PGlite fixture. | Facts, the helper decision and the pre-move recordings are recorded. |
| P1 Implement | in-progress | P1 move: create the five packages, move the code unchanged, add the rename migration and down-migration, rename the env keys, repoint consumers and pins, retire `@beep/epistemic-config`. Then P2 link: add `authorizedBy` to the Session change journal. | The P1 and P2 acceptance criteria in `SPEC.md` are met, each in its own PR. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status execution-authority-slice completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug execution-authority-slice` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add execution-authority-slice --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/execution-authority-slice/GOAL.md)" -le 4000
jq . goals/execution-authority-slice/ops/manifest.json
rg -n "execution-authority-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/execution-authority-slice
git diff --check -- goals/execution-authority-slice
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug execution-authority-slice`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
