---
name: yeet
description: Canonical repo-quality operator workflow for beep-effect. Use when repairing local changes, proving quality, committing, pushing, opening or monitoring a PR, or moving a branch toward mergeable GitHub state with `bun run beep yeet`.
---

# Yeet Quality Path

Use this skill when a user asks to repair, verify, publish, push, open a PR, or
make a branch mergeable in this repository. Yeet is the canonical operator path
for End-to-End Green: deterministic local repair, cheap-gates before the push,
reviewed commit, push to a draft PR, hosted checks and review as the
authoritative proof, review closeout, and merge readiness.

## Ground First

1. Inspect the current branch and worktree:

```bash
git status --short --branch
```

```bash
git diff --name-status
```

2. If the checkout is on `main` or another protected/default branch, create a
   feature branch from the intended base before editing or publishing.
2b. Check base freshness before publish:

```bash
git fetch origin main:refs/remotes/origin/main --quiet
```

```bash
git rev-list --count "$(git merge-base HEAD origin/main)"..origin/main
```

   Yeet publish warns whenever the branch is behind `origin/main` and refuses
   when branch files overlap commits landed on the base since the merge-base
   (a conflicted or stale PR is likely). Catch up by merging the base into the
   feature branch — never by rebasing:

```bash
git fetch origin
```

```bash
git merge origin/main
```

   Resolve conflicts, re-run `bun run beep yeet verify`, then publish again.
   Do not rebase a published branch: rebase implies a force-push, and this
   repository denies `git push --force*`. GitHub squash-merge erases
   feature-branch merge commits at land time anyway. `--allow-stale-base` is
   the explicit override when proceeding despite overlap is intended.
2c. Dependent lanes (`explorations/stacked-pr-adoption`, ruled 2026-10-13).
   When the change needs another open PR's code:
   - fold it into that PR while it is still open, coordinating with its
     owner;
   - otherwise build on its branch locally, and after it lands replay only
     your commits onto `origin/main`
     (`git rebase --onto origin/main <parent-head-sha>`, allowed because
     your branch is not published yet), then publish.

   Never open a PR against a non-`main` base: no workflow fires on it.
   Never merge an unlanded PR's branch into yours. A lane blocked by red
   `main` waits for the declared `unblocks-main` PR, then merges `main`
   once. Native stacks stay deferred until that packet's reopen gate fires.
3. If the worktree contains unrelated changes, stage only the intended files.
   Never publish unrelated paths silently.
4. Check for already-running heavyweight quality commands before starting a
   Yeet lane. Use metadata-only columns (`comm` = executable name) and never the
   full `cmd` column: process arguments routinely contain credentials (git
   `http.extraHeader` bearer tokens, credentialed clone/fetch URLs, API keys),
   and that output would leak into the agent transcript. Summarize matches by
   pid/binary; never copy full command lines verbatim:

```bash
ps -eo pid,ppid,stat,etime,comm | rg 'bun|node|beep|turbo|gh|git' | rg -v 'rg|ps' || true
```

## Canonical Commands

Durable jobs: `--detach` runs `verify`, `publish`, `monitor`, `repair`, and
`closeout` as transient systemd user services that outlive the tool-call cap;
`bun run beep yeet job wait <jobId>` blocks on one and exits 0 green, 1 red,
2 wave, 3 terminated. Flags, exit semantics, and the job journal:
[`references/detached-jobs.md`](references/detached-jobs.md).

- Repair local work:

```bash
bun run beep yeet repair
```

- Prove the branch without committing or pushing:

```bash
bun run beep yeet verify
```

- Run the collected cheap gates without starting build, lint, check, tests, or
  docgen:

```bash
bun run beep yeet verify --tier cheap-gates
```

- Run the targeted review-fix proof while iterating on PR comments:

```bash
bun run beep yeet verify --tier review-fix
```

- Commit reviewed staged changes, run cheap-gates and the head-install
  preflight, push, open a draft PR labelled `ready-for-heavy`, submit the
  detached readiness monitor, and exit with the PR URL and job id
  (push-first-publish D1–D8; this is the default and needs no extra flag):

