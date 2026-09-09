# Heavy CI runner reliability

The `beep-ec2-heavy` pool uses On-Demand EC2 capacity. The operator chose this
permanent posture on 2026-09-09 after repeated Spot reclamations interrupted
verification. Keep the 14-instance cap, 64 GiB instance choices, and ephemeral
one-job-per-VM teardown. Changing the purchase model does not require replacing
running workers; existing workers finish or are reclaimed and drain naturally.

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

On 2026-09-09, four workflows supplied nine distinct runner-loss examples.
Every matching Spot request reported capacity reclamation. A broader retained
fleet snapshot contained 30 such interruptions. GitHub marked these jobs failed
roughly 11 minutes after termination. This exceeded the former
`>2 interruption reruns/week` tripwire; returning this heavy pool to Spot needs
a new operator decision, not an automatic rollback timer.

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
The 14-instance cap limits concurrency, not a monthly budget: billing continues
for each running VM until its ephemeral teardown completes.

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
