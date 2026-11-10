# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

Opened 2026-11-09, when the operator scheduled the packet. The three lane
reports under `research/` carry the detail and the citations; this file is
the synthesis the align stage reads.

## External Landscape (2026-11-09)

Full report with a status tag and URL on every claim:
[`research/github-semantics.md`](./research/github-semantics.md). It supersedes
the "GitHub facts" list in `CAPTURE.md`, which was right but short. What
changes the design:

- **One CI run per queued pull request, always.** Each entry gets its own
  temporary branch and its own cumulative `merge_group` build. The merge-limit
  settings decide how many already-green entries land in one operation; the
  docs state they do not combine builds. Nothing native runs CI once for a
  batch. (semantics 3a to 3e)
- **A failure ejects the entry and rebuilds every group behind it.** So does
  jumping the queue. Build concurrency is the only control on concurrent runs,
  and `0` pauses dispatch through the ruleset API. (4a, 5d, 2a)
- **A skipped job passes; a skipped workflow pends until the timeout.** A
  required job that skips under `merge_group` waves the entry through untested.
  (4e, 4f)
- **The caller cannot set the squash message.** `enqueuePullRequest` has no
  message fields and auto-merge's are ignored under a queue. Which repository
  setting the queue's own message follows is undocumented. (6b, 6c)
- **`gh pr merge --admin` skips the queue.** Whether a GitHub App on the bypass
  list can still merge through REST while the rule is active is undocumented.
  (5b, 5c)
- **Queue state is readable.** `MergeQueueEntry` carries state, position and
  estimated time to merge; `pull_request` gets `enqueued` and `dequeued`
  actions with a free-text reason. No REST listing was found. (9c, 9d)
- **Availability.** Public organization-owned repositories are covered per the
  GA changelog; the rule is repository-level only and cannot target a wildcard
  branch pattern. (1a to 1c)
- **A recent incident touched multi-PR squash groups.** The 2026-04-23 status
  report describes squash groups computed on a wrong merge base, reverting
  earlier pull requests in the same group. A maximum group size of 1 avoids
  that class. (6e, secondary source)

About 21 behaviours are undocumented and each needs one observation on a lab
queue. The ones the design depends on: whether a rerun rescues an ejected
entry (4d), what a `cancelled` required check does (4h), whether a direct
bypass merge rebuilds groups in flight (5e), whether the landed commit is the
SHA the group's checks ran on (6e), whether a `push` run still fires on the
base after a queue merge (6f), what secrets a group run sees (7f), and whether
a second ruleset can put a queue on one lab branch (10b).

## In-Repo Capability Inventory (2026-11-09)

Full inventory with `path:line` evidence:
[`research/repo-inventory.md`](./research/repo-inventory.md), read at
`b730601053f`.

**Reuse as they stand**

- `HeavyAdmissionSource` and `HeavyAdmissionEventName` already type
  `merge-group` and `merge_group`, with a decision branch and tests
  (`@beep/repo-cli`, `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts`).
  Today that branch means "admit everything, skip nothing".
- `classifyChangedPaths` and the verification-route classifier are pure over a
  base and head pair (`.../Ci/CiOperational.service.ts`, `.../Ci/Route*.ts`),
  so a docs-only or goals-only verdict for a group needs only
  `merge_group.base_sha` and `head_sha`.
- Lane CLIs take any `--base <sha>` (`.../Ci/CiLane.ts`).
- `check.yml` already gives every ref its own non-cancelling concurrency group,
  and every cache-write credential and app secret is push-only, so a group run
  gets read-only credentials like a pull request.
- `yeet sweep --retire` gates on `MERGED` and is safe under a queue.
- `@beep/github` has `enablePullRequestAutoMerge` with no caller
  (`packages/drivers/github/src/PullRequest.ts`).

**Extend**

- All 15 required contexts come from `check.yml` or the `heavy.yml@main` it
  calls, so one trigger line makes every context report on a group SHA. None
  would fail. Unmodified, each entry runs the full push shape: about 50 hosted
  test shards, full Lint, Nix, the desktop cargo build and five EC2 heavy
  lanes. About 30 pull-request-only scoping sites need a merge-group arm.
- Commitlint lints only the head commit of the group and Secret Scanning scans
  only that commit with the group's own `.gitleaks.toml`. For a one-entry
  squash group the head commit may be the commit that lands, which would make
  group Commitlint the real proof of the squash message.
