# Codex Security Findings (2026-08-10) Plan

## Status

Status: `completed-retained`. PR #655 merged the bounded remediation scope.
Seven findings were retained as explicit follow-up handoffs; three later landed
through PRs #697, #688, and #712, while four runner findings remain with the
runner-admission/workload-identity arc.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture all live findings via the signed-in CSV export. | 18 IDs reconcile: 4 High, 9 Medium, 4 Low, 1 Informational. |
| P2 validate | complete | Reproduce each report at current HEAD. | Every item has strict verdict, disposition, rationale, and owner surface. |
| P3 lane-partition | complete | Group shared root causes and disjoint paths. | Lanes recorded without overlapping file ownership. |
| P4 remediate | complete | Fix all findings that belong in this PR. | Five fix-now items are patched; seven architecture/policy items are explicitly deferred. |
| P5 repo-proof | complete | Run packet validation and Yeet repair/verify. | Bounded remediation evidence is retained in merged PR #655. |
| P6 publish | complete | Publish one intentional PR through Yeet. | PR #655 was published and merged. |
| P7 monitor | complete | Close hosted checks and actionable reviews. | Merge is verified in local history. |
| P8 merge-and-close | complete | Merge and close or hand off captured findings. | PR #655 merged; seven residual items received explicit follow-up owners. No dashboard closure is claimed here. |
| P9 close | complete | Record evidence, reflection, and lifecycle. | Packet set to `completed-retained` with a closeout reflection. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-08-10/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-08-10/ops/manifest.json
jq . goals/codex-security-findings-2026-08-10/ops/triage.json
test "$(find goals/codex-security-findings-2026-08-10/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 18
git diff --check -- goals/codex-security-findings-2026-08-10
```
