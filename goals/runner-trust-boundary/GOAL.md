# GOAL: prove the runner trust boundary

Repo root is the working directory; paths are repo-relative.

Outcome: keep heavy pull-request work on EC2 while replacing the fleet's
ambient privilege with a sealed, digest-verified, one-job-one-VM runner class
that exposes no usable instance-role credentials to job code.

Read `SPEC.md`, `PLAN.md`, `ops/manifest.json`, and `research/P0-GRILL.md`
first, then repo law and the evidence the spec names. Repo law outranks
packet prose.

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
   `d1f026deb21881919d853e63780734fe` closed 2026-08-24 after #783 and #796
   merged (`ops/closures.json`).
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
5. P4 Boundary verification: complete 2026-08-25. Treat
   `research/P4-EVIDENCE.md` as the final-head proof of record: run
   `32893112867` passed Gates A through M (concurrent JIT replay rejected),
   `AMI_PIN`, live `METADATA_DISABLED`, scoped deregistration, and EC2
   teardown. Post-release replay is untested: SPEC exception E1.
6. P5 merge gate: complete. Each remediation PR (#796, #800, #805, #808,
   #814) merged with operator authority before its findings were closed.
7. P6 and P7: complete 2026-08-25. The six exact IDs are closed as Already
   fixed (`ops/closures.json`); the reflection is under `history/`.

The packet is completed-retained; reopen only for a new operator decision or
a fleet change that invalidates the deployed proof.

Acceptance requires every `SPEC.md` criterion, the grill record, deployment
evidence, no usable workload credential path, exact-head proof, and exact-ID
dashboard reconciliation. Run every manifest command.

On rollout failure, stop new admission, drain, and terminate candidates. Heavy
lanes queue. Do not reroute to hosted runners. Prior launch-template and AMI
pins support mechanical rollback only. Restoring IMDS-enabled status quo needs
an explicit operator command and is not a successful security rollback.

Stop on missing authority, failed integrity or security proof, a credential
path reachable by job privilege, a hosted-heavy-lane proposal, or fleet-packet
ownership collision.

Done: deployed proof, green checks, zero review threads, merges, exact-ID
closure, and a valid reflection are retained.
