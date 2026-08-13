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
git diff --name-status
```

2. If the checkout is on `main` or another protected/default branch, create a
   feature branch from the intended base before editing or publishing.
2b. Check base freshness before publish:

```bash
git fetch origin main:refs/remotes/origin/main --quiet
git rev-list --count "$(git merge-base HEAD origin/main)"..origin/main
```

   Yeet publish warns whenever the branch is behind `origin/main` and refuses
   when branch files overlap commits landed on the base since the merge-base
   (a conflicted or stale PR is likely). Catch up by merging the base into the
   feature branch — never by rebasing:

```bash
git fetch origin
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

- Repair local work:

```bash
bun run beep yeet repair
```

- Prove the branch without committing or pushing:

```bash
bun run beep yeet verify
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

- Keep monitoring across pushes until the PR merges or closes, instead of
  re-arming a fresh monitor after every fix wave:

```bash
bun run beep yeet monitor --until-merged
```

- Reset the clone after a merge (prune refs, fast-forward `main`, delete the
  merged branch locally and remotely, reinstall when `bun.lock` moved, end on
  `main`). Inspect the plan before running it:

```bash
bun run beep yeet sweep --plan
bun run beep yeet sweep
```

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
bun run beep yeet status --json
```

- Include live GitHub PR/check/mergeability data only when you need it:

```bash
bun run beep yeet status --remote
```

- Print compact operator summaries for hosted monitor or closeout flows:

```bash
bun run beep yeet monitor --summary
bun run beep yeet closeout --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0
```

- Inspect hosted review/bot closeout gates for the current branch PR:

```bash
bun run beep yeet closeout --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0
```

- Inspect local hardware profile guidance before choosing heavy parallel work:

```bash
bun run beep quality profile detect
bun run beep quality profile config workstation
```

Use plan mode before long or risky runs when you need to inspect the shape:

```bash
bun run beep yeet repair --plan --json
bun run beep yeet verify --plan --json
bun run beep yeet verify --tier review-fix --plan --json
bun run beep yeet publish --message "type(scope): summary" --plan --json
bun run beep yeet status --remote --plan --json
bun run beep yeet monitor --summary --plan --json
bun run beep yeet closeout --plan --json
bun run beep yeet sweep --plan --json
```

`yeet sweep --plan` is the sweep's own dry run, not the generic yeet plan: it
prints the branch-deletion and ref-update steps with the git facts behind each
one.

## Authoritative Gates (green local must mean green CI)

`bun run beep yeet verify` (full tier) is the authoritative local gate. Its
pre-push proof runs the *same global commands CI runs* — `bun run check` (global
tsgo with the effect language-service rules), full `bun run docgen` (which
compiles every JSDoc `@example`), `bun run test`, and the secrets/security/SAST/
Nix lanes. If `yeet verify` is green, CI should be green on the first push.

The full verify tier and every publish push path also run
`publish:00-head-install-preflight`: a frozen-lockfile install in a detached,
temporary worktree of committed `HEAD`. This catches lockfile/manifest state
that is self-consistent only in the dirty working tree. The temporary worktree
is always removed and pruned; a failure must be repaired by committing or
restaging the required manifest and `bun.lock` state before retrying.

The following cheaper commands are convenient inner-loop tools but are **NOT
authoritative** — do not conclude "it's green" from them:

- `bunx turbo run check --filter=<pkg>` (package-scoped) can pass while the
  global `bun run check` fails an effect-LSP rule (e.g. `strictEffectProvide`
  /TS377032). Only the global check matches CI.
- `bun run docgen:local ... --reuse-proof-manifest` skips recompiling `@example`
  blocks when a source hash is unchanged, so it can miss a broken example or an
  unresolved import subpath that full `bun run docgen` (and CI) catches.

When in doubt, prove with `yeet verify` before trusting "green", and always
prove with it before `publish`.

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
4. Run `bun run beep yeet publish --message "type(scope): summary"`.
5. If no pull request exists for the pushed branch, prefer publishing with
   `--pr` so Yeet creates a ready PR from the commit log and local proof
   summary; `gh pr create --draft --fill` remains the manual fallback.
6. Run `bun run beep yeet monitor --summary` for hosted checks when compact
   operator output is enough; omit `--summary` when you need the full stream.
