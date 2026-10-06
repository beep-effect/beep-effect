# Reviewer and hosted-check behaviour on a draft pull request

Observed on this packet's own PR #1427, the first pull request opened by the
push-first default path (2026-10-05).

| Signal | Draft behaviour | Evidence |
| --- | --- | --- |
| Greptile | Reviews the draft like a ready PR: one `COMMENTED` review with four inline threads (3 × P1, 1 × P2) within the first poll window after the push. | `yeet job wait` returned exit 2 with four `review-thread` P1 rows at head `11f9821`. |
| CodeRabbit | No review observed on the draft during the first wave. | No `coderabbitai` review or thread on #1427 at the first wave. |
| Blacksmith codesmith | Posts a `skipping` check and an enable-autofix link; it also edited the PR body concurrently, which the provenance stamp preserved. | `[yeet] provenance footer for PR #1427 preserved a concurrent body edit by blacksmith-sh`. |
| `check.yml` tier 1 | Runs on the draft: Test Unit shards, Lint, Nix Shell, Storybook, Vercel previews all started on the first push. | `gh pr checks 1427` immediately after publish. |
| Heavy Admission | Runs on the draft once `ready-for-heavy` is applied; the label was applied by publish at creation. | `[yeet] applied ready-for-heavy to PR #1427`; `Heavy Admission` checks present. |
| Required-check gating | Unchanged by draft state; `merge-ready` still requires `notDraft`, which is why `ready-pending-flip` exists. | `WatchMode.ts` `notDraft` criterion. |

## Consequence for the packet

The push-first default relies on hosted CI and reviewers as back-pressure.
Both arrive on a draft, so opening every PR as a draft (D4) costs nothing in
feedback latency and keeps the account-merge race (draft-until-final rule) out
of the fix loop. CodeRabbit's absence on the first wave is noted, not
concluded; it is opt-in behind `--bots` in closeout anyway.
