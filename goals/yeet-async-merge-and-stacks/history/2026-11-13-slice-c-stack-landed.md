# Slice C: a two-layer stack lands through Yeet, 2026-11-13

The slice C acceptance row (`SPEC.md`): one lane publishes a second layer on
an open PR through Yeet, with the footer, label and monitor; readies it
without a push; merges both layers from the top through the gate; and retires
both lanes with `yeet sweep --retire`. Times are UTC on 2026-11-13. Every fact
was read from this repository through the GitHub API or printed by the
command named.

**Result: pass.** Stack #3190 landed as two squash commits in one push.

| Layer | PR | Branch | Change | Squash commit on `main` |
| --- | --- | --- | --- | --- |
| 1, parent | #3188 | `fix/yeet-ready-stack-layer` | `yeet ready` never pushes on a stack layer; sweep adoption hint | `238dc10536` |
| 2, layer | #3189 | `fix/yeet-stack-reviewer-trunk` | the reviewer gate reads the trunk's ruleset for a layer | `b634505651` |

The stack was driven by the slice C lane's unmerged CLI, run by path from the
two layer lanes (lane head `439106e4bca` at publish, `a79b6295d4b` at merge).
Both lanes were retired with their own checkout's `bun run beep yeet sweep
--retire`.

## The four clauses

### 1. Publish a second layer on an open PR, with footer, label and monitor

Parent, 03:23:13Z, `yeet open --body-file <md>`:

```text
[yeet] --pr: created draft pull request through REST -> https://github.com/beep-effect/beep-effect/pull/3188
[yeet] applied ready-for-heavy to PR #3188
[yeet] readiness monitor job: … (submitted)
```

Layer, 03:23:33Z, `yeet open --stack-on 3188 --body-file <md>`:

```text
[yeet] --stack-on: publishing fix/yeet-stack-reviewer-trunk as a layer on #3188 (fix/yeet-ready-stack-layer @ c69a535ded), trunk main
[yeet] --pr: title from first-non-merge-commit: fix(repo-cli): gate a stack layer's reviewer check on the trunk's ruleset
[yeet] --pr: created draft pull request through REST -> https://github.com/beep-effect/beep-effect/pull/3189
[yeet] applied ready-for-heavy to PR #3189
[yeet] --stack-on: linked #3188 and #3189 as stack #3190
[yeet] readiness monitor job: … (submitted)
```

- #3189's base read `fix/yeet-ready-stack-layer`, and both pull records read
  `stack: {number: 3190, position: 1|2, size: 2}` with trunk `main`.
- Both bodies carry the `yeet-provenance` footer.
- The trunk precondition read green at that moment: every required context's
  newest completed run on `main` had passed.
- An earlier call with a merged parent refused and changed nothing:
  `yeet publish --stack-on refused (parent-not-open): #3170 is merged; publish on main without --stack-on`.

### 2. Ready it without a push

`yeet ready` in each lane, 03:24:02Z to 03:24:43Z. Heads before and after:

| PR | Before | After |
| --- | --- | --- |
| #3188 | draft, `c69a535ded52` | ready, `c69a535ded52` |
| #3189 | draft, `5c7520cafb4f` | ready, `5c7520cafb4f` |

```text
[yeet] pull request #3188 flipped from draft to ready for review
[yeet] posted beep-reviewer request for #3188 at c69a535ded52300f50f145155424a0a44c06999d; checkout and head unchanged
[yeet] pull request #3189 flipped from draft to ready for review
[yeet] posted beep-reviewer request for #3189 at 5c7520cafb4fe6acae30fc98379f3dc87c8453cc; checkout and head unchanged
```

`beep-reviewer` posted its summary on #3189 at 03:27:45Z and on #3188 at
03:28:16Z, with no push in between. The stack stayed intact.

### 3. Merge both layers from the top through the gate

04:40:06Z, `yeet merge-gate 3189 e9d799565ab2d5f89c9a4679bb7ddd7a8764bc9f`:

```text
[yeet] squash-commitlint #3189: pass (header "fix(repo-cli): gate a stack layer's reviewer check on the trunk's ruleset (#3189)")
[yeet] squash-commitlint #3188 (GitHub's default, stack #3190 layer 1): pass (header "fix(repo-cli): never push the reviewer re-request on a stack layer (#3188)")
[yeet] #3188 GATE-MET at 0c43f5e7eb (window 3256s)
[yeet] #3189 GATE-MET at e9d799565a (window 2900s)
[yeet] MERGED #3188 -> 238dc10536 "fix(repo-cli): never push the reviewer re-request on a stack layer (#3188)" via merge-async (stack #3190, layer 1)
[yeet] MERGED #3189 -> b634505651 "fix(repo-cli): gate a stack layer's reviewer check on the trunk's ruleset (#3189)" via merge-async (stack #3190, layer 2)
```

