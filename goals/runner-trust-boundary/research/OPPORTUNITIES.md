# Runner trust-boundary friction receipts

These receipts were captured during P1 and P2 on 2026-08-24 and P3 on
2026-08-25. They record
operational friction without expanding this packet's ownership.

## Bake identity was not discoverable

**What.** The first bake used the operator's default admin identity. The bake
actually requires IAM user `beep-ci-runner-launcher` with policies
`beep-ci-bake`, `beep-ci-launch`, and
`beep-ci-runner-launch-guardrails`.

**Evidence.** `ec2:RunInstances` returned `UnauthorizedOperation` with an
explicit identity-policy deny. The decoded result matched the unrelated
`LimitEC2Size` statement. It did not match the MFA statement, and the candidate
organization SCPs had no targets. Re-running through secret-manager injection
under the launcher identity succeeded.

**What would have prevented it.** `beep runners bake --plan` should print the
required launcher identity and policy set beside `requiredFlags`. The
hand-managed launcher policy set should move into fleet IaC.

## Bake network inputs were undocumented

**What.** `--subnet` and `--security-group` are required, but the production
resources were absent from the packet and runner command documentation.

**Evidence.** The operator had to resolve `beep-ci-runners-public-a`, CIDR
`10.88.0.0/20`, from `describe-subnets` and
`beep-ci-runner-workers` from the serving launch template. Resource ids are
retained only as `subnet-…` and `sg-…`.

**What would have prevented it.** Add a `--from-stack` mode that reads the
`beep-ci-runners` Pulumi outputs. Until then, keep the live-resolution recipe
in the P1 operator checklist.

## Red-team teardown was fleet-wide

**What.** Run `32760440289` overlapped heavy lanes from two unrelated pull
requests. The wrapper recorded every visible `beep-ci-*` runner and waited for
all of them to deregister.

**Evidence.** A concurrent heavy lane can run longer than the wrapper's 300s
limit, so the teardown verdict depended on jobs outside the run under test.
The proof also lacked an assertion that the executing instance used the newly
pinned image.

**What would have prevented it.** Recover the executing instance id from
`Runner instance-id:`, watch only the matching `beep-ci-<id>` runner, and
compare its image with an expected pin supplied by the operator.

## PASS accounting counted shell source

**What.** Run `32760440289` emitted one real PASS for each gate A through E,
but the wrapper reported that all five had the wrong count.

**Evidence.** `gh run view --log` includes the step's shell source. The fixed
string counter matched both `echo "GATE …: PASS"` and its emitted output. The
FAIL expression already had an end-of-line anchor.

**What would have prevented it.** Anchor PASS expressions to end-of-line and
add a parser fixture built from a captured `gh run view --log` transcript.

## Every main lockfile change re-stales the image

**What.** Bake #1 matched `abbe959d1e`, but `main` advanced to `7d4ce3434c`
before lane probe `32761137404`. The probe correctly rejected the stale image
and used full setup.

**Evidence.** Bake #1 carried lockfile digest `ee8762b6…`; the new `main`
digest was `f81ab29f…`. Bun `1.4.0` and archive digest `2d03fb5f…` still
matched. The setup summary reported `Baked fast path: false` on the bake #1
image.

**What would have prevented it.** Run `runners bake --check` after lockfile
changes merge and expose a visible stale-image signal. A merge-triggered or
scheduled re-bake would remove the current operator treadmill.

## The provenance guard refused an unpushed merge

**What.** After the branch merged `origin/main`, bake #2 refused merge commit
`10c82e7aa3` because no repository remote branch could reach it.

**Evidence.** The guard reported that the revision must be pushed before
baking. This is correct because the bake guest clones the named revision, but
it forced a choice between an early unverified push and another checkout. The
operator used a detached worktree at `origin/main` instead.

**What would have prevented it.** Document the remote-reachability guard in
`runners bake --plan` and offer `--revision origin/main` so an operator can key
the image to the base branch without creating a separate worktree.

## A re-pin left pre-flip runners eligible

**What.** Red-team run `32763386226`, dispatched about two minutes after deploy
#2, landed on a bake #1 instance still serving another pull request.

**Evidence.** Gates A through E passed, but `AMI_PIN` rejected the worker and
the wrapper returned `REDTEAM: FAIL`. At dispatch, six bake #1 instances still
shared the target label with new workers. GitHub may assign a queued job to any
matching registered runner.

**What would have prevented it.** Given the prior bake-report pin, the proof
script could wait for pre-flip instances to drain before dispatch. At minimum,
the operator recipe must state that drain precondition.

## Modify-action condition keys were mistaken for request values

**What.** The first P2 policy treated EC2 metadata-options condition keys as
requested values. For `ec2:ModifyInstanceMetadataOptions`, they describe the
target resource's current state, so the Allow could not authorize disable and
the boundary denied it.

**Evidence.** Two canaries failed own-disable with `UnauthorizedOperation`.
A throwaway role conditioned on current `enabled` authorized dry-runs for both
requested endpoint values; the same role conditioned on `disabled` authorized
neither. Access Analyzer separately rejected the module-style `aws:ARN`
condition key and a bare `${ec2:SourceInstanceARN}` resource while accepting
the `ArnEquals` shape.

**What would have prevented it.** Run Access Analyzer first for policy shape,
then probe ambiguous condition-key semantics with a throwaway role against a
disposable target before deploying any `Modify*` policy or boundary. The first
probe should vary requested values while holding resource state fixed.

