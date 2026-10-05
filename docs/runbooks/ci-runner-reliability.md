# Heavy CI runner reliability

Account budgets, audit receipts and image refresh/retention policy are owned by
[AWS cost operations](./aws-cost-operations.md).

**September 15, 2026:** the current policy keeps AWS heavy CI available with a
two-worker cap and a $200/month account budget alert. Scale-up reserved concurrency
is 1, and the launch/retry queue mappings remain enabled. The earlier emergency
pause blocked PR job pickup and has been superseded. Follow the current policy
in AWS cost operations; the 14-worker deployment evidence below is historical.

The current `beep-ec2-heavy` pool uses Spot capacity with `capacity-optimized`
allocation across seven 64 GiB instance types and five availability zones, and
automatic On-Demand fallback disabled. This is the October 1, 2026 pool spread
(deployment evidence below, recorded with eight types), minus `r6a.2xlarge`,
which was dropped on October 5, 2026 after 20 of its 69 launches that day
ended `instance-terminated-no-capacity` while the other seven types lost 6 of
86. A live scale-up Lambda listing seven types is the intended state, not
drift. All of this sits on top of the September 15 containment that
superseded the September 9 On-Demand posture. Keep the two-instance cap, 64 GiB
instance choices and ephemeral one-job-per-VM teardown. A budget alert does not
enforce a monthly worker-hour limit. Diagnose interrupted jobs before retrying;
changing the alert does not change running workers.

## Admission and capacity

Admission bounds what enters the `beep-ec2-heavy` queue; it does not add
capacity. Two workflows share one decision, `bun run beep ci admission`: the
`Heavy Admission` job in `check.yml` runs it on every push (a pull request
enters the heavy matrix only with the `ready-for-heavy` label, or as a main
push / merge group; a docs-only diff is called with `admitted: false` so every
lane passes without work on a hosted runner; an unlabelled code PR holds outside the queue), and
`heavy-admit.yml` runs the same job plus the heavy caller when the label is
applied, so labelling never cancels or re-runs tier 1. Throughput is
still heavy duration times queue depth. Pool sizing — `runners_maximum_count`,
Spot versus On-Demand, the two-worker cap above — remains the operator's lever
and is unchanged by admission (time-to-certainty ruling 57).

## Attribute a runner loss

1. Read every relevant attempt with
   `gh api 'repos/beep-effect/beep-effect/actions/runs/<run-id>/jobs?filter=all&per_page=100'`.
   Follow pagination for larger runs. Record job, runner, step, and completion
   times; GitHub's latest attempt alone hides earlier runner losses.
2. Read the job's check annotations. A runner communication failure with an
   unfinished step identifies runner loss, not a source assertion.
3. Remove `beep-ci-` from the runner name to obtain the EC2 instance ID. Read
   `aws ec2 describe-spot-instance-requests --filters Name=instance-id,Values=<instance-id>`.
   `instance-terminated-no-capacity` proves Spot reclamation. Compare its
   update time with GitHub's later failure time before inferring a timeout.
4. Check CloudTrail and the scale-down/reaper logs for controller-initiated
   termination. The dedicated reaper uses a 150-minute TTL. Inspect operating
   system or runner diagnostics before attributing an unexplained loss to OOM.
5. Count only the matching fleet instances. Terminated EC2 and Spot request
   records have limited retention; preserve a sanitized incident receipt early.
6. Once the Spot request record has expired, prove a reclaim from CloudTrail and
   the termination watcher. The eviction is a `BidEvictedEvent` with a null
   `userIdentity` whose `serviceEventDetails.instanceIdSet` names the instance:
   `aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=BidEvictedEvent`.
   About two minutes earlier the watcher logs the interruption warning with
   `instanceState:"running"`:
   `aws logs filter-log-events --log-group-name /aws/lambda/beep-ci-spot-termination-notification --filter-pattern '"<instance-id>"'`.
   `aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceName,AttributeValue=<instance-id>`
   then shows the launch and no `TerminateInstances` call from any principal.
   GitHub fails the job with the "lost communication" annotation 9 to 10
   minutes after the eviction, its runner-heartbeat timeout.

