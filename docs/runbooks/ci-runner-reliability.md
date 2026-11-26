# Heavy CI runner reliability

Account budgets, audit receipts and image refresh/retention policy are owned by
[AWS cost operations](./aws-cost-operations.md).

**September 15, 2026:** the current policy keeps AWS heavy CI available with a
two-worker cap and a $200/month account budget alert. Scale-up reserved concurrency
is 1, and the launch/retry queue mappings remain enabled. The earlier emergency
pause blocked PR job pickup and has been superseded. Follow the current policy
in AWS cost operations; the 14-worker deployment evidence below is historical.

**Fleet (2026-11):** heavy CI runs on the Alchemy `CiRunners` fleet
(`packages/tooling/infra/ci-runners`, stage `prod`), whose labels are
`beep-fleet-heavy` and `beep-fleet-overflow`. The runner groups keep their
older names (`beep-ec2-heavy`, `beep-shard-overflow`), so a label and its
group differ. The Pulumi fleet it replaced (`beep-ci-runners/production`) was
destroyed at cutover step 6 and its program left the repository with `infra/`
in P6 (cutover decision
`goals/infra-alchemy-rebuild/decisions/2026-11-14-ci-runners-cutover-from-pulumi.md`).
Pool instance types, caps and the Spot budget live in `src/Config.ts`; the
pools are listed in [Shard overflow pool](#shard-overflow-pool). The dated
deployment evidence sections at the end record the Pulumi fleet.

Keep 64 GiB instance choices and ephemeral one-job-per-VM teardown. A budget
alert does not enforce a monthly worker-hour limit. Diagnose interrupted jobs
before retrying; changing the alert does not change running workers.

## Admission and capacity

Admission bounds what enters the heavy pool's queue (`beep-fleet-heavy`); it
does not add capacity. Two workflows share one decision,
`bun run beep ci admission`: the `Heavy Admission` job in `check.yml` runs it
on every push (a pull request
enters the heavy matrix only with the `ready-for-heavy` label, or as a main
push / merge group; an unlabelled code PR holds outside the queue). A docs-only
diff from this repository skips the job before it requests a runner, and the
Heavy caller passes `admitted: false` straight from Change Profile so every
lane context reports without work. `heavy-admit.yml` runs the same job plus the
heavy caller when the label is applied, so labelling never cancels or re-runs
tier 1. On a same-repository
PR that carries the label, a later label re-reports: the base ruleset reads
only the newest Heavy Admit run's check suite, so a run that skipped would hide
the heavy checks. When the newest earlier Heavy Admit run on the head that
reported heavy lanes succeeded, the later run calls the heavy caller with
`admitted: false` and every lane is reported skipped without an EC2 runner,
provided that proof ran the same `heavy.yml` file the later run calls (the
same commit, or two commits whose `heavy.yml` blobs match; a lane main added
since never ran on the head) and every newer copy of those
lanes on the head (Check's own suite re-runs them on a reopened head) has
passed. Otherwise it skips, and `yeet merge-gate`, `yeet gh` and
`yeet gate-table` judge each hidden required check by its newest copy: a red
one stays `required-red`, a green one is `required-shadowed`. Optional checks
keep their newest run in any suite, so their reds still count. Fork admission
still needs the admission label event itself. Throughput is
still heavy duration times queue depth. Pool sizing — `runners_maximum_count`,
Spot versus On-Demand, the two-worker cap above — remains the operator's lever
and is unchanged by admission (time-to-certainty ruling 57).

## Documentation and planning changes

A PR confined to `docs/`, goal packet folders (`goals/<packet>/`),
`explorations/` and `research/` takes the shared documentation route
(`docs_only`). Markdown outside `packages/` and `apps/` takes it too,
including `standards/ARCHITECTURE.md` and `.changeset/*.md`. Goal diagrams,
attachments, prose and data files belong to that route. Root-level goal doctor
baselines, leases, promotions and compiler configuration keep verification,
because they are shared enforcement inputs rather than packet helpers. The
`standards/` tree is not exempt as a whole: its inventory JSON/JSONC and
configuration files can change verification.

Some files stay on the code route wherever they sit, including inside a docs
root (`ciCodeShapedPathPatterns`):

- JavaScript and TypeScript in every module variant. SAST, oxlint and
  effect-imports read them.
- Dependency manifests and lockfiles: every file GitHub's dependency graph recognizes
  (npm, Composer, Maven, Gradle, NuGet, pip, Poetry, RubyGems, Cargo, Go, pub, Swift, Bazel,
  OpenTofu and others). Dependency review and OSV read them.
- Tool configuration that repo-wide globs read: `tsconfig*.json`,
  `.gitignore`, `.gitattributes`, Biome, Turbo, docgen, `components.json` and
  oxlintrc files.

Goal paths that tests read, spawn or import (`ciGoalDataConsumers`) also stay on
the code route. A mixed PR with product code or CI configuration keeps full
verification, and missing or unreadable diff evidence never grants the
documentation exemption.

A `docs_only` pull request runs only the checks a documentation diff can fail:

| Job | What it checks |
| --- | --- |
| Repo Sanity (required) | `beep ci lane repo-sanity --docs-only`: the private home path law, the changeset graph, the changeset status and the skills lock (`beep skills update --check --offline`) |
| Docs Policy | The knowledge, packet and Markdown root tasks listed in `DocsPolicy.ts`, plus `knowledge doctor ci --base` |
| Secret Scanning, Commitlint | The commit range, as on every head |

Three more jobs allocate a runner because they run before the classification
exists or serve every pull request: Change Profile classifies the change, Test
Plan starts beside it (so a code pull request's test shards never wait one
more queue turn for a runner) and stops after its own classification, and PR
Size Label sets its label. Nothing else requests a runner. The required-context
aggregates (Lint, Test Unit, Property Laws, Heavy / Test Integration) and Heavy
Admission are skipped at job level once Change Profile has succeeded and
reported `docs_only` (the aggregates also need their shard matrix skipped and,
for the planned lanes, an empty plan from a successful Test Plan); GitHub
reports a job-level skip as a passing required check. On a code diff the
aggregates are skipped the same way when every job their script checks
succeeded and the shard matrix concluded `success` (skip on success,
2026-11-13), so a green run takes no aggregate runner after its last shard.
Any other state runs the aggregate, which fails closed. The heavy matrix is called with `admitted: false` and allocates no
runner, and Security, SAST, the code lanes and the test shards skip the same
way. Vercel Deploy is created on a pull request only when it changes an app
root the plan deploys (`pull_request.paths`), and Storybook is not created for
a pull request confined to `docs/`, `goals/`, `explorations/` and `research/`.
`packages/tooling/tool/cli/test/ci-docs-job-admission.test.ts` simulates the
job graph from the checked-in `if` expressions and fails if a documentation
diff requests any other runner. `packages/tooling/tool/cli/test/ci-docs-policy.test.ts` derives Docs
Policy's obligations from `turbo.json`: every root task whose inputs match a
docs-classified path, and every uncached root task, either runs in the lane or
has a written reason in `DOCS_POLICY_EXCLUSIONS`.

Repo Sanity is the one hosted owner of the skills lock check, on its
documentation path and its full path alike, because a `SKILL.md` edit is a
documentation diff. The check reads each skill's two installed targets
(`.claude/skills` and its `.agents` mirror), hashes them on the fly and requires
them to agree; it validates every `SKILL.md` frontmatter and the Codex skill
configuration; and it compares the set of skills and their targets with
`skills-lock.json`. The lock holds a content hash only where git cannot vouch
for the content by itself: the five vendored skills (upstream pin, patch series
and effective tree) and a skill refetched from a floating upstream. A
repo-authored skill's entry is its targets alone, so editing one never changes
the lock and two pull requests that edit the same skill do not conflict there. The
step passes `--offline`, so it reads tracked files only and takes about a
second: the plain check also refetches each floating upstream skill through the
unauthenticated GitHub API, which rate-limits shared runner addresses and would
turn an upstream push into a red on an unrelated pull request. Upstream drift
stays with the Skills Update Train and local `beep skills update --check`. On a pull request the job's
lane gate reads the `skills` row of the change-profile pattern data and passes
`--skip-skills-lock` when the diff touches none of its paths (skills, mirror,
patch series, lock, Codex configuration, the `skills` command, the
`@beep/ai-sync` schemas it decodes the lock with and the gate's own sources). Pushes, local replays and `yeet final-check` always run it.

On code pull requests, Change Profile also reports per-lane relevance
(`codegen_relevant`, `ecosystem_relevant`, `nix_relevant`,
`desktop_ipc_relevant`, `sast_relevant`, `security_relevant`) from the `lanes`
rows of the same pattern data. Each job's guard reads `!= 'false'`, so a pinned
binary that predates an output leaves the lane running. The jobs' own path gates
read the same rows with `jq` and `grep -E`. Every relevance lane runs when its gate
sources change: the lane bodies, the pattern data, `check.yml` and the shared setup
actions. Security, SAST and Codegen also run whenever the `@beep/repo-cli` workspace
closure changes. That closure implements their dispatch and GitHub policy reads, and
contains the driver generators' dependencies. A census test checks each lane's row
against the closure of the workspaces its job executes. Security's live-advisory and
GitHub-settings verdicts stay on every main push, because a push always gets
the full profile.

The schema-owned patterns in `CiOperational.schemas.ts`, their generated JSON
projection, the pre-install change profile and Yeet's publication classifier use
the same path policy. Regenerate the projection with `bun run beep ci patterns
--write` after changing that policy. A compiled CI binary reads the checkout's
projection, so a change to the pattern data does not need a new binary release.
A new output field (such as a new relevance lane) does, through a pin bump of
`.github/actions/fetch-beep-ci`.

## Attribute a runner loss

1. Read every relevant attempt with
   `gh api 'repos/beep-effect/beep-effect/actions/runs/<run-id>/jobs?filter=all&per_page=100'`.
   Follow pagination for larger runs. Record job, runner, step, and completion
   times; GitHub's latest attempt alone hides earlier runner losses.
2. Read the job's check annotations. A runner communication failure with an
   unfinished step identifies runner loss, not a source assertion.
3. Remove the pool's runner-name prefix to obtain the EC2 instance ID:
   `beep-fleet-heavy-` or `beep-fleet-ovf-` on the `CiRunners` fleet. Read
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

## GitHub release-download outages

`github.com/<repo>/releases/download` can return 504 for minutes while the
status page stays green and the REST API keeps working, as it did on 2026-11-08.
Jobs survive it through two fallbacks, each of which logs a `::warning::`:
`.github/actions/fetch-beep-ci` retries the pinned binary through the REST asset
route and still checks the pinned sha256, and `.github/actions/setup-bun` installs
the npm registry build and checks the registry's integrity value. Use the local
`setup-bun` action rather than `oven-sh/setup-bun` directly.

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

The `CiRunners` termination watcher roles read the GitHub App parameters
through an IAM inline policy that grants `kms:Decrypt` with a
`kms:EncryptionContext:PARAMETER_ARN` condition, owned by
`@beep/alchemy-github-runners`. The six KMS grants the Pulumi
`CiFleetController` carried for the upstream module are gone with that fleet
(decision D19, `KmsGrant` not needed).

## Shard overflow pool

The shard overflow pool (`goals/ci-lane-economics`, #3256) takes Test Unit
shards Test Plan routes away from a long hosted queue. It was built as a second
Pulumi `CiFleetController`; the `CiRunners` overflow pool took its place at
cutover step 4. The ordered enablement list, with its commands and the
disable path, is in
`goals/ci-lane-economics/research/shard-overflow-routing-2026-11-13.md`.

Since cutover step 4 the workflows target the `CiRunners` fleet
(`packages/tooling/infra/ci-runners`, stage `prod`). Its pools, from
`src/Config.ts` and `src/Names.ts`:

| | Heavy pool | Overflow pool |
| --- | --- | --- |
| Runner label (`runs-on`) | `beep-fleet-heavy` | `beep-fleet-overflow` |
| Runner group (unchanged) | `beep-ec2-heavy` | `beep-shard-overflow` |
| `ghr:environment` | `beep-fleet-prod-heavy` | `beep-fleet-prod-overflow` |
| Runner names | `beep-fleet-heavy-<instance-id>` | `beep-fleet-ovf-<instance-id>` |
| Scale-up function | `beep-fleet-prod-heavy-scale-up` | `beep-fleet-prod-overflow-scale-up` |
| Webhook | one function, `beep-fleet-prod-webhook`, behind a Lambda function URL (stack output `webhookUrl`) | the same function |
| App parameters | `/beep-fleet/prod/app/*` | the same parameters |
| IAM path | `/beep-fleet/prod/` | the same path |

Overflow routing reads its pool size from `BEEP_SHARD_OVERFLOW_POOL_SIZE`
(default 48). The `CiRunners` overflow pool's cap is 2 while the stack is in
`overlap` and 48 once it is `primary`.
`beep ci shard-overflow-preflight --webhook-url <url>` takes the stack's
`webhookUrl` and finds the group by its name, `beep-shard-overflow`, not by the
label.

### Webhook delivery

`workflow_job` events reach the fleet through one repository webhook,
714397446, on the function URL. Cutover step 6b (2026-11-26T03:35Z) deleted the
Pulumi controllers' two `execute-api` hooks, 663255260 (heavy) and 711445970
(overflow), and set the runner App's webhook (`beep-ci-fleet-controller`)
inactive. The App keeps minting installation tokens and JIT configs. The
missed-event check reads repository hook deliveries; an App's deliveries need
its JWT, which is why the App webhook was not moved to the function URL. The
plan is
`goals/infra-alchemy-rebuild/decisions/2026-11-25-ci-runners-6b-delete-execute-api-hooks.md`.

Neither pool's `ghr:environment` value may start with the other's. The termination watcher matches
instances whose `ghr:environment` tag starts with its own prefix, so an
overlapping prefix lets one pool's handler deregister the other pool's runners.

### After switching overflow on

The first overflow VM launch is the first proof that the scale-up function may
pass the runner role; nothing earlier exercises `iam:PassRole`. On the first run
that routes:

1. Test Plan logs `shard-overflow: routed; ...`.
2. The scale-up log shows the launch:

   ```sh
   aws logs filter-log-events --log-group-name /aws/lambda/beep-fleet-prod-overflow-scale-up \
     --start-time "$(( ($(date +%s) - 3600) * 1000 ))" \
     --filter-pattern '?"Created instance" ?"Create fleet" ?"PassRole"' \
     --query 'events[].message' --output text
   ```

   Expect `Created instance(s): i-...`. A `Create fleet request failed.` or
   `Create fleet did not create every requested instance.` line naming
   `iam:PassRole` means the scale-up role may not pass the runner role.
3. `Test Unit (<partition>) / Overflow` jobs run on `beep-fleet-ovf-*` runners,
   Coverage Regression finds their evidence, and `Test Unit` passes.

If the launch fails: `gh variable set BEEP_SHARD_OVERFLOW --body off`, cancel the
runs whose overflow jobs are still queued (a self-hosted job with no runner
waits rather than fails) and re-run them hosted, then compare the boundary's
runner role's path with the table above.

## Deploy and verify

The `CiRunners` stack deploys only through `.github/workflows/deploy-ci-runners.yml`:
a checked plan, then a deploy that applies the same plan object under the stage
lease. The procedure, the arm variables and plan-only runs are in
[Alchemy infrastructure](./alchemy-infra.md#ci-runners). Before merging a change
to the pools, run `bun run beep quality package-verify @beep/infra-ci-runners`
and read the plan rows: an unexpected network, IAM, AMI, cap or deletion change
needs its own attribution first.

The instance caps limit concurrency, not a monthly budget: billing continues
for each running VM until its ephemeral teardown completes.

## Deployment evidence — 2026-10-06 (drop `r6a.2xlarge`)

Source: PR #1422 removes `r6a.2xlarge` from `runnerInstanceTypes`, leaving
seven 64 GiB shapes across the same five subnets. On 2026-10-05, 20 of the
69 `r6a.2xlarge` launches ended `instance-terminated-no-capacity` across
`us-east-1a`, `1b` and `1d` while the other seven shapes lost 6 of 86.

- Applied 2026-10-06 02:21–02:22 UTC from a clean `main` checkout with a saved
  plan (`pulumi preview --diff --refresh --save-plan`, then
  `pulumi up --plan`): 2 updated (the runner module's `instance_types` and
  the scale-up Lambda environment), 218 unchanged, no creates, deletions or
  replacements. Duration 49 s.
- The preview also showed `RUNNERS_MAXIMUM_COUNT` 8 to 2 because an active
  burst cap was live as a Lambda edit. After the apply and the no-drift check
  (`pulumi preview --refresh --expect-no-changes`: 220 unchanged), the burst's
  own `set-cap.sh 8` restored the cap and its guard was left in place.
- Live check: the scale-up Lambda environment carries `capacity-optimized`,
  `spot`, and `INSTANCE_TYPES` `r7a.2xlarge,r7i.2xlarge,r6i.2xlarge,
  m7a.4xlarge,m7i.4xlarge,m6a.4xlarge,m6i.4xlarge`.
- Open: repeat the reclaim count over the following days against the
  2026-10-05 baseline of 26 `no-capacity` terminations in 155 launches.

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