```bash
bun run beep yeet publish --message "type(scope): summary"
```

- Push without opening a pull request (no hosted checks run until one exists):

```bash
bun run beep yeet publish --no-pr --message "type(scope): summary"
```

- Run the full local proof and CI parity before the push (the pre-2026-10-05
  order; use only when a local full proof is explicitly wanted first):

```bash
bun run beep yeet publish --prove-first --message "type(scope): summary"
```

- Flip this branch's draft PR to ready as soon as its content is final: no
  further push planned, cheap gates passed at publish, every review thread
  answered. Hosted heavy CI may still be running; only a required check that
  is already red holds the flip (it refuses and names the blocker; there is no
  `--force`):

```bash
bun run beep yeet ready
```

  Under S11 (AGENTS.md "Mergeable"), when the refusing red is inherited from
  `main`, call final and attribute each inherited red (repeatable). The flip
  records them in a marked "Inherited reds (S11)" section of the PR body
  first, refuses if that write fails, and still requires every review thread
  to be answered:

```bash
bun run beep yeet ready --inherited "<check name>=<attribution>"
```

- Publish exactly the staged index from a dirty worktree (unstaged/untracked
  residue is parked in a marked stash after the commit, the clean tree is
  proven, and the stash is restored after push; on a restore conflict the stash
  is kept and its marker reported):

```bash
bun run beep yeet publish --staged-only --message "type(scope): summary"
```

- Stay attached to hosted PR checks after the push instead of submitting the
  detached readiness monitor (opt-in; the fleet default is detached):

```bash
bun run beep yeet publish --monitor --message "type(scope): summary"
```

- Reply to and resolve addressed review threads during closeout (explicit
  per-thread flags; closeout never writes without them):

```bash
bun run beep yeet closeout --reply-thread <thread-id> --reply-body "Fixed in <sha>." --resolve-threads <thread-id>[,<thread-id>...]
```

- Retry after a separately verified amend without creating a new commit:

```bash
bun run beep yeet publish --amend --no-edit --reuse-verified
```

- Push an already-verified clean commit without committing or rerunning local
  proof:

```bash
bun run beep yeet publish --push-only --reuse-verified
```

- Monitor hosted PR checks for the current branch:

```bash
bun run beep yeet monitor
```

`yeet monitor` records the current agent locally and re-asserts the registry-backed
provenance footer once before polling. This restores a missing or drifted footer
without treating the PR body's public JSON twin as trusted state.

- Keep monitoring across pushes until the PR merges or closes. This announces
  readiness once per head, writes the `pr-merge-ready` inbox row, and keeps
  polling after the announcement:

```bash
bun run beep yeet monitor --until-merged
```

- Reset the clone after a merge (prune refs, fast-forward `main`, delete the
  merged branch locally and remotely, return to `main`, then reinstall when
  `bun.lock` moved). The checkout is moved to `main` only from the merged
  branch itself; a clone standing on any other branch is a live checkout, so
  `end-state` and `lockfile-install` skip with that HEAD named in the plan and
  only the ref-only steps run. Inspect the plan before running it:

```bash
bun run beep yeet sweep --plan
```

```bash
bun run beep yeet sweep
```

- From inside a linked worktree (a Claude Code `.claude/worktrees/<name>` lane
  or a sibling `-worktrees` lane) the plain sweep only fetch-prunes. `--retire`
  is the post-merge closeout for that case: it archive-retires the worktree,
  deletes the branch, then sweeps the owning clone. It refuses until the PR is
  MERGED and heads this branch, so running it early is safe. Run it from inside
  the lane, as the last command of the session:

```bash
bun run beep yeet sweep --retire --plan
```

```bash
CLONE="$(git rev-parse --path-format=absolute --git-common-dir)/.." && bun run beep yeet sweep --retire && cd "$CLONE"
```

  Holder fences, the Claude Desktop Terminal panel shell, `--lane <path>`,
  running the lane's own CLI from an older clone, and the active-packet
  warning: [`references/sweep-retire.md`](references/sweep-retire.md).

- Post and resolve the drafted review-thread replies for this branch's PR:

```bash
bun run beep yeet reply
```

