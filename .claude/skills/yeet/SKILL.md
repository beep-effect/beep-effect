---
name: yeet
description: Canonical repo-quality operator workflow for beep-effect. Use when repairing local changes, proving quality, committing, pushing, opening or monitoring a PR, or moving a branch toward mergeable GitHub state with `bun run beep yeet`.
---

# Yeet Quality Path

Use this skill when a user asks to repair, verify, publish, push, open a PR, or
make a branch mergeable in this repository. Yeet is the canonical operator path
for End-to-End Green: deterministic local repair, full local proof, reviewed
commit, push, PR checks, review closeout, and merge readiness.

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

### Detached durable jobs

Use `--detach` for a proof expected to outlive the current repair loop. It runs
as a transient systemd user service and reports completion or death through the
checkout inbox. An unavailable user manager is an error.

```bash
bun run beep yeet verify --tier cheap-gates --detach
bun run beep yeet publish --message "feat: describe change" --detach
bun run beep yeet monitor --until-ready --detach
bun run beep yeet job wait <jobId> --timeout "1 hour"
bun run beep yeet job status <jobId> --ack
bun run beep yeet job logs <jobId> --tail 100
bun run beep yeet job cancel <jobId>
```

`repair`, `closeout`, and `monitor` also accept `--detach`. Use
`--job-max-runtime "2 hours"` to set a systemd runtime ceiling; give one to a
detached `monitor --until-ready` that may be abandoned, because a red does not
end it. `--plan` and recursive detachment inside a job are rejected.
`job wait` returns:

| Exit | Outcome | Meaning |
| --- | --- | --- |
| 0 | `success` | The job settled green (a monitor ended `ready` or `merged`). |
| 1 | `failure` | The job settled red: a proof failed, or a monitor ended `closed`, `settle-timeout`, or `poll-error-budget`. |
| 2 | `wave` | A new wave landed on the monitor job's pull request: new P0 rows, new P1 `review-thread` or `pr-comment` rows, or a required red that came back red on a rerun of the same head. Optional reds never count. The job keeps running and the rows stay live (see Inbox). |
| 3 | `terminated` | The job ended without a verdict (for example `cancelled`, `oom-killed`, `signal`, or `timeout`); re-submit it. |

A `--timeout` expiry also exits 1 but leaves the job running. `job wait`
acknowledges the job's own informational inbox row when the job settles and
never acknowledges wave rows.
Use `yeet inbox ack <id> --observed` to acknowledge a job result manually.
The finalizer records abnormal deaths in the attempt journal; job records and
logs remain under `.beep/yeet/jobs/`, with the newest 50 terminal jobs retained.


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

- Commit reviewed staged changes, run the full local pre-push proof, then push:

```bash
bun run beep yeet publish --message "type(scope): summary"
```

- Publish exactly the staged index from a dirty worktree (unstaged/untracked
  residue is parked in a marked stash after the commit, the clean tree is
  proven, and the stash is restored after push; on a restore conflict the stash
  is kept and its marker reported):

```bash
bun run beep yeet publish --staged-only --message "type(scope): summary"
```

- Create the pull request in-flow after a green push (skips when an open PR
  already exists; composes with --staged-only, --monitor, and
  --start-pr-early):

```bash
bun run beep yeet publish --pr --monitor --message "type(scope): summary"
```

- Reply to and resolve addressed review threads during closeout (explicit
  per-thread flags; closeout never writes without them):

```bash
bun run beep yeet closeout --reply-thread <thread-id> --reply-body "Fixed in <sha>." --resolve-threads <thread-id>[,<thread-id>...]
```

- Create or reuse the PR, start hosted review/checks immediately, then keep
  proving locally:

