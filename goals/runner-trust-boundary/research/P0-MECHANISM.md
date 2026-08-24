# P0 ratified mechanism

## Decision status

Status: **RATIFIED 2026-08-24**.

The operator ratified the bounded bootstrap role, pre-job IMDS disable,
default-branch reusable workflow, selected organization runner group, and
stop-and-drain rollback posture. The full question, option, pushback, and
rationale record is [`P0-GRILL.md`](./P0-GRILL.md).

Execution follows the phase order in `PLAN.md`: the standalone image baseline,
workload identity, admission, then complete boundary verification.

## Ratified mechanism: bounded bootstrap role, then hard-disable IMDS

This is the smallest change that can satisfy all six properties while keeping
the current controller/module architecture.

1. Keep `beep-ci-runner-profile` only for a root-owned bootstrap phase. The
   current role remains limited to one runner-distribution object, static
   runner configuration, per-instance JIT get/delete, self-tagging, tag
   description, and self-termination. Add only the self-disable operation
   described below.
2. Fetch JIT configuration into root-only tmpfs without shell interpolation or
   logging, then delete its SSM parameter. Do not start the runner yet.
3. A separate one-shot root helper uses only implicit role credentials to set
   the instance metadata HTTP endpoint to disabled, then exits so its SDK
   credential cache dies with it. Bootstrap waits fail-closed until IPv4 and
   IPv6 IMDS probes fail from the host. Only then start the runner, consume the
   JIT configuration for one registration, overwrite/unlink the buffer, and
   hold job admission until a root-owned pre-job check proves the JIT material
   absent from arguments, environment, process state, files, runner logs, and
   cloud-init output.
   AWS documents that disabling the endpoint prevents instance-metadata access;
   a running-instance change transitions through `pending`, so the probe must
   not trust the first API response alone. See
   [EC2 metadata options](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-options.html)
   and
   [`ModifyInstanceMetadataOptions`](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_ModifyInstanceMetadataOptions.html).
4. Add an allow on the role for `ec2:ModifyInstanceMetadataOptions`, scoped to
   `${ec2:SourceInstanceARN}` and
   `ec2:MetadataHttpEndpoint = disabled`. Add an explicit Deny in
   `beep-ci-fleet-boundary` for the same action when
   `ec2:MetadataHttpEndpoint` is anything other than `disabled`. The live role
   has no Modify grant today, while the live boundary's `ec2:*` ceiling has no
   matching Deny. Both edges are required and must pass dry-run proof.
5. Retain the `ec2-user` owner firewall rule as a second control. A job then has
   no usable route to the attached role even with sudo, UID 0, privileged
   containers, or host networking. The self-termination path moves to an
   external controller if bootstrap's final metadata disable makes the guest
   unable to call it.
6. After workload identity passes, move the five heavy pull-request lanes from
   `check.yml` into reusable `heavy.yml` on `main`. `check.yml` calls
   `beep-effect/beep-effect/.github/workflows/heavy.yml@main`.
7. Create organization group `beep-ec2-heavy` with public-repository access
   enabled, visibility `selected` for only `beep-effect/beep-effect`, and
   workflow restriction enabled for `heavy.yml`, `fleet-shadow-check.yml`, and
   `fleet-lane-probe.yml`, each at `refs/heads/main`. Register the controller
   at organization scope with the named group and no `Default` or repository
   fallback.

The only exceptional permission in this design is self-only metadata disable.
The role carries the narrow allow. The boundary carries the one-way Deny and
continues to cap drift; its broad EC2 ceiling does not itself grant the role an
action. AWS lists instance resources and metadata-option condition keys for
this API in the
[EC2 service authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_ec2.html).
Prove the exact allow and deny behavior with dry runs before deployment. If
the source-instance restriction or one-way disable cannot be proved in the
live policy set, this recommendation fails and Alternative 2 becomes
mandatory.

### Property fit