7. Run `bun run beep yeet closeout --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0`
   to inspect unresolved actionable review threads and review-bot gates.
8. Use `bun run beep yeet verify --tier review-fix` while fixing PR comments,
   then use normal Yeet publish or the exact-match amend retry when appropriate.
9. Address failed checks or actionable review comments with follow-up commits
   through the same Yeet publish path.
10. Mark the PR ready only when checks are green, there are zero unresolved
    review threads (including outdated threads until explicitly resolved), and GitHub reports the branch as mergeable or not
    conflicted. `bun run beep yeet status --remote` prints a `merge-ready:` line
    that names the first failing criterion instead of making you read three
    surfaces.
11. After the merge lands, run `bun run beep yeet sweep` — or let
    `monitor --until-merged` run it on merged detection — so the next branch does
    not start from a stale clone.

`yeet closeout` is read-first. It classifies review threads and bot findings and
writes Yeet artifacts locally. It posts a Greptile rerun comment only when
`--retrigger-greptile` is explicit, and it does not auto-resolve or auto-reply to
review threads. The default bot lineup is **greptile-only** (2026-07-05,
agent-pipeline-velocity): the closeout artifact includes durable states for
review threads, Greptile, and hosted-check handoff. CodeRabbit/ChatGPT gates
appear only with explicit opt-in via `--bots greptile,coderabbit,chatgpt`
(their parsers are retained; the org apps are uninstalled/auto-review-off, so
expect "unknown" unless comments exist). Deep review is on-demand:
`/code-review ultra` or an explicit `@codex review` mention.

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

- `monitor --until-merged` re-reads status every poll, so a push landing
  mid-session is picked up as the new budget scope. A failed job whose log
  matches a known flake fingerprint (`ts2589-no-location`, CI timeout) gets
  exactly one `gh run rerun --job <databaseId>` per job per head SHA — never
  `--failed`, which would re-execute coexisting genuine reds. Anything else is
  reported as "needs code fix". The loop ends on MERGED (after the sweep),
  on CLOSED, or when you interrupt it.
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

1. Read the unresolved threads out of `bun run beep yeet status --remote` — each
   line carries the GraphQL thread id, the REST comment id, the file location,
   the author, and a first-line excerpt, so drafts are writable straight from
   that output without a second REST pass.
2. Write `.beep/yeet/reply-drafts.json` (`yeet-reply-drafts/v1`): `prNumber`
   plus one draft per thread with a non-empty `body` and either the GraphQL
   `threadId` (`PRRT_...`) or the numeric `commentId`; `resolve` defaults to
   true.
3. Run `bun run beep yeet reply`. Drafts are validated against the live threads
   first: an already-resolved or deleted thread is recorded `stale` and nothing
   is written for it. Each surviving draft is posted and resolved one at a time,
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
- The local pre-push proof includes `changeset status --since=origin/main`
  (parity with hosted Repo Sanity). For intentionally version-neutral changes,
  run `bunx changeset add --empty` and commit the empty changeset.

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
- Yeet serializes full local proof runs with `.beep/yeet/quality-lock`.
  `verify --tier review-fix` remains the cheaper loop lane while a full proof is
  already active. Locks whose recorded pid is no longer running are removed
  automatically on the next acquire; manual removal is only needed for
  unreadable lock files.
- Full pre-push proof streams a conservative collector for independent GitHub
  check lanes. A failed proof may report multiple sibling failures at once
  (for example check, lint, repo-export, tests, SAST, or Nix). Fix all reported
  actionable lanes before retrying instead of assuming the first item is the
  only blocker.
- Failure packets are written for proof/commit/publish/monitor step failures,
  publish-intent refusals (untracked/unstaged/partially staged paths), and
  stale-base refusals. Intent refusals print a summarized path list on stderr;
  the full list lives in the packet. Known sub-lane hints cover typos,
  terse-effect, docgen, changeset status,
  secrets, SAST, security, and Nix. Hint selection prefers output near the
  actual failure marker before falling back to broad log scanning. Prefer the
  suggested repair command in `yeet status`, the packet, or `verdict.json` over
  rerunning the whole loop blindly.
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