```bash
bun run beep yeet publish --start-pr-early --monitor --pr --message "type(scope): summary"
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

- Resume the newest publishing agent recorded for a pull request:

```bash
bun run beep yeet resume 950
```

Pass `--list` to inspect every local agent, `--agent <n>` to select a newest-first
entry, `--print` to inspect the local harness command, and `--force` only when a
matching live Claude session should be forked deliberately. `--print` exposes
workstation-local paths and session identifiers in the terminal; never paste its
output into GitHub, a PR body, or another public surface. A workstation without a
matching registry row or Claude `pr-link` transcript exits 4 and prints the native
`claude --from-pr <n>` recovery hint.

- Keep monitoring across pushes until the PR merges or closes. This announces
  readiness once per head, writes the `pr-merge-ready` inbox row, and keeps
  polling after the announcement:

```bash
bun run beep yeet monitor --until-merged
```

- For stream consumers: emit one NDJSON row per PR state transition (typed `yeet-watch/v1` rows:
  check transitions, thread open/resolve, new PR comments, mergeability, head
  supersession) until the PR settles; exits non-zero on a required red, a closed
  PR, a settle timeout, or a poll error. Optional reds remain in transition rows
  and the `watch-ended.optionalFailing` count. Every observed red also appends a failure capsule —
  derived from the failing check's own record — to
  `<checkout>/.beep/inbox/failures.ndjson` (`yeet-inbox/v1`) and advances the
  wave record at `.beep/inbox/dispatch.json` (`yeet-dispatch/v1`): first red
  for a head opens the repair session, later reds queue with `headSha`+`lane`
  (check name) dedup, a new push supersedes the wave. `--until-ready` writes
  the same rows through the same convergence; see Inbox for the row kinds:

```bash
bun run beep yeet monitor --watch
```

- For stream consumers that need an event wake: the process **exits** on
  the first actionable event batch — immediately when a required check fails (the
  failure capsule is already durable when it exits, even while sibling checks
  still run), and ~20 seconds after the first new PR comment so a review bot's
  burst lands as one batch of `comment-posted` rows. Exit code 0 is a
  comment-only wake; non-zero means a required red, a closed PR, a settle
  timeout, or a poll error. Optional reds never trigger the event exit. The
  comment cursor is a durable branch-scoped watermark shared with plain
  `yeet monitor`, `status --remote`, and `closeout` (`--until-ready` and
  `--until-merged` keep their own; see Comment replay), so relaunching after
  acting loses nothing: a comment posted while no monitor was attached is the
  next session's first row. Run it as a
  blocking command and treat its exit as the signal to act:

```bash
bun run beep yeet monitor --watch --until-event
```

- Reset the clone after a merge (prune refs, fast-forward `main`, delete the
  merged branch locally and remotely, reinstall when `bun.lock` moved, end on
  `main`). Inspect the plan before running it:

```bash
bun run beep yeet sweep --plan
```

```bash
bun run beep yeet sweep
```

- From inside a linked worktree (a Claude Code `.claude/worktrees/<name>` lane
  or a sibling `-worktrees` lane) the sweep above only fetch-prunes, because
  `main` lives in the owning clone and the merged branch is checked out right
  here. `--retire` is the post-merge closeout for that case: it archive-retires
  this worktree (dirty files and unpushed commits preserved under the residue
  root), deletes the branch, then sweeps the owning clone. It refuses until the
  PR is MERGED and heads this branch, so running it early is safe:

```bash
bun run beep yeet sweep --retire --plan
```

```bash
CLONE="$(git rev-parse --path-format=absolute --git-common-dir)/.." && bun run beep yeet sweep --retire && cd "$CLONE"
```

  Run it from inside the lane: `bun run beep` resolves the CLI from the
  checkout it runs in, and the owning clone's `main` may still be behind the
  merge and reject `--retire` as an unknown flag. The command steps its own
  process out of the lane before removal; the trailing `cd` moves your shell
  to the swept clone. The fence exempts the invoking session's own ancestry
  and, when Claude Code names the session through `CLAUDE_PID`, everything
  that session spawned into the lane (MCP servers, tool shells, background
  jobs), so a desktop session retires its own lane. Any other holder (a
  desktop terminal panel, an editor, another session) still refuses it and
  is named in the error: close or `cd` it out, then rerun. Outside Claude
  Code, redirect the output to a file rather than piping it: the other stages
  of a shell pipeline stand in the lane and count as holders. `--lane <path>`
  retires a lane from elsewhere: the owning clone, or any sibling lane of
  the same clone (a later session's lane at a current checkout). When only
  the clone is at hand and its checkout predates `--retire`, run the lane's
  own CLI from the clone:

```bash
cd <clone> && bun run <lane>/packages/tooling/tool/cli/src/bin.ts -- yeet sweep --retire --lane <lane>
```

  `--json` prints one document; `--branch` is refused with `--retire`.

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
bun run beep yeet closeout --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0
```

- Inspect hosted review/bot closeout gates for the current branch PR:

```bash
bun run beep yeet closeout --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0
```

- Inspect local hardware profile guidance before choosing heavy parallel work:

```bash
bun run beep quality profile detect
```

```bash
bun run beep quality profile config workstation
```

Use plan mode before long or risky runs when you need to inspect the shape:

```bash
bun run beep yeet repair --plan --json
```

```bash
bun run beep yeet verify --plan --json
```

```bash
bun run beep yeet verify --tier cheap-gates --plan --json
```

```bash
bun run beep yeet verify --tier review-fix --plan --json
```

```bash
bun run beep yeet publish --message "type(scope): summary" --plan --json
```

```bash
bun run beep yeet status --remote --plan --json
```

```bash
bun run beep yeet monitor --summary --plan --json
```

```bash
bun run beep yeet closeout --plan --json
```

```bash
bun run beep yeet sweep --plan --json
```

`yeet sweep --plan` is the sweep's own dry run, not the generic yeet plan: it
prints the branch-deletion and ref-update steps with the git facts behind each
one.

## Authoritative Gates (green local must mean green CI)

`bun run beep yeet verify` (full tier) is the authoritative local gate. Its
first step runs the cheap-gates tier. This tier runs 12 deterministic gates in
one collected wave, including config sync, tsgo rule parity, Effect imports,
schema-first, goals checks, Knip, Fallow, changeset status, and the JSDoc
ratchet against the committed inventory. It reports every failure before any
build, lint, check, test, or docgen lane starts. `yeet repair` applies its
deterministic fixers, runs the same collected tier, and stops before heavy
feedback if a cheap gate still fails. The fixers end by regenerating the
git-ignored local projections (`goals/INDEX.md`, `explorations/ATLAS.md`, and
the generated README status regions). `goals:index-check` and
`explore:atlas-check` refresh a stale ignored copy left behind by a pull in
place (hosted lanes never carry those files, so that red was always
local-only); drift in the tracked README status regions still fails
`explore:atlas-check`.

