# Merge Queue Lab Spec

## Objective

A GitHub merge queue runs on a lab branch of this repository behind a toy
required check, and every behaviour the merge-queue design depends on and
GitHub's documentation leaves open has a recorded finding with a run or an API
response as evidence. The GitHub driver gains typed enqueue, dequeue and
queue-entry calls. The goal ends with a go, park or kill verdict for
[`explorations/github-merge-queue`](../../explorations/github-merge-queue/README.md).

Shaped in that packet's [`BRIEF.md`](../../explorations/github-merge-queue/BRIEF.md);
this goal is the first candidate in its
[`MAP.md`](../../explorations/github-merge-queue/MAP.md).

## Non-Goals

- A `merge_queue` rule on `main`, or any change to ruleset 10240248.
- Any edit to a workflow on `main`: `check.yml`, `heavy.yml`, `heavy-admit.yml`
  or the rest. The toy workflow lives only on the lab branch.
- Merge-group arms for the 15 required contexts. That is the gated candidate
  `merge-group-parity`.
- Any change to Yeet's merge path, S11, the review window, the
  three-pull-request cap or the merge doctrine. That is `yeet-queue-states`
  and `merge-queue-activation`.
- Slimming pull-request head proof, a strict-status-check flip, a global
  `concurrency` group as a stand-in for a queue.
- A third-party queue product, or any purchase.
- Stacked-pull-request routing through the queue.

## Source Hierarchy

1. The operator rulings of 2026-11-09 in
   [`explorations/github-merge-queue/DECISIONS.md`](../../explorations/github-merge-queue/DECISIONS.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards, including
   `standards/architecture/DECISIONS.md`, "2026-11-09: Merge Queue Activation
   Is Gated On The Merge-Group Run".
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- A long-lived lab branch `queue-lab`, cut from `main`.
- `.github/workflows/queue-lab.yml` on `queue-lab` only: a toy required check
  that reports on `pull_request` and `merge_group` and can be told to pass,
  fail, skip, cancel or hang.
- A second repository ruleset that targets `refs/heads/queue-lab` exactly,
  with the toy context required and a `merge_queue` rule.
- `packages/drivers/github/src/PullRequest.ts` and its tests (`@beep/github`):
  `enqueuePullRequest`, `dequeuePullRequest`, and a queue-entry read, beside
  the existing `enablePullRequestAutoMerge`.
- `goals/merge-queue-lab/ops/`: the lab driver script, registered in the
  manifest's `opsScripts`.
- `goals/merge-queue-lab/research/findings.md` and
  `research/evidence/`: the findings ledger and the saved responses.
- `explorations/github-merge-queue/`: the verdict fed back at closeout.

## Constraints

- **Nothing on `main` changes behaviour.** Pull requests against `queue-lab`
  do not trigger `check.yml` (it targets `main`) and never reach
  `beep-ec2-heavy`. `bun run beep ci ruleset --check` passes on every push.
- **The lab ruleset names one branch.** GitHub refuses a queue on a wildcard
  pattern. If it also refuses a second queue ruleset on a non-default branch,
  record the refusal as finding 10b and move the lab to a public scratch
  repository in the organization; if installing the App there needs an owner
  action, report that as the blocker.
- **Observe with the identities the fleet merges with.** The orchestrator App
  token and the fleet's fine-grained token, resolved the way
  `provideYeetGhLogin` resolves them. Never print a token.
- **A secret is observed by presence, never by value.**
- **API budget.** Poll no faster than every 30 seconds and prefer one GraphQL
  document per read; obey the reserve signal if `github-budget-ledger` has
  landed.
- **Driver code follows the Effect laws.** Schema first: the queue-entry state
  is a `LiteralKit` domain and the entry is a schema; effects use `Effect.fn`;
  tests import through `@beep/github`. `bun run beep quality package-verify
  @beep/github` before handing back.
- **Synthetic pull requests are residue.** Branch names start with
  `queue-lab/`; every one is closed and its branch deleted at closeout. They
  target `queue-lab`, so they are not this packet's goal pull requests and do
  not count against the three-open cap.
- **The lab may set any queue parameter on its own ruleset**, including
  `HEADGREEN` and groups larger than one, to observe them. The design's
  settings for `main` are fixed in the exploration's `queue-parameters`
  decision.
- **Public repository.** Findings carry no tokens, home paths or session ids.

## Observations

Identifiers match
[`research/github-semantics.md`](../../explorations/github-merge-queue/research/github-semantics.md)
in the exploration. Each gets a row in `research/findings.md`: what was done,
what happened, the evidence, what it means for the design.

| Id | Question |
| --- | --- |
| 10b | Is a second ruleset carrying a queue on a non-default branch accepted? |
| 10c | Can the App token and the fine-grained token enqueue? Jump? Enqueue a pull request that touches `.github/workflows/`? Does an enqueue made with `GITHUB_TOKEN` trigger a group run? |
| 9a | What do `gh pr merge`, `--auto` and `--admin` do on a queue branch? |
| 9c, 9d | Which queue-entry fields and states are readable, is there any REST listing, and which `dequeued` reason strings occur? |
| 7c, 7e, 7g | The `merge_group` payload fields, the full temporary-branch pattern, and how a job finds the pull requests in its group. |
| 7f | Which secrets are present on a group run and what the token may do. |
| 8c | Does a reusable workflow need its own trigger or only its caller's, and what are the check names? |
| 8d | What does a workflow `concurrency` group shared across entries do? |
| 6c, 6d | Which squash message does the queue write, and is there one commit per pull request? |
| 6e, 6f | Is the landed commit the group's head SHA, and does a `push` run fire on the base after the queue merges? |
| 4d | Does re-running a failed group job rescue the ejected entry? |
| 4e, 4f | Confirm: a skipped required job passes; a path-filtered workflow pends until the timeout. |
| 4h, 4i | What does a `cancelled` required check do, and are runs for a destroyed group cancelled? |
| 5c | Can an App on the bypass list merge through REST while the queue rule is active? |
| 5d, 5e | What does a jump rebuild, and what does a direct merge or push to the base do to a group in flight? |
| 2a | Does build concurrency 0 through the API pause dispatch, and does 1 resume it? |
| 3e | With `HEADGREEN`, one build at a time and a minimum group of four, how many group runs are dispatched for four entries? |
| 10a | With strict up-to-date checks on, must a behind pull request update before it may enqueue? |
| R1 | How do `mergeable` and `mergeStateStatus` read for a queued pull request? |
| R2 | Does a queue merge produce a rule suite that `CompletionEvidence` can find? |

Not tested, with the reason recorded: 10d (queue-length cap) and 10f (required
deployments, unused here).

## Verdict Rule

- **Go** when some identity the fleet merges with can enqueue (10c), the lab
  ran in this repository or the fallback (10b), and no finding contradicts a
  ruling in the exploration's `DECISIONS.md`.
- **Park** when a finding blocks the design but has a named remedy outside
  this goal's scope.
- **Kill** when no fleet identity can enqueue, or a finding makes the queue
  unable to guarantee what lands is what was proven and no setting fixes it.

Findings 6e, 6f and 7f do not decide the verdict; they decide whether the
post-merge run can shrink, and go to `merge-group-parity`.

## Acceptance Criteria

- [ ] The lab ruleset exists, targets only `queue-lab`, and its id is
      recorded; ruleset 10240248 is unchanged.
- [ ] Every row in Observations has a finding with evidence, or a recorded
      reason it could not be observed.
- [ ] `@beep/github` exports typed `enqueuePullRequest`, `dequeuePullRequest`
      and a queue-entry read with schema-decoded results and tests;
      `bun run beep quality package-verify @beep/github` passes.
- [ ] A verdict decision file (go, park or kill) states the reason, and
      `explorations/github-merge-queue` records it in `DECISIONS.md` and its
      README Trail.
- [ ] Synthetic pull requests are closed and their branches deleted. On go,
      `queue-lab` and its ruleset stay with build concurrency 0; on kill, both
      are removed.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/merge-queue-lab/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/merge-queue-lab/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/merge-queue-lab` | Passes |
| `main` ruleset untouched | `bun run beep ci ruleset --check` | Passes |
| Driver package | `bun run beep quality package-verify @beep/github` | Passes |
| Findings complete | every Observations id appears in `research/findings.md` | All present |
| Decisions projected | `bun run beep goals decisions check --slug merge-queue-lab` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- An observation would require enabling a queue on `main`, editing a workflow
  on `main`, or merging to `main` over a failing required check.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add merge-queue-lab --title "..." --reversal "..."`); the block below is