| SPEC property | Mechanism |
| --- | --- |
| 1. Pull requests stay on EC2 | Existing five heavy PR lanes keep `beep-ec2-heavy`. |
| 2. No usable ambient application role | The profile is boot-only in practice; the hypervisor metadata endpoint is disabled before job admission. |
| 3. No recoverable bootstrap/JIT credential | Root-only tmpfs delivery, parameter deletion, explicit scrubbing, one-use registration, helper exit, and pre-online residue probes. |
| 4. Sealed Bun/cache reuse | Fresh bake report pins the AMI and independently verifies digest, owner, and mode before the PR-editable action runs. |
| 5. Fresh VM and teardown | JIT ephemeral registration, one job per VM, external deregistration/termination watcher, root-volume deletion, and stale reaper. |
| 6. External runner-group boundary | Named organization group selects the public repository and the three default-branch workflows. The heavy job definitions live in reusable `heavy.yml`, outside PR-editable content. |

## Alternative 2: no guest instance profile

Launch the job VM with no instance profile and the metadata endpoint disabled.
Bake the runner distribution and static configuration into the sealed image.
The controller creates the JIT configuration and delivers it through a
one-use, nonce-bound bootstrap broker that authenticates the exact new VM
without AWS credentials in the guest. The broker marks the nonce spent before
the runner becomes online. Deregistration and termination stay controller-side.

This provides the clearest root boundary: there is no role attached and no
metadata endpoint to recover. It also changes more machinery and creates a new
broker identity, availability, replay, logging, and cleanup surface. This
alternative is mandatory if JIT cannot be delivered safely before IMDS
shutdown or if the live policy set cannot prove self-only, one-way metadata
disable.

## Rollout and rollback

1. Run the standalone `P1` fresh-image deployment proof before the bootstrap
   rewrite. This provides the hardened-image baseline and rehearses bake, pin,
   Gates A through E, deregistration, and teardown.
2. Build and pin the workload-identity candidate without changing the
   production label. Admit one operator-only probe runner and run the complete
   credential, residue, seal, lifecycle, deregistration, and teardown matrix.
3. A mechanical failure means the candidate cannot boot or register. A
   security-proof failure means any required gate fails. Either failure stops
   new fleet admission and terminates candidate instances. Heavy pull-request
   lanes queue until repair; they do not reroute to hosted runners.
4. Only after all workload-identity probes pass may `P3` apply the reusable
   workflow and organization-group admission controls.
5. Preserve the previous AMI pin and launch-template version for mechanical
   rollback. Restoring the current IMDS-enabled state requires an explicit
   operator command recorded as re-entry into a known-risk state. It is never
   a successful security rollback or an agent default.

## External proof plan

The proof must be generated outside pull-request-controlled job assertions:

- **Live AWS inventory:** capture the exact serving launch-template version,
  AMI, absence or bounded presence of the instance profile, role boundary and
  complete policy set, and applied metadata state. Redact identifiers in the
  retained report.
- **Root-boundary probe:** from ordinary, sudo, UID 0, privileged-container,
  and host-network contexts, require both IMDS endpoints and
  `sts:GetCallerIdentity` to fail. Assert the metadata change is applied, not
  merely pending.
- **JIT residue/replay:** inspect arguments, environment, `/proc`, logs,
  cloud-init data, temp storage, runner work data, and swap. Attempt reuse of
  the consumed JIT configuration and require rejection.
- **Seal:** use the fresh bake report to match the deployed AMI and independently
  verify Bun/cache digest, owner, and mode. Inject one mismatch at a time and
  require fast-path rejection.
- **Lifecycle:** correlate one GitHub registration to one VM and one job;
  require deregistration, root-volume deletion, and terminal EC2 state. Repeat
  with delayed teardown to prove the credential boundary remains closed.
- **Admission:** first prove live that GitHub accepts the selected reusable
  workflow at `refs/heads/main` for a caller running from a pull-request merge
  ref. Then read the named group through the organization API, prove the public
  selected repository and exact three workflow restrictions, prove fleet
  membership, and prove missing or rejected registration cannot fall back.

The existing five-gate red-team script remains a prerequisite, not the whole
`P2` proof. Its owner firewall test is retained as defense in depth; the added
root, privileged-container, host-network, JIT-residue, and live IAM assertions
carry the primary workload-boundary claim.
