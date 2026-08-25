# P4 boundary-verification evidence

Date: 2026-08-25

Status: complete. The full deployed red-team matrix, including the
operator-controlled JIT replay probe, passed on the final head. The live
runner-group and AWS state were re-read after the P3 rollout, and all six
packet-owned Codex IDs are closure-ready. Identifiers follow the packet's
public sanitization convention: run and job ids, instance ids, group ids,
image ids, and timestamps only. The JIT configuration value was never printed
and is not retained.

## Timeline

All times are UTC on 2026-08-25.

| Time | Event |
| --- | --- |
| `19:57:05Z` | #812 merged (`9caef13bc2`), changing `bun.lock`; `19:57:26Z` #814 merged (`4764cdb4ba`), the final head for this proof. |
| `19:58:15Z` to `19:59:04Z` | The #812 push run `32892496750` placed `Build` and all five `Heavy / ...` jobs on group-4 runners; its `referenced_workflows` resolved `heavy.yml@main` to `refs/heads/main` at `9caef13bc2`. |
| `20:03:21Z` | `REDTEAM_JIT_REPLAY=1 goals/ci-fleet-endgame/ops/redteam-verify.sh main` dispatched `fleet-shadow-check.yml` on `main` with `redteam=true jit_replay=true`; run `32893112867` created at `20:03:23Z` on head `4764cdb4ba`. |
| `20:03:25Z` | Job `Shadow Probe` started on `beep-ci-i-021ba4db3c85baa04`, `runner_group_name: beep-ec2-heavy`. The instance had launched at `20:00:00Z` as a group-4 candidate during the #812 and #814 push bursts and had served no other job. |
| `20:03:27Z` | The workflow derived `Runner instance-id: i-021ba4db3c85baa04` from `RUNNER_NAME`; the verifier identified the same worker through the jobs API and sampled `ami-0738c1b69711969bc disabled applied running` while the worker was alive. |
| `20:03:31Z` | Gate L: `IMDS_EDGE self_disable: PASS`, `self_reenable: PASS`, `self_redisable: PASS`, `other_disable: INCONCLUSIVE (InvalidInstanceID.Malformed)`, unchanged from P2. |
| `20:03:33Z` | Informational probe K: `JIT residue: visible`. |
| `20:03:34Z` to `20:05:04Z` | Probe M: a second `Runner.Listener` from a scratch copy of `bin` and `externals` replayed the running listener's one-use JIT configuration for the full 90-second window. Its log carried the server-side rejection `A session for this runner already exists.`; the probe reported `JIT replay: rejected (A session for this runner already exists.)` and scrubbed the scratch copy and the shell variable on exit. |
| `20:05:27Z` | Gate summary: exactly one PASS each for `A_APP_SECRET_SSM`, `B_S3`, `C_TAILNET_LAN`, `D_CONTAINER_IMDS`, `E_RUNNER_IMDS_HOOK`, `F_ROOT_IMDS`, `G_HOSTNET_CONTAINER_IMDS`, `H_PRIVILEGED_CONTAINER_IMDS`, `I_ROOT_STS`, `J_HOOK_STILL_ARMED`, `L_IAM_EDGES`, and `M_JIT_REPLAY`. Run conclusion `success` at `20:05:28Z`. |
| `20:05:29Z` onward | Verifier: `GATE AMI_PIN: PASS (ami-0738c1b69711969bc)` against the serving SSM pin, `GATE METADATA_DISABLED: PASS (disabled applied)` from the live sample, worker sample `disabled pending shutting-down`, `ephemeral runner deregistered after 1s`, `EC2 termination asserted after 1s`, `REDTEAM: PASS`, wrapper exit 0 at `20:05:44Z`. |

## Proof of record

