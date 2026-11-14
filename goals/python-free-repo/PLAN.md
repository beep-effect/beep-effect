# Remove Python from the repo, port photo-face to onnxruntime-node, and ban Python in tracked source Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | in-progress | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status python-free-repo completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug python-free-repo` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add python-free-repo --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/python-free-repo/GOAL.md)" -le 4000
jq . goals/python-free-repo/ops/manifest.json
rg -n "python-free-repo|GOAL.md|agentLaunchers|packetAnchorDocument" goals/python-free-repo
git diff --check -- goals/python-free-repo
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug python-free-repo`; add a `kind: checkpoint` file there, never edit this block._

### P0 triage complete; P1 running in four lanes, 2026-11-13

308 tracked .py on 05ed8bc6b6cc. 273 one-shot packet/exploration probes with no runtime consumer were deleted, one commit per packet, each with history/2026-11-13-python-removed.md naming where results are recorded. Live consumers found: heavy.yml (native-dependency-diagnostics.py), cache-warm.yml and Cache.adapter.ts (r2-cache), a systemd drop-in (cli-proxy-startup-check.py), four skills, photo-face. Note: the first consumer search missed hidden directories (rg skips .github by default); rerun with --hidden.

Lane chore/python-free-repo

Reverse: n/a (status note)

<!-- beep:decisions:end -->
