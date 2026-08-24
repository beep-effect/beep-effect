# P0 operator grill record

Date: 2026-08-24

Participants: operator and orchestrating agent

Status: ratified

This record closes the P0 grill gate. The answers below replace the open forks
in `P0-MECHANISM.md` and set the execution order in `PLAN.md`.

## Fork 1

Question as posed: **Posture for workload identity?**

Options offered:

1. Keep the permissions-boundary-capped instance role for root-owned bootstrap,
   then disable IMDS before job admission.
2. Remove the instance profile and use a controller-side, one-use bootstrap
   broker.

Ratified answer: option 1. Retain `beep-ci-runner-profile` only for a
root-owned bootstrap phase. A one-shot root helper calls
`ec2:ModifyInstanceMetadataOptions` on its own instance with
`HttpEndpoint=disabled`, then exits. Bootstrap waits fail-closed until host
probes for both IPv4 and IPv6 IMDS fail. Only then may the runner start.

The role allow must be limited to `${ec2:SourceInstanceARN}` and requests with
`ec2:MetadataHttpEndpoint = disabled`. The `beep-ci-fleet-boundary` must add an
explicit Deny for `ec2:ModifyInstanceMetadataOptions` when
`ec2:MetadataHttpEndpoint` is any value other than `disabled`.

Rationale: this keeps the existing controller and Parameter Store bootstrap
shape while removing the metadata credential path before untrusted code. The
guest consumes the one-use JIT configuration from root-only tmpfs, deletes its
parameter, scrubs local residue, disables IMDS, and sheds the helper's cached
credentials before registration.

Live facts used:

- The serving launch template attaches `beep-ci-runner-profile` and has IMDS
  enabled, IMDSv2 tokens required, hop limit 1, and instance metadata tags
  enabled.
- The profile has one boundary-capped role. Its five inline policies cover one
  distribution object, self-termination, self-tagging, tag reads, and narrow
  runner Parameter Store reads and deletion. It has no managed policies.
- The role grants no `ec2:ModifyInstanceMetadataOptions`, `ssm:StartSession`,
  or `sts:AssumeRole`.
- The boundary's `ServiceCeiling` permits `ec2:*`, but the boundary has no Deny
  for `ec2:ModifyInstanceMetadataOptions`.

Recorded pushback: the role lacks the required Modify allow, and the boundary
lacks the required one-way Deny. Both edges must be implemented and proved by
dry run. A broad `ec2:*` ceiling does not grant the role an action it does not
already have, but it also does not prevent a future role grant from re-enabling
IMDS.

Fallback: if the live policy set cannot prove one-way, self-only disable,
Alternative 2 becomes mandatory. The fallback launches with no instance
profile and uses a controller-side, nonce-bound, one-use broker.

Packet change: `P2` now owns the bootstrap role, root-only tmpfs JIT path,
one-shot helper, fail-closed IPv4/IPv6 wait, role allow, boundary Deny, dry-run
policy proof, and pre-job residue probe.

## Fork 2

Question as posed: **Admission posture and sequencing?**

Options offered:

1. Create an organization runner group restricted to a selected repository
   and selected reusable workflows, after workload identity is complete.
2. Use a thin organization group restricted to the repository but open to all
   workflows.
3. Defer admission controls.

Ratified answer: option 1. Create the `beep-ec2-heavy` organization runner
group after `P2` workload identity passes. Set
`allows_public_repositories: true`, visibility to `selected` with only
`beep-effect/beep-effect`, and `restricted_to_workflows: true`. Set
`selected_workflows` to these default-branch workflow references:

- `beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main`
- `beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main`
- `beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main`

Move the five heavy pull-request lanes from `check.yml` into the reusable
`heavy.yml`. The caller uses
`beep-effect/beep-effect/.github/workflows/heavy.yml@main`, so pull requests
cannot change the EC2 job definitions. Change the controller to organization
registration with `enable_organization_runners` and `runner_group_name`.
Registration must fail closed when the named group is absent or rejects the
runner. It must never fall back to `Default` or repository registration.

Rationale: selected-workflow admission is useful only when the job definition
runs from the protected default branch. The thin selected-repository variant
adds ceremony without preventing another repository workflow from targeting
the fleet. Deferring admission leaves the second boundary absent.

Live facts used:

- The repository runner endpoint reports `total_count: 0`; the earlier four
  active repository runners were a pre-drain observation.
- The current controller uses repository registration.
- The current classic token scopes are `gist`, `read:org`, `repo`, and
  `workflow`; they do not include `admin:org`.
- GitHub documents `restricted_to_workflows`, `selected_workflows`, and
  `allows_public_repositories` on organization runner groups. Classic tokens
  need `admin:org`; GitHub Apps need
  `organization_self_hosted_runners` permission.