On 2026-10-01, all 28 "lost communication" heavy jobs between 2026-09-29 20:00Z
and 2026-10-01 00:00Z matched this pattern: each instance had a
`BidEvictedEvent`, a watcher warning two minutes before it, and a GitHub failure
9.0 to 9.9 minutes after it. No principal called `TerminateInstances` on them,
which rules out scale-down and the reaper. The window had 41 evictions across
564 launches. `price-capacity-optimized` kept choosing the cheapest pool:
`r7i.2xlarge` took 279 launches (198 in `us-east-1a`) and 25 evictions (19 in
`us-east-1a`). The scale-up Lambda also logged 136
`InsufficientInstanceCapacity` errors on 2026-09-30, while the fleet could use
only `us-east-1a` and `us-east-1b`. Loss rate tracked job duration: Coverage
Regression lost 19.7% of executions and Lint Policy 18.0%.

On 2026-09-09, four workflows supplied nine distinct runner-loss examples.
Every matching Spot request reported capacity reclamation. A broader retained
fleet snapshot contained 30 such interruptions. GitHub marked these jobs failed
roughly 11 minutes after termination. This exceeded the former
`>2 interruption reruns/week` tripwire. The September 15 cost-containment
decision subsequently returned the pool to Spot; the interruption evidence
remains relevant to cost per successful completion.

## Automatic runner-loss rerun

`.github/workflows/rerun-runner-loss.yml` re-runs jobs that failed because
their runner died. It runs on `workflow_run` after every completed `Check` and
`Heavy Admit` run that concluded `failure`, on a GitHub-hosted runner, and
calls `bun run beep ci rerun-runner-loss --run-id <id> --attempt <n>`. The
command reads the run, that attempt's jobs, and each failed job's check-run
annotations, then decides:

- A job is lost when it concluded `failure`, an annotation reads "lost
  communication with the server", and none of its steps concluded `failure`.
  The Spot evictions of 2026-09-29..10-01 all had this shape: earlier steps
  `success`, the running step without a conclusion.
- Nothing happens unless at least one lost job is under its rerun bound and
  the attempt is still the run's latest.
- Retries are bounded per job. A job, followed across attempts by name, is
  re-run at most 3 times (`--max-job-reruns`). A separate ceiling stops all
  reruns once the run reaches attempt 8 (`--max-attempt`), so no run can
  loop. The job summary names every lost job either bound leaves red.
- Nothing happens unless the run's SHA is still current: the head of an open
  pull request for `pull_request` runs, the branch tip for `push` runs. A
  rerun of a superseded head's run re-enters the branch concurrency group and
  cancels the current head's run (observed 2026-09-30).
- Only lost jobs are re-run, one `gh run rerun --job <id>` per evaluation,
  starting with the lost job that has the fewest reruns. The command never
  uses `--failed`, so a job that failed for a real reason stays red. The job
  summary names it as left red.
- GitHub runs one job rerun per run at a time. Each rerun creates a new
  attempt, which copies the jobs it did not re-run under new ids and without
  their annotations. When that attempt completes, the next evaluation traces
  each copy back to its original by name and timestamps, then re-runs the
  next lost job. Three jobs lost in one attempt are re-run in attempts 2, 3
  and 4.

### Post-merge verification

Reruns chain from one attempt to the next. When one job has been re-run, the
remaining lost jobs are re-run only when the next attempt completes and
triggers another evaluation. That depends on a fact nobody has observed yet:
whether an attempt requested with the workflow's own `GITHUB_TOKEN` fires
`workflow_run: completed` when it finishes. On the first real eviction after
this lands on `main`:

1. Open the `Rerun Runner Loss` run for attempt N and note the job it re-ran.
2. When attempt N+1 of the same run completes, check
   `gh run list --workflow rerun-runner-loss.yml` for a new run. Its job
   summary should name attempt N+1.
