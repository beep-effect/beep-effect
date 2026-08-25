# Runner Trust Boundary Plan

## Status

Status: `active`. P0 was ratified on 2026-08-24 in
[`research/P0-GRILL.md`](./research/P0-GRILL.md). `P1` completed on 2026-08-24
with closure-ready evidence retained. P2 completed on 2026-08-24 with
closure-ready evidence retained in
[`research/P2-EVIDENCE.md`](./research/P2-EVIDENCE.md). P3 Admission defense in
depth is next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Posture validation and grill gate | ratified 2026-08-24 | Validate the posture against live GitHub, AWS, AMI, identity, lifecycle, and lane-placement facts; ratify mechanism, sequencing, rollback, and proof. | The sanitized facts, threat model, mechanism, and operator grill record exist. |
| P1 08-24 CSF-003/CSF-009 deployment proof | complete 2026-08-24 (closure-ready evidence retained) | Bake and deploy a fresh sealed image before the bootstrap rewrite, prove the setup fast path, run all five red-team gates, and prove teardown. | Every `SPEC.md` deployment-proof requirement passes; closure-ready evidence exists for the two held exact IDs. |
| P2 Workload identity boundary | complete 2026-08-24 (closure-ready evidence retained) | Keep the boundary-capped role for root-owned bootstrap, then disable IMDS fail-closed before runner startup. | No ordinary or privileged probe can obtain usable application role credentials; bootstrap, registration, and teardown still work. |
| P3 Admission defense in depth | pending | Move the five heavy lanes to a default-branch reusable workflow and admit them through the selected organization runner group. | Group policy, workflow refs, membership, and fail-closed registration match the ratified design. |
| P4 Boundary verification | pending | Run the complete deployed threat matrix and prepare exact-ID reconciliation. | Admission, identity, AMI, lifecycle, red-team, and teardown evidence satisfy `SPEC.md`; all six packet-owned open IDs are closure-ready. |
| P5 Yeet publish, review, and merge gate | pending | Publish through Yeet, close required checks and review threads, and merge with explicit operator authority. | Yeet reports `merge-ready: yes`, unresolved review threads are zero, and the remediation PR is merged. |
| P6 Dashboard closure | pending | Close the six exact Codex IDs only after the P5 merge gate. | All six IDs are closed as Already fixed with sanitized per-ID evidence, and the live dashboard reconciles to the allowlist. |
| P7 Close | pending | Record final evidence, reflection, lifecycle, and packet relationships. | Closeout reflection validates and README, plan, manifest, and index update together. |

## P0 checklist

1. [x] Capture the live GitHub, launch-template, AMI-pin, profile, role,
   boundary, policy, and fleet-state facts in `research/P0-FACTS.md`.
2. [x] Reconfirm the EC2 placement rationale and current workflow routing.
3. [x] Model ordinary, sudo, root, privileged-container, host-network, stale
   runner, mutable image/cache, and incomplete teardown paths.
4. [x] Shape the smallest mechanism that satisfies the six runner-class
   properties, with Alternative 2 retained as the mandatory fallback.
5. [x] Record the operator grill, options, pushback, decisions, rationale,
   packet effects, and live assumptions in `research/P0-GRILL.md`.
6. [x] Ratify the `P1` through `P4` sequence and proof plan on 2026-08-24.

## P1 08-24 CSF-003/CSF-009 deployment proof checklist