- Dependency review is pull-request-only and is lost on a group run.
- Runner-loss reruns decline `merge_group` as `unsupported-event`
  (`.../Ci/CiRerunRunnerLoss.ts`), and act minutes after the whole run ends.
  Heavy / Check, Docgen and Doctest still run on Spot EC2, so an eviction is an
  ejection.

**NET-NEW**

- An enqueue path. Every Yeet merge is a synchronous REST
  `PUT /pulls/{n}/merge` (`.../Yeet/internal/MergeGate.ts`, `Merge.ts`,
  `GhOps.ts`); `enqueuePullRequest` is NOT FOUND in the repo.
- Queue states. The monitor ends only on `MERGED` or `CLOSED`
  (`.../Yeet/internal/MonitorLoop.ts`), so an ejected pull request reads open
  and green and comes back `ready` with no reason. No inbox row, settle reason
  or ledger state exists for enqueued, building or ejected.
- A merged-event handler. `merge-gate` runs the S11 comment, run cancellation
  and sibling broadcast in the same process as the merge call.
- A workflow-lint rule that every workflow producing a required context
  triggers on `merge_group` (`.../Ci/CiGovernance.ts`).

**Unproven in the repo:** whether the EC2 runner group, which admits only
`heavy.yml@main`, accepts a caller running from a `gh-readonly-queue` ref.

## Prior Work (2026-11-09)

Full ledger, 55 dated rows with `path:line`:
[`research/prior-work.md`](./research/prior-work.md). The capture knew of two
sources. There are more than twenty, and they disagree.

- **The gate has three bases and no ratified restatement.** The 2026-08-27
  evaluation and the Active standards decision read whole-run success (65.4%).
  `stacked-pr-adoption` ruled on 2026-10-13 that `main` is red per required
  context and left "restating the E8 bar" to this packet.
  `ten-minute-certainty` already writes "required-green" and calls it the E8
  condition. Readings on record: 19% (08-04), 65.4% (08-27), 22.5% (10-05),
  23.2% whole-run and 63.4% required (10-13), and today's 50.2% and 73.8%.
