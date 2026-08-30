# Runner Trust Boundary

## Status

Lifecycle: `active`; P1 and P2 complete 2026-08-24, P3 through P7 complete
2026-08-25, P8 reactivated 2026-08-30

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Keep heavy pull-request lanes on EC2 while removing ambient fleet privilege and
proving the admission and workload-identity boundaries.

## Ratified posture

**DEFANG THE FLEET, KEEP PRS ON IT.** Heavy lanes stay on EC2 because two
independent GitHub-hosted admissions ended in runner shutdowns with in-flight
tasks exiting 137. The fleet must instead become a non-privileged runner class:
no usable ambient instance-role credentials, a sealed digest-verified AMI, and
one ephemeral VM per job. Runner-group admission controls add defense in depth;
they are not the primary security boundary.

## Security lanes

- P2 Workload identity boundary owns removal of usable cloud identity from job
  execution and root-resistant proof for the two open IMDS findings.
- P3 Admission defense in depth owns the default-branch reusable workflow,
  organization runner-group controls, and proof for the two open findings about
  pull-request code running on owned EC2 capacity.
- Admission follows workload identity and remains defense in depth.
- `P1` proves the already-landed AMI and IMDS-hook fixes in a fresh deployment
  before the bootstrap rewrite. `P6` closes the two held dashboard findings
  only after the `P5` merge gate.

The complete identity transfer is in [`SPEC.md`](./SPEC.md#findings-transfer).

## Relationship to fleet packets

This packet owns runner trust-boundary security, including the post-release
JIT replay residual. The active
[`ci-fleet-endgame`](../ci-fleet-endgame/README.md) packet keeps fleet
performance and architecture ownership and remains P6-gated. The
completed-retained [`ci-fleet-residue`](../ci-fleet-residue/README.md) packet
is the live-validation precedent, especially Gate E and teardown evidence from
run `31779611279`; it is not reopened by this work.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/runner-trust-boundary/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative boundary and finding allowlist.
3. [`PLAN.md`](./PLAN.md) - active execution sequence.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/P0-GRILL.md`](./research/P0-GRILL.md) - ratified design,
   sequence, rollback, and live assumptions.
6. [`research/P0-FACTS.md`](./research/P0-FACTS.md) - sanitized live inventory.
7. [`research/P1-EVIDENCE.md`](./research/P1-EVIDENCE.md) - fresh bake,
   deployment, red-team, fast-path, teardown, and closure-ready proof.
8. [`research/P2-DESIGN.md`](./research/P2-DESIGN.md) - workload identity
   realization, IAM edges, boot handoff, proof plan, and operator steps.
9. [`research/P2-EVIDENCE.md`](./research/P2-EVIDENCE.md) - rollout incident,
   canaries, IAM semantics, deployed proof, residuals, and closure-ready maps.
10. [`research/P3-DESIGN.md`](./research/P3-DESIGN.md) - organization
    admission, reusable-workflow cutover, check contexts, replay probe, and
    proof plan.
11. [`research/P3-EVIDENCE.md`](./research/P3-EVIDENCE.md) - cutover
    timeline, deployed group state, admission probes, and the retained P3
    residual.
12. [`research/P4-EVIDENCE.md`](./research/P4-EVIDENCE.md) - final-head
    red team with the JIT replay rejection, lifecycle, live state, merge-gate
    reading, and the closure-ready mapping for all six IDs.
13. [`ops/closures.json`](./ops/closures.json) - sanitized exact-ID
    dashboard closure ledger.
14. [`history/reflections/2026-08-25-claude.md`](./history/reflections/2026-08-25-claude.md)
    - closeout reflection.
15. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - P1 through
    P4 friction receipts and prevention notes.
16. [`research/SOURCES.md`](./research/SOURCES.md) - source and fact-check
    ledger.
17. The three source packets named in the transfer table.
18. The fleet packet evidence named above.

## Current Phase

Active at P8 Post-release JIT containment. P4 Boundary verification completed
on 2026-08-25: the final-head red
team (run `32893112867` on `4764cdb4ba`) passed Gates A through J, L, and the
new M JIT-replay gate exactly once each, with `AMI_PIN`, a live
`METADATA_DISABLED (disabled applied)` sample, scoped deregistration, and EC2
termination one second after completion. GitHub refused the replayed one-use
JIT configuration with `A session for this runner already exists.` (concurrent
replay only; post-release replay is exception E1). The live runner-group and
AWS state were re-read and match the committed controller source. P5 through P7 closed the same day: every remediation PR is merged, the
six exact Codex IDs are closed as Already fixed with the ledger in
[`ops/closures.json`](./ops/closures.json), and the reflection is retained.
The 2026-08-30 security review identified that the packet nevertheless closed
while post-release replay and argv exposure remained unproved. P8 now owns
that residual and prevents lifecycle closure until containment or server-side
replay rejection is demonstrated live.
Evidence: [`research/P4-EVIDENCE.md`](./research/P4-EVIDENCE.md).

## Latest Evidence

On 2026-08-25 at `20:03Z`, red-team run `32893112867` passed Gates A through
J, L, and M exactly once, `AMI_PIN (ami-0738c1b69711969bc)`, live
`METADATA_DISABLED (disabled applied)`, scoped deregistration, and EC2
termination after 1 second, ending `REDTEAM: PASS`. The #812 push run
`32892496750` placed `Build` and all five `Heavy / ...` jobs on group-4
runners through `check.yml@refs/heads/main` and `heavy.yml@refs/heads/main`.
Two exceptions are recorded in [`SPEC.md`](./SPEC.md#exception-ledger): E1,
the replay probe proves concurrent-replay rejection only and post-release
replay is untested (the packet's open security residual, owned by
`ci-fleet-endgame`); E2, four IDs were closed on 2026-08-24 by operator
authority before the P4 re-proof. Other residuals: the serving image is stale
against the post-#812 lockfile (re-bake owned by `ci-fleet-endgame`) and 74
inert pre-cutover repository registrations.

## Notes

- Changing the ratified mechanism, moving heavy pull-request lanes to hosted
  runners, or making admission the primary boundary requires a new operator
  decision. P8 is a correction to the existing trust-boundary acceptance gate,
  not a change to the ratified fleet posture.
- `P1` evidence is retained in `research/P1-EVIDENCE.md`. Every later lockfile
  change on `main` re-stales the image until a new bake is deployed.
- Never store raw finding bodies, credentials, email addresses, machine IDs, or
  developer-local absolute paths in this public packet.
