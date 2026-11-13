# Merge Queue Lab Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Read the exploration packet and `SPEC.md`; read the live `main` ruleset; list the identities the fleet merges with and how each token is resolved. | Scope confirmed; identities and the ruleset snapshot recorded. |
| P1 Stand up the lab | complete | Cut `queue-lab`, add the toy workflow there, create the lab ruleset, and send one synthetic pull request through the queue. | Findings 10b, 10c (enqueue), 6e and 6f are recorded with evidence. |
| P2 Observe | complete | Land the driver calls, write the lab driver script, and work the rest of the Observations table. | Every Observations id has a finding or a recorded reason. |
| P3 Yeet: PR to mergeable | complete | Publish the driver change and the packet evidence through yeet and drive each pull request to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Record the verdict, feed it back to the exploration, clean up lab residue, write the reflection, flip packet state. | Verdict decision file exists; exploration updated; residue gone; reflection valid. |

Phase ids match `ops/manifest.json` `phases[]`.

## Sequencing Notes

- P1 is the first vertical slice. If 10b is refused, switch to the scratch
  repository fallback before anything else. If no fleet identity can enqueue,
  stop observing and go to P4 with a kill verdict.
- P2 pull requests to `main`, at most three open at once:
  1. `feat(github): enqueue, dequeue and read merge-queue entries` (driver and
     tests).
  2. `docs(goals): merge-queue-lab findings` (ledger, evidence, ops script).
  3. The closeout pull request.
- Order the observations so the cheap ones that decide the verdict run first:
  identities, then landed SHA and push event, then failure handling, then
  bypass and base moves, then the parameter probes (2a, 3e, 10a).
- Observations that need a second ruleset parameter (strict on, `HEADGREEN`,
  minimum group four) change the lab ruleset, run, and restore it; record the
  ruleset version before and after.

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write the verdict as a decision file and record it in
   `explorations/github-merge-queue/DECISIONS.md` and that packet's README
   Trail. On go, the exploration's gated candidates keep their gates; on park
   or kill, flip the exploration's status with the reason.
2. Close every synthetic pull request and delete its branch. On go, leave
   `queue-lab` and its ruleset in place with build concurrency 0; on kill,
   delete both.
3. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
4. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
5. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add merge-queue-lab --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- Record friction in `research/OPPORTUNITIES.md` when it happens.

## Verification Commands

```sh
test "$(wc -m < goals/merge-queue-lab/GOAL.md)" -le 4000
jq . goals/merge-queue-lab/ops/manifest.json
rg -n "merge-queue-lab|GOAL.md|agentLaunchers|packetAnchorDocument" goals/merge-queue-lab
git diff --check -- goals/merge-queue-lab
bun run beep ci ruleset --check
bun run beep quality package-verify @beep/github
bun run beep goals decisions check --slug merge-queue-lab
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug merge-queue-lab`; add a `kind: checkpoint` file there, never edit this block._

### Closeout re-final after #3112 merged before its readiness receipt, 2026-11-10

#3112 carried proposedCloseout but was flipped ready and merged five seconds later (2026-11-10 07:33:48Z and 07:33:53Z) by the operator gh login, before its until-ready monitor recorded merge-ready. goals completion refresh therefore read unknown. This docs-only re-final rebinds proposedCloseout.finalPullRequest, the completionGate final entry and the yeet-verdict ref to its own branch, and is held for its own merge-ready receipt before it merges.

Lane docs/merge-queue-lab-refinal

Reverse: None needed; the re-final only rebinds proposedCloseout and the gating verdict.

<!-- beep:decisions:end -->
