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
2. P1 08-24 CSF-003/CSF-009 deployment proof: complete 2026-08-24. Treat
   `research/P1-EVIDENCE.md` as the fresh bake, deployed pin, red-team,
   fast-path, teardown, and closure-ready record. Codex IDs
   `9459410104b881919cd820b97c673b67` and
   `d1f026deb21881919d853e63780734fe` remain open until the P5 merge gate;
   P6 owns dashboard closure.
3. P2 Workload identity boundary: complete 2026-08-24. Treat
   `research/P2-EVIDENCE.md` as the canary, current-state IAM, deployed
   A-through-J-plus-L, lane, and closure-ready record. The self-only Allow
   applies while current state is `enabled`; the boundary denies changes once
   state is `disabled`. Informational JIT argv residue remains P4 work.
4. P3 Admission defense in depth: complete 2026-08-25. Treat
   `research/P3-EVIDENCE.md` as the cutover, group-state, registration, and
   admission-probe record. Heavy lanes run through `heavy.yml@main`; group
   `beep-ec2-heavy` admits only the four protected `refs/heads/main`
   workflows; the controller registers at organization scope and fails closed
   without fallback. Do not repeat the cutover or the redeploy.
5. P4 Boundary verification: run the operator-controlled JIT replay probe,
   rerun the complete deployed proof, and mark all six exact Codex IDs
   closure-ready.
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
