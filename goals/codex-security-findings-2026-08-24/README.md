# Codex Security Findings (2026-08-24)

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, and account for every Codex Cloud security finding in the
19-finding batch captured on 2026-08-24 for `kriegcloud/beep-effect`. Ship the
bounded fixes through one Yeet-driven PR, close 13 exact IDs, and transfer the
six runner-boundary IDs to `goals/runner-trust-boundary` with proof gates.

## Launch

```text
/goal follow the instructions in goals/codex-security-findings-2026-08-24/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`ops/triage.json`](./ops/triage.json)
6. [`ops/closures.json`](./ops/closures.json)
7. [`findings/INDEX.md`](./findings/INDEX.md)

## Current Phase

`P9 complete` - all 19 findings were validated. PR #783 contains repo-side
remediation and focused proof for 15 findings. On 2026-08-24, 13 dashboard IDs
were closed as Already fixed citing PR #783. CSF-003 and CSF-009 remain open
pending the fresh deployment proof in
[`runner-trust-boundary` P1](../runner-trust-boundary/PLAN.md). CSF-001,
CSF-004, CSF-005, and CSF-006 are transferred to that packet for admission and
workload-identity remediation. This source packet is complete and retained; it
does not claim the receiving packet's external proof or dashboard closure.
The 13 exact closures are recorded in [`ops/closures.json`](./ops/closures.json).

## Findings at a glance

5 High, 4 Medium, 5 Low, 5 Informational findings. Fifteen were remediated in
PR #783. Thirteen of those dashboard IDs are closed as Already fixed. The two
deployment-held IDs and four transferred runner IDs account for the exact six
findings still open in the dashboard on 2026-08-24. Accepted risk was not used.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- CSF-003 and CSF-009 have repo-side fixes but remain open until
  `runner-trust-boundary` P1 records the fresh AMI bake, Pulumi pin, deployed
  Gates A-E, setup fast-path, deregistration, and teardown proof.
- The exact identity transfer and current dashboard state are retained in
  [`runner-trust-boundary/SPEC.md`](../runner-trust-boundary/SPEC.md#findings-transfer).
- Future dashboard closure belongs to the receiving packet and must use the
  captured Codex ID allowlist.