The full proof then dispatches the *hosted lane bodies themselves* — `beep ci lane`
`check`, bare `lint`, `lint-policy`, bare `test-unit`, and `test-integration`,
each with the affected shape used to select work in `check.yml`. Hosted Lint
and Test Unit intersect that selected set with their deterministic package
partitions; the bare commands retain the complete local proof contract. The
full proof also runs the root build and bounded docgen (which compiles the
fenced code in every titled `**Example** (Title)` section), the repo-wide tsgo
test/smoke extras, and the secrets/security/SAST/Nix lanes. The command is
literally the one CI runs, so a green `yeet verify` should predict green CI on
the first push. What it does not
yet replay is CI's *environment* (`CI=true`, blank PR secrets, PR cache posture)
or the merged tree — use `verify --merged` for the tree.

The full verify tier and every publish push path also run
`publish:00-head-install-preflight`: a frozen-lockfile install in a detached,
temporary worktree of committed `HEAD`. This catches lockfile/manifest state
that is self-consistent only in the dirty working tree. The temporary worktree
is always removed and pruned; a failure must be repaired by committing or
restaging the required manifest and `bun.lock` state before retrying.

The following cheaper commands are convenient inner-loop tools but are **NOT
authoritative** — do not conclude "it's green" from them:

- `bunx turbo run check --filter=<pkg>` (package-scoped) can pass while the
  proof's `beep ci lane check` fails an effect-LSP rule (e.g.
  `strictEffectProvide`/TS377032). Only the lane matches CI.
- `bun run docgen:local ... --reuse-proof-manifest` skips recompiling
  `**Example**` blocks when a source hash is unchanged, so it can miss a broken
  example or an unresolved import subpath that full `bun run docgen` (and CI)
  catches.
- `bun run beep yeet verify --tier cheap-gates` proves only the first tier. It
  never replaces the full proof.

When in doubt, prove with `yeet verify` before trusting "green", and always
prove with it before `publish`.

## CI / security fixes: validate against the CI token's permissions

A change that alters CI or security-gate behavior (for example making a `gh api`
call fail-closed, or tightening a workflow permission) must be validated against
the **actual CI token's permissions**, not just locally. A gate that reads, say,
`security_and_analysis` will block every PR if the CI token cannot read it.
Confirm the token scope (or fail *open* on a genuine permission error, distinct
from a real security failure) before shipping such a fix.

## Settle rule

The monitor loops read the base branch ruleset once per head. They wait for every
expected required context to report a terminal result. If an exact parent name
is absent but `<context> (<variant>)` children report, the parent is tolerated
and those children must finish. A missing parent with no children keeps waiting.
If the ruleset read fails, one warning precedes fallback to the `--required`
view. Optional reds never affect an exit code in any mode; under
`--until-ready` an optional red is still a P1 `check-failed` inbox row, but it
never hands back a wave. `--settle-timeout` defaults to
30 minutes; it applies to `--until-ready`, `--until-merged`, and `--watch`, and
it bounds registration only: the budget counts while no check has registered
or an expected context is still missing, never while a registered required
check is queued or running (that wait is GitHub's job timeout, not ours).
Gate lines name `registration`, `required-pending`, `heavy-not-admitted`,
`base-conflict`, `closeout-pending`, or `settle-timeout`, including missing and
pending contexts. `base-conflict` means the base moved under the head (GitHub
reports `CONFLICTING`/`DIRTY` and empties the check rollup): merge `origin/main`
and push; the wait never spends the budget. Under `--until-ready` it is also a
P0 `base-conflict` inbox row, and neither it nor a required red ends the loop
(see Inbox). A context once seen registered for
a head stays `pending` when one poll omits it, never `missing`. `heavy-not-admitted` is tier-2 admission (B8): the loop computes the
heavy verdict every poll from the same function CI runs (`ready-for-heavy`
label, docs-only diff) and, while the verdict is `hold` with `Heavy / *`
contexts still open, moves them from `missing`/`pending` into a `gated` census
bucket and prints
`settle: heavy-not-admitted; gated: …; admit: gh pr edit --add-label ready-for-heavy; waited …`.
Held time never counts toward `--settle-timeout`; the settle clock resets when
the verdict changes, and the label admits within one poll. `skip-satisfied`
(docs-only) settles once every lane reports a terminal outcome: `pass` when it
passed without work on a hosted runner, `skip` where a lane is still skipped.
A settled head does not time out while waiting for review closeout. The final
readiness gate line includes the head timeline and push→ready wall clock when
the push date is known. A `push→row→ack <sha7>: pushed …, red …, row …,
injected …, acked …` line follows it (`-` for a stage not reached; `injected`
is the first hook hand-off to any session), and the loop prints the same line
when it leaves a head that never reached ready.

## Inbox

The checkout inbox, `<checkout>/.beep/inbox/`, is how Yeet hands pull request
events to the session that owns them. The inbox hook
(`.claude/hooks/yeet-inbox.sh`) injects unacknowledged P0 and P1 rows into
that session at the next prompt or tool call, and P0 rows also hold Stop until
they are acknowledged or superseded. The hook stamps each row's first hand-off
to a session (`firstSeenAt` in its session file), which is the `injected`
stage of the push→row→ack line. `bun run beep yeet inbox list --unacked`
prints what is open, with each row's liveness.

Vocabulary:

- **checkout**: the repository root the inbox lives under. Rows, capsules,
  and prose about them say checkout, never lane; inside a `check-failed`
  capsule, `lane` is the failing check's name.
- **inbox row**: one `yeet-inbox/v1` line in `failures.ndjson` with a kind, a
  deterministic id, a severity (P0, P1, P2), and a capsule. It stays open
  until an ack receipt under `acks/` resolves it or a push supersedes it.
- **capsule**: a row's payload, the observed facts behind it: the pull request
  number, the head SHA, and the kind's own fields (a red check's bucket,
  state, link, and workflow; a `pr-comment` row's comment URL, author, and
  excerpt).