Red-team run
[`32893112867`](https://github.com/beep-effect/beep-effect/actions/runs/32893112867)
is the P4 proof of record. It ran on head `4764cdb4ba`, launch-template v13,
image `ami-0738c1b69711969bc`, through the allowlisted
`fleet-shadow-check.yml@refs/heads/main` reference on a group-4 runner. The
verifier's required gate set was the P2 set plus `M_JIT_REPLAY`:

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
| M `M_JIT_REPLAY` | A second listener replaying the one-use JIT configuration is rejected server-side. | One PASS |
| `AMI_PIN` | The worker's image equals the serving SSM pin. | PASS (`ami-0738c1b69711969bc`) |
| `METADATA_DISABLED` | The worker reports `disabled applied` while alive. | PASS (live sample) |

No gate reported FAIL. The wrapper scoped deregistration to
`beep-ci-i-021ba4db3c85baa04` and ignored 74 other controller registrations
(see "Residuals"). The runner left the roster and the instance reached
`shutting-down` within one second of the run's completion.

## JIT replay probe

The pinned module passes the one-use JIT configuration in `--jitconfig`, and
P2 recorded that the job user can read that argv from `/proc`. P4 answers the
open question: does GitHub accept a second listener started with the same
value while the first is alive?

- Source: the running listener's `/proc/*/cmdline`, read by the job user.
- Replay: `timeout 90 Runner.Listener run --jitconfig <value>` from a scratch
  copy under the ephemeral runner temp directory.
- Result: the listener never reported `Listening for Jobs` or
  `Connected to GitHub`. Its log matched the phrase-anchored rejection class
  `already registered|used|configured|exists` with the server message
  `A session for this runner already exists.` The probe classified the
  attempt as rejected at `20:05:04Z`, ninety seconds after it started.
- Scrub: the step's `EXIT` trap unset the shell variable and removed the
  scratch runner. The value was never echoed; the step output holds only the
  classification line, one transient `/proc/<pid>/cmdline: No such file or
  directory` from a process that exited mid-scan, and a harmless
  `grep: write error: Broken pipe` from `head -1`.
- Second registration: none. No runner name was printed because the
  rejected payload did not produce an accepted registration, and the
  organization and repository runner lists gained no entry.

The rejection is a session-level refusal by GitHub for a runner that already
holds a session. It closes the P2 residual as a replay-of-live-session
exposure: the visible argv does not let job code take over or duplicate the
runner. The value remains visible on the host until the VM terminates; P2's
one-job VM lifecycle and teardown, re-proved here, bound that residue to the
job's own lifetime.

## Lifecycle on the final head

One-job-one-VM held for the proof worker:

| Step | Evidence |
| --- | --- |
| Registration | `beep-ci-i-021ba4db3c85baa04` registered in organization group 4 (`runner_group_name: beep-ec2-heavy` on the job record); it did not appear in the repository-scoped runner list. |
| Pickup | Job `Shadow Probe` started at `20:03:25Z`; no other job in the #812, #814, or probe runs reports that runner name. |
| Deregistration | The verifier's scoped watch saw the runner leave the roster one second after completion. |
| Teardown | `describe-instances` returned `shutting-down` on the first post-run poll; termination was asserted one second after completion. |

## Sealed image and setup fast path on the final head

- The serving pin is `/beep-ci/controller/runner-ami-id` version 7,
  `ami-0738c1b69711969bc`, unchanged since P1 bake #3. `AMI_PIN` bound the
  P4 worker to it.
- Launch-template `beep-ci-action-runner` default and latest are both v13
  (created `22:41:48Z` on 2026-08-24), resolving the image from that SSM
  parameter, launching with `HttpEndpoint: enabled`, and terminating on guest
  shutdown.
- #812 changed `bun.lock` on `main` at `19:57:05Z`. The checkout digest is now
  `2a4bb737…`; the serving image is keyed to `f81ab29f…`. The setup action's
  lockfile-keyed integrity check therefore refuses the baked fast path on the
  final head and uses the full setup, exactly as P1 lane probe #1 proved for a
  stale key: the #812 push run's `Heavy / Test Integration` job
  (`97947424883`) printed `baked runner stale or failed integrity checks;
  using full setup` at `19:59:18Z`. This is the intended rejection: the stale
  image cannot be reused until a matching bake is deployed. The last positive
  fast path on the fleet was the P3 probe run `32880023142` at `17:49Z`,
  before #812 merged.
- Re-baking is a performance action owned by `ci-fleet-endgame`; it is not a
  P4 security requirement and is left to that packet.

## Live state after rollout

Re-read between `20:03Z` and `20:08Z` on 2026-08-25, after the P3 rollout and the #812 and #814
push runs:

| Surface | Value |
| --- | --- |
| Organization group 4 `beep-ec2-heavy` | `visibility: selected`; repositories `beep-effect/beep-effect` only; `allows_public_repositories: true`; `restricted_to_workflows: true`; `selected_workflows` exactly `check.yml`, `fleet-lane-probe.yml`, `fleet-shadow-check.yml`, `heavy.yml` at `refs/heads/main`. |
| Other organization groups | `Default` (id 1, `visibility: all`, no runners); `Blacksmith runners …` (id 3, `visibility: all`, 400 offline Blacksmith registrations). Neither admits fleet runners. |
| Group 4 roster during the proof | 13 online `beep-ci-*` runners (the #812 and #814 push bursts), 1 offline. |
| Scale-up lambda `beep-ci-scale-up` | `ENABLE_ORGANIZATION_RUNNERS=true`, `RUNNER_GROUP_NAME=beep-ec2-heavy`, `ENABLE_EPHEMERAL_RUNNERS=true`, `RUNNER_LABELS=beep-ec2-heavy`. |
| SSM pin | `/beep-ci/controller/runner-ami-id` version 7, `ami-0738c1b69711969bc`. |
| Launch template | `beep-ci-action-runner` default v13, latest v13. |
| Boundary | `beep-ci-fleet-boundary` default version v4 (created `22:39:34Z` on 2026-08-24). |
| Committed controller source | `enable_organization_runners: true`, `runner_group_name: "beep-ec2-heavy"`, `repository_white_list: ["beep-effect/beep-effect"]`; production matches the committed source. |

## Admission on the final head

- #812 push run `32892496750` (`9caef13bc2`): `Build` on
  `beep-ci-i-03d144ec150ee540a` and `Heavy / Coverage Regression`, `Docgen`,
  `Check`, `Lint Policy`, and `Test Integration` on five distinct group-4
  runners between `19:58:15Z` and `19:59:04Z`, each with
  `runner_group_name: beep-ec2-heavy`. `Build` is the `check.yml@refs/heads/main`
  admission in everyday use; the heavy lanes are the `heavy.yml@main` admission.
- The P4 proof itself ran through `fleet-shadow-check.yml@refs/heads/main` on a
  group-4 runner.
- P3's negative and absent-group probes are not repeated; their records stand
  in [`P3-EVIDENCE.md`](./P3-EVIDENCE.md).

## Residuals

- **Stale repository-scoped registrations.** The repository runner list still
  holds 74 offline `beep-ci-*` registrations with no matching instance, left
  by the pre-cutover repository-scoped fleet (P2 observed 83 during its proof).
  They are inert: the controller registers only at organization scope now, and
  GitHub removes an ephemeral runner that has not connected for more than one
  day. The verifier scopes deregistration to the executing runner, so they do
  not affect proof accounting.
- **JIT argv residue.** `JIT residue: visible` remains true by construction of
  the pinned module. Replay of a live session is rejected (this record); the
  value's exposure is bounded to the one-job VM lifetime.
- **Other-instance denial.** `IMDS_EDGE other_disable` stays inconclusive
  (`InvalidInstanceID.Malformed`), unchanged from P2; the self-only allow is
  proven by the live self edges and the boundary Deny.
- **Stale serving image.** The fast path is rejected on `main` until a bake
  keyed to the current lockfile is deployed; owned by `ci-fleet-endgame`.

## Merge-gate reading

The SPEC orders dashboard closure after the remediation PR merge gate. Every
remediation PR is merged: #783 (repo-side CSF-003 and CSF-009 fixes), #796
(P1 deployment proof and verifier), #800 (P2 workload-identity code and
policy), #805 and #808 (P3 reusable workflow and cutover), and #814 (P3
evidence). The P4 proof above ran on the merged head. The closeout PR that
carries this record, the reflection, and the lifecycle flip contains no
remediation code, so closing the dashboard IDs before it merges does not close
any finding ahead of its fix. The operator instructed on 2026-08-25 that the
remaining phases finish in one PR; this reading is recorded so the P5 gate is
not misread as requiring a second closeout PR.

