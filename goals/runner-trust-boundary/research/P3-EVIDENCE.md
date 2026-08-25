# P3 admission evidence

Date: 2026-08-25

Status: cut over at the workflow and group layers; the controller's
organization registration was deployed, failed on a missing installation
permission, and was rolled back under the ratified posture. Admission proofs 1
and the fail-closed half of 2 are recorded; proofs 3 and 4 wait on the
permission acceptance and redeploy described under "Remaining P3 step".

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

## Remaining P3 step

1. Accept the organization self-hosted-runners permission on the
   `beep-ci-fleet-controller` installation (organization settings, GitHub
   Apps, review the pending permission request). Confirm with
   `gh api /orgs/beep-effect/installations` that the installation reports
   `organization_self_hosted_runners`.
2. Redeploy the committed controller source (`pulumi up --stack production`);
   the diff is again limited to the two registration inputs and the lambda
   environment.
3. Drain pre-deploy runners (zero online in the repository runner list), then
   dispatch `fleet-lane-probe.yml` on `main` and `fleet-shadow-check.yml` on a
   non-default branch. Require the first job to report group `beep-ec2-heavy`
   and the second to stay queued with no runner through a five-minute window.
4. Record both runs under "Proof mapping" and flip proofs 3 and 4 to pass.

## Proof mapping

| Design proof | Result | Evidence |
| --- | --- | --- |
| 1. Group state through the API | pass | "Deployed group state" above. |
| 2. Registration reports the group; absence or rejection leaves the runner offline without fallback | fail-closed half proven | "Registration incident" above; the positive half is recorded with proof 3. |
| 3. A pull-request heavy job reaches a group runner through `heavy.yml@main` | pending permission acceptance | Recorded below when the re-probe runs. |
| 4. A fleet-labelled dispatch outside the allowlist stays queued with no runner | pending permission acceptance | Recorded below when the re-probe runs. |
| 5. `REDTEAM_JIT_REPLAY=1` red team | transferred to P4 | Not run in P3. |

## Pull-request evidence

- #805: five `Heavy / ...` lanes passed on head `6da4e68ed2` through the local
  reusable call (run `32809930953`), before the deployment. Those runners
  reported group `Default`, which is what the deployment changes.
- #808: caller pinned to `heavy.yml@main`; its first run (`32811548058`)
  executed before the deployment and is not admission evidence.
