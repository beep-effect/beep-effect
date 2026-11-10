# Native-stack test, 2026-11-10

The supervised test that decision `stack-test-shape` in
[`../DECISIONS.md`](../DECISIONS.md) set. Times are UTC on 2026-11-10. Every
fact below was read from this repository through the GitHub API, a job log or
a local command.

**Result: pass.** Three layers landed through the async merge endpoint with no
force-push by the lane, and `main` ended with no net change. Two facts stayed
unobserved and are marked so.

## What ran

| Layer | PR | Change | Landed |
| --- | --- | --- | --- |
| 1 | #3049 | adds `research/stack-probe-a.md` (265 bytes) | 02:45:58Z, alone, as `7f022c5523` |
| 2 | #3050 | adds `research/stack-probe-b.md` (163 bytes) | 03:15:32Z, with layer 3, as `9c9d1bd7de` |
| 3 | #3051 | deletes both files | 03:15:33Z, with layer 2, as `f23a553dc7` |

- Stack #3052, built with `gh stack` v0.3.0: `gh stack init` over three
  existing local branches, then `gh stack submit --auto`.
- Each layer was labelled `ready-for-heavy` by hand and flipped ready with
  `gh pr ready` at 02:25:18Z to 02:25:20Z.
- The payload was two probe files, not the one file the decision first
  described. A layer-2 file of its own makes the diff base visible: one
  path against the parent, two against the trunk.

Timeline:

| Time | Event |
| --- | --- |
| 02:24:16Z | three draft PRs and the stack created |
| 02:31Z | Check complete on all three heads, about 6 minutes each |
| 02:45:55Z | async merge of layer 1 requested; `merged` at 02:46:04Z |
| 02:46:04Z | GitHub force-pushes layers 2 and 3 (the cascade) |
| 02:53:40Z | #3041 lands on `main` |
| 02:54:20Z | layers 2 and 3 are force-pushed a second time |
| 03:15:00Z | async merge of the top requested with a thread open on layer 2; `failed` at 03:15:05Z |
| 03:15:27Z | thread resolved, async merge of the top requested again; `merged` at 03:15:36Z |

## The six facts from `stack-test-terms`

1. **Base refs: the workflow sees two different bases.**
   - `GITHUB_BASE_REF` is `main`, the stack base, on every layer. Secret
     Scanning scans `origin/${GITHUB_BASE_REF}..HEAD`: it read 265 bytes in
     1 commit on layer 1 and 428 bytes in 2 commits on layers 2 and 3. 428
     is both probe files, so the range started at `main`.
   - `github.event.pull_request.base` is the direct parent. On layer 2
     `BEEP_CI_PR_BASE_SHA` and `BEEP_COVERAGE_BASE_SHA` were layer 1's
     head, and Change Profile reported `docs_only=true` from the layer's
     own diff.
   - Gitleaks pins its config to `origin/${GITHUB_BASE_REF}`, so to `main`.
     A layer cannot loosen the scanner for the layer above it.
   - This corrects the 10-13 note that a layer's `GITHUB_BASE_REF` is its
     direct parent.
   - Merge refs chain: `refs/pull/3050/merge` is layer 1's merge ref plus
     layer 2. Each layer's CI therefore tests `main` plus every layer below
     it plus itself.
2. **The cascade starts CI again.** Four seconds after the force-push,
   Check, Storybook and Vercel Deploy started on both rewritten heads as
   `pull_request` runs. The runs API does not show the activity type.
   - Layer 2's timeline shows `automatic_base_change_succeeded` and then
     `head_ref_force_pushed`. Layer 3's shows `head_ref_force_pushed` only.
   - Heavy re-admission was not exercised; see the correction below.
3. **The review window restarts on every rewrite, with the diff unchanged.**
   - `git patch-id --stable` was identical before and after the cascade for
     both layers, and the reviewer bot reported the diff unchanged.
   - Under today's law (`ReviewWindow.ts`, any `head_ref_force_pushed`) the
     window restarted at 02:46:04Z and again at 02:54:20Z. The second merge
     waited 29 minutes for a diff that never changed.
   - Decision `review-window-on-cascade` is therefore a precondition for
     routine stacks, and patch-id is a workable test for it.
4. **Thread resolution is enforced on every layer in the merge.** With one
   unresolved thread on layer 2, the async merge of layer 3 ended `failed`
   with "A conversation must be resolved before this pull request can be
   merged." Nothing merged. The thread survived both rewrites, not outdated.
5. **Rewritten commits were unsigned after the cascade and signed after the
   second rewrite.**
   - Cascade commits: committer is the original author, `verified=false`,
     reason `unsigned`.
   - Second rewrite: committer is GitHub, `verified=true`.
   - The original commits were SSH-signed locally but read `unknown_key` on
     GitHub, so the GA claim that a cascade signs when the originals were
     signed could not be tested. The ruleset requires no signatures.
