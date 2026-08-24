# Runner Trust Boundary Plan

## Status

Status: `active`. P0 is pending. The operator grill gates every later phase.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Posture validation and grill gate | pending | Validate the ratified posture against live GitHub organization, AWS deployment, AMI, identity, lifecycle, and heavy-lane placement facts. | A sanitized fact record and threat model exist; the operator grill records a ratified design, rollback, and proof plan. |
| P1 08-24 CSF-003/CSF-009 deployment proof | pending | Bake and deploy a fresh sealed image, prove the setup fast path, run all five red-team gates, and prove teardown. | Every P1 requirement in `SPEC.md` passes; closure-ready evidence exists for the two held exact IDs. |
| P2 Admission defense in depth | pending | Apply and prove the ratified organization runner-group controls while PR work stays on EC2. | Group membership, repository/workflow access, non-fallback registration, and control ownership match the P0 decision. |
| P3 Workload identity boundary | pending | Remove usable ambient instance-role credentials from job execution without breaking bootstrap, registration, or teardown. | Ordinary and privileged probes cannot obtain usable application role credentials; the sealed ephemeral runner remains operational. |
| P4 Boundary verification | pending | Run the complete deployed threat matrix and prepare exact-ID reconciliation. | Admission, identity, AMI, lifecycle, red-team, and teardown evidence satisfy `SPEC.md`; all six packet-owned open IDs are closure-ready. |
| P5 Yeet publish, review, and merge gate | pending | Publish through Yeet, close required checks and review threads, and merge with explicit operator authority. | Yeet reports `merge-ready: yes`, unresolved review threads are zero, and the remediation PR is merged. |
| P6 Dashboard closure | pending | Close the six exact Codex IDs only after the P5 merge gate. | All six IDs are closed as Already fixed with sanitized per-ID evidence, and the live dashboard reconciles to the allowlist. |
| P7 Close | pending | Record final evidence, reflection, lifecycle, and packet relationships. | Closeout reflection validates and README, plan, manifest, and index update together. |

## P0 checklist

1. Capture the live GitHub organization runner groups and the fields governing
   public repository access, selected repositories, selected workflows,
   inherited policy, default-group behavior, and current fleet membership.
2. Capture the deployed controller, launch template, AMI pin, instance profile,
   metadata options, runner user, bootstrap/JIT flow, setup-action fast path,
   deregistration, and teardown behavior without secrets or machine IDs.
3. Reconfirm the EC2 placement rationale from
   `goals/ci-lane-economics/research/placement-decision.md` and current workflow
   routing. Do not reopen the hosted re-fit without operator direction.
4. Model the ordinary, sudo, root, privileged-container, host-network, stale
   runner, mutable image/cache, and incomplete teardown paths.
5. Shape the smallest mechanism that satisfies all six runner-class properties
   in `SPEC.md`, including rollback and external proof.
6. Invoke the grilling skill with the operator. Retain the grill record and
   update the packet if the ratified mechanism differs from the initial shape.
7. Stop until the operator explicitly ratifies P1 through P4.

## P1 deployment proof checklist

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
   open until P5 confirms the remediation PR is merged.

## P2 admission checklist

- Apply the P0-ratified organization runner group and registration controls.
- Prove registration names the intended group and fails closed if the group is
  absent or rejects the runner.
- Prove repository and workflow access match the operator decision and cannot
  be widened by a pull request.
- Keep the heavy PR jobs on their EC2 runner class.
- Record residual exposure that only P3 can remove.

## P3 workload-identity checklist

- Remove usable application instance-role credentials from job execution.
- Preserve the minimum bootstrap/JIT and teardown control path without leaving
  a credential source that job code can recover.
- Rebuild and redeploy the sealed AMI if the ratified design changes its
  contents or bootstrap contract.
- Probe ordinary user, sudo, UID 0, privileged container, host network, and
  direct IMDS paths.
- Keep the per-job IMDS hook as defense in depth and prove it remains armed.

## P4 verification

1. Repeat the approved deployment and red-team matrix on the final exact head.
2. Prove one-job-one-VM registration, pickup, deregistration, and EC2 teardown.
3. Prove the AMI and setup fast path reject every tested digest, owner, or mode
   mismatch.
4. Re-read the live runner-group state and deployed AWS state after rollout.
5. Map the final evidence to each of the six open Codex IDs in `SPEC.md`.
6. Mark each exact ID closure-ready after its individual evidence passes. Do
   not close any of the six before the P5 merge gate.

## P5 through P7 closeout

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
jq . goals/runner-trust-boundary/ops/manifest.json
rg -n "runner-trust-boundary|GOAL.md|agentLaunchers|packetAnchorDocument" goals/runner-trust-boundary
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
git diff --check -- goals/runner-trust-boundary goals/INDEX.md
```