generated from that directory by `bun run beep goals decisions write` and never
edited by hand. Two lanes appending files never conflict; two lanes appending
to this section's tail always did.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug merge-queue-lab`; add a `kind: decision` file there, never edit this block._

### A queue replaces S11 at activation and this goal changes neither, 2026-11-10

S11 stands unchanged until a queue is live on main. No observation may merge to main over a failing required check. Source: `explorations/github-merge-queue/DECISIONS.md`, entry `s11-under-a-queue`.

Reverse: Operator ruling only; see the exploration's s11-under-a-queue entry.

### Design settings for main are squash, one build, group size one, every entry green, 2026-11-10

The lab may set other parameters on its own ruleset to observe them (HEADGREEN, larger groups, strict). The settings the design assumes for main are fixed by the hosted job ceiling and the multi-PR squash incident. Source: `explorations/github-merge-queue/DECISIONS.md`, entry `queue-parameters`.

Reverse: Edit the merge_queue parameters on the ruleset that carries the rule.

### The lab lives on a queue-lab branch in this repository, 2026-11-10

Only this repository exercises the real runner groups and App identities, and the first phase uses a toy required check, so it adds no load. Source: `explorations/github-merge-queue/DECISIONS.md`, entry `lab-venue`.

Reverse: Delete the queue-lab branch and its ruleset; fall back to a public scratch repository in the organization.

### The lab serves the restated activation gate, 2026-11-10

Activation on main is gated on parity, p90 wall time at or under 15 minutes and false ejections at or under 5% over 100 entries, not on main's green rate. This goal settles the behaviours those measurements depend on; it does not measure the gate. Source: `explorations/github-merge-queue/DECISIONS.md`, entries `gate-restatement` and `gate-sample`; `standards/architecture/DECISIONS.md`, 2026-11-09.

Reverse: Supersede the 2026-11-09 standards entry and restore a main-green bar.

### This goal touches no workflow on main and no Yeet merge code, 2026-11-10

Merge-group parity edits scoping sites that ten-minute-certainty's goals rewrite, so it waits for them; the lab runs now because it shares none. Source: `explorations/github-merge-queue/DECISIONS.md`, entries `sequencing-against-ten-minute-certainty` and `goal-split`.

Reverse: Reopen the exploration at decompose and move the work into merge-group-parity or yeet-queue-states.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
