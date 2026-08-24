# P2 workload-identity evidence

Date: 2026-08-24

Status: complete; the two transferred workload-identity findings are
closure-ready and remain open

This record covers the failed rollout, controlled canaries, IAM condition-key
correction, deployed red-team proof, lane proof, and retained residuals for P2.
Identifiers follow the packet's public sanitization convention.

## Timeline

All times are UTC on 2026-08-24.

| Time | Event |
| --- | --- |
| `21:02:55Z` | Boundary v3 became the default. It was later proved to use the wrong condition-key semantics. |
| `21:21:15Z` | Launch-template v10 deployed the fail-closed runner shim fleet-wide. Every new worker failed before runner startup. |
| `21:35Z` onward | Check runs for three unrelated pull requests queued. At least 25 instances churned during `21:39Z` through `21:47Z`; none of 51 registered runners was online. |
| `21:57:28Z` | After explicit operator authorization, the launch-template default returned to v9 under the ratified stop-and-drain posture. Healthy workers returned by `22:00Z`. |
| `22:11:37Z` through `22:17:07Z` | Canary window 1 used diagnostic launch-template v11, captured the failed `aws:ARN` policy shape, then automatically restored v9. |
| `22:22:58Z` through `22:28:27Z` | Canary window 2 used launch-template v12, captured the failed `ArnEquals` plus `= disabled` shape, then automatically restored v9. |
| `22:24Z` through `22:29Z` | Access Analyzer and throwaway-role dry-runs established current-state semantics for the metadata-options condition keys. |
| Before `22:41:59Z` | Boundary v4 became the default with `DenyMetadataOptionsOnceDisabled`. |
| `22:41:59Z` | Launch-template v13 became the fleet default and latest version. |
| `22:43:30Z` | Canary 3 completed the one-way self-disable proof and started its runner. Launch-template v13 remained the default. |
| `22:55Z` | Red-team run `32786883010` produced the P2 proof of record. |

## Incident: launch-template v10 rollout loop

Boundary v3 and launch-template v10 used the metadata condition keys as if
they represented requested values. In fact, they represent the target
instance's current state for `ec2:ModifyInstanceMetadataOptions`. The v10 shim
therefore did what it was designed to do on a failed IAM edge: it refused to
start the runner, invoked guest poweroff, and terminated the candidate.

The fail-closed behavior prevented a credential-bearing runner from becoming
online, but fleet-wide deployment turned that safe local failure into an
availability incident. Every new worker reached the module's "Starting the
runner in ephemeral mode" line and then exited with
`runner-start-failed with exit code 1`. At least 25 instances churned between
`21:39Z` and `21:47Z`. The runner roster showed 0 of 51 registrations online,
and Check runs for three unrelated pull requests queued from about `21:35Z`.

The operator authorized restoration of launch-template v9, an IMDS-enabled
known-risk version, as required by the ratified posture. The default changed
at `21:57:28Z`; healthy instances appeared by `21:57:55Z`, and runners were
online again by `22:00Z`. Heavy lanes queued during the incident. They did not
move to hosted runners.

This incident established the operator recipe used for the remaining rollout:
announce a short canary window, deploy one candidate version, dispatch one
probe, capture console output, and automatically restore the prior default
unless the candidate is clean.

## Canary windows

### Window 1: launch-template v11

Window 1 ran from `22:11:37Z` through `22:17:07Z`. It added diagnostic console
logging around the module-style `aws:ARN` self condition. The decisive output
was:

```text
2026-08-24T22:12:45Z beep-imds-edges: IMDS_EDGE self_disable: FAIL (UnauthorizedOperation)
2026-08-24T22:12:45Z beep-imds-disable: final exit: status=1 reason=IMDS_EDGE self_disable failed (UnauthorizedOperation)
```

The helper failed closed and the window restored v9.

### Window 2: launch-template v12

Window 2 ran from `22:22:58Z` through `22:28:27Z`. It replaced `aws:ARN` with
`ArnEquals ec2:SourceInstanceARN` but still conditioned the Allow on
`ec2:MetadataHttpEndpoint = disabled`. The decisive output was:

```text
2026-08-24T22:24:09Z beep-imds-edges: IMDS_EDGE self_disable: FAIL (UnauthorizedOperation)
2026-08-24T22:24:09Z beep-imds-disable: final exit: status=1 reason=IMDS_EDGE self_disable failed (UnauthorizedOperation)
```

The helper again failed closed and the window restored v9.

### Window 3: launch-template v13

