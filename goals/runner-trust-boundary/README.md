# Runner Trust Boundary

## Status

Lifecycle: `active`

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

- The admission lane owns organization runner-group controls and proof for the
  two open findings about pull-request code running on owned EC2 capacity.
- The workload-identity lane owns removal of usable cloud identity from job
  execution and root-resistant proof for the two open IMDS findings.
- P1 first proves the already-landed AMI and IMDS-hook fixes in a fresh
  deployment, then closes the two held dashboard findings as Already fixed.

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
5. [`research/SOURCES.md`](./research/SOURCES.md) - source and fact-check
   ledger.
6. The three source packets named in the transfer table.
7. The fleet packet evidence named above.

## Current Phase

`P0 Posture validation and grill gate` is pending. Validate the ratified posture
against live GitHub organization runner-group state, deployed AWS facts, and
the current heavy-lane placement evidence. End P0 with an operator grill. Do
not start P1 or either remediation lane until the operator ratifies the
evidence-backed design.

## Latest Evidence

Packet scaffolded on 2026-08-24 from the three retained Codex findings packets,
the live six-finding dashboard inventory supplied by the operator, and the
fleet deployment evidence cataloged in `research/SOURCES.md`.

## Notes

- P0 may refine the mechanism, but it may not move heavy PR lanes to hosted
  runners or make admission gating the primary boundary without a new operator
  decision.
- P1 must produce new deployment evidence. Repository tests and the 2026-08-14
  live run are precedent, not substitutes.
- Never store raw finding bodies, credentials, email addresses, machine IDs, or
  developer-local absolute paths in this public packet.
