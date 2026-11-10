# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

One goal is promised now. The other four are gated candidates: re-entry
points, not goals. When a gate fires, this packet reopens at `decompose`.

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `merge-queue-lab` (now) | Stand up a merge queue on a lab branch behind a toy required check, observe every GitHub behaviour the design depends on and the docs leave open, and record each as a finding with a run as evidence. Land the enqueue and queue-entry calls in the GitHub driver. End with a go, park or kill verdict for the packet. | none | Ruleset create, update and delete: `@beep/github` `packages/drivers/github/src/Ruleset.ts`. Ruleset read and check: `beep ci ruleset` in `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts`. GraphQL mutation pattern: `enablePullRequestAutoMerge` in `packages/drivers/github/src/PullRequest.ts`. Probe-workflow precedent: `.github/workflows/fleet-lane-probe.yml`. App identity: `provideYeetGhLogin` in `.../Yeet/internal/GhOps.ts`. NET-NEW: the toy workflow (lives only on the lab branch), `enqueuePullRequest`, `dequeuePullRequest` and the queue-entry read in `@beep/github`, the lab driver script, the findings ledger. |
| `merge-group-parity` (gated) | Give every required context a correct merge-group arm through one derived CI event shape, prove parity on the lab queue, hold it with a workflow-lint rule, and measure the activation gate. | `merge-queue-lab` ends in go; `ten-minute-certainty`'s `route-soundness-repair`, `heavy-pool-diet` and `hosted-setup-tax` merged | `HeavyAdmissionEventName`, `HeavyAdmissionSource`, `GhPullRequestEventPayload` in `.../Ci/HeavyAdmission.ts`. `classifyChangedPaths` in `.../Ci/CiOperational.service.ts`. Route classifier in `.../Ci/Route*.ts`. `--base` lane flags in `.../Ci/CiLane.ts`. Workflow lint in `.../Ci/CiGovernance.ts`. Runner-loss rerun in `.../Ci/CiRerunRunnerLoss.ts`. Scorecard from `ten-minute-certainty`'s `certainty-scorecard` (planned). NET-NEW: the `CiEventShape` schema, a `merge_group` payload schema, the required-context trigger lint rule. |
| `yeet-queue-states` (gated) | Teach Yeet the queue: `merge-gate` enqueues where the base branch has a queue, enqueued and building are wait reasons, ejection is a terminal reason with an inbox row, post-merge actions run from a merged event, and the squash prediction matches what the queue writes. Dormant on `main` until activation; exercised on the lab branch. | `merge-queue-lab` ends in go; `goals/github-state-worker` completed | `.../Yeet/internal/MergeGate.ts`, `Merge.ts`, `GhOps.ts`, `SquashCommitlint.ts`, `MonitorPolicy.ts`, `MonitorLoop.ts`, `Settle.ts`, `Settle.schemas.ts`, `Inbox.ts`; `.../Session/Session.schemas.ts`; the driver calls landed by `merge-queue-lab`; PR-keyed snapshots from `goals/github-state-worker` (pending). NET-NEW: queue wait and ejection states, the ejection inbox row, the merged-event handler. |
| `merge-queue-activation` (gated) | Turn the queue on for `main`: add the rule, retire S11, rewrite the merge doctrine, shrink the post-merge push run, and ship the pause, jump, resume runbook with a rollback proven on the lab branch. | The gate in `DECISIONS.md` (`gate-restatement`) holds; `merge-group-parity` and `yeet-queue-states` completed; `ten-minute-certainty`'s `main-verdict-every-commit` has landed its throughput layout; the cache-writer question is settled | Ruleset writes: `@beep/github` `Ruleset.ts`, `beep reviewer ruleset` in `.../Reviewer/ReviewerRuleset.ts`. Doctrine: `AGENTS.md`, `.claude/skills/orchestrate/`, `.claude/skills/yeet/`. Standards entry 2026-11-09 in `standards/architecture/DECISIONS.md`. NET-NEW: the `merge_queue` rule on ruleset 10240248, the pause switch command. |
| `pr-head-slimming` (gated) | Decide, on measured ejection causes, whether heavy lanes and the corpus replay move off pull-request heads into the merge group. | Queue live on `main` for 14 days with ejection causes recorded | Heavy admission in `.../Ci/HeavyAdmission.ts`; `ten-minute-certainty` D9. Nothing NET-NEW until the data exists. |

