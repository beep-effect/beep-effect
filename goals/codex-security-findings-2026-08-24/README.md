# Codex Security Findings (2026-08-24)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, remediate, and close every open Codex Cloud security finding
for `kriegcloud/beep-effect` in the 19-finding batch captured on 2026-08-24.
Ship the fixes through one Yeet-driven PR, close the exact captured findings, and
leave no packet-applicable finding open.

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
6. [`findings/INDEX.md`](./findings/INDEX.md)

## Current Phase

`P5 repo-proof` - all 19 findings are validated. This capture PR contains
repo-side remediation and focused proof for 15 findings. CSF-001, CSF-004,
CSF-005, and CSF-006 remain confirmed `remediate` items handed to the
runner-admission/workload-identity arc for external GitHub organization
runner-group and AWS deployment proof. This packet claims neither that proof
nor dashboard closure for those four findings.

## Findings at a glance

5 High, 4 Medium, 5 Low, 5 Informational findings. Fifteen are remediated
repo-side in this PR and four remain with the named runner architecture arc.
Accepted risk is unavailable.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- CSF-003 and CSF-009 have repo-side fixes but still require the retained AMI
  bake, Pulumi pin, and deployed Gates A-E proof before fleet acceptance.
- Browser closure is post-merge and must match the captured Codex ID allowlist.