3. If none appears, GitHub suppresses the event. Each run then gets one
   automatic rerun, and further losses fall to yeet monitor or an operator
   until the fallback lands.

The planned fallback (not implemented) is a `schedule:` trigger every 15
minutes that calls the same command for every `Check` and `Heavy Admit` run
that completed in the last hour. The command's gates already make repeated
evaluation of a run safe.

Every evaluation writes a job summary with the verdict, the reason, and each
failed job's id, runner name, loss verdict, prior reruns and action. Read it from the
`Rerun Runner Loss` run, or reproduce a decision locally without side effects:

```sh
bun run beep ci rerun-runner-loss --run-id <run-id> [--attempt <n>] --dry-run
```

The workflow runs default-branch code only. It never checks out the
triggering pull request, and its token carries `actions: write` plus read
access to checks, contents and pull requests, with no repository secrets.
Changes to the workflow take effect after they merge to `main`.

Disable it with the repository variable `BEEP_RERUN_RUNNER_LOSS=false`
(`gh variable set BEEP_RERUN_RUNNER_LOSS --body false`), or with
`gh workflow disable "Rerun Runner Loss"`. Either stops new evaluations at
once. Before re-running a job by hand, check the run's `run_attempt` so the
automatic rerun is not duplicated.

### Known gap: yeet monitor misses mid-job evictions

`detectGithubJobShapeClass` in
`packages/tooling/tool/cli/src/internal/github/JobShape.ts` classifies a job
as `runner-loss` only when *every* step has a null conclusion. A Spot eviction
in the middle of a job leaves the earlier steps (`Set up job`, checkout, setup)
at `success`, and only the running step and later steps at null. The rule
therefore does not match, and `yeet monitor`'s `runner-loss` fingerprint misses
these jobs. Evidence: run 36763005302 attempt 1, where Lint Policy, Coverage
Regression and Docgen were all lost after setup succeeded. The automatic rerun
above detects these jobs by annotation instead. Changing the shape rule is
tracked as a follow-up.

## Termination credential access

The pinned `github-aws-runners/github-runner/aws` v7.10.1 module grants its
termination roles `ssm:GetParameter` but does not forward `kms_key_arn` to the
termination watcher. With an externally managed customer-key-encrypted GitHub
App credential, deregistration therefore fails with `kms:Decrypt` denied.

`CiFleetController` owns six KMS grants, one per App parameter for each of
these existing Lambda roles:

- `beep-ci-spot-termination-notification`
- `beep-ci-spot-termination-handler`
- `beep-ci-deregister-retry`

Each grant allows only `Decrypt` on the configured GitHub App key with an exact
encryption context naming its App ID or App private-key parameter. It does not
grant access to the webhook secret, unrelated parameter contexts, or other keys.
KMS grants cannot enforce `kms:ViaService`: direct decryption of matching
parameter ciphertext is also permitted. The notification Lambda consumes
ordinary EC2 termination events, so this fix remains necessary on On-Demand.

The upstream module still owns the roles and its existing policies. Key grants
do not attach policies that could block the module from deleting a role. Each
grant name includes the immutable IAM role ID, forcing fresh grants if a role
is recreated under the same name. Lambda lookup and grant creation explicitly
use the controller region. Keep the grants until an upstream upgrade supplies
and validates equivalent access; do not hand-edit the generated SDK or broaden
runner workload identity.

## Deploy and verify

1. Refresh AWS identity, the source branch, the current fleet cap, and running
   jobs. Use the configured S3 Pulumi backend and production stack in
   `infra/ci-runners`.
2. For the existing `op://`-backed Pulumi env file, first test
   `op run --env-file=<path> -- true >/dev/null`. Use that same wrapper for
   Pulumi. Never print resolved credentials or export plaintext stack secrets.
3. Run `bun run beep quality package-verify @beep/infra`. Review a saved Pulumi
   preview: the purchase-model update and six narrow KMS grants are intended;
   unexpected network, security-boundary, AMI, cap, or deletion changes need
   separate attribution before apply.
