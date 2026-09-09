# AWS cost operations

Status: decisions locked; approved legacy cleanup executed September 9, 2026.
Cost controls and runner freshness changes are in implementation and validation.
This runbook owns the account cost policy and the single-PR implementation plan. [CI runner reliability](./ci-runner-reliability.md) owns
the fleet reliability configuration. Historical Spot and $100 budget guidance
must not override the decisions below.

## Decisions

| Question | Operator decision | Reason and rejected option |
| --- | --- | --- |
| Runner performance | Preserve current reliability and speed first. Keep the whole heavy pool On-Demand, 64 GiB choices, cap 14, ephemeral workers and existing teardown. | Smaller instances, less concurrency or lower throughput need measured proof first. Lowest price alone is insufficient. |
| Stored data | After reviewing the candidates, delete workload resources created before September 9, 2025, except hosted zones and domains. | This supersedes retaining the old EKS keys and unknown old backups. Refresh exact dependencies before execution. |
| Standard cost visibility | Add standard visibility and alerts. | No paid extended metrics, purchases or automatic resource changes. |
| VaultCtx | Retire the project; preserve its hosted zone and domain under the later cutoff exception. | The operator cancelled registrar renewal. Capture terminal receipts for the workload resources. |
| Monthly spend | $500 soft guardrail; revisit if performance needs more. | The operator rejected the proposed $750 initial guardrail. Budget alerts must not stop CI automatically. |

Approved alerts are actual spend of $250, $400 and $500, plus a forecast over
$500. Reuse the existing budget's recipient through protected configuration.
The operator's final cutoff rule locks the remaining retirement decision. The
seven 2022 customer KMS keys and old workload data are included. All hosted zones
and domains are excluded, including VaultCtx. Required account access and
AWS-managed encryption keys are outside workload-cost retirement; current CI
and OIP resources were created within the last year. No blanket IAM or default
network teardown follows from this cost policy.


## Audit scope and billing basis

The September 9 audit inspected the signed-in management account in all 17
enabled regions, plus global S3, CloudFront, WAF, Route 53 and Organizations
metadata. Regional inventories cover EC2, EBS, networking, load balancers,
databases, containers, filesystems and backup vaults. Service-specific follow-ups
cover encryption keys, stored versions, logs, AMIs and billed backup storage.

Cost Explorer grouped June through September usage by service, region, usage
type and linked account. The four member accounts had no charges in the August
through September query. Their resource inventories were not inspected through
assumed member-account roles. Empty resource results describe the time of the
query, not every historical resource. Stale tagging records for deleted NAT
and EKS resources were reconciled with direct service APIs.

Amounts below are USD UnblendedCost returned by Cost Explorer. September is an
estimated partial period with billing lag. Keep credits, refunds and tax
semantics explicit when comparing invoices or changing budget cost types.

| Period | Account cost | EC2 compute | EC2 other | KMS | WAF |
| --- | ---: | ---: | ---: | ---: | ---: |
| June 2026 | $44.22 | $7.49 | $1.14 | $21.32 | $8.00 |
| July 2026 | $43.71 | $7.74 | $1.14 | $20.95 | $8.00 |
| August 2026 | $522.10 | $454.78 | $24.25 | $22.39 | $8.00 |
| September 1–9, estimated | $133.62 | $114.01 | $6.64 | $6.32 | $2.12 |

The existing $100 budget was already in alarm. Its forecast predates a useful
sample of the September 9 On-Demand change. Do not use that Spot-dominated
forecast as a forecast of the new fleet. August recorded roughly 1,227 hours
of larger EC2 types. At the observed r6i.2xlarge rate of $0.504/hour, the same
hours would cost about $618 in compute alone. This is a scenario, not a workload
or invoice forecast: interrupted work, different CPU types, retries and demand
can change the number of hours. Cleanup alone cannot promise $500 at that
workload. Measure the new fleet before revisiting the guardrail.

## Findings and implementation order

