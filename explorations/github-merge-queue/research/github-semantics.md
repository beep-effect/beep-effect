# GitHub merge queue semantics (primary-source research)

Date read: 2026-11-09. Scope: GitHub.com merge queue on an organization-owned public repository using repository rulesets, GitHub Actions (`workflow_call`), squash merges and self-hosted runners. Web reading only; no API calls were made.

Tags: `VERIFIED` = docs.github.com (or GitHub's own CLI manual) page loaded on the date above, cited with the heading the fact sits under. `SECONDARY` = GitHub changelog/blog, githubstatus.com, a GitHub-staff answer in github.com/orgs/community, or GitHub-maintained schema files. `UNVERIFIED` = not found in a loaded source; each one names the lab-branch observation that would settle it. Third-party vendor docs (Mergify, Trunk, RWX) were seen in search results but are never used as evidence here.

Source keys used below:

- [MMQ] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- [MPR] https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue
- [EVT] https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- [RULES] https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets (the `en` free-pro-team copy loaded but its text did not surface the section; the enterprise-cloud copy did)
- [REST] https://docs.github.com/en/rest/repos/rules
- [WH] https://docs.github.com/en/webhooks/webhook-events-and-payloads
- [GQL] https://docs.github.com/en/graphql/reference/pulls
- [CLI] https://cli.github.com/manual/gh_pr_merge
- [TRS] https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks
- [COND] https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions
- [REUSE] https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations
- [CONC] https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- [CTX] https://docs.github.com/en/actions/reference/workflows-and-actions/contexts
- [APB] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- [ROLES] https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/about-custom-repository-roles
- [SQ] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests
- [CL-GA] https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/
- [CL-MG] https://github.blog/changelog/2022-08-18-merge-group-webhook-event-and-github-actions-workflow-trigger
- [CL-RS] https://github.blog/changelog/2024-02-27-repository-rules-configure-merge-queue-rule-public-beta
- [BLOG] https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day
- [BETA] https://github.com/orgs/community/discussions/46757 (public beta feedback; GitHub maintainer replies, Feb 2023)
- [INC] https://www.githubstatus.com/incidents/zsg1lk7w13cf (incident, 2026-04-23)
- [OCTO] https://raw.githubusercontent.com/octokit/webhooks/main/payload-schemas/api.github.com/merge_group/checks_requested.schema.json

## 1. Availability

- 1a. Merge queue is available on all public repositories owned by organizations, and on public and private repositories on GitHub Enterprise Cloud. A public org repo on the Free plan is therefore covered. `SECONDARY` [CL-GA] (availability paragraph); [BLOG] repeats it. The loaded docs pages did not surface a plan statement in their text (the "who can use this feature" box may not render through the fetcher), so this is not `VERIFIED`.
- 1b. The ruleset "Require merge queue" rule cannot be used in rulesets created at the organization level; it is a repository-level rule. `VERIFIED` [RULES] "Require merge queue". [CL-RS] said the same at public beta (Feb 2024) `SECONDARY`.
- 1c. Branch name patterns with wildcards cannot carry a merge queue. `VERIFIED` [MMQ] "Configuring continuous integration (CI) workflows for merge queues" (caveat paragraph).
- 1d. Custom repository roles, which carry the queue-specific permissions (see 5d), are Enterprise Cloud only, so a Free org gets only the built-in roles. `VERIFIED` [ROLES].

## 2. Ruleset `merge_queue` rule parameters

All seven parameters are required in the REST schema. `VERIFIED` [REST] (rule type `merge_queue`).

| REST parameter | Range / enum | UI name and meaning |
| --- | --- | --- |
| `merge_method` | `MERGE`, `SQUASH`, `REBASE` | "Merge method": one method for every queued PR |
| `max_entries_to_build` | 0..100 | "Build concurrency": how many queued PRs may request checks (dispatch `merge_group.checks_requested`) at once |
| `min_entries_to_merge` | 0..100 | "Minimum group size": minimum PRs merged together |
| `max_entries_to_merge` | 0..100 | "Maximum group size": maximum PRs merged together |
| `min_entries_to_merge_wait_minutes` | 0..360 | "Wait time to meet minimum group size", counted from the first PR's arrival |
| `grouping_strategy` | `ALLGREEN`, `HEADGREEN` | "Require all queue entries to pass required checks" on = `ALLGREEN` (every PR's merge commit must pass); off = `HEADGREEN` (only the group's head commit must pass) |
| `check_response_timeout_minutes` | 1..360 | "Status check timeout": checks with no conclusion by then count as failed |

- 2a. Build concurrency `0` stops new dispatches; queued PRs stay paused until it is at least `1`. `VERIFIED` [RULES] "Require merge queue". [MMQ] "Managing a merge queue" gives the UI range as 1 to 100 `VERIFIED`, so `0` is a REST/ruleset-only pause switch.
- 2b. The 360-minute timeout cap dates from a Feb 2023 fix. `SECONDARY` [BETA] (maintainer reply).
- 2c. The companion `required_status_checks` rule has `strict_required_status_checks_policy` (bool, required), `do_not_enforce_on_create` (bool), and `required_status_checks[]` of `{context (required), integration_id}`. Bypass actors take `bypass_mode` `always`, `pull_request` or `exempt` (`exempt`: rules do not run for that actor and no bypass audit entry is written). `VERIFIED` [REST].
- 2d. GraphQL mirrors the config as `MergeQueueConfiguration` (`checkResponseTimeout`, `maximumEntriesToBuild`, `maximumEntriesToMerge`, `mergeMethod`, `mergingStrategy`, `minimumEntriesToMerge`, `minimumEntriesToMergeWaitTime`). `VERIFIED` [GQL] objects.

## 3. Group-to-CI mapping

- 3a. Each queued PR gets its own temporary branch and its own build, cumulative: the branch for PR #2 contains the target branch, PR #1 and PR #2. `VERIFIED` [MMQ] "How merge queues work" > "Successful CI" (steps 2 and 4).
- 3b. "Merge limits do not combine `merge_group` builds"; min/max group size only govern how many already-green entries are merged into the base in one operation. `VERIFIED` [MMQ] "Managing a merge queue" (Merge limits). Minimum size suits slow post-merge CI/deploys; maximum size caps how many changes one deployment ships. `VERIFIED` same.
- 3c. Build concurrency throttles the number of `merge_group` webhooks dispatched, which throttles concurrent CI builds. `VERIFIED` [MMQ] "Managing a merge queue".
- 3d. Grouping strategy: with "Only merge non-failing pull requests" off (`HEADGREEN`), a PR whose own build failed can still merge in a group as long as the last PR in that group passed; on (`ALLGREEN`), every PR must pass. `VERIFIED` [MMQ] "Managing a merge queue"; enum text "Failing Entires are allowed to merge if they are with a passing entry" `VERIFIED` [GQL] `MergeQueueMergingStrategy`.
- 3e. No native setting runs CI once per batch of N PRs. Every entry is dispatched its own `merge_group` build (subject to build concurrency); grouping affects only merging. `VERIFIED` by 3a to 3c. Whether `HEADGREEN` plus low build concurrency lets entries merge on the tail's build without their own build ever being dispatched is `UNVERIFIED`: queue four PRs with `max_entries_to_build=1`, `HEADGREEN`, min group 4, and count `merge_group` workflow runs versus PRs merged.
- 3f. Inference (not documented): making a non-tail entry's required jobs skip (skip = success, see 4e) does not save a run safely, because a green entry is mergeable on its own build; it would merge base+PR unvalidated. Treat any "only build the tail" trick as `UNVERIFIED` and unsafe until 3e is measured.

## 4. Failure handling

- 4a. A required-check failure (or a conflict) on a group removes the failing PR; the queue recreates the temporary branches behind it without that PR, so their CI restarts. `VERIFIED` [MMQ] "How merge queues work" > "Failing CI" (steps 5 to 7).
- 4b. Removal reasons: CI reports failures for the group; no successful result before the timeout; a user removal via API or queue UI; a branch-protection failure that cannot be resolved automatically. `VERIFIED` [MMQ] "Failing CI" and [MPR] "Understanding why your pull request was removed from the merge queue" (list identical on both).
- 4c. Timeout: checks without a conclusion by `check_response_timeout_minutes` are treated as failed, so the PR is removed. `VERIFIED` [REST]; [MMQ] "Status check timeout".
- 4d. Re-running a failed `merge_group` job after the removal does not re-admit the PR: `UNVERIFIED` (no doc statement; community threads only ask for it). Lab: fail a required job, wait for `dequeued`, re-run the job green, and watch whether the PR re-enters.
- 4e. A job skipped by an `if:` reports "Success" and does not block merge even when required. `VERIFIED` [COND] (note). Successful check statuses are `success`, `skipped` and `neutral`. `VERIFIED` [TRS] "Handling skipped but required checks"; [APB] "Require status checks before merging" says the same.
- 4f. A whole workflow skipped by path, branch or commit-message filters leaves its checks "Pending", which blocks merging; on a queue that becomes a timeout removal (4c). `VERIFIED` [TRS] "Handling skipped but required checks".
- 4g. A job skipped because a `needs` dependency failed may not block merging; GitHub advises `always()` with `needs` for required aggregate jobs. `VERIFIED` [TRS] same section.
- 4h. `cancelled` conclusion on a required check: not documented. `UNVERIFIED`. Lab: cancel a required `merge_group` run and record whether the entry is removed at once or waits for the timeout.
- 4i. On `merge_group.destroyed` GitHub suggests receivers cancel checks still running on the head SHA, so stale runs are not cancelled for you. `VERIFIED` [WH] `merge_group` "destroyed". Whether Actions auto-cancels them: `UNVERIFIED` (lab: dequeue a building PR and see whether its run keeps going).

## 5. Bypass

- 5a. An administrator can choose "Merge without waiting for requirements to be met (bypass branch protections)" when branch protection settings allow it. `VERIFIED` [MPR] "Adding a pull request to a merge queue".
- 5b. `gh pr merge --admin` merges directly and skips the queue. `VERIFIED` [CLI] description.
- 5c. A ruleset bypass actor (a GitHub App in `always` or `exempt` mode) merging through REST `PUT .../pulls/{n}/merge` while the queue rule is active: `UNVERIFIED` on GitHub sources. Lab: add an App as bypass actor and call the merge endpoint on a queued and an unqueued PR.
- 5d. Jumping: `enqueuePullRequest` takes `jump: Boolean`; an entry also carries `solo`. `VERIFIED` [GQL]. Jumping "will cause a full rebuild of all in-progress pull requests" because it breaks the commit graph. `VERIFIED` [MMQ] "Jumping to the top of the queue". Jump and solo are grantable as "Jump to the front of the queue" and "Request a solo merge" in custom roles (Enterprise Cloud only). `VERIFIED` [ROLES]. Since GA only admins jump by default. `SECONDARY` [CL-GA].
- 5e. Effect of a direct (bypass) merge or push to the base on groups already building: `UNVERIFIED`. The docs say every group is built on the latest base (3a), which implies a rebuild. Lab: push to the base while two entries build; count new `checks_requested` events and `destroyed` reasons (`invalidated` expected).

## 6. Merge method and commit identity

- 6a. One merge method per queue (the rule's `merge_method`). `VERIFIED` [REST]; [APB] "Require merge queue" (GitHub merges using the strategy configured on the rule).
- 6b. Commit message or merge-method inputs to `enablePullRequestAutoMerge` are ignored when a merge queue is required. `VERIFIED` [GQL] `EnablePullRequestAutoMergeInput`. `enqueuePullRequest` has no headline/body input at all. `VERIFIED` [GQL]. With a queue, `gh pr merge` needs no strategy flag. `VERIFIED` [CLI]. So a caller cannot override the squash title/body at enqueue time.
- 6c. Which squash message the queue writes (the repository's "Allow squash merging" default: PR title only, title plus commit details, or title plus description; [SQ] `VERIFIED` for the setting itself): `UNVERIFIED` that the queue honours it. Lab: set the default to "title and description", queue a PR, read the landed commit message.
- 6d. With squash, every PR keeps its own commit even when one queue operation merges several PRs. `SECONDARY` [BETA] (maintainer, 2023-02-08). A multi-PR squash group is therefore N commits on the base, not one.
- 6e. Whether the landed head commit is the SAME SHA as the `merge_group` head (fast-forward, so the group's check runs sit on the landed commit): `UNVERIFIED`. Relevant signal: the 2026-04-23 incident computed squash commits at "merge queue ref update" time with a wrong merge base, reverting earlier PRs in multi-PR squash groups (2,092 PRs; merge-method groups unaffected). `SECONDARY` [INC]. Lab: compare `merge_group.head_sha` with the base tip after merge, for a 1-PR and a 2-PR squash group.
- 6f. A `push` event on the base branch after the queue merges: `UNVERIFIED` (not stated). Pushes of the temporary branches do fire `push`. `SECONDARY` [CL-MG]; [CL-GA] fixed `before`/`created` on those pushes. Lab: keep a `push: branches: [lab]` workflow and see whether it runs on the queue merge.

## 7. The `merge_group` workflow event

- 7a. Workflow activity types: only `checks_requested`. `VERIFIED` [EVT] `merge_group`. The webhook adds `destroyed` with `reason` described as `merged`, `dequeued` or `invalidated` (an earlier entry was dequeued). `VERIFIED` [WH] `merge_group`. The webhook needs the "Merge queues" repository permission (read) and is App-only. `VERIFIED` [WH].
- 7b. `GITHUB_SHA` = SHA of the merge group; `GITHUB_REF` = ref of the merge group. `VERIFIED` [EVT]. `branches`/`branches-ignore` filter on the target (base) branch. `VERIFIED` [EVT].
- 7c. Payload `merge_group` object requires `head_sha`, `head_ref`, `base_sha`, `base_ref`, `head_commit`. `SECONDARY` [OCTO]; `head_sha` is the commit to validate `SECONDARY` [CL-MG]. The docs reference collapses the nested object, so the field list itself is not `VERIFIED`.
- 7d. `github.head_ref`/`github.base_ref` are only defined for `pull_request` and `pull_request_target`, so they are empty on `merge_group`; use the event payload. `VERIFIED` [CTX] `github` context.
- 7e. Temporary branch prefix `gh-readonly-queue/{base_branch}`; the branches hold a different SHA from the PR. `VERIFIED` [MMQ] "Triggering merge group checks with third-party CI providers". The full pattern `gh-readonly-queue/<base>/pr-<n>-<sha>` is `UNVERIFIED` (docs examples use the shortened `main/pr-1`). Lab: log `GITHUB_REF`.
- 7f. Secrets and `GITHUB_TOKEN` write scope on `merge_group`: `UNVERIFIED`. The fork restrictions in [EVT] are written only for the `pull_request` family and are not attached to `merge_group` `VERIFIED` [EVT]; the temp branch lives in the base repository. Lab: echo a secret's presence (not value) and the token's `permissions` from a group run.
- 7g. Discovering the PRs in a group: no documented payload field lists them. `UNVERIFIED`. Options to test: parse `pr-<n>` from `head_ref`; read `head_commit.message`; or query `PullRequest.mergeQueue.entries` and match `headCommit` (fields in 9c).

## 8. Required-check matching under a queue

- 8a. Required checks match by `context` name, optionally pinned to an `integration_id` (App); a check and a commit status with the same name must both pass. `VERIFIED` [REST]; [TRS] "Required status checks from unexpected sources".
- 8b. Checks from workflow jobs only count when the run's event is eligible (`push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`, `deployment_status`), and a queue needs `merge_group`, "separate from the `pull_request` and `push` events". `VERIFIED` [TRS] "Checks from some workflow jobs are not evaluated" and "Status checks with GitHub Actions and a Merge queue".
- 8c. Reusable workflows: the `github` context in a called workflow is always the caller's, so the called workflow runs as the caller's `merge_group` event. `VERIFIED` [REUSE]. That only the caller needs `on: merge_group` follows, but is `UNVERIFIED` explicitly; so is the check name format (`<caller job> / <called job>`). Lab: add `merge_group` to the caller only and read the check names on the group SHA.
- 8d. Concurrency: at most one running and, by default, one pending run per group; a new pending run cancels the older pending one; `queue: max` keeps up to 100 pending. `VERIFIED` [CONC]. `github.head_ref || github.run_id` falls back to the run id on `merge_group` (8d + 7d). [CONC] never mentions merge groups. A shared group across entries would cancel cumulative builds and, per 4c/4h, eject PRs: `UNVERIFIED` on GitHub sources.
- 8e. Path filters and conditional jobs: see 4e to 4g (skipped job passes; skipped workflow pends forever and times out).

## 9. API and CLI surface

- 9a. `gh pr merge`: with checks passed it enqueues; otherwise it enables auto-merge; `--auto` is the explicit form; `--admin` skips the queue; `--subject`/`--body` exist but per 6b have no queue effect. `VERIFIED` [CLI]; [MPR] "Adding a pull request to a merge queue". The CLI cannot remove from or list the queue. `VERIFIED` [MPR] "Removing a pull request from a merge queue" and "Viewing merge queues".
- 9b. `enqueuePullRequest(pullRequestId, expectedHeadOid, jump)` returns `mergeQueueEntry` and errors with the reason if the PR cannot be queued now (no auto-merge fallback); `dequeuePullRequest(id)` returns the entry. `VERIFIED` [GQL]; [MPR].
- 9c. `MergeQueueEntry`: `state` (`AWAITING_CHECKS`, `LOCKED`, `MERGEABLE`, `QUEUED`, `UNMERGEABLE`), `position`, `estimatedTimeToMerge`, `enqueuedAt`, `enqueuer`, `headCommit`, `baseCommit`, `jump`, `solo`, `pullRequest`. `MergeQueue`: `entries`, `configuration`, `nextEntryEstimatedTimeToMerge`. `PullRequest`: `isInMergeQueue`, `isMergeQueueEnabled`, `mergeQueue`, `mergeQueueEntry`. `VERIFIED` [GQL]. A REST endpoint listing the queue was not found. `UNVERIFIED`.
- 9d. Events: `pull_request` actions `enqueued` and `dequeued` (`dequeued` has a required `reason` string, no documented enum). `VERIFIED` [WH] `pull_request`. Since GA, `dequeued` also fires when the queue merges the PR. `SECONDARY` [CL-GA]. Timeline: `AddedToMergeQueueEvent` and `RemovedFromMergeQueueEvent` (`reason: String`, `beforeCommit`, `enqueuer`). `VERIFIED` [GQL]. Rule insights record each queued PR separately. `SECONDARY` [CL-RS].

## 10. Limits and interactions

- 10a. The queue gives the benefit of "Require branches to be up to date before merging" without authors updating branches. `VERIFIED` [MMQ] "About merge queues". Whether keeping `strict_required_status_checks_policy: true` alongside the queue still forces PR-branch updates before enqueue: `UNVERIFIED`. Lab: enqueue a behind-base PR with strict on.
- 10b. A second repository ruleset targeting one non-default branch with its own queue rule is not forbidden by any loaded page; limits found are no wildcards (1c) and no org-level rule (1b). `UNVERIFIED` as a positive claim. Two queue rules on one branch block merging. `SECONDARY` [CL-RS].
- 10c. Only users with write access can add a PR. `VERIFIED` [MMQ] "About merge queues". App installation tokens or fine-grained PATs calling `enqueuePullRequest`, and whether a PR touching `.github/workflows` needs the "Workflows" permission on the enqueuer: `UNVERIFIED` (no "Merge queues" permission is listed for REST endpoints in the permissions pages). Also unknown: whether an enqueue made with `GITHUB_TOKEN` still triggers `merge_group` runs, given token-triggered events do not create runs (docs list no queue exception).
- 10d. Caps: build concurrency 1..100 (0 pauses), group size 0..100, wait 0..360 min, timeout 1..360 min. `VERIFIED` [REST]. Queue-length cap: none found. `UNVERIFIED`.
- 10e. Auto-merge: "Merge when ready" before checks pass enables auto-merge and enqueues later, even if auto-merge is disabled for the repository. `VERIFIED` [MPR].
- 10f. Required deployments with a queue: no statement found. `UNVERIFIED`. [MMQ] mentions deployments only as the reason for min/max group sizes.

## Facts that change a cost model

1. One `merge_group` CI run per queued PR, cumulative; no native batching of CI (3a, 3b, 3e). A clean PR costs at least its `pull_request` runs plus one `merge_group` run.
2. Any failure or timeout ejects the PR and rebuilds every group behind it (4a, 4c): one red at position k re-runs up to (build concurrency - k) groups.
3. Jumping, and probably any base move, rebuilds all in-progress groups (5d, 5e).
4. Skipped jobs pass, skipped workflows pend until timeout (4e, 4f); path-filtered required workflows must instead skip at job level.
5. Build concurrency is the only knob on concurrent runs; `0` pauses dispatch (2a, 3c).
6. A shared workflow `concurrency` group across entries can cancel builds (8d, unverified).
7. Re-running a failed group job probably does not rescue the PR (4d, unverified), so a flake costs a re-enqueue plus rebuilds behind it.
8. Whether a post-merge `push` run on the base still happens is open (6f); if it does, each PR pays a third run unless `push` work is dropped.

## Still unverified

- 3e `HEADGREEN` + low build concurrency dispatch count; 3f tail-only tricks.
- 4d re-run rescue; 4h `cancelled` conclusion; 4i auto-cancel of destroyed group runs.
- 5c App bypass via REST merge with queue active; 5e base push effect on building groups.
- 6c squash message source; 6e landed SHA equals group head SHA; 6f base `push` event.
- 7c payload fields in docs; 7e full branch pattern; 7f secrets/token scope; 7g PR list.
- 8c caller-only `merge_group` trigger and check names; 8d concurrency ejection.
- 9c REST queue listing; 10a strict + queue; 10b lab-branch ruleset; 10c App/PAT enqueue, workflow-file PRs, `GITHUB_TOKEN` enqueue; 10d queue-length cap; 10f required deployments.
- 1a plan statement on docs.github.com itself (only changelog/blog loaded).
