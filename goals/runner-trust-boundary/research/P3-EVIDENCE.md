# P3 admission evidence

Date: 2026-08-25

Status: complete. The cutover landed at the workflow and group layers; the
controller's organization registration first failed closed on a missing
installation permission and rolled back, then redeployed after the permission
was accepted. Admission proofs 1 through 4 are recorded below; proof 5 (the
JIT replay red team) passed in P4 on 2026-08-25.

This record covers the ruleset context renames, the two-PR reusable-workflow
cutover, the organization runner-group restriction, the controller deployment,
and the admission probes for P3. Identifiers follow the packet's public
sanitization convention: run and job ids, instance ids, group ids, and
timestamps only.

## Timeline

All times are UTC on 2026-08-25.

| Time | Event |
| --- | --- |
| `04:28:56Z` | #803 merged to `main`; its heavy lanes still ran through the pre-cutover job definitions. |
| `04:32:29Z` | The five required ruleset contexts were renamed to `Heavy / Lint Policy`, `Heavy / Check`, `Heavy / Test Integration`, `Heavy / Coverage Regression`, and `Heavy / Docgen` on ruleset `10240248`. The other eleven contexts were unchanged. |
| `05:03:27Z` | #805 merged (`f607181b8e`): `heavy.yml` on `main`, local reusable call, controller source carrying organization registration. |
| Before `05:06:41Z` | Organization group `beep-ec2-heavy` (id 4) set to `restricted_to_workflows: true` with `heavy.yml`, `fleet-shadow-check.yml`, and `fleet-lane-probe.yml` at `refs/heads/main`. |
| `05:06:41Z` | #808 opened with the caller pinned to `heavy.yml@main`. |
| `05:06:57Z` | Pre-deploy negative probe (run `32811561391`, `fleet-shadow-check.yml` dispatched on the pull-request branch) was served by a repository-registered runner in group `Default`, proving the restriction cannot bind while runners register at repository level. |
| `05:10:28Z` to `05:11:47Z` | `pulumi up` on the production stack: 3 resources updated, 192 unchanged, 45s. Diff limited to `enable_organization_runners: false => true`, `runner_group_name: "beep-ec2-heavy"`, and the matching lambda environment variables. |
| `05:12:08Z` | Post-deploy probe pair was absorbed within two seconds by idle pre-deploy runners (`minimum_running_time_in_minutes: 5`), so it was inconclusive and discarded. |
| `05:20:42Z` | Every repository-registered runner drained (zero online). |
| `05:20:55Z` | Positive probe re-dispatched: run `32812481386`, `fleet-lane-probe.yml` on `main`. |
| `05:20:56Z` | Negative probe re-dispatched: run `32812483356`, `fleet-shadow-check.yml` on the pull-request branch. |
| `05:19Z` onward | Every scale-up launch failed to register (see the registration incident). Candidates were terminated within seconds; no runner registered at organization or repository level. |
| `05:26:40Z` | `check.yml@refs/heads/main` added as the fourth allowlisted reference for the push-only `Build` job (#808 review finding). |
| `05:27:59Z` | Both probe runs cancelled to stop generating scale-up events while the permission is pending. |
| `05:35:31Z` to `05:36:51Z` | Mechanical rollback: `pulumi up` with `enable_organization_runners: false` (3 updated, 192 unchanged, 45s). Runners register at repository level again; the organization group, its restriction, the ruleset renames, and the `heavy.yml@main` caller all stay in place. The branch keeps the ratified `true`; production diverges until the redeploy. |
| Before `17:36:57Z` | The operator accepted the pending `organization_self_hosted_runners: write` permission on the fleet-controller installation. The installation now reports `actions: read`, `administration: write`, and `organization_self_hosted_runners: write`. |
| `17:37:02Z` to `17:38:58Z` | Redeploy of the committed controller source: `pulumi up` on the production stack, 3 updated, 192 unchanged, 49s. The diff was again limited to `enable_organization_runners: false => true`, `runner_group_name: "Default" => "beep-ec2-heavy"`, and the two lambda environments. |
| `17:38:58Z` to `17:48:09Z` | Drain: the 11 online repository-registered runners idled out under `minimum_running_time_in_minutes: 5`; zero online at `17:48:09Z`. |
| `17:48:10Z` | Positive probe dispatched: run `32880023142`, `fleet-lane-probe.yml` on `main` (`bd10f16f46`), lane `lint`, label `beep-ec2-heavy`. |
| `17:48:11Z` | Negative probe dispatched: run `32880025557`, `fleet-shadow-check.yml` on the non-default branch `codex/runner-trust-boundary-p3-proof`. Its job (`97906985074`) entered the queue at `17:48:13Z`. |
| `17:48:17Z` / `17:48:47Z` | The scale-up lambda launched one candidate per queued job: `i-0c3b96aa7ecfe83fe` and `i-0068158da32258747`. Both registered in organization group 4 with the `beep-ec2-heavy` label; neither appeared in the repository runner list. |
| `17:49:09Z` | Positive probe job `97906976156` started on `beep-ci-i-0c3b96aa7ecfe83fe`, `runner_group_name: beep-ec2-heavy`. It completed `success` at `17:54:26Z`. |
| `17:51:23Z` | Pull request #810 (`chore/allow-git-cleanup`, head `3d12ccbd36`) opened its `Check` run `32880339636`. Its `referenced_workflows` entry resolved `heavy.yml@main` to `refs/heads/main` at `bd10f16f46`. |
| `17:51:25Z` to `17:53:25Z` | All five `Heavy / ...` jobs of run `32880339636` started on group-4 runners: `Coverage Regression` on `beep-ci-i-0068158da32258747` (the idle candidate the negative probe could not use), then `Test Integration`, `Check`, `Lint Policy`, and `Docgen` on four newly launched group runners. |
| `17:53:33Z` | Negative probe verdict: job `97906985074` was still `queued` with empty `runner_name` and `runner_group_name` after five minutes, through the window in which the group admitted six other jobs. The run was cancelled at `17:53:35Z`. |
| `18:08:45Z` to `18:10:33Z` | Absent-group probe deploy: a temporary working-tree edit set `runner_group_name: "beep-ec2-heavy-absent"` and `pulumi up` applied it (2 updated, 193 unchanged). The installation permission was present; only the group name was wrong. |
| `18:10:38Z` | One probe dispatched: run `32882220360`, `fleet-lane-probe.yml` on `main`, lane `lint`; job `97914222404` queued at `18:10:41Z`. No second job was dispatched. |
| `18:10:47Z` to `18:13:20Z` | Eleven candidates launched and each terminated within seconds. The scale-up log holds exactly eleven ERROR events, `Unexpected error while registering GitHub runners.` with `Runner group beep-ec2-heavy-absent does not exist`, and eleven `Terminating instances that failed to get configured`. Organization `beep-ci-*` registrations stayed at zero, group 4 gained no runner, the repository runner list was unchanged, no JIT configuration was generated, and no SSM cache entry was written for the absent name. The job stayed `queued` with no runner. |
| `18:13:36Z` to `18:15:08Z` | Automatic restore: the source edit was reverted and `pulumi up` returned production to `beep-ec2-heavy`. The committed source was never changed. |
| `18:16:22Z` | The same queued job started on `beep-ci-i-03b155683abc871d2`, `runner_group_name: beep-ec2-heavy`, 74 seconds after the restore, through the module's queue retry. |

## Deployed group state

Read back through the organization API after the cutover:

| Field | Value |
| --- | --- |
| `name` | `beep-ec2-heavy` (id 4) |
| `visibility` | `selected` |
| selected repositories | `beep-effect/beep-effect` only |
| `allows_public_repositories` | `true` |
| `restricted_to_workflows` | `true` |
| `selected_workflows` | `heavy.yml`, `fleet-shadow-check.yml`, `fleet-lane-probe.yml`, `check.yml`, each at `refs/heads/main` |

`check.yml` is admitted only for the push-only `Build` job: a push to `main`
executes default-branch code by construction, and the pull-request merge
reference of `check.yml` is not in the list.

## Registration incident

With organization registration deployed, every scale-up attempt failed at the
group lookup:

```text
GET /orgs/beep-effect/actions/runner-groups -> 403 Resource not accessible by integration
x-accepted-github-permissions: organization_self_hosted_runners=read
```

The organization installation of the fleet-controller app carried
`administration: write` and `actions: read` but not
`organization_self_hosted_runners`; the app-level permission change had not
been accepted on the installation. The lambda reported
`successfulRunnerCount: 0`, terminated each candidate (for example
`i-02a2b56816c536cee` at `05:26:44Z` and `i-0ff0c8b82542d26fa` at
`05:27:02Z`), and left the SQS message for retry. No runner appeared in group 4,
in any other organization group, or in the repository runner list.

That behaviour is the fail-closed half of design proof 2: a group the
controller cannot obtain leaves the runner offline with no `Default` or
repository fallback. The remedy is the organization-level permission
acceptance, not a code change. Because the acceptance is a UI action the
operator had not yet taken, the mechanical rollback ran at `05:36:51Z` so no
lane would queue against a fleet that cannot register.

## Redeploy and admission probes

The operator accepted the installation permission; the redeploy, drain, and
probe pair then ran as one scripted sequence (timeline above). The sequence
refused to start unless the installation reported the permission, the
controller source was clean and carried organization registration, and the
non-default probe branch existed on the remote.

Registration after the redeploy behaves as designed. Every candidate launched
for a queued job registered in organization group 4 with the `beep-ec2-heavy`
label and never appeared in the repository runner list. The organization
runner list also holds 400 offline `blacksmith-*` entries in group 3; they
predate this work and are not fleet runners.

The negative probe is the strongest single record. Its queued job triggered a
scale-up launch, so an online, idle, correctly labelled group-4 runner
(`beep-ci-i-0068158da32258747`) existed from about `17:49Z`. GitHub still did
not assign the job, because `fleet-shadow-check.yml` at
`refs/heads/codex/runner-trust-boundary-p3-proof` is outside the group's
selected workflows. That same runner then accepted `Heavy / Coverage
Regression` from #810 at `17:51:25Z`, whose caller resolved the allowlisted
`heavy.yml@refs/heads/main`. The label and repository terms of the admission
rule were satisfied for both jobs; only the workflow-reference term differed.

The negative dispatch is not free: the queued job cost three candidate
launches (the initial one at `17:48:47Z` and `job_retry` launches at
`17:50:53Z` and `17:52:59Z`), each idling for `minimum_running_time_in_minutes`
unless an allowlisted job absorbed it. That is a cost observation for the
packet ledger, not an admission gap.

## Canary-window deviation

The P2/P3 canary-window recipe in `PLAN.md` says to dispatch one operator
probe and admit no second proof job until the decisive result is captured.
The redeploy sequence deviated from that step: the negative probe was
dispatched one second after the positive probe, and pull request #810 opened
at `17:51:23Z` while the positive probe's lane was still running.

The deviation is recorded and ratified rather than rerun, for three reasons.
The decisive result for admission is the assignment record, not lane
completion: the positive probe reported `runner_group_name: beep-ec2-heavy` at
`17:49:09Z`, two minutes before #810 existed. The negative probe is by
construction a job the group must not admit, so it cannot occupy a fleet
runner and did not. And #810 was an ordinary pull request, not an operator
proof job; the recipe's purpose is to keep a possibly bad candidate from
serving production work, and by `17:51:23Z` the candidate registration path
had already been observed clean. The absent-group probe below followed the
recipe strictly: one probe, decisive log and registration output, automatic
restore.

## Absent-group probe

Review of this record pointed out that the `05:19Z` incident failed at the
group listing with a permission `403`, before GitHub could report whether the
named group existed, so it could not stand in for the "missing or rejecting
group" half of proof 2. The absent-group probe closes that gap (timeline
`18:08:45Z` to `18:16:22Z`).