- Squash-merge this branch's PR, confirm `MERGED` through the API, then sweep
  the clone. Operator-authorized only — never run it without being asked:

```bash
bun run beep yeet merge
```

- Read the local Yeet operator state before scanning logs. This is local-only
  by default and reads branch/worktree state plus the latest Yeet artifacts:

```bash
bun run beep yeet status
```

```bash
bun run beep yeet status --json
```

- Include live GitHub PR/check/mergeability data only when you need it:

```bash
bun run beep yeet status --remote
```

- Print compact operator summaries for hosted monitor or closeout flows:

```bash
bun run beep yeet monitor --summary
```

```bash
bun run beep yeet closeout --summary --require-review-comments 0
```

- Inspect review threads and review-bot findings for the current branch PR:

```bash
bun run beep yeet closeout --require-review-comments 0
```

  Add `--require-greptile-score 5/5 --require-greptile-issues 0` only when the
  operator asks to wait on Greptile for this PR. Those gates set the closeout
  command's own exit code and print as review-bot advisories in `yeet status`;
  they never hold `merge-ready`.

- Inspect local hardware profile guidance before choosing heavy parallel work:

```bash
bun run beep quality profile detect
```

```bash
bun run beep quality profile config workstation
```

## Gates: cheap-gates before the push, hosted CI after

`yeet publish` gates the push on the cheap-gates tier (12 deterministic gates
in one collected wave: config sync, tsgo rule parity, Effect imports,
schema-first, goals checks, Knip, Fallow, changeset status, JSDoc ratchet) and
the head-install preflight (a frozen-lockfile install of committed `HEAD` in a
temporary worktree). Hosted CI is the authoritative proof. `bun run beep yeet
verify` (full tier) dispatches the hosted lane bodies locally and is on-demand:
run it to reproduce a hosted red, never to unblock a publish. Package-scoped
`turbo run check`, `docgen:local --reuse-proof-manifest`, and the cheap tier
alone are inner-loop tools, not proof. Details, what the full proof does not
replay, and plan mode: [`references/gates-and-proof.md`](references/gates-and-proof.md).

## CI / security fixes: validate against the CI token's permissions

A change that alters CI or security-gate behavior (for example making a `gh api`
call fail-closed, or tightening a workflow permission) must be validated against
the **actual CI token's permissions**, not just locally. A gate that reads, say,
`security_and_analysis` will block every PR if the CI token cannot read it.
Confirm the token scope (or fail *open* on a genuine permission error, distinct
from a real security failure) before shipping such a fix.

## Mergeable PR Workflow

1. Run `bun run beep yeet repair` when local changes need deterministic fixers,
   docgen, or affected feedback.
2. Stage the reviewed files explicitly.
3. Run `bun run beep yeet status` when you need a compact local readiness
   snapshot before publishing.
4. Run `bun run beep yeet publish --message "type(scope): summary"`. It runs
   cheap-gates and the head-install preflight, pushes, opens a **draft** PR
   labelled `ready-for-heavy` when none is open (docs-only diffs skip the
   label), submits `monitor --until-ready --detach`, prints the PR URL and job
   id, and exits. A cheap-gates red blocks the push: read the gate line, run
   `yeet repair`, publish again. Never wait on a queued full proof to publish.
5. Push budget (D6): one push per fully addressed wave of inbox rows or review
   threads, never per file or per comment. Every push costs a hosted run.
