# P1 shadow acceptance evidence

## One-job-one-VM lifecycle: PROVEN

Probe run `31352410248`, 2026-08-10. A controller-born ephemeral worker served
the shadow label and destroyed itself, with no manual burst worker involved.

| Moment | Timestamp (UTC) | Evidence |
| --- | --- | --- |
| Instance launch | 03:22:29 | `i-0e744ce051807b2cc`, spot lifecycle |
| Job start | 03:23:46 | runner `beep-ci-i-0e744ce051807b2cc`, label `beep-ec2-heavy-shadow` |
| Job complete | 03:23:49 | conclusion `success` |
| Termination initiated | 03:23:59 | `Client.UserInitiatedShutdown` |

Birth to self-destruction: **90 seconds**. Teardown lag after the job ended:
**10 seconds**, against a 5-minute acceptance ceiling.

Worker identity from the job log confirms the AL2023 fix landed:

```text
Distribution: Amazon Linux release 2023.12.20260803 (Amazon Linux)
Linux ip-10-88-0-175.ec2.internal 6.1.177-224.371.amzn2023.x86_64 ... x86_64
Mem: 30 (GB)
shadow probe OK
```

The runner roster afterwards holds zero non-burst runners: the JIT registration
was consumed and deregistered, leaving no orphan.

### Third defect: run_as outlived the OS switch

`runner_run_as` was `ubuntu`, set when the controller still pointed at the
Ubuntu AMI. On AL2023 there is no `ubuntu` account, so the boot script's final
step — `sudo -u "$run_as" ./run.sh --jitconfig` — could not execute.

The tell was in VPC flow logs, not any application log: the worker opened
sustained HTTPS to S3 (`52.216.*`, `52.217.*`) and SSM, and **zero** connections
to GitHub. Tarball download and config fetch both succeeded; the agent never
started. Fixed to `ec2-user`.


Static evidence gathered from live AWS state on 2026-08-10, before the live
red-team dispatch. The workflow gates prove the same properties from inside a
running worker; this file records what the control plane already guarantees.

## Two defects found and fixed during acceptance

### Permissions boundary blocked every launch

`beep-ci-fleet-boundary` v1 allowed `iam:PassRole` on
`arn:aws:iam::*:role/*gha*`, but the module names its runner role
`beep-ci/beep-ci-runner-84212b72`. Every `CreateFleet` call failed:

```text
UnauthorizedOperation ... is not authorized to perform: iam:PassRole on resource:
arn:aws:iam::832907639880:role/beep-ci/beep-ci-runner-84212b72 because no
permissions boundary allows the iam:PassRole action
```

Symptom: probe run 31299650184 sat queued for roughly 20 hours with zero
instances. Fix: boundary v2 scopes `iam:PassRole` to
`arn:aws:iam::832907639880:role/beep-ci/beep-ci-*` with an
`iam:PassedToService: ec2.amazonaws.com` condition — strictly tighter than v1.
v1 remains available for rollback.

### Controller inherited the burst fleet's Ubuntu AMI

`ci-runners-entry.ts` passed `stack.resolvedAmiId` (Ubuntu 24.04, correct for
the manual burst fleet) into the controller, but the pinned module's default
user-data is Amazon Linux 2023: `install_with_retry()` calls `dnf install -y`
unconditionally. On Ubuntu the package step never succeeds, the script never
reaches the JIT-config SSM pull, no runner registers, and scale-down reaps the
instance at the boot timeout.

Evidence: instance `i-0533baf5ee9a2a6d1` launched 02:53:12Z, terminated
02:58:34Z (`Client.UserInitiatedShutdown`), never online. Fix: the controller
resolves its own AMI from
`/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`. The
burst fleet keeps Ubuntu until the P4 baked AMI unifies both fleets.

## Runner role scope

Role `beep-ci-runner-84212b72` carries five inline policies. The two that
matter for the trust gates:

| Policy | Scope |
| --- | --- |
| `runner-ssm-parameters` | `/github-action-runners/beep-ci/runners/tokens/*` and `.../runners/config*` only |
| `distribution-bucket` | `s3:GetObject` on one object: the runner tarball |

The GitHub App secrets live at `/github-action-runners/app/*`, which no runner
policy names — so Gate A (App-secret denial) and Gate B (S3 denial) are
expected to pass by policy construction, not by luck.

## East-west isolation

Worker security group `sg-0ec4816fcd2af2d4b` has **zero ingress rules** and
five egress rules. No inbound path exists to a worker from anywhere, including
other workers.

**Gotcha:** workflow Gate C curls `100.100.100.100`, `192.168.1.1`, and
`10.0.0.1`. That proves no tailnet or home-LAN bridge, which is worth having,
but `10.0.0.1` is outside this VPC's `10.88.0.0/16` — a connection failure
there is not evidence of intra-VPC isolation. The empty ingress list above is
the real east-west control. Do not let the green gate overstate its reach.

## Live red-team gates: PASS

Red-team run `31354960508`, dispatched against `feat/ci-fleet-redteam` with
`redteam=true`, concluded `success`. All three gates passed on runner
`beep-ci-i-042d5d6635358917a` (instance `i-042d5d6635358917a`).

| Gate | Result | Live worker evidence |
| --- | --- | --- |
| A — GitHub App secrets | PASS | `DENIED AS EXPECTED` for both `/github-action-runners/app/github_app_key_base64` and `/github-action-runners/app/github_app_webhook_secret` |
| B — S3 | PASS | `DENIED AS EXPECTED` for `list-buckets` |
| C — tailnet and LAN reachability | PASS | `DENIED AS EXPECTED` for `100.100.100.100`, `192.168.1.1`, and `10.0.0.1` |

Gate B returned the expected identity-policy denial:

```text
An error occurred (AccessDenied) when calling the ListBuckets operation: User:
arn:aws:sts::832907639880:assumed-role/beep-ci-runner-84212b72/i-042d5d6635358917a is not
authorized to perform: s3:ListAllMyBuckets because no identity-based policy allows the
s3:ListAllMyBuckets action
```

Gate C proves that the worker has no tailnet or LAN bridge. It does **not**
prove intra-VPC isolation: `10.0.0.1` is outside this VPC's `10.88.0.0/16`.
The worker security group's empty ingress list remains the real east-west
control.