- **wave**: the new rows on one pull request that are in the wake set (every
  P0 row, plus P1 `review-thread` and `pr-comment` rows) and neither
  acknowledged nor superseded; `yeet job wait` returns them together with
  exit 2. A required red that comes back red on a rerun of the same head
  keeps its row id, so it is a new wave by its changed red set instead. The
  wave record, `dispatch.json` (`yeet-dispatch/v1`), pins the head those rows
  belong to and carries that head's required red set; a push re-pins it and
  supersedes the previous head's rows.
- **generation**: a `base-conflict` capsule's count of the earlier conflicts
  on its head that the monitor acked `cleared`. The row id is keyed on (pull
  request, head, generation), so a conflict that returns on the same head
  after a `cleared` ack is generation + 1: a new row and a new wave. A push
  starts the new head at generation 0. A receipt that no longer decodes also
  advances it; a row acked any other way keeps that head's conflict closed
  until a push, and the monitor says so once on stderr.
- **owner session**: the harness session that submitted the monitor and waits
  on it. A detached job forwards `CLAUDE_CODE_SESSION_ID` and
  `CODEX_THREAD_ID`, so the pull request's session registry row names that
  session's harness and id for `bun run beep yeet resume <pr>`. The woken
  owner dispatches any fix itself; Yeet launches nothing.

`--until-ready`, attached or detached, converges the status snapshot into rows
on every poll; `--watch` does the same for checks, threads, and drift.
`--until-merged` writes no wave rows.

| Kind | Severity | Written when | Closes on |
| --- | --- | --- | --- |
| `check-failed` | P0 required, P1 optional | a check is red on the head | the next push, or an ack |
| `base-conflict` | P0 | GitHub reports the head `CONFLICTING`/`DIRTY` (`--until-ready` only) | the next push, or the `cleared` ack the monitor writes when the same head reads mergeable again; a `CONFLICTING` read after `cleared` on the same head writes generation + 1 as a new row and wave |
| `review-thread` | P1 | a thread is unresolved or owes a follow-up | an ack only; survives pushes |
| `pr-comment` | P1 | a person's top-level comment lands after the window start (`--until-ready` only; see Comment replay) | an ack only; survives pushes |
| `base-drift` | P2 | the head is `BEHIND` its base | the next push |

`review-thread` and `pr-comment` rows are wave-exempt: a push never supersedes
them, because the thread or comment still needs its answer on the next head.
One open row is kept per thread. Acknowledge them once answered, for example
with `bun run beep yeet inbox ack <id> --thread-url <url>`. Observation rows
(`proof-job-finished`, `pr-merge-ready`) are injected too but never join a
wave.

- `job wait` returns only for rows on its own job's pull request, so two
  monitors in one checkout on different pull requests never wake each
  other's waiter. It never acknowledges the rows: the hook keeps injecting
  them and a P0 keeps holding Stop until the fix lands.
- A re-run of `job wait` on the same job skips the rows it already returned
  and waits for new rows or for the job to settle. A red that stays the same
  on the same head is not returned twice: push the fix. A rerun that comes
  back red (a new job link on the same head, a spent flake rerun or a manual
  `gh run rerun`) is a new wave, and the same row is returned again.
- Optional reds never wake a waiter. An optional red, a rate-limited Vercel
  deployment included, is a P1 `check-failed` row the hook injects, but it
  never makes a wave for `job wait` or an attached `--until-ready`.
- Rows already open count. The first `job wait` on a new job returns at once
  on any open, not superseded wake-set row on the pull request, including one
  an earlier monitor wrote.
- A P0 row reads `unknown` while `dispatch.json` is missing or unreadable, and
  it then holds Stop until an attributed ack.
- `cleared` has no operator form: only the monitor writes it, and only for a
  `base-conflict` row whose head it re-read as mergeable.

Rollout: `review-thread` rows that an earlier wave superseded read live again
under the wave-exempt rule. Clear the answered ones once: list them with
`bun run beep yeet inbox list --unacked` and acknowledge each with
`bun run beep yeet inbox ack <id> --thread-url <url>`.

## Mergeable PR Workflow

1. Run `bun run beep yeet repair` when local changes need deterministic fixers,
   docgen, or affected feedback.
2. Stage the reviewed files explicitly.
3. Run `bun run beep yeet status` when you need a compact local readiness
   snapshot before publishing.
