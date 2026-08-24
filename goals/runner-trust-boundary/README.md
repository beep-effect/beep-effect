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
7. [`research/SOURCES.md`](./research/SOURCES.md) - source and fact-check
   ledger.
8. The three source packets named in the transfer table.
9. The fleet packet evidence named above.

## Current Phase

`P1 08-24 CSF-003/CSF-009 deployment proof` is in progress. P0 was ratified on
2026-08-24 in [`research/P0-GRILL.md`](./research/P0-GRILL.md). Run `P1` now as a
standalone hardened-image baseline before P2 Workload identity boundary, then
apply P3 Admission defense in depth.

## Latest Evidence

On 2026-08-24, live reads verified launch-template version 8, SSM AMI-pin
version 5, the profile's role and policy intersection, an idle EC2 fleet with
30 terminated instances, and zero current repository runners. The bake check
is stale for Bun, lockfile, and archive inputs. The operator ratified the `P1`
baseline, `P2` pre-job IMDS disable, `P3` reusable-workflow admission, and
stop-and-drain rollback posture.

## Notes

- Changing the ratified mechanism, moving heavy pull-request lanes to hosted
  runners, or making admission the primary boundary requires a new operator
  decision.
- `P1` must produce new deployment evidence. Repository tests and the 2026-08-14
  live run are precedent, not substitutes.
- Never store raw finding bodies, credentials, email addresses, machine IDs, or
  developer-local absolute paths in this public packet.