| Priority | Finding | Proposed repair | Savings basis and performance boundary |
| --- | --- | --- | --- |
| 1 | Seven 2022 customer KMS keys remained enabled after their EKS workloads disappeared. Each had four rotations and zero grants. | All seven approved keys are now pending deletion with a 30-day window, ending October 9. The six restricted keys were scheduled through the existing Terraform administrator. | Approximately $21/month in key-storage charges cease while pending deletion. The active CI key remains Enabled. The operator accepted disposal of pre-cutoff historical data. |
| 1 | Heavy workflow assigns an EC2 runner before deciding a lane should skip. | Prototype trusted eligibility before allocation and run a bounded canary. Keep it disabled if hosted planning delays useful lanes; there is no existing pre-allocation planner to reuse. | A real Doctest job used an EC2 worker solely to skip. Boot time is additional. Measure saved launches and latency of eligible lanes. |
| 1 | All 20 sampled successful heavy jobs missed the baked setup fast path. Setup median was 74 seconds, range 72–110. | The CLI confirms mismatched Bun version, archive digest and lockfile digest. Refresh through the existing bake path, add a durable drift signal, and prove the fast path with a candidate canary. | Runtime saving remains unquantified until a matched comparison. Keep lockfile, Bun and archive-integrity checks. |
| 1 | Budget and cost attribution do not reflect the current fleet. Compute Optimizer enrollment is Failed; Cost Optimization Hub is unenrolled; no anomaly monitor exists; available allocation tags are inactive. | Import the existing budget into a separate account-controls component in the existing infra package, preserve its recipient and cost types, then apply the $500 alerts, account-only standard enrollment, ownership tags and anomaly detection. | Visibility prevents unobserved drift. No Savings Plan purchase, paid extended metrics or automatic rightsizing is proposed. |
| 2 | Historical guidance still prescribes Spot and a $100 upper bound. A retired teardown script can select an active AMI builder. | Add dated supersession notices, replace unsafe teardown guidance and publish current cost/retention procedures. | Prevents accidental reliability regressions and destructive cleanup. Historical evidence stays intact. |
| 2 | Pre-cutoff workload resources remained after their projects were abandoned. | Apply the operator cutoff to the reviewed exact inventory, refreshing ownership and dependencies before each action. | VaultCtx WAF removal eliminates about $8/month. Old data cleanup adds smaller storage savings. All hosted zones and domains, current CI and OIP state are preserved. |
| 3 | The On-Demand runner inputs retain a Spot allocation-strategy name. | The deployed v7.10.1 Lambda matches the pinned archive and normalizes the value to lowest-price. Align the source input with that effective behavior. | Configuration clarity only; no demonstrated savings or current launch defect. |

