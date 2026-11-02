# Runner Trust Boundary

## Status

Lifecycle: `active` until the closeout PR's completion is verified; P0 through P8
complete (P8 on 2026-11-02, E1 accepted as a residual by the operator).

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

P8 completed on 2026-11-02 and the packet proposes `completed-retained`
through its closeout PR. The deployed runner class re-passed the A-through-L
red team on `main` (run `41409672251`). Probe N showed that a leaked one-use
JIT configuration is refused from the original and a second host after an
orderly listener stop (run `41422745680`), and accepted after a SIGKILL stop
until the original job ends (run `41429667965`). A 12-minute hold of such a
session started no job (run `41452707373`). The operator accepted that
residual (SPEC Decision Log). Evidence: [`history/`](./history/).

## Latest Evidence

On 2026-11-02 the post-release replay probe ran live (Probe N,
[`ops/post-release-replay.sh`](./ops/post-release-replay.sh)). After an
orderly listener stop, GitHub deleted the registration and refused the leaked
JIT configuration from the original host and from a disposable second host
(run `41422745680`). After a SIGKILL stop, which a sudo-capable job can do,
the same-host replay was **accepted** about three minutes later while the
registration stayed busy until the job timed out (run `41429667965`). E1 is
confirmed for that stop; P8 is stopped for an operator decision (options in
[`PLAN.md`](./PLAN.md#p8-operator-decision-decided-2026-11-02-accept-e1-as-a-residual)). Receipts:
[`history/`](./history/).

The operator chose to measure the exposure first. In run `41452707373` the
replayed session was held for 12 minutes and no job started on it: a
decoy and all 32 real heavy jobs that started during the hold went to other
runners, and the session ended
when the original job was cancelled. The operator then accepted E1 as a
residual (SPEC Decision Log).

On 2026-11-02 run `41409672251` re-passed Gates A through J and L,
`AMI_PIN`, live `METADATA_DISABLED`, deregistration and teardown on `main`,
and a read-only audit matched the deployed IAM, launch template and runner
group to source. The red-team verifier's roster reads were moved to the
organization list. P8 now waits only on the operator-granted post-release
replay window. See
[`history/2026-11-02-p8-state-audit.md`](./history/2026-11-02-p8-state-audit.md).

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