4. Run `bun run beep yeet publish --message "type(scope): summary"`.
5. If no pull request exists for the pushed branch, prefer publishing with
   `--pr` so Yeet creates a ready PR from the commit log and local proof
   summary; `gh pr create --draft --fill` remains the manual fallback.
6. As soon as the PR exists, submit the babysit loop as a detached job from
   the checkout you are working in, and block on it from a background tool
   call: `bun run beep yeet monitor --until-ready --detach`, then
   `bun run beep yeet job wait <jobId>`. The job survives session restarts and
   the ten-minute tool-call cap, but not a reboot: re-submit it after one.
   A required red or a base conflict does not end the monitor: it writes inbox
   rows and keeps polling across your fix pushes, so do not re-submit it after
   a red. `job wait` returns 0 for green (the loop ended `ready`), 2 for a wave
   (new P0 rows or P1 thread and comment rows on this PR, or a required red
   that came back red on a rerun: read the gate line, act on the rows, publish
   any fix, then re-run `bun run beep yeet job wait <jobId>` on the same job),
   1 for red (`settle-timeout`, `closed`, or a spent poll-error budget), and 3
   for a terminated job. When the user manager is unreachable, run
   `bun run beep yeet monitor --until-ready` attached instead: it has no job,
   so it ends itself with exit 2 on a wave (rows already in the inbox when it
   started end it only when a rerun of their check comes back red); re-run it
   after the fix push. Exit 0 with
   `merge-ready: yes` means hand the PR to the operator; it does not merge it.
   On exit 1 or 3, read the summary line, fix the named blocker, publish, and
   re-submit the monitor. A code PR holds at `heavy-not-admitted` until you
   apply the `ready-for-heavy` label (see Merge Loop); do that once tier 1 is
   green, not at publish. Act on unresolved review threads through the reply
   flow while the loop waits. The loop runs read-first closeout automatically
   after the required checks settle. `monitor --summary` remains a one-shot
   compact read.
7. Run `bun run beep yeet closeout --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0`
   to inspect unresolved actionable review threads and review-bot gates.
8. Use `bun run beep yeet verify --tier review-fix` while fixing PR comments,
   then use normal Yeet publish or the exact-match amend retry when appropriate.
9. Address failed checks or actionable review comments with follow-up commits
   through the same Yeet publish path.
10. Mark the PR ready only when checks are green, no review thread is
    outstanding — unresolved, or resolved by the author with a later human
    reviewer comment nobody answered, outdated threads included until they are
    explicitly resolved — and GitHub reports the branch as mergeable or not
    conflicted. `bun run beep yeet status --remote` prints a `merge-ready:` line
    that names the first failing criterion instead of making you read three
    surfaces.
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

### Review thread states

Closeout, `yeet status --remote`, `yeet monitor` and `yeet reply` read every
thread's newest comment — selected as `comments(last: 1)`, so a thread longer
than one comment page is classified from what was actually said last, not from
whoever ended the first hundred — and classify each
thread into one of four states by structure alone — who resolved it, who spoke
last, and whether that speaker was a bot. No rule reads comment prose.

- `unresolved` — gates. The thread was never resolved.
- `resolved-answered` — nothing owed. A reviewer resolved their own thread, or
  the author resolved it and the author spoke last, or the PR author or the
  resolver is unknown (unknown is never a named blocker).
- `resolved-follow-up` — **gates**. The author resolved the thread and a human
  reviewer commented afterwards without an answer. `bun run beep yeet reply`
  answers these: it posts the reply and leaves the thread resolved, because the
  thread is already closed and re-resolving it would be a second write.
- `resolved-acknowledged` — advisory. The last word after the author resolved
  the thread came from a review bot confirming the fix. It is printed and
  counted, never gating, and nothing is owed.

`yeet status --remote` prints `review follow-ups: N …` (gating) and
`review acknowledgements: N …` (advisory). Closeout carries the matching gate
rows: `review-follow-ups` is blocked while the count is non-zero and emits one
`pr-review` quality issue per thread, so `yeet closeout` exits non-zero;
`review-advisories` always passes and only reports a number. `merge-ready`'s
`threads-resolved` criterion is unresolved **plus** follow-ups, and the
`next command` it prints is `bun run beep yeet reply` only when live threads are
the *only* thing holding the PR — every other merge-ready criterion holding. A
red pipeline or a stale closeout keeps the command on that instead, because
answering reviewers would not make the branch mergeable.

### Review bodies and advisories

A review body — CodeRabbit's summary, a Greptile-format review — is read for its
structural markers only: CodeRabbit's `Actionable comments posted: N`, its
nitpick and outside-diff `<summary>` counts and its fix-prompt file/line items;
Greptile's confidence score and its new findings. A Greptile-format body is
recognised by a *named marker* — an author login containing `greptile`, a
heading or bolded line naming Greptile, or the tokens `Greptile-format` /
`Greptile-style` — or, failing that, by its *structure*: a confidence fraction
together with a `P0:n P1:n P2:n` triplet or a `**NEW:**` marker, because the
operator writes that format by hand and does not always name the tool. The word
in running prose never counts; the marker rules are line-anchored so an aside
like "greptile scored this 5/5" stays a plain body. Its new findings are the
*maximum* per severity of the triplet and the `N×Pk` items listed after
`**NEW:**` — never their sum, because the two notations are two readings of one
round. A body
finding that already opened an inline thread at the same path and line is not
counted twice, and closeout reads only the newest body per author, so an older
round is superseded rather than summed. Every one of these counts is advisory:
they are printed with `(advisory)` and they never gate a merge.

