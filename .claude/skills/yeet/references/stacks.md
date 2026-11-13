# Two-layer native stacks

Read when a change needs another open PR's code and cannot be folded into it, when a gate holds with a `stack-*` reason, or when GitHub rewrote a layer's head. Part of the yeet skill.

A native GitHub stack chains pull requests base to head on one trunk. Yeet
supports two layers: a **parent** PR on `main` and one **layer** PR on the
parent's branch. GitHub runs the full required matrix on each layer, enforces
`main`'s rules on every layer when the stack merges, and merges both layers in
one push from the top (`goals/yeet-async-merge-and-stacks`).

## Rules

- Two layers at most. A parent that is already stacked, or that targets
  anything but `main`, refuses the layer.
- Open a stack only while `main`'s required checks are green. Yeet reads each
  required context's newest completed run on `main` and refuses on a red or an
  unknown one. There is no override.
- A lane never force-pushes or rebases a published branch, and never runs
  `gh stack rebase`, `sync`, `modify`, `submit` or `push`, or the browser's
  "Rebase stack". GitHub does the rewriting; the lane adopts it.
- No PR on a non-`main` base outside a stack: no workflow fires on it.
- Every layer keeps commit subjects of 98 characters or fewer that pass
  commitlint. GitHub writes its own default squash message for the lower
  layer of a stack merge.
- Joins and fans (a layer on two parents, two layers on one parent) are not
  stacks. They stay on the fold or publish-after-parent rule.

## Open a layer

1. Cut the lane from the parent's branch, not from `main`:

```bash
bun run beep worktree new <lane> --branch <branch> --base origin/<parent-branch>
```

2. Publish it on the parent PR:

```bash
bun run beep yeet publish --stack-on <parent-pr> --message "type(scope): summary"
```

   `yeet open --stack-on <parent-pr> --body-file <md>` is the same for a
   pre-committed head. The PR is created on the parent's branch, linked to
   the parent through the Stacks REST API, and gets the provenance footer,
   the `ready-for-heavy` label and the readiness monitor like any Yeet PR.
   Its title and body summary come from the layer's own commits.
3. A refusal changes nothing. It names one of: `parent-not-open`,
   `parent-off-trunk`, `parent-stacked`, `parent-is-self`,
   `not-built-on-parent`, `existing-base-mismatch`, `stack-mismatch`,
   `trunk-red`, `trunk-unknown`.
4. If the PR was created and the link failed, run the same command again. It
   finds the PR and links it.
5. Later pushes are plain `bun run beep yeet publish --message "..."`. Yeet
   reads the stack from the branch's PR; the flag is not repeated.
6. Until the pilot's verdict (due 2026-11-27), add the stack's row to
   `goals/yeet-async-merge-and-stacks/research/stack-pilot-2026-11.md` in the
   layer's PR before you gate the top; that file names the fields.

## Keep the layer on the parent

- When `main` moves under the stack, the **parent** lane merges `origin/main`
  and pushes. The layer never merges `main` itself: its diff would then carry
  `main`'s changes until the parent catches up.
- When the parent pushes, the layer merges the parent's branch and pushes:

```bash
git fetch origin && git merge origin/<parent-branch>
```

```bash
bun run beep yeet publish --push-only
```

  The merge gate holds as `stack-out-of-date` until the layer contains the
  parent's head.
- A base-conflict row on the layer names the parent's branch
  (`base conflict with origin/<parent-branch>`), and so does the settle
  line. Merge that branch, never `origin/main`. A "sibling merged" comment on
  a layer says the same, and after the parent merged alone it tells the
  layer to adopt the cascade instead of merging anything.

## Ready

Run `bun run beep yeet final-check` and `bun run beep yeet ready` in each
lane, as for any PR. On a stack layer `yeet ready` pushes nothing: it asks
`beep-reviewer` for the review with an exact-head comment, and a layer the
comment route does not cover gets the manual comment body instead of the S32
commit. The flip itself moves no head, so the stack stays intact.

## Merge from the top

```bash
bun run beep yeet merge-gate <top-pr> <top-head-sha>
```

The gate reads the stack, gates the lower layer and then the top with the
same criteria (draft, conflicts, required contexts on `main`'s ruleset,
other checks, review window, threads), lints the squash message each layer
will get, checks that the top contains the lower layer's head, and sends one
`merge-async` request for the top with no bypass. GitHub merges both layers
in one push. The gate prints one merged line per layer with its own squash
commit.

| Hold | Meaning | Do |
| --- | --- | --- |
| a normal reason on the lower PR's number | the lower layer is not mergeable yet | fix it in the parent lane |
| `stack-out-of-date` | the top does not contain the lower layer's head | merge the parent's branch into the layer, push |
| `stack-below-top` | the gated PR has an open layer above it | gate the top instead, or pass `--alone` |
| `stack-relaxed` | `--relaxed` was asked for a two-layer merge | a bypass reaches only the lowest layer: wait for green, or land bottom-up |
| `stack-too-deep` | more than two open layers | land the lowest layer alone first |
| `stack-unknown` | the stack could not be read | retry; never assume a single PR |

`yeet merge` and `yeet gh merge` refuse a PR whose merge would take another
layer with it and point at `merge-gate`.

**Landing bottom-up.** `bun run beep yeet merge-gate <parent-pr> <sha> --alone`
merges the parent by itself. GitHub then retargets the layer to `main` and
force-pushes it (the cascade), which restarts its CI. Use it when `main` is
red and the parent needs `--relaxed`, or when the layer is not ready. Anyone
with merge rights can also merge the parent alone at any time, so treat a
cascade as normal.

**Holding a layer until the top is gated.** To keep a ready lower layer from
being merged alone, open one review thread on it that says so and resolve it
when you gate the top: an unresolved thread blocks every merge that does not
bypass the ruleset. Do not use a label for this. Any label a user or agent
adds after `ready-for-heavy` starts a Heavy Admit run whose jobs all skip, and
GitHub's rules can then count the required `Heavy / *` checks as missing (seen
on #3133, 2026-11-12). If a label was added anyway, re-apply
`ready-for-heavy` last so the newest Heavy Admit run is a real one, and wait
for it.

## After GitHub rewrites a layer

A cascade or a restack replaces the layer's commits with GitHub's replay.
The local branch is then behind a head it cannot fast-forward to.

```bash
git fetch origin && git branch -f pre-cascade HEAD && git switch -C <branch> origin/<branch>
```

- Do this before any further commit. `git switch -C` resets the branch, so
  `pre-cascade` keeps the old tip: cherry-pick from it any commit of your own
  that was never pushed, then push as a fast-forward.
- A rewrite that changed nothing keeps the review window and the final-check
  receipt (`yeet ready` and the gate say so). A rewrite that changed a patch
  restarts both.
- After the lower layer merged, the layer is an ordinary PR on `main`:
  publish, gate and merge it as one.

## Retire

Run `bun run beep yeet sweep --retire` from inside each lane after its PR
reads MERGED. GitHub deletes a merged layer's branch within seconds, so
`origin/<branch>` is gone. If a plan reports
`unmet: local tip … equals pull request head …`, adopt the PR's own head ref
first, after checking that the local tip holds no commit of your own:

```bash
git fetch origin refs/pull/<n>/head && git switch -C <branch> FETCH_HEAD
```

## Unstack

When `main` stops being green for a working day, land the parent alone with
`--alone` (and `--relaxed` if S11 applies) and let the cascade put the layer
on `main`. Do not dissolve the stack by hand while both layers are open: the
layer would be left on a non-`main` base with no workflow.