In the pinned module (`github-aws-runners` v7.10.1,
`lambdas/functions/control-plane/src/scale-runners/github-runner.ts`),
`createJitConfig` calls `getRunnerGroupId` before generating any JIT
configuration. With organization runners enabled and a group name set, that
function reads an SSM cache entry for the name and otherwise calls
`getRunnerGroupByName`, which lists the organization's groups and throws
`Runner group <name> does not exist` when the name is absent. The `403` threw
inside that same list call; the absent-group throw is the next statement. In
both cases the exception leaves `createJitConfig` before any runner has a JIT
configuration, so no registration of any kind can occur; the caller terminates
the launched candidates and re-queues the message.

The probe exercised the absent-group branch live: eleven candidates, eleven
`Runner group beep-ec2-heavy-absent does not exist` errors, eleven
terminations, zero registrations at organization or repository level, and a
job that stayed queued until the restore, then ran on a group-4 runner. The
variant where a group is deleted after its id is cached is the per-runner
failure branch in `createJitConfig` (the JIT request fails for the stale id and
the runner is terminated); it shares the no-fallback property by construction
and was not exercised.

## Proof mapping

| Design proof | Result | Evidence |
| --- | --- | --- |
| 1. Group state through the API | pass | "Deployed group state" above. |
| 2. Registration reports the group; absence or rejection leaves the runner offline without fallback | pass | Positive half: both probe candidates registered in group 4 and nowhere else (`17:48:17Z`, `17:48:47Z`). Absent-group half: "Absent-group probe" above (`18:08:45Z` to `18:16:22Z`). The permission `403` incident is retained as a third fail-closed record. |
| 3. A pull-request heavy job reaches a group runner through `heavy.yml@main` | pass | #810 run `32880339636`: `referenced_workflows` resolved `heavy.yml@main` to `refs/heads/main`; all five `Heavy / ...` jobs started on group-4 runners between `17:51:25Z` and `17:53:25Z`. The `main` probe run `32880023142` completed `success` on a group-4 runner. |
| 4. A fleet-labelled dispatch outside the allowlist stays queued with no runner | pass | Run `32880025557`, job `97906985074`: queued `17:48:13Z` to `17:53:33Z` with no runner or group while an idle group runner was online; cancelled at `17:53:35Z`. |
| 5. `REDTEAM_JIT_REPLAY=1` red team | pass in P4 | Run `32893112867` on 2026-08-25 at `20:03Z`: `GATE M_JIT_REPLAY: PASS`, replay rejected with `A session for this runner already exists.` See [`P4-EVIDENCE.md`](./P4-EVIDENCE.md). |

## Pull-request evidence

- #805: five `Heavy / ...` lanes passed on head `6da4e68ed2` through the local
  reusable call (run `32809930953`), before the deployment. Those runners
  reported group `Default`, which is what the deployment changes.
- #808: caller pinned to `heavy.yml@main`; its first run (`32811548058`)
  executed before the deployment and is not admission evidence.
- #810: the first pull request served after the redeploy; run `32880339636`
  is the proof-3 record above.
