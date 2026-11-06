# 2026-11-05 — A base-conflict P0 row means "merge main now"

## Directive

Operator ruling of 2026-11-05, ratified after the orchestrator's incident read. It adds four
coordination rules to the doctrine; every routing rule in the
[2026-10-18 record](./2026-10-18-codex-claude-fallback.md) and its predecessors stands.

## Incident

On 2026-11-04T01:54Z the merge gate landed three `turborepo-*` pull requests (#2680, #2682,
#2688) within 41 seconds. Each of them appended to the same goal-packet files (`SPEC.md` and
`PLAN.md` Decision Log tails, `ops/manifest.json` `research[]`), so the eleven sibling pull
requests still open on those two packets (#2683–#2695) went `CONFLICTING` on GitHub at once and
stayed there for more than 43 hours.

The tooling saw it. Every lane's `bun run beep yeet monitor --until-ready` wrote the P0 inbox
row `base conflict with origin/main on head <sha> — P0 capsule <id>; merge origin/main and push`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Remediation.ts`). Nobody acted on it:
every lane's session-ledger row carried the instruction "designated primary acceptance and merge
only; no local verify/publish", the lanes read that as forbidding a local `git merge origin/main`,
and the designated primary never merged for them. Detection worked; doctrine deadlocked the
response. Eleven open pull requests on two packets from one base were the multiplier.

| # | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| B1 | A base-conflict P0 inbox row is an unconditional instruction to the lane owner: merge `origin/main` into the lane now, resolve, regenerate generated files, push. It holds regardless of any "primary accepts and merges" arrangement, and no delegation model, brief or ledger instruction may forbid a lane from merging main. "No local verify/publish" never includes the catch-up merge. | A conflicting pull request cannot be merged by anyone, so a rule that keeps the owner from merging main cannot be a merge-authority rule; it only parks the pull request. Merging the base into a feature branch is the one repair only the lane can do, because only it knows the resolution. | Strike the law line from `AGENTS.md` Autonomy, the Conflict row in the `orchestrate` skill and the Ground First paragraph in the `yeet` skill, and this row. |
| B2 | When `yeet merge-gate` merges a pull request that touched `goals/<slug>/**`, it comments on every other open pull request that touches the same packet, in the same run: the merged sibling, the slug, the instruction to merge `origin/main` now, and the files `git merge-tree --write-tree origin/main <head>` predicts will conflict. `bun run beep yeet siblings <pr>` prints the same report on demand. The broadcast is best effort after the merge and never holds or fails the merge. | The owners of the eleven lanes learned of the conflict from GitHub's `CONFLICTING` flag and a generic P0 row, hours apart. A comment that names the merged sibling and the expected files arrives while the orchestrator is still at the gate and gives the owner a concrete resolution target. Resolving files after the fact is worse than knowing the collision before the fetch. | Remove the `broadcastPacketSiblings` call from `runMergeGateAsGhLogin` in `MergeGate.ts`; the `siblings` command may stay as a read-only helper or be deleted with its test. |
| B3 | A goal packet has at most three concurrently open pull requests. A fourth change to the same packet is sequenced behind one of the three (same lane, next PR) or stacked on it and retargeted when the parent merges; it is not opened as a fourth sibling. | Every merge forces every other open sibling on the packet into a catch-up merge, so k siblings cost k(k-1)/2 catch-ups: three siblings cost three, eleven cost fifty-five, and that is what the 43-hour stall was. Three covers the shapes a packet needs at once (an implementation lane, a packet-docs or closeout lane, and one unblocker or fix lane) while keeping the worst case at three catch-ups per packet. | Change the number in `.claude/skills/orchestrate/SKILL.md` and `goals/README.md` (one line each), or strike both lines and this row. |
| B4 | The merge gate merges finals as they arrive, one at a time, and tells each remaining sibling to merge main before the next merge. It never batches several finals on the same packet into one burst. | The 41-second burst gave no sibling a chance to catch up between merges, so every one of them conflicted on three packet tails at once instead of one. Sequencing turns a simultaneous conflict storm into three ordinary catch-ups. | Strike the sentence from the `orchestrate` skill's Gate met row and this row. |

## What changed

- `AGENTS.md` Autonomy: one law line for B1 and B3/B4 (merge main on a base-conflict row; at most
  three open pull requests per packet; the gate merges finals as they arrive).
- `.claude/skills/orchestrate/SKILL.md`: the Run table's Conflict row carries B1 and the broadcast;
  the Gate met row carries B4 and the `yeet siblings` step; the fan-out cap B3 is a new rule.
- `.claude/skills/yeet/SKILL.md`: Ground First carries B1; `references/merge-loop.md` carries the
  base-conflict row procedure and the broadcast comment format.
- `goals/README.md`: the fan-out cap B3 under Packet Standard.
- `packages/tooling/tool/cli`: `yeet siblings <pr>` (`commands/Yeet/internal/Siblings.ts`), the
  merge-gate broadcast, and two REST reads (`pullRequestFiles`, `openPullRequests`) on
  `GithubRest`, with tests.
- This record. The Decision Log in `SPEC.md` is not appended: a sibling lane is replacing the
  tail-append mechanism that caused the incident, and the record is the ruling's home.

## Evidence

- Merge timestamps: `gh api repos/beep-effect/beep-effect/pulls/{2680,2682,2688}` `merged_at`
  within 2026-11-04T01:54Z, 41 seconds apart.
- Conflict duration: the eleven siblings read `mergeable_state: dirty` from 2026-11-04T01:55Z until
  the orchestrator's conflict instructions of 2026-11-05T21:08Z (session ledger, `beep-effect11`).
- Deadlock text: every affected lane's session-ledger `--next` line, 2026-11-03T22:49Z to
  2026-11-04T01:06Z, reads "designated primary acceptance and merge only; no local verify/publish".
- Detection: `yeet monitor --until-ready` P0 base-conflict rows on each lane's inbox
  (`.beep/inbox/`), rendered by `renderYeetBaseConflictDispatchLine`.

## Worked example: episode 30 (2026-11-05, this pull request)

The rules above were exercised by the pull request that carries them, #2701, while
the orchestrator drained the queue under the operator's 23:40Z ruling ("main might be
red now but that is okay; get the queue merged, then fix any issues in a follow-up
PR").

1. 23:31Z: #2700 (`yeet open` and the provenance footer) merged and touched the Yeet
   command tree and the yeet skill, both of which #2701 edits. The lane's detached
   readiness monitor wrote the P0 row `base conflict with origin/main (pr #2701 @
   eb8c79c)` within one poll.
2. B1 applied: the lane merged `origin/main` at once, whatever its brief said about
   acceptance. One file conflicted, the generated instrumentation catalog, and it
   was regenerated (`bun run beep observability catalog --write`), never hand-merged.
   The touched suites (`yeet-siblings`, `yeet-merge-gate`) were re-run green and the
   row was acknowledged with the merge commit.
3. `yeet publish --push-only` refused the merge as non-reproducible because of the
   regenerated file; the merge went out through the ordinary cheap-gates publish.
   While it ran, `main` moved twice more (#2511 hand-merged by the operator, then
   #2692), so the lane merged `origin/main` a second time before pushing: under B4
   each sibling catch-up is one ordinary merge, not a storm.
4. The shared `gh` login's GraphQL budget was exhausted by twelve concurrent polling
   sessions, so every readiness monitor died on `Failed to read the complete pull
   request check census`. The REST gate view (`yeet gh pr status`) kept working and
   the lane waited for the budget to return before re-arming the detached monitor.
   The orchestrator then ruled that `final` is posted with each red attributed, without
   waiting for hosted green or the readiness job, and merged under S11.

What the episode confirms: the P0 row plus the merged-sibling signal gives the owner a
concrete, immediate catch-up; a regenerated file is the only safe resolution for a
generated conflict; and a shared GitHub identity needs REST-first polling budgets
(the `orchestrate` skill's "REST first" ruling) or the monitors starve each other.
