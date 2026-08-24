# GOAL: prove the runner trust boundary

Repo root is the current working directory. All paths are repo-relative.

Outcome: keep heavy pull-request work on EC2 while replacing the fleet's
ambient privilege with a sealed, digest-verified, one-job-one-VM runner class
that exposes no usable instance-role credentials to job code.

Read `SPEC.md`, `PLAN.md`, `ops/manifest.json`, `research/P0-GRILL.md`, and
`research/P0-FACTS.md` first. Then read repo law and the evidence named by the
spec. Repo law outranks packet prose.

Ratified posture: **DEFANG THE FLEET, KEEP PRS ON IT.** PR code remains on EC2.
Keep the boundary-capped role only for root bootstrap, consume JIT from tmpfs,
disable IMDS one-way on the source instance, wait for IPv4 and IPv6 probes to
fail, then start the runner. Admission follows workload identity through a
default-branch reusable workflow and selected organization runner group.

Scope includes runner-group admission, bootstrap identity, launch and AMI
configuration, integrity checks, red-team gates, teardown, sanitized evidence,
and exact-ID closure. It excludes hosted-heavy-lane migration, fleet
performance work, retained-packet changes, accepted risk, and unrelated CI.

Execution:

1. P0 Posture validation and grill gate: ratified 2026-08-24. Treat
   `research/P0-GRILL.md` as the decision record.
2. P1 08-24 CSF-003/CSF-009 deployment proof: in progress. Run a fresh
   `bun run beep runners bake`, apply the report's exact
   `pulumiPinCommand`, deploy, and run
   `goals/ci-fleet-endgame/ops/redteam-verify.sh <deployed-ref>`. Require
   exactly one PASS for Gates A, B, C, D, and `E_RUNNER_IMDS_HOOK`, plus runner
   deregistration, EC2 teardown, and a setup-action log that admits the baked
   fast path only after Bun-binary and sealed-cache ownership, mode, and digest
   checks. Retain closure-ready evidence for Codex IDs
   `9459410104b881919cd820b97c673b67` and
   `d1f026deb21881919d853e63780734fe`; leave them open until P6.
3. P2 Workload identity boundary: add the self-only metadata-disable allow and
   boundary Deny for every value other than `disabled`; dry-run both edges.
   Keep JIT in root-only tmpfs, scrub residue, and start only after the helper
   exits and both host IMDS probes fail. Use the no-profile broker if one-way
   self-only disable cannot be proved.
4. P3 Admission defense in depth: first prove selected-workflow ref matching
   live. Move the five heavy lanes to `heavy.yml@main`; create selected group
   `beep-ec2-heavy` for the public repository, `heavy.yml`, and the two probe
   workflows at `refs/heads/main`. Register at organization scope and fail
   closed without fallback. Obtain `admin:org` or App-equivalent authority.
5. P4 Boundary verification: rerun the complete deployed proof and mark all six
   exact Codex IDs closure-ready.
6. P5 Yeet publish, review, and merge gate: reach `merge-ready: yes`, resolve
   every thread, and merge only with explicit authority.
7. P6 Dashboard closure and P7 Close: after merge, close the six exact IDs,
   reconcile the dashboard, write the reflection, and update packet state.

Acceptance requires every `SPEC.md` criterion, the ratified grill record, fresh
`P1` deployment evidence, no usable workload credential path, exact-head proof,
and exact-ID dashboard reconciliation. Run every manifest command.

On rollout failure, stop new admission, drain, and terminate candidates. Heavy
lanes queue. Do not reroute to hosted runners. Prior launch-template and AMI
pins support mechanical rollback only. Restoring IMDS-enabled status quo needs
an explicit operator command and is not a successful security rollback.

Stop on missing authority, failed integrity or security proof, a credential
path reachable by job-controlled privilege, a hosted-heavy-lane proposal, or
fleet-packet ownership collision.

Done only after deployed proof, required checks, zero review threads, merge,
post-merge exact-ID closure, and a valid reflection.