Boundary v4 and launch-template v13 implemented the corrected current-state
model. Canary run
[`32785914235`](https://github.com/beep-effect/beep-effect/actions/runs/32785914235)
launched its candidate at `22:42:25Z`. Its console recorded:

```text
2026-08-24T22:43:23Z beep-imds-edges: IMDS_EDGE self_disable: PASS
2026-08-24T22:43:24Z beep-imds-edges: IMDS_EDGE other_disable: INCONCLUSIVE (InvalidInstanceID.Malformed)
2026-08-24T22:43:25Z beep-imds-disable: disable request accepted; waiting for sustained host endpoint denial
2026-08-24T22:43:29Z beep-imds-disable: IMDS reachability: ipv4=false ipv6=false streak=5
2026-08-24T22:43:30Z beep-imds-edges: IMDS_EDGE self_reenable: PASS
2026-08-24T22:43:30Z beep-imds-edges: IMDS_EDGE self_redisable: PASS
2026-08-24T22:43:30Z beep-imds-disable: cached credentials discarded
2026-08-24T22:43:30Z beep-imds-disable: metadata-options lock proven; runner may start
```

The helper cached credentials before disabling IMDS, required five consecutive
IPv4 and IPv6 endpoint denials, proved that neither re-enable nor re-disable
was authorized after the state changed, discarded the credentials, and only
then started the runner. The canary was clean, so v13 remained the fleet
default.

## Condition-key semantics

Three probes corrected the original request-value model:

| Probe | Result |
| --- | --- |
| Live canaries | Both the module-style `aws:ARN` shape and the supported `ArnEquals ec2:SourceInstanceARN` shape failed self-disable while the policy required current state `disabled`. |
| IAM Access Analyzer | `aws:ARN` is unsupported, and a bare `${ec2:SourceInstanceARN}` resource is malformed. The `ArnEquals` condition shape produced no finding. |
| Throwaway role on an enabled instance | An Allow conditioned on `= disabled` rejected dry-runs for both requested endpoint values. An Allow conditioned on `= enabled` authorized both. The scratch roles were deleted after the probe. |

For `ec2:ModifyInstanceMetadataOptions`, the metadata endpoint, token, and PUT
hop-limit condition-key family describes current resource state. It does not
describe the requested change. The deployed identity policy is therefore
`DisableOwnMetadataEndpointWhileEnabled`: `ArnEquals` limits the target to the
source instance and `StringEquals` requires current endpoint state `enabled`.
Boundary v4 denies all metadata-options changes once current state is
`disabled`.

## Deployed IAM and launch state

- Managed policy `beep-ci-runner-imds-disable` contains only
  `DisableOwnMetadataEndpointWhileEnabled`, with self-scoping through
  `ArnEquals` and current endpoint state `enabled`.
- Boundary v4 contains `ServiceCeiling`, `PassOwnRoles`, `NoIamMutation`, and
  `DenyMetadataOptionsOnceDisabled`. Versions v1 through v4 remain available;
  v2 is the pre-P2 rollback target.
- Launch-template default and latest are both v13. Versions v9 through v12 are
  retained as the incident and canary lineage.
- SSM AMI-pin version 7 remains the serving sealed-image pin from P1.
- The Pulumi program on this branch created the managed policy and attachment,
  supplied the shim through module user data, and produced the deployed v13
  launch template.

## Proof of record

Red-team run
[`32786883010`](https://github.com/beep-effect/beep-effect/actions/runs/32786883010)
ran at `22:55Z` on launch-template v13. Every required gate emitted exactly one
PASS:

| Gate | Required claim | Result |
| --- | --- | --- |
| A `A_APP_SECRET_SSM` | Job code cannot read the GitHub App key or webhook secret. | One PASS |
| B `B_S3` | Job code cannot list buckets or write the distribution bucket. | One PASS |
| C `C_TAILNET_LAN` | Sampled tailnet and LAN targets remain unreachable. | One PASS |
| D `D_CONTAINER_IMDS` | An ordinary bridged container cannot obtain an IMDS token. | One PASS |
| E `E_RUNNER_IMDS_HOOK` | The runner-user IMDS hook still denies token access. | One PASS |
| F `F_ROOT_IMDS` | Root cannot obtain an IPv4 or IPv6 IMDS token. | One PASS |
| G `G_HOSTNET_CONTAINER_IMDS` | A host-network container cannot obtain an IPv4 or IPv6 IMDS token. | One PASS |
| H `H_PRIVILEGED_CONTAINER_IMDS` | A privileged host-network container cannot obtain an IPv4 or IPv6 IMDS token. | One PASS |
| I `I_ROOT_STS` | Root has no usable STS identity in normal or clean environments. | One PASS |
| J `J_HOOK_STILL_ARMED` | The secondary owner hook and IPv4/IPv6 DROP rules remain armed. | One PASS |
| L `L_IAM_EDGES` | Self-disable passes before disable; self-reenable and self-redisable are denied afterward. | One PASS |

The verifier recovered the assigned runner name through the jobs API and
mapped it to `i-…` while the worker was alive. Its state stream changed from:

```text
worker sample: ami-… disabled applied running
worker sample: ami-… disabled pending shutting-down
```

That live sample produced `AMI_PIN: PASS` and
`METADATA_DISABLED: PASS (disabled applied)`. Deregistration watched only the
executing runner; 83 stale offline registrations left by the rollout loop were
observed and ignored. The runner deregistered after 1 second, EC2 termination
was asserted after 1 second, and the wrapper ended with `REDTEAM: PASS`.

The earlier verifier attempt, run
[`32786113945`](https://github.com/beep-effect/beep-effect/actions/runs/32786113945),
had one PASS for each required gate and `AMI_PIN: PASS`, but it read metadata
only after the instance had terminated. It saw `disabled pending`, so
`METADATA_DISABLED` failed and the wrapper correctly ended with
`REDTEAM: FAIL`. Terminated and shutting-down instances report metadata state
`pending`; that is not evidence that the lock was unapplied. Sampling while
the worker is alive removed the ambiguity.

### Confirmation on the pushed head

After the branch head `1d8e2b5f6b` was pushed (its workflow carries the final
Gate L grammar, which also requires `self_redisable`), red-team run
[`32787722297`](https://github.com/beep-effect/beep-effect/actions/runs/32787722297)
(23:07Z) reported `REDTEAM: PASS`: Gates A through L each exactly one PASS,
`IMDS_EDGE self_disable`, `self_reenable`, and `self_redisable` PASS with
`other_disable` INCONCLUSIVE, `GATE AMI_PIN: PASS`, and
`GATE METADATA_DISABLED: PASS (disabled applied)` sampled while the worker was
alive, followed by scoped deregistration and EC2 termination.

## Lane probe

Lane probe
[`32786113766`](https://github.com/beep-effect/beep-effect/actions/runs/32786113766)
ran `test-integration` on a launch-template v13 worker and concluded success.
The job-start hook denied runner-user IMDS access before setup. The sealed fast
path then reported Bun `1.4.0` and lockfile digest `f81ab29f…`, followed by
`bun install --frozen-lockfile` under Bun `1.4.0`. Real lane work therefore ran
on a worker whose metadata endpoint was already locked.

The two acceptance workflows were dispatched concurrently. Their local
wrapper artifact names crossed the two run ids; the hosted job names and
workflow logs establish the roles recorded above.

## Residuals

### JIT argv residue remains open for P4

Informational probe K reported `JIT residue: visible` on both P2 red-team runs.
The pinned module passes its one-use JIT configuration in `--jitconfig`, so the
job user can read it from a surviving `/proc/*/cmdline`. The probe does not
print the value. Replay rejection is not yet proved. P4 owns the
operator-controlled replay attempt, scrub, and rejection record.

### Other-instance denial is inconclusive

`IMDS_EDGE other_disable` returned
`INCONCLUSIVE (InvalidInstanceID.Malformed)`. EC2 validated the disposable
target id before authorization, so the result cannot prove the other-instance
authorization edge. The self edge is still proved by `ArnEquals`, the live
self-disable, and the cached-credential post-disable denials.

### The module self-terminate statement is dead

The pinned module's inline self-terminate policy uses the unsupported
condition key `aws:ARN`. Guest self-termination through that statement has
never worked. Earlier termination came from the controller scale-down path;
P2 now also requests guest poweroff, which terminates the instance because the
launch template sets instance-initiated shutdown behavior to `terminate`.

## Closure-ready mapping

| Codex ID | Transferred finding | P2 evidence that satisfies it | State |
| --- | --- | --- | --- |
| `c799c2269d748191997ff176ce4bfd48` | CSF-005, "Shadow runner exposes AWS role creds to job code" | Current-state IAM probes plus canary 3 prove the self-only one-way transition. Run `32786883010` binds `disabled applied` while alive to Gates A, B, D, F, G, H, I, and L, then proves scoped deregistration and teardown. | Open; transferred — closure-ready |
| `33cd94a12d788191afbec1edc25c433f` | CSF-006, "Red-team gate misses sudo IMDS credential path" | Run `32786883010` adds root Gate F, host-network and privileged-container Gates G and H, root STS Gate I, retained-hook Gate J, live IAM-edge Gate L, and the external `disabled applied` sample. | Open; transferred — closure-ready |

These findings are closure-ready, **not closed**. They remain open through the
P5 remediation PR merge gate. P6 owns dashboard closure. The informational JIT
residue and operator replay probe remain P4 work and do not change that
dashboard sequencing.
