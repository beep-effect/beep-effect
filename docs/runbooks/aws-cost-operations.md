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
| 1 | Seven 2022 customer KMS keys remain enabled after their EKS workloads disappeared. Each has four rotations and zero grants. | Retire the exact approved keys using a 30-day pending-deletion period. One is scheduled; six require the existing Terraform administrator. | Approximately $21/month total at current pricing: $3/month scheduled and $18/month blocked. Preserve the active CI key. The operator accepted disposal of pre-cutoff historical data. |
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

The initial Pulumi preview contains 13 logical creates and two updates, with
no replacements or deletions. A separate budget-adoption preview imports the
existing budget and component and registers one provider; 201 existing resources
are unchanged. These previews do not mean the controls have been applied.

Use one daily anomaly email subscription with a $10 absolute-impact
threshold and the existing budget recipient. Activate only available useful
keys, initially `Project`, `App`, `ManagedBy`, `beep-ci`, `ghr:environment` and
`DataClass` where present. Enroll this account with member-account inclusion
disabled and verify that no paid preferences were already active. Delayed
recommendations or tag visibility are reported as pending evidence.

For image freshness, reuse the existing `BakeReport` as a tracked intended-image
receipt. Extend the existing runner check to compare that receipt with Bun,
archive and lockfile keys plus the intended Pulumi AMI pin without AWS access.
Emit an advisory warning in the existing hosted Repo Sanity job, outside the
heavy dependency chain. This warns about intended-image drift; the live AWS
check remains required after an attended rollout. The bake command creates an
image and report but does not activate it. Activation follows the existing YAML
AMI pin, attended Pulumi apply, controller SSM parameter and runner module.
Coalesce lockfile churn and measure bake payback rather than rebuilding for
every edit.

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

## September 9 execution receipts

AWS accepted the following approved retirements between 11:48 and 11:58 UTC.
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
| One 2022 customer KMS key | Pending deletion, 30 days, scheduled completion October 9. | About $3/month storage charges cease while pending deletion. |
| Six 2022 customer KMS keys | Blocked; their resource policies designate `terraform-user` as sole administrator. | About $18/month remains an opportunity, not realized savings. |

All four hosted zones remain. The 2026 certificate formerly used by the retired
asset distribution is preserved under the cutoff and has no base certificate
charge. The five current CI/OIP buckets, current runner images and snapshots,
current CI key, account identities and AWS-managed keys are preserved.

The stale image refresh exposed an unrelated old IAM policy on the current
operator login: `FreedomFramework-CI` denies `RunInstances` for every size except
`t2.micro`. AWS rejected the launch before creating a worker. The policy is not
owned by the CI stack; any access repair requires the operator's explicit
decision. Do not weaken a fleet role or attempt the bake on an undersized VM.

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
