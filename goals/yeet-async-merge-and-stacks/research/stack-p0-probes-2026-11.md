# Slice C P0 probes: reviewer wake and stack linking, 2026-11-13

Slice C's P0 research. `PLAN.md` left two questions open before any stack
code: how to wake `beep-reviewer` on a layer without the empty
`chore: re-request beep-reviewer (S32)` commit, and whether layers are
created and linked through `gh stack` or the Stacks REST API. Times are UTC
on 2026-11-13. Every fact below was read from this repository through
`gh api`, from the checked-in source, or from GitHub's REST reference.

## How the probes ran

- A throwaway base branch, `probe/stack-c-base`, cut from `main` at
  `7a462a27d4`. No ruleset targets it and no workflow runs on a pull request
  to it (every `pull_request` trigger names `branches: [main]`; the two probe
  heads read zero workflow runs), so nothing reached `main` and no runner
  was spent.
- Six docs-only probe PRs, each one commit made through the contents API,
  in three two-layer stacks: #3148 and #3149 (stack #3150), #3154 and #3155
  (stack #3156), #3157 and #3158 (stack #3159). All six merged into the
  throwaway base, which was deleted afterwards with every probe branch.
- No probe sent a bypass and the lane pushed nothing by `git`.

## Answer 1: the reviewer already wakes on a comment; a layer needs no push

**What the code does today.** Since #2791 (2026-11-06) `yeet ready` asks for
the review with an exact-head issue comment and pushes nothing
(`requestReviewerComment` in
`packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts`):

```text
Requesting beep-reviewer review of this ready PR head.

<!-- beep-reviewer:request sha=<40-character head> -->
```

- The comment route covers a PR authored by the shared login in this
  repository, requested while authenticated as that login
  (`reviewerCommentCovered`). Every agent PR here is one.
- The empty S32 commit survives only as the fallback for an author or
  repository the comment routine does not cover, and only right after a
  real draft-to-ready flip (`allowPush`).
- The stack-test record and `.claude/skills/yeet/references/merge-loop.md`
  still describe the push as what `yeet ready` does. They predate reading
  the #2791 code path; the test never ran `yeet ready`.

**What the probes showed on a layer.**

| PR | Stack position | Ready | Request comment | `beep-reviewer` summary | Head moved by the request |
| --- | --- | --- | --- | --- | --- |
| #3154 | 1 of 2 | 00:50:58Z | 00:55:19Z | 00:57:51Z, on `84a3a3787a` | no |
| #3149 | 2 of 2 | 00:40:18Z | 00:40:22Z | 00:42:32Z | no |

- #3154 sat ready for 4 minutes 21 seconds with no request and no review.
  The summary arrived 2 minutes 32 seconds after the comment and names the
  requested commit as "Last reviewed commit". The comment is what woke it.
- #3149's base was another PR's branch (`probe/stack-c-1`) when it was
  requested, so the routine does not require a `main` base. Its result is
  weaker evidence than #3154's: the layer below merged at 00:42:20Z and the
  cascade force-pushed #3149 at 00:42:25Z, seven seconds before the summary.
- The reviewer posted a summary comment on these probes and no check run.
  On #3130, a `main`-based PR, the same request (2026-11-12 23:18:58Z)
  produced a `beep-reviewer` check run at 23:25:43Z and a review at 23:25:53Z.

**Conclusion.** Nothing new is needed to wake the reviewer. Slice C's change
in `yeet ready` is narrower than the brief assumed: on a stack layer the push
fallback must never run, because a push below the top moves the head off the
base of the layer above. A layer the comment route does not cover gets a
warning with the manual comment body instead.

## Answer 2: link layers through the Stacks REST API

The REST reference documents the endpoints
(<https://docs.github.com/en/rest/pulls/stacks>, API version `2026-03-10`):

| Call | Purpose |
| --- | --- |
| `GET /repos/{owner}/{repo}/stacks?pull_request={n}` | the stack containing a PR |
| `POST /repos/{owner}/{repo}/stacks` with `{"pull_requests":[bottom, …, top]}` | create a stack |
| `GET /repos/{owner}/{repo}/stacks/{stack_number}` | one stack |
| `POST /repos/{owner}/{repo}/stacks/{stack_number}/add` | append PRs above the top |
| `POST /repos/{owner}/{repo}/stacks/{stack_number}/unstack` | remove unmerged PRs |

Observed on the probes:

- `POST stacks` with two draft PRs answered **201** in under a second. Drafts
  are accepted. The body carries `number`, `open`, `base.ref`, `created_at`
  and `pull_requests` bottom to top, each with `number`, `state`, `draft`,
  `merged_at`, `head.ref`, `head.sha` and `base.ref`.
- A stack number comes from the issue and PR number sequence (#3150 followed
  PRs #3148 and #3149).
- Every pull record then carries
  `stack: {id, number, position, size, base: {ref, sha}}`. `position` counts
  from 1 at the bottom and `base.ref` is the trunk the stack lands on. The
  list endpoint (`GET pulls`) carries the same key, `null` when unstacked.
- Refusals are **422** with a sentence:
  - wrong order: "Pull requests must form a stack, where each PR's base ref
    is the previous PR's head ref";
  - one PR: "Invalid property /pull_requests: 2 items required; only 1 was
    supplied.";
  - repeated: "Pull requests #3148, #3149 are already part of a stack".
- Each PR's timeline gets `added_to_stack`.

**Why REST and not `gh stack`.**

- Yeet already creates the PR through REST with its own title, body,
  provenance footer and label. Linking is one more call on the same client.
- `gh stack` v0.3.0 calls the same endpoints (its binary names
  `repos/%s/%s/stacks`, `stacks/%d/add`, `stacks/%d/unstack` and
  `pulls/%d/merge-async`), so nothing is lost.
- `gh stack submit` and `gh stack push` push every branch themselves with
  `--force-with-lease`, and `gh stack link` pushes branch arguments. A lane
  never moves a published ref non-fast-forward (decision
  `2026-11-10-no-agent-rewrite`), and Yeet's own push is the only push the
  publish path proves.
- `gh stack init` and `submit` keep per-clone tracking state, and `submit`
  refuses with three remotes unless `remote.pushDefault` is injected through
  the environment. REST needs neither.

## Facts the design needs, observed on the way

- **One request from the top merges both layers.** `PUT
  pulls/3158/merge-async` with the top's `sha`, `merge_method=squash`,
  `merge_action=direct_merge` and `bypass_rules=false` answered 202 and read
  `merged` 8 seconds later. Both layers landed in one push as two squash
  commits committed by GitHub in the same second.
- **`commit_title` and `commit_message` reach only the top layer.** The
  request sent both. The top's commit `a60de48ccf` carries the title and body
  exactly as sent. The lower layer's commit `1f562ae3c1` carries GitHub's
  default, the single commit subject plus ` (#3157)` and no body. This
  settles the brief's open question: a stack merge may keep sending the top
  layer's computed message, and the gate must lint GitHub's default message
  for every layer below it.
- **The poll names the top's commit only.** `merged.details.sha` is the top
  layer's squash commit. Each layer's own commit is `merge_commit_sha` on its
  pull record.
- **After the merge** the stack reads `open: false`, both layers read
  `state: closed` with `merged_at` set, the top's `base.ref` still names the
  deleted parent branch, and both head branches were deleted within two
  seconds.
- **Containment can be read without local objects.**
  `GET compare/<lower head>...<top head>` answered
  `{"status":"ahead","behind_by":0}` for a top built on the lower head.
- **A lower layer that merges alone cascades at once.** On #3149 and #3155
  the timeline shows `automatic_base_change_succeeded` and then
  `head_ref_force_pushed` three to five seconds after the layer below merged.
- **No stack mutation exists in GraphQL.** The reference names read-only
  `stack` and `stackEntry` fields on `PullRequest`; creating and changing a
  stack is REST only.

## Things the probes did not expect

- **Four probe layers were merged by the shared login, not by this lane.**
  #3148 merged at 00:42:20Z, two minutes after it was flipped ready; #3149
  at 00:52:59Z; #3154 at 00:59:18Z, 87 seconds after its reviewer summary;
  #3155 at 00:59:33Z. Each PR body said not to merge it. The timeline credits
  the shared login with no app. No local agent transcript on the workstation
  issued those merges, and the orchestrator's notes for the same hour record
  other PRs merged by that login inside their review windows. Cause NOT
  ATTRIBUTED, like the second rewrite in the stack test.
- What it means regardless of the cause: **a lower layer can merge alone at
  any moment.** The layer above is then force-pushed by the cascade and
  retargeted to the trunk. Slice B keeps its window and receipt; slice C has
  to treat "the layer below already merged" as a normal state, and its gate
  has to protect a lower layer from being merged alone by a gate loop.

## What slice C takes from this

1. `GithubRest` gains the stack read and the stack create; the pull record
   gains its stack reference and its merge commit.
2. `yeet publish` and `yeet open` take the parent PR, create the PR on the
   parent's branch and link the two through `POST stacks`. A failed link is
   repaired by running the command again.
3. `yeet ready` never pushes on a stack layer.
4. `yeet merge-gate` on the top gates every open layer, reads the trunk's
   ruleset instead of the parent branch's, lints the default squash message
   of the lower layer, and sends one request with no bypass.
5. A gate pointed at a lower layer with an open layer above it holds unless
   the caller asks for that layer alone.