- **The original flip condition had three legs and a prerequisite.**
  `fleet-coordination` required scoped pull-request checks landed (speed-loop
  #56), 80% over 14 days, and at least five concurrent open pull requests,
  with the `merge_group` commitlint and gitleaks gaps (#62) fixed first. Only
  the 80% leg survived into the capture. The scoped-checks leg is plausibly met
  by `verification-route`'s per-lane `skip-satisfied`; no source says so.
- **Nobody owns the design.** speed-loop decision 34 gave it to
  `fleet-coordination`, which delivered a no-go and graduated.
  `time-to-certainty`, `stacked-pr-adoption`, `github-api-quota` and three
  active goals (`github-state-worker`, `yeet-monitor-app-identity`,
  `github-budget-ledger`) each defer to this packet.
- **Merge authority changed under the capture.** The ruleset gained a bypass
  actor and the 20-minute review window on 2026-10-06. S11 (2026-10-09,
  standing since 10-13) lets finals merge over failing required jobs, and 30 of
  36 merges in its first days did. The 2026-11-05 ruling has the gate merge
  finals one at a time with siblings merging `main` between, after three merges
  in 41 seconds left eleven siblings conflicting for 43 hours. That rule is a
  hand-run serial queue.
- **The cost inputs are all stale.** The only throughput model on record
  (`fleet-coordination` T4) assumes 8.4 merges a day. The strict-policy cost of
  "about 8 extra runs a day" rests on the same figure.
- **A local false-red proxy exists.** `time-to-certainty` closed M4 at 16
  red-then-green attempts on an unchanged fingerprint over 1,060 fingerprinted
  attempts (1.5%), from local attempt journals. No source measures a hosted
  false-red rate per required context.

### The sibling that changes the question

`ten-minute-certainty` is active at `decompose` (2026-11-09). Its decision D7
rules that every non-docs `main` commit gets a completed hosted verdict, by a
cancel ban, then a throughput layout for `main` pushes, then per-SHA
concurrency groups. Its MAP carries that as candidate goal
`main-verdict-every-commit` and lists "Per-SHA main groups" and "Merge queue"
as two separate gated candidates.

They are the same spend. A per-SHA verdict is one full run per non-docs commit
after it lands. A merge-group run is one full run per non-docs commit before
it lands. D7 already accepts the 20 to 36 thousand runner-minutes a day and
the pressure on the hosted job ceiling. So against D7's destination a merge
queue costs no extra runs, provided the post-merge push run is then dropped or
reduced; what it costs is merge latency and the false-ejection tax, and what
it buys is that a red never reaches `main`. D7's throughput layout is also the
queue's prerequisite: a push-shaped run that fits under the ceiling.

D9 in the same packet keeps the full corpus replay on every pull request and
says to revisit smoke-plus-main only when `main` verdicts reach 95%. A queue
gives every landed commit a verdict by construction, which meets that
condition by another route.

## Measurements (2026-11-09)

All figures are `check.yml` `push` runs on `main` between 2026-10-26T21:35Z
and 2026-11-10T01:16Z (14.2 days), read on 2026-11-09 with
`gh run list --workflow check.yml --branch main --event push`, plus one
GraphQL `statusCheckRollup` read per tested head SHA. A run counts as
*tested* when it finished as `success`, `failure`, `timed_out` or
`startup_failure`; cancelled runs are excluded. The rollup reports the latest
attempt of each check, so a red that a rerun turned green is invisible here.

### The flip condition, re-read

| Measure | Reading |
| --- | --- |
| Pushes to `main` (merges) | 746, about 53 a day; 125 on the peak day (11-02) |
| Runs cancelled before finishing | 524 of 746 (70%) |
| Tested runs | 221, about 15.6 a day |
| Whole-run success | 111/221 = 50.2% |
| All 15 required contexts green, cancelled context counted red | 163/221 = 73.8% |
| Same, cancelled context counted green | 170/221 = 76.9% |
| 10-26 to 11-01, strict basis | 82/92 = 89.1% on 225 pushes |
| 11-02 to 11-09, strict basis | 81/129 = 62.8% on 521 pushes |

The bar is 80% (standards decision 2026-08-27, restated on the
required-contexts basis by `stacked-pr-adoption` on 2026-10-13). It is unmet
on either counting rule, and it fell 26 points in the week merge volume more
than doubled. The 70% cancellation rate means the bar is read on a three-in-ten
sample of `main` commits: `check.yml` keeps one per-ref concurrency group with
`cancel-in-progress` off for pushes, so a newer push replaces the pending run.

### Where the reds sit

Over the 217 tested commits that reached a job-level result, in commit order:

| Required context | Red runs | Episodes | One-run episodes | Longest run of reds |
| --- | --- | --- | --- | --- |
| Test Unit | 29 | 16 | 10 | 7 |
| Heavy / Test Integration | 14 | 5 | 1 | 5 |
| Heavy / Check | 8 | 6 | 4 | 2 |
| Heavy / Docgen | 6 | 4 | 2 | 2 |
| Repo Sanity | 5 | 3 | 1 | 2 |
| Security | 3 | 3 | 3 | 1 |
| Six others | 1 each | 1 each | 1 each | 1 |

Fifty tested runs had at least one failing required context. Eleven of them
sat between two fully green tested commits; the other 39 belonged to a red
that persisted across consecutive tested commits. The eleven are an upper
bound on false reds at run level (5.1% of tested runs), not a measurement of
them: with seven in ten commits untested, a real break fixed two merges later
looks the same. No red was attributed by reading logs.

### What merges are made of

`git log origin/main --first-parent` over the same window gives 748 commits.
Classified by the change-profile patterns in
`packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json`:

| Class | Merges | Share |
| --- | --- | --- |
| Code (`packages/`, `apps/`, `infra/` or other non-doc paths) | 517 | 69.1% |
| Docs-only | 164 | 21.9% |
| Touches `.github/` | 49 | 6.6% |
| Goals-only | 17 | 2.3% |

About a quarter of merges would pass every heavy lane without work, provided
the classifier can read a merge group's own base and head.

### What one full run costs

Job data for the eight most recent green `main` runs (2026-11-07 to 11-09,
`actions/runs/<id>/jobs`). The layout changed during the sample: #3005 and
#3007 (11-09) moved integration and unit tests onto hosted partitions.

| Layout | Runs | Jobs run | First job to last job | Peak concurrent jobs | Hosted runner-min | Self-hosted runner-min |
| --- | --- | --- | --- | --- | --- | --- |
| After #3005/#3007 | 4 | 74 | 18.7 to 23.9 min | 42 to 62 | 363 to 398 | 15 to 22 |
| Before | 4 | 36 to 40 | 40.7 to 98.2 min | 16 to 32 | 165 to 247 | 52 to 119 |

Four runs is a thin sample and the layout was still moving on 11-09 (#3029,
#3030, #3040). Over the whole window a green `main` run took p50 46 min and
p90 80 min from run start to finish, pending time included.

### What pull-request heads already cost

`gh run list --workflow check.yml --event pull_request` returns at most 1,000
runs, which covered only 2026-11-06 to 11-10. In that span: 1,000 runs on 278
branches, 559 cancelled, 238 green, 199 red. That is at least 250 runs a day,
of which about 110 a day reach a result, and 54.5% of those are green. The
median branch had 2 runs, the 90th percentile 7, the busiest 59. Over
2026-11-03 to 11-10 `heavy-admit.yml` started 422 runs (53 a day).

So a merged pull request already buys about two finished `check.yml` runs on
its own head, plus cancelled partials, before the `main` push run. A
merge-group run per code merge adds about 40 full runs a day to a base of at
least 110.

### Derived cost model

- A merge-group run that proves the required set costs about 400 runner-minutes
  and about 20 minutes of wall time on the new layout, almost all of it on
  GitHub-hosted `ubuntu-24.04`. Heavy self-hosted capacity is no longer the
  scarce resource; hosted concurrent jobs are.
- One full run peaks at 42 to 62 concurrent jobs. `ten-minute-certainty`
  records the hosted ceiling as about 60, a documented default nobody has read
  from the admin side. Two merge-group builds at once would need roughly twice
  that, so on today's layout build concurrency is one in practice.
- One build at a time at 20 minutes is 72 full runs a day. Demand is about 40
  a day on average (53 merges less the docs-only and goals-only quarter) and
  about 95 on the peak day. The average fits; the peak day does not without
  either batching or a shorter run.
- Runner-minutes: about 16,000 a day for merge-group runs at the average rate,
  against about 6,200 a day for today's tested `main` runs. Pull-request heads
  run their own tier 1 and heavy matrix on top of that today; that cost was not
  re-measured here.

## Constraints Discovered

1. **No CI batching.** GitHub builds every queue entry. The cost floor is one
   merge-group run per merged pull request; only a docs-only verdict computed
   from the group's own base and head lowers it.
2. **Hosted concurrent jobs bound build concurrency.** One full run peaks at
   42 to 62 jobs against a ceiling recorded as about 60 and never read from the
   admin side. On today's layout the queue builds one entry at a time.
3. **At one build at a time, run length is throughput.** Twenty minutes gives
   72 entries a day against 40 on an average day and about 95 on the peak day.
4. **S11 and a queue cannot both govern `main`.** A queue lands only green
   groups. The ruleset's bypass list (the admin role and one GitHub App, both
   `always`) is the only other door, and a bypass merge moves the base under
   every group in flight.
5. **A Spot eviction is an ejection.** Three required heavy lanes still run on
   Spot EC2, the pool is capped at two runners with a p95 queue wait of 84
   minutes, and the runner-loss rerun declines `merge_group`.
6. **A skipped required job passes.** Every `if:` on a job that reports a
   required context must be reviewed for `merge_group`, or the queue admits
   untested entries.
7. **The squash message is the queue's, not Yeet's.** `merge-gate` sends an
   explicit linted title and body today; a queue ignores them. Either the
   prediction matches the queue's composition exactly or group Commitlint
   becomes the proof.
8. **`heavy.yml` is called at `@main`.** Any merge-group arm in it is two pull
   requests, and the EC2 runner group's acceptance of a queue-ref caller is
   unproven.
9. **The standards decision of 2026-08-27 is Active.** It forbids activation
   until its gate is met and orders a strict-policy evaluation first. It binds
   until a new decision supersedes it.
10. **Two packets edit the same workflow.** `ten-minute-certainty` is
    decomposing goals that rewrite the scoping, partition and admission sites
    in `check.yml` that merge-group parity also touches.
11. **Money.** Raising the heavy cap, a larger hosted concurrency tier and any
    third-party queue are purchases and go to the operator.