6. Block on the job publish submitted: `bun run beep yeet job wait <jobId>`. The job survives session restarts and
   the ten-minute tool-call cap, but not a reboot: re-submit it after one.
   A required red or a base conflict does not end the monitor: it writes inbox
   rows and keeps polling across your fix pushes, so do not re-submit it after
   a red. A fix `publish` on the same branch reads the job registry and reuses
   the running monitor (it prints the existing job id and `job wait` command
   and records the submit step as skipped); it submits a new job only when no
   `submitted` or `running` monitor follows the PR. `job wait` returns 0 for green (the loop ended `ready`), 2 for a wave
   (new P0 rows or P1 thread and comment rows on this PR, or a required red
   that came back red on a rerun: read the gate line, act on the rows, publish
   any fix, then re-run `bun run beep yeet job wait <jobId>` on the same job),
   1 for red (`settle-timeout`, `closed`, or a spent poll-error budget), and 3
   for a terminated job. When the user manager is unreachable, run
   `bun run beep yeet monitor --until-ready` attached instead: it has no job,
   so it ends itself with exit 2 on a wave (rows already in the inbox when it
   started end it only when a rerun of their check comes back red); re-run it
   after the fix push. Exit 0 with
   `merge-ready: yes` means the review window has elapsed too: re-read the
   review threads, then merge it yourself (`bun run beep yeet merge`), or
   leave it to the orchestrator session at the gate; the monitor never merges on
   its own.
   On exit 1 or 3, read the summary line, fix the named blocker, publish, and
   re-submit the monitor. Publish applies the `ready-for-heavy` label when it
   creates the draft PR, so a code PR is admitted to the heavy matrix from the
   first push. A PR that existed before the publish, or one whose label edit
   failed, holds at `heavy-not-admitted` until you add the label by hand (see
   [`references/merge-loop.md`](references/merge-loop.md)). Act on unresolved review threads through the reply
   flow while the loop waits. The loop runs read-first closeout automatically
   after the required checks settle. `monitor --summary` remains a one-shot
   compact read.
7. Run `bun run beep yeet closeout --summary --require-review-comments 0`
   to inspect unresolved actionable review threads and review-bot findings.
8. While fixing PR comments, `bun run beep yeet verify --tier review-fix` is
   optional local iteration; the fix wave still publishes through the default
   push-first path.
9. Address failed checks or actionable review comments with follow-up commits
   through the same Yeet publish path.
10. Flip ready at content-final: as soon as no further push is planned and
    the publish passed its cheap gates, run `bun run beep yeet ready`, without
    waiting for hosted heavy CI. Draft means only "I am still pushing".
    Reviewers start when the PR leaves draft and take 8–15 minutes, so the CI
    run is the review window (review-window ruling, 2026-10-06). The flip
    refuses only on a required check that is already red or an unanswered
    thread. A job that ends `ready-pending-flip` (exit 0) means you left the
    draft until green: flip it, then the full review window still has to run.
    Mergeable means all of: required checks green; no outstanding review
    thread — unresolved, or resolved by the author with a later human reviewer
    comment nobody answered, outdated threads included until they are
    explicitly resolved; GitHub reports the branch mergeable; and the review
    window has elapsed — 20 minutes since the later of the last
    ready-for-review event and the last push to the head, so a fix push
    restarts it. Never flip and merge in one step, and re-read the threads
    right before merging. `bun run beep yeet status --remote` prints a
    `merge-ready:` line that names the first failing criterion, with
    `review window open: N min left` when the window is the last one.
11. After the merge lands, run `bun run beep yeet sweep` — or, from a lane
    worktree, `bun run beep yeet sweep --retire` — or let
    `monitor --until-merged` run the sweep on merged detection — so the next
    branch does not start from a stale clone and the lane does not linger.
    If the merged change touched a systemd unit renderer, re-render the
    installed units from the swept clone with
    `bun run beep research install-timers --refresh` and/or
    `bun run beep graft deep install-timer --refresh` (see
    `docs/runbooks/systemd-timers.md`). Do not hand any of this to the operator.

`yeet closeout` is read-first. It classifies review threads and bot findings and
writes Yeet artifacts locally. It posts a Greptile rerun comment only when
`--retrigger-greptile` is explicit, and it does not auto-resolve or auto-reply to
review threads. The default bot lineup is **greptile-only** (2026-07-05,
agent-pipeline-velocity): the closeout artifact includes durable states for
review threads, Greptile, and hosted-check handoff. CodeRabbit/ChatGPT gates
appear only with explicit opt-in via `--bots greptile,coderabbit,chatgpt`
(CodeRabbit auto-reviews are live on this repo — it posted two summary reviews
on PR #1184 on 2026-09-22 — but its closeout thread gate stays opt-in behind
`--bots`; ChatGPT has no app installed, so its gate reads "unknown" unless
comments exist). Deep review is on-demand:
`/code-review ultra` or an explicit `@codex review` mention.