## P2 fleet rollout lacked a canary boundary

**What.** Launch-template v10 made the fail-closed shim the fleet default at
`21:21:15Z`. The IAM edge was wrong, so every new worker powered off before
runner startup. At least 25 instances churned between `21:39Z` and `21:47Z`,
none of 51 registered runners was online, and Check runs for three unrelated
pull requests queued.

**Evidence.** Console capture showed the module reach "Starting the runner in
ephemeral mode" followed by `runner-start-failed with exit code 1` and guest
poweroff. The operator authorized a return to launch-template v9 under the
ratified posture; the default changed at `21:57:28Z`, and runners were online
again by `22:00Z`.

**What would have prevented it.** Give security-sensitive launch-template
changes a true canary runner class. Until that exists, use a short controlled
window: announce, deploy, dispatch one probe, capture `/dev/console`, and
restore the prior default unless the probe is clean. A scale-up tripwire should
also stop admission after repeated instance-initiated shutdowns soon after
launch.

## Terminated instances lose the applied metadata state

**What.** The first P2 verifier read metadata options after its worker had
terminated. EC2 returned endpoint `disabled` with state `pending`, so the
wrapper could not prove the one-way lock had reached `applied`.

**Evidence.** Every required red-team gate and `AMI_PIN` passed, but
`METADATA_DISABLED` failed on `disabled pending`. The next verifier resolved
the jobs-API runner name while the worker was alive and sampled
`disabled applied running`, followed by `disabled pending shutting-down` after
guest poweroff.

**What would have prevented it.** Resolve the executing instance from the
jobs API and sample image plus metadata state throughout the live run. Retain
an `applied` sample before teardown; never treat a terminated instance's
`pending` state as deployment evidence.

## The module's self-terminate policy has never matched

**What.** The pinned module's inline self-terminate statement uses `aws:ARN`,
which is not a supported condition key. The guest role cannot authorize its
`ec2:TerminateInstances` call through that statement.

**Evidence.** Access Analyzer flagged `aws:ARN`, and both canary work and the
module policy review confirmed the same condition shape. Observed termination
has come from controller scale-down and, after P2, guest poweroff with
instance-initiated shutdown behavior set to `terminate`.

**What would have prevented it.** Validate every generated inline policy with
Access Analyzer and add a live dry-run for intended self-scoped actions. The
module should replace the unsupported key or remove the dead statement if
external teardown remains authoritative.

## Installation permission acceptance was invisible until deploy

**What.** Adding `organization_self_hosted_runners` to the fleet-controller
GitHub App did not grant it to the organization installation; an
administrator must accept the pending permission request in the organization
UI. The first organization-registration deploy therefore failed on every
scale-up and rolled back.

**Evidence.** `GET /orgs/beep-effect/actions/runner-groups` returned
`403 Resource not accessible by integration` with
`x-accepted-github-permissions: organization_self_hosted_runners=read`, while
`gh api /orgs/beep-effect/installations` showed the permission absent on the
installation. The redeploy after acceptance changed nothing but the same
three resources and passed the probes.

**What would have prevented it.** A pre-deploy guard that reads the
installation's permissions through `/orgs/{org}/installations` and refuses
to enable organization registration until the required permission is present
on the installation, not only on the App. The redeploy script for this step
now carries that guard; it belongs in the fleet deploy command.

## Non-allowlisted dispatches still cost candidate launches

**What.** The controller launches one candidate per queued `workflow_job`
event before GitHub applies the group's workflow restriction, and its
`job_retry` setting (`max_attempts: 2`, `delay_in_seconds: 120`,
`delay_backoff: 2`) launches again while the job is still queued. A job the
group will never admit therefore costs up to three instances, each idling for
`minimum_running_time_in_minutes` before it terminates or takes an allowlisted
job.

**Evidence.** Negative probe run `32880025557` produced three launches: the
initial candidate at `17:48:47Z` and retries at `17:50:53Z` and `17:52:59Z`,
matching the retry schedule. The job stayed queued for five minutes
throughout. Two of the three candidates were absorbed by #810's allowlisted
jobs; the third idled to termination. Admission held; the launches were spent
regardless.

**What would have prevented it.** The scale-up lambda could resolve the
job's workflow reference from the event and skip launches whose reference is
outside the group's selected workflows. Until then, treat a repeated
out-of-allowlist dispatch as a cost signal in the fleet dashboard.

## Unresolvable-group failures churn a launch every fifteen seconds

**What.** When the controller cannot resolve its runner group, every queue
retry for a queued job launches a candidate, fails at the group lookup, and
terminates it. The failure is a configuration error, but the module treats it
like a transient one.

**Evidence.** The absent-group probe launched and terminated eleven candidates
for one queued job in two and a half minutes (`18:10:47Z` to `18:13:20Z`,
run `32882220360`), each with `Runner group beep-ec2-heavy-absent does not
exist`. The `05:19Z` permission incident had the same shape.

**What would have prevented it.** Resolve the group before `RunInstances`
rather than after, and treat a group-lookup error as non-retryable at the
configuration level: one alarm, no relaunch, until an operator changes the
deployment. Until the module offers that, treat sustained launch-and-terminate
churn with zero registrations as the signature of a group or permission
misconfiguration.