- One request, on #3189, with `bypass_rules: false`.
- `main`'s activity has one row for it: `pr_merge 67573ba11e..b634505651`
  at 04:40:26Z. Both commits were committed by GitHub in that second and
  read verified; `b634505651`'s parent is `238dc10536`.
- #3188 merged at 04:40:27Z and #3189 at 04:40:29Z. The stack reads
  `open: false`. Both head branches were deleted by 04:40:31Z.
- #3188 had three commits by then, so GitHub's default message was the PR
  title plus a bulleted body, as the gate had predicted and linted.
- `main` got one set of workflow runs, on `b634505651`. `238dc10536` has
  none.

The gate's holds were seen on the way, all on the live stack:

| When | Command | Hold |
| --- | --- | --- |
| 03:27:29Z | `merge-gate 3188 <sha> --dry-run` | `stack-below-top`: #3188 has open layer #3189 above it in stack #3190 |
| 03:27:29Z | `merge-gate 3189 <sha> --dry-run` | `#3188 HOLD required-pending`, the lower layer's hold first, then the top's |
| 04:39:43Z | `merge-gate 3189 <sha> --dry-run` | `#3188 HOLD threads-unresolved` and `#3189 HOLD threads-unresolved`, the two hold threads and nothing else |

### 4. Retire both lanes

04:41Z to 04:42Z, `bun run beep yeet sweep --retire` from inside each lane:

```text
[yeet] retired ~/…/stack-c-reviewer into ~/…/beep-effect
  branch fix/yeet-stack-reviewer-trunk: deleted
  gate: pull request MERGED
[yeet] retired ~/…/stack-c-ready into ~/…/beep-effect
  branch fix/yeet-ready-stack-layer: deleted
  gate: pull request MERGED
```

Each plan read `ok: local tip … equals pull request head …`: GitHub rewrote
neither layer, so no adoption was needed.

## What the run showed beyond the row

- **Heavy runs on a layer.** Both layers were code changes. Yeet labelled
  both, and on the final heads the Check workflow admitted Heavy from the
  sticky label: `Heavy / Build`, `Check`, `Coverage Regression`, `Docgen`,
  `Doctest`, `Lint Policy` and `Test Integration` all ran and passed on
  #3189, whose base is the parent's branch, exactly as on #3188. Each final
  head ended with 41 passing, 9 skipped and 1 neutral check run. The layer's
  Check run took 48 minutes, the parent's 39, most of it runner queue.
- **The parent moved, and the layer followed.** The reviewer left one P2 on
  #3188 and CodeRabbit one finding; both were fixed in `c193f14776f`. The
  parent merged `main` and pushed at 03:45Z. The layer merged the parent's
  branch and pushed with plain `yeet publish --push-only` at 03:49Z: Yeet
  read the layer from the branch's pull request
  (`publishing … as a layer on #3188 (… @ 0c43f5e7eb)`) and accepted the
  merge of the parent's branch. Both windows restarted with those pushes.
- **No rewrite.** `main` took 11 pushes while the stack was open, from
  03:23Z to 04:40Z. Neither branch's activity shows a force push. For an
  unmerged two-layer stack, GitHub did not restack when the trunk moved.
  Slice D still owns the partially merged case from the stack test.
- **Waiting.** Windows were never the wait. The first window would have
  elapsed at 03:44Z; the fix pushes moved it to 04:09Z; hosted CI finished at
  04:39Z and the merge followed in 67 seconds.

## What went wrong on the way

- **The first parent was merged out from under the stack.** #3170, the P0
  record, opened as a draft at 01:34Z, was flipped ready at 01:35:36Z and
  merged at 01:45:16Z by the shared login. The lane did neither. The stack
  was rebuilt on #3188, and both layers opened only once their final-check
  receipts existed, so `yeet ready` could flip them within a minute.
- **A hold label shadowed Heavy.** `owner-merge-hold`, added at 03:24:51Z,
  started an empty Heavy Admit run on each layer. It was removed at 03:26Z and
  `ready-for-heavy` re-applied. The layers were held by one unresolved review
  thread each instead, resolved at 04:40:03Z. `references/stacks.md` now says
  to hold a layer that way.
- **Local proof under load.** Both final-check receipts carry
  `coverage` skipped with its reason: the ratchet failed on three files other
  PRs had added to `main` without baseline rows. Hosted Test Unit and
  Coverage Regression passed on both final heads.

Receipts for these are in
[`../research/OPPORTUNITIES.md`](../research/OPPORTUNITIES.md).
