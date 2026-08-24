# GOAL: prove the runner trust boundary

Repo root: the current working directory. Do not assume an absolute path; the
repository has several checkouts. All paths below are repo-relative.

Outcome: keep heavy pull-request work on EC2 while replacing the fleet's
ambient privilege with a sealed, digest-verified, one-job-one-VM runner class
that exposes no usable instance-role credentials to job code.

Treat these packet files as the detailed contract:

- `goals/runner-trust-boundary/README.md`
- `goals/runner-trust-boundary/SPEC.md`
- `goals/runner-trust-boundary/PLAN.md`
- `goals/runner-trust-boundary/ops/manifest.json`
- `goals/runner-trust-boundary/research/SOURCES.md`

Read them first, then read `AGENTS.md`, `CLAUDE.md`, the transferred finding
records, and the fleet evidence named by `SPEC.md`. Repo law outranks packet
prose.

Ratified posture: **DEFANG THE FLEET, KEEP PRS ON IT.** Hosted runners cannot
carry the heavy lanes reliably, so PR code remains on EC2. Admission controls
are defense in depth. The primary boundary is a non-privileged runner class
with no usable ambient instance-role credentials, a sealed digest-verified
AMI, and one ephemeral VM per job.

Scope:

- In: GitHub organization runner-group facts and controls; EC2 runner bootstrap
  identity; launch-template and controller configuration; AMI bake and pinning;
  setup-action integrity checks; red-team gates; teardown; sanitized evidence;
  exact-ID dashboard closure.
- Out: moving the heavy PR lanes to hosted runners; fleet performance and
  architecture work owned by `ci-fleet-endgame`; reopening
  `ci-fleet-residue`; accepted risk; unrelated CI cleanup.

Execution:

1. P0: verify current GitHub runner-group policy, AWS runner configuration,
   bootstrap/JIT delivery, instance-profile and IMDS state, AMI integrity, and
   one-job VM lifecycle. Reconcile the facts with the ratified posture. End
   with an operator grill and record the decision. Stop until it is ratified.
2. P1: run a fresh `bun run beep runners bake`, apply the report's exact
   `pulumiPinCommand`, deploy, and run
   `goals/ci-fleet-endgame/ops/redteam-verify.sh <deployed-ref>`. Require
   exactly one PASS for Gates A, B, C, D, and `E_RUNNER_IMDS_HOOK`, plus runner
   deregistration, EC2 teardown, and a setup-action log that admits the baked
   fast path only after Bun-binary and sealed-cache ownership, mode, and digest
   checks. Only then close Codex IDs `9459410104b881919cd820b97c673b67`
   and `d1f026deb21881919d853e63780734fe` as Already fixed.
3. P2: implement and prove the ratified runner-group admission controls without
   moving PR work off the EC2 fleet or treating workflow YAML as the primary
   trust boundary.
4. P3: remove usable ambient instance-role credentials from job execution and
   prove ordinary, sudo, root, and privileged-container paths cannot recover
   them. Preserve the sealed AMI and one-job-one-VM boundary.
5. P4: rerun the complete boundary proof and reconcile every exact Codex ID in
   `SPEC.md`. Close only identities supported by deployed evidence.
6. P5 and P6: when authorized, use Yeet to reach `merge-ready: yes`, resolve
   every review thread, write the closeout reflection, and update packet state.

Acceptance requires every `SPEC.md` criterion, the P0 operator grill receipt,
fresh P1 deployment evidence, no usable workload credential path, exact-head
verification, and exact-ID dashboard reconciliation. Run every command in the
manifest.

Stop on an unratified P0 design, missing external authority, any digest or
teardown failure, a credential path reachable by job-controlled privilege, a
proposal to move the heavy PR lanes to hosted runners, or ownership collision
with the fleet packets.

Done only after deployed proof, exact-ID closure, required checks, zero review
threads, a valid reflection, and `merge-ready: yes`.