### Comment replay

Every read-first surface replays the PR's comment stream before it reports:
`yeet status --remote` (once it has a PR number), `yeet closeout`, and the first
cycle of `yeet monitor --until-merged`. Replay prints each review comment, issue
comment and review body newer than the saved position, then advances that
position — so a reboot, a killed monitor or a session change no longer loses
comments that arrived while nothing was watching. It prints
`comment replay: N comment(s) since <watermark>`, or
`comment replay: no watermark for #N; starting at <now>` on the first open,
which spawns nothing and only records the position. Writing that cursor is the
one write a read-first closeout makes; a failed read prints
`comment replay unavailable: …` and leaves the position untouched rather than
failing the closeout.

Each consumer mode keeps its own position in `.beep/yeet/runs/<branch>/`:
`--until-ready` in `monitor-comments.until-ready.json`, `--until-merged` in
`monitor-comments.until-merged.json`, and every other reader (plain
`yeet monitor`, `--watch`, `status --remote`, `closeout`) in the shared
`monitor-comments.json`. A mode's first position starts at the later of its
window start and the shared position, so its first run replays no history.

`--until-ready` never prints the backlog. Each poll turns top-level comments
(issue comments and review bodies) into P1 `pr-comment` rows when a person
wrote them — not a bot, not the login the monitor runs as, not a deleted
account — after the window start: the job's submit time for a detached run,
the loop's start for an attached one. Older comments only advance the
position; a comment posted between an earlier monitor's exit and this submit
is the accepted miss. Inline review comments reach the inbox as
`review-thread` rows instead.

## Fast Plus Monitor

`bun run beep yeet publish --fast --monitor --message "..."` is opt-in only. Use
it only on an existing PR branch when the user explicitly accepts replacing the
local full pre-push wait with hosted PR-check monitoring. It must remain paired
with `--monitor`; Yeet rejects `--fast` without it.

`bun run audit:github pre-push` remains the named full local fallback for
secrets, security, SAST, Nix, and any lane that must be proven outside Yeet.

## Start PR Early

`bun run beep yeet publish --start-pr-early --monitor --pr --message "..."` is
the explicit fail-faster path. It requires `--pr` so a PR-less branch creates
the PR immediately after its clean-HEAD preflight and early push; an existing PR
is reused. Omitting `--pr` fails at guard time before commit or push. The flow
then runs the full local pre-push proof and hosted PR monitor. Unlike `--fast`,
it does not skip the local full proof; it only overlaps that proof with hosted
CI and reviewer startup time.

Use it when the user wants remote checks and reviewers moving in parallel with a
local proof cycle. If the post-push local proof fails or writes files, fix the
issue in a follow-up commit and publish again. Treat commit/pre-push hooks as
local tripwires and proof-reuse adapters; Yeet full proof plus hosted checks are
the authoritative gates.

## Merge Loop

`yeet monitor --until-merged`, `yeet sweep`, `yeet reply`, and `yeet merge` are
the merge-loop porcelain. They read the clone and the PR; none of them plan
turbo work, so they are cheap to run mid-loop.

- **Heavy admission is a deliberate verb.** Publish without the label and let
  tier 1 (lint shards, unit shards, cheap gates) go green first; `Heavy
  Admission` in `check.yml` then holds a code PR (`Heavy / *` stays
  "Expected", merge blocked) until `gh pr edit <n> --add-label ready-for-heavy`.
  Apply it yourself, then run `bun run beep yeet monitor --until-ready` — the
  held loop prints that exact command and does not burn its settle budget.
  The label triggers `heavy-admit.yml`, which runs only the admission job and
  the heavy matrix for that head; tier 1 is neither cancelled nor re-run.
  Docs-only PRs (`docs/**`, `explorations/**`, `research/**`, `.changeset/*.md`,
  any `*.md`, packet prose) need no label: every heavy lane passes without work on
  a hosted runner and satisfies the ruleset. Removing the label changes nothing already reported;
  cancel a heavy run from the Actions UI if it must stop.
- `monitor --until-merged` re-reads status every poll, so a push landing
  mid-session is picked up as the new budget scope. Job triage is job-level
  and mid-run: a completed red job is classified on the poll after it
  concludes, without waiting for the parent workflow run to finish. A failed
  job whose log matches a known flake fingerprint (`ts2589-no-location`, CI
  timeout) gets exactly one `gh run rerun --job <databaseId>` per job per head
  SHA — never `--failed`, which would re-execute coexisting genuine reds; a
  known flake inside an active parent run is deferred without spending its
  allowance. Once the run completes, the loop attempts the rerun once. A
  rejected rerun keeps that allowance spent so authentication, permission, or
  stale-job failures cannot become an unbounded polling loop. A red whose log
  has not materialized yet reports "awaiting log" and is reclassified next
  poll. Anything else is reported as "needs code fix". The loop ends on MERGED
  (after the sweep), on CLOSED, or when you interrupt it.