## Closure-ready mapping

All six packet-owned open IDs are closure-ready. The four P1 and P2 IDs keep
their earlier mappings and gain the final-head re-proof; the two admission
IDs are mapped here for the first time.

| Codex ID | Finding | Evidence that satisfies it | State |
| --- | --- | --- | --- |
| `08ee74d0eb18819187fd02f570b4d57c` | CSF-001, "PR code now runs on self-hosted EC2 CI lanes" | The fleet is a non-privileged runner class: Gates A through M and `METADATA_DISABLED` on run `32893112867` prove no usable ambient credentials for ordinary, sudo, root, host-network, or privileged-container code, and one-job-one-VM teardown. Admission is defense in depth: [`P3-EVIDENCE.md`](./P3-EVIDENCE.md) proofs 1 through 4 and the #812 push run above. | Closure-ready |
| `a3a281b2a3d881919fdcbf68ee2364f0` | CSF-004, "PR code now runs on owned EC2 CI runners" | Same deployed proof as CSF-001, plus `AMI_PIN` binding the worker to the sealed serving image and the lockfile-keyed rejection of the stale fast path on the final head. | Closure-ready |
| `c799c2269d748191997ff176ce4bfd48` | CSF-005, "Shadow runner exposes AWS role creds to job code" | [`P2-EVIDENCE.md`](./P2-EVIDENCE.md) closure-ready mapping, re-proved on the final head by Gates A, B, D, F, G, H, I, L and the live `disabled applied` sample. | Closure-ready |
| `33cd94a12d788191afbec1edc25c433f` | CSF-006, "Red-team gate misses sudo IMDS credential path" | [`P2-EVIDENCE.md`](./P2-EVIDENCE.md) closure-ready mapping; Gates F through L re-passed on the final head, and Gate M closes the replay question P2 left open. | Closure-ready |
| `9459410104b881919cd820b97c673b67` | CSF-003, "Baked runner trusts mutable Bun binary" | [`P1-EVIDENCE.md`](./P1-EVIDENCE.md) closure-ready mapping; the final head shows the integrity check refusing the stale image after #812 changed the lockfile. | Closure-ready |
| `d1f026deb21881919d853e63780734fe` | CSF-009, "IMDS hook can silently remain unarmed" | [`P1-EVIDENCE.md`](./P1-EVIDENCE.md) closure-ready mapping; `E_RUNNER_IMDS_HOOK` and `J_HOOK_STILL_ARMED` each one PASS on the final head with `AMI_PIN` binding them to the serving image. | Closure-ready |

## Dashboard closure

Read-only capture before any action, 2026-08-25 (signed-in browser lane, all
severities, repository scope): 2 open, 418 closed. The four `P1` and P2 IDs
(`c799c226…`, `33cd94a1…`, `94594101…`, `d1f026de…`) were already closed as
Already fixed on 2026-08-24 after #796 and #800 merged, each carrying an
additional-context note that cites its remediation PR and evidence record;
the two admission IDs were the only open findings, and no open finding
outside the allowlist existed. The dashboard does not display a closure
timestamp on archived findings.

Closures on 2026-08-25, each with reason Already fixed and an
additional-context note citing the remediation PRs and this record:

| Codex ID | Submitted (UTC) | Result |
| --- | --- | --- |
| `08ee74d0eb18819187fd02f570b4d57c` | `20:18:00Z` | Closed, Already fixed |
| `a3a281b2a3d881919fdcbf68ee2364f0` | `20:18:35Z` | Closed, Already fixed |

Post-closure reconciliation: 0 open, 420 closed; both IDs re-opened from the
closed list and confirmed. The three historical IDs
(`382c538b…`, `ca9a4a03…`, `e841bb53…`) remain closed and were not touched.
The sanitized per-ID record is [`../ops/closures.json`](../ops/closures.json).