## Push-First Publish

`yeet publish` is push-first by default (push-first-publish, 2026-10-05):

- Gate before the push: cheap-gates tier + head-install preflight. No
  admission ticket is taken; the publish never queues behind another
  session's full proof.
- After the push: `gh pr create --draft`, `ready-for-heavy` label (skipped on
  docs-only diffs and on PRs that already existed), provenance stamp, then
  `monitor --until-ready --detach` is submitted and publish exits with the PR
  URL and job id. `--monitor` stays attached instead (opt-in).
- `--no-pr` pushes without a PR and warns: `check.yml` runs only on
  `pull_request`, so no hosted checks run until a PR exists.
- `--prove-first` restores the previous proof order (full proof + CI parity
  before the push). It is the only way to put the full proof on the publish
  path. `--push-only` still pushes an already-proven commit. Both share the
  same draft, label, and detached-monitor tail as the default. `--fast` and
  `--start-pr-early` no longer exist.
- `bun run audit:github pre-push` remains the named full local fallback for
  secrets, security, SAST, Nix, and any lane that must be proven outside Yeet.

## Ready

`bun run beep yeet ready` flips a draft at content-final (push-first-publish
D11, which amends D10). It reads the PR with the monitor's own status read and
flips the draft when, on the current head, the PR is open, no required
check is known to be failing, and every review thread is answered. Pending
checks and optional lanes (`Heavy / *`) never hold it. Otherwise it refuses
with the first blocker named (`pr-open`, `no-required-red`,
`threads-resolved`). There is no `--force`. Flip only when no further push is
planned: a push after the flip restarts the review window. The flip is the
GraphQL-only `markPullRequestReadyForReview`, spent through the GraphQL budget
guard: when the shared budget is spent it waits (bounded, logged) for the
hourly reset instead of failing the way `gh pr ready` did.

The merge gate carries the wait instead. `merge-ready: yes` needs the
`review-window-elapsed` criterion: 20 minutes since the later of the latest
`ready_for_review` timeline event (the PR's creation when it was opened
ready) and the push of the current head (the earliest check suite on the head
commit). Both are read over REST, only once every other criterion holds, and
the current time comes from the Effect `Clock`. A failed or unparsable read
is `review window unknown`, which blocks exactly like an open window.
`BEEP_YEET_REVIEW_WINDOW` overrides the length with an Effect duration string
(`"30 minutes"`); the default is `YEET_REVIEW_WINDOW_DEFAULT` in
`internal/ReviewWindow.ts`. No reviewer has to post for the window to elapse.

`monitor --until-ready` still ends `ready-pending-flip` (exit 0) when the PR
is a draft and nothing but the draft flag blocks it. That now means the owner
flipped late: the window starts at the flip, so submit a new monitor after
`yeet ready` and wait for `merge-ready: yes`.

## References

Load these on demand; `SKILL.md` keeps the path, the references keep the depth.

| Read | When |
| --- | --- |
| [`references/detached-jobs.md`](references/detached-jobs.md) | submitting or waiting on a `--detach` job |
| [`references/gates-and-proof.md`](references/gates-and-proof.md) | a cheap gate is red, reproducing a hosted red locally, plan mode |
| [`references/monitor-and-inbox.md`](references/monitor-and-inbox.md) | monitor exits, `--watch` rows, resume, settle rule, inbox rows and waves |
| [`references/review-threads.md`](references/review-threads.md) | thread states, review bodies, comment replay, `yeet reply` drafts |
| [`references/merge-loop.md`](references/merge-loop.md) | heavy admission label, job triage, branch-deletion contract |
| [`references/gh-rest.md`](references/gh-rest.md) | any GitHub call: `yeet gh` instead of `gh pr` |
| [`references/sweep-retire.md`](references/sweep-retire.md) | `sweep --retire` refusals and holders |
| [`references/run-artifacts.md`](references/run-artifacts.md) | verdict, packets, proof ledger, changeset gate |
| [`references/failure-handling.md`](references/failure-handling.md) | any failed publish, proof, or hosted job, reading a red job's log mid-run |