- **Branch-deletion contract.** `sweep` deletes with `-d` when the branch is an
  ancestor of `origin/main`. It uses `-D` only when the PR is MERGED **and** the
  local tip still equals the PR's recorded head SHA **and** no worktree holds the
  branch; remote deletion needs the same tip match. Any unmet precondition is a
  skip-and-report, not a failure — unmerged local work is never force-deleted.
- A sweep exits 0 whether every step ran or every step skipped: "merged, cleanup
  skipped: `<reason>`" is a success. Authentication or repository-policy
  failures are reported with the exact skipped cleanup step; checked-in Claude
  and Codex settings no longer block preconditioned local or remote deletion.
- `merge` never passes `--delete-branch`: it merges, confirms `MERGED` by bounded
  poll, then hands the whole cleanup sequence to the worktree-aware sweep. The
  sweep may auto-run on monitor's merged detection; the merge never auto-runs.

### Reply drafts flow

1. Read the outstanding threads out of `bun run beep yeet status --remote` —
   both the `unresolved` list and the `review follow-ups` list. Each line carries
   the GraphQL thread id, the REST comment id, the file location, the author, and
   a first-line excerpt, so drafts are writable straight from that output without
   a second REST pass. A follow-up line excerpts the reviewer's follow-up, not
   the thread's opening comment, because that is what is unanswered.
2. Write `.beep/yeet/reply-drafts.json` (`yeet-reply-drafts/v1`): `prNumber`
   plus one draft per thread with a non-empty `body` and either the GraphQL
   `threadId` (`PRRT_...`) or the numeric `commentId`; `resolve` defaults to
   true.
3. Run `bun run beep yeet reply`. Drafts are validated against the live threads
   first, and each one is routed by the thread's state: an `unresolved` thread is
   posted and resolved; a `resolved-follow-up` thread is posted with resolve
   forced false, whatever the draft's `resolve` flag says, so the already-closed
   thread is not re-resolved; a `resolved-answered`, `resolved-acknowledged` or
   deleted thread is recorded `stale` and nothing is written for it. Each surviving draft is posted and resolved one at a time,
   and a denied scope or rate limit becomes that draft's `failed` outcome with a
   retry command rather than aborting the pass.
4. Read `.beep/yeet/reply-report.json` (`yeet-reply-report/v1`) for the per-draft
   outcomes. Either party can run the command; when the agent session lacks the
   write scope, hand the operator the one command instead of pasted bodies.

## Run Artifacts

- Every non-plan Yeet run writes `.beep/yeet/runs/<branch>/verdict.json`
  (`yeet-verdict/v1`): outcome, per-lane status, repair command for each
  failed lane, packet paths, staged-only stash identity, and base-freshness
  data. Read `yeet status` or the verdict before scanning logs. `yeet status`
  is observational and writes `.beep/yeet/runs/<branch>/status.json` instead of
  replacing the latest verdict.
- Failure packets land under `.beep/yeet/packets/` with the quality-issue
  index at `.beep/yeet/quality-issue-index.json`.
- The local pre-push proof includes `beep quality changeset-status --since
  origin/main` (parity with hosted Repo Sanity). It enforces in-process: every
  changed, versioned, non-ignored product workspace must be named by a
  changeset **added in-branch** (the base backlog never counts, and empty
  changesets satisfy nothing). Write real `"@pkg": patch` frontmatter for each
  changed package; lab-only change sets are ceremony-exempt.

## Failure Handling

- If Yeet fails after creating a local commit but before pushing, fix the issue.
  When you prove the exact current worktree with `bun run beep yeet verify`, you
  may retry with `bun run beep yeet publish --amend --no-edit --reuse-verified`.
  Yeet reuses only exact matching full-proof state; if the state is stale, rerun
  full proof or publish normally.
- If the current clean commit was already verified and only the push was blocked
  or skipped, prefer `bun run beep yeet publish --push-only --reuse-verified`.
  Yeet still requires exact reusable proof state and a clean worktree, and it
  pushes with `git push -u origin HEAD` so upstream branch naming cannot block
  agent-created feature branches.
- There is no pre-push git hook; `yeet publish` runs the full local pre-push
  proof itself before pushing, so the proof is the gate. (The former pre-push
  catalog hook was removed with the repo-exports catalog.)
- `--start-pr-early` requires both `--monitor` and `--pr`. It runs the clean-HEAD
  install preflight before the early push, creates or reuses the PR immediately
  afterward, and still runs full local proof after pushing.
- If Yeet refuses untracked, unstaged, or newly generated paths, inspect the
  paths and decide whether they belong in the reviewed publish intent.
- Full proofs use machine-wide weighted admission as the sole current-version
  concurrency authority (ship-velocity D1). New tickets and leases identify
  `scheduler-origin-concurrency/v1`; state written before this migration
  decodes as `legacy-origin-lock/v1`, and same-origin legacy state drains first.
  The first current contender then atomically installs a persistent
  `yeet-proof-lock/v4`
  retirement marker at the former per-origin lock path. Previous v3 clients
  cannot decode that marker and therefore fail closed instead of racing a
  current proof. Current clients recognize the marker and may overlap when
  machine capacity permits. Hosts below the scheduler memory envelope retain
  single-proof execution through one machine-wide `scheduler-fallback.lock`.
