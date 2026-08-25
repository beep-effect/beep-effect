# Runner Trust Boundary

## Status

Lifecycle: `active`; P2 complete 2026-08-24, P3 cut over 2026-08-25

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

This packet owns runner trust-boundary security. The active
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
12. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - P1 and P2
    friction receipts and prevention notes.
12. [`research/SOURCES.md`](./research/SOURCES.md) - source and fact-check
    ledger.
13. The three source packets named in the transfer table.
14. The fleet packet evidence named above.

## Current Phase

P2 Workload identity boundary completed on 2026-08-24 with closure-ready
evidence retained in
[`research/P2-EVIDENCE.md`](./research/P2-EVIDENCE.md). Launch-template v13
remains the fleet default after a clean canary and deployed red-team proof. P3
Admission defense in depth cut over on 2026-08-25: #805 staged `heavy.yml`
through a local reusable-workflow call, the five required contexts were renamed
to their `Heavy / ...` forms, and #808 pinned the call to `heavy.yml@main` while
organization group `beep-ec2-heavy` was restricted to the four protected
default-branch workflows. The controller's organization registration deployed,
failed closed on a missing installation permission (which itself proved the
no-fallback half of the admission design), and rolled back; accepting the
permission and redeploying is the remaining P3 step. Evidence:
[`research/P3-EVIDENCE.md`](./research/P3-EVIDENCE.md). P4 owns the live JIT
replay run; its operator-controlled probe is implemented.

## Latest Evidence

On 2026-08-24, red-team run `32786883010` passed Gates A through J and L
exactly once, `AMI_PIN`, live `METADATA_DISABLED (disabled applied)`, scoped
deregistration, and EC2 termination after 1 second. The sample stream captured
`disabled applied running` before guest poweroff. The test-integration lane
probe kept the sealed Bun `1.4.0` fast path keyed to lockfile digest
`f81ab29f…`. The two P2 workload-identity findings are closure-ready and remain
open until the P5 merge gate; P6 owns dashboard closure.

## Notes

- Changing the ratified mechanism, moving heavy pull-request lanes to hosted
  runners, or making admission the primary boundary requires a new operator
  decision.
- `P1` evidence is retained in `research/P1-EVIDENCE.md`. Every later lockfile
  change on `main` re-stales the image until a new bake is deployed.
- Never store raw finding bodies, credentials, email addresses, machine IDs, or
  developer-local absolute paths in this public packet.
