# Codex Security Findings (2026-09-03)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, remediate, and close every open Codex Cloud security finding
for `kriegcloud/beep-effect` in the 12-finding batch captured on 2026-09-03.
Ship the fixes through one Yeet-driven PR, close the exact captured findings, and
leave no packet-applicable finding open.

## Launch

```text
/goal follow the instructions in goals/codex-security-findings-2026-09-03/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`ops/triage.json`](./ops/triage.json)
6. [`findings/INDEX.md`](./findings/INDEX.md)

## Current Phase

`P5 repo-proof` - all 12 findings are confirmed and remediated in seven
shared-root lanes. Packet and repository proof are in progress; publication,
merge, and exact-ID closure remain pending.

## Findings at a glance

12 Informational findings. Accepted risk is unavailable; each item must be
fixed or closed only with strict proof that the report is already fixed or
materially invalid.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- Browser closure is post-merge and must match the captured Codex ID allowlist.
