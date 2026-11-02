# P8 state audit, 2026-11-02

Read-only re-reading of the deployed runner class two months after P8
reopened, plus one live A-through-L red team on `main`. Sanitized: no
account ids, credentials, or JIT values.

## Deployed state (read 07:55Z to 07:58Z)

| Surface | Reading | Packet expectation | Verdict |
| --- | --- | --- | --- |
| Launch template `beep-ci-action-runner` | default and latest v14 (created 2026-10-01), `HttpEndpoint: enabled`, `HttpTokens: required`, hop limit 1, shutdown `terminate`, profile `beep-ci-runner-profile`, image `resolve:ssm` of the serving pin | v13 in P4; v14 is the 2026-10-01 Spot-pool spread (#1364), metadata and shutdown unchanged | matches |
| Serving AMI pin `/beep-ci/controller/runner-ami-id` | version 8 (2026-09-09), `ami-07af50c345b5ba065` | P4 served version 7; version 8 is the #1062 refresh | matches source |
| Live workers (8, burst) | all on the serving pin; 7 `disabled applied` at first read; the 8th was `enabled` 20 s after launch and `disabled applied` and busy 45 s later | IMDS disabled before the runner accepts a job | matches |
| Boundary `beep-ci-fleet-boundary` | v4, `DenyMetadataOptionsOnceDisabled` on current state `disabled` | v4 | matches |
| Disable policy `beep-ci-runner-imds-disable` | v3, self-only `ArnEquals ec2:SourceInstanceARN` on current state `enabled`; byte-equal to `infra/src/CiFleetController.ts` from #800 | P2 design | matches |
| Runner role attachments | only `beep-ci-runner-imds-disable` | no application permissions | matches |
| Runner group 4 `beep-ec2-heavy` | `visibility: selected`, public repositories allowed, `restricted_to_workflows: true`, selected `heavy.yml`, `fleet-shadow-check.yml`, `fleet-lane-probe.yml`, `cache-warm.yml`, each `@refs/heads/main` | P3 listed `check.yml` for the push-only Build job | narrower: #1064 moved Build into `heavy.yml`; `cache-warm.yml` is dispatch and schedule only on `main` |
| Repository-scoped runners | 0 | 74 inert pre-cutover registrations in P4 | cleaned |
| Reaper `beep-ci-runner-reaper` | scheduled by `ci-runners-reaper-schedule`, `BEEP_CI_REAPER_TTL_MINUTES=150`, last log 07:45Z | stale-worker TTL | active |
| Termination watcher | `beep-ci-instance-termination` rule enabled; deregistration enabled with the #1050 KMS grants | deregistration on EC2 termination | active |

## Verifier defect found and fixed

`goals/ci-fleet-endgame/ops/redteam-verify.sh` read
`repos/beep-effect/beep-effect/actions/runners` for both the first-seen
record and the deregistration watch. Since the P3 cutover runners register in
the organization group and never appear there, so the watch was satisfied on
its first poll whatever the runner's state. The P4 line "deregistered after
one second" therefore observed nothing; the EC2 `shutting-down` reading from
the same run is unaffected. Both reads now use the organization runner list.

## E1 analysis against the current fleet

- Job code runs as `ec2-user` with passwordless sudo, so argv, environment,
  files and process memory inside the VM are all readable to job privilege.
  The JIT value is the runner's registration credential, held by the listener
  for the life of the job. Moving it off argv would clear probe K's
  `/proc/*/cmdline` residue but would not remove a recoverable credential, so
  the containment half of the E1 removal condition cannot be met without
  taking root away from heavy lanes (a new operator decision).
- The controls that hold against root are outside the VM: the one-job
  ephemeral registration, the termination watcher deregistering on EC2
  termination, and the 150-minute reaper TTL, which bounds a VM whose shim
  poweroff a root job suppressed.
- What remains unproved is the server-side half: that GitHub refuses the
  credential after the original listener ends and the registration is
  released, from the original host and from a second host. That is the live
  probe E1 names; it needs an operator-granted window (Decision Log
  2026-11-02).

## Live red team on `main`

Run `41409672251` (`fleet-shadow-check.yml` on `main` at `f2f3260b8a`,
`redteam=true`, `jit_replay=false`), driven by the repaired verifier:

| Gate | Result |
| --- | --- |
| A through J, L | exactly one PASS each |
| K (informational) | `JIT residue: visible` (unchanged from P2 and P4) |
| M | not run; needs the operator window |
| `AMI_PIN` | PASS (`ami-07af50c345b5ba065`, serving pin version 8) |
| `METADATA_DISABLED` | PASS (`disabled applied` sampled live while `running`) |
| Registration | `beep-ci-i-07e115b07ad46c18c` first seen in the organization roster at 08:02:17Z |
| Deregistration | left the organization roster 1 s after completion (now observed, not vacuous) |
| Teardown | EC2 `shutting-down`, then `terminated`, 1 s after completion |
| Verdict | `REDTEAM: PASS` |

Conclusion: the deployed runner class still has no usable ambient
instance-role credential path on the current fleet. P8 remains open only on
the post-release replay proof from the original and a second host.