4. Apply the reviewed plan with the operator attending. When migrating the
   initial three `github-app-ssm-decrypt` inline policies, create the six grants
   first with a saved plan that excludes those three policy URNs. Allow five
   minutes for KMS propagation,
   then remove only those three policies with the reviewed remaining apply.
   Inspect the live scale-up configuration for
   On-Demand and cap 14. Newly launched matching EC2 instances must have no Spot
   request ID. Let existing busy instances drain naturally.
5. Inspect `kms list-grants` for exactly the six intended principals, operations,
   and parameter contexts. IAM policy simulation does not evaluate KMS grants.
   Require successful real SSM decryption and natural termination/deregistration
   evidence after removing the initial policies.
6. Confirm a heavy verification job succeeds on a newly launched On-Demand
   runner. Re-read the target run and SHA before any failed-job rerun; do not
   replay superseded branches or healthy jobs.

This fixes Spot-specific interruption and the known cleanup permission defect.
Normal host, network, application, or timeout failures still require diagnosis.
The instance cap (14 in this September 9 procedure; two in source since
September 15, raised only by a time-boxed burst) limits concurrency, not a
monthly budget: billing continues
for each running VM until its ephemeral teardown completes.

## Deployment evidence — 2026-10-01 (Spot pool spread)

Source: `instance_allocation_strategy` `capacity-optimized`, eight 64 GiB
x86_64 instance types (`r7a.2xlarge`, `r7i.2xlarge`, `r6i.2xlarge`,
`r6a.2xlarge`, `m7a.4xlarge`, `m7i.4xlarge`, `m6a.4xlarge`, `m6i.4xlarge`), and
public subnets C, D and E in `us-east-1c`, `us-east-1d` and `us-east-1f`
(`10.88.32.0/20`, `10.88.48.0/20`, `10.88.64.0/20`) on the existing public
route table. Purchase model, the two-worker cap and the empty On-Demand
failover list are unchanged.

- Applied 2026-10-01 12:03–12:05 UTC from a clean `origin/main` checkout with a
  saved plan (`pulumi preview --diff --refresh --save-plan`, then
  `pulumi up --plan`), the operator confirming the reviewed preview first:
  6 created (three subnets, three route-table associations), 4 updated (AWS
  provider version, the runner module, the scale-up Lambda environment and a
  new launch-template version), 210 unchanged, no deletions or replacements.
- Pulumi's recorded state predated the 2026-09-15 containment, which had been
  applied as live Lambda edits. The preview therefore also showed On-Demand to
  Spot, cap 14 to 2, the failover list removal and
  `scale_up_reserved_concurrent_executions: 1`. Each was compared with the live
  Lambda configuration and concurrency before the apply and was already live;
  the apply only brought the state in line. Diff a preview against the live
  configuration, not against the state alone.
- A second `pulumi preview --refresh --expect-no-changes` reported 220
  unchanged resources.
- The apply resets `RUNNERS_MAXIMUM_COUNT` to the source value. A temporary
  burst cap that was live during the apply was re-applied afterwards with that
  burst's own `set-cap.sh`, after the no-drift check, and its restore guard was
  left in place.
- Live check after the apply: the scale-up Lambda environment carries
  `capacity-optimized`, `spot`, all eight types and five subnet ids; all five
  subnets are `available` and route `0.0.0.0/0` to the internet gateway.
- Job execution on the new pools, 12:05–12:45 UTC (the 40 minutes after the
  apply): 40 workers launched, all Spot, in all five zones — `r6a.2xlarge` 19
  (`us-east-1b` 13, `us-east-1a` 6), `m7i.4xlarge` 15 (`us-east-1c` 8,
  `us-east-1d` 6, `us-east-1f` 1), `m6a.4xlarge` 5 (`us-east-1a`),
  `r7a.2xlarge` 1 (`us-east-1b`). Each worker ran exactly one heavy job, in
  workflow runs 36853948319, 36856561977, 36856678457, 36856816907,
  36858959880, 36860910363, 36861577932 and 36862034113. At 12:50 UTC: 29
  succeeded, 3 were cancelled by a newer push, 6 were still running, 1 failed
  on its own output (`Heavy / Coverage Regression`, exit 1), and 1 was lost to
  a Spot eviction (`r6a.2xlarge` in `us-east-1a`, launched 12:17:57, evicted
  12:23:02, `Heavy / Coverage Regression` in run 36856561977).