- The `yeet-proof-lock/v4` marker is a permanent compatibility fence, not stale
  owner state. Never reap or delete it during routine repair. Its legacy
  decoders and v3 acquisition test seams remain until a future CLI generation
  floor makes pre-v4 proof binaries non-runnable and a seven-day fleet audit
  observes no legacy ticket or lease; the exact removal gate is recorded in
  `goals/ship-velocity/research/d1-admission-scheduler.md`.
- Origin paths still hash a canonical host/repository identity into an opaque
  path under the machine temporary directory, so equivalent SCP, SSH, HTTPS,
  and Git origin URLs share one coordinator even when `.git`, trailing
  slashes, user info, or default ports differ; unparseable origins use their
  trimmed raw text, and the path never contains the remote URL. A stale v3
  owner is replaced by the v4 marker through the existing observation-bound
  compare-and-swap reaper. Legacy v2 and unreadable state remain fail-closed.
- A contender enqueues a durable ticket under
  `$XDG_RUNTIME_DIR/beep/admit/` and waits
  with a visible progress line (position, tokens active/capacity, holders,
  MemAvailable watermark). One token is ~5 GiB; capacity is
  `min(10, floor((MemAvailable − 10) / 5))` with a hard admission floor at
  15 GiB free. Weights: full proof 3, merged preview 5, review-fix 1 (at most
  3 concurrent). Publish proofs queue with priority; a waiting verify ages up
  to equal priority after 2 minutes, and running work is never preempted.
  Leases record pid plus `/proc` start time and heartbeat every 5 seconds;
  dead or pid-reused state is reaped automatically, and malformed state is
  quarantined visibly. Inspect with `bun run beep quality scheduler status`
  and repair with `bun run beep quality scheduler reap [--apply]` (dry-run by
  default). `Ctrl-C` while queued removes the ticket. Admission transitions
  are journaled best-effort to `$XDG_RUNTIME_DIR/beep/admit/journal.ndjson`
  (ring-buffered NDJSON; admitted and released events keyed by ticket nonce
  and pid), so granted queue-wait survives lease release.
  `verify --tier review-fix` remains the cheaper loop lane while a full proof
  is active (one token, never the origin lock); `--tier cheap-gates` takes
  neither admission nor the lock.
- The cheap tier always collects every lane failure. The later full proof uses
  its versioned economics seed to run short gates before expensive gates. Under
  the default fail-fast policy, a precise red stops launching subsequent lanes;
  imprecise reds remain diagnostic and do not stop the plan. Unlaunched lanes
  are recorded as `not-run-early-stop`, and already-running work is never
  cancelled. `--no-fail-fast` (or the compatibility spelling `--collect-all`)
  requests the complete diagnostic picture. Fix every reported lane before
  retrying.
- Failure packets are written for proof/commit/publish/monitor step failures,
  publish-intent refusals (untracked/unstaged/partially staged paths), and
  stale-base refusals. Intent refusals print a summarized path list on stderr;
  the full list lives in the packet. Known sub-lane hints cover typos,
  terse-effect, every cheap gate, docgen, changeset status, secrets, SAST,
  security, and Nix. Hint selection follows the lane-run record: a tier lane's
  `repairCommand` in `verdict.json` is its first red inner lane's repair
  command, and each red inner lane carries its own (the catalog hint for its
  exact lane id, else a known marker inside that lane's own output segment,
  else the lane's recorded launch command). The failure packet
  (`quality-issue-index.json`, the per-package packet, the inbox capsule)
  follows the same record: a wrapper step's raw issue takes its sub-category,
  category, message, and remediation from its first red inner lane. A red
  inner lane that yields no repair command (no catalog hint, no marker in its
  own segment, no recorded launch command) gives the tier lane the wrapper's
  own command instead. Broad log scanning of the whole wrapper output is only
  the fallback when the record names no red inner lane, which includes
  wrappers that emitted no record at all. Prefer the suggested repair command
  in `yeet status`, the packet, or `verdict.json` over rerunning the whole
  loop blindly.
- Root composite lanes prefer streaming accumulation where child commands are
  independent. For example, root `lint` streams the Turbo/Biome aggregate and
  then still runs repo-law policy lints, so one lint-family failure does not
  hide sibling lint findings.
- The root docgen lint check uses package-local docgen proof manifests. A
  package with a current `.beep/docgen/proof.json` can skip duplicate docgen
  metadata analysis; missing or stale manifests fall back to the normal check.
- Terse-effect output separates `blocking`, `rewritable`, and `informational`
  files. Use `--write` only for the rewritable helper subset; manual candidates
  still need direct edits.
- If there is no open PR for `yeet monitor`, create the draft PR first or run
  `bun run audit:github pre-push` as the full local fallback.
- If `yeet closeout` reports Greptile score/issues as unknown, inspect the PR
  comments and rerun Greptile explicitly with `--retrigger-greptile` only when
  the user wants that GitHub write.
- Do not weaken GitHub check names, hosted PR checks, or manual fallback lanes
  to make a branch appear green faster.