Recorded pushback: GitHub matches `selected_workflows` against the ref from
which the workflow file runs. A restriction to
`check.yml@refs/heads/main` would reject pull-request runs because `check.yml`
runs from `refs/pull/N/merge`. `P3` must prove this behavior live before moving
the jobs. The reusable workflow keeps the EC2 job definitions on `main`.

Packet change: admission follows workload identity as `P3`. Its prerequisites
now name the required organization permission, reusable workflow, exact group
fields, live ref-matching probe, and fail-closed organization registration.

## Fork 3

Question as posed: **Rollback posture?**

Options offered:

1. Stop new admission, drain, and require an explicit operator command before
   restoring the prior launch-template version or AMI pin.
2. Automatically restore the current IMDS-enabled profile when rollout proof
   fails.
3. Reroute the heavy lanes to hosted runners.

Ratified answer: option 1. Any rollout-proof failure stops new fleet admission
and terminates candidate instances. Heavy pull-request lanes queue until the
fleet is repaired. There is no implicit hosted-runner route.

Keep the previous launch-template version and AMI pin for mechanical rollback.
Restoring the current IMDS-enabled state requires an explicit operator command
recorded as entry into a known-risk state. It is not a successful security
rollback and is never the agent default.

Rationale: a candidate that cannot boot or register is a mechanical failure.
A candidate that fails a security gate is a security-proof failure. Both stop
rollout, but the second cannot be declared repaired by restoring the known
credential path.

Live facts used:

- Launch-template version 8 and SSM AMI-pin version 5 provide retained
  mechanical rollback references.
- The serving metadata endpoint is enabled today.
- The current fleet is idle and its 30 captured instances are terminated, so
  the existing ephemeral teardown path is functioning at the capture point.
- Hosted heavy-lane trials failed twice with shutdown signals and exit 137.

Recorded pushback: "restore is status quo, not new risk." That is true as a
description of the present deployment. It does not make restoration a
successful security rollback. The packet records it as explicit re-entry into
the known-risk status quo.

Packet change: rollout text now distinguishes mechanical failure from
security-proof failure and makes stop, drain, candidate termination, queued
heavy lanes, and operator-only restoration mandatory.

## Fork 4

Question as posed: **P1&nbsp;timing?**

Options offered:

1. Run `P1` now as a standalone deployment proof before workload-identity work.
2. Combine `P1` with the workload-identity bootstrap rewrite.
3. Defer `P1` until the final boundary verification.

Ratified answer: option 1. `P1` starts now and remains separate from `P2`.

Rationale: the serving AMI pin was last modified on 2026-08-16, before PR #783
landed its hardening. On 2026-08-24, `beep runners bake --check` at
`abbe959d1e` reported `fresh: false`: expected Bun 1.4.0, actual Bun 1.3.14,
with both lockfile and Bun archive digests mismatched. The fleet's baked fast
path therefore falls back today. A standalone `P1` establishes Gates A through
E on the hardened image before the bootstrap rewrite, making a later red gate
attributable. It also rehearses the bake, pin, red-team, and teardown path. The
operator accepted one extra bake cycle.

Live facts used:

- Launch-template version 8 and SSM AMI-pin version 5 date to 2026-08-16.
- The bake check is stale for Bun version, lockfile digest, and archive digest.
- The fleet is drained at both the EC2 and repository-runner surfaces.

Packet change: `P1` status is `in progress`. The remaining order is P2 Workload
identity boundary, P3 Admission defense in depth, P4 Boundary verification,
P5 Yeet publish/review/merge gate, P6 Dashboard closure, and P7 Close.

## Assumptions to prove live

- The role and boundary can express and enforce self-only
  `ec2:ModifyInstanceMetadataOptions` with `HttpEndpoint=disabled`, including a
  Deny for every other endpoint value. IAM dry runs must prove the allow and
  deny edges before deployment.
- The metadata change reaches its applied state and host probes to IPv4 and
  IPv6 IMDS fail before runner startup. A pending API response is not proof.
- The helper exits before runner startup, and no cached AWS credential survives
  into a process, file, log, environment, or namespace reachable by job code.
- The JIT payload stays in root-only tmpfs, its Parameter Store value is
  deleted, the local buffer is scrubbed, and a pre-job residue and replay probe
  passes.
- GitHub accepts `heavy.yml@refs/heads/main` in `selected_workflows` for a
  pull-request caller at `refs/pull/N/merge`; prove the ref-matching behavior
  before refactoring `check.yml`.
- The operator grants `admin:org`, a fine-grained token with organization
  self-hosted-runner write, or the GitHub App permission before `P3`.
- The named group accepts the public selected repository and the three workflow
  references, and rejected or missing group registration cannot fall back.
- The `P1` image passes Gates A through E, fast-path integrity, deregistration,
  teardown, and the delayed-teardown probe before any later result is used as
  a workload-identity comparison.
- Mechanical restoration uses only the retained prior launch-template version
  and AMI pin, and can occur only through a separately recorded operator
  command.
