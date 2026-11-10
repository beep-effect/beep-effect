# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

Decomposed 2026-11-10 from [`BRIEF.md`](./BRIEF.md). Code paths are given
from `packages/tooling/tool/cli/src/` and written without backticks so they
read as locations, not links.

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `yeet-async-merge-and-stacks` (promised now) | Yeet merges through GitHub's async endpoint with an explicit bypass, keeps proof across rewrites that change nothing, and can open, ready, merge and sweep a two-layer native stack. | none | see the table below |
| merge-queue routing (gated) | `yeet merge-gate` enqueues with `action: "merge_queue"`. | P0 of the goal above; the flip condition in `explorations/github-merge-queue` | belongs to that exploration, not a goal from this packet |
| Heavy on the lowest unmerged layer only (gated) | Skip the Heavy runs a cascade throws away. | routine stacks after P3; decision `stack-layer-heavy` | commands/Ci/HeavyAdmission.ts (extend); needs a workflow change |
| a dependency edge for joins and fans (gated) | Express the 4 of 12 structures a stack cannot. | P3 showing they still matter | commands/Yeet/internal/Siblings.ts (extend); edge model NET-NEW |

Components of `yeet-async-merge-and-stacks`:

| Phase | Component | Existing brick | Status |
| --- | --- | --- | --- |
| P0 | async merge request and poll | internal/github/GithubRest.ts (`mergePullRequest`, the legacy call) | extend; client NET-NEW |
| P0 | gate and merge use it | commands/Yeet/internal/MergeGate.ts, `Merge.ts`, `GhOps.ts`, `OwnerCheckpoint.merge.ts` | extend |
| P0 | explicit bypass in relaxed mode | `MergeGate.ts` relaxed mode and its attribution record | extend |
| P1 | head-move classifier by patch-id | none (`rg patch-id` finds nothing) | NET-NEW |
| P1 | window survives an unchanged rewrite | commands/Yeet/internal/ReviewWindow.ts | extend |
| P1 | receipt carries to the rewritten head | commands/Yeet/internal/FinalCheckRefresh.ts (the ancestor carry rule) | extend |
| P2 | open a layer and link the stack | commands/Yeet/internal/PullRequest.ts (REST create, footer, label) | extend; stack model NET-NEW |
| P2 | ready without a push below the top | commands/Yeet/internal/ReadyGate.ts (the S32 commit) | extend |
| P2 | stack-level gate, one merge for the group | `MergeGate.ts` plus the P0 client | extend |
| P2 | retire reads the PR head first | commands/Yeet/internal/Sweep.ts, `Retire.ts` | extend |
| P3 | pilot measurements | the method in [`RESEARCH.md`](./RESEARCH.md) (2026-11-09) and the test record | reuse |

## Sequencing

1. **P0 first.** It is the only phase every later one needs, it serves the
   merge queue too, and it changes behaviour for every merge, so it lands
   alone and is watched for a day.
2. **P1 second.** It removes the 29-minute wait the test measured, and it
   also helps a non-stack PR whose head GitHub rewrites.
3. **P2 only after both.** A stack on today's window and receipt rules
   would thrash.
4. **P3 last, and it can end the goal early.** Failing a kill criterion
   closes the goal at P1 with stacks off.

The three gated candidates are re-entry points. A fired gate reopens this
exploration at decompose; none becomes a goal directly.

## First Vertical Slice

P0, strict mode only: `bun run beep yeet merge-gate <pr> <sha>` merges one
ordinary PR through `merge-async`.

- It sends `sha`, `method: "squash"`, `bypassRules: false` and the squash
  title and body the gate already computes.
- It polls to `merged` and reports the merge commit, or holds with GitHub's
  sentence on `failed`.
- Proof: the P0 PR is merged by the new path, and one deliberately blocked
  PR (an unresolved thread) shows the hold. The legacy call stays reachable
  behind a flag until that day has passed.

## Open Risks Inherited From The Brief

- Rules are evaluated after the 202; the gate must poll to a terminal state.
- Bypass reaches only the bottom layer, so a red `main` lands a stack
  bottom-up, one cascade per layer.
- The second rewrite is unattributed; the pilot measures whether GitHub
  restacks when the trunk moves.
- A layer's diff base for affected planning is its parent; the first
  code-layer stack must record Heavy on a layer.
- Squash title and body across several PRs in one request are undocumented.
- The S32 re-request needs a way to wake the reviewer without a commit.
- Cascade commits are unsigned; a signature rule on `main` would block them.
- `gh stack` needs one push remote; the Stacks REST endpoints are thinly
  documented.
- Joins and fans stay on the fold and publish-after-parent rule.