The no-op example is [Doctest job 102413512462](https://github.com/beep-effect/beep-effect/actions/runs/34335406225/job/102413512462).
It ran for 14 seconds on an EC2 runner, skipped setup and verification, and
executed the skip step. The 20-job setup sample consistently reported
`baked runner stale or failed integrity checks; using full setup`. The read-only CLI check subsequently confirmed that all three freshness
comparisons fail. The message alone did not establish artifact corruption.

## Preserve until measured or explicitly reviewed

- Current fleet purchase model, memory choices, cap, AMI pin, 150-minute reaper,
  cleanup KMS grants and immediate successful-job shutdown.
- Current gp3 100 GiB / 3,000 IOPS / 250 MiB/s. All August provisioned-throughput
  charges were $8.78; about a 1.93% increase in EC2 cost would erase that saving.
- Turbo cache's 30-day expiry and incomplete-upload cleanup, current 14-day
  operational logs, and cache-warm schedule pending hit-rate and runtime proof.
- Current and previous proven runner images, effective SSM/IaC image pins,
  launch-template references and active bake outputs.
- Pulumi backend state, historical versions and migration archives; OIP staging
  and production assets; active CI distribution/cache buckets.
- All hosted zones and domains, including VaultCtx. The explicit age rule
  included the old `assets.krieg.cloud` bucket despite 28,271 recent delivery
  requests, plus old Terraform/SST state and lock tables. Their retirement
  is deliberate disposal, not a claim that every resource had zero activity.

## Cost visibility design

The operator approved standard free Compute Optimizer and Cost Optimization Hub
features for this account. Compute Optimizer's EC2 recommendations require 30 cumulative hours
of metrics per instance. One-job runners do not accumulate that history, so
fleet decisions require lane-level runtime, CPU/memory and IO evidence grouped
by image and instance configuration. Do not buy extended lookback expecting
it to solve ephemeral runner measurement.

Use existing resource tags for billing attribution before adding a new tagging
scheme. Preserve the current budget definition, including tax and its exclusion of
credits/refunds, so the new guardrail does not silently change what it measures.
The existing budget has one recipient. Keep addresses and credentials in protected configuration;
committed examples use `op://` references. Preserve the budget's existing cost
types and recipients unless reviewed. Reconcile the existing budget rather
than creating duplicate alarms with conflicting thresholds. Alerts are
informational; no action can stop or terminate runners.

References: [Compute Optimizer FAQ](https://aws.amazon.com/compute-optimizer/faqs/),
[Compute Optimizer pricing](https://aws.amazon.com/compute-optimizer/pricing/),
[Cost Optimization Hub](https://aws.amazon.com/aws-cost-management/cost-optimization-hub/),
[AWS anomaly detection setup](https://docs.aws.amazon.com/cost-management/latest/userguide/getting-started-ad.html).

## Deletion review and recovery

The private audit contains exact resource identifiers, versions, tags, timestamps
and dependency findings. Public PR prose contains the rationale and sanitized
receipts. Approval of a plan is not an instruction to delete unlisted resources.
Before execution, refresh identity, region, resource state and ownership. Reject
new dependencies or changed candidates and return them for review.

For KMS, inspect current consumers, key policy/grants, aliases, regional storage,
S3 defaults and historical-version risks. A 90-day CloudTrail interval without
cryptographic calls supports inactivity but does not prove stored ciphertext
has no recovery value. Scheduling deletion makes a key unusable immediately;
a 30-day waiting period permits cancellation and re-enabling. After deletion,
remaining ciphertext is unrecoverable. Pending-deletion keys have no storage
charge, but cancelling restores charges for the waiting period. See
[AWS KMS pricing](https://aws.amazon.com/kms/pricing/) and
[AWS KMS deletion behavior](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html).

For images and snapshots, retain all effective references and at least one
proven rollback image. Confirm whether an image's old launch-template versions
are still intentionally supported. Deregister only an approved image and delete
only its approved, unshared snapshots. The September 9 cutoff authorizes the reviewed legacy inventory. Future
cleanup still resolves exact references and ownership; do not implement a
recurring blanket deletion job from this one-time decision.

For buckets, distinguish live objects, old versions, delete markers and
incomplete multipart uploads. The operator approved disposal of pre-cutoff state and assets in this audit.
Preserve current state and do not expire its versions through a generic cache rule.
For sites, remove dependencies in order only after the operator confirms the
site can be retired. Removing a WAF ACL from a live site is a security change,
not an idle-resource cleanup.

## Implementation boundaries

Use `AccountCostControls` in the existing infra package, composed beside the
fleet and cache with a dedicated `us-east-1` provider restricted to the intended
account. The installed provider supports budgets, allocation tags, both
enrollments and anomaly controls. Protect account controls against accidental
CI-stack deletion. Import the existing budget at its final parent/provider
address before changing its amount; an import must first match existing cloud
values. Suppress generated import code and keep subscriber outputs secret.

Adopt new component parents before importing their child providers. The first
bulk adoption passed preview but wrote an invalid checkpoint when Pulumi
registered the provider before its new parent. The pre-operation encrypted
export restored the checkpoint; separate component and provider/budget imports
then succeeded. Keep generated import files and state exports private.

The attended September 9 apply completed after adoption: ten account-control
creates and three updates, with 201 existing resources unchanged and no
replacements or deletions. The nested runner-module update changed only the
scale-up Lambda's allocation-strategy setting to `lowest-price`.

Use one daily anomaly email subscription with a $10 absolute-impact
threshold and the existing budget recipient. Activate only available useful
keys, initially `Project`, `App`, `ManagedBy`, `beep-ci`, `ghr:environment` and
`DataClass` where present. Enroll this account with member-account inclusion
disabled and verify that no paid preferences were already active. Delayed
recommendations or tag visibility are reported as pending evidence.

Cost Optimization Hub's member-account argument does not support drift
detection in the provider. This account returns null for it after account-only
enrollment. A refreshed preview therefore still proposes one Hub update after
the successful apply; all 213 other resources are unchanged. Omitting the
argument and narrowly ignoring its changes did not produce a clean refreshed
preview, so neither workaround is retained. Keep the explicit account-only
request and verify the actual enrolled-account list during each attended
rollout. This is a documented provider reconciliation limit, not proof of
changed enrollment or a clean no-change preview. Revisit it when the provider
supports this readback; do not repeatedly apply merely to clear the preview.

For image freshness, reuse the freshness fields of the existing `BakeReport`
as a tracked intended-image receipt. `infra/ci-runners/runner-image.json` now
records the September 9 Bun 1.4.2 bake and its intended production pin. It
supersedes the initial receipt copied from the stale Bun 1.4.0 image's tags.
The existing runner check compares that receipt with Bun,
archive and lockfile keys plus the intended Pulumi AMI pin without AWS access.
Emit an advisory warning in the existing hosted Repo Sanity job, outside the
heavy dependency chain. This warns about intended-image drift; the live AWS
check remains required after an attended rollout. The bake command creates an
image and report but does not activate it. Activation follows the existing YAML
AMI pin, attended Pulumi apply, controller SSM parameter and runner module.
Coalesce lockfile churn and measure bake payback rather than rebuilding for
every edit.

The September 9 refresh canary found that a fresh image's dependency-cache
archive made setup slower: 228 seconds versus 18 seconds for the existing
image's isolated fallback. A diagnostic guest spent 163 seconds hashing the
1.35 GB archive and 27 seconds extracting it, while a fresh frozen install
took 9 seconds on the baseline guest. Future bakes therefore omit dependency
archives. The setup fast path validates the baked Bun toolchain and clears
inherited dependency caches; each job performs its own frozen install. Bun's
release digest, installed-binary digest, root ownership, version and lockfile
checks remain required. Intended-image freshness alone is not a performance
receipt.

The modified setup path first passed on a fresh instance in 20 seconds, including
a 9-second frozen install, versus the isolated baseline's 18 seconds. Baking
without the archive then reduced the candidate's full snapshot data from
8.024 GiB to 2.350 GiB. The resulting image passed the same setup detector in
11 seconds, including a 9-second install, and confirmed that no dependency
archive exists. Its full Check lane passed all 246 tasks in 541 seconds.

These results remove the measured archive regression. They do not establish a
hosted speedup: GitHub cache/action overhead and a complete production workflow
remain part of the attended activation check. The final canary uses source
`b9b6faa5a2`, which includes the newer Check overlay fix from PR #1058. Its
541-second Check cannot be attributed to the image by comparison with the
739-second baseline on `a2030c8bd9`. The matched original candidate passed in
753 seconds on that earlier source. The final canary's peak VM-memory sample
was 11.61 GiB, sampled every 15 seconds; this is not sufficient evidence to
downsize every heavy lane.

Repair the retired teardown script so it cannot terminate builders or current
controller workers. Supersede historical Spot and $100 ceiling instructions at
their entry points, preserving dated experiment results. Add current image
retention and bounded-burst procedures that restore the current On-Demand
baseline, never an obsolete checkout's Spot settings.

Prototype no-op routing only within the existing trusted workflow and its
security tests. Invalid eligibility must select full verification or fail
visibly, never silently skip it. Preserve every required check context and
cache/fork permission boundary. A hosted preflight can add queue latency, so
keep the current production path if a matched canary does not preserve useful
lane completion time. Do not claim prototype savings before that proof.

## Approved VaultCtx retirement scope

The operator confirmed that VaultCtx is no longer needed and cancelled registrar
renewal. The private review identifies one CloudFront distribution with only
`static.vaultctx.com` as an alias, one associated WAF ACL, one S3 bucket, its
origin access control, an expired ACM certificate used only by that distribution,
and references inside the preserved `vaultctx.com` hosted zone. DNS contains only static-site aliases and
the certificate-validation record beyond its required NS/SOA records. DNSSEC is
not enabled. No Lambda@Edge associations or WAF logging destination were found.
The other CloudFront distribution and its certificate are separate.

The distribution was disabled and detached from WAF, deployment completed,
and the reviewed delivery resources were deleted. Its two delivery aliases
were removed; its hosted zone, NS/SOA and validation record remain.
The bucket inventory contains 87 current objects totaling 525,622,440 bytes,
no delete markers or version history, and one incomplete June 2025 upload.
Re-list before deletion and reject unexpected new data. Capture metadata and
terminal receipts privately. Cancellation of registrar renewal is an operator
statement; this task does not modify the registrar or close AWS accounts.

The fixed saving is approximately $8/month WAF. The hosted zone is preserved under
the operator's later exception. Storage adds a small variable amount; certificate and origin access
control removal are cleanup with no claimed fixed savings.

## Validation and release plan

1. Record the locked operator decisions and exact cleanup scope in this
   runbook. Keep all implementation and sanitized execution receipts in one PR.
2. Refresh the stale image with the existing bake command and add a durable
   freshness signal so Bun/lockfile drift cannot remain unnoticed. Bake and
   canary costs must be bounded and recorded; do not rebuild blindly on every
   lockfile change. Keep the production image pin change in the attended
   preview/apply path. Add focused tests for the behavior being changed.
   Candidate workflow routing must
   preserve all six required contexts, trusted reusable workflow code, correct
   fork/cache permissions and conservative handling of failed diff/planning.
3. Run affected package verification and the canonical Yeet path. A workflow
   PR calling `@main` does not exercise candidate reusable-workflow changes;
   run a bounded candidate canary and compare eligible-lane timings and results.
4. Generate and inspect a saved Pulumi preview. Require unchanged worker
   reliability settings and no unexpected worker replacements or data deletions.
   Cloud apply is attended, after the operator approves the concrete preview.
5. Apply only approved exact cleanup candidates. Capture terminal states and
   cancellation/recovery instructions. Never count already-deleted resources
   or AWS-managed keys as savings.
6. Verify budget notifications, enrollment and tagging state. Recommendation
   generation and billing attribution can lag; report that lag explicitly.
7. Publish through `bun run beep yeet publish --start-pr-early --monitor --pr`,
   address review comments and conflicts, and monitor the current PR head to
   `merge-ready: yes`. Do not merge.

Pre-allocation routing is deferred from production: the captured candidate
planning queues would have added 124 or 186 seconds before useful heavy work.
That fails the operator's speed-first condition. A future canary must demonstrate
net launch savings with unchanged useful-lane completion times before routing
changes land; this PR retains current lane admission.

The cost acceptance measures are cost per successful completed job, paid EC2
minutes, queue and lane wall time, runner losses, cache/image setup hits and
termination lag. Compare matched workloads; daily totals alone confound demand
with efficiency. A lower bill with failed or slower verification does not meet
the operator's performance decision.

## Purchase model and runner platform comparison

Spot and autoscaling are independent choices. The existing controller already
scales ephemeral EC2 workers with demand; an EC2 Auto Scaling group could use
either Spot or On-Demand capacity. EC2 Auto Scaling itself adds no service
fee, although its instances and supporting resources remain billable.
See [EC2 Auto Scaling pricing](https://aws.amazon.com/ec2/autoscaling/pricing/).

AWS Price List and EC2 Spot history reads on September 9 confirm Linux
`r6i.2xlarge` has 8 vCPUs and 64 GiB, with On-Demand pricing of $0.504/hour.
At 13:00 UTC, Spot prices in the fleet's two configured availability zones
were $0.2463/hour and $0.2073/hour: about 51–59% below On-Demand. These are
point-in-time prices, not a monthly quote or an interruption forecast.

For an illustrative 1,227 worker-hours, holding instance shape and hours
constant and using those observed prices:

| Platform and purchase choice | Illustrative compute and control-plane cost |
| --- | --- |
| Autoscaled EC2, On-Demand | About $618. |
| Autoscaled EC2, Spot | About $254–302 before any additional billable retry hours. |
| EKS with On-Demand EC2 workers | About $691 before other cluster costs. |
| EKS with Spot EC2 workers | About $327–375 before billable retries and other cluster costs. |

This is a comparison scenario, not the August invoice or a forecast. Worker
hours may change after moving to pods. EBS, network, controller/listener
capacity, image storage and operational overhead are excluded. EKS standard
support costs $0.10/cluster-hour, about $73 in a 730-hour month, in addition
to workers. That fee alone requires saving about 145 `r6i.2xlarge` hours per
month to break even against EC2. Extended support raises the cluster fee to
$0.60/hour. See [EKS pricing](https://aws.amazon.com/eks/pricing/).

An ECR image supplies the runner filesystem; it does not supply compute.
GitHub's Actions Runner Controller can create ephemeral runner pods from
container images. Pods on reclaimed Spot nodes still lose their running
work; pod recreation is not a checkpoint of an in-progress verification
command. Packing smaller lanes onto shared nodes can save capacity only
after measured CPU, memory, disk and concurrency requirements establish safe
allocations. Include Kubernetes overhead and a continuously available
controller/listener in that comparison. See
[Actions Runner Controller](https://docs.github.com/en/actions/concepts/runners/actions-runner-controller)
and [Spot interruption notices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-instance-termination-notices.html).

Interruption billing must distinguish elapsed work from billed usage. For
Linux excluding SUSE, an AWS-initiated Spot interruption during the first
instance hour incurs no instance-usage charge. User-initiated stop/termination
is billed for seconds used; AWS interruptions after the first hour are also
billed for seconds used. The distinction uses instance age and termination
initiator, not the verification step's elapsed time. EBS and other supporting
charges can remain. Do not multiply every interrupted minute by the Spot
rate: that overstates the compute cost of short AWS reclamations. See
[AWS interrupted-Spot billing](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/billing-for-interrupted-spot-instances.html).

The recorded interruption incidents establish a reliability problem, not
proof that Spot's total bill exceeded On-Demand. Compare actual billed attempt
minutes per successful lane, accounting for interruption waivers, setup,
retries and idle cleanup, alongside queue and completion times. Spot remains
the likely lower compute bill at the observed prices. The current decision
remains On-Demand because the operator prioritizes reliability and speed.
The next experiments are a fresh baked AMI and lane-specific resource
measurement. A hybrid Spot pool or EKS migration needs a separate measured
case that meets those same acceptance conditions; neither is deployed by
this cost-control PR.

## September 9 execution receipts

AWS accepted the initial approved retirements between 11:48 and 11:58 UTC,
then the remaining six KMS schedules between 13:15:46 and 13:15:55 UTC.
The private metadata inventory and action journal retain exact identities,
versions, timestamps and API results; no object contents were exported.

| Resource | Executed result | Cost claim |
| --- | --- | --- |
| 13 pre-cutoff S3 buckets | Deleted after comparing fresh versions and upload IDs with the reviewed inventory; 690 object versions/delete markers and 37 incomplete uploads removed. | Small storage/request savings; incomplete-part storage was not quantified. |
| Two retired CloudFront distributions | Disabled, deployment completed, then deleted. Three exact delivery aliases removed. | Variable request/transfer savings; no fixed amount claimed. |
| VaultCtx WAF, OAC and expired certificate | Deleted after detachment and dependency checks. | About $8/month WAF; no fixed certificate/OAC saving. |
| Two old Lambda functions and one lifecycle rule | Deleted, including the rule target. | No material compute saving established. |
| Seven old CloudWatch log groups | Deleted. | About 0.91 GB of reported stored data removed; invoice saving not yet measured. |
| Two empty ECR repositories | Deleted without force. | No image-storage saving claimed. |
| Two old Terraform lock tables | Deleted; subsequent table inventory is empty. | No observed charge to claim. |
| Four obsolete EBS snapshots | Deleted after verifying no owned AMI references or sharing. | All August snapshot charges were $0.91, including current images; do not assign the whole amount to cleanup. |
| One 2021 manual RDS final snapshot | Deleted. | Historical backup charge about $0.11/month. |
| Seven 2022 customer KMS keys | All verified PendingDeletion, with 30-day windows ending October 9. The six restricted keys used the existing `terraform-user` identity through operator-supplied secret references. | About $21/month in key-storage charges cease while pending deletion. Together with WAF, fixed-cost reductions are approximately $29/month; later billing will establish actual savings. |

The approved cost-control rollout completed at approximately 12:46 UTC. Direct
AWS reads verified the following after the successful saved-plan apply:

- The existing monthly budget is $500, with actual percentage thresholds at
  50/80/100 and a forecast threshold at 100. All four notifications retain the
  same existing recipient; cost semantics are preserved.
- All six selected cost-allocation tags are Active.
- Compute Optimizer is Active with no member accounts enrolled and no paid
  EC2 recommendation preferences. Cost Optimization Hub is Active for this
  account only. Recommendations and billing attribution still need collection
  time; enrollment itself is not a savings receipt.
- One service-dimension anomaly monitor and one daily subscription exist. The
  threshold is absolute impact greater than or equal to $10; its existing email
  recipient is CONFIRMED.
- The live scale-up Lambda retains On-Demand capacity, cap 14 and the same
  instance-type list, with `lowest-price` allocation. No worker was replaced.

An encrypted post-apply stack export passed the normal integrity check. Fresh
KMS preflight verified the six restricted keys' customer ownership, 2022
creation dates, zero grants and unchanged aliases before scheduling deletion.
The active CI key remains Enabled. This completed the approved old-key cleanup;
the fresh runner-image bake retains its separate launch-permission blocker.

The reported runner pickup incident was also checked against live GitHub and
AWS state. All 273 scale-up retry warnings in the captured 40-minute window
correlated with the existing 14-runner limit. After capacity freed, all six
heavy lanes in run 34354910245 acquired newly launched workers. Check, Test
Integration, Doctest and Docgen passed; Coverage Regression and Lint Policy
were still running at the initial recovery observation. The controller was
Active with successful updates and preserved the On-Demand settings. This
evidence identifies capacity waiting; it does not justify increasing the cap
or changing purchase type. Inspect organization-level runner registration,
queued jobs, current EC2 workers and scale-up reasons together: the repository
runner endpoint alone omits this organization-owned pool.

All four hosted zones remain. The 2026 certificate formerly used by the retired
asset distribution is preserved under the cutoff and has no base certificate
charge. The five current CI/OIP buckets, current runner images and snapshots,
current CI key, account identities and AWS-managed keys are preserved.

The stale image refresh exposed an unrelated old IAM policy on the operator
login: `FreedomFramework-CI` denies `RunInstances` for every size except
`t2.micro`. AWS rejected the original launch before creating a worker. After
the operator approved continuation, the September 9 16:08 UTC repair detached
only that policy from the operator user. The policy and its other attachment
remain, and every other operator attachment was verified unchanged. Reattaching
the retained policy restores the previous access configuration. No fleet role
was changed. A subsequent `r6i.2xlarge` bake launched successfully.

The image refresh follows a separate validation and activation sequence:

1. Bake from a pushed source revision using the existing command. Preserve the
   current production image as the rollback target and capture an encrypted
   production checkpoint before changing the pin.
2. Launch bounded probes from the current and candidate images on identical
   `r6i.2xlarge` instances with the production root-volume settings. Both use
   the same source revision, pinned Node archive, frozen Bun install and
   `bun run beep ci lane check --summarize`. Run the setup action's actual
   integrity detector: the current image must report a miss and the candidate
   must report a hit. Capture setup time, lane result and sampled VM memory.
3. Keep these probes isolated from GitHub runner registration and both GitHub
   and remote Turbo caches. Their setup measurements compare the image paths;
   they do not establish hosted queue time or account-wide savings. Each guest
   has a 40-minute shutdown backstop and a bounded verification command.
   Stop the guest, capture its terminal console marker, then terminate it and
   verify termination. Console output can lag shutdown and regress to an older
   capture; retain the most complete result and bound the capture wait. The
   September 9 final probe allowed 20 minutes after stop before cleanup.
4. Review the intended manifest, AMI pin and refreshed Pulumi preview. Apply
   the saved plan only with the operator present. Prove the live SSM pin and
   run the existing Fleet Lane Probe on a newly launched production worker.
   Require a baked fast-path hit and successful verification before calling
   activation validated. Retain the old image until rollback is no longer
   needed.

The September 9 replacement image is `ami-07af50c345b5ba065`, baked from pushed
source `b9b6faa5a2`; the rollback image is `ami-0738c1b69711969bc`. The isolated
probe passed and its guest and both builders were verified terminated. The
refreshed full preview contains only the intended SSM image update and the
previously documented Cost Optimization Hub provider discrepancy. The saved
image-only plan targets `ci-fleet-controller-runner-ami`: one update, 83 unchanged
resources, no replacements or deletions. It excludes the unrelated enrollment
update. The intended pin is committed for review; production activation and
the hosted Fleet Lane Probe still require the attended rollout. A passing
isolated probe does not establish that production uses the new image.

## Current stack ownership and bounded operations

| Stack | Ownership | Cost treatment |
| --- | --- | --- |
| CI production, `infra/ci-runners` | AWS fleet, network, cache; account controls composed alongside them. | Preserve reliability; account controls are protected against stack deletion. |
| OIP staging/production, `infra/oip-web` | Vercel hosting, Cloudflare DNS, AWS S3 assets/state. | Current resources retained; `opip-web` is a historical state namespace, not proof of abandonment. |
| Storybook | Vercel deployment and shared CI/cache usage. | No dedicated AWS compute service found. |
| OpenClaw workstation | Local generation applicator and managed workstation services. | Outside AWS workload retirement. |

A temporary controller cap increase requires measured queued demand, a named
operator, an expiry, the exact incremental cost envelope and a tested restore
path before apply. Capture account, region, stack, source revision and live cap.
Preview only the intended cap change and restore the captured current baseline
(14 at this audit); let jobs drain. Never restore an obsolete checkout's Spot
configuration or change the 150-minute reaper to enforce a budget. The retired
manual-burst teardown entry point now exits without AWS or GitHub mutations.

Post-retirement service reads confirmed five current buckets, four hosted
zones, three owned runner images and three associated snapshots. No CloudFront
distributions, WAF ACLs, old DynamoDB tables or manual RDS snapshots remain in
the audited account. The current CI encryption key remains Enabled.

Refresh the tracked receipt through the existing bake path with
`--report infra/ci-runners/runner-image.json`. Review and update the corresponding
`ciFleetController:amiId` only after the image and canary are proven; apply the
saved Pulumi plan with the operator present. Then run the live
`bun run beep runners bake --check --region us-east-1` in addition to the
AWS-free manifest check. A matching intended manifest never proves deployment.