6. **Review bots: one of three observed.**
   - `beep-reviewer` reviewed each layer twice, on the cascaded heads and
     on the rebased heads, at 5/5. It reviewed the layer's own diff and its
     text was stack-aware ("the restack leaves this PR's diff unchanged").
   - CodeRabbit posted "Review limit reached" on all three.
   - Greptile and Codex posted nothing. NOT OBSERVED.
   - `pulls/<n>/files` returns the layer's own diff.

## The added facts from `stack-test-shape`

- **The async endpoint works for a single PR and for a stack.**
  - `PUT pulls/{n}/merge-async` with `merge_action=direct_merge`,
    `merge_method=squash`, `sha` and `bypass_rules=false` answered 202 with
    a `uuid`. The poll went `pending`, then `merged` with the merge commit
    sha, within 9 seconds.
  - A refusal comes back as `failed` with the rule's own sentence.
  - For layer 1, `commit_title` and `commit_message` were written exactly
    as sent.
- **An atomic merge writes one squash commit per PR and one push.**
  - Layers 2 and 3 became `9c9d1bd7de` and `f23a553dc7`, both committed by
    GitHub and verified.
  - Without `commit_title`, the message was the commit subject plus
    ` (#n)` and the trailers. Commitlint passed on `main`.
  - `main` got one Check run, on the top commit. Two separate merges would
    have started two.
- **GitHub deletes each merged layer's branch** within three seconds.
- **Yeet on a layer:**
  - `yeet status --remote` finds the PR and reads the 15 required contexts
    and the thread. It does not notice that the local branch is behind a
    rewritten remote head.
  - `yeet ready` was not run. After the flip it pushes an empty
    `chore: re-request beep-reviewer (S32)` commit
    (`.claude/skills/yeet/references/merge-loop.md`). On any layer but the
    top, that push moves the head off the base of the layer above, and the
    stack then needs a rebase.
  - `yeet final-check` was not run. Its receipt is bound to the head, and
    each layer's head changed twice in 30 minutes.
  - `yeet sweep --retire` refused the branch delete while the local tip was
    the first rewritten head (`unmet: local tip ... equals pull request
    head`). It passed after
    `git fetch origin refs/pull/3051/head && git switch -C <branch> FETCH_HEAD`.
  - The lane never force-pushed. Each rewrite was adopted with
    `git switch -C`, which the harness allows.
- **The `stacked` activity:** each PR's timeline shows `added_to_stack` at
  creation. Layer 3 got two sets of runs in the same second and the second
  cancelled the first; layers 1 and 2 got one set. Cause NOT OBSERVED.

## Things the test did not expect

- **A second rewrite, 38 seconds after `main` moved.** Both remaining
  layers were rebased onto the new `main` tip by a server-side operation
  that signs as GitHub. The timeline credits the shared login, no comment
  claims it, the repository has `allow_update_branch=false`, and no
  repo-cli code calls a branch update. Either someone on the shared login
  pressed "Rebase stack", or GitHub restacks a partially merged stack when
  its trunk moves. Cause NOT ATTRIBUTED. Each such rewrite restarts CI and
  the review window.
- **The stack object is not renumbered.** After layer 1 merged, layers 2
  and 3 still read `position` 2 and 3 of `size` 3. The async merge of
  "everything up to the top" took the two open layers.
- **`gh stack submit` needs one push remote.** With three remotes it
  refused: "multiple remotes configured; set remote.pushDefault". It ran
  with `GIT_CONFIG_KEY_0=remote.pushDefault` set in the environment.
- **An unevaluated check name.** Layer 3's superseded run left a cancelled
  check run named with a literal expression
  (`needs.admission.outputs.legacy_integration == 'true' && ...`). The
  orchestrator saw it as a red status in its gate table. The job was
  cancelled before its `name:` expression was evaluated, so any run
  cancelled that early would show it; the stack only supplied the early
  cancel.

## Correction to the decision's reasoning

`stack-test-shape` said the admission label wins over the docs-only
classification, so a labelled probe would exercise Heavy. In hosted CI it
does not. The Check run and the label-triggered Heavy Admit run both set
`verdict=skip-satisfied` from Change Profile's `docs_only`, and every
`Heavy /` job skipped. `HeavyAdmission.ts` does let the label win, but the
workflow decides before it is asked. The test showed that Heavy Admit
fires on a layer when the label is added. It did not show a Heavy lane
running on one.

## What this means for routine use

- Nothing in GitHub's side blocked a stack here. The blockers are in Yeet:
  the legacy merge endpoint, the S32 push in `yeet ready`, a head-bound
  receipt and a window that restarts on rewrites that change nothing.
- A stack that waits on a 20-minute window while `main` lands a PR every
  20 minutes or so can be rewritten faster than it can become mergeable,
  if the second rewrite is automatic.
- One push for the whole stack means one `main` Check run, where separate
  merges start one each and 70% are cancelled.
