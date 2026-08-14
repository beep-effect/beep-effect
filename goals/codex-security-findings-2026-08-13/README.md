# Codex Security Findings (2026-08-13)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, remediate, and close every open Codex Cloud security finding
for `kriegcloud/beep-effect` in the 19-finding batch captured on 2026-08-13.
Ship the fixes through Yeet-driven PRs, close the exact captured findings, and
leave no packet-applicable finding open.

## Launch

```text
/goal follow the instructions in goals/codex-security-findings-2026-08-13/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`ops/triage.json`](./ops/triage.json)
6. [`findings/INDEX.md`](./findings/INDEX.md)
7. [`research/QUALITY_REVIEW.md`](./research/QUALITY_REVIEW.md)

## Current Phase

<!-- codex-findings-refresh:start -->
Refresh triage: all 19 records are validated and assigned to remediation lanes.
<!-- codex-findings-refresh:end -->

`P4 remediate` / `P5 repo-proof` / `P6 publish` - all 19 findings are validated
and partitioned. CSF-002, CSF-007, CSF-009, CSF-010, CSF-013, and CSF-014 are
merged; CSF-011 was already fixed. CSF-012, CSF-015, CSF-016, CSF-017,
CSF-018, and CSF-019 have focused local proof and are being consolidated into
PR #712. Merged-tree full Yeet proof, push, hosted checks, and review closeout
remain pending.
CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 remain confirmed and
held on runner admission/workload-identity architecture and external GitHub
organization runner-group/AWS deployment proof.

The CI-fleet P2/P3 implementation landed through #666, #673, and #674, but the
six runner-admission findings still lack publishable external organization and
deployment evidence. This packet does not claim a Pulumi deployment.

## Findings at a glance

7 High, 6 Medium, 2 Low, 4 Informational findings: 18 `remediate` and 1
`already-fixed`. Six remediation findings are merged, six repository-fixable
findings are in the combined publication lane, and six are
architecture/deployment-blocked.
Accepted risk is unavailable.

## Local proof status

The first focused proof for CSF-016 through CSF-019 passed 60/60 tests across
the runner bake, AI-sync, identity-registry, and Postgres PGlite suites. The
repo-cli, AI-sync, repo-ai-metrics, Postgres, and Professional Desktop package
checks pass. Targeted Biome and ESLint pass, the Fallow audit reports zero
findings, and diff checks are clean.

CSF-012 and CSF-015 retain their prior focused proof. The consolidated #712
tree still requires current-main merge, generator reconciliation, Node 24
coverage-baseline regeneration, full exact-head Yeet verification, hosted
checks, and review closeout. Earlier per-branch Yeet runs remain historical
evidence and are not treated as proof for the combined head.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- Six remediation findings are merged. CSF-012, CSF-015, CSF-016, CSF-017,
  CSF-018, and CSF-019 are being consolidated into PR #712; the six runner
  findings remain held for external evidence.
- Browser closure is post-merge and must match the captured Codex ID allowlist.
