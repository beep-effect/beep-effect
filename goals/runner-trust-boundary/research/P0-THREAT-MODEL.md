# P0 Threat Model

Snapshot: 2026-08-24. This model describes what is reachable **today** from
live GitHub and AWS observations plus the configured controller and pinned
module. The launch template, AMI pin, profile, role, boundary, inline policies,
repository runner count, and fleet instance state are live-verified in
`P0-FACTS.md`.

Property references below are the six required runner-class properties in
`SPEC.md`: property 1 keeps pull requests on EC2; property 2 removes usable
ambient application role credentials; property 3 removes recoverable
bootstrap/JIT credentials from every privilege level; property 4 seals
Bun/cache reuse; property 5 provides one job per fresh VM and teardown;
property 6 adds runner-group admission outside pull-request content.

## Present credential and persistence paths

| Actor or failure | Reachable today | Persistence today | Covering property and present gap |
| --- | --- | --- | --- |
| Ordinary `ec2-user` job process | A pull-request job receives its job-scoped, read-only GitHub token, checkout/workspace data, its processes, and writable restored user caches. Listed trusted-push secrets are withheld on pull requests. The job-start hook blocks this UID's IMDS token request when the hook is armed. | It can alter the current workspace and user caches for the life of the VM. Ephemeral registration and termination are intended to prevent a later job from observing them. | Properties 2 and 3. The ordinary path has a useful IMDS control, but the workload-identity phase still needs fresh proof that the hook is armed and no JIT material remains. Properties 4 and 5 bound cache and cross-job persistence. |
| Passwordless sudo from the runner user | Sudo reaches UID 0. Root can remove the owner-based firewall rule, inspect other processes and boot artifacts, and take the host IMDS path. The live profile is attached and the endpoint is enabled, so temporary instance-role credentials are reachable. The live role is narrow but includes bootstrap reads, tag operations, distribution read, and self-termination. | Root can install services, alter firewall and runner files, modify the root filesystem, and leave processes running until EC2 termination. It can retain any obtained temporary credential until expiry. | Properties 2 and 3 are not satisfied today. Passwordless sudo makes an ordinary UID rule defense in depth only. Property 5 is the final persistence cutoff, not a credential boundary. |
| Direct UID 0 execution | Same credential reach as sudo, without depending on the sudo transition. Root can inspect arguments, environment, memory-accessible process state, files, logs, and cloud-init artifacts for the one-use JIT material. The controller-side GitHub App private key and webhook secret are not delivered to the VM. | Root controls the host until termination and can attempt to preserve the active runner session, JIT residue, job token, or AWS session credentials. | Properties 2 and 3 require a boundary that still holds for root. Property 5 limits duration but cannot make credentials non-reachable during the job. |
| Privileged container | Docker-equivalent privilege can reach host namespaces and storage, manipulate host networking, and become host root. A privileged or host-mounted container can bypass the runner UID firewall and inspect host artifacts. | It can modify host files, start host-visible processes, and retain material for the VM's remaining life. | Properties 2 and 3. A container bridge plus hop limit 1 is not the accepted boundary because privileged execution can select host networking or alter namespaces. |
| Host-network process or container | It uses the host network path. IMDSv2 with hop limit 1 does not deny host access, and the owner rule applies only to `ec2-user`. Root or a root-equivalent container can request a token and role credentials while the endpoint remains enabled. | Any obtained AWS session lasts until expiry; host changes last until termination. | Properties 2 and 3. The accepted mechanism must remove the endpoint or the profile before untrusted code, not rely on hop count. |
| Stale runner registration or stale VM | JIT plus ephemeral mode is designed for one job, and the per-instance JIT parameter is deleted before runner start. If deregistration or termination stalls, the host still has its attached role path, modified filesystem, and root-launched persistence. A second normal job should not be assigned to a consumed JIT runner, but that is not proof the VM is harmless. | Persists until controller termination, self-termination, or AWS-side reaping succeeds. A stale online registration also widens accidental dispatch exposure. | Property 5. Property 6 prevents an unintended repository/workflow from selecting the runner but does not clean a stale host. Properties 2 and 3 must remain true even while teardown is delayed. |
| Mutable AMI, Bun binary, or cache | The controller has a pinned baked AMI configuration. The setup action verifies lock, Bun release, installed binary, and sealed cache digests plus root owner/mode before fast-path reuse. The action itself is PR-editable after checkout, and the restored user cache is writable within the job. | A malicious job can mutate its VM and user cache. A bad or mutable image source could reproduce compromise across new VMs until the pin changes. Direct edits to the setup action can suppress in-job claims but cannot change external bake evidence. | Property 4 requires fresh bake/pin evidence and externally checked root-owned artifacts. Property 5 ensures same-job mutations die with the VM. Property 6 cannot compensate for an unsealed image. |
| Incomplete deregistration or EC2 teardown | The module has ephemeral/JIT registration, termination watching, runner deregistration, self-termination permission, minute-scale controller cleanup, and root-volume deletion. The current capture has zero repository runners, zero active fleet instances, and 30 terminated fleet instances. A later path failure could still leave the profile, filesystem changes, resident processes, or registration alive. | Potentially continues until an AWS-side cleanup path succeeds or an operator intervenes. Temporary AWS credentials rotate while an accessible profile endpoint remains. | Property 5 still needs a fresh correlated registration-to-terminal-state proof. Properties 2 and 3 must make delayed teardown non-credentialed; property 6 must keep any stale registration inside the narrow admission set. |

## Load-bearing conclusions

1. The ordinary pull-request secret posture is narrow, but the machine is not
   non-privileged: passwordless sudo and Docker-equivalent root collapse the
   UID firewall boundary.
2. IMDSv2 plus hop limit 1 is a container-routing control, not a root or
   host-network credential boundary.
3. Deleting the SSM JIT parameter narrows replay, but property 3 also requires
   proof that no
   JIT configuration survives in process arguments, environment, files, or
   logs when the job begins.
4. SSM Session Manager is configured off. Parameter Store is still required
   by the present bootstrap, so "SSM disabled" must not be used to claim the
   guest has no AWS identity.
5. Fresh-VM teardown limits persistence only after it succeeds. The workload
   identity boundary must remain safe during a delayed or failed teardown.
6. Organization runner groups are a second admission boundary. The controller
   remains repository-scoped, although the current roster is drained to zero.

## Required negative proofs

The final deployed runner must test each perspective independently:

- ordinary `ec2-user`, sudo, direct UID 0, privileged container, and
  host-network container cannot obtain an IMDS document, role name, AWS
  credential, or successful `sts:GetCallerIdentity` result;
- no JIT payload or reusable GitHub registration credential appears in
  arguments, environment, `/proc`, files, logs, cloud-init data, swap, or the
  runner work directory when the first job step starts;
- a deliberate delay in deregistration/termination does not restore any
  credential path;
- Bun binary and sealed-cache digest, owner, and mode mismatches each reject
  fast-path reuse;
- one registration accepts one job, deregisters, and correlates to a terminal
  EC2 state;
- an absent or rejecting named runner group cannot silently produce a
  repository-level or `Default`-group runner.
