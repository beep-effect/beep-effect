# Runner Trust Boundary Plan

## Status

Status: `active`. P0 was ratified on 2026-08-24 in
[`research/P0-GRILL.md`](./research/P0-GRILL.md). `P1` is in progress as a
standalone baseline before the workload-identity rewrite.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Posture validation and grill gate | ratified 2026-08-24 | Validate the posture against live GitHub, AWS, AMI, identity, lifecycle, and lane-placement facts; ratify mechanism, sequencing, rollback, and proof. | The sanitized facts, threat model, mechanism, and operator grill record exist. |
| P1 08-24 CSF-003/CSF-009 deployment proof | in progress | Bake and deploy a fresh sealed image before the bootstrap rewrite, prove the setup fast path, run all five red-team gates, and prove teardown. | Every `SPEC.md` deployment-proof requirement passes; closure-ready evidence exists for the two held exact IDs. |
| P2 Workload identity boundary | pending | Keep the boundary-capped role for root-owned bootstrap, then disable IMDS fail-closed before runner startup. | No ordinary or privileged probe can obtain usable application role credentials; bootstrap, registration, and teardown still work. |
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

1. Run a fresh `bun run beep runners bake` with the approved production inputs.
   Retain a sanitized report and the bake-complete marker.
2. Apply the report's exact `pulumiPinCommand`, deploy, and prove the controller
   uses the reported AMI.
3. Run `goals/ci-fleet-endgame/ops/redteam-verify.sh <deployed-ref>` with AWS
   credentials available. Require exactly one PASS for A, B, C, D, and
   `E_RUNNER_IMDS_HOOK`; no FAIL; runner deregistration; EC2 teardown; and final
   `REDTEAM: PASS` without the AWS-skipped qualifier.
4. Retain the setup-action log. `Baked fast path: true` is acceptable only after
   explicit Bun-binary and sealed-cache ownership, mode, and digest checks.
5. Record closure-ready evidence for the two held exact Codex IDs. Leave them
   open until the `P5` merge gate passes.

## P2 Workload identity boundary checklist

- Retain `beep-ci-runner-profile` only during root-owned bootstrap.
- Fetch the one-use JIT configuration into root-only tmpfs, delete its
  per-instance Parameter Store value, and keep the runner offline.
- Add a one-shot root helper that calls
  `ec2:ModifyInstanceMetadataOptions` on its own instance with
  `HttpEndpoint=disabled`, then exits before runner startup.
- Add the role allow scoped to `${ec2:SourceInstanceARN}` with
  `ec2:MetadataHttpEndpoint = disabled`.
- Add an explicit `beep-ci-fleet-boundary` Deny for
  `ec2:ModifyInstanceMetadataOptions` when the endpoint value is anything
  other than `disabled`.
- Prove the self-only allow, all re-enable denials, and boundary ceiling through
  IAM dry runs before deployment. If one-way self-only disable cannot be
  proved, stop and use Alternative 2 from `research/P0-MECHANISM.md`.
- Wait fail-closed until host probes against both IPv4 and IPv6 IMDS fail.
  Do not treat a pending metadata-options response as completion.
- Scrub the tmpfs JIT buffer and run a root-owned pre-job residue probe across
  arguments, environment, `/proc`, files, logs, cloud-init data, swap, and the
  runner work directory before starting the runner.
- Probe ordinary user, sudo, UID 0, privileged-container, host-network, direct
  IMDS, delayed teardown, and JIT replay paths.
- Keep the owner firewall, sealed AMI, one-job VM, external teardown, and stale
  reaper as secondary controls.

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
4. Re-read the live runner-group state and deployed AWS state after rollout.
5. Map the final evidence to each of the six open Codex IDs in `SPEC.md`.
6. Mark each exact ID closure-ready after its individual evidence passes. Do
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
