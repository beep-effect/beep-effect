# Runner Trust Boundary Plan

## Status

Status: `active`. P0 was ratified on 2026-08-24 in
[`research/P0-GRILL.md`](./research/P0-GRILL.md). `P1` and P2 completed on
2026-08-24 with closure-ready evidence retained in
[`research/P1-EVIDENCE.md`](./research/P1-EVIDENCE.md) and
[`research/P2-EVIDENCE.md`](./research/P2-EVIDENCE.md). P3 Admission defense
in depth completed on 2026-08-25 with admission evidence retained in
[`research/P3-EVIDENCE.md`](./research/P3-EVIDENCE.md). P4 Boundary
verification completed on 2026-08-25 with the final-head proof of record in
[`research/P4-EVIDENCE.md`](./research/P4-EVIDENCE.md). P5 through P7 closed
on 2026-08-25: every remediation PR is merged, the six exact Codex IDs are
closed with the ledger in [`ops/closures.json`](./ops/closures.json), and the
closeout reflection is retained under `history/reflections/`. P8 was
reactivated on 2026-08-30 because the retained post-release JIT replay
exception contradicts the packet's completion gate.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Posture validation and grill gate | ratified 2026-08-24 | Validate the posture against live GitHub, AWS, AMI, identity, lifecycle, and lane-placement facts; ratify mechanism, sequencing, rollback, and proof. | The sanitized facts, threat model, mechanism, and operator grill record exist. |
| P1 08-24 CSF-003/CSF-009 deployment proof | complete 2026-08-24 (closure-ready evidence retained) | Bake and deploy a fresh sealed image before the bootstrap rewrite, prove the setup fast path, run all five red-team gates, and prove teardown. | Every `SPEC.md` deployment-proof requirement passes; closure-ready evidence exists for the two held exact IDs. |
| P2 Workload identity boundary | complete 2026-08-24 (closure-ready evidence retained) | Keep the boundary-capped role for root-owned bootstrap, then disable IMDS fail-closed before runner startup. | No ordinary or privileged probe can obtain usable application role credentials; bootstrap, registration, and teardown still work. |
| P3 Admission defense in depth | complete 2026-08-25 (admission evidence retained) | Move the five heavy lanes to a default-branch reusable workflow and admit them through the selected organization runner group. | Group policy, workflow refs, membership, and fail-closed registration match the ratified design. |
| P4 Boundary verification | complete 2026-08-25 (final-head proof retained) | Run the complete deployed threat matrix and prepare exact-ID reconciliation. | Admission, identity, AMI, lifecycle, red-team, and teardown evidence satisfy `SPEC.md`; all six packet-owned open IDs are closure-ready. |
| P5 Yeet publish, review, and merge gate | complete 2026-08-25 (all remediation PRs merged) | Publish through Yeet, close required checks and review threads, and merge with explicit operator authority. | Yeet reports `merge-ready: yes`, unresolved review threads are zero, and the remediation PR is merged. |
| P6 Dashboard closure | complete 2026-08-25 (ledger retained) | Close the six exact Codex IDs only after the P5 merge gate. | All six IDs are closed as Already fixed with sanitized per-ID evidence, and the live dashboard reconciles to the allowlist. |
| P7 Close | complete 2026-08-25 | Record final evidence, reflection, lifecycle, and packet relationships. | Closeout reflection validates and README, plan, manifest, and index update together. |
| P8 Post-release JIT containment | pending | Remove the readable runner JIT configuration before job-controlled privilege can recover it, or prove post-release replay rejection from both the original and a second host. | Live proof records no recoverable argv/config credential after handoff and rejects replay after the original listener ends; lifecycle may then return to completed-retained. |

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
remain only after the clean canary. The same discipline applied to the P3
admission changes; the redeploy's deviation from step 3 is recorded and
ratified in
[`research/P3-EVIDENCE.md` § Canary-window deviation](./research/P3-EVIDENCE.md#canary-window-deviation).

## P3 Admission defense in depth checklist

- [x] Obtain GitHub App organization self-hosted-runner read/write permission.
- [x] Create organization group `beep-ec2-heavy` with public-repository
      allowance, `visibility: selected`, and only `beep-effect/beep-effect`.
- [x] Move the five heavy lanes into reusable `heavy.yml` with the existing
      matrix names, step behavior, timeouts, push conditions, and EC2 label.
- [x] Stage the first PR with the local reusable-workflow call because the
      `@main` target cannot resolve until `heavy.yml` lands on `main`.
- [x] Change the controller to organization-scoped registration using
      `enable_organization_runners` and `runner_group_name`, while retaining
      `repository_white_list`.
- [x] Record the two-PR cutover, exact ruleset context renames, residual
      exposure, rollback, replay rule, and proof plan in
      [`research/P3-DESIGN.md`](./research/P3-DESIGN.md).
- [x] Rename the five required ruleset contexts to their `Heavy / ...` forms
      before merging the first PR; renamed through the rulesets API on
      2026-08-25 at `04:32:29Z`, after #803 merged and before #805.
- [x] Merge the first PR (#805, `05:03:27Z`), then change only the caller to
      `beep-effect/beep-effect/.github/workflows/heavy.yml@main` (#808).
- [x] At that follow-up cutover, enable `restricted_to_workflows` and select
      only `heavy.yml`, `fleet-shadow-check.yml`, `fleet-lane-probe.yml`, and
      `check.yml` (for the push-only `Build` job) at `refs/heads/main`; applied
      to organization group id 4 before #808 opened. The controller's
      organization registration deployed at `05:11:47Z`, failed on a missing
      installation permission, and rolled back at `05:36:51Z`. See
      [`research/P3-EVIDENCE.md`](./research/P3-EVIDENCE.md).
- [x] Accept the organization self-hosted-runners permission on the
      fleet-controller installation, redeploy the committed controller source,
      and drain pre-deploy runners; accepted before `17:36:57Z`, redeployed
      `17:37:02Z` to `17:38:58Z`, drained by `17:48:09Z` on 2026-08-25.
- [x] Prove a PR heavy job runs from the protected reusable workflow and a
      non-allowlisted workflow remains queued without runner assignment; #810
      run `32880339636` (all five `Heavy / ...` jobs on group-4 runners through
      `heavy.yml@refs/heads/main`) and probe run `32880025557` (queued five
      minutes with no runner beside an idle group runner). See
      [`research/P3-EVIDENCE.md`](./research/P3-EVIDENCE.md).
- [x] Prove a missing or rejecting named group fails registration without
      `Default` or repository fallback; the absent-group probe (`18:08:45Z`
      to `18:16:22Z`, run `32882220360`) deployed a group name that does not
      exist, launched and terminated eleven candidates on `Runner group
      beep-ec2-heavy-absent does not exist` with zero organization or
      repository registrations, restored automatically, and then ran the same
      queued job on a group-4 runner. The `05:19Z` permission incident is
      retained as a second fail-closed record.

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

## P4 Boundary verification checklist

1. [x] Repeat the approved deployment and red-team matrix on the final exact
   head. Run `32893112867` on `4764cdb4ba` (2026-08-25, `20:03Z`) reported
   exactly one PASS for Gates A through J, L, and M, `AMI_PIN`, and live
   `METADATA_DISABLED`, then `REDTEAM: PASS`. See
   [`research/P4-EVIDENCE.md` § Proof of record](./research/P4-EVIDENCE.md#proof-of-record).
2. [x] Prove one-job-one-VM registration, pickup, deregistration, and EC2
   teardown. The proof worker registered only in group 4, served one job,
   deregistered after one second, and was terminating one second later. See
   [§ Lifecycle on the final head](./research/P4-EVIDENCE.md#lifecycle-on-the-final-head).
3. [x] Prove the AMI and setup fast path reject every tested digest, owner,
   or mode mismatch. `AMI_PIN` bound the worker to the serving pin; the
   lockfile change in #812 made the integrity check refuse the stale fast
   path on the final head, matching `P1` lane probe #1. See
   [§ Sealed image and setup fast path](./research/P4-EVIDENCE.md#sealed-image-and-setup-fast-path-on-the-final-head).
4. [x] Add the operator-controlled one-use JIT replay probe and conditional
   `M_JIT_REPLAY` verifier routing without logging the JIT value.
5. [x] Run the replay probe. GitHub rejected the second listener with
   `A session for this runner already exists.`; the probe scrubbed the value
   and recorded only the rejection class and timestamps. This proves
   concurrent replay only; post-release replay is SPEC exception E1. See
   [§ JIT replay probe](./research/P4-EVIDENCE.md#jit-replay-probe).
6. [x] Re-read the live runner-group state and deployed AWS state after
   rollout. See
   [§ Live state after rollout](./research/P4-EVIDENCE.md#live-state-after-rollout).
7. [x] Map the final evidence to each of the six open Codex IDs in `SPEC.md`.
   See
   [§ Closure-ready mapping](./research/P4-EVIDENCE.md#closure-ready-mapping).
8. [x] Mark each exact ID closure-ready after its individual evidence passes,
   and close none before the merge gate. The gate reading is recorded in
   [§ Merge-gate reading](./research/P4-EVIDENCE.md#merge-gate-reading).

## P5 Yeet publish, review, and merge through P7 Close checklist

1. [x] Publish through Yeet and monitor exact-head checks and review threads
   until `merge-ready: yes`. Remediation PRs #796, #800, #805, #808, and #814
   each closed this way and merged with operator authority; the closeout PR
   follows the same path.
2. [x] Treat merge as a hard gate before every dashboard action. Every
   remediation PR was merged before its findings were closed; four IDs were
   closed on 2026-08-24 before the P4 re-proof under SPEC exception E2; the
   closeout PR carries no remediation code. See
   [`research/P4-EVIDENCE.md` § Merge-gate reading](./research/P4-EVIDENCE.md#merge-gate-reading).
3. [x] Close the six exact Codex IDs as Already fixed and reconcile the live
   dashboard against the allowlist. Ledger:
   [`ops/closures.json`](./ops/closures.json).
4. [x] Write `history/reflections/2026-08-25-claude.md` and validate it with
   `bun run beep lint reflection-artifacts`.
5. [x] Retain the grill record, deployment reports, sanitized setup
   summaries, red-team gate accounting, teardown proof, runner-group proof,
   workload-identity proof, and exact-ID closure record. They live in
   `research/P0-GRILL.md`, `research/P1-EVIDENCE.md` through
   `research/P4-EVIDENCE.md`, and `ops/closures.json`; `history/` holds the
   reflection.
6. [x] Update `README.md`, this plan, `ops/manifest.json`, and
   `goals/INDEX.md` in the same closeout PR.
7. [x] Leave `ci-fleet-endgame` and `ci-fleet-residue` lifecycle state
   unchanged. The stale-image re-bake is handed to `ci-fleet-endgame` as a
   performance item, not a lifecycle change.

## P8 Post-release JIT containment checklist

1. [ ] Replace argv-based configuration handoff with a mechanism that does not
   leave the one-use JIT value readable to job-controlled privilege, or prove
   an equivalent containment boundary.
2. [ ] Stop the original listener and attempt replay from the original host and
   a second host without logging the credential value.
3. [ ] Require server-side rejection, scoped deregistration, VM teardown, and a
   sanitized exact-head evidence record.
4. [ ] Close exception E1 only after those checks pass; update README, plan,
   spec, manifest, reflection, and index in the same reviewed PR.

## Verification commands

```sh
test "$(wc -m < goals/runner-trust-boundary/GOAL.md)" -le 4000
jq . goals/runner-trust-boundary/ops/manifest.json > /dev/null
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
jq . goals/runner-trust-boundary/ops/closures.json > /dev/null
git diff --check -- goals/runner-trust-boundary goals/INDEX.md
```
