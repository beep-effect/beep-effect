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

- Keep monitoring across pushes until the PR merges or closes, instead of
  re-arming a fresh monitor after every fix wave:

```bash
bun run beep yeet monitor --until-merged
```

- Stream one NDJSON row per PR state transition (typed `yeet-watch/v1` rows:
  check transitions, thread open/resolve, new PR comments, mergeability, head
  supersession) until the PR settles; exits non-zero on a red wave, a closed
  PR, or a poll error. Every observed red also appends a failure capsule —
  derived from the failing check's own record — to
  `<checkout>/.beep/inbox/failures.ndjson` (`yeet-inbox/v1`) and advances the
  wave record at `.beep/inbox/dispatch.json` (`yeet-dispatch/v1`): first red
  for a head opens the repair session, later reds queue with headSha+lane
  dedup, a new push supersedes the wave:

```bash
bun run beep yeet monitor --watch
```

- The agent babysitting loop: the same stream, but the process **exits** on
  the first actionable event batch — immediately when a check fails (the
  failure capsule is already durable when it exits, even while sibling checks
  still run), and ~20 seconds after the first new PR comment so a review bot's
  burst lands as one batch of `comment-posted` rows. Exit code 0 is a
  comment-only wake; non-zero means a red, a closed PR, or a poll error. The
  comment cursor is a durable branch-scoped watermark shared with plain
  `yeet monitor`, so relaunching after acting loses nothing: a comment posted
  while no monitor was attached is the next session's first row. Run it as a
  blocking command and treat its exit as the signal to act:

```bash
bun run beep yeet monitor --watch --until-event
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
bun run beep yeet verify --tier cheap-gates --plan --json
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
first step runs the cheap-gates tier. This tier runs 12 deterministic gates in
one collected wave, including config sync, tsgo rule parity, Effect imports,
schema-first, goals checks, Knip, Fallow, changeset status, and the JSDoc
ratchet against the committed inventory. It reports every failure before any
build, lint, check, test, or docgen lane starts. `yeet repair` applies its
deterministic fixers, runs the same collected tier, and stops before heavy
feedback if a cheap gate still fails.

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
6. Arm `bun run beep yeet monitor --watch --until-event` as a blocking command
   (generous timeout) as soon as the PR exists. When it exits, act on the rows
   it printed instead of waiting for anything more: `comment-posted` rows →
   draft replies and run the reply flow; a non-zero exit with a red →
   read the inbox capsule and `bun run beep yeet status --remote`, fix,
   publish. Then re-arm the watch. The watch's exit IS the comment/red signal
   — do not idle-poll the PR between exits. `bun run beep yeet monitor
   --summary` remains for one-shot compact reads.
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
  security, and Nix. Hint selection prefers output near the
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