1. [x] Bake a fresh image with approved production inputs and retain the
   sanitized report and bake-complete marker. See
   [`P1-EVIDENCE.md` § Bake #1](./research/P1-EVIDENCE.md#bake-1--deploy-1)
   and [§ Bake #3](./research/P1-EVIDENCE.md#merge-bake-guard-bake-3--deploy-2).
2. [x] Apply the report's exact `pulumiPinCommand`, deploy with refresh, and
   prove the serving pin. See
   [`P1-EVIDENCE.md` § Bake #3 → deploy #2](./research/P1-EVIDENCE.md#merge-bake-guard-bake-3--deploy-2).
3. [x] Require exactly one PASS for A, B, C, D, and
   `E_RUNNER_IMDS_HOOK`, plus the expected AMI, scoped deregistration, EC2
   teardown, and plain `REDTEAM: PASS`. See
   [`P1-EVIDENCE.md` § Red-team run 4](./research/P1-EVIDENCE.md#red-team-run-4-pass).
4. [x] Admit `Baked fast path: true` only after the Bun binary and sealed cache
   pass key, ownership, mode, digest, and symlink checks. See
   [`P1-EVIDENCE.md` § Lane probe #3](./research/P1-EVIDENCE.md#lane-probe-3-positive-path).
5. [x] Retain closure-ready evidence for the two held exact Codex IDs while
   leaving both open until the `P5` merge gate. See
   [`P1-EVIDENCE.md` § Closure-ready mapping](./research/P1-EVIDENCE.md#closure-ready-mapping).

### P1 operator recipe

- Acquire the `beep-ci-runner-launcher` identity through the secret manager and
  confirm it before launch. Do not use the operator's default admin identity.
- Resolve the production subnet from `describe-subnets` and the worker
  security group from the serving launch template. Do not copy resource ids
  from old logs.
- Bake only a revision reachable from a repository remote. To avoid an early
  feature-branch push, bake `origin/main` from a detached worktree when its
  lockfile matches the branch.
- Apply the bake report's exact pin, then run `pulumi up --refresh --yes`.
- Run the red-team wrapper with `REDTEAM_EXPECTED_AMI` set to the reported
  image and require plain `REDTEAM: PASS`.
- Drain every pre-flip instance before the acceptance pair, then dispatch a
  lane probe on `main` and require `Baked fast path: true`.

P2 Workload identity boundary is complete. Every `bun.lock` change on `main`
re-stales the serving image until a matching re-bake is deployed.

## P2 Workload identity boundary checklist

- [x] Record the realized module seam, IAM statements, shutdown path, residual
  capabilities, proof mapping, rollback, and operator sequence in
  [`research/P2-DESIGN.md`](./research/P2-DESIGN.md).
- [x] Retain `beep-ci-runner-profile` only during root-owned bootstrap and keep
  launch-time `runner_metadata_options.http_endpoint` enabled.
- [x] Add a one-shot root helper that calls
  `ec2:ModifyInstanceMetadataOptions` on its own instance with
  `HttpEndpoint=disabled`, then exits before runner startup.
- [x] Install the fail-closed `run.sh` shim and guest poweroff path through
  `userdata_post_install`, with exact validated sudoers entries.
- [x] Add the role allow scoped to `${ec2:SourceInstanceARN}` with
  current `ec2:MetadataHttpEndpoint = enabled`.
- [x] Add an explicit `beep-ci-fleet-boundary` Deny for
  `ec2:ModifyInstanceMetadataOptions` once current endpoint state is
  `disabled`.
- [x] Add the three-case read-only IAM simulation harness for the boundary v4
  current-state edges, using an unrestricted stand-in identity policy.
- [x] Wait fail-closed until host probes against both IPv4 and IPv6 IMDS fail.
- [x] Add root, host-network, privileged-container, root STS, owner-hook,
  pre-disable live IAM-edge dry-runs (Gate L), JIT residue, and external
  applied-metadata assertions while keeping Gate E.
- [x] Run the boundary simulator live with the corrected v4 document: current
  `disabled` is `explicitDeny`; current `enabled` and a missing endpoint key
  are `allowed`. The IAM simulator does not resolve
  `${ec2:SourceInstanceARN}` and therefore does not prove the self-scoped
  allow.
- [x] Correct the condition-key model with Access Analyzer and throwaway-role
  dry-runs. For `ModifyInstanceMetadataOptions`, the metadata condition keys
  describe current resource state, not the requested value. See
  [`P2-EVIDENCE.md` § Condition-key semantics](./research/P2-EVIDENCE.md#condition-key-semantics).
- [x] Run `pulumi preview`, apply boundary v4, deploy with refresh, and drain
  every pre-flip worker according to the design's operator sequence.
- [x] Run the live A-through-J-plus-L red team, `AMI_PIN`,
  `METADATA_DISABLED`, lane, scoped deregistration, and EC2 teardown proof.
  Run `32786883010` is the proof of record. See
  [`P2-EVIDENCE.md` § Proof of record](./research/P2-EVIDENCE.md#proof-of-record).
- [x] Record informational K without the JIT value and transfer the
  operator-controlled replay probe to P4. Both P2 runs reported
  `JIT residue: visible`; P2 does not claim replay rejection.
- [x] Keep the owner firewall, sealed AMI, one-job VM, external teardown, and
  stale reaper as secondary controls.
- [x] Retain per-ID closure-ready mappings while leaving both findings open
  through the P5 merge gate. See
  [`P2-EVIDENCE.md` § Closure-ready mapping](./research/P2-EVIDENCE.md#closure-ready-mapping).

### P2/P3 canary-window recipe

Use this sequence for a security-sensitive launch-template or admission
change that lacks per-job version pinning:

1. Announce the controlled window and the exact rollback target.
2. Deploy one candidate version for the window.
3. Dispatch one operator probe and do not admit a second proof job.
4. Capture the candidate's decisive console and hosted-run output.
5. Automatically restore the prior target unless every required edge is
   clean. Keep the candidate only after the operator records the clean result.

The recipe bounded launch-template v11 and v12 failures and allowed v13 to
remain only after the clean canary. Apply the same discipline to P3 admission
changes. P3 is the next phase.

## P3 Admission defense in depth checklist

- Obtain a classic token with `admin:org`, a fine-grained token with
  organization self-hosted-runner write, or the GitHub App permission
  `organization_self_hosted_runners` before any organization-group mutation.
- Before refactoring `check.yml`, prove live that GitHub accepts a selected
  reusable workflow at `refs/heads/main` when its caller runs from a
  pull-request merge ref. Stop if ref matching differs from the ratified model.
- Create reusable `heavy.yml` on `main` and move the five heavy pull-request
  lanes into it. Keep `check.yml` as the caller with
  `uses: beep-effect/beep-effect/.github/workflows/heavy.yml@main`.
- Create the organization group `beep-ec2-heavy` with
  `allows_public_repositories: true`, `visibility: selected`, only
  `beep-effect/beep-effect`, and `restricted_to_workflows: true`.
- Select only `heavy.yml`, `fleet-shadow-check.yml`, and
  `fleet-lane-probe.yml`, each at `refs/heads/main`.
- Change the controller to organization-scoped registration using
  `enable_organization_runners` and `runner_group_name`.
- Prove a missing or rejecting named group fails registration. Never fall back
  to `Default` or repository-level registration.
- Prove pull-request content cannot change the EC2 job definitions or widen
  repository/workflow admission. Keep the heavy lanes on EC2.
- Record the residual exposure already removed by `P2`; runner-group policy
  remains defense in depth.

## Rollback posture

- A mechanical failure means the candidate cannot boot or register. A
  security-proof failure means a required gate fails. Either failure stops new
  fleet admission and terminates candidate instances.
- Drain in-flight candidates. Heavy pull-request lanes queue until repair; do
  not reroute them to hosted runners.
- Retain the previous launch-template version and AMI pin for mechanical
  rollback.
- Restoring the current IMDS-enabled state requires an explicit operator
  command and a packet record naming it as a known-risk state. It is not a
  successful security rollback and is never an agent default.

## P4 Boundary verification

1. Repeat the approved deployment and red-team matrix on the final exact head.
2. Prove one-job-one-VM registration, pickup, deregistration, and EC2 teardown.
3. Prove the AMI and setup fast path reject every tested digest, owner, or mode
   mismatch.
4. Run the operator-controlled one-use JIT replay probe. Require the second
   registration to be rejected, then scrub the retained value and record only
   the rejection class and timestamps.
5. Re-read the live runner-group state and deployed AWS state after rollout.
6. Map the final evidence to each of the six open Codex IDs in `SPEC.md`.
7. Mark each exact ID closure-ready after its individual evidence passes. Do
   not close any ID before the `P5` merge gate.

## P5 Yeet publish, review, and merge through P7 Close

1. Run Yeet repair and verify, publish with an intentional message, and monitor
   exact-head checks and review threads until `merge-ready: yes`.
2. With explicit operator authority, merge the remediation PR. Treat merge as a
   hard gate before every dashboard action.
3. Close the six exact Codex IDs as Already fixed, then reconcile the live
   dashboard against the allowlist and retain sanitized per-ID metadata.
4. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill
   and validate it with `bun run beep lint reflection-artifacts`.
5. Store the grill receipt, deployment report, sanitized setup summary,
   red-team gate accounting, teardown proof, runner-group proof, workload
   identity proof, and exact-ID closure record under `history/`.
6. Update `README.md`, this plan, `ops/manifest.json`, and `goals/INDEX.md` in
   the same closeout PR.
7. Leave `ci-fleet-endgame` and `ci-fleet-residue` lifecycle state unchanged.

## Verification commands

```sh
test "$(wc -m < goals/runner-trust-boundary/GOAL.md)" -le 4000
jq . goals/runner-trust-boundary/ops/manifest.json > /dev/null
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
git diff --check -- goals/runner-trust-boundary goals/INDEX.md
```