- CloudTrail `BidEvictedEvent` count for the same window: 3. Two reclaimed
  workers launched before the apply; one reclaimed a worker launched after it.
  That is 1 eviction in 40 post-apply launches, against the baseline of 41 in
  564. The sample is 40 minutes and too small to call the rate; the two
  preceding hours had 22 evictions and 20 launches. Reproduce with
  `aws cloudtrail lookup-events --lookup-attributes
  AttributeKey=EventName,AttributeValue=BidEvictedEvent --start-time <t0>
  --end-time <t1>` and the launch list from `aws ec2 describe-instances`
  filtered on the `ghr:Application` tag and `LaunchTime`, joined to the
  Actions jobs API on `runner_name`. The dated launch-to-job record for this window is
  kept in [evidence/2026-10-01-spot-pool-spread-launches.md](./evidence/2026-10-01-spot-pool-spread-launches.md),
  because terminated-instance records expire.
- Open: repeat the reclaim count from "Attribute a runner loss" over the
  following days and compare with the baseline of 41 evictions per 564
  launches before deciding whether to shard the Coverage Regression and Lint
  Policy lanes.

## Deployment evidence — 2026-09-09

- Initial production apply: three IAM policies created, two controller resources
  updated, no deletions. The scale-up Lambda changed at 09:13:51 UTC and
  reported On-Demand capacity with cap 14.
- A second `pulumi preview --expect-no-changes` succeeded with 198 unchanged
  resources. Each deployed policy matched the reviewed plan exactly.
- IAM simulation against all three deployed roles allowed the intended
  SSM/KMS context and denied unrelated parameters, other keys, and direct KMS
  access: 12 expected results. CloudTrail then confirmed successful real
  `GetParameter` operations with decryption by the previously failing
  notification role; natural termination handling reached GitHub successfully.
- Fresh workers launched as On-Demand `r6i.2xlarge` instances. The standard
  [Fleet Shadow Check](https://github.com/beep-effect/beep-effect/actions/runs/34333728712)
  succeeded on a new worker. This is boot, registration, and job-execution
  proof; the separate
  [Heavy / Docgen verification job](https://github.com/beep-effect/beep-effect/actions/runs/34332600371/job/102408052217)
  also succeeded on a new On-Demand worker. The probe worker subsequently
  terminated, confirming ephemeral teardown still works.
- `bun run beep quality package-verify @beep/infra` passed audit and docgen.
  The mock regression now exercises a Pulumi-output region, On-Demand selection,
  the unchanged cap, all six exact grant scopes, immutable role IDs in grant
  names, and absence of external role policies.
- PR review identified the external-policy role-deletion hazard and ambient
  Lambda-region lookup. The source replaces those policies with six KMS grants
  and explicit regional lookups. The attended migration created six grants,
  verified their exact principals and contexts, allowed five minutes for
  propagation, and removed the three initial policies at 09:56:32 UTC. AWS
  confirmed all three policies were absent; the final
  `pulumi preview --expect-no-changes` reported 201 unchanged resources.
- At 09:57:25 UTC, after policy removal, CloudTrail recorded successful
  `GetParameter` reads with decryption and corresponding KMS `Decrypt` events
  for both App parameters by the notification role. The natural termination
  handler reached GitHub and confirmed the runner was already deregistered.
  This validates the replacement grants through real operations; the earlier
  IAM simulations describe only the initial policies.

At deployment, the AWS Price List API quoted $0.504/hour for `r6i.2xlarge`
Linux shared-tenancy On-Demand in `us-east-1`. The four allowed instance types
ranged up to $0.92736/hour, excluding disks and networking. Refresh pricing
before budgeting; the controller may choose any allowed type.