### Capability check

Each NET-NEW item was challenged against an existing brick:

- **Toy workflow.** `fleet-lane-probe.yml` is operator-dispatched and runs a
  real lane; the lab needs a check that reports on `pull_request` and
  `merge_group` and can be told to pass, fail, skip, cancel or hang. Different
  trigger and purpose, so it is new, and it lives only on the lab branch.
- **Driver enqueue calls.** `enablePullRequestAutoMerge` enqueues only as a
  side effect when checks are pending and cannot dequeue, jump or read an
  entry. `enqueuePullRequest` is NOT FOUND in `packages/` (search in
  `research/repo-inventory.md`, section C). New, in the same file and pattern.
- **`CiEventShape`.** `HeavyAdmissionEventName` names the three events but
  carries no base or head, and `GhPullRequestEventPayload` decodes only the
  pull-request payload. The shape composes both; it is one new schema, not a
  new module family.
- **Trigger lint rule.** `CiGovernance.ts` already lints workflow concurrency
  shape; the rule is one more check in that pass.
- **Queue states.** `MonitorPolicy.ts` and `Settle.schemas.ts` own the
  terminal and settle reason domains; the new states extend those literal
  domains, they do not sit beside them.
- **Pause switch.** `beep reviewer ruleset release|require --apply` already
  performs a guarded ruleset write; the pause is the same write on a different
  parameter.

## Sequencing

1. **`merge-queue-lab` first, alone.** Everything else rests on behaviours
   GitHub does not document. It touches no shared workflow and no Yeet merge
   code, so it cannot collide with `ten-minute-certainty`'s goals.
2. **`merge-group-parity` when its gate opens.** It waits on the route
   selector being sound and on the job-removing goals, because a merge-group
   run is the largest job-adding lever against the hosted ceiling.
3. **`yeet-queue-states` beside parity, not before the lab.** The lab says
   which states and events exist. It reads through `github-state-worker`'s
   snapshots, so it follows that goal.
4. **`merge-queue-activation` last.** It is the only candidate that changes
   doctrine and the only one that needs the gate numbers.
5. **`pr-head-slimming` only on live data.**

`ten-minute-certainty/MAP.md` lists "Per-SHA main groups" and "Merge queue,
stacked PRs" as separate gated candidates with the 80% bar. Under the
`verdict-placement` and `gate-restatement` rulings those rows are one
candidate, `merge-queue-activation`, with the gate above. That packet is live
in another session; its owner rewrites the rows.

## First Vertical Slice

For `merge-queue-lab`: one synthetic pull request goes through a real queue
and four findings are recorded.

- A `queue-lab` branch carries a toy workflow that reports one required
  context on `pull_request` and `merge_group`.
- A second ruleset targets `queue-lab` with that required context and a
  `merge_queue` rule (squash, one build, group size 1).
- One pull request against `queue-lab` is enqueued with the orchestrator App's
  token.

When it lands, an agent can read from the findings ledger, each with a run or
API response as evidence: whether a second queue ruleset on a non-default
branch is accepted (10b), whether the App may enqueue (10c), whether the
landed commit is the group's head SHA (6e), and whether a `push` run fires on
the base after the queue merges (6f). The first two decide whether the lab
continues in this repository; the last two decide whether the post-merge run
can shrink.

## Open Risks Inherited From The Brief

- `merge-queue-lab`: a second queue ruleset may be refused (fallback: a public
  scratch repository in the organization); the merging identity may not be
  able to enqueue or jump.
- `merge-group-parity`: the landed commit may not be the proven one; the cache
  writer is push-only; `heavy.yml` is called at `@main`, so each arm is two
  pull requests; the EC2 runner group may reject a queue-ref caller; a skipped
  required job passes; a Spot eviction is an ejection; the docs-only verdict
  inherits the change-profile selector.
- `yeet-queue-states`: the squash message is the queue's; `dequeued` reasons
  are free text.
- `merge-queue-activation`: the hosted job ceiling is a guess; the peak day
  sits at the edge of one build at a time; a queue does not fix textual
  conflicts, so the three-pull-request cap and the merge-`main` rule stay.
